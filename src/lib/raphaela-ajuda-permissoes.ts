import { apiBool } from '@/utils/sessionUser'

export type RaphaelaAjudaArtigo = {
  id: number
  slug: string
  titulo: string
  resumo?: string | null
  mensagem: string
  palavrasChave: string
  rota?: string | null
  rotaAjuda?: string | null
  videoUrl?: string | null
  permissao?: string | null
  ordem: number
  destaque: boolean
}

export function lerUserDataAjuda(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem('userData')
    if (!raw) return null
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** PERMISSAO no SQL: vazio = todos; senão tag alinhada ao perfil. */
export function podeVerArtigoAjuda(permissao: string | null | undefined, u: Record<string, unknown> | null): boolean {
  const p = (permissao ?? '').trim().toLowerCase()
  if (!p || p === 'todos') return true
  if (!u) return true
  if (apiBool(u.admin) || apiBool(u.ADMIN)) return true

  switch (p) {
    case 'documentos':
      return apiBool(u.documentos) || apiBool(u.DOCUMENTOS)
    case 'rdv':
      return apiBool(u.rdv) || apiBool(u.RDV)
    case 'comunicados':
      return apiBool(u.comunicados) || apiBool(u.COMUNICADOS)
    case 'docusign':
      return apiBool(u.docusign) || apiBool(u.DOCUSIGN) || apiBool(u.financeiro) || apiBool(u.FINANCEIRO)
    case 'bordero':
      return apiBool(u.bordero) || apiBool(u.BORDERO)
    case 'config_alcadas':
      return apiBool(u.config_alcadas) || apiBool(u.CONFIG_ALCADAS)
    case 'ccusto':
      return apiBool(u.ccusto) || apiBool(u.CCUSTO)
    case 'admin':
      return false
    default:
      return true
  }
}

export function filtrarArtigosPorPermissao(
  artigos: RaphaelaAjudaArtigo[],
  u: Record<string, unknown> | null
): RaphaelaAjudaArtigo[] {
  return artigos.filter((a) => podeVerArtigoAjuda(a.permissao, u))
}
