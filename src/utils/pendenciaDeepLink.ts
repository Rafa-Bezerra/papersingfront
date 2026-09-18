"use client";

import { useEffect, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";

export const PENDENCIA_ID_PARAM = "id";

/** Lê o id da pendência na URL (?id= ou legado ?idmov=). */
export function getPendenciaIdFromSearchParams(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): number | null {
  const raw = searchParams.get(PENDENCIA_ID_PARAM) ?? searchParams.get("idmov");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Remove o id da URL após abrir o item (evita reabrir ao atualizar). */
export function clearPendenciaIdFromUrl(
  router: AppRouterInstance,
  searchParams: ReadonlyURLSearchParams
): void {
  const sp = new URLSearchParams(searchParams.toString());
  sp.delete(PENDENCIA_ID_PARAM);
  sp.delete("idmov");
  const qs = sp.toString();
  router.replace(qs ? `?${qs}` : "?", { scroll: false });
}

/** Aplica filtro de pendências vindas do gestor (?status= ou ?filtro=pendentes). */
export function isPendentesFromUrl(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): boolean {
  const status = searchParams.get("status") ?? searchParams.get("filtro") ?? "";
  return status === "pendentes";
}

/**
 * Após carregar a lista, abre automaticamente o item indicado na URL
 * e mantém as demais pendências visíveis na tabela.
 */
export function usePendenciaDeepLink<T>(
  results: T[],
  ready: boolean,
  searchParams: ReadonlyURLSearchParams,
  router: AppRouterInstance,
  getId: (item: T) => number | null | undefined,
  onOpen: (item: T) => void | Promise<void>
): void {
  const openedRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  const getIdRef = useRef(getId);
  const pendingId = getPendenciaIdFromSearchParams(searchParams);

  onOpenRef.current = onOpen;
  getIdRef.current = getId;

  useEffect(() => {
    openedRef.current = false;
  }, [pendingId]);

  useEffect(() => {
    if (!ready || !pendingId || openedRef.current) return;

    const item = results.find((r) => getIdRef.current(r) === pendingId);
    if (!item) return;

    openedRef.current = true;

    void Promise.resolve(onOpenRef.current(item)).finally(() => {
      clearPendenciaIdFromUrl(router, searchParams);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-pendencia-id="${pendingId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [ready, pendingId, results, router, searchParams]);
}
