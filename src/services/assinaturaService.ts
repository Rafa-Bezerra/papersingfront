import { Assinar, Assinatura } from "@/types/Assinatura";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Assinatura";
const elemento_singular = "assinatura";

export async function get(): Promise<Assinatura> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }    
    return await res.json();
}

export async function updateAssinatura(data: Assinatura): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function assinar(data: Assinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { Assinatura, Assinar }