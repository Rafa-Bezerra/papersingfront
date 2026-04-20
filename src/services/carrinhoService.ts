import { CentroDeCusto, Carrinho, ContaFinanceira, Produto, ItemCarrinho, AnexoCarrinho } from "@/types/Carrinho";
import { RequisicaoDto } from "@/types/Requisicao";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Solicitacao";
// const elemento_singular = "produto";
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
        const body = await res.text();
        try {
            const json = JSON.parse(body);
            throw new Error(json.erro ?? body);
        } catch {
            throw new Error(body);
        }
    }
}

export async function updateElement(idmov: number, data: Carrinho): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${idmov}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const body = await res.text();
        try {
            const json = JSON.parse(body);
            throw new Error(json.erro ?? body);
        } catch {
            throw new Error(body);
        }
    }
}

export async function getAnexos(idmov: number): Promise<AnexoCarrinho[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/anexos/${idmov}`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar anexos: ${msg}`);
    }
    return res.json();
}

export async function getUltimasRequisicoes(params?: { dateFrom?: string; dateTo?: string; situacao?: string }): Promise<RequisicaoDto[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/ultimasrequisicoes`);
    if (params?.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) url.searchParams.set('dateTo', params.dateTo);
    if (params?.situacao) url.searchParams.set('situacao', params.situacao);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: headers()
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    
    const list: RequisicaoDto[] = await res.json();
    return list;
}

export type { CentroDeCusto, Carrinho, ItemCarrinho, ContaFinanceira, Produto, AnexoCarrinho }