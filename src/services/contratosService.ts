import { API_BASE, fetchJson } from "@/utils/constants";

export type AreaContrato = "JURIDICO" | "DU" | "GAF";
export type StatusContrato = "AGUARDANDO_CONTRATO" | "EM_ASSINATURA" | "CONCLUIDO" | "CANCELADO";
export type TipoAnexoContrato = "CONTRATO_ASSINADO" | "DOC_ADICIONAL";
export type SituacaoFiltro = "pendentes" | "concluidos";

export const AREAS_CONTRATO: { valor: AreaContrato; label: string }[] = [
  { valor: "JURIDICO", label: "Jurídico" },
  { valor: "DU", label: "DU" },
  { valor: "GAF", label: "GAF" },
];

export function labelArea(area: string): string {
  return AREAS_CONTRATO.find((a) => a.valor === area)?.label ?? area;
}

export function labelStatus(status: string): string {
  switch (status) {
    case "AGUARDANDO_CONTRATO":
      return "Aguardando contrato";
    case "EM_ASSINATURA":
      return "Em assinatura";
    case "CONCLUIDO":
      return "Concluído";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status;
  }
}

export type ContratoAnexo = {
  id: number;
  id_contrato: number;
  tipo: TipoAnexoContrato | string;
  nome_arquivo: string;
  document_key_waysign?: string | null;
  usuario: string;
  data?: string | null;
};

export type Contrato = {
  id: number;
  unidade: string;
  area: AreaContrato | string;
  idmov_requisicao?: number | null;
  idmov_qcp?: number | null;
  idmov_precontrato?: number | null;
  numero_precontrato: string;
  codcfo: string;
  fornecedor: string;
  valor?: number | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  status: StatusContrato | string;
  data_aprovacao?: string | null;
  usuario_conclusao: string;
  data_conclusao?: string | null;
  data_criacao?: string | null;
  tem_contrato_assinado: boolean;
  codigo_atendimento_precontrato?: string | null;
  /** Código do contrato no TOTVS (gravado pelo "Criar Contrato"). */
  codigo_contrato?: string | null;
  anexos: ContratoAnexo[];
};

export type ContratoLista = {
  itens: Contrato[];
  total: number;
  page: number;
  page_size: number;
  unidade: string;
  admin: boolean;
  tabelas_existem: boolean;
  area_padrao: string;
};

export type ContratoIndicadores = {
  aguardando_contrato: number;
  em_assinatura: number;
  vencem_30_dias: number;
  concluidos_mes: number;
};

export type ContratoAprovacao = {
  usuario: string;
  nome: string;
  situacao: string;
  data_aprovacao?: string | null;
};

export type FiltrosContratos = {
  area?: AreaContrato | "";
  status?: SituacaoFiltro;
  busca?: string;
  page?: number;
  dataDe?: string;
  dataAte?: string;
  valorMin?: string;
  valorMax?: string;
};

export type DestinatarioWaySign = { nome: string; email: string };

const BASE = () => `${API_BASE}/api/Contratos`;

export async function listarContratos(filtros: FiltrosContratos = {}): Promise<ContratoLista> {
  const url = new URL(BASE());
  if (filtros.area) url.searchParams.set("area", filtros.area);
  if (filtros.status) url.searchParams.set("status", filtros.status);
  if (filtros.busca?.trim()) url.searchParams.set("busca", filtros.busca.trim());
  if (filtros.page && filtros.page > 1) url.searchParams.set("page", String(filtros.page));
  if (filtros.dataDe) url.searchParams.set("dataDe", filtros.dataDe);
  if (filtros.dataAte) url.searchParams.set("dataAte", filtros.dataAte);
  if (filtros.valorMin?.trim()) url.searchParams.set("valorMin", filtros.valorMin.trim());
  if (filtros.valorMax?.trim()) url.searchParams.set("valorMax", filtros.valorMax.trim());
  return fetchJson<ContratoLista>(url.toString(), undefined, "Erro ao listar contratos");
}

export async function obterIndicadoresContratos(): Promise<ContratoIndicadores> {
  return fetchJson<ContratoIndicadores>(`${BASE()}/indicadores`, undefined, "Erro ao carregar indicadores");
}

export async function obterContrato(id: number): Promise<Contrato> {
  return fetchJson<Contrato>(`${BASE()}/${id}`, undefined, "Erro ao carregar o contrato");
}

export async function obterAprovacaoContrato(id: number): Promise<ContratoAprovacao[]> {
  return fetchJson<ContratoAprovacao[]>(`${BASE()}/${id}/aprovacao`, undefined, "Erro ao carregar a aprovação");
}

export async function anexarArquivoContrato(
  id: number,
  tipo: TipoAnexoContrato,
  nome: string,
  anexoBase64: string
): Promise<ContratoAnexo> {
  return fetchJson<ContratoAnexo>(
    `${BASE()}/${id}/anexos`,
    { method: "POST", body: JSON.stringify({ tipo, nome, anexo: anexoBase64 }) },
    "Erro ao anexar o arquivo",
    120_000
  );
}

export async function obterArquivoAnexoContrato(anexoId: number): Promise<string> {
  return fetchJson<string>(`${BASE()}/anexos/${anexoId}`, undefined, "Erro ao abrir o anexo", 120_000);
}

export async function enviarContratoWaySign(
  id: number,
  dados: {
    id_anexo?: number;
    nome?: string;
    anexo?: string;
    destinatarios: DestinatarioWaySign[];
    mensagem?: string;
  }
): Promise<{ message: string; document_key: string }> {
  return fetchJson(
    `${BASE()}/${id}/enviar-waysign`,
    { method: "POST", body: JSON.stringify(dados) },
    "Erro ao enviar para o WaySign",
    120_000
  );
}

export async function resgatarContratoWaySign(id: number): Promise<ContratoAnexo> {
  return fetchJson<ContratoAnexo>(
    `${BASE()}/${id}/resgatar-waysign`,
    { method: "POST" },
    "Erro ao buscar o contrato assinado",
    120_000
  );
}

export async function concluirContrato(
  id: number,
  vigencia?: { vigencia_inicio?: string; vigencia_fim?: string }
): Promise<{ message: string }> {
  return fetchJson(
    `${BASE()}/${id}/concluir`,
    { method: "POST", body: JSON.stringify(vigencia ?? {}) },
    "Erro ao concluir o contrato"
  );
}

export async function alterarAreaContrato(id: number, area: AreaContrato): Promise<{ message: string }> {
  return fetchJson(
    `${BASE()}/${id}/area`,
    { method: "POST", body: JSON.stringify({ area }) },
    "Erro ao alterar a área"
  );
}
