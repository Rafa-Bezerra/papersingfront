import type { Bordero, BorderoItem, BorderoAprovacao } from "@/types/Bordero";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Bordero";
const elemento_singular = "borderô";
const elemento_plural = "borderôs";

export async function getAll(): Promise<Bordero[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);       
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Bordero[] = await res.json();
    return list;
}
  
export async function getAllItens(id: number): Promise<BorderoItem[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/itens/${id}`);       
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: BorderoItem[] = await res.json();
    return list;
}

export async function getAllAprovadores(id:number): Promise<BorderoAprovacao[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovadores/${id}`); 
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: BorderoAprovacao[] = await res.json();
    return list;
}
  
export async function adicionarAprovador(data: BorderoAprovacao): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/adicionar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function toggleAprovador(id: number, toggle: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/toggle/${id}/${toggle}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function aprovar(id: number, aprovado: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar/${id}/${aprovado}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { Bordero, BorderoItem, BorderoAprovacao }