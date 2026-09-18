import { PendenciaGestorItem } from "@/types/Pendencias";

/** Chave estável e única para listas React (inclui idx para evitar colisão). */
export function pendenciaItemKey(item: PendenciaGestorItem, idx: number): string {
  const id = item.id ?? `r${idx}`;
  const ref = item.referencia ? `-${item.referencia}` : "";
  return `${item.unidade}-${item.tipo}-${id}${ref}-${idx}`;
}

export function mesmaPendencia(a: PendenciaGestorItem, b: PendenciaGestorItem): boolean {
  return (
    a.unidade === b.unidade &&
    a.tipo === b.tipo &&
    (a.id ?? null) === (b.id ?? null) &&
    (a.referencia ?? "") === (b.referencia ?? "")
  );
}

/** Remove duplicatas (mesma unidade + tipo + id). */
export function deduplicarPendencias(itens: PendenciaGestorItem[]): PendenciaGestorItem[] {
  const vistos = new Set<string>();
  const resultado: PendenciaGestorItem[] = [];

  for (const item of itens) {
    const chave = `${item.unidade}|${item.tipo}|${item.id ?? ""}|${item.referencia ?? ""}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push(item);
  }

  return resultado;
}
