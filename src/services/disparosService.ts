import { Disparo } from "@/types/Disparo";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Disparos";
const elemento_singular = "email";
const elemento_plural = "emails";

export async function getAll(): Promise<Disparo[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Disparo[] = await res.json();
    return list;
}

export async function createElement(email: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify({ email }) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao adicionar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao excluir ${elemento_singular}: ${msg}`);
    }
}

export type { Disparo }
