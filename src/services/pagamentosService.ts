import { Pagamento, PagamentoAprovador, PagamentoAprovadoresGetAll, PagamentoAprovar, PagamentoAssinarDocumento, PagamentoGerarDocumento, PagamentoGetAll, PagamentoGetDocumento, CriarFinanceiroPagamentoPayload, CriarFinanceiroPagamentoResult } from "@/types/Pagamentos";
import { API_BASE, fetchJson, headers } from "@/utils/constants";
const caminho = "Pagamentos";
const elemento_singular = "pagamento";
const elemento_plural = "pagamento";

export async function getAll(data: PagamentoGetAll, signal?: AbortSignal): Promise<Pagamento[]> {
    const list = await fetchJson<Pagamento[]>(
        `${API_BASE}/api/${caminho}`,
        { method: "POST", body: JSON.stringify(data), signal },
        `Erro ao buscar ${elemento_plural}`
    );
    return list ?? [];
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

/** Cria um lançamento financeiro (FLAN) avulso no TOTVS para Pagamentos RH/Impostos. */
export async function criarFinanceiro(payload: CriarFinanceiroPagamentoPayload): Promise<CriarFinanceiroPagamentoResult> {
    const res = await fetch(`${API_BASE}/api/${caminho}/criarfinanceiro`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            grupo: payload.grupo,
            codcfo: payload.codcfo,
            codTipoDocumento: payload.cod_tipo_documento,
            dataVencimento: payload.data_vencimento,
            dataEmissao: payload.data_emissao,
            numeroDocumento: payload.numero_documento,
            valor: payload.valor,
            codigoNaturezaFinanceira: payload.codigo_natureza_financeira,
            codCcusto: payload.cod_ccusto,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.erro || `Erro ${res.status} ao criar financeiro.`);
    }
    return data as CriarFinanceiroPagamentoResult;
}

export type { Pagamento, PagamentoGetAll, PagamentoAprovadoresGetAll, PagamentoAprovar, PagamentoAprovador, PagamentoGerarDocumento, PagamentoGetDocumento, PagamentoAssinarDocumento, CriarFinanceiroPagamentoPayload, CriarFinanceiroPagamentoResult }