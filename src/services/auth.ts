import { API_BASE } from "@/utils/constants";


export interface LoginPayload {
  username: string;
  password: string;
  base: string;
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
  bordero: boolean;
  comunicados: boolean;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/Usuarios/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(text);
  
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
