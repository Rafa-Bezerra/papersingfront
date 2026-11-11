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

export type CcUsuarioMatrizLinha = {
    ccusto: string
    custo: string
    usuario: string
    nome: string
    diretoria: string
}

export type CcUsuarioMatrizResposta = {
    unidade: string
    linhas: CcUsuarioMatrizLinha[]
    total_linhas: number
    total_centros: number
}

export async function getMatrizUsuariosCentroCusto(): Promise<CcUsuarioMatrizResposta> {
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios-cc/matriz`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao exportar vínculos CC × usuário: ${msg}`);
    }
    return res.json();
}

export type CcUsuarioComparacaoLinha = {
    ccusto: string
    custo: string
    diretoria: string
    obrigatorios: { usuario: string; presente: boolean }[]
    completo: boolean
}

export type CcUsuarioComparacaoResposta = {
    ancora: string
    unidade: string
    obrigatorios: string[]
    linhas: CcUsuarioComparacaoLinha[]
    resumo: {
        total_com_ancora: number
        total_ok: number
        total_incompletos: number
        faltando_por_obrigatorio: Record<string, number>
    }
}

export async function getComparacaoUsuariosCentroCusto(
    ancora: string,
    obrigatorios: string[]
): Promise<CcUsuarioComparacaoResposta> {
    const qs = new URLSearchParams({
        ancora: ancora.trim(),
        obrigatorios: obrigatorios.join(','),
    });
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios-cc/comparacao?${qs.toString()}`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} na comparação de centros de custo: ${msg}`);
    }
    return res.json();
}

export type CcContaComparacaoLinha = {
    ccusto: string
    custo: string
    diretoria: string
    obrigatorios: { conta: string; presente: boolean }[]
    completo: boolean
}

export type CcContaComparacaoResposta = {
    ancora: string
    modo: 'conta' | 'cc'
    unidade: string
    obrigatorios: string[]
    linhas: CcContaComparacaoLinha[]
    resumo: {
        total_com_ancora: number
        total_ok: number
        total_incompletos: number
        faltando_por_obrigatorio: Record<string, number>
    }
}

export type CcContaMatrizLinha = {
    ccusto: string
    custo: string
    diretoria: string
    conta: string
    conta_nome: string
}

export type CcContaMatrizResposta = {
    unidade: string
    linhas: CcContaMatrizLinha[]
    total_linhas: number
    total_centros: number
}

export async function getComparacaoCcConta(
    ancora: string,
    obrigatorios: string[],
    modo: 'conta' | 'cc'
): Promise<CcContaComparacaoResposta> {
    const qs = new URLSearchParams({
        ancora: ancora.trim(),
        obrigatorios: obrigatorios.join(','),
        modo,
    });
    const res = await fetch(`${API_BASE}/api/${caminho}/cc-conta/comparacao?${qs.toString()}`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} na comparação CC × conta: ${msg}`);
    }
    return res.json();
}

export async function getMatrizCcConta(): Promise<CcContaMatrizResposta> {
    const res = await fetch(`${API_BASE}/api/${caminho}/cc-conta/matriz`, { headers: headers() });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao exportar matriz CC × conta: ${msg}`);
    }
    return res.json();
}

export async function getContasVinculadasAoCentro(ccusto: string): Promise<MgoFinanceiro[]> {
    const cc = ccusto.trim();
    const qs = new URLSearchParams({ ccusto: cc });
    const res = await fetch(`${API_BASE}/api/${caminho}/cc-conta/por-centro?${qs.toString()}`, { headers: headers() });
    if (res.ok) return res.json();
    const all = await getAll();
    return all.filter((l) => l.centro_custo.trim().toLowerCase() === cc.toLowerCase());
}

/** Tipos gravados em AUDIT_LOG (histórico Admin e relatório de usuários). */
export type CcPlanilhaAuditoriaTipo =
    | 'cc_usuarios_matriz'
    | 'cc_usuarios_comparacao'
    | 'cc_usuarios_comparacao_marcados'
    | 'cc_conta_matriz'
    | 'cc_conta_centro'
    | 'cc_conta_comparacao'
    | 'cc_conta_comparacao_marcados';

/** Registra quem baixou planilha (não bloqueia a tela se a API falhar). */
export async function registrarExportacaoPlanilhaCentrosCustos(tipo: CcPlanilhaAuditoriaTipo, detalhe?: string) {
    try {
        const res = await fetch(`${API_BASE}/api/${caminho}/auditoria/planilha`, {
            method: 'POST',
            headers: { ...headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, detalhe: detalhe?.trim() || undefined }),
        });
        if (!res.ok && res.status !== 204) {
            await res.text();
        }
    } catch {
        /* auditoria opcional */
    }
}

export type CcHistoricoEvento = {
    codusuario: string
    unidade: string
    dataHora: string
    titulo: string
    detalhe: string
    referencia?: string | null
}

export type CcHistoricoResposta = {
    eventos: CcHistoricoEvento[]
    total: number
}

export async function getCentrosCustosHistorico(params: {
    usuario?: string
    unidade?: string
    de?: string
    ate?: string
    top?: number
}): Promise<CcHistoricoResposta> {
    const qs = new URLSearchParams()
    if (params.usuario?.trim()) qs.set('usuario', params.usuario.trim())
    if (params.unidade?.trim()) qs.set('unidade', params.unidade.trim())
    if (params.de) qs.set('de', params.de)
    if (params.ate) qs.set('ate', params.ate)
    if (params.top) qs.set('top', String(params.top))
    const url = `${API_BASE}/api/HistoricoUsuario/centros-custo?${qs.toString()}`
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(`Erro ${res.status} ao consultar histórico de centros de custo: ${msg}`)
    }
    const data = (await res.json()) as Record<string, unknown>
    const raw = (data.eventos ?? data.Eventos ?? []) as Record<string, unknown>[]
    return {
        total: Number(data.total ?? data.Total ?? raw.length),
        eventos: raw.map((r) => ({
            codusuario: String(r.codusuario ?? r.Codusuario ?? ''),
            unidade: String(r.unidade ?? r.Unidade ?? ''),
            dataHora: String(r.dataHora ?? r.DataHora ?? ''),
            titulo: String(r.titulo ?? r.Titulo ?? ''),
            detalhe: String(r.detalhe ?? r.Detalhe ?? ''),
            referencia: (r.referencia ?? r.Referencia) as string | null | undefined,
        })),
    }
}

export type CcUsuarioLoteRemoverResultado = {
    usuario: string
    removidos: number
    centros_solicitados: number
    centros_sem_vinculo?: string[]
}

export async function removerUsuariosCcEmLote(data: {
    usuario: string
    ccustos: string[]
    motivo?: string
}): Promise<CcUsuarioLoteRemoverResultado> {
    const res = await fetch(`${API_BASE}/api/${caminho}/usuarios/lote/remover`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(`Erro ${res.status} ao remover vínculos: ${msg}`)
    }
    return res.json()
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