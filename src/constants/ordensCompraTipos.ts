/** CODTMV do RM usados no módulo Solicitações no PS — não entram na busca de Ordens de compra. */
export const COD_TMV_SOLICITACAO_COMPRA = new Set([
  "1.1.01",
  "1.1.02",
  "1.1.04",
  "1.1.05",
  "1.1.10",
  "1.1.11",
  "1.1.12",
]);

/**
 * Lista enviada ao POST /api/Requisicoes (TIPO_MOVIMENTO IN).
 * Cobre 1.1.01…1.1.99 (exceto solicitação), forma curta 1.1.1…1.1.9 e 1.1.100…199 (RM varia cadastro).
 */
export function codTmvListaOrdensCompraApi(): string[] {
  const seen = new Set<string>();

  for (let n = 1; n <= 99; n++) {
    const padded = `1.1.${String(n).padStart(2, "0")}`;
    if (!COD_TMV_SOLICITACAO_COMPRA.has(padded)) seen.add(padded);
    if (n <= 9) {
      const short = `1.1.${n}`;
      if (!COD_TMV_SOLICITACAO_COMPRA.has(short)) seen.add(short);
    }
  }

  for (let n = 100; n <= 199; n++) {
    seen.add(`1.1.${n}`);
  }

  return Array.from(seen).sort((a, b) => {
    const na = Number(a.split(".").pop() ?? 0);
    const nb = Number(b.split(".").pop() ?? 0);
    return na - nb || a.localeCompare(b);
  });
}
