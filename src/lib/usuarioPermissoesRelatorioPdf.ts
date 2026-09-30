import jsPDF from 'jspdf'
import type { Usuario } from '@/types/Usuario'
import type { UsuarioPermAuditItem } from '@/services/usuariosService'
import { stripDiacritics } from '@/utils/functions'
import {
  agruparEventosAuditoria,
  agruparUsuariosPorLogin,
  auditoriaAlvoColaborador,
  auditoriaAutorColaborador,
  basesAgrupadasLabel,
  COLUNAS_PERMISSAO,
  formatarDetalheAuditoria,
  formatarPeriodoBr,
  labelMesReferencia,
  loginsChaveColaborador,
  type EventoAuditoriaAgrupado,
  type UsuarioAgrupadoPorLogin,
} from '@/lib/usuarioPermissoesRelatorio'
import { downloadBlobFile } from '@/lib/downloadFile'

const PAGE_W = 210
const MARGIN = 16
const FOOTER_H = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const HEADER_BAND_H = 28

/** Paleta alinhada ao visual corporativo (azul escuro + cinzas claros). */
const C = {
  brand: [30, 58, 95] as [number, number, number],
  brandMid: [51, 88, 140] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  surfaceAlt: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warn: [180, 83, 9] as [number, number, number],
}

function norm(s: string) {
  return stripDiacritics(s.toLowerCase().trim())
}

export function usuarioCorrespondeBusca(u: Usuario, termo: string): boolean {
  const t = norm(termo)
  if (!t) return false
  return (
    norm(u.codusuario).includes(t)
    || norm(u.nome).includes(t)
    || norm(u.email).includes(t)
  )
}

export function auditoriaCorrespondeUsuario(item: UsuarioPermAuditItem, termo: string): boolean {
  const t = norm(termo)
  if (!t) return false
  const keys = loginsChaveColaborador(termo, [])
  if (keys.has(norm(item.targetCodusuario)) || keys.has(norm(item.actorCodusuario))) return true
  return (
    norm(item.targetCodusuario).includes(t)
    || norm(item.targetNome ?? '').includes(t)
    || norm(item.actorCodusuario).includes(t)
    || norm(item.actorNome ?? '').includes(t)
    || norm(item.detalhe ?? '').includes(t)
  )
}

export function permissoesAtivasDoUsuario(u: Usuario): { label: string; ativo: boolean }[] {
  return COLUNAS_PERMISSAO.map(c => ({
    label: c.label,
    ativo: Boolean(u[c.key]),
  }))
}

function labelAcao(acao: string): string {
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

function formatDh(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function truncate(doc: jsPDF, text: string, maxW: number): string {
  const s = text || '—'
  if (doc.getTextWidth(s) <= maxW) return s
  let out = s
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

function rgb(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(...color)
  doc.setFillColor(...color)
  doc.setTextColor(...color)
}

function newReportDoc(): jsPDF {
  return new jsPDF({ unit: 'mm', format: 'a4', compress: true })
}

function contentBottomY(doc: jsPDF) {
  return doc.internal.pageSize.getHeight() - FOOTER_H
}

function ensureY(doc: jsPDF, y: number, need: number): number {
  if (y + need > contentBottomY(doc)) {
    doc.addPage()
    return MARGIN + 4
  }
  return y
}

function drawFooters(doc: jsPDF, docTitle: string) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    const h = doc.internal.pageSize.getHeight()
    doc.setFillColor(...C.line)
    doc.rect(0, h - FOOTER_H, PAGE_W, 0.3, 'F')
    rgb(doc, C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(docTitle, MARGIN, h - 6)
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, h - 6, { align: 'right' })
  }
  rgb(doc, C.ink)
}

type MetaItem = { label: string; value: string }

function drawReportHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  meta: MetaItem[]
): number {
  doc.setFillColor(...C.brand)
  doc.rect(0, 0, PAGE_W, HEADER_BAND_H, 'F')
  doc.setFillColor(...C.brandMid)
  doc.rect(0, HEADER_BAND_H - 3, PAGE_W, 3, 'F')

  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('PaperSign', MARGIN, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Relatório de permissões · CSC', MARGIN, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  const titleLines = doc.splitTextToSize(title, CONTENT_W) as string[]
  doc.text(titleLines, MARGIN, 24)

  let y = HEADER_BAND_H + 10
  rgb(doc, C.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const subLines = doc.splitTextToSize(subtitle, CONTENT_W) as string[]
  doc.text(subLines, MARGIN, y)
  y += subLines.length * 4.5 + 6

  if (meta.length > 0) {
    const cols = meta.length >= 4 ? 2 : meta.length
    const gap = 4
    const boxW = (CONTENT_W - gap * (cols - 1)) / cols
    const boxH = 16
    const rowY = y
    meta.forEach((item, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = MARGIN + col * (boxW + gap)
      const by = rowY + row * (boxH + gap)
      doc.setFillColor(...C.surface)
      doc.setDrawColor(...C.line)
      doc.roundedRect(x, by, boxW, boxH, 2, 2, 'FD')
      rgb(doc, C.muted)
      doc.setFontSize(7.5)
      doc.text(item.label.toUpperCase(), x + 4, by + 6)
      rgb(doc, C.ink)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const valLines = doc.splitTextToSize(item.value, boxW - 8) as string[]
      doc.text(valLines.slice(0, 2), x + 4, by + 11)
      doc.setFont('helvetica', 'normal')
    })
    const rows = Math.ceil(meta.length / cols)
    y = rowY + rows * (boxH + gap) + 4
  }

  doc.setDrawColor(...C.line)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  return y + 8
}

function drawSectionTitle(doc: jsPDF, y: number, index: number, title: string): number {
  y = ensureY(doc, y, 14)
  doc.setFillColor(...C.brand)
  doc.circle(MARGIN + 3, y - 1.5, 3, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(String(index), MARGIN + 3, y, { align: 'center' })
  rgb(doc, C.ink)
  doc.setFontSize(12)
  doc.text(title, MARGIN + 10, y)
  return y + 8
}

function drawEmptyState(doc: jsPDF, y: number, message: string): number {
  y = ensureY(doc, y, 18)
  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'FD')
  rgb(doc, C.muted)
  doc.setFontSize(9)
  doc.text(message, MARGIN + 6, y + 9)
  return y + 20
}

function drawIdentityCard(doc: jsPDF, y: number, login: string, nome: string, email: string, qtdBases: number): number {
  const cardH = 28
  y = ensureY(doc, y, cardH + 4)
  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 3, 3, 'S')
  doc.setFillColor(...C.brand)
  doc.roundedRect(MARGIN, y, 4, cardH, 1, 1, 'F')

  rgb(doc, C.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(truncate(doc, nome, CONTENT_W - 20), MARGIN + 8, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  rgb(doc, C.muted)
  doc.text(`Login: ${login}`, MARGIN + 8, y + 18)
  doc.text(`E-mail: ${email || '—'}`, MARGIN + 8, y + 23)
  rgb(doc, C.brandMid)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(
    `${qtdBases} base(s) com cadastro`,
    PAGE_W - MARGIN - 6,
    y + 16,
    { align: 'right' }
  )
  return y + cardH + 8
}

/** Um cadastro = uma base (mesmo login em várias unidades). */
function drawBasePermissaoCard(doc: jsPDF, y: number, u: Usuario, index: number, total: number): number {
  const perms = permissoesAtivasDoUsuario(u)
  const ativas = perms.filter(p => p.ativo)
  const permRows = ativas.length === 0 ? 1 : Math.ceil(ativas.length / 2)
  const cardH = 18 + permRows * 5
  y = ensureY(doc, y, cardH + 4)

  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'FD')

  rgb(doc, C.brand)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(u.unidade ?? 'Base não informada', MARGIN + 5, y + 8)
  rgb(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Cadastro ${index} de ${total}`, PAGE_W - MARGIN - 5, y + 8, { align: 'right' })

  rgb(doc, u.ativo ? C.success : C.warn)
  doc.setFont('helvetica', 'bold')
  doc.text(u.ativo ? 'Ativo nesta base' : 'Inativo nesta base', MARGIN + 5, y + 14)

  rgb(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Permissões nesta base', MARGIN + 5, y + 19)

  rgb(doc, C.ink)
  doc.setFontSize(8)
  const colW = (CONTENT_W - 10) / 2
  ativas.forEach((p, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const px = MARGIN + 5 + col * colW
    const py = y + 23 + row * 5
    doc.setFillColor(...C.success)
    doc.circle(px + 1, py - 1.2, 0.8, 'F')
    rgb(doc, C.ink)
    doc.text(truncate(doc, p.label, colW - 8), px + 4, py)
  })
  if (ativas.length === 0) {
    rgb(doc, C.muted)
    doc.text('Nenhuma permissão de módulo marcada.', MARGIN + 5, y + 23)
  }

  return y + cardH + 5
}

function drawUsuarioPermCard(doc: jsPDF, y: number, u: Usuario): number {
  const perms = permissoesAtivasDoUsuario(u)
  const ativas = perms.filter(p => p.ativo)
  const permRows = ativas.length === 0 ? 1 : Math.ceil(ativas.length / 3)
  const cardH = 22 + permRows * 5
  y = ensureY(doc, y, cardH + 4)

  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'S')

  doc.setFillColor(...C.surfaceAlt)
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F')
  doc.setDrawColor(...C.line)
  doc.line(MARGIN, y + 10, MARGIN + CONTENT_W, y + 10)

  rgb(doc, C.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(truncate(doc, u.nome, CONTENT_W - 50), MARGIN + 4, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  rgb(doc, C.muted)
  doc.text(u.codusuario, PAGE_W - MARGIN - 4, y + 7, { align: 'right' })

  rgb(doc, C.ink)
  doc.setFontSize(8.5)
  const statusColor = u.ativo ? C.success : C.warn
  rgb(doc, C.muted)
  doc.text(`Base: ${u.unidade ?? '—'}  ·  E-mail: ${u.email ?? '—'}`, MARGIN + 4, y + 15)
  rgb(doc, statusColor)
  doc.setFont('helvetica', 'bold')
  doc.text(u.ativo ? 'Ativo' : 'Inativo', PAGE_W - MARGIN - 4, y + 15, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  rgb(doc, C.muted)
  doc.setFontSize(7.5)
  doc.text('Permissões ativas', MARGIN + 4, y + 20)
  rgb(doc, C.ink)
  doc.setFontSize(8)
  let px = MARGIN + 4
  let py = y + 24
  const colW = CONTENT_W / 3
  ativas.forEach((p, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    px = MARGIN + 4 + col * colW
    py = y + 24 + row * 5
    doc.setFillColor(...C.success)
    doc.circle(px + 1, py - 1.2, 0.8, 'F')
    rgb(doc, C.ink)
    doc.text(truncate(doc, p.label, colW - 6), px + 4, py)
  })
  if (ativas.length === 0) {
    rgb(doc, C.muted)
    doc.text('Nenhuma permissão marcada neste cadastro.', MARGIN + 4, y + 24)
  }

  return y + cardH + 6
}

function drawAuditEvent(doc: jsPDF, y: number, ev: EventoAuditoriaAgrupado): number {
  const linhasFmt = formatarDetalheAuditoria(ev.detalhe)
  const detLines: string[] = []
  for (const linha of linhasFmt) {
    const wrapped = doc.splitTextToSize(`- ${linha}`, CONTENT_W - 22) as string[]
    detLines.push(...wrapped)
  }
  const cardH = 22 + detLines.length * 4
  y = ensureY(doc, y, cardH + 4)

  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'FD')

  rgb(doc, C.brandMid)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(labelAcao(ev.acao).toUpperCase(), MARGIN + 5, y + 7)
  rgb(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDh(ev.dataHora), PAGE_W - MARGIN - 5, y + 7, { align: 'right' })

  rgb(doc, C.ink)
  doc.setFontSize(8)
  const basesLabel =
    ev.bases.length === 1 ? `Base ${ev.bases[0]}` : `Bases (${ev.bases.length}): ${ev.bases.join(', ')}`
  doc.text(`Usuário: ${ev.targetNome || ev.targetCodusuario} · ${basesLabel}`, MARGIN + 5, y + 12)
  rgb(doc, C.muted)
  doc.text(`Alterado por ${ev.actorNome || ev.actorCodusuario} (${ev.actorCodusuario})`, MARGIN + 5, y + 16)
  rgb(doc, C.ink)
  doc.setFontSize(8)
  doc.text('O que mudou:', MARGIN + 5, y + 20)
  rgb(doc, C.ink)
  doc.setFontSize(8)
  doc.text(detLines, MARGIN + 8, y + 24)

  return y + cardH + 5
}

type TableCol = { header: string; width: number; align?: 'left' | 'center' | 'right' }

function drawTableHeader(doc: jsPDF, y: number, cols: TableCol[]): number {
  const rowH = 8
  y = ensureY(doc, y, rowH + 2)
  doc.setFillColor(...C.brand)
  doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  let x = MARGIN + 2
  cols.forEach(col => {
    doc.text(col.header, x + (col.align === 'center' ? col.width / 2 : 0), y + 5.5, {
      align: col.align ?? 'left',
    })
    x += col.width
  })
  rgb(doc, C.ink)
  return y + rowH
}

function drawTableRow(
  doc: jsPDF,
  y: number,
  cols: TableCol[],
  cells: string[],
  zebra: boolean
): number {
  const rowH = 7
  if (zebra) {
    doc.setFillColor(...C.surfaceAlt)
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
  }
  doc.setDrawColor(...C.line)
  doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  let x = MARGIN + 2
  cells.forEach((cell, i) => {
    const col = cols[i]
    const text = truncate(doc, cell, col.width - 4)
    const align = col.align ?? 'left'
    const tx =
      align === 'center'
        ? x + col.width / 2
        : align === 'right'
          ? x + col.width - 2
          : x
    rgb(doc, i === 0 ? C.muted : C.ink)
    const isAtivoCol = cols[i]?.header === 'Ativo'
    if (isAtivoCol) {
      rgb(doc, cell === 'Sim' ? C.success : C.warn)
      doc.setFont('helvetica', cell === 'Sim' ? 'bold' : 'normal')
    }
    doc.text(text, tx, y + 5, { align })
    doc.setFont('helvetica', 'normal')
    x += col.width
  })
  return y + rowH
}

const LISTA_COLS: TableCol[] = [
  { header: '#', width: 10, align: 'center' },
  { header: 'Login', width: 26 },
  { header: 'Nome', width: 46 },
  { header: 'Bases com a permissão', width: 84 },
  { header: 'Ativo', width: 16, align: 'center' },
]

function drawListaPermissaoTable(doc: jsPDF, y: number, grupos: UsuarioAgrupadoPorLogin[]): number {
  y = drawTableHeader(doc, y, LISTA_COLS)
  grupos.forEach((g, i) => {
    const rowH = 7
    if (y + rowH > contentBottomY(doc)) {
      doc.addPage()
      y = MARGIN + 4
      y = drawTableHeader(doc, y, LISTA_COLS)
    }
    y = drawTableRow(
      doc,
      y,
      LISTA_COLS,
      [
        String(i + 1),
        g.codusuario,
        g.nome,
        basesAgrupadasLabel(g.bases),
        g.ativoLabel,
      ],
      i % 2 === 0
    )
  })
  return y + 6
}

export type PdfRelatorioUsuarioInput = {
  login: string
  nome: string
  mesRef: string
  periodoDe: string
  periodoAte: string
  cadastrosPorBase: Usuario[]
  alteracoesNoMes: UsuarioPermAuditItem[]
  historicoUsuario: UsuarioPermAuditItem[]
}

export function gerarPdfRelatorioUsuario(input: PdfRelatorioUsuarioInput): jsPDF {
  const doc = newReportDoc()
  const docTitle = `Bases · ${input.login}`

  let y = drawReportHeader(
    doc,
    'Bases e permissões do usuário',
    'Cadastro por base, permissões atuais e auditoria (no cadastro dele e alterações que ele fez em terceiros).',
    [
      { label: 'Login', value: input.login },
      { label: 'Nome', value: input.nome },
      { label: 'Bases', value: String(input.cadastrosPorBase.length) },
      { label: 'Gerado em', value: new Date().toLocaleString('pt-BR') },
    ]
  )

  if (input.cadastrosPorBase.length === 0) {
    y = drawEmptyState(doc, y, 'Nenhum cadastro encontrado para este login em nenhuma base.')
  } else {
    const email = input.cadastrosPorBase.find(u => u.email)?.email ?? input.cadastrosPorBase[0].email
    y = drawIdentityCard(doc, y, input.login, input.nome, email, input.cadastrosPorBase.length)
    y = drawSectionTitle(doc, y, 1, 'Bases com cadastro e permissões atuais')
    input.cadastrosPorBase.forEach((u, i) => {
      y = drawBasePermissaoCard(doc, y, u, i + 1, input.cadastrosPorBase.length)
    })
  }

  const logins = loginsChaveColaborador(input.login, input.cadastrosPorBase)
  const sortAudit = (a: UsuarioPermAuditItem, b: UsuarioPermAuditItem) =>
    new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()

  const historicoAlvo = input.historicoUsuario.filter(a => auditoriaAlvoColaborador(a, logins)).sort(sortAudit)
  const historicoAutor = input.historicoUsuario.filter(a => auditoriaAutorColaborador(a, logins)).sort(sortAudit)

  const mesAlvo = input.alteracoesNoMes.filter(a => auditoriaAlvoColaborador(a, logins))
  const mesAutor = input.alteracoesNoMes.filter(a => auditoriaAutorColaborador(a, logins))
  const mesTotal = mesAlvo.length + mesAutor.length

  y = drawSectionTitle(doc, y, 2, 'Histórico no cadastro desta pessoa')
  y = ensureY(doc, y, 14)
  doc.setFillColor(...C.surface)
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'F')
  rgb(doc, C.ink)
  doc.setFontSize(8.5)
  doc.text(
    `${historicoAlvo.length} registro(s) · ${mesAlvo.length} em ${labelMesReferencia(input.mesRef)} ` +
      `(${formatarPeriodoBr(input.periodoDe, input.periodoAte)}) · total no mês (incl. alterações em terceiros): ${mesTotal}`,
    MARGIN + 5,
    y + 9
  )
  y += 18

  if (historicoAlvo.length === 0) {
    y = drawEmptyState(
      doc,
      y,
      'Nenhuma alteração registrada no cadastro desta pessoa (criação, edição, cópia ou unificação feita por outro usuário).'
    )
  } else {
    for (const ev of agruparEventosAuditoria(historicoAlvo)) y = drawAuditEvent(doc, y, ev)
  }

  y = drawSectionTitle(doc, y, 3, 'Alterações que esta pessoa fez em outros usuários')
  y = ensureY(doc, y, 10)
  rgb(doc, C.muted)
  doc.setFontSize(8)
  doc.text(
    `${historicoAutor.length} registro(s) · ${mesAutor.length} em ${labelMesReferencia(input.mesRef)}`,
    MARGIN,
    y + 4
  )
  y += 10

  if (historicoAutor.length === 0) {
    y = drawEmptyState(doc, y, 'Nenhuma alteração de permissão feita por esta pessoa em cadastros de terceiros.')
  } else {
    for (const ev of agruparEventosAuditoria(historicoAutor)) y = drawAuditEvent(doc, y, ev)
  }

  drawFooters(doc, docTitle)
  return doc
}

export type PdfListaPermissaoInput = {
  mesRef: string
  unidadeLabel: string
  permissaoLabel: string
  permissaoSlug: string
  usuarios: Usuario[]
}

/** PDF principal: todos com uma permissão (ex.: Admin) — uma linha por login. */
export function gerarPdfUsuariosComPermissao(input: PdfListaPermissaoInput): jsPDF {
  const doc = newReportDoc()
  const docTitle = `Lista · ${input.permissaoLabel}`
  const grupos = agruparUsuariosPorLogin(input.usuarios)

  let y = drawReportHeader(
    doc,
    `Usuários com permissão ${input.permissaoLabel}`,
    'Uma linha por pessoa (login). As bases em que a permissão está marcada aparecem na mesma linha.',
    [
      { label: 'Permissão', value: input.permissaoLabel },
      { label: 'Filtro', value: input.unidadeLabel },
      { label: 'Pessoas', value: String(grupos.length) },
      { label: 'Cadastros', value: String(input.usuarios.length) },
    ]
  )

  y = drawSectionTitle(doc, y, 1, 'Resumo')
  y = ensureY(doc, y, 12)
  doc.setFillColor(...C.surface)
  doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'F')
  rgb(doc, C.ink)
  doc.setFontSize(9)
  doc.text(
    `${grupos.length} pessoa(s) com "${input.permissaoLabel}" (${input.usuarios.length} cadastro(s) em base). ` +
      `Gerado em ${new Date().toLocaleString('pt-BR')}.`,
    MARGIN + 5,
    y + 8
  )
  y += 18

  y = drawSectionTitle(doc, y, 2, 'Lista completa (sem repetir login)')
  if (grupos.length === 0) {
    drawEmptyState(doc, y, 'Nenhum usuário com esta permissão nos filtros aplicados.')
  } else {
    drawListaPermissaoTable(doc, y, grupos)
  }

  drawFooters(doc, docTitle)
  return doc
}

export type PdfMatrizInput = {
  mesRef: string
  unidadeLabel: string
  usuarios: Usuario[]
}

export function gerarPdfMatrizPermissoes(input: PdfMatrizInput): jsPDF {
  const doc = newReportDoc()
  const docTitle = 'Matriz de permissões'

  let y = drawReportHeader(
    doc,
    'Matriz de permissões',
    'Todos os usuários da base com resumo das permissões ativas.',
    [
      { label: 'Base', value: input.unidadeLabel },
      { label: 'Mês', value: labelMesReferencia(input.mesRef) },
      { label: 'Usuários', value: String(input.usuarios.length) },
      { label: 'Gerado em', value: new Date().toLocaleString('pt-BR') },
    ]
  )

  y = drawSectionTitle(doc, y, 1, 'Cadastros')
  for (const u of input.usuarios) {
    y = drawUsuarioPermCard(doc, y, u)
  }

  drawFooters(doc, docTitle)
  return doc
}

export type PdfAlteracoesMesInput = {
  mesRef: string
  periodoDe: string
  periodoAte: string
  unidadeLabel: string
  itens: UsuarioPermAuditItem[]
}

export type PdfColaboradorSetor = {
  login: string
  nome: string
  email: string
  cadastros: Usuario[]
}

export type PdfRelatorioMensalSetorInput = {
  mesRef: string
  periodoDe: string
  periodoAte: string
  nomeSetor: string
  assinanteNome: string
  assinanteLogin?: string
  assinanteCargo?: string
  colaboradores: PdfColaboradorSetor[]
}

function drawDeclaracaoSetor(doc: jsPDF, y: number, input: PdfRelatorioMensalSetorInput): number {
  const cargo = (input.assinanteCargo ?? 'Gestor(a) da área').trim()
  const texto =
    `Este relatório consolida os acessos ativos no PaperSign dos colaboradores do setor ` +
    `"${input.nomeSetor}", com referência ao mês de ${labelMesReferencia(input.mesRef)} ` +
    `(período ${formatarPeriodoBr(input.periodoDe, input.periodoAte)}). ` +
    `O(A) ${cargo} abaixo identificado(a) declara ter revisado a lista e atesta que reflete ` +
    `o conhecimento da equipe quanto às permissões concedidas em cada base.`
  y = ensureY(doc, y, 28)
  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  const lines = doc.splitTextToSize(texto, CONTENT_W - 10) as string[]
  const boxH = 8 + lines.length * 4.2
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, 'FD')
  rgb(doc, C.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(lines, MARGIN + 5, y + 7)
  return y + boxH + 8
}

function drawAssinaturaGestor(doc: jsPDF, y: number, input: PdfRelatorioMensalSetorInput): number {
  const blockH = 52
  y = ensureY(doc, y, blockH + 4)
  doc.setFillColor(...C.white)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 2, 2, 'S')

  rgb(doc, C.brand)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Assinatura do gestor da área', MARGIN + 5, y + 9)

  rgb(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const sub =
    input.assinanteLogin
      ? `${input.assinanteNome} (${input.assinanteLogin})`
      : input.assinanteNome
  doc.text(sub, MARGIN + 5, y + 15)
  doc.text(
    `${(input.assinanteCargo ?? 'Gestor(a) da área').trim()} · Setor: ${input.nomeSetor}`,
    MARGIN + 5,
    y + 20
  )

  const lineY = y + 36
  doc.setDrawColor(...C.ink)
  doc.setLineWidth(0.2)
  doc.line(MARGIN + 5, lineY, MARGIN + CONTENT_W - 5, lineY)
  rgb(doc, C.muted)
  doc.setFontSize(8)
  doc.text('Assinatura', MARGIN + 5, lineY + 5)

  const dataY = lineY + 12
  doc.text('Data: ____/____/________', MARGIN + 5, dataY)

  return y + blockH + 10
}

/** Relatório mensal por setor: colaboradores selecionados + bloco para assinatura do gestor. */
export function gerarPdfRelatorioMensalSetor(input: PdfRelatorioMensalSetorInput): jsPDF {
  const doc = newReportDoc()
  const docTitle = `Mensal · ${input.nomeSetor}`

  let y = drawReportHeader(
    doc,
    'Relatório mensal de acessos',
    'Permissões atuais por colaborador, para revisão e assinatura do gestor da área.',
    [
      { label: 'Setor / área', value: input.nomeSetor },
      { label: 'Mês de referência', value: labelMesReferencia(input.mesRef) },
      { label: 'Colaboradores', value: String(input.colaboradores.length) },
      { label: 'Gestor (assinatura)', value: input.assinanteNome },
    ]
  )

  y = drawDeclaracaoSetor(doc, y, input)
  y = drawSectionTitle(doc, y, 1, 'Colaboradores e permissões por base')

  if (input.colaboradores.length === 0) {
    y = drawEmptyState(doc, y, 'Nenhum colaborador selecionado.')
  } else {
    const total = input.colaboradores.length
    input.colaboradores.forEach((c, idx) => {
      y = ensureY(doc, y, 36)
      rgb(doc, C.brandMid)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`Colaborador ${idx + 1} de ${total}`, MARGIN, y)
      y += 6
      y = drawIdentityCard(doc, y, c.login, c.nome, c.email, c.cadastros.length)
      if (c.cadastros.length === 0) {
        y = drawEmptyState(doc, y, 'Sem cadastro em base.')
      } else {
        c.cadastros.forEach((u, i) => {
          y = drawBasePermissaoCard(doc, y, u, i + 1, c.cadastros.length)
        })
      }
      y += 4
    })
  }

  y = drawSectionTitle(doc, y, 2, 'Ciência e assinatura')
  drawAssinaturaGestor(doc, y, input)

  drawFooters(doc, docTitle)
  return doc
}

export function gerarPdfAlteracoesMes(input: PdfAlteracoesMesInput): jsPDF {
  const doc = newReportDoc()
  const docTitle = `Alterações · ${labelMesReferencia(input.mesRef)}`

  let y = drawReportHeader(
    doc,
    'Alterações de permissão no mês',
    'Eventos de criação, edição, cópia entre bases e unificação.',
    [
      { label: 'Período', value: formatarPeriodoBr(input.periodoDe, input.periodoAte) },
      { label: 'Base', value: input.unidadeLabel },
      { label: 'Registros', value: String(input.itens.length) },
      { label: 'Gerado em', value: new Date().toLocaleString('pt-BR') },
    ]
  )

  y = drawSectionTitle(doc, y, 1, 'Linha do tempo')
  if (input.itens.length === 0) {
    drawEmptyState(doc, y, 'Nenhuma alteração no período.')
  } else {
    for (const ev of agruparEventosAuditoria(input.itens)) y = drawAuditEvent(doc, y, ev)
  }

  drawFooters(doc, docTitle)
  return doc
}

export type PdfHistoricoUsuarioEvento = {
  categoria: string
  modulo: string
  unidade: string
  dataHora: string
  titulo: string
  detalhe: string
}

const LABEL_CATEGORIA_HIST: Record<string, string> = {
  permissoes: 'Permissões de usuários',
  configuracao: 'Configuração (alçadas, CC, aprovadores)',
  aprovacao: 'Aprovações / decisões',
  assinatura: 'Assinaturas',
  rdv: 'RDV',
  receitas: 'Receitas',
}

function drawHistoricoEvento(doc: jsPDF, y: number, ev: PdfHistoricoUsuarioEvento): number {
  const detLines = doc.splitTextToSize(ev.detalhe || '—', CONTENT_W - 12) as string[]
  const cardH = 18 + detLines.length * 4
  y = ensureY(doc, y, cardH + 4)

  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'FD')

  rgb(doc, C.brandMid)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text((LABEL_CATEGORIA_HIST[ev.categoria] ?? ev.categoria).toUpperCase(), MARGIN + 5, y + 7)
  rgb(doc, C.muted)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDh(ev.dataHora), PAGE_W - MARGIN - 5, y + 7, { align: 'right' })

  rgb(doc, C.ink)
  doc.setFontSize(8)
  doc.text(`${ev.modulo}${ev.unidade ? ` · ${ev.unidade}` : ''}`, MARGIN + 5, y + 12)
  doc.setFont('helvetica', 'bold')
  doc.text(truncate(doc, ev.titulo, CONTENT_W - 10), MARGIN + 5, y + 16)
  doc.setFont('helvetica', 'normal')
  rgb(doc, C.ink)
  doc.text(detLines, MARGIN + 5, y + 20)

  return y + cardH + 4
}

export function gerarPdfHistoricoUsuario(input: {
  login: string
  nome: string
  periodoDe: string
  periodoAte: string
  eventos: PdfHistoricoUsuarioEvento[]
  contagemPorCategoria: Record<string, number>
}): jsPDF {
  const doc = newReportDoc()
  const docTitle = `Histórico · ${input.login}`

  const resumo = Object.entries(input.contagemPorCategoria)
    .map(([k, n]) => `${LABEL_CATEGORIA_HIST[k] ?? k}: ${n}`)
    .join(' · ')

  let y = drawReportHeader(
    doc,
    'Histórico de atividades do usuário',
    'Tudo que esta pessoa fez no PaperSign: permissões, configurações, aprovações e assinaturas.',
    [
      { label: 'Login', value: input.login },
      { label: 'Nome', value: input.nome },
      { label: 'Período', value: formatarPeriodoBr(input.periodoDe, input.periodoAte) },
      { label: 'Total', value: String(input.eventos.length) },
    ]
  )

  y = ensureY(doc, y, 12)
  rgb(doc, C.muted)
  doc.setFontSize(8)
  doc.text(truncate(doc, resumo || 'Nenhum evento no período.', CONTENT_W), MARGIN, y + 4)
  y += 10

  y = drawSectionTitle(doc, y, 1, 'Linha do tempo')
  if (input.eventos.length === 0) {
    y = drawEmptyState(doc, y, 'Nenhuma atividade encontrada para este colaborador no período.')
  } else {
    for (const ev of input.eventos) y = drawHistoricoEvento(doc, y, ev)
  }

  drawFooters(doc, docTitle)
  return doc
}

/** Salva o PDF no dispositivo (desktop) ou abre/compartilha no mobile (iOS/Android). */
export async function salvarPdf(doc: jsPDF, fileName: string): Promise<'shared' | 'download' | 'opened'> {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`

  if (typeof window === 'undefined') {
    doc.save(name)
    return 'download'
  }

  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (ios) {
    doc.output('dataurlnewwindow')
    return 'opened'
  }

  const blob = doc.output('blob') as Blob
  return downloadBlobFile(blob, name, 'application/pdf')
}

export function pdfParaBase64(doc: jsPDF): string {
  const buf = doc.output('arraybuffer') as ArrayBuffer
  const u8 = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function slugArquivo(s: string) {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'usuario'
}
