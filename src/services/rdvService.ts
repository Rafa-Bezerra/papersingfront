import { Rdv, ItemRdv, AnexoRdv, AprovadoresRdv, Fornecedor, AssinarRdv } from "@/types/Rdv";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Rdv";
const elemento_singular = "rdv";
const elemento_plural = "rdvs";

export async function createElement(data: Rdv): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function getUltimosRdvs(): Promise<Rdv[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: headers()
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    
    const list: Rdv[] = await res.json();
    return list;
}

export async function getAprovacoesRdv(situacao: string, dateFrom: string, dateTo: string): Promise<Rdv[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovacoes`);

    const body = { situacao, dateFrom, dateTo };

    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    
    const list: Rdv[] = await res.json();
    return list;
}

export async function aprovarRdv(id: number, aprovacao: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar/${id}/${aprovacao}`,  { method: "POST", headers: headers(), body: JSON.stringify({ id:id , aprovacao: aprovacao }) }); 
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao aprovar ${elemento_singular}: ${msg}`);
    }
}

export async function getAllFornecedores(): Promise<Fornecedor[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/fornecedores`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Fornecedor[] = await res.json();
    return list;
}

export async function assinar(data: AssinarRdv): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.idrdv}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function getAnexoById(id: number): Promise<AnexoRdv> {
    const res = await fetch(`${API_BASE}/api/${caminho}/anexo/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: AnexoRdv = await res.json();
    return apiData;
}

export type { Rdv, ItemRdv, AnexoRdv, AprovadoresRdv, Fornecedor, AssinarRdv }