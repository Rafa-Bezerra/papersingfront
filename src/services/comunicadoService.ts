import type { Comunicado, ComunicadoAprovacao, ComunicadoAssinar, ComunicadoItemFinanceiroFlat } from "@/types/Comunicado";
import { achatarItensFinanceiros, agruparItensFinanceiros } from "@/utils/comunicadoRateio";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Comunicados";
const elemento_singular = "comunicado";
const elemento_plural = "comunicados";

// Shape bruto retornado pela API: itensFinanceiros vem "flat" (uma linha por conta contábil).
type ComunicadoFlat = Omit<Comunicado, "itensFinanceiros"> & { itensFinanceiros: ComunicadoItemFinanceiroFlat[] };

export async function getAll(): Promise<Comunicado[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: ComunicadoFlat[] = await res.json();
    return list.map(d => ({ ...d, itensFinanceiros: agruparItensFinanceiros(d.itensFinanceiros) }));
}

export async function createElement(data: Comunicado): Promise<void> {
    const payload = { ...data, itensFinanceiros: achatarItensFinanceiros(data.itensFinanceiros) };
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: ComunicadoAssinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
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

export async function getAllAprovadores(id: number): Promise<ComunicadoAprovacao[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovadores/${id}`); 
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: ComunicadoAprovacao[] = await res.json();
    return list;
}
  
export async function adicionarAprovador(id: number, data: ComunicadoAprovacao): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/adicionar/${id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function removerAprovador(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/remover/${id}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function aprovar(id: number, aprovado: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/aprovacao/${id}/${aprovado}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function getDocumento(id: number): Promise<string> {
    const body = { id };
    const res = await fetch(`${API_BASE}/api/${caminho}/anexo/${id}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    const data = await res.text();
    return data;
}

export async function getAnexo(caminho_anexo: string): Promise<string> {
    const body = { caminho_anexo };
    const res = await fetch(`${API_BASE}/api/${caminho}/anexo`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    const data = await res.text();
    return data;
}

export type CriarFinanceiroPayload = {
    codcfo: string;
    cod_tipo_documento: string;
    data_vencimento: string;
    data_emissao?: string;
    numero_documento?: string;
    codigos_natureza_financeira: string[];
};

export type CriarFinanceiroResult = {
    sucesso: boolean;
    message?: string;
    erro?: string;
    numeroFinanceiro?: string;
    idlanTotvs?: number;
};

export type TipoDocumento = {
    codtdo: string;
    descricao: string;
};

/** Lista os tipos de documento (CODTDO/FTDO) cadastrados no TOTVS da unidade do usuário logado. */
export async function getAllTiposDocumento(): Promise<TipoDocumento[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/tiposdocumento`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar tipos de documento: ${msg}`);
    }
    const list: TipoDocumento[] = await res.json();
    return list;
}

/** Cria manualmente o lançamento financeiro (FLAN) no TOTVS para um comunicado já totalmente aprovado. */
export async function criarFinanceiro(id: number, payload: CriarFinanceiroPayload): Promise<CriarFinanceiroResult> {
    const res = await fetch(`${API_BASE}/api/${caminho}/criarfinanceiro/${id}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            Codcfo: payload.codcfo,
            CodTipoDocumento: payload.cod_tipo_documento,
            DataVencimento: payload.data_vencimento,
            DataEmissao: payload.data_emissao,
            NumeroDocumento: payload.numero_documento,
            CodigosNaturezaFinanceira: payload.codigos_natureza_financeira,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status} ao criar financeiro.`);
    }
    return data as CriarFinanceiroResult;
}

export type { Comunicado, ComunicadoAssinar, ComunicadoAprovacao }