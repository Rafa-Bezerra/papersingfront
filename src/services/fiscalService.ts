import { FiscalAprovarDocumento, FiscalAssinar, FiscalDocumento, FiscalGetAll, FiscalGetDocumento, FiscalResponseDto } from "@/types/Fiscal";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Fiscal";
const elemento_singular = "pagamento";
const elemento_plural = "pagamento";

export async function getAll(data: FiscalGetAll): Promise<FiscalResponseDto[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: FiscalResponseDto[] = await res.json();
    return list;
}

export async function getDocumento(data: FiscalGetDocumento): Promise<string> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }    
    const list: string = await res.text();
    console.log(list);
    
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
    const acao = data.aprovar ? "aprovar" : "reprovar";
    const res = await fetch(`${API_BASE}/api/Requisicoes/${acao}/${data.idmov}/${data.codigo_atendimento}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
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