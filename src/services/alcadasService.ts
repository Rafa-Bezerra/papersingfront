import { Alcada } from "@/types/Alcada";
import { API_BASE, headers } from "@/utils/constants";
import { erroDaResposta } from "@/utils/avisoApi";
const caminho = "Alcadas";
const elemento_singular = "alçada";
const elemento_plural = "alçadas";

export async function getAll(): Promise<Alcada[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Alcada[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<Alcada> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: Alcada = await res.json();
    return apiData;
}

export async function createElement(data: Alcada): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) throw await erroDaResposta(res, `criar ${elemento_singular}`);
}
  
export async function updateElement(data: Alcada): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/editar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) throw await erroDaResposta(res, `atualizar ${elemento_singular}`);
}
  
export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { Alcada }