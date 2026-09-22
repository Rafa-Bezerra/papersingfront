import { API_BASE, EXTRATO_CONTROLE_TIMEOUT_MS, fetchJson } from "@/utils/constants";

export type ControleMedicaoPainel = {
  aprovado: number;
  pendente: number;
  atrasado: number;
  total: number;
};

export type ControleMedicaoItem = {
  idmov: number;
  numero_movimento: string;
  tipo_movimento: string;
  data_emissao?: string | null;
  status_movimento: string;
  status_controle: string;
  codigo_atendimento: string;
  quantidade_anexos: number;
  quantidade_centros_custo: number;
};

export type ControleMedicaoCentroCusto = {
  centro_custo: string;
  centro_custo_nome: string;
};

export type ControleMedicaoAprovador = {
  codusuario: string;
  nome: string;
};

export type ControleMedicaoResposta = {
  unidade: string;
  competencia: string;
  total: number;
  itens: ControleMedicaoItem[];
};

export type ControleMedicaoAprovacao = {
  id: number;
  usuario: string;
  nome: string;
  cargo: string;
  nivel: number;
  situacao: string;
  data_aprovacao?: string | null;
};

export type StatusControleFiltro = "Aprovado" | "Pendente" | "Atrasado";

export const UNIDADES_CONTROLE_MEDICAO = [
  "WAY 112",
  "WAY 153",
  "WAY 262",
  "WAY 306",
  "WAY 364",
  "WAY CSC",
] as const;

export async function listarAprovadoresControleMedicao(
  q: string,
  unidade?: string
): Promise<ControleMedicaoAprovador[]> {
  const url = new URL(`${API_BASE}/api/ControleMedicao/aprovadores`);
  url.searchParams.set("q", q.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ControleMedicaoAprovador[]>(
    url.toString(),
    undefined,
    "Erro ao buscar aprovadores"
  );
}

export async function obterPainelControleMedicao(
  competencia: string,
  unidade?: string,
  usuario?: string
): Promise<ControleMedicaoPainel> {
  const url = new URL(`${API_BASE}/api/ControleMedicao/painel`);
  url.searchParams.set("competencia", competencia.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  if (usuario?.trim()) url.searchParams.set("usuario", usuario.trim());
  return fetchJson<ControleMedicaoPainel>(
    url.toString(),
    undefined,
    "Erro ao carregar painel de medições",
    EXTRATO_CONTROLE_TIMEOUT_MS
  );
}

export async function listarControleMedicao(
  competencia: string,
  unidade?: string,
  status?: StatusControleFiltro,
  usuario?: string
): Promise<ControleMedicaoResposta> {
  const url = new URL(`${API_BASE}/api/ControleMedicao/listar`);
  url.searchParams.set("competencia", competencia.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  if (status) url.searchParams.set("status", status);
  if (usuario?.trim()) url.searchParams.set("usuario", usuario.trim());
  return fetchJson<ControleMedicaoResposta>(
    url.toString(),
    undefined,
    "Erro ao listar medições",
    EXTRATO_CONTROLE_TIMEOUT_MS
  );
}

export async function listarCentrosCustoControleMedicao(
  idmov: number,
  unidade?: string
): Promise<ControleMedicaoCentroCusto[]> {
  const url = new URL(`${API_BASE}/api/ControleMedicao/centros-custo/${idmov}`);
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ControleMedicaoCentroCusto[]>(
    url.toString(),
    undefined,
    "Erro ao carregar centros de custo"
  );
}

export async function listarAprovacoesControleMedicao(
  idmov: number,
  unidade?: string
): Promise<ControleMedicaoAprovacao[]> {
  const url = new URL(`${API_BASE}/api/ControleMedicao/aprovacoes/${idmov}`);
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ControleMedicaoAprovacao[]>(
    url.toString(),
    undefined,
    "Erro ao carregar aprovações"
  );
}
