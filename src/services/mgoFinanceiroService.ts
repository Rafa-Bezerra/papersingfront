import { CentroDeCusto, ContaFinanceira } from "@/types/Carrinho";
import { MgoFinanceiro, UsuarioCcusto } from "@/types/MgoFinanceiro";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Contas";
const elemento_singular = "conta";
const elemento_plural = "contas";

export async function getAllCentrosDeCusto(): Promise<CentroDeCusto[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/centrosdecusto`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar centros de custo: ${msg}`);
    }
    const list: CentroDeCusto[] = await res.json();
    return list;
}

export async function getAllContasFinanceiras(): Promise<ContaFinanceira[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/contasfinanceiras`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: ContaFinanceira[] = await res.json();
    return list;
}

export async function getAll(): Promise<MgoFinanceiro[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: MgoFinanceiro[] = await res.json();
    return list;
}

export async function createElement(data: MgoFinanceiro): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteElement(data: MgoFinanceiro): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/delete`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function getUsuariosCentrosDeCusto(data: CentroDeCusto): Promise<UsuarioCcusto[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar centros de custo: ${msg}`);
    }
    const list: UsuarioCcusto[] = await res.json();
    return list;
}

export async function createUsuario(data: UsuarioCcusto): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios/create`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function deleteUsuario(data: UsuarioCcusto): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios/delete`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export type { CentroDeCusto, ContaFinanceira, MgoFinanceiro, UsuarioCcusto }