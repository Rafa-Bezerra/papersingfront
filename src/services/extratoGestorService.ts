import { API_BASE, EXTRATO_CONTROLE_TIMEOUT_MS, fetchJson } from "@/utils/constants";

export type ExtratoGestorItem = {
  idmov: number;
  tipo_movimento: string;
  numero_movimento: string;
  data_aprovacao?: string | null;
  valor_total?: number | null;
  quantidade_centros_custo?: number;
  quantidade_anexos?: number;
};

export type ExtratoGestorAprovacao = {
  id: number;
  usuario: string;
  nome: string;
  cargo: string;
  nivel: number;
  situacao: string;
  data_aprovacao?: string | null;
};

export type ExtratoGestorCentroCusto = {
  centro_custo: string;
  centro_custo_nome: string;
};

export type ExtratoGestorAprovador = {
  codusuario: string;
  nome: string;
};

export type ExtratoGestorResposta = {
  unidade: string;
  usuario: string;
  total: number;
  itens: ExtratoGestorItem[];
};

export type ExtratoGestorFiltros = {
  tipo_movimento?: string;
  data_inicio?: string;
  data_fim?: string;
};

export const UNIDADES_EXTRATO_GESTOR = [
  "WAY 112",
  "WAY 153",
  "WAY 262",
  "WAY 306",
  "WAY 364",
  "WAY CSC",
] as const;

export async function listarAprovadoresExtratoGestor(
  q: string,
  unidade?: string
): Promise<ExtratoGestorAprovador[]> {
  const url = new URL(`${API_BASE}/api/ExtratoGestor/aprovadores`);
  url.searchParams.set("q", q.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ExtratoGestorAprovador[]>(
    url.toString(),
    undefined,
    "Erro ao buscar aprovadores"
  );
}

export async function listarTiposMovimentoExtratoGestor(
  usuario: string,
  unidade?: string
): Promise<string[]> {
  const url = new URL(`${API_BASE}/api/ExtratoGestor/tipos-movimento`);
  url.searchParams.set("usuario", usuario.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<string[]>(
    url.toString(),
    undefined,
    "Erro ao buscar tipos de movimento",
    EXTRATO_CONTROLE_TIMEOUT_MS
  );
}

export async function listarAprovacoesExtratoGestor(
  idmov: number,
  unidade?: string
): Promise<ExtratoGestorAprovacao[]> {
  const url = new URL(`${API_BASE}/api/ExtratoGestor/aprovacoes/${idmov}`);
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ExtratoGestorAprovacao[]>(
    url.toString(),
    undefined,
    "Erro ao buscar aprovações"
  );
}

export async function listarCentrosCustoExtratoGestor(
  idmov: number,
  unidade?: string
): Promise<ExtratoGestorCentroCusto[]> {
  const url = new URL(`${API_BASE}/api/ExtratoGestor/centros-custo/${idmov}`);
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  return fetchJson<ExtratoGestorCentroCusto[]>(
    url.toString(),
    undefined,
    "Erro ao buscar centros de custo"
  );
}

export async function consultarExtratoGestor(
  usuario: string,
  unidade?: string,
  filtros?: ExtratoGestorFiltros
): Promise<ExtratoGestorResposta> {
  const url = new URL(`${API_BASE}/api/ExtratoGestor/consultar`);
  url.searchParams.set("usuario", usuario.trim());
  if (unidade?.trim()) url.searchParams.set("unidade", unidade.trim());
  if (filtros?.tipo_movimento?.trim()) {
    url.searchParams.set("tipo_movimento", filtros.tipo_movimento.trim());
  }
  if (filtros?.data_inicio?.trim()) {
    url.searchParams.set("data_inicio", filtros.data_inicio.trim());
  }
  if (filtros?.data_fim?.trim()) {
    url.searchParams.set("data_fim", filtros.data_fim.trim());
  }
  return fetchJson<ExtratoGestorResposta>(
    url.toString(),
    undefined,
    "Erro ao consultar extrato do gestor",
    EXTRATO_CONTROLE_TIMEOUT_MS
  );
}
