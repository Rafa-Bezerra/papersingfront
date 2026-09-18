import type { Documento, DocumentoAnexo, DocumentoAnexoAssinar } from "@/types/Documento";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import * as docusignService from "@/services/docusignService";
import * as documentoService from "@/services/documentoService";
import * as projetosService from "@/services/projetosService";
import { resolverAnexoDocumento } from "@/utils/documentoAnexo";
import { normalizeUserCode } from "@/utils/functions";
import {
  clearGestorUnidadeContext,
  getGestorUnidadeContext,
  setGestorUnidadeContext,
} from "@/utils/pendenciaNavigation";

export type PendenciaAssinaturaTipo = "plugsign" | "documento" | "projeto";

type AssinaturaApi = {
  getAll: () => Promise<Documento[]>;
  getAnexo: (caminho: string, idAnexo?: number) => Promise<string>;
  assinar: (data: DocumentoAnexoAssinar) => Promise<string>;
  aprovar: (id: number, aprovado: number) => Promise<void>;
  normalizarPdfDataUrl: (valor: string) => string;
  base64PdfEhValido: (valor: string) => boolean;
};

const APIS: Record<PendenciaAssinaturaTipo, AssinaturaApi> = {
  plugsign: docusignService,
  documento: documentoService,
  projeto: projetosService,
};

export function pendenciaSuportaAssinaturaInline(tipo: string): boolean {
  const t = tipo.trim().toLowerCase();
  return t === "plugsign" || t === "documento" || t === "projeto";
}

export function apiAssinaturaPorTipo(tipo: string): AssinaturaApi | null {
  const t = tipo.trim().toLowerCase() as PendenciaAssinaturaTipo;
  return APIS[t] ?? null;
}

function getUnidadeAtual(): string {
  try {
    const raw = sessionStorage.getItem("userData");
    if (!raw) return "";
    const user = JSON.parse(raw);
    return String(user.unidade ?? "");
  } catch {
    return "";
  }
}

/** Define X-Gestor-Unidade para a pendência; retorna função que restaura o contexto anterior. */
export function aplicarGestorUnidadePendencia(item: PendenciaGestorItem): () => void {
  const anterior = getGestorUnidadeContext();
  const atual = getUnidadeAtual();

  if (item.unidade && item.unidade !== atual) {
    setGestorUnidadeContext(item.unidade);
  } else {
    clearGestorUnidadeContext();
  }

  return () => {
    if (anterior) setGestorUnidadeContext(anterior);
    else clearGestorUnidadeContext();
  };
}

export async function carregarAnexoPdf(
  anexo: DocumentoAnexo,
  api: AssinaturaApi
): Promise<string> {
  const caminho = (anexo.anexo ?? "").trim();
  if (!caminho && !anexo.id) {
    throw new Error("Anexo sem arquivo vinculado.");
  }

  let arquivo: string;
  if (
    caminho.startsWith("data:") ||
    (caminho && !caminho.startsWith("/anexos/") && caminho.length > 500)
  ) {
    arquivo = api.normalizarPdfDataUrl(caminho);
  } else if (caminho.startsWith("/anexos/")) {
    arquivo = await api.getAnexo(caminho, anexo.id);
  } else if (caminho) {
    arquivo = api.normalizarPdfDataUrl(caminho);
  } else {
    throw new Error("Anexo sem caminho de arquivo para carregar.");
  }

  if (!api.base64PdfEhValido(arquivo)) {
    throw new Error(
      "O arquivo não é um PDF válido. Se já tentou assinar antes, exclua o anexo e envie o PDF de novo."
    );
  }
  return arquivo;
}

async function listarAnexosDocumentoPendencia(
  documento: Documento,
  item: PendenciaGestorItem
): Promise<DocumentoAnexo[]> {
  const tipo = item.tipo.trim().toLowerCase();
  const id = item.id;
  if (id == null || id <= 0) return [];

  if (tipo === "plugsign") {
    let anexos = await docusignService.getAnexosDocumento(id);
    if (anexos.length === 0) {
      const resgatado = await docusignService.resgatarDocumentoPlugSign(id);
      if (resgatado) anexos = [resgatado];
    }
    return anexos;
  }

  return documento.anexos ?? [];
}

export async function carregarDocumentoPendencia(
  item: PendenciaGestorItem
): Promise<{ documento: Documento; anexos: DocumentoAnexo[]; anexo: DocumentoAnexo }> {
  const api = apiAssinaturaPorTipo(item.tipo);
  const id = item.id;
  if (!api || id == null || id <= 0) {
    throw new Error("Pendência inválida para assinatura.");
  }

  const lista = await api.getAll();
  let documento = lista.find((d) => d.id === id);
  if (!documento) {
    throw new Error("Documento não encontrado nesta unidade.");
  }

  const anexos = await listarAnexosDocumentoPendencia(documento, item);
  documento = { ...documento, anexos };

  const anexo = resolverAnexoDocumento(anexos);
  if (!anexo) {
    throw new Error("Documento sem PDF anexado para visualizar.");
  }

  return { documento, anexos, anexo };
}

function getUserCodusuario(): string {
  try {
    const raw = sessionStorage.getItem("userData");
    if (!raw) return "";
    const user = JSON.parse(raw);
    return String(user.codusuario ?? user.Codusuario ?? "");
  } catch {
    return "";
  }
}

function contextoAprovadorDocumento(documento: Documento, userCodusuario?: string) {
  const login = normalizeUserCode(userCodusuario ?? getUserCodusuario());
  const usuarioAprovador = documento.aprovadores.some(
    (ap) => normalizeUserCode(ap.usuario) === login
  );
  const nivelUsuario =
    documento.aprovadores.find((ap) => normalizeUserCode(ap.usuario) === login)?.ordem ?? 1;
  const todasInferioresAprovadas =
    nivelUsuario === 1 ||
    documento.aprovadores
      .filter((ap) => ap.ordem < nivelUsuario)
      .every((ap) => (ap.aprovacao ?? "P").trim().toUpperCase() === "A");
  const usuarioDecidiu = documento.aprovadores.some(
    (ap) =>
      normalizeUserCode(ap.usuario) === login &&
      ["A", "R"].includes((ap.aprovacao ?? "P").trim().toUpperCase())
  );
  const statusLiberado = documento.situacao.trim().toUpperCase() === "EM ANDAMENTO";
  const assinouOuSemAnexos =
    (documento.anexos?.length ?? 0) === 0 ||
    documento.anexos?.some((a) => a.documento_assinado === 1);

  return {
    login,
    usuarioAprovador,
    todasInferioresAprovadas,
    usuarioDecidiu,
    statusLiberado,
    assinouOuSemAnexos,
  };
}

export function usuarioAprovadorPendente(documento: Documento, userCodusuario?: string): boolean {
  const ctx = contextoAprovadorDocumento(documento, userCodusuario);
  const reprovado = documento.situacao.trim().toUpperCase() === "REPROVADO";
  const jaAssinou = usuarioJaAssinouDocumento(documento);
  return ctx.usuarioAprovador && !ctx.usuarioDecidiu && !reprovado && !jaAssinou;
}

export function usuarioJaAssinouDocumento(documento: Documento): boolean {
  return documento.anexos?.some((a) => a.documento_assinado === 1) ?? false;
}

export function podeAssinarDocumentoPendencia(
  documento: Documento,
  anexo: DocumentoAnexo
): boolean {
  const ctx = contextoAprovadorDocumento(documento);
  return (
    ctx.usuarioAprovador &&
    ctx.todasInferioresAprovadas &&
    ctx.statusLiberado &&
    !ctx.usuarioDecidiu &&
    anexo.documento_assinado !== 1 &&
    !usuarioJaAssinouDocumento(documento)
  );
}

export function podeAprovarDocumentoPendencia(documento: Documento): boolean {
  const ctx = contextoAprovadorDocumento(documento);
  return (
    ctx.usuarioAprovador &&
    ctx.todasInferioresAprovadas &&
    !ctx.usuarioDecidiu &&
    ctx.statusLiberado &&
    ctx.assinouOuSemAnexos
  );
}

export function podeReprovarDocumentoPendencia(documento: Documento): boolean {
  return podeAprovarDocumentoPendencia(documento);
}

export async function registrarDecisaoPendenciaAssinatura(
  documento: Documento,
  tipo: string,
  aprovado: number
): Promise<void> {
  const api = apiAssinaturaPorTipo(tipo);
  if (!api) throw new Error("Tipo de pendência não suportado.");

  if (aprovado === 1 && !podeAprovarDocumentoPendencia(documento)) {
    throw new Error("Não é possível aprovar este documento no momento. Recarregue e tente novamente.");
  }
  if (aprovado === 0 && !podeAprovarDocumentoPendencia(documento)) {
    throw new Error("Não é possível recusar este documento no momento. Recarregue e tente novamente.");
  }

  await api.aprovar(documento.id, aprovado);
}

/** Após assinar (ou se já assinou), registra aprovação para sair da caixa de pendências. */
export async function concluirPendenciaAposAssinatura(
  documento: Documento,
  tipo: string
): Promise<void> {
  await registrarDecisaoPendenciaAssinatura(documento, tipo, 1);
}

export async function recusarPendenciaAssinatura(
  documento: Documento,
  tipo: string
): Promise<void> {
  await registrarDecisaoPendenciaAssinatura(documento, tipo, 0);
}
