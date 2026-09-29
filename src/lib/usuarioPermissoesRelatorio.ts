import type { Usuario } from '@/types/Usuario'
import type { UsuarioPermAuditItem } from '@/services/usuariosService'
import { stripDiacritics } from '@/utils/functions'

export const UNIDADES_RELATORIO = [
  'WAY 112',
  'WAY 153',
  'WAY 262',
  'WAY 306',
  'WAY 364',
  'WAY CSC',
  'MIGRA BR',
] as const

export const COLUNAS_PERMISSAO: { key: keyof Usuario; label: string }[] = [
  { key: 'admin', label: 'Admin' },
  { key: 'administrativo', label: 'Administrativo' },
  { key: 'solicitante', label: 'Solicitante' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'bordero', label: 'Borderô' },
  { key: 'comunicados', label: 'Comunicados' },
  { key: 'rdv', label: 'RDV' },
  { key: 'ccusto', label: 'Centro de custo' },
  { key: 'externo', label: 'Externo' },
  { key: 'restrito', label: 'Restrito' },
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'gestao_pessoas', label: 'Gestão pessoas' },
  { key: 'pagamento_impostos', label: 'Pagamentos impostos' },
  { key: 'pagamento_rh', label: 'Pagamentos RH' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'financeiro_totvs', label: 'Financeiro TOTVS' },
  { key: 'docusign', label: 'DocuSign' },
  { key: 'projetos', label: 'Projetos' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'extrato_gestor', label: 'Extrato gestor' },
  { key: 'controle_medicao', label: 'Controle medição' },
]

export type ChavePermissaoRelatorio = (typeof COLUNAS_PERMISSAO)[number]['key']
export type FiltroPermissaoRelatorio = 'todas' | ChavePermissaoRelatorio

function csvCell(value: string | number | boolean | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function simNao(v: boolean | undefined): string {
  return v ? 'Sim' : 'Não'
}

export function limitesMesReferencia(anoMes: string): { de: string; ate: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(anoMes.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  const de = `${y}-${String(mo).padStart(2, '0')}-01`
  const ultimo = new Date(y, mo, 0).getDate()
  const ate = `${y}-${String(mo).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
  return { de, ate }
}

export function mesReferenciaAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function labelPermissaoRelatorio(filtro: FiltroPermissaoRelatorio): string {
  if (filtro === 'todas') return 'Todas as permissões'
  return COLUNAS_PERMISSAO.find(c => c.key === filtro)?.label ?? filtro
}

export function usuarioTemPermissao(u: Usuario, chave: ChavePermissaoRelatorio): boolean {
  return Boolean(u[chave])
}

function normLogin(s: string) {
  return stripDiacritics(s.toLowerCase().trim())
}

export type CadastrosUsuarioResolvido =
  | { ok: true; login: string; nome: string; cadastros: Usuario[] }
  | { ok: false; motivo: 'vazio' | 'nao_encontrado' | 'ambiguo'; logins?: string[] }

/** Um único login — pode ter vários cadastros (uma linha por base). */
export function resolverCadastrosDoUsuario(usuarios: Usuario[], termo: string): CadastrosUsuarioResolvido {
  const t = normLogin(termo)
  if (!t) return { ok: false, motivo: 'vazio' }

  const porLoginExato = usuarios.filter(u => normLogin(u.codusuario) === t)
  if (porLoginExato.length > 0) {
    const cadastros = [...porLoginExato].sort((a, b) =>
      (a.unidade ?? '').localeCompare(b.unidade ?? '', 'pt-BR')
    )
    return { ok: true, login: cadastros[0].codusuario, nome: cadastros[0].nome, cadastros }
  }

  const parcial = usuarios.filter(u => {
    const cod = normLogin(u.codusuario)
    const nome = normLogin(u.nome)
    return cod.includes(t) || nome.includes(t)
  })
  const loginsUnicos = [...new Set(parcial.map(u => normLogin(u.codusuario)))]
  if (loginsUnicos.length === 1) {
    const login = loginsUnicos[0]
    const cadastros = parcial
      .filter(u => normLogin(u.codusuario) === login)
      .sort((a, b) => (a.unidade ?? '').localeCompare(b.unidade ?? '', 'pt-BR'))
    return { ok: true, login: cadastros[0].codusuario, nome: cadastros[0].nome, cadastros }
  }
  if (loginsUnicos.length > 1) {
    return {
      ok: false,
      motivo: 'ambiguo',
      logins: parcial.map(u => u.codusuario).filter((v, i, a) => a.indexOf(v) === i),
    }
  }
  return { ok: false, motivo: 'nao_encontrado' }
}

/** Cadastros com a permissão marcada (ex.: todos com Admin). */
export function filtrarUsuariosPorPermissao(
  usuarios: Usuario[],
  filtro: FiltroPermissaoRelatorio
): Usuario[] {
  if (filtro === 'todas') return usuarios
  return usuarios.filter(u => usuarioTemPermissao(u, filtro))
}

/** Uma linha por login — várias bases no mesmo registro (evita repetir nome/login). */
export type UsuarioAgrupadoPorLogin = {
  codusuario: string
  nome: string
  email: string
  bases: string[]
  cadastros: Usuario[]
  ativoLabel: string
}

export function agruparUsuariosPorLogin(usuarios: Usuario[]): UsuarioAgrupadoPorLogin[] {
  const byLogin = new Map<string, Usuario[]>()
  for (const u of usuarios) {
    const k = normLogin(u.codusuario)
    const arr = byLogin.get(k) ?? []
    arr.push(u)
    byLogin.set(k, arr)
  }

  const grupos: UsuarioAgrupadoPorLogin[] = []
  for (const cadastros of byLogin.values()) {
    cadastros.sort((a, b) => (a.unidade ?? '').localeCompare(b.unidade ?? '', 'pt-BR'))
    const first = cadastros[0]
    const ativos = cadastros.filter(c => c.ativo).length
    const total = cadastros.length
    const ativoLabel =
      ativos === total ? 'Sim' : ativos === 0 ? 'Não' : `Parcial (${ativos}/${total})`

    grupos.push({
      codusuario: first.codusuario,
      nome: first.nome,
      email: cadastros.find(c => c.email)?.email ?? first.email,
      bases: cadastros.map(c => c.unidade ?? '—'),
      cadastros,
      ativoLabel,
    })
  }

  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function basesAgrupadasLabel(bases: string[]): string {
  return bases.join(', ')
}

function colaboradorCorrespondeTermo(g: UsuarioAgrupadoPorLogin, termo: string): boolean {
  const t = normLogin(termo)
  if (!t) return false
  return g.cadastros.some(u => {
    const cod = normLogin(u.codusuario)
    const nome = normLogin(u.nome)
    const email = normLogin(u.email ?? '')
    return cod.includes(t) || nome.includes(t) || email.includes(t)
  })
}

/** Autocomplete do PDF individual (login/nome, uma entrada por pessoa). */
/** Linhas legíveis para PDF/tela (evita «sim ! não» quando a seta Unicode falha na fonte). */
export function formatarDetalheAuditoria(raw: string | null | undefined): string[] {
  const text = (raw ?? '').trim()
  if (!text) return ['Nenhum detalhe registrado.']

  const normalizado = text
    .replace(/\u2192/g, '->')
    .replace(/\s*->\s*/g, ' -> ')
    .replace(/\s+!\s+/g, ' -> ')

  const trechos = normalizado.split(/;\s*/).map(s => s.trim()).filter(Boolean)
  const linhas: string[] = []

  for (const trecho of trechos) {
    const diff = /^([^:]+):\s*(sim|não|true|false|0|1)\s*(?:->|→|!)\s*(sim|não|true|false|0|1)\s*$/i.exec(
      trecho
    )
    if (diff) {
      const nome = diff[1].trim()
      const de = normalizarSimNao(diff[2])
      const para = normalizarSimNao(diff[3])
      linhas.push(`${nome}: alterado de ${de} para ${para}`)
      continue
    }

    if (/^permissões:/i.test(trecho)) {
      linhas.push(trecho.replace(/^permissões:\s*/i, 'Permissões marcadas: '))
      continue
    }

    linhas.push(trecho)
  }

  return linhas.length ? linhas : [text]
}

function normalizarSimNao(v: string): string {
  const x = v.toLowerCase()
  if (x === 'sim' || x === 'true' || x === '1') return 'Sim'
  if (x === 'não' || x === 'nao' || x === 'false' || x === '0') return 'Não'
  return v
}

export type EventoAuditoriaAgrupado = {
  dataHora: string
  acao: string
  actorCodusuario: string
  actorNome: string | null
  targetCodusuario: string
  targetNome: string | null
  bases: string[]
  detalhe: string | null
}

/** Mesma alteração em várias bases no mesmo instante → um bloco só. */
export function agruparEventosAuditoria(eventos: UsuarioPermAuditItem[]): EventoAuditoriaAgrupado[] {
  const map = new Map<string, EventoAuditoriaAgrupado>()

  for (const ev of eventos) {
    const detNorm = (ev.detalhe ?? '').replace(/\u2192/g, '->').trim()
    const key = `${ev.dataHora}|${ev.acao}|${ev.actorCodusuario}|${detNorm}`
    const existente = map.get(key)
    if (!existente) {
      map.set(key, {
        dataHora: ev.dataHora,
        acao: ev.acao,
        actorCodusuario: ev.actorCodusuario,
        actorNome: ev.actorNome,
        targetCodusuario: ev.targetCodusuario,
        targetNome: ev.targetNome,
        bases: [ev.targetUnidade],
        detalhe: ev.detalhe,
      })
    } else if (!existente.bases.includes(ev.targetUnidade)) {
      existente.bases.push(ev.targetUnidade)
    }
  }

  return [...map.values()].map(g => ({
    ...g,
    bases: [...g.bases].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }))
}

export function buscarColaboradoresAgrupados(
  usuarios: Usuario[],
  termo: string,
  limite = 15
): UsuarioAgrupadoPorLogin[] {
  const t = termo.trim()
  if (t.length < 2) return []
  return agruparUsuariosPorLogin(usuarios)
    .filter(g => colaboradorCorrespondeTermo(g, t))
    .slice(0, limite)
}

export function permissoesAtivasLabels(u: Usuario): string[] {
  return COLUNAS_PERMISSAO.filter(c => Boolean(u[c.key])).map(c => c.label)
}

export function labelMesReferencia(anoMes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(anoMes)
  if (!m) return anoMes
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function buildCsvMatrizPermissoes(usuarios: Usuario[]): string {
  const baseHeaders = [
    'Matrícula',
    'Nome',
    'Unidade',
    'Empresa',
    'E-mail',
    'Ativo',
    'Perfil',
    'Diretoria',
    'Data criação',
  ]
  const permHeaders = COLUNAS_PERMISSAO.map(c => c.label)
  const sep = ';'
  const lines: string[] = []
  lines.push([...baseHeaders, ...permHeaders].map(csvCell).join(sep))
  for (const u of usuarios) {
    const row = [
      u.codusuario,
      u.nome,
      u.unidade ?? '',
      u.empresa,
      u.email,
      simNao(u.ativo),
      u.codperfil,
      u.diretoria,
      u.datacriacao,
      ...COLUNAS_PERMISSAO.map(c => simNao(Boolean(u[c.key]))),
    ]
    lines.push(row.map(csvCell).join(sep))
  }
  return '\uFEFF' + lines.join('\r\n')
}

function labelAcaoCsv(acao: string): string {
  switch ((acao || '').toUpperCase()) {
    case 'CRIACAO':
      return 'Criação'
    case 'ALTERACAO':
      return 'Alteração'
    case 'COPIA':
      return 'Cópia'
    case 'COPIA_ATUALIZA':
      return 'Cópia (atualização)'
    case 'UNIFICACAO':
      return 'Unificação'
    default:
      return acao
  }
}

export function buildCsvAuditoriaMensal(itens: UsuarioPermAuditItem[]): string {
  const sep = ';'
  const headers = [
    'Data/hora',
    'Ação',
    'Quem fez (login)',
    'Quem fez (nome)',
    'Unidade quem fez',
    'Usuário alvo (login)',
    'Usuário alvo (nome)',
    'Base alvo',
    'Detalhe',
    'IP',
  ]
  const lines = [headers.map(csvCell).join(sep)]
  for (const r of itens) {
    const dh = r.dataHora ? new Date(r.dataHora).toLocaleString('pt-BR') : ''
    lines.push(
      [
        dh,
        labelAcaoCsv(r.acao),
        r.actorCodusuario,
        r.actorNome ?? '',
        r.actorUnidade ?? '',
        r.targetCodusuario,
        r.targetNome ?? '',
        r.targetUnidade,
        r.detalhe ?? '',
        r.ipOrigem ?? '',
      ]
        .map(csvCell)
        .join(sep)
    )
  }
  return '\uFEFF' + lines.join('\r\n')
}

export function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
