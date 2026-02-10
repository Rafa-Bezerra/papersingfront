import { AprovadoresRestritos } from "@/types/AprovadoresRestritos";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "AprovadoresRestritos";
const elemento_singular = "aprovador";
const elemento_plural = "aprovadores";

export async function getAll(): Promise<AprovadoresRestritos[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: AprovadoresRestritos[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<AprovadoresRestritos> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: AprovadoresRestritos = await res.json();
    return apiData;
}

export async function createElement(data: AprovadoresRestritos): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: AprovadoresRestritos): Promise<void> {
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

export type { AprovadoresRestritos }