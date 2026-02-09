/**
 * Lançamento de pagamento (usado em Pagamentos G. Pessoas e Pagamentos Impostos).
 * BACKEND: fonte por unidade (ex.: Vw_LAN_FINANCEIRO_262 e equivalente para cada unidade). TODAS AS UNIDADES.
 * - Pagamentos G. Pessoas: filtrar EM ABERTO + TIPO_DOCUMENTO = 'PAGAMENTO_RH'.
 * - Pagamentos Impostos: filtrar EM ABERTO + TIPO_DOCUMENTO = tipo Impostos.
 * Após aprovação: UPDATE na base DA UNIDADE do lançamento: FLAN.CAMPOALFAOP3 = 'F'|'A'|'C'.
 */
export type LancamentoPagamento = {
  id?: number
  idlan?: number
  lancamento?: string
  data_vencimento?: string
  data_prev_baixa?: string
  tributos?: number
  multas?: number
  caucao?: number
  tipo_documento?: string
  status_lancamento?: string
  usuario_criacao?: string
  wf_papersing?: string
  wf_status?: string
  valor_original?: number
  valor_liquido?: number
}
