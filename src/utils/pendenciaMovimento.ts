import type { PendenciaGestorItem } from "@/types/Pendencias";
import type { RequisicaoDto } from "@/types/Requisicao";
import type { Anexo } from "@/types/Anexo";
import { getAll as getAllAnexosMovimento } from "@/services/anexoService";
import {
  createAvaliacao,
  getAll as getAllRequisicoes,
  getAnexoByIdmov,
  reprovar,
} from "@/services/requisicoesService";
import type { PendenciaAnexoListaItem } from "@/types/PendenciaAnexo";
import { normalizeUserCode } from "@/utils/functions";

export function normalizarPdfMovimento(valor: string): string {
  let pdf = valor.trim();
  if (pdf.startsWith("data:")) pdf = pdf.split(",")[1] ?? pdf;
  return pdf;
}

export function montarItensMovimentoPendencia(
  requisicao: RequisicaoDto,
  anexos: Anexo[]
): PendenciaAnexoListaItem[] {
  const idmov = requisicao.requisicao.idmov;
  const itens: PendenciaAnexoListaItem[] = [
    {
      id: "principal",
      nome: `Movimentação nº ${idmov}`,
      tipo: "Documento principal",
      documento_assinado: requisicao.requisicao.documento_assinado,
      documento_principal: true,
    },
  ];

  for (const anexo of anexos) {
    itens.push({
      id: anexo.id,
      nome: anexo.nome?.trim() || `Anexo ${anexo.id}`,
      documento_assinado: anexo.documento_assinado,
    });
  }

  return itens;
}
function intervaloBuscaMovimento(): { dateFrom: string; dateTo: string } {
  const hoje = new Date();
  const dateTo = hoje.toISOString().slice(0, 10);
  const dateFrom = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

export function pendenciaEhMovimento(tipo: string): boolean {
  const t = tipo.trim().toLowerCase();
  return t === "movimento" || t === "restrito";
}

export async function carregarMovimentoPendencia(
  item: PendenciaGestorItem
): Promise<{
  requisicao: RequisicaoDto;
  pdfBase64: string;
  anexos: Anexo[];
  itens: PendenciaAnexoListaItem[];
}> {
  const id = item.id;
  if (id == null || id <= 0) throw new Error("Movimento inválido.");

  const { dateFrom, dateTo } = intervaloBuscaMovimento();
    const restrito = item.tipo.trim().toLowerCase() === "restrito" ? "RESTRITO" : "";
    const lista = await getAllRequisicoes(
      dateFrom,
      dateTo,
      [],
      "Em Andamento",
      restrito,
      "",
      false,
      false,
      undefined,
      String(id)
    );

    const requisicao =
      lista.find((r) => r.requisicao.idmov === id) ??
      (item.codigoAtendimento
        ? lista.find((r) => r.requisicao.codigo_atendimento === item.codigoAtendimento)
        : undefined);

    if (!requisicao) {
      throw new Error("Movimento não encontrado nesta unidade.");
    }

    const atendimento =
      item.codigoAtendimento ?? requisicao.requisicao.codigo_atendimento;
    const anexo = await getAnexoByIdmov(id, atendimento);
    const pdf = normalizarPdfMovimento(anexo.arquivo ?? "");
    if (!pdf) throw new Error("Movimento sem PDF para visualizar.");

    const anexos = await getAllAnexosMovimento(id);
    const itens = montarItensMovimentoPendencia(requisicao, anexos);

  return { requisicao, pdfBase64: pdf, anexos, itens };
}

export function pdfAnexoMovimentoPorIndice(
  indice: number,
  pdfPrincipal: string,
  anexos: Anexo[]
): string {
  if (indice <= 0) return pdfPrincipal;
  const anexo = anexos[indice - 1];
  if (!anexo?.anexo) throw new Error("Anexo sem PDF para visualizar.");
  return normalizarPdfMovimento(anexo.anexo);
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

export function podeAssinarMovimento(requisicao: RequisicaoDto): boolean {
  const login = normalizeUserCode(getUserCodusuario());
  if (!login) return false;

  const aprovacoes = requisicao.requisicao_aprovacoes ?? [];
  const usuarioAprovador = aprovacoes.some(
    (ap) => normalizeUserCode(ap.usuario) === login
  );
  const nivelUsuario =
    aprovacoes.find((ap) => normalizeUserCode(ap.usuario) === login)?.nivel ?? 1;
  const todasInferioresAprovadas =
    nivelUsuario === 1 ||
    aprovacoes
      .filter((ap) => ap.nivel < nivelUsuario)
      .every((ap) => ap.situacao === "A");
  const statusLiberado = requisicao.requisicao.status_movimento === "Em Andamento";

  return (
    todasInferioresAprovadas &&
    usuarioAprovador &&
    statusLiberado &&
    requisicao.requisicao.documento_assinado !== 1
  );
}

function contextoAprovadorMovimento(requisicao: RequisicaoDto) {
  const login = normalizeUserCode(getUserCodusuario());
  const aprovacoes = requisicao.requisicao_aprovacoes ?? [];
  const usuarioAprovador = aprovacoes.some(
    (ap) => normalizeUserCode(ap.usuario) === login
  );
  const nivelUsuario =
    aprovacoes.find((ap) => normalizeUserCode(ap.usuario) === login)?.nivel ?? 1;
  const todasInferioresAprovadas =
    nivelUsuario === 1 ||
    aprovacoes
      .filter((ap) => ap.nivel < nivelUsuario)
      .every((ap) => ap.situacao === "A");
  const usuarioAprovou = aprovacoes.some(
    (ap) => normalizeUserCode(ap.usuario) === login && ap.situacao === "A"
  );
  const usuarioReprovou = aprovacoes.some(
    (ap) => normalizeUserCode(ap.usuario) === login && ap.situacao === "R"
  );
  const statusLiberado = requisicao.requisicao.status_movimento === "Em Andamento";

  return {
    login,
    usuarioAprovador,
    todasInferioresAprovadas,
    usuarioAprovou,
    usuarioReprovou,
    statusLiberado,
  };
}

export function podeAprovarMovimento(requisicao: RequisicaoDto): boolean {
  const ctx = contextoAprovadorMovimento(requisicao);
  if (!ctx.login) return false;

  return (
    ctx.todasInferioresAprovadas &&
    ctx.usuarioAprovador &&
    ctx.statusLiberado &&
    !ctx.usuarioAprovou &&
    requisicao.requisicao.documento_assinado === 1
  );
}

export function podeReprovarMovimento(requisicao: RequisicaoDto): boolean {
  const ctx = contextoAprovadorMovimento(requisicao);
  if (!ctx.login) return false;

  return (
    ctx.todasInferioresAprovadas &&
    ctx.usuarioAprovador &&
    ctx.statusLiberado &&
    !ctx.usuarioReprovou
  );
}

export async function recusarMovimentoPendencia(
  requisicao: RequisicaoDto,
  avaliacao: string
): Promise<void> {
  const idmov = requisicao.requisicao.idmov;
  const codigoAtendimento = Number(requisicao.requisicao.codigo_atendimento);
  await createAvaliacao({
    avaliacao: avaliacao.trim() || "Recusado pelo gestor.",
    idmov,
    codigo_atendimento: codigoAtendimento,
  });
  await reprovar(idmov, codigoAtendimento);
}
