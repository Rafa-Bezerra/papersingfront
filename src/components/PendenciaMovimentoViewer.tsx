"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PendenciaAcoesFooter } from "@/components/PendenciaAcoesFooter";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import type { RequisicaoDto } from "@/types/Requisicao";
import type { Anexo } from "@/types/Anexo";
import { assinar } from "@/services/assinaturaService";
import { aprovar } from "@/services/requisicoesService";
import { invalidatePendenciasGestorCache } from "@/services/pendenciasService";
import { imprimirPdfBase64 } from "@/utils/functions";
import { aplicarGestorUnidadePendencia } from "@/utils/pendenciaAssinatura";
import {
  PendenciaAnexosLista,
  type PendenciaAnexoListaItem,
} from "@/components/PendenciaAnexosLista";
import {
  carregarMovimentoPendencia,
  pdfAnexoMovimentoPorIndice,
  podeAprovarMovimento,
  podeAssinarMovimento,
  recusarMovimentoPendencia,
} from "@/utils/pendenciaMovimento";
import { labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onConcluido?: () => void;
};

export function PendenciaMovimentoViewer({ item, onClose, onConcluido }: Props) {
  const [loading, setLoading] = useState(true);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [requisicao, setRequisicao] = useState<RequisicaoDto | null>(null);
  const [itens, setItens] = useState<PendenciaAnexoListaItem[]>([]);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [pdfPrincipal, setPdfPrincipal] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [dialogRecusa, setDialogRecusa] = useState(false);
  const [avaliacaoRecusa, setAvaliacaoRecusa] = useState("");
  const restaurarGestorRef = useRef<(() => void) | null>(null);
  const reqRef = useRef(0);
  const anexosRef = useRef<Anexo[]>([]);
  const pdfPrincipalRef = useRef<string>("");
  const [pdfViewerKey, setPdfViewerKey] = useState(0);

  const aplicarIndice = useCallback((indice: number, listaAnexos: Anexo[], principal: string) => {
    setIndiceAtivo(indice);
    setCarregandoPdf(true);
    try {
      const pdf = pdfAnexoMovimentoPorIndice(indice, principal, listaAnexos);
      setPdfBase64(pdf);
      setPdfViewerKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar anexo.";
      toast.error(msg);
      setPdfBase64(null);
    } finally {
      setCarregandoPdf(false);
    }
  }, []);

  const aplicarDados = useCallback(
    (dados: Awaited<ReturnType<typeof carregarMovimentoPendencia>>) => {
      setRequisicao(dados.requisicao);
      setItens(dados.itens);
      setPdfPrincipal(dados.pdfBase64);
      anexosRef.current = dados.anexos;
      pdfPrincipalRef.current = dados.pdfBase64;
      aplicarIndice(0, dados.anexos, dados.pdfBase64);
      setErro(null);
      return dados.requisicao;
    },
    [aplicarIndice]
  );

  const recarregarDados = useCallback(async (): Promise<RequisicaoDto | null> => {
    try {
      const dados = await carregarMovimentoPendencia(item);
      return aplicarDados(dados);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao recarregar movimento.";
      setErro(msg);
      toast.error(msg);
      return null;
    }
  }, [aplicarDados, item]);

  const carregar = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setErro(null);
    setPdfBase64(null);
    setPdfPrincipal(null);
    setRequisicao(null);
    setItens([]);
    setIndiceAtivo(0);

    restaurarGestorRef.current?.();
    restaurarGestorRef.current = aplicarGestorUnidadePendencia(item);

    try {
      await recarregarDados();
    } catch (e) {
      if (reqId !== reqRef.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao carregar movimento.";
      setErro(msg);
      toast.error(msg);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [item, recarregarDados]);

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

  function navegarItem(delta: number) {
    const proximo = indiceAtivo + delta;
    if (proximo < 0 || proximo >= itens.length) return;
    aplicarIndice(proximo, anexosRef.current, pdfPrincipalRef.current);
  }

  async function finalizarDecisao(mensagem: string, aviso?: string) {
    invalidatePendenciasGestorCache();
    toast.success(mensagem);
    if (aviso) toast.warning(aviso, { duration: 12_000 });
    onConcluido?.();
    handleFechar();
  }

  async function confirmarAssinatura({ page, posX, posY, largura, altura }: PdfSignData) {
    if (!requisicao || !pdfBase64 || indiceAtivo !== 0) return;

    setProcessando(true);
    const toastId = toast.loading("Assinando movimento…");
    try {
      await assinar({
        idmov: requisicao.requisicao.idmov,
        atendimento: requisicao.requisicao.codigo_atendimento,
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
      await recarregarDados();
      toast.message("Movimento assinado. Escolha Aprovar ou Recusar abaixo.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleAprovar() {
    if (!requisicao) return;
    setProcessando(true);
    const toastId = toast.loading("Registrando aprovação…");
    try {
      const resultado = await aprovar(
        requisicao.requisicao.idmov,
        requisicao.requisicao.codigo_atendimento
      );
      toast.dismiss(toastId);
      await finalizarDecisao(
        resultado.message || "Movimento aprovado.",
        resultado.avisoNotificacao ?? undefined
      );
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar movimento.");
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarRecusa() {
    if (!requisicao) return;
    setProcessando(true);
    const toastId = toast.loading("Registrando recusa…");
    try {
      await recusarMovimentoPendencia(requisicao, avaliacaoRecusa);
      toast.dismiss(toastId);
      setDialogRecusa(false);
      setAvaliacaoRecusa("");
      await finalizarDecisao("Movimento recusado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao recusar movimento.");
    } finally {
      setProcessando(false);
    }
  }

  const itemAtivo = itens[indiceAtivo];
  const podeAssinar = Boolean(requisicao && indiceAtivo === 0 && podeAssinarMovimento(requisicao));
  const podeDecidir = Boolean(requisicao && podeAprovarMovimento(requisicao));
  const tituloPdf = itemAtivo?.nome ?? `Movimentação nº ${requisicao?.requisicao.idmov ?? item.id}`;

  return (
    <>
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
              {podeAssinar ? " · 1. Visualizar e assinar" : podeDecidir ? " · 2. Aprovar ou recusar" : ""}
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
            Carregando movimento e anexos…
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
            <PendenciaAnexosLista
              titulo="Anexos do movimento"
              itens={itens}
              indiceAtivo={indiceAtivo}
              onSelecionar={(i) => aplicarIndice(i, anexosRef.current, pdfPrincipalRef.current)}
              disabled={processando}
            />
            <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
              <PdfViewerDialog
                key={`movimento-${indiceAtivo}-${pdfViewerKey}`}
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
                      ? "Visualização do anexo — volte ao documento principal para assinar"
                      : undefined
                }
                panelClassName="min-h-[min(48vh,480px)]"
                extraControls={
                  itens.length > 1
                    ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={indiceAtivo === 0 || carregandoPdf}
                          onClick={() => navegarItem(-1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={indiceAtivo === itens.length - 1 || carregandoPdf}
                          onClick={() => navegarItem(1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                    : undefined
                }
              />
            </div>
          </div>
        )}

        {!loading && !erro && podeDecidir && (
          <PendenciaAcoesFooter
            mensagem="Movimento assinado. Escolha Aprovar ou Recusar para concluir."
            processando={processando}
            podeAprovar
            podeReprovar
            labelAprovar="Aprovar movimento"
            onAprovar={() => void handleAprovar()}
            onReprovar={() => setDialogRecusa(true)}
          />
        )}
      </div>

      <AlertDialog open={dialogRecusa} onOpenChange={setDialogRecusa}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar movimento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da recusa. A avaliação será registrada antes de reprovar o movimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={avaliacaoRecusa}
            onChange={(e) => setAvaliacaoRecusa(e.target.value)}
            placeholder="Motivo da recusa…"
            rows={4}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarRecusa();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Recusar movimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
