import type { Anexo, AnexoAssinar, AnexoUpload } from "@/types/Anexo";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Anexos";
const elemento_singular = "anexo";
const elemento_plural = "anexos";

export async function getAll(idmov: number): Promise<Anexo[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);
    if (idmov) url.searchParams.append('idmov', idmov.toString());        
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Anexo[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<Anexo> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: Anexo = await res.json();
    return apiData;
}

export async function createElement(data: AnexoUpload): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: AnexoAssinar): Promise<void> {
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

export type { Anexo, AnexoAssinar, AnexoUpload }