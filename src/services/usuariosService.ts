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
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: Usuario = await res.json();
    return apiData;
}

export async function createElement(data: Usuario): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: Usuario): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${data.SEQUENCIAL}`, { method: "PUT", headers: headers(), body: JSON.stringify(data) });
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

export type { Usuario }