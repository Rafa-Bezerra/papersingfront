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

export type AlcadaPorUsuarioLinha = {
    id: number
    id_alcada: number
    centro_custo: string
    centro_custo_nome: string
    usuario: string
    cargo: string
    nivel: number
    valor_inicial: number
    valor_final: number
    unidade: string
    substituto?: string | null
    usuario_original?: string | null
    qtd_no_nivel: number
    situacao: string
    visivel_na_lista: boolean
}

export type AlcadaPorUsuarioResposta = {
    usuario: string
    unidade: string
    linhas: AlcadaPorUsuarioLinha[]
    resumo: {
        total_linhas: number
        total_centros_distintos: number
        por_nivel: { nivel: number; quantidade: number }[]
    }
}

export async function getAlcadasPorUsuario(usuario: string, unidade?: string): Promise<AlcadaPorUsuarioResposta> {
    const qs = new URLSearchParams({ usuario: usuario.trim() })
    if (unidade?.trim()) qs.set('unidade', unidade.trim())
    const res = await fetch(`${API_BASE}/api/${caminho}/por-usuario?${qs.toString()}`, { headers: headers() })
    if (!res.ok) throw await erroDaResposta(res, 'consultar alçadas por usuário')
    return res.json()
}

export type AlcadaLoteRemoverModo = 'usuario' | 'todos_nivel' | 'todos_centro'

export type AlcadaLoteRemoverAprovador = {
    modo?: AlcadaLoteRemoverModo
    usuario: string
    unidade?: string
    ids_aprovador: number[]
    motivo?: string
}

export type AlcadaLoteRemoverAprovadorResultado = {
    usuario: string
    unidade: string
    modo: AlcadaLoteRemoverModo
    removidos: number
    centros_referencia: number
    ids_removidos: number[]
    itens: { id_aprovador: number; centro_custo: string; nivel: number }[]
    motivo?: string | null
}

export type AlcadaHistoricoEvento = {
    codusuario: string
    unidade: string
    dataHora: string
    titulo: string
    detalhe: string
    referencia?: string | null
}

export type AlcadaHistoricoResposta = {
    eventos: AlcadaHistoricoEvento[]
    total: number
}

export async function getAlcadasHistorico(params: {
    usuario?: string
    unidade?: string
    de?: string
    ate?: string
    top?: number
}): Promise<AlcadaHistoricoResposta> {
    const qs = new URLSearchParams()
    if (params.usuario?.trim()) qs.set('usuario', params.usuario.trim())
    if (params.unidade?.trim()) qs.set('unidade', params.unidade.trim())
    if (params.de) qs.set('de', params.de)
    if (params.ate) qs.set('ate', params.ate)
    if (params.top) qs.set('top', String(params.top))
    const res = await fetch(`${API_BASE}/api/${caminho}/historico?${qs.toString()}`, { headers: headers() })
    if (!res.ok) throw await erroDaResposta(res, 'consultar histórico de alçadas')
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

export async function removerAprovadorEmLote(data: AlcadaLoteRemoverAprovador): Promise<AlcadaLoteRemoverAprovadorResultado> {
    const res = await fetch(`${API_BASE}/api/${caminho}/lote/remover-aprovador`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
    })
    if (!res.ok) throw await erroDaResposta(res, 'remover aprovador das alçadas')
    return res.json()
}

export type { Alcada }