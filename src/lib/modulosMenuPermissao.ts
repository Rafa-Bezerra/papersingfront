import { FROTAS_FORA_DO_DEPLOY, FROTAS_SO_ADMIN } from '@/lib/data'
import { apiBool } from '@/utils/sessionUser'

/** Flags do userData da sessão que decidem o que aparece no menu "Módulos". */
export type UsuarioMenu = {
  admin: boolean
  financeiro: boolean
  documentos: boolean
  bordero: boolean
  externo: boolean
  comunicados: boolean
  fiscal: boolean
  pagamento_rh: boolean
  pagamento_impostos: boolean
  restrito: boolean
  rdv: boolean
  docusign: boolean
  projetos: boolean
  receitas: boolean
  extrato_gestor: boolean
  controle_medicao: boolean
  modulo_contratos: boolean
  frotas: boolean
  unidade: string
}

export function usuarioMenuDaSessao(u: Record<string, unknown> | null | undefined): UsuarioMenu {
  const b = (k: string) => apiBool(u?.[k] ?? u?.[k.toUpperCase()])
  return {
    admin: b('admin'),
    financeiro: b('financeiro'),
    documentos: b('documentos'),
    bordero: b('bordero'),
    externo: b('externo'),
    comunicados: b('comunicados'),
    fiscal: b('fiscal'),
    pagamento_rh: b('pagamento_rh'),
    pagamento_impostos: b('pagamento_impostos'),
    restrito: b('restrito'),
    rdv: b('rdv'),
    docusign: b('docusign'),
    projetos: b('projetos'),
    receitas: b('receitas'),
    extrato_gestor: b('extrato_gestor'),
    controle_medicao: b('controle_medicao'),
    modulo_contratos: b('modulo_contratos'),
    frotas: b('frotas'),
    unidade: String(u?.unidade ?? u?.UNIDADE ?? ''),
  }
}

/** Itens de configuração que, fora do bloco Configurações, só Admin e Financeiro veem. */
const ROTAS_CONFIG_NO_MENU_MODULOS = [
  '/alcadas',
  '/usuarios',
  '/borderoaprovadores',
  '/restritoaprovadores',
  '/impostosaprovadores',
  '/rhaprovadores',
  '/centros-custos',
  '/disparos',
  '/cadastro-externos',
]

/** Regra do menu lateral (AppSidebar) para um item de "Módulos". */
export function moduloMenuVisivel(url: string, u: UsuarioMenu): boolean {
  if (url === '/projetos' && u.unidade.trim().toUpperCase() !== 'WAY CSC') return false
  // Receitas: só quem tem a flag (admin sempre vê). Financeiro NÃO herda este módulo automaticamente.
  if (url === '/receitas' && !u.receitas && !u.admin) return false
  if (url === '/extrato-gestor' && !u.extrato_gestor && !u.admin) return false
  if (url === '/controle-medicao' && !u.controle_medicao && !u.admin) return false
  if (url === '/contratos' && !u.modulo_contratos && !u.admin) return false
  if (url === '/requisicoes-contrato' && !u.modulo_contratos && !u.admin) return false
  if (url === '/frotas' && FROTAS_FORA_DO_DEPLOY) return false
  // Frotas: só admin ou quem tem a flag (financeiro não herda).
  if (url === '/frotas' && !u.admin && (FROTAS_SO_ADMIN || !u.frotas)) return false
  // Financeiro tem acesso a todas as rotinas, exceto as configurações
  // (que já ficam ocultas e só aparecem no bloco Configurações do admin).
  if (!u.admin && !u.financeiro) {
    if (url === '/documentos' && !u.documentos) return false
    if (url === '/comunicados' && !u.comunicados) return false
    if (url === '/bordero' && !u.bordero) return false
    if (url === '/aprovacaordv' && !u.rdv) return false
    if (url === '/gestao-pessoas' && !u.restrito) return false
    if (url === '/documentos-externos' && !u.externo) return false
    if (url === '/pagamentos-rh' && !u.pagamento_rh) return false
    if (url === '/pagamentos-impostos' && !u.pagamento_impostos) return false
    if (url === '/fiscal' && !u.fiscal) return false
    if (url === '/docusign' && !u.docusign && !u.documentos) return false
    if (url === '/projetos' && !u.projetos) return false
    if (ROTAS_CONFIG_NO_MENU_MODULOS.includes(url)) return false
  }
  return true
}
