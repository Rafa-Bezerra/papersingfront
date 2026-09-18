"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { PendenciaAcoesFooter } from "@/components/PendenciaAcoesFooter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import type { FiscalDocumento, FiscalResponseDto } from "@/types/Fiscal";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import type { PendenciaAnexoListaItem } from "@/types/PendenciaAnexo";
import { invalidatePendenciasGestorCache } from "@/services/pendenciasService";
import { aplicarGestorUnidadePendencia } from "@/utils/pendenciaAssinatura";
import {
  PendenciaAnexosLista,
} from "@/components/PendenciaAnexosLista";
import {
  aprovarFiscalPendencia,
  assinarFiscalPendencia,
  carregarFiscalPendencia,
  pdfFiscalPorIndice,
  podeAprovarFiscal,
  podeAssinarFiscal,
  reprovarFiscalPendencia,
} from "@/utils/pendenciaFiscal";
import { labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { imprimirPdfBase64 } from "@/utils/functions";
import { cn } from "@/lib/utils";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onConcluido?: () => void;
};

export function PendenciaFiscalViewer({ item, onClose, onConcluido }: Props) {
  const [loading, setLoading] = useState(true);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fiscal, setFiscal] = useState<FiscalResponseDto | null>(null);
  const [itens, setItens] = useState<PendenciaAnexoListaItem[]>([]);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [pdfPrincipal, setPdfPrincipal] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [arquivoAssinatura, setArquivoAssinatura] = useState<string>("");
  const restaurarGestorRef = useRef<(() => void) | null>(null);
  const reqRef = useRef(0);
  const anexosRef = useRef<FiscalDocumento[]>([]);
  const pdfPrincipalRef = useRef<string>("");
  const [pdfViewerKey, setPdfViewerKey] = useState(0);

  const aplicarIndice = useCallback(
    (indice: number, listaAnexos: FiscalDocumento[], principal: string) => {
      setIndiceAtivo(indice);
      setCarregandoPdf(true);
      try {
        const pdf = pdfFiscalPorIndice(indice, principal, listaAnexos);
        setPdfBase64(pdf);
        setPdfViewerKey((k) => k + 1);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao carregar anexo.";
        toast.error(msg);
        setPdfBase64(null);
      } finally {
        setCarregandoPdf(false);
      }
    },
    []
  );

  const aplicarDados = useCallback(
    (dados: Awaited<ReturnType<typeof carregarFiscalPendencia>>) => {
      setFiscal(dados.fiscal);
      setItens(dados.itens);
      setPdfPrincipal(dados.pdfPrincipal);
      setArquivoAssinatura(dados.arquivoAssinatura);
      anexosRef.current = dados.anexos;
      pdfPrincipalRef.current = dados.pdfPrincipal;
      aplicarIndice(0, dados.anexos, dados.pdfPrincipal);
      setErro(null);
      return dados.fiscal;
    },
    [aplicarIndice]
  );

  const carregar = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setErro(null);
    setPdfBase64(null);
    setPdfPrincipal(null);
    setFiscal(null);
    setItens([]);
    setIndiceAtivo(0);

    restaurarGestorRef.current?.();
    restaurarGestorRef.current = aplicarGestorUnidadePendencia(item);

    try {
      const dados = await carregarFiscalPendencia(item);
      if (reqId !== reqRef.current) return;
      aplicarDados(dados);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao carregar fiscal.";
      setErro(msg);
      toast.error(msg);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [aplicarDados, item]);

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

  function handleImprimir() {
    if (!pdfBase64) return;
    imprimirPdfBase64(pdfBase64);
  }

  async function finalizarDecisao(mensagem: string) {
    invalidatePendenciasGestorCache();
    toast.success(mensagem);
    onConcluido?.();
    handleFechar();
  }

  async function confirmarAssinatura(signData: PdfSignData) {
    if (!fiscal || !arquivoAssinatura) return;

    setProcessando(true);
    const toastId = toast.loading("Assinando documento fiscal…");
    try {
      await assinarFiscalPendencia(fiscal, arquivoAssinatura, signData);
      toast.dismiss(toastId);
      toast.success("Documento fiscal assinado.");

      const dados = await carregarFiscalPendencia(item);
      aplicarDados(dados);
      toast.message("Documento assinado. Escolha Aprovar ou Reprovar abaixo.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleAprovar() {
    if (!fiscal) return;
    setProcessando(true);
    const toastId = toast.loading("Registrando aprovação…");
    try {
      await aprovarFiscalPendencia(fiscal);
      toast.dismiss(toastId);
      await finalizarDecisao("Fiscal aprovado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleReprovar() {
    if (!fiscal) return;
    if (!window.confirm("Deseja reprovar este fiscal?")) return;

    setProcessando(true);
    const toastId = toast.loading("Registrando reprovação…");
    try {
      await reprovarFiscalPendencia(fiscal);
      toast.dismiss(toastId);
      await finalizarDecisao("Fiscal reprovado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao reprovar.");
    } finally {
      setProcessando(false);
    }
  }

  const itemAtivo = itens[indiceAtivo];
  const podeAssinar = Boolean(fiscal && podeAssinarFiscal(fiscal, indiceAtivo));
  const podeDecidir = Boolean(fiscal && podeAprovarFiscal(fiscal));
  const tituloPdf = itemAtivo?.nome ?? `Fiscal nº ${fiscal?.fiscal.idmov ?? item.id}`;

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
            {itens.length > 1 ? ` · ${itens.length} arquivos` : ""}
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
          Carregando fiscal e anexos…
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

      {!loading && !erro && pdfBase64 && pdfPrincipal && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {itens.length > 1 && (
            <PendenciaAnexosLista
              titulo="Documentos"
              itens={itens}
              indiceAtivo={indiceAtivo}
              onSelecionar={(i) =>
                aplicarIndice(i, anexosRef.current, pdfPrincipalRef.current)
              }
              disabled={processando}
            />
          )}
          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
            <PdfViewerDialog
              key={`fiscal-${indiceAtivo}-${pdfViewerKey}`}
              embedded
              open
              onOpenChange={() => {}}
              title={tituloPdf}
              pdfBase64={pdfBase64}
              canSign={podeAssinar}
              onSign={confirmarAssinatura}
              onPrint={handleImprimir}
              isLoading={processando || carregandoPdf}
              confirmLabel="Assinar"
              placeHint={
                podeAssinar
                  ? "Clique no PDF para posicionar a assinatura"
                  : indiceAtivo > 0
                    ? "Visualização do anexo — volte ao documento fiscal para assinar"
                    : undefined
              }
              panelClassName="min-h-[min(48vh,480px)]"
            />
          </div>
        </div>
      )}

      {!loading && !erro && podeDecidir && (
        <PendenciaAcoesFooter
          mensagem="Documento assinado. Escolha Aprovar ou Reprovar para concluir."
          processando={processando}
          podeAprovar
          podeReprovar
          labelAprovar="Aprovar fiscal"
          onAprovar={() => void handleAprovar()}
          onReprovar={() => void handleReprovar()}
        />
      )}
    </div>
  );
}
