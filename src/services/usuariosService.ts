import { API_BASE, headers } from "@/utils/constants";
import { Usuario } from "@/types/Usuario";
const caminho = "Usuarios";
const elemento_singular = "usuário";
const elemento_plural = "usuários";

export async function getAll(): Promise<Usuario[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Usuario[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<Usuario> {
    const res = await fetch(
      `${API_BASE}/api/${caminho}/${id}`,
      { headers: headers() }
    )
  
    if (!res.ok) {
      const msg = await res.text()
      throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`)
    }
  
    const apiData = await res.json()
  
    const normalized: Usuario = {
      sequencial: apiData.sequencial ?? apiData.SEQUENCIAL,
      codusuario: apiData.codusuario ?? apiData.CODUSUARIO,
      nome: apiData.nome ?? apiData.NOME,
      empresa: apiData.empresa ?? apiData.EMPRESA,
      codperfil: apiData.codperfil ?? apiData.CODPERFIL,
      diretoria: apiData.diretoria ?? apiData.DIRETORIA,
      email: apiData.email ?? apiData.EMAIL,
      ativo: apiData.ativo ?? apiData.ATIVO,
      datacriacao: apiData.datacriacao ?? apiData.DATACRIACAO,
      codsistema: apiData.codsistema ?? apiData.CODSISTEMA,
  
      admin: apiData.admin ?? apiData.ADMIN,
      documentos: apiData.documentos ?? apiData.DOCUMENTOS,
      bordero: apiData.bordero ?? apiData.BORDERO,
      comunicados: apiData.comunicados ?? apiData.COMUNICADOS,
      rdv: apiData.rdv ?? apiData.RDV,
      externo: apiData.externo ?? apiData.EXTERNO,
      restrito: apiData.restrito ?? apiData.RESTRITO,
      ccusto: apiData.ccusto ?? apiData.CCUSTO,
      administrativo: apiData.administrativo ?? apiData.ADMINISTRATIVO,
      solicitante: apiData.solicitante ?? apiData.SOLICITANTE,
      fiscal: apiData.fiscal ?? apiData.FISCAL,
  
      pagamento_impostos:
        apiData.pagamento_impostos ??
        apiData.PAGAMENTO_IMPOSTOS ??
        apiData.pagamentO_IMPOSTOS,
  
      pagamento_rh:
        apiData.pagamento_rh ??
        apiData.PAGAMENTO_RH ??
        apiData.pagamentO_RH,
  
      gestao_pessoas:
        apiData.gestao_pessoas ??
        apiData.GESTAO_PESSOAS ??
        apiData.gestaO_PESSOAS
    }
  
    return normalized
  }
  

export async function createElement(data: Usuario): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function updateElement(data: Usuario): Promise<void> {
    const payload = {
        NOME: data.nome,
        EMPRESA: data.empresa,
        CODPERFIL: data.codperfil,
        DIRETORIA: data.diretoria,
        EMAIL: data.email,
        ATIVO: data.ativo,
        CODSISTEMA: data.codsistema,

        ADMIN: data.admin,
        DOCUMENTOS: data.documentos,
        BORDERO: data.bordero,
        COMUNICADOS: data.comunicados,
        RDV: data.rdv,
        EXTERNO: data.externo,
        RESTRITO: data.restrito,
        CCUSTO: data.ccusto,
        ADMINISTRATIVO: data.administrativo,
        SOLICITANTE: data.solicitante,
        FISCAL: data.fiscal,

        PAGAMENTO_IMPOSTOS: data.pagamento_impostos,
        PAGAMENTO_RH: data.pagamento_rh,
        GESTAO_PESSOAS: data.gestao_pessoas
    }

    const res = await fetch(`${API_BASE}/api/${caminho}/editar/${data.sequencial}`, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
export async function resetPassword(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/resetar_senha/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { Usuario }