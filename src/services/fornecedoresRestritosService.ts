import { FornecedoresRestritos } from "@/types/FornecedoresRestritos";
import { Fornecedor } from "@/types/Rdv";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "FornecedoresRestritos";
const elemento_singular = "fornecedor restrito";
const elemento_plural = "fornecedores restritos";

export async function getAll(): Promise<FornecedoresRestritos[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: FornecedoresRestritos[] = await res.json();
    return list;
}

export async function createElement(data: Omit<FornecedoresRestritos, "id">): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao excluir ${elemento_singular}: ${msg}`);
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

export type { FornecedoresRestritos }
