import {
  PendenciaGestorResumoUnidade,
  PendenciaGestorResumoUnidadeTipo,
  PendenciasGestorResponse,
} from "@/types/Pendencias";

import { API_BASE, fetchJson, PENDENCIAS_TIMEOUT_MS } from "@/utils/constants";

import { deduplicarPendencias } from "@/utils/pendenciaItemKey";



const CACHE_MS = 45_000;

const cache = new Map<string, { at: number; data: PendenciasGestorResponse }>();

const inflight = new Map<string, Promise<PendenciasGestorResponse>>();

export const PENDENCIAS_ATUALIZADAS_EVENT = "papersign-pendencias-atualizadas";
export const PENDENCIAS_INVALIDAR_EVENT = "papersign-pendencias-invalidar";

function notificarPendenciasAtualizadas(data: PendenciasGestorResponse): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PENDENCIAS_ATUALIZADAS_EVENT, { detail: data })
  );
}



/** Garante array de { unidade, total } — evita crash ao iterar resposta da API. */

/** Somente unidades com pendências (oculta bases zeradas / sem acesso). */
export function unidadesComPendencias(
  porUnidade: PendenciaGestorResumoUnidade[]
): PendenciaGestorResumoUnidade[] {
  return porUnidade
    .filter((u) => Boolean(u.unidade) && u.total > 0)
    .sort((a, b) => b.total - a.total);
}

function normalizePorUnidadeTipo(raw: unknown): PendenciaGestorResumoUnidadeTipo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const unidade = String(o.unidade ?? o.Unidade ?? "").trim();
      const tipo = String(o.tipo ?? o.Tipo ?? "").trim();
      const total = Number(o.total ?? o.Total ?? 0);
      if (!unidade || !tipo || total <= 0) return null;
      return { unidade, tipo, total };
    })
    .filter((x): x is PendenciaGestorResumoUnidadeTipo => x !== null);
}

/** Contagem real por tipo (opcionalmente filtrada por unidade). */
function eqUnidade(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function tiposComPendencias(
  porUnidadeTipo: PendenciaGestorResumoUnidadeTipo[],
  filtroUnidade?: string
): [string, number][] {
  const map = new Map<string, number>();
  for (const row of porUnidadeTipo) {
    if (filtroUnidade && !eqUnidade(row.unidade, filtroUnidade)) continue;
    map.set(row.tipo, (map.get(row.tipo) ?? 0) + row.total);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export function normalizarPorUnidade(

  raw: unknown,

  fallbackItens: { unidade: string }[] = []

): PendenciaGestorResumoUnidade[] {

  if (Array.isArray(raw) && raw.length > 0) {

    return raw

      .map((u) => {

        if (!u || typeof u !== "object") return null;

        const o = u as Record<string, unknown>;

        const unidade = String(o.unidade ?? o.Unidade ?? "").trim();

        const total = Number(o.total ?? o.Total ?? 0);

        if (!unidade) return null;

        return { unidade, total };

      })

      .filter((x): x is PendenciaGestorResumoUnidade => x !== null);

  }



  const map = new Map<string, number>();

  for (const item of fallbackItens) {

    if (!item.unidade) continue;

    map.set(item.unidade, (map.get(item.unidade) ?? 0) + 1);

  }

  return Array.from(map.entries()).map(([unidade, total]) => ({ unidade, total }));

}



function normalizeItem(raw: Record<string, unknown>) {

  return {

    unidade: String(raw.unidade ?? raw.Unidade ?? ""),

    tipo: String(raw.tipo ?? raw.Tipo ?? ""),

    titulo: String(raw.titulo ?? raw.Titulo ?? ""),

    referencia: (raw.referencia ?? raw.Referencia ?? null) as string | null,

    id: (raw.id ?? raw.Id ?? null) as number | null,

    valor: (raw.valor ?? raw.Valor ?? null) as number | null,

    data: (raw.data ?? raw.Data ?? null) as string | null,

    rota: String(raw.rota ?? raw.Rota ?? "/home"),

    filtro: (raw.filtro ?? raw.Filtro ?? null) as string | null,

    detalhe: (raw.detalhe ?? raw.Detalhe ?? null) as string | null,

    codigoAtendimento: (raw.codigoAtendimento ?? raw.CodigoAtendimento ?? null) as number | null,

  };

}



function normalizeResponse(raw: Record<string, unknown>): PendenciasGestorResponse {

  const itensRaw = (raw.itens ?? raw.Itens ?? []) as Record<string, unknown>[];

  const itens = deduplicarPendencias(itensRaw.map(normalizeItem));



  const porUnidade = normalizarPorUnidade(raw.porUnidade ?? raw.PorUnidade, itens);



  const totalApi = Number(raw.total ?? raw.Total ?? 0);

  const totalPorUnidade = porUnidade.reduce((s, u) => s + u.total, 0);



  const porUnidadeTipo = normalizePorUnidadeTipo(raw.porUnidadeTipo ?? raw.PorUnidadeTipo);

  return {

    total: Math.max(totalApi, totalPorUnidade),

    totalExibidos: Number(raw.totalExibidos ?? raw.TotalExibidos ?? itens.length),

    itens,

    porUnidade,

    porUnidadeTipo,

  };

}



export function invalidatePendenciasGestorCache(): void {
  cache.clear();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDENCIAS_INVALIDAR_EVENT));
  }
}



export async function getPendenciasGestor(

  limitePorTipo = 8,

  opts?: { force?: boolean; unidade?: string | null; tipo?: string | null }

): Promise<PendenciasGestorResponse> {

  const limite = Math.min(30, Math.max(1, limitePorTipo));

  const unidade = opts?.unidade?.trim() || "";
  const tipo = opts?.tipo?.trim() || "";
  const key = `${limite}:${unidade || "all"}:${tipo || "all"}`;



  const pending = inflight.get(key);
  if (pending) return pending;

  if (!opts?.force) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  }



  const qs = new URLSearchParams({ limitePorTipo: String(limite) });
  if (unidade) qs.set("unidade", unidade);
  if (tipo) qs.set("tipo", tipo);

  const request = fetchJson<Record<string, unknown>>(

    `${API_BASE}/api/Pendencias/gestor?${qs.toString()}`,

    {},

    "Erro ao carregar pendências",

    PENDENCIAS_TIMEOUT_MS

  )

    .then(normalizeResponse)

    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      if (!unidade && !tipo) notificarPendenciasAtualizadas(data);
      return data;
    })

    .finally(() => {

      inflight.delete(key);

    });



  inflight.set(key, request);

  return request;

}


