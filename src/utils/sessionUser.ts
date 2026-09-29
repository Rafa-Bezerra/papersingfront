import { configMenuPayloadFromUsuario } from '@/lib/configuracoes-permissoes'
import type { Usuario } from '@/types/Usuario'

/** Evento disparado após atualizar `userData` na sessão (menu lateral reage). */
export const USERDATA_UPDATED_EVENT = 'papersign-userdata-updated'

function apiBool(v: unknown): boolean {
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v == null) return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === '1') return true
    if (s === 'false' || s === '0' || s === '') return false
  }
  return Boolean(v)
}

/** API ASP.NET (camelCase) pode enviar `cONTROLE_MEDICAO` em vez de `controle_medicao`. */
export function readControleMedicaoFromApi(apiData: Record<string, unknown>): boolean {
  const keys = [
    'controle_medicao',
    'CONTROLE_MEDICAO',
    'cONTROLE_MEDICAO',
    'controle_MEDICAO',
    'controleMedicao',
  ]
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(apiData, k)) {
      return apiBool(apiData[k])
    }
  }
  for (const [k, v] of Object.entries(apiData)) {
    if (k.replace(/_/g, '').toLowerCase() === 'controlemedicao') {
      return apiBool(v)
    }
  }
  return false
}

const CSC_EMPRESA = '57.582.342'

/** CSC: menu de cópia de permissões e listagem multi-base. */
export function isWayCscSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem('userData')
    if (raw) {
      const u = JSON.parse(raw) as Record<string, unknown>
      const unit = String(u.unidade ?? u.UNIDADE ?? '').trim().toUpperCase()
      if (unit === 'WAY CSC') return true
      const emp = String(u.empresa ?? u.EMPRESA ?? '').trim()
      if (emp === CSC_EMPRESA) return true
    }
  } catch {
    /* ignore */
  }
  try {
    const token = sessionStorage.getItem('authToken')
    if (!token) return false
    const part = token.split('.')[1]
    if (!part) return false
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<
      string,
      unknown
    >
    const surname =
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] ??
      payload.unidade ??
      payload.Unidade
    return String(surname ?? '').trim().toUpperCase() === 'WAY CSC'
  } catch {
    return false
  }
}

/** Atualiza flags no sessionStorage se o usuário editado for o logado. */
export function syncSessionUserFromUsuario(saved: Usuario): void {
  if (typeof window === 'undefined') return
  try {
    const raw = sessionStorage.getItem('userData')
    if (!raw) return
    const session = JSON.parse(raw) as Record<string, unknown>
    const same =
      Number(session.sequencial ?? session.SEQUENCIAL) === Number(saved.sequencial) ||
      String(session.codusuario ?? session.CODUSUARIO ?? '')
        .trim()
        .toLowerCase() === String(saved.codusuario ?? '').trim().toLowerCase()
    if (!same) return

    const merged = {
      ...session,
      admin: saved.admin,
      documentos: saved.documentos,
      bordero: saved.bordero,
      comunicados: saved.comunicados,
      rdv: saved.rdv,
      externo: saved.externo,
      restrito: saved.restrito,
      ccusto: saved.ccusto,
      administrativo: saved.administrativo,
      solicitante: saved.solicitante,
      fiscal: saved.fiscal,
      pagamento_rh: saved.pagamento_rh,
      pagamento_impostos: saved.pagamento_impostos,
      gestao_pessoas: saved.gestao_pessoas,
      financeiro: saved.financeiro,
      docusign: saved.docusign,
      projetos: saved.projetos,
      contratos: saved.contratos,
      financeiro_totvs: saved.financeiro_totvs,
      receitas: saved.receitas,
      extrato_gestor: saved.extrato_gestor,
      controle_medicao: saved.controle_medicao,
      ...configMenuPayloadFromUsuario(saved),
    }
    sessionStorage.setItem('userData', JSON.stringify(merged))
    window.dispatchEvent(new Event(USERDATA_UPDATED_EVENT))
  } catch {
    /* ignore */
  }
}

export { apiBool }
