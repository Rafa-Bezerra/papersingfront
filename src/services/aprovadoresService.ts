import { Aprovadores } from "@/types/Aprovadores";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Aprovadores";
const elemento_singular = "aprovador";
const elemento_plural = "aprovadores";

export async function getAll(id: number): Promise<Aprovadores[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/alcada/${id}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Aprovadores[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<Aprovadores> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: Aprovadores = await res.json();
    return apiData;
}

export async function createElement(data: Aprovadores): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: Aprovadores): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${data.id}`, { method: "PUT", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "DELETE", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { Aprovadores }