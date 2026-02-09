/**
 * =============================================================================
 * SERVIÇO: Pagamentos G. Pessoas + Pagamentos Impostos + Aprovadores PG Impostos
 * =============================================================================
 * Usado pelas telas:
 *   - /pagamentos-gestao-pessoas (Pagamentos G. Pessoas)
 *   - /pagamentos-impostos (Pagamentos Impostos)
 *
 * BACKEND - Endpoints a implementar (base URL: API_BASE, ex: http://localhost:5170):
 *
 * --- Pagamentos G. Pessoas (folha) ---
 * 1) GET /api/PagamentosGestaoPessoas
 *    - Filtro: STATUS_LANCAMENTO ou WF_STATUS = 'EM ABERTO' e TIPO_DOCUMENTO = 'PAGAMENTO_RH'.
 *    - Tipos: salários, férias, 13º, rescisões, FGTS, INSS, IRRF folha, etc.
 *    - Hierarquia aprovação: 1º Fabrício Leme, 2º GAF Unidade, 3º Diretor Unidade, 4º Gomes, 5º Lopes.
 *    - Retorne array de LancamentoPagamento (ver type em types/LancamentoPagamento.ts).
 *
 * --- Pagamentos Impostos ---
 * 2) GET /api/PagamentosImpostos
 *    - Filtro: EM ABERTO e TIPO_DOCUMENTO = tipo Impostos (IRF, ISS, PIS, COFINS, etc).
 *    - Fonte sugerida: view Vw_LAN_FINANCEIRO_262 (ou equivalente).
 *    - Hierarquia: 1º Gerson Martiusi, 2º GAF, 3º Diretor Unidade, 4º Gomes, 5º Lopes.
 *
 * --- Aprovadores PG Impostos (lista separada da Gestão Pessoas) ---
 * 3) GET  /api/AprovadoresPgImpostos     → lista { id, usuario, cargo, valor_inicial, valor_final, nivel }
 * 4) POST /api/AprovadoresPgImpostos    → body: { usuario, cargo, valor_inicial, valor_final, nivel }
 * 5) PUT  /api/AprovadoresPgImpostos/:id → body: objeto completo do aprovador
 * 6) DELETE /api/AprovadoresPgImpostos/:id
 *
 * --- Regra pós-aprovação (ambos os módulos de pagamento) ---
 * Após aprovação de um item, executar:
 *   UPDATE Corpore_way262 SET FLAN.CAMPOALFAOP3 = 'F' WHERE IDLAN = (id da aprovação)
 * Legenda: F = Aprovado, A = Em andamento (primeira assinatura), C = Cancelado/Reprovado.
 *
 * Relatório: "Autorização de Pagamento Financeiro" para assinatura (FINANCEIRO, CONTROLADORIA, DIRETORIA).
 * Autenticação: header Authorization Bearer (ver headers() em utils/constants).
 *
 * IMPORTANTE: Para TODAS AS UNIDADES (WAY 112, 153, 262, 306, 364, etc.).
 * - Listagens de pagamentos: todas as unidades ou filtrar por unidade do usuário.
 * - UPDATE FLAN.CAMPOALFAOP3: executar na base da UNIDADE do lançamento (ex.: Corpore_way262, Corpore_way112).
 * =============================================================================
 */

import { API_BASE, headers } from "@/utils/constants"
import type { LancamentoPagamento } from "@/types/LancamentoPagamento"
import type { AprovadorGestaoPessoas } from "@/types/AprovadorGestaoPessoas"

/** Pagamentos de folha: EM ABERTO + PAGAMENTO_RH. Backend: todas as unidades (ou unidade do usuário). Se API 404, retorna []. */
export async function getPagamentosGestaoPessoas(): Promise<LancamentoPagamento[]> {
  const res = await fetch(`${API_BASE}/api/PagamentosGestaoPessoas`, { headers: headers() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Pagamentos de impostos: EM ABERTO + tipo Impostos. Backend: todas as unidades. Fonte: view por unidade (ex. Vw_LAN_FINANCEIRO_262). */
export async function getPagamentosImpostos(): Promise<LancamentoPagamento[]> {
  const res = await fetch(`${API_BASE}/api/PagamentosImpostos`, { headers: headers() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Lista aprovadores do fluxo Pagamentos Impostos (diferente da lista Gestão Pessoas). */
export async function getAprovadoresPgImpostos(): Promise<AprovadorGestaoPessoas[]> {
  const res = await fetch(`${API_BASE}/api/AprovadoresPgImpostos`, { headers: headers() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Cria aprovador PG Impostos. */
export async function createAprovadorPgImpostos(
  data: Omit<AprovadorGestaoPessoas, "id"> & { id?: number }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/AprovadoresPgImpostos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}

/** Atualiza aprovador PG Impostos. */
export async function updateAprovadorPgImpostos(
  id: number,
  data: AprovadorGestaoPessoas
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/AprovadoresPgImpostos/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}

/** Remove aprovador PG Impostos. */
export async function deleteAprovadorPgImpostos(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/AprovadoresPgImpostos/${id}`, {
    method: "DELETE",
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}
