export const UNIDADE_PROJETOS = "WAY CSC";
export const EMPRESA_PROJETOS = "57.582.342";

export function unidadePermiteProjetos(unidade?: string | null): boolean {
  return String(unidade ?? "").trim().toUpperCase() === UNIDADE_PROJETOS;
}

export function empresaPermiteProjetos(empresa?: string | null): boolean {
  return String(empresa ?? "").trim() === EMPRESA_PROJETOS;
}
