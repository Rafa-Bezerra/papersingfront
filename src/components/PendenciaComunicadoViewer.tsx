"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { PendenciaAcoesFooter } from "@/components/PendenciaAcoesFooter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import type { Comunicado } from "@/types/Comunicado";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import { invalidatePendenciasGestorCache } from "@/services/pendenciasService";
import { aplicarGestorUnidadePendencia } from "@/utils/pendenciaAssinatura";
import {
  aprovarComunicadoPendencia,
  assinarComunicadoPendencia,
  carregarComunicadoPendencia,
  podeAprovarComunicado,
  podeAssinarComunicado,
  recusarComunicadoPendencia,
} from "@/utils/pendenciaComunicado";
import { labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { imprimirPdfBase64 } from "@/utils/functions";
import { cn } from "@/lib/utils";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onConcluido?: () => void;
};

export function PendenciaComunicadoViewer({ item, onClose, onConcluido }: Props) {
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comunicado, setComunicado] = useState<Comunicado | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const restaurarGestorRef = useRef<(() => void) | null>(null);
  const reqRef = useRef(0);

  const carregar = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setErro(null);
    setPdfBase64(null);
    setComunicado(null);

    restaurarGestorRef.current?.();
    restaurarGestorRef.current = aplicarGestorUnidadePendencia(item);

    try {
      const dados = await carregarComunicadoPendencia(item);
      if (reqId !== reqRef.current) return;
      setComunicado(dados.comunicado);
      setPdfBase64(dados.pdfBase64);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao carregar CI.";
      setErro(msg);
      toast.error(msg);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [item]);

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
    if (!comunicado || !pdfBase64) return;

    setProcessando(true);
    const toastId = toast.loading("Assinando CI…");
    try {
      await assinarComunicadoPendencia(comunicado, pdfBase64, signData);
      toast.dismiss(toastId);
      toast.success("CI assinado com sucesso.");

      const dados = await carregarComunicadoPendencia(item);
      setComunicado(dados.comunicado);
      setPdfBase64(dados.pdfBase64);

      toast.message("CI assinado. Escolha Aprovar ou Recusar abaixo.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleAprovar() {
    if (!comunicado) return;
    setProcessando(true);
    const toastId = toast.loading("Registrando aprovação…");
    try {
      await aprovarComunicadoPendencia(comunicado.id);
      toast.dismiss(toastId);
      await finalizarDecisao("CI aprovado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar CI.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleRecusar() {
    if (!comunicado) return;
    if (!window.confirm("Deseja recusar este CI?")) return;

    setProcessando(true);
    const toastId = toast.loading("Registrando recusa…");
    try {
      await recusarComunicadoPendencia(comunicado.id);
      toast.dismiss(toastId);
      await finalizarDecisao("CI recusado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao recusar CI.");
    } finally {
      setProcessando(false);
    }
  }

  const podeAssinar = comunicado ? podeAssinarComunicado(comunicado) : false;
  const podeDecidir = comunicado ? podeAprovarComunicado(comunicado) : false;

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
          Carregando CI…
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

      {!loading && !erro && comunicado && pdfBase64 && (
        <PdfViewerDialog
          embedded
          open
          onOpenChange={() => {}}
          title={`CI nº ${comunicado.id}`}
          pdfBase64={pdfBase64}
          canSign={podeAssinar}
          onSign={confirmarAssinatura}
          onPrint={handleImprimir}
          isLoading={processando}
          confirmLabel="Assinar"
          placeHint="Clique no PDF para posicionar a assinatura"
          panelClassName="min-h-[min(52vh,520px)]"
        />
      )}

      {!loading && !erro && comunicado && !pdfBase64 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Este CI não possui documento PDF para assinar. Você pode aprovar diretamente abaixo.
          </p>
        </div>
      )}

      {!loading && !erro && podeDecidir && (
        <PendenciaAcoesFooter
          mensagem={
            pdfBase64
              ? "CI assinado. Escolha Aprovar ou Recusar para concluir."
              : "Escolha Aprovar ou Recusar para concluir."
          }
          processando={processando}
          podeAprovar
          podeReprovar
          labelAprovar="Aprovar CI"
          onAprovar={() => void handleAprovar()}
          onReprovar={() => void handleRecusar()}
        />
      )}
    </div>
  );
}
