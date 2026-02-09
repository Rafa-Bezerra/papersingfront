/**
 * =============================================================================
 * SERVIÇO: Contratos Gestão de Pessoas + Aprovadores Gestão Pessoas
 * =============================================================================
 * Usado pelas telas:
 *   - /gestao-pessoas (Contratos Gestão de Pessoas)
 *   - /pagamentos-gestao-pessoas (Pagamentos G. Pessoas) — apenas getAprovadores/create/update/delete
 *
 * BACKEND - Endpoints a implementar (base URL: API_BASE, ex: http://localhost:5170):
 *
 * 1) GET /api/ContratosGestaoPessoas
 *    - Retorna lista de contratos com coluna STATUS_RESTRICAO (NULL ou 'RESTRITO').
 *    - Contratos RESTRITO são os que entram no fluxo de gestão de pessoas/GAFs.
 *    - Campos esperados: id, sao, valor_total, codigo_fornecedor, nome_fornecedor, status_restricao, status_movim.
 *
 * 2) GET /api/AprovadoresGestaoPessoas
 *    - Retorna lista de aprovadores (usuario, cargo, valor_inicial, valor_final, nivel).
 *    - Mesma lista usada em Contratos e em Pagamentos G. Pessoas.
 *
 * 3) POST /api/AprovadoresGestaoPessoas
 *    - Body: { usuario, cargo, valor_inicial, valor_final, nivel } (id opcional 0 para novo).
 *
 * 4) PUT /api/AprovadoresGestaoPessoas/:id
 *    - Body: { id, usuario, cargo, valor_inicial, valor_final, nivel }.
 *
 * 5) DELETE /api/AprovadoresGestaoPessoas/:id
 *    - Remove o aprovador pelo id.
 *
 * Autenticação: header Authorization com Bearer token (ver headers() em utils/constants).
 *
 * IMPORTANTE: Os três módulos devem funcionar para TODAS AS UNIDADES (ex.: WAY 112, 153, 262, 306, 364).
 * - Listagens: retornar dados de todas as unidades ou filtrar por unidade do usuário (token/session).
 * - Aprovadores: GAF da Unidade e Diretor da Unidade são por unidade; manter lista/escopo por unidade.
 * =============================================================================
 */

import { API_BASE, headers } from "@/utils/constants"
import type { ContratoGestaoPessoas } from "@/types/ContratoGestaoPessoas"
import type { AprovadorGestaoPessoas } from "@/types/AprovadorGestaoPessoas"

const BASE = "ContratosGestaoPessoas"
const APROVADORES = "AprovadoresGestaoPessoas"

/** Lista contratos para o módulo Gestão de Pessoas (com STATUS_RESTRICAO). Backend: considerar todas as unidades (ou unidade do usuário). Se API 404, retorna []. */
export async function getContratos(): Promise<ContratoGestaoPessoas[]> {
  const res = await fetch(`${API_BASE}/api/${BASE}`, { headers: headers() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Lista aprovadores do fluxo Gestão Pessoas (usados em Contratos e Pagamentos G. Pessoas). Backend: por unidade (GAF/Diretor da Unidade). */
export async function getAprovadores(): Promise<AprovadorGestaoPessoas[]> {
  const res = await fetch(`${API_BASE}/api/${APROVADORES}`, { headers: headers() })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Cria novo aprovador. Body: usuario (codusuario), cargo, valor_inicial, valor_final, nivel. */
export async function createAprovador(data: Omit<AprovadorGestaoPessoas, "id"> & { id?: number }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${APROVADORES}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}

/** Atualiza aprovador existente. */
export async function updateAprovador(id: number, data: AprovadorGestaoPessoas): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${APROVADORES}/${id}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}

/** Remove aprovador pelo id. */
export async function deleteAprovador(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${APROVADORES}/${id}`, {
    method: "DELETE",
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
}
