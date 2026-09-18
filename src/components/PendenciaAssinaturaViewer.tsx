"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PendenciaAnexosLista, type PendenciaAnexoListaItem } from "@/components/PendenciaAnexosLista";
import { PendenciaAcoesFooter } from "@/components/PendenciaAcoesFooter";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import type { Documento, DocumentoAnexo } from "@/types/Documento";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import {
  CertificadoA1Status,
  getCertificadoStatus,
} from "@/services/docusignService";
import { base64ParaImpressao } from "@/utils/documentoAnexo";
import { imprimirPdfBase64 } from "@/utils/functions";
import { invalidatePendenciasGestorCache } from "@/services/pendenciasService";
import {
  apiAssinaturaPorTipo,
  aplicarGestorUnidadePendencia,
  carregarAnexoPdf,
  carregarDocumentoPendencia,
  concluirPendenciaAposAssinatura,
  podeAprovarDocumentoPendencia,
  podeAssinarDocumentoPendencia,
  recusarPendenciaAssinatura,
  usuarioJaAssinouDocumento,
} from "@/utils/pendenciaAssinatura";
import { labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onSigned?: () => void;
};

function indiceAnexoPrincipal(anexos: DocumentoAnexo[], principal: DocumentoAnexo): number {
  const idx = anexos.findIndex((a) => a.id === principal.id);
  return idx >= 0 ? idx : 0;
}

function labelAnexo(anexo: DocumentoAnexo): string {
  const nome = anexo.nome?.trim() || "Anexo";
  if (anexo.documento_principal) return `${nome} (principal)`;
  if (nome.toLowerCase().includes("comprovante")) return nome;
  return nome;
}

export function PendenciaAssinaturaViewer({ item, onClose, onSigned }: Props) {
  const [loading, setLoading] = useState(true);
  const [carregandoPdf, setCarregandoPdf] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [anexos, setAnexos] = useState<DocumentoAnexo[]>([]);
  const [indiceAnexo, setIndiceAnexo] = useState(0);
  const [anexo, setAnexo] = useState<DocumentoAnexo | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [certStatus, setCertStatus] = useState<CertificadoA1Status | null>(null);
  const restaurarGestorRef = useRef<(() => void) | null>(null);
  const reqRef = useRef(0);
  const anexosRef = useRef<DocumentoAnexo[]>([]);
  const pdfCacheRef = useRef<Map<number, string>>(new Map());
  const [pdfViewerKey, setPdfViewerKey] = useState(0);

  const carregarPdfAnexo = useCallback(
    async (anexoDoc: DocumentoAnexo, api: NonNullable<ReturnType<typeof apiAssinaturaPorTipo>>) => {
      const id = anexoDoc.id;
      if (id != null && pdfCacheRef.current.has(id)) {
        return pdfCacheRef.current.get(id)!;
      }
      const pdf = await carregarAnexoPdf(anexoDoc, api);
      if (id != null) pdfCacheRef.current.set(id, pdf);
      return pdf;
    },
    []
  );

  const aplicarAnexoAtivo = useCallback(
    async (lista: DocumentoAnexo[], indice: number, limparCache = false) => {
      const api = apiAssinaturaPorTipo(item.tipo);
      if (!api || indice < 0 || indice >= lista.length) return;

      const anexoDoc = lista[indice];
      const mesmoIndice = indice === indiceAnexo;

      if (limparCache) pdfCacheRef.current.clear();
      if (mesmoIndice && anexoDoc.id != null) {
        pdfCacheRef.current.delete(anexoDoc.id);
      }

      setIndiceAnexo(indice);
      setAnexo(anexoDoc);
      setCarregandoPdf(true);
      try {
        const pdf = await carregarPdfAnexo(anexoDoc, api);
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
    [carregarPdfAnexo, indiceAnexo, item.tipo]
  );

  const carregar = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    setErro(null);
    setPdfBase64(null);
    setAnexo(null);
    setAnexos([]);
    setDocumento(null);
    pdfCacheRef.current.clear();

    restaurarGestorRef.current?.();
    restaurarGestorRef.current = aplicarGestorUnidadePendencia(item);

    try {
      const api = apiAssinaturaPorTipo(item.tipo);
      if (!api) throw new Error("Tipo de pendência não suportado para assinatura.");

      const { documento: doc, anexos: lista, anexo: principal } = await carregarDocumentoPendencia(item);
      if (reqId !== reqRef.current) return;

      if (item.tipo.trim().toLowerCase() === "plugsign") {
        try {
          const status = await getCertificadoStatus();
          if (reqId === reqRef.current) setCertStatus(status);
        } catch {
          /* certificado opcional até assinar */
        }
      }

      setDocumento(doc);
      setAnexos(lista);
      anexosRef.current = lista;
      await aplicarAnexoAtivo(lista, indiceAnexoPrincipal(lista, principal));

      if (
        usuarioJaAssinouDocumento(doc) &&
        podeAprovarDocumentoPendencia(doc)
      ) {
        const toastId = toast.loading("Registrando aprovação pendente…");
        try {
          await concluirPendenciaAposAssinatura(doc, item.tipo);
          toast.dismiss(toastId);
          await finalizarDecisao("Documento aprovado e concluído na sua caixa.");
          return;
        } catch (e) {
          toast.dismiss(toastId);
          toast.message(
            e instanceof Error
              ? e.message
              : "Não foi possível aprovar automaticamente. Use o botão Aprovar abaixo."
          );
        }
      }
    } catch (e) {
      if (reqId !== reqRef.current) return;
      const msg = e instanceof Error ? e.message : "Erro ao carregar documento.";
      setErro(msg);
      toast.error(msg);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [aplicarAnexoAtivo, item]);

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
    imprimirPdfBase64(base64ParaImpressao(pdfBase64));
  }

  async function recarregarDocumentoAposAssinatura(): Promise<Documento | null> {
    const { documento: doc, anexos: lista, anexo: principal } = await carregarDocumentoPendencia(item);
    setDocumento(doc);
    setAnexos(lista);
    anexosRef.current = lista;
    const indice = indiceAnexoPrincipal(lista, principal);
    await aplicarAnexoAtivo(lista, indice, true);
    return doc;
  }

  async function finalizarDecisao(mensagem: string) {
    invalidatePendenciasGestorCache();
    toast.success(mensagem);
    onSigned?.();
    handleFechar();
  }

  async function confirmarAssinatura({ page, posX, posY, largura, altura }: PdfSignData) {
    const api = apiAssinaturaPorTipo(item.tipo);
    if (!api || !anexo?.id || !pdfBase64) return;

    if (item.tipo.trim().toLowerCase() === "plugsign") {
      const status = certStatus ?? (await getCertificadoStatus().catch(() => null));
      if (
        status?.plugsignAtivo &&
        !status.temCertificadoA1 &&
        !status.certificadoPersistido
      ) {
        const detalhe =
          status.motivoCertificado ||
          (status.vinculadoPlugSign
            ? "Conta PlugSign encontrada, mas sem certificado A1 ativo. Cadastre o .pfx em DocuSign."
            : "Cadastre seu certificado A1 (.pfx) em DocuSign antes de assinar.");
        toast.error(detalhe);
        return;
      }
    }

    if (!api.base64PdfEhValido(pdfBase64)) {
      toast.error("PDF inválido. Recarregue o documento e tente novamente.");
      return;
    }

    setProcessando(true);
    const toastId = toast.loading("Assinando documento…");
    try {
      const msg = await api.assinar({
        id: anexo.id,
        anexo: pdfBase64,
        pagina: page,
        posX,
        posY,
        largura,
        altura,
        dataHoraAssinatura: new Date().toLocaleString("pt-BR"),
      });
      toast.dismiss(toastId);
      if (msg.includes("não foi gerado") || msg.includes("PaperSign em anexo (PlugSign")) {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }

      await recarregarDocumentoAposAssinatura();
      toast.message("Documento assinado. Escolha Aprovar ou Recusar abaixo.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleAprovar() {
    if (!documento) return;
    setProcessando(true);
    const toastId = toast.loading("Registrando aprovação…");
    try {
      await concluirPendenciaAposAssinatura(documento, item.tipo);
      toast.dismiss(toastId);
      await finalizarDecisao("Documento aprovado e concluído na sua caixa.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar documento.");
    } finally {
      setProcessando(false);
    }
  }

  async function handleRecusar() {
    if (!documento) return;
    if (!window.confirm("Deseja recusar este documento?")) return;

    setProcessando(true);
    const toastId = toast.loading("Registrando recusa…");
    try {
      await recusarPendenciaAssinatura(documento, item.tipo);
      toast.dismiss(toastId);
      await finalizarDecisao("Documento recusado.");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(e instanceof Error ? e.message : "Erro ao recusar documento.");
    } finally {
      setProcessando(false);
    }
  }

  function navegarAnexo(delta: number) {
    const proximo = indiceAnexo + delta;
    if (proximo < 0 || proximo >= anexos.length) return;
    void aplicarAnexoAtivo(anexos, proximo);
  }

  const itensLista: PendenciaAnexoListaItem[] = anexos.map((a) => ({
    id: a.id,
    nome: labelAnexo(a),
    documento_assinado: a.documento_assinado,
    documento_principal: a.documento_principal,
  }));

  const podeAssinar = Boolean(documento && anexo && podeAssinarDocumentoPendencia(documento, anexo));
  const podeDecidir = Boolean(documento && podeAprovarDocumentoPendencia(documento));
  const tituloAnexo =
    anexo && anexos.length > 0
      ? `${labelAnexo(anexo)} (${indiceAnexo + 1}/${anexos.length})`
      : anexo?.nome ?? "Documento";

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
            {anexos.length > 1 ? ` · ${anexos.length} anexos` : ""}
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
          Carregando documento e anexos…
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

      {!loading && !erro && pdfBase64 && anexo && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <PendenciaAnexosLista
            itens={itensLista}
            indiceAtivo={indiceAnexo}
            onSelecionar={(i) => void aplicarAnexoAtivo(anexosRef.current, i)}
            disabled={processando}
          />
          <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
            <PdfViewerDialog
              key={`assinatura-${anexo?.id ?? indiceAnexo}-${pdfViewerKey}`}
              embedded
              open
              onOpenChange={() => {}}
              title={tituloAnexo}
              pdfBase64={pdfBase64}
              canSign={podeAssinar}
              onSign={confirmarAssinatura}
              onPrint={handleImprimir}
              isLoading={processando || carregandoPdf}
              confirmLabel="Assinar"
              placeHint={
                podeAssinar
                  ? "Clique no PDF para posicionar a assinatura"
                  : anexos.length > 1
                    ? "Selecione outro anexo na lista ao lado"
                    : undefined
              }
              panelClassName="min-h-[min(48vh,480px)]"
              extraControls={
                anexos.length > 1
                  ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={indiceAnexo === 0 || carregandoPdf}
                        onClick={() => navegarAnexo(-1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={indiceAnexo === anexos.length - 1 || carregandoPdf}
                        onClick={() => navegarAnexo(1)}
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
          mensagem="Documento assinado. Escolha Aprovar ou Recusar para concluir."
          processando={processando}
          podeAprovar
          podeReprovar
          labelAprovar="Aprovar documento"
          onAprovar={() => void handleAprovar()}
          onReprovar={() => void handleRecusar()}
        />
      )}
    </div>
  );
}
