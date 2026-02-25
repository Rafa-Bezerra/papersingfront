import { Pagamento, PagamentoAprovador, PagamentoAprovadoresGetAll, PagamentoAprovar, PagamentoAssinarDocumento, PagamentoGerarDocumento, PagamentoGetAll, PagamentoGetDocumento } from "@/types/Pagamentos";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Pagamentos";
const elemento_singular = "pagamento";
const elemento_plural = "pagamento";

export async function getAll(data: PagamentoGetAll): Promise<Pagamento[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Pagamento[] = await res.json();
    return list;
}

export async function getAllAprovadores(data: PagamentoAprovadoresGetAll): Promise<PagamentoAprovador[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: PagamentoAprovador[] = await res.json();
    return list;
}

export async function aprovarPagamento(data: PagamentoAprovar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function gerarDocumento(data: PagamentoGerarDocumento) {
    const res = await fetch(`${API_BASE}/api/${caminho}/gerar_documento/${data.idlan}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function getDocumento(data: PagamentoGetDocumento): Promise<string> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento/${data.idlan}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
    const resp = await res.text();
    return resp;
}

export async function assinarDocumento(data: PagamentoAssinarDocumento) {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.idlan}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export type { Pagamento, PagamentoGetAll, PagamentoAprovadoresGetAll, PagamentoAprovar, PagamentoAprovador, PagamentoGerarDocumento, PagamentoGetDocumento, PagamentoAssinarDocumento }