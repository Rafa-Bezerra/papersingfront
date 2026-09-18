import type { PendenciaGestorItem } from "@/types/Pendencias";
import type { Pagamento } from "@/types/Pagamentos";
import {
  aprovarPagamento,
  assinarDocumento,
  gerarDocumento,
  getDocumento,
  getLancamento,
} from "@/services/pagamentosService";
import { buildPagamentoAutorizacaoHtml } from "@/utils/pagamentoAutorizacaoHtml";
import { htmlToPdfBase64 } from "@/utils/functions";

export type PendenciaPagamentoGrupo = "RH" | "IMPOSTOS";

export function pendenciaEhPagamento(tipo: string): boolean {
  const t = tipo.trim().toLowerCase();
  return t === "pagamento_rh" || t === "pagamento_imposto";
}

export function grupoPagamentoPorTipo(tipo: string): PendenciaPagamentoGrupo {
  return tipo.trim().toLowerCase() === "pagamento_imposto" ? "IMPOSTOS" : "RH";
}

export async function buscarPagamentoPendencia(
  item: PendenciaGestorItem,
  grupo: PendenciaPagamentoGrupo
): Promise<Pagamento> {
  const id = item.id;
  if (id == null || id <= 0) throw new Error("Pagamento inválido.");

  const pagamento = await getLancamento(id, grupo);
  if (!pagamento) {
    throw new Error("Pagamento não encontrado nesta unidade.");
  }
  return pagamento;
}

export async function gerarDocumentoPagamento(
  pagamento: Pagamento,
  grupo: PendenciaPagamentoGrupo
): Promise<void> {
  const html = buildPagamentoAutorizacaoHtml(pagamento);
  const base64pdf = await htmlToPdfBase64(html);
  await gerarDocumento({
    idlan: pagamento.idlan,
    arquivo: base64pdf,
    grupo,
  });
}

export async function carregarPagamentoPendencia(item: PendenciaGestorItem): Promise<{
  pagamento: Pagamento;
  pdfBase64: string;
  arquivoAssinatura: string;
  grupo: PendenciaPagamentoGrupo;
}> {
  const grupo = grupoPagamentoPorTipo(item.tipo);
  let pagamento = await buscarPagamentoPendencia(item, grupo);

  if (!pagamento.possui_documento) {
    await gerarDocumentoPagamento(pagamento, grupo);
    pagamento = await buscarPagamentoPendencia(item, grupo);
    if (!pagamento.possui_documento) {
      throw new Error("Não foi possível gerar o documento deste pagamento.");
    }
  }

  const arquivo = await getDocumento({ idlan: pagamento.idlan, grupo });
  const pdfBase64 = arquivo.replace(/^data:.*;base64,/, "").trim();
  if (!pdfBase64) throw new Error("Pagamento sem PDF para visualizar.");

  return { pagamento, pdfBase64, arquivoAssinatura: arquivo, grupo };
}

export function podeAssinarPagamento(pagamento: Pagamento): boolean {
  const aberto =
    pagamento.status_lancamento.trim().toUpperCase() === "EM ABERTO";
  return aberto && pagamento.possui_documento && !pagamento.documento_assinado;
}

export function podeAprovarPagamento(pagamento: Pagamento): boolean {
  const aberto =
    pagamento.status_lancamento.trim().toUpperCase() === "EM ABERTO";
  return (
    aberto &&
    pagamento.pode_aprovar &&
    pagamento.documento_assinado
  );
}

export async function assinarPagamentoPendencia(
  pagamento: Pagamento,
  grupo: PendenciaPagamentoGrupo,
  arquivoAssinatura: string,
  sign: {
    page: number;
    posX: number;
    posY: number;
    largura: number;
    altura: number;
  }
): Promise<void> {
  await assinarDocumento({
    idlan: pagamento.idlan,
    caminho: pagamento.caminho_anexo,
    grupo,
    arquivo: arquivoAssinatura,
    pagina: sign.page,
    posX: sign.posX,
    posY: sign.posY,
    largura: sign.largura,
    altura: sign.altura,
    dataHoraAssinatura: new Date().toLocaleString("pt-BR"),
  });
}

export async function aprovarPagamentoPendencia(
  pagamento: Pagamento,
  grupo: PendenciaPagamentoGrupo
): Promise<void> {
  await aprovarPagamento({
    id: pagamento.idlan,
    aprovacao: "A",
    aprovar: true,
    grupo,
  });
}

export function podeReprovarPagamento(pagamento: Pagamento): boolean {
  const aberto = pagamento.status_lancamento.trim().toUpperCase() === "EM ABERTO";
  return aberto && pagamento.pode_reprovar;
}

export async function recusarPagamentoPendencia(
  pagamento: Pagamento,
  grupo: PendenciaPagamentoGrupo
): Promise<void> {
  if (!podeAprovarPagamento(pagamento) && !podeReprovarPagamento(pagamento)) {
    throw new Error("Não é possível recusar este pagamento no momento.");
  }
  await aprovarPagamento({
    id: pagamento.idlan,
    aprovacao: "R",
    aprovar: false,
    grupo,
  });
}
