/**
 * Contratos Gestão de Pessoas (módulo 1).
 * BACKEND: retornar da view/tabela que já possui a coluna STATUS_RESTRICAO.
 * - status_restricao = NULL  → fluxo normal
 * - status_restricao = 'RESTRITO' → contrato vai para este módulo (gestão de pessoas / GAFs)
 * Hierarquia aprovação: 1º GAF, 2º Fabrício, 3º Diretor Unidade, 4º Gomes, 5º Lopes (conforme alçadas).
 * Deve funcionar para TODAS AS UNIDADES (listagem por unidade ou agregada).
 */
export type ContratoGestaoPessoas = {
  id?: number
  sao?: string
  valor_total?: number
  codigo_fornecedor?: string
  nome_fornecedor?: string
  /** NULL ou 'RESTRITO' – quando RESTRITO o contrato entra no fluxo deste módulo */
  status_restricao?: string | null
  status_movim?: string
}
