/**
 * Aprovador usado em:
 * - Aprovador Gestão Pessoas (Contratos + Pagamentos G. Pessoas): mesma lista de aprovadores.
 * - Aprovador PG Impostos (Pagamentos Impostos): lista separada no backend.
 * Alçadas por valor: até 10k (Gestão RH/GAF), até 200k (Dir. Unidade), até 1M (Dir. Holding), acima (Dir. Presidente).
 * BACKEND: usuario = codusuario (string). GAF/Diretor da Unidade são POR UNIDADE; manter escopo por unidade para todas as unidades.
 */
export type AprovadorGestaoPessoas = {
  id: number
  usuario: string
  cargo: string
  valor_inicial: number
  valor_final: number
  nivel: number
}
