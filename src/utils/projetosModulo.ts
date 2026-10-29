export const UNIDADE_PROJETOS = "WAY CSC";
export const EMPRESA_PROJETOS = "57.582.342";

export function unidadePermiteProjetos(unidade?: string | null): boolean {
  return String(unidade ?? "").trim().toUpperCase() === UNIDADE_PROJETOS;
}

/** Nome para exibir, sem o sufixo " [cronograma:...]" que a integração grava no NOME. */
export function nomeProjetoExibicao(nome?: string | null): string {
  return String(nome ?? "").replace(/\s*\[cronograma:[^\]]*\]\s*$/i, "");
}

export function empresaPermiteProjetos(empresa?: string | null): boolean {
  return String(empresa ?? "").trim() === EMPRESA_PROJETOS;
}
