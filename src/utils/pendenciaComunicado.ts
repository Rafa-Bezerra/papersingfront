import type { Comunicado, ComunicadoAssinar } from "@/types/Comunicado";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import { aprovar, getAll, getDocumento, updateElement } from "@/services/comunicadoService";
import { normalizeUserCode } from "@/utils/functions";

function limparPdfBase64(raw: string): string {
  let s = (raw ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      s = JSON.parse(s) as string;
    } catch {
      s = s.slice(1, -1);
    }
  }
  return s.replace(/^data:.*;base64,/, "").trim();
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

export function pendenciaEhComunicado(tipo: string): boolean {
  return tipo.trim().toLowerCase() === "comunicado";
}

export async function buscarComunicadoPendencia(
  item: PendenciaGestorItem
): Promise<Comunicado> {
  const id = item.id;
  if (id == null || id <= 0) throw new Error("CI inválido.");

  const lista = await getAll();
  const comunicado = lista.find((c) => c.id === id);
  if (!comunicado) {
    throw new Error("CI não encontrado nesta unidade.");
  }
  return comunicado;
}

export async function carregarComunicadoPendencia(item: PendenciaGestorItem): Promise<{
  comunicado: Comunicado;
  pdfBase64: string | null;
}> {
  const comunicado = await buscarComunicadoPendencia(item);

  if (comunicado.anexo !== "SIM") {
    return { comunicado, pdfBase64: null };
  }

  const arquivo = await getDocumento(comunicado.id);
  const pdfBase64 = limparPdfBase64(arquivo);
  if (!pdfBase64) {
    throw new Error("CI sem PDF para visualizar.");
  }

  return { comunicado, pdfBase64 };
}

export function podeAssinarComunicado(comunicado: Comunicado): boolean {
  const bloqueado = comunicado.situacao.trim().toUpperCase() === "REPROVADO";
  return !bloqueado && comunicado.anexo === "SIM" && comunicado.documento_assinado === 0;
}

export function podeAprovarComunicado(
  comunicado: Comunicado,
  userCodusuario?: string
): boolean {
  const login = normalizeUserCode(userCodusuario ?? getUserCodusuario());
  if (!login) return false;

  const usuarioAprovador = comunicado.aprovadores.some(
    (ap) => normalizeUserCode(ap.usuario) === login
  );
  const usuarioAprovou = comunicado.aprovadores.some(
    (ap) =>
      normalizeUserCode(ap.usuario) === login &&
      (ap.aprovacao === "A" || ap.aprovacao === "R")
  );
  const statusBloqueado = comunicado.situacao.trim().toUpperCase() === "REPROVADO";
  const assinouOuSemAnexo =
    comunicado.anexo !== "SIM" || comunicado.documento_assinado === 1;

  return usuarioAprovador && !usuarioAprovou && !statusBloqueado && assinouOuSemAnexo;
}

export async function assinarComunicadoPendencia(
  comunicado: Comunicado,
  pdfBase64: string,
  sign: {
    page: number;
    posX: number;
    posY: number;
    largura: number;
    altura: number;
  }
): Promise<void> {
  const dados: ComunicadoAssinar = {
    id: comunicado.id,
    anexo: pdfBase64,
    pagina: sign.page,
    posX: sign.posX,
    posY: sign.posY,
    largura: sign.largura,
    altura: sign.altura,
    dataHoraAssinatura: new Date().toLocaleString("pt-BR"),
  };
  await updateElement(dados);
}

export async function aprovarComunicadoPendencia(id: number): Promise<void> {
  await aprovar(id, 1);
}

export function podeReprovarComunicado(
  comunicado: Comunicado,
  userCodusuario?: string
): boolean {
  const login = normalizeUserCode(userCodusuario ?? getUserCodusuario());
  if (!login) return false;

  const usuarioAprovador = comunicado.aprovadores.some(
    (ap) => normalizeUserCode(ap.usuario) === login
  );
  const usuarioDecidiu = comunicado.aprovadores.some(
    (ap) =>
      normalizeUserCode(ap.usuario) === login &&
      (ap.aprovacao === "A" || ap.aprovacao === "R")
  );
  const statusBloqueado = comunicado.situacao.trim().toUpperCase() === "REPROVADO";

  return usuarioAprovador && !usuarioDecidiu && !statusBloqueado;
}

export async function recusarComunicadoPendencia(id: number): Promise<void> {
  await aprovar(id, 0);
}
