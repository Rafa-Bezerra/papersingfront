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

export type RmCentroCustoLookup = {
    rm: Array<{ codigo: string; nome: string; ativo: string; codcontager: string }>;
    papersign: { codigo: string; nome: string; ativo: string; sequencial: string } | null;
    unidade: string;
};

export type RmContaLookup = {
    rm: Array<{
        codcoligada: number;
        codigo: string;
        descricao: string;
        reduzido: string;
        analitica: string;
        inativa: string;
    }>;
    papersign: { codigo: string; descricao: string } | null;
    unidade: string;
};

async function readErrorMessage(res: Response): Promise<string> {
    const text = await res.text();
    try {
        const json = JSON.parse(text);
        return json.message || json.title || text;
    } catch {
        return text || `Erro ${res.status}`;
    }
}

export async function buscarCentroCustoRm(codigo: string): Promise<RmCentroCustoLookup> {
    const res = await fetch(
        `${API_BASE}/api/${caminho}/centrosdecusto/rm?codigo=${encodeURIComponent(codigo)}`,
        { headers: headers() }
    );
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return res.json();
}

export async function cadastrarCentroCusto(codigo: string): Promise<{ message: string; codigo: string; nome: string; acao: string }> {
    const res = await fetch(`${API_BASE}/api/${caminho}/centrosdecusto/cadastrar`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ codigo }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return res.json();
}

export async function buscarContaContabilRm(codigo: string, codcoligada?: number): Promise<RmContaLookup> {
    const qs = new URLSearchParams({ codigo });
    if (codcoligada != null) qs.set("codcoligada", String(codcoligada));
    const res = await fetch(`${API_BASE}/api/${caminho}/contasfinanceiras/rm?${qs}`, { headers: headers() });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return res.json();
}

export async function cadastrarContaContabil(data: {
    codigo: string;
    codcoligada?: number;
    centro_custo?: string;
}): Promise<{ message: string; codigo: string; descricao: string; acao: string; vinculo?: unknown }> {
    const res = await fetch(`${API_BASE}/api/${caminho}/contasfinanceiras/cadastrar`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return res.json();
}

export type { CentroDeCusto, ContaFinanceira, MgoFinanceiro, UsuarioCcusto }