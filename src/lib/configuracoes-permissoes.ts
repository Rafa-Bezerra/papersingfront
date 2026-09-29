import { apiBool } from '@/utils/sessionUser'

/** Permissões granulares do menu Configurações (além de admin). */

export type ConfigMenuPermKey =
  | 'config_alcadas'
  | 'config_usuarios'
  | 'config_bordero_aprovadores'
  | 'config_restrito_aprovadores'
  | 'config_fornecedores_restritos'
  | 'config_impostos_aprovadores'
  | 'config_financeiro_aprovadores'
  | 'config_fiscal_aprovadores'
  | 'config_rh_aprovadores'
  | 'config_disparos'
  | 'config_cadastro_externos'
  | 'config_status_pedido'
  | 'ccusto'

export type ConfigMenuSession = {
  admin?: boolean
  unidade?: string
  ccusto?: boolean
  config_alcadas?: boolean
  config_usuarios?: boolean
  config_bordero_aprovadores?: boolean
  config_restrito_aprovadores?: boolean
  config_fornecedores_restritos?: boolean
  config_impostos_aprovadores?: boolean
  config_financeiro_aprovadores?: boolean
  config_fiscal_aprovadores?: boolean
  config_rh_aprovadores?: boolean
  config_disparos?: boolean
  config_cadastro_externos?: boolean
  config_status_pedido?: boolean
}

const ROUTE_PERM: Record<string, ConfigMenuPermKey> = {
  '/alcadas': 'config_alcadas',
  '/usuarios': 'config_usuarios',
  '/borderoaprovadores': 'config_bordero_aprovadores',
  '/restritoaprovadores': 'config_restrito_aprovadores',
  '/fornecedores-restritos': 'config_fornecedores_restritos',
  '/impostosaprovadores': 'config_impostos_aprovadores',
  '/financeiroaprovadores': 'config_financeiro_aprovadores',
  '/fiscalaprovadores': 'config_fiscal_aprovadores',
  '/rhaprovadores': 'config_rh_aprovadores',
  '/centros-custos': 'ccusto',
  '/cadastro-centro-custo': 'ccusto',
  '/cadastro-conta-contabil': 'ccusto',
  '/disparos': 'config_disparos',
  '/cadastro-externos': 'config_cadastro_externos',
  '/status-pedido': 'config_status_pedido',
}

export const CONFIG_MENU_PERM_KEYS: ConfigMenuPermKey[] = [
  'config_alcadas',
  'config_usuarios',
  'config_bordero_aprovadores',
  'config_restrito_aprovadores',
  'config_fornecedores_restritos',
  'config_impostos_aprovadores',
  'config_financeiro_aprovadores',
  'config_fiscal_aprovadores',
  'config_rh_aprovadores',
  'ccusto',
  'config_disparos',
  'config_cadastro_externos',
  'config_status_pedido',
]

export function normalizeConfigPath(path: string): string {
  if (!path) return ''
  const p = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  return p.toLowerCase()
}

export function isConfigMenuRoute(path: string): boolean {
  const p = normalizeConfigPath(path)
  return p in ROUTE_PERM
}

export function canAccessConfigRoute(path: string, user: ConfigMenuSession): boolean {
  if (user.admin) return true
  const p = normalizeConfigPath(path)
  const key = ROUTE_PERM[p]
  if (!key) return false
  if (key === 'config_status_pedido') {
    const unidade = String(user.unidade ?? '').trim().toUpperCase()
    if (unidade !== 'WAY CSC') return false
  }
  return Boolean(user[key])
}

export function hasAnyConfigMenuAccess(user: ConfigMenuSession): boolean {
  if (user.admin) return true
  return CONFIG_MENU_PERM_KEYS.some((k) => Boolean(user[k]))
}

export type ConfigNavItem = { title: string; url: string }

export function filterConfigNavItems(
  items: ConfigNavItem[],
  user: ConfigMenuSession
): ConfigNavItem[] {
  if (user.admin) return items
  return items.filter((item) => canAccessConfigRoute(item.url, user))
}

export function mapConfigMenuFromApi(
  apiData: Record<string, unknown>
): Record<ConfigMenuPermKey, boolean> {
  return {
    config_alcadas: apiBool(apiData.config_alcadas ?? apiData.CONFIG_ALCADAS),
    config_usuarios: apiBool(apiData.config_usuarios ?? apiData.CONFIG_USUARIOS),
    config_bordero_aprovadores: apiBool(
      apiData.config_bordero_aprovadores ?? apiData.CONFIG_BORDERO_APROV
    ),
    config_restrito_aprovadores: apiBool(
      apiData.config_restrito_aprovadores ?? apiData.CONFIG_RESTRITO_APROV
    ),
    config_fornecedores_restritos: apiBool(
      apiData.config_fornecedores_restritos ?? apiData.CONFIG_FORN_RESTRITOS
    ),
    config_impostos_aprovadores: apiBool(
      apiData.config_impostos_aprovadores ?? apiData.CONFIG_IMPOSTOS_APROV
    ),
    config_financeiro_aprovadores: apiBool(
      apiData.config_financeiro_aprovadores ?? apiData.CONFIG_FINANCEIRO_APROV
    ),
    config_fiscal_aprovadores: apiBool(
      apiData.config_fiscal_aprovadores ?? apiData.CONFIG_FISCAL_APROV
    ),
    config_rh_aprovadores: apiBool(apiData.config_rh_aprovadores ?? apiData.CONFIG_RH_APROV),
    config_disparos: apiBool(apiData.config_disparos ?? apiData.CONFIG_DISPAROS),
    config_cadastro_externos: apiBool(
      apiData.config_cadastro_externos ?? apiData.CONFIG_CADASTRO_EXTERNOS
    ),
    config_status_pedido: apiBool(
      apiData.config_status_pedido ?? apiData.CONFIG_STATUS_PEDIDO
    ),
    ccusto: apiBool(apiData.ccusto ?? apiData.CCUSTO),
  }
}

export function configMenuPayloadFromUsuario(
  data: Record<ConfigMenuPermKey, boolean | undefined>
): Record<string, boolean> {
  return {
    config_alcadas: !!data.config_alcadas,
    config_usuarios: !!data.config_usuarios,
    config_bordero_aprovadores: !!data.config_bordero_aprovadores,
    config_restrito_aprovadores: !!data.config_restrito_aprovadores,
    config_fornecedores_restritos: !!data.config_fornecedores_restritos,
    config_impostos_aprovadores: !!data.config_impostos_aprovadores,
    config_financeiro_aprovadores: !!data.config_financeiro_aprovadores,
    config_fiscal_aprovadores: !!data.config_fiscal_aprovadores,
    config_rh_aprovadores: !!data.config_rh_aprovadores,
    config_disparos: !!data.config_disparos,
    config_cadastro_externos: !!data.config_cadastro_externos,
    config_status_pedido: !!data.config_status_pedido,
  }
}

export const CONFIG_MENU_FORM_FIELDS: { name: ConfigMenuPermKey; label: string }[] = [
  { name: 'config_alcadas', label: 'Alçadas' },
  { name: 'config_usuarios', label: 'Usuários' },
  { name: 'config_bordero_aprovadores', label: 'Aprovadores Borderô' },
  { name: 'config_restrito_aprovadores', label: 'Aprovadores Restritos' },
  { name: 'config_fornecedores_restritos', label: 'Fornecedores Restritos' },
  { name: 'config_impostos_aprovadores', label: 'Aprovadores Impostos' },
  { name: 'config_financeiro_aprovadores', label: 'Aprovadores Financeiro' },
  { name: 'config_fiscal_aprovadores', label: 'Aprovadores Fiscal' },
  { name: 'config_rh_aprovadores', label: 'Aprovadores RH' },
  { name: 'ccusto', label: 'Centros de custos' },
  { name: 'config_disparos', label: 'Disparos' },
  { name: 'config_cadastro_externos', label: 'Cadastro de externos' },
  { name: 'config_status_pedido', label: 'Status do pedido (CSC)' },
]
