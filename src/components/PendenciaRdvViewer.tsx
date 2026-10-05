"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { mostrarErro } from "@/utils/avisoApi";
import { Button } from "@/components/ui/button";
import { PendenciaAcoesFooter } from "@/components/PendenciaAcoesFooter";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import { Rdv, aprovarRdv, assinar, getAprovacoesRdv } from "@/services/rdvService";
import { getAnexoByIdmov } from "@/services/requisicoesService";
import { invalidatePendenciasGestorCache } from "@/services/pendenciasService";
import { imprimirPdfBase64, normalizeUserCode } from "@/utils/functions";
import { aplicarGestorUnidadePendencia } from "@/utils/pendenciaAssinatura";
import { buildCodigosAprovacaoFromSession } from "@/utils/usuarioAprovacaoMovimento";
import { labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onConcluido?: () => void;
};

/** Mesmas regras da tela Aprovação de RDV (AprovacaoRdvPage): assina o documento do movimento e depois aprova/reprova. */
function situacaoUsuario(rdv: Rdv) {
  const logados = buildCodigosAprovacaoFromSession();
  const meus = (rdv.aprovadores ?? []).filter((ap) => logados.has(normalizeUserCode(ap.usuario)));
  const ehAprovador = meus.length > 0;
  const jaDecidiu = meus.some((ap) => ap.aprovacao === "A" || ap.aprovacao === "R");
  const emAndamento = (rdv.situacao ?? "").trim().toLowerCase() === "em andamento";
  const assinouOuSemArquivo = !rdv.arquivo || rdv.arquivo_assinado === true;
  return {
    podeAssinar: ehAprovador && emAndamento && !jaDecidiu && rdv.arquivo_assinado !== true,
    podeDecidir: ehAprovador && emAndamento && !jaDecidiu && assinouOuSemArquivo,
  };
}

/** Por que não há botão de assinar/aprovar (só visualização). */
function motivoSemAcao(rdv: Rdv): string {
  const logados = buildCodigosAprovacaoFromSession();
  const meus = (rdv.aprovadores ?? []).filter((ap) => logados.has(normalizeUserCode(ap.usuario)));
  if (meus.length === 0) return "Você pode visualizar este RDV, mas não está no fluxo de aprovação.";
  if (meus.some((ap) => ap.aprovacao === "A")) return "Você já aprovou este RDV.";
  if (meus.some((ap) => ap.aprovacao === "R")) return "Você já reprovou este RDV.";
  if ((rdv.situacao ?? "").trim().toLowerCase() !== "em andamento")
    return `Este RDV está "${rdv.situacao}" e não aceita mais assinatura nem aprovação.`;
  return "Nada a fazer neste RDV agora.";
}

export function PendenciaRdvViewer({ item, onClose, onConcluido }: Props) {
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rdv, setRdv] = useState<Rdv | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfViewerKey, setPdfViewerKey] = useState(0);
  const restaurarGestorRef = useRef<(() => void) | null>(null);
  const reqRef = useRef(0);

  const buscarRdv = useCallback(async (): Promise<Rdv | null> => {
    const hoje = new Date().toISOString().slice(0, 10);
    // "Em andamento" sem janela de datas, como a tela de aprovação faz para pendentes.
    const lista = await getAprovacoesRdv("Em andamento", "1900-01-01", hoje);
    return lista.find((r) => r.id === item.id) ?? null;
  }, [item.id]);

  const carregar = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setErro(null);
    setRdv(null);
    setPdfBase64(null);

    restaurarGestorRef.current?.();
    restaurarGestorRef.current = aplicarGestorUnidadePendencia(item);

    try {
      const encontrado = await buscarRdv();
      if (reqId !== reqRef.current) return;
      if (!encontrado) {
        setErro("RDV não encontrado entre os pendentes (já pode ter sido aprovado ou reprovado).");
        return;
      }
      setRdv(encontrado);
      if (!encontrado.idmov || !encontrado.codigo_atendimento) {
        setErro("Este RDV ainda não tem movimento no RM, então não há documento para assinar.");
        return;
      }
      const doc = await getAnexoByIdmov(encontrado.idmov, encontrado.codigo_atendimento);
      if (reqId !== reqRef.current) return;
      setPdfBase64(doc.arquivo);
      setPdfViewerKey((k) => k + 1);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao carregar RDV.";
      setErro(msg);
      toast.error(msg);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [buscarRdv, item]);

  useEffect(() => {
    void carregar();
    return () => {
      restaurarGestorRef.current?.();
      restaurarGestorRef.current = null;
    };
  }, [carregar]);

  function handleFechar() {
    restaurarGestorRef.current?.();
    restaurarGestorRef.current = null;
    onClose();
  }

  async function confirmarAssinatura({ page, posX, posY, largura, altura }: PdfSignData) {
    if (!rdv?.id || !pdfBase64) return;
    setProcessando(true);
    const toastId = toast.loading("Assinando RDV…");
    try {
      await assinar({
        idrdv: rdv.id,
        arquivo: pdfBase64,
        pagina: page,
        posX,
        posY,
        largura,
        altura,
        dataHoraAssinatura: new Date().toLocaleString("pt-BR"),
      });
      toast.dismiss(toastId);
      toast.success("Assinatura enviada com sucesso.");
      // Recarrega RDV e documento para o PDF já mostrar a assinatura.
      const atualizado = await buscarRdv();
      if (atualizado) {
        setRdv(atualizado);
        if (atualizado.idmov && atualizado.codigo_atendimento) {
          const doc = await getAnexoByIdmov(atualizado.idmov, atualizado.codigo_atendimento);
          setPdfBase64(doc.arquivo);
          setPdfViewerKey((k) => k + 1);
        }
      }
      toast.message("RDV assinado. Escolha Aprovar ou Reprovar abaixo.");
    } catch (e) {
      toast.dismiss(toastId);
      mostrarErro(e);
    } finally {
      setProcessando(false);
    }
  }

  async function decidir(aprovacao: "A" | "R") {
    if (!rdv?.id) return;
    setProcessando(true);
    const toastId = toast.loading(aprovacao === "A" ? "Registrando aprovação…" : "Registrando reprovação…");
    try {
      await aprovarRdv(rdv.id, aprovacao);
      toast.dismiss(toastId);
      invalidatePendenciasGestorCache();
      toast.success(aprovacao === "A" ? `RDV nº ${rdv.id} aprovado.` : `RDV nº ${rdv.id} reprovado.`);
      onConcluido?.();
      handleFechar();
    } catch (e) {
      toast.dismiss(toastId);
      mostrarErro(e);
    } finally {
      setProcessando(false);
    }
  }

  const { podeAssinar, podeDecidir } = rdv ? situacaoUsuario(rdv) : { podeAssinar: false, podeDecidir: false };

  return (
    <div className="flex min-h-[min(72vh,680px)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleFechar}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {item.unidade.replace("WAY ", "Base ")} · {labelTipoPendencia(item.tipo)}
            {podeAssinar ? " · 1. Visualizar e assinar" : podeDecidir ? " · 2. Aprovar ou reprovar" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void carregar()}
          disabled={loading || processando}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Recarregar
        </Button>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Carregando RDV…
        </div>
      )}

      {!loading && erro && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-destructive">{erro}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !erro && pdfBase64 && (
        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <PdfViewerDialog
            key={`rdv-${pdfViewerKey}`}
            embedded
            open
            onOpenChange={() => {}}
            title={`Documento RDV nº ${rdv?.id ?? item.id}`}
            pdfBase64={pdfBase64}
            canSign={podeAssinar}
            onSign={confirmarAssinatura}
            onPrint={() => imprimirPdfBase64(pdfBase64)}
            isLoading={processando}
            confirmLabel="Assinar"
            placeHint={podeAssinar ? "Clique no PDF para posicionar a assinatura" : undefined}
            panelClassName="min-h-[min(48vh,480px)]"
          />
        </div>
      )}

      {!loading && !erro && rdv && !podeAssinar && !podeDecidir && (
        <div className="shrink-0 border-t px-4 py-3 text-sm text-muted-foreground">
          {motivoSemAcao(rdv)}
        </div>
      )}

      {!loading && !erro && podeDecidir && (
        <PendenciaAcoesFooter
          mensagem={rdv?.arquivo_assinado ? "RDV assinado. Escolha Aprovar ou Reprovar para concluir." : "Escolha Aprovar ou Reprovar para concluir."}
          processando={processando}
          podeAprovar
          podeReprovar
          labelAprovar="Aprovar RDV"
          labelReprovar="Reprovar RDV"
          onAprovar={() => void decidir("A")}
          onReprovar={() => void decidir("R")}
        />
      )}
    </div>
  );
}
