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

  const normalized: LoginResponse = {
    sequencial: apiData.sequencial,
    codusuario: apiData.codusuario,
    email: apiData.email,
    unidade: apiData.unidade,
    nome: apiData.nome,
    token: apiData.token,

    admin: apiData.admin,
    documentos: apiData.documentos,
    rdv: apiData.rdv,
    bordero: apiData.bordero,
    comunicados: apiData.comunicados,
    administrativo: apiData.administrativo,
    solicitante: apiData.solicitante,
    ccusto: apiData.ccusto,
    fiscal: apiData.fiscal,
    restrito: apiData.restrito,
    externo: apiData.externo,

    // 👇 aqui está o conserto
    pagamento_impostos:
      apiData.pagamento_impostos ??
      apiData.PAGAMENTO_IMPOSTOS ??
      apiData.pagamentO_IMPOSTOS,

    pagamento_rh:
      apiData.pagamento_rh ??
      apiData.PAGAMENTO_RH ??
      apiData.pagamentO_RH,
  };

  return normalized;
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