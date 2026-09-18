import type { FiscalAssinar, FiscalDocumento, FiscalGetDocumento, FiscalResponseDto } from "@/types/Fiscal";
import type { PendenciaGestorItem } from "@/types/Pendencias";
import type { PendenciaAnexoListaItem } from "@/types/PendenciaAnexo";
import {
  aprovarFiscal,
  assinar,
  getAll,
  getAllAnexos,
  getDocumento,
} from "@/services/fiscalService";
import { stripDiacritics } from "@/utils/functions";

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

function loginNorm(userCodusuario?: string): string {
  return stripDiacritics((userCodusuario ?? getUserCodusuario()).toLowerCase().trim());
}

function aprovacaoUsuario(fiscal: FiscalResponseDto, login: string) {
  return fiscal.fiscal_aprovacoes.find(
    (ap) => stripDiacritics(ap.usuario.toLowerCase().trim()) === login
  );
}

function podeOperarFiscalBase(fiscal: FiscalResponseDto, login: string): boolean {
  const usuarioAprovador = fiscal.fiscal_aprovacoes.some(
    (ap) => stripDiacritics(ap.usuario.toLowerCase().trim()) === login
  );
  const nivelUsuario = aprovacaoUsuario(fiscal, login)?.nivel ?? 1;
  const todasInferioresAprovadas =
    nivelUsuario === 1 ||
    fiscal.fiscal_aprovacoes
      .filter((ap) => ap.nivel < nivelUsuario)
      .every((ap) => ap.situacao === "A");
  const statusLiberado = fiscal.fiscal.status === "Em Andamento";
  return usuarioAprovador && todasInferioresAprovadas && statusLiberado;
}

export function pendenciaEhFiscal(tipo: string): boolean {
  return tipo.trim().toLowerCase() === "fiscal";
}

function intervaloBuscaFiscalPendencia(): { dateFrom: string; dateTo: string } {
  const hoje = new Date();
  return {
    // Mesma regra da tela Fiscal: pendências não limitam por período.
    dateFrom: "1900-01-01",
    dateTo: hoje.toISOString().slice(0, 10),
  };
}

export async function buscarFiscalPendencia(
  item: PendenciaGestorItem
): Promise<FiscalResponseDto> {
  const idmov = item.id;
  if (idmov == null || idmov <= 0) throw new Error("Fiscal inválido.");

  const { dateFrom, dateTo } = intervaloBuscaFiscalPendencia();
  const lista = await getAll({
    dateFrom,
    dateTo,
    status: "Em Andamento",
    solicitante: "",
    tipo_movimento: "",
  });

  const fiscal = lista.find((r) => r.fiscal.idmov === idmov);
  if (!fiscal) {
    throw new Error("Fiscal não encontrado nesta unidade.");
  }
  return fiscal;
}

export async function carregarFiscalPendencia(item: PendenciaGestorItem): Promise<{
  fiscal: FiscalResponseDto;
  pdfPrincipal: string;
  arquivoAssinatura: string;
  anexos: FiscalDocumento[];
  itens: PendenciaAnexoListaItem[];
}> {
  const fiscal = await buscarFiscalPendencia(item);

  const docReq: FiscalGetDocumento = {
    idmov: fiscal.fiscal.idmov,
    tipo: "fiscal",
    atendimento: fiscal.movimento.codigo_atendimento,
    movimento_op: fiscal.movimento.idmov,
  };

  const arquivo = await getDocumento(docReq);
  const pdfPrincipal = limparPdfBase64(arquivo);
  if (!pdfPrincipal) {
    throw new Error("Fiscal sem PDF para visualizar.");
  }

  const anexos = await getAllAnexos(fiscal.fiscal.idmov);

  const itens: PendenciaAnexoListaItem[] = [
    {
      id: "fiscal",
      nome: "Documento fiscal",
      documento_principal: true,
      documento_assinado: fiscal.fiscal.documento_assinado,
    },
    ...anexos.map((a) => ({
      id: a.id,
      nome: a.nome?.trim() || `Anexo ${a.id}`,
      tipo: "anexo",
    })),
  ];

  return {
    fiscal,
    pdfPrincipal,
    arquivoAssinatura: arquivo,
    anexos,
    itens,
  };
}

export function pdfFiscalPorIndice(
  indice: number,
  pdfPrincipal: string,
  anexos: FiscalDocumento[]
): string {
  if (indice === 0) return pdfPrincipal;
  const anexo = anexos[indice - 1];
  if (!anexo?.anexo) throw new Error("Anexo sem arquivo.");
  const pdf = limparPdfBase64(anexo.anexo);
  if (!pdf) throw new Error("Anexo inválido.");
  return pdf;
}

export function podeAssinarFiscal(
  fiscal: FiscalResponseDto,
  indiceAtivo: number,
  userCodusuario?: string
): boolean {
  if (indiceAtivo !== 0) return false;
  const login = loginNorm(userCodusuario);
  return (
    podeOperarFiscalBase(fiscal, login) && fiscal.fiscal.documento_assinado !== 1
  );
}

export function podeAprovarFiscal(
  fiscal: FiscalResponseDto,
  userCodusuario?: string
): boolean {
  const login = loginNorm(userCodusuario);
  const aprov = aprovacaoUsuario(fiscal, login);
  return (
    podeOperarFiscalBase(fiscal, login) &&
    fiscal.fiscal.documento_assinado === 1 &&
    aprov?.situacao === "P"
  );
}

export async function assinarFiscalPendencia(
  fiscal: FiscalResponseDto,
  arquivoAssinatura: string,
  sign: {
    page: number;
    posX: number;
    posY: number;
    largura: number;
    altura: number;
  }
): Promise<void> {
  const dados: FiscalAssinar = {
    idmov: fiscal.fiscal.idmov,
    atendimento: fiscal.movimento.codigo_atendimento,
    arquivo: arquivoAssinatura,
    pagina: sign.page,
    posX: sign.posX,
    posY: sign.posY,
    largura: sign.largura,
    altura: sign.altura,
    dataHoraAssinatura: new Date().toLocaleString("pt-BR"),
  };
  await assinar(dados);
}

export async function aprovarFiscalPendencia(
  fiscal: FiscalResponseDto
): Promise<void> {
  await aprovarFiscal({
    idmov: fiscal.fiscal.idmov,
    codigo_atendimento: fiscal.movimento.codigo_atendimento,
    aprovar: true,
  });
}

export async function reprovarFiscalPendencia(
  fiscal: FiscalResponseDto
): Promise<void> {
  await aprovarFiscal({
    idmov: fiscal.fiscal.idmov,
    codigo_atendimento: fiscal.movimento.codigo_atendimento,
    aprovar: false,
  });
}
