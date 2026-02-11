import { AprovadoresRh } from "@/types/AprovadoresRh";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "AprovadoresRh";
const elemento_singular = "aprovador";
const elemento_plural = "aprovadores";

export async function getAll(): Promise<AprovadoresRh[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: AprovadoresRh[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<AprovadoresRh> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: AprovadoresRh = await res.json();
    return apiData;
}

export async function createElement(data: AprovadoresRh): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: AprovadoresRh): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/editar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
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

export type { AprovadoresRh }