import { FiscalAprovarDocumento, FiscalAssinar, FiscalDocumento, FiscalGetAll, FiscalGetDocumento, FiscalResponseDto } from "@/types/Fiscal";
import { API_BASE, fetchJson, headers } from "@/utils/constants";
const caminho = "Fiscal";
const elemento_singular = "pagamento";
const elemento_plural = "pagamento";

export async function getAll(data: FiscalGetAll, signal?: AbortSignal): Promise<FiscalResponseDto[]> {
    const list = await fetchJson<FiscalResponseDto[]>(
        `${API_BASE}/api/${caminho}`,
        { method: "POST", body: JSON.stringify(data), signal },
        `Erro ao buscar ${elemento_plural}`
    );
    return list ?? [];
}

export async function getDocumento(data: FiscalGetDocumento): Promise<string> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: string = await res.text();
    return list;
}

export async function getAllAnexos(idmov: number): Promise<FiscalDocumento[]> {
    const url = new URL(`${API_BASE}/api/Anexos`);
    if (idmov) url.searchParams.append('idmov', idmov.toString());        
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: FiscalDocumento[] = await res.json();
    return list;
}

export async function aprovarFiscal(data: FiscalAprovarDocumento): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function assinar(data: FiscalAssinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type { FiscalAprovarDocumento, FiscalDocumento, FiscalGetAll, FiscalGetDocumento, FiscalResponseDto, FiscalAssinar }