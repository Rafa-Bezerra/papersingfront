import { API_BASE, headers } from "@/utils/constants";


export interface LoginPayload {
  username: string;
  password: string;
  base: string;
}

export interface LoginExternoPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  sequencial: number;
  codusuario: string;
  email: string;
  unidade: string;
  nome: string;
  token: string;
  admin: boolean;
  documentos: boolean;
  rdv: boolean;
  bordero: boolean;
  comunicados: boolean;
  administrativo: boolean;
  solicitante: boolean;
  ccusto: boolean;
  fiscal: boolean;
  restrito: boolean;
  pagamento_rh: boolean;
  pagamento_impostos: boolean;
  externo: boolean;
  gestao_pessoas: boolean;
  financeiro: boolean;
  docusign: boolean;
  projetos: boolean;
  contratos: boolean;
  financeiro_totvs: boolean;
  receitas: boolean;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/Usuarios/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || `Erro ${res.status}`);
  }

  const apiData = JSON.parse(text);

  console.log("RAW API:", apiData);

  return normalizeLoginResponse(apiData);
}

function normalizeLoginResponse(apiData: Record<string, unknown>): LoginResponse {
  const normalized: LoginResponse = {
    sequencial: (apiData.sequencial ?? apiData.SEQUENCIAL) as number,
    codusuario: String(apiData.codusuario ?? apiData.CODUSUARIO ?? ''),
    email: String(apiData.email ?? apiData.EMAIL ?? ''),
    unidade: String(apiData.unidade ?? apiData.UNIDADE ?? ''),
    nome: String(apiData.nome ?? apiData.NOME ?? ''),
    token: String(apiData.token ?? apiData.TOKEN ?? ''),

    admin: Boolean(apiData.admin ?? apiData.ADMIN),
    documentos: Boolean(apiData.documentos ?? apiData.DOCUMENTOS),
    rdv: Boolean(apiData.rdv ?? apiData.RDV),
    bordero: Boolean(apiData.bordero ?? apiData.BORDERO),
    comunicados: Boolean(apiData.comunicados ?? apiData.COMUNICADOS),
    administrativo: Boolean(apiData.administrativo ?? apiData.ADMINISTRATIVO),
    solicitante: Boolean(apiData.solicitante ?? apiData.SOLICITANTE),
    ccusto: Boolean(apiData.ccusto ?? apiData.CCUSTO),
    fiscal: Boolean(apiData.fiscal ?? apiData.FISCAL),
    restrito: Boolean(apiData.restrito ?? apiData.RESTRITO),
    externo: Boolean(apiData.externo ?? apiData.EXTERNO),

    gestao_pessoas: Boolean(apiData.gestao_pessoas ?? apiData.GESTAO_PESSOAS ?? false),
    financeiro: Boolean(apiData.financeiro ?? apiData.FINANCEIRO ?? false),
    docusign: Boolean(apiData.docusign ?? apiData.DOCUSIGN ?? false),
    projetos: Boolean(apiData.projetos ?? apiData.PROJETOS ?? false),
    contratos: Boolean(apiData.contratos ?? apiData.CONTRATOS ?? false),
    financeiro_totvs: Boolean(
      apiData.financeiro_totvs ?? apiData.FINANCEIRO_TOTVS ?? apiData.financeirO_TOTVS ?? false
    ),
    receitas: Boolean(apiData.receitas ?? apiData.RECEITAS ?? false),

    pagamento_impostos: Boolean(
      apiData.pagamento_impostos ??
        apiData.PAGAMENTO_IMPOSTOS ??
        apiData.pagamentO_IMPOSTOS
    ),

    pagamento_rh: Boolean(
      apiData.pagamento_rh ?? apiData.PAGAMENTO_RH ?? apiData.pagamentO_RH
    ),
  };

  return normalized;
}

export type SamlStatus = {
  enabled: boolean
  requireMicrosoftLogin: boolean
}

export async function getSamlStatus(): Promise<SamlStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/Saml/status`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { enabled: false, requireMicrosoftLogin: false };
    const data = await res.json();
    return {
      enabled: Boolean(data?.enabled),
      requireMicrosoftLogin: Boolean(data?.requireMicrosoftLogin),
    };
  } catch {
    return { enabled: false, requireMicrosoftLogin: false };
  }
}

export function startMicrosoftLogin(base: string) {
  const url = `${API_BASE}/api/Saml/login?base=${encodeURIComponent(base)}`;
  window.location.href = url;
}

export async function exchangeSamlCode(code: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/Saml/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Erro ${res.status}`);
  return normalizeLoginResponse(JSON.parse(text));
}


export async function getUnidadesDisponiveis(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/Usuarios/unidades-disponiveis`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Erro ao buscar unidades disponíveis');
  return res.json();
}

export async function trocarUnidade(novaUnidade: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/Usuarios/trocar-unidade`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ unidade: novaUnidade }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Erro ao trocar unidade');
  const apiData = JSON.parse(text);
  return {
    sequencial: apiData.sequencial ?? apiData.SEQUENCIAL,
    codusuario: apiData.codusuario ?? apiData.CODUSUARIO,
    email: apiData.email ?? apiData.EMAIL,
    unidade: apiData.unidade ?? apiData.UNIDADE,
    nome: apiData.nome ?? apiData.NOME,
    token: apiData.token ?? apiData.TOKEN,
    admin: apiData.admin ?? apiData.ADMIN,
    documentos: apiData.documentos ?? apiData.DOCUMENTOS,
    rdv: apiData.rdv ?? apiData.RDV,
    bordero: apiData.bordero ?? apiData.BORDERO,
    comunicados: apiData.comunicados ?? apiData.COMUNICADOS,
    administrativo: apiData.administrativo ?? apiData.ADMINISTRATIVO,
    solicitante: apiData.solicitante ?? apiData.SOLICITANTE,
    ccusto: apiData.ccusto ?? apiData.CCUSTO,
    fiscal: apiData.fiscal ?? apiData.FISCAL,
    restrito: apiData.restrito ?? apiData.RESTRITO,
    externo: apiData.externo ?? apiData.EXTERNO,
    pagamento_impostos: apiData.pagamento_impostos ?? apiData.PAGAMENTO_IMPOSTOS,
    pagamento_rh: apiData.pagamento_rh ?? apiData.PAGAMENTO_RH,
    gestao_pessoas: apiData.gestao_pessoas ?? apiData.GESTAO_PESSOAS ?? false,
    financeiro: apiData.financeiro ?? apiData.FINANCEIRO ?? false,
    docusign: apiData.docusign ?? apiData.DOCUSIGN ?? false,
    projetos: apiData.projetos ?? apiData.PROJETOS ?? false,
    contratos: apiData.contratos ?? apiData.CONTRATOS ?? false,
    financeiro_totvs: apiData.financeiro_totvs ?? apiData.FINANCEIRO_TOTVS ?? apiData.financeirO_TOTVS ?? false,
    receitas: apiData.receitas ?? apiData.RECEITAS ?? false,
  };
}

export async function loginExterno(payload: LoginExternoPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/Externos/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    // 401 virá aqui: text === "Usuário ou senha inválidos."
    throw new Error(text || `Erro ${res.status}`);
  }

  // se a sua API retornar JSON com { token: '...' }
  try {
    return JSON.parse(text) as LoginResponse;
  } catch {
    throw new Error('Resposta inesperada do servidor');
  }
}