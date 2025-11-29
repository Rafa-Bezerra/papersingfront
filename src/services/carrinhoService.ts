import { CentroDeCusto, Carrinho, ContaFinanceira, Produto, ItemCarrinho } from "@/types/Carrinho";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Solicitacao";
const elemento_singular = "produto";
const elemento_plural = "produtos";

export async function getAllCentrosDeCusto(): Promise<CentroDeCusto[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/centrosdecusto`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: CentroDeCusto[] = await res.json();
    return list;
}

export async function getAllContasFinanceiras(data: string): Promise<ContaFinanceira[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/contasfinanceiras`, { method: "POST",  headers: headers(), body: JSON.stringify({data: data}) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: ContaFinanceira[] = await res.json();
    return list;
}

export async function getAllProdutos(data: string): Promise<Produto[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/produtos`, { method: "POST",  headers: headers(), body: JSON.stringify({data: data}) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Produto[] = await res.json();
    return list;
}

export async function createElement(data: Carrinho): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/enviarsoap`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export type { CentroDeCusto, Carrinho, ItemCarrinho, ContaFinanceira, Produto }