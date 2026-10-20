import { Alcada } from "@/types/Alcada";
import { API_BASE, headers } from "@/utils/constants";
import { erroDaResposta } from "@/utils/avisoApi";
const caminho = "Alcadas";
const elemento_singular = "alçada";
const elemento_plural = "alçadas";

export async function getAll(): Promise<Alcada[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Alcada[] = await res.json();
    return list;
}

export async function getElementById(id: number): Promise<Alcada> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { headers: headers(), });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_singular}: ${msg}`);
    }
    const apiData: Alcada = await res.json();
    return apiData;
}

export async function createElement(data: Alcada): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) throw await erroDaResposta(res, `criar ${elemento_singular}`);
}
  
export async function updateElement(data: Alcada): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/editar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) throw await erroDaResposta(res, `atualizar ${elemento_singular}`);
}
  
export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export type AlcadaLotePrevia = {
    id: number,
    centro_custo: string,
    centro_custo_nome: string,
    aprovadores_nivel: string[]
}

export type AlcadaLoteAprovador = {
    usuario: string,
    cargo: string,
    nivel: number,
    valor_inicial: number,
    valor_final: number,
    ids_alcada: number[]
}

export type AlcadaLoteResultado = {
    usuario: string,
    incluidos: number,
    ja_existiam: number,
    total: number,
    ids_incluidos: number[]
}

export async function getPreviaLote(busca: string, nivel: number): Promise<{ centros: AlcadaLotePrevia[], limitado: boolean }> {
    const qs = new URLSearchParams({ busca, nivel: String(nivel) })
    const res = await fetch(`${API_BASE}/api/${caminho}/lote/previa?${qs.toString()}`, { headers: headers() });
    if (!res.ok) throw await erroDaResposta(res, `buscar centros de custo`);
    return res.json();
}

export async function incluirAprovadorEmLote(data: AlcadaLoteAprovador): Promise<AlcadaLoteResultado> {
    const res = await fetch(`${API_BASE}/api/${caminho}/lote/aprovador`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) throw await erroDaResposta(res, `incluir aprovador nos centros de custo`);
    return res.json();
}

export type { Alcada }