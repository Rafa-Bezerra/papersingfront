import { RequisicaoDto, Requisicao_aprovacao, Requisicao_item } from "@/types/Requisicao";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Requisicoes";
const elemento_singular = "requisição";
const elemento_plural = "requisições";

export async function getAll(dateFrom: string, dateTo: string, movimentos: string[], situacao: string): Promise<RequisicaoDto[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);
    
    const body = { dateFrom, dateTo, movimentos, situacao };

    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    
    const list: RequisicaoDto[] = await res.json();
    return list;
}

export async function aprovar(id: number, atendimento: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar/${id}/${atendimento}`,  { method: "POST", headers: headers(), body: JSON.stringify(id) }); 
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao aprovar ${elemento_singular}: ${msg}`);
    }
}

export async function reprovar(id: number, atendimento: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/reprovar/${id}/${atendimento}`,  { method: "POST", headers: headers(), body: JSON.stringify(id) }); 
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao reprovar ${elemento_singular}: ${msg}`);
    }
}

export type { RequisicaoDto, Requisicao_item, Requisicao_aprovacao }