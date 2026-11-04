import jsPDF from 'jspdf'

/** Situação de um documento na relação: define a cor do texto no PDF. */
export type NivelValidade = 'ok' | 'alerta' | 'vencido' | 'neutro'

export type CelulaValidade = { texto: string; nivel: NivelValidade }

export type LinhaRelatorioFrota = {
  placa: string
  frota: string
  modelo: string
  responsavel: string
  setor: string
  telefone: string
  cnh: CelulaValidade
  crlv: CelulaValidade
  vencimentos: CelulaValidade[]
}

export type PdfRelacaoFrotaInput = {
  unidade: string
  filtroLabel: string
  busca: string
  geradoPor: string
  totais: { veiculos: number; vencidos: number; vencendo: number; semResponsavel: number }
  linhas: LinhaRelatorioFrota[]
}

const PAGE_W = 210
const MARGIN = 10
const FOOTER_H = 12
const CONTENT_W = PAGE_W - MARGIN * 2
const HEADER_BAND_H = 26

export const C = {
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
  danger: [185, 28, 28] as [number, number, number],
}

const COR_NIVEL: Record<NivelValidade, [number, number, number]> = {
  ok: C.success,
  alerta: C.warn,
  vencido: C.danger,
  neutro: C.muted,
}

type Col = { header: string; width: number; align?: 'left' | 'center' }

// Retrato: 190 mm úteis. Veículo e responsável usam duas linhas (frota/modelo e setor/telefone embaixo).
const COLS: Col[] = [
  { header: '#', width: 7, align: 'center' },
  { header: 'Veículo', width: 48 },
  { header: 'Com quem está', width: 52 },
  { header: 'CNH', width: 26 },
  { header: 'CRLV', width: 26 },
  { header: 'Vencimentos', width: 31 },
]

type LinhaCelula = { texto: string; c: [number, number, number]; bold?: boolean; pequena?: boolean }

export function truncate(doc: jsPDF, text: string, maxW: number): string {
  const s = text || '—'
  if (doc.getTextWidth(s) <= maxW) return s
  let out = s
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1)
  return `${out}…`
}

function cor(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(...c)
}

function drawHeader(doc: jsPDF, input: PdfRelacaoFrotaInput): number {
  doc.setFillColor(...C.brand)
  doc.rect(0, 0, PAGE_W, HEADER_BAND_H, 'F')
  doc.setFillColor(...C.brandMid)
  doc.rect(0, HEADER_BAND_H - 3, PAGE_W, 3, 'F')

  cor(doc, C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('PaperSign', MARGIN, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Gestão de frotas', MARGIN, 15)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Relação de veículos', MARGIN, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${input.geradoPor || '—'}`, PAGE_W - MARGIN, 10, {
    align: 'right',
  })

  const meta = [
    { label: 'Unidade', value: input.unidade || '—' },
    { label: 'Filtro', value: input.busca ? `${input.filtroLabel} · busca "${input.busca}"` : input.filtroLabel },
    { label: 'Veículos na relação', value: String(input.linhas.length) },
    { label: 'Com documento vencido', value: String(input.totais.vencidos) },
    { label: 'Vencendo em 30 dias', value: String(input.totais.vencendo) },
    { label: 'Sem responsável', value: String(input.totais.semResponsavel) },
  ]
  const gap = 3
  const porLinha = 3
  const boxW = (CONTENT_W - gap * (porLinha - 1)) / porLinha
  const boxH = 17
  const y0 = HEADER_BAND_H + 6
  meta.forEach((m, i) => {
    const x = MARGIN + (i % porLinha) * (boxW + gap)
    const y = y0 + Math.floor(i / porLinha) * (boxH + gap)
    doc.setFillColor(...C.surface)
    doc.setDrawColor(...C.line)
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD')
    cor(doc, C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(m.label.toUpperCase(), x + 3, y + 5)
    const destaque =
      (m.label === 'Com documento vencido' && input.totais.vencidos > 0) ? C.danger
        : (m.label === 'Vencendo em 30 dias' && input.totais.vencendo > 0) ? C.warn
          : C.ink
    cor(doc, destaque)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const linhas = doc.splitTextToSize(m.value, boxW - 6) as string[]
    const visiveis = linhas.length > 2 ? [linhas[0], truncate(doc, linhas.slice(1).join(' '), boxW - 6)] : linhas
    doc.text(visiveis, x + 3, y + 10.5)
  })
  const linhasMeta = Math.ceil(meta.length / porLinha)
  return y0 + linhasMeta * boxH + (linhasMeta - 1) * gap + 6
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const h = 8
  doc.setFillColor(...C.brand)
  doc.rect(MARGIN, y, CONTENT_W, h, 'F')
  cor(doc, C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  let x = MARGIN
  for (const c of COLS) {
    const tx = c.align === 'center' ? x + c.width / 2 : x + 2
    doc.text(c.header, tx, y + 5.5, { align: c.align ?? 'left' })
    x += c.width
  }
  return y + h
}

/** Quebra um texto de validade em linhas da largura da coluna, mantendo a cor da situação. */
function linhasValidade(doc: jsPDF, v: CelulaValidade, largura: number): LinhaCelula[] {
  doc.setFont('helvetica', v.nivel === 'vencido' ? 'bold' : 'normal')
  doc.setFontSize(7.5)
  return (doc.splitTextToSize(v.texto, largura) as string[]).map((t) => ({
    texto: t,
    c: COR_NIVEL[v.nivel],
    bold: v.nivel === 'vencido',
  }))
}

function drawRow(doc: jsPDF, y: number, idx: number, l: LinhaRelatorioFrota): number {
  const larg = (i: number) => COLS[i].width - 4
  const contato = [l.setor, l.telefone].filter(Boolean).join(' · ')
  const celulas: LinhaCelula[][] = [
    [{ texto: String(idx + 1), c: C.muted }],
    [
      { texto: l.placa, c: C.ink, bold: true },
      { texto: [l.frota, l.modelo].filter(Boolean).join(' · ') || '—', c: C.muted, pequena: true },
    ],
    l.responsavel
      ? [{ texto: l.responsavel, c: C.ink }, ...(contato ? [{ texto: contato, c: C.muted, pequena: true }] : [])]
      : [{ texto: 'Ninguém', c: C.muted }],
    linhasValidade(doc, l.cnh, larg(3)),
    linhasValidade(doc, l.crlv, larg(4)),
    l.vencimentos.length
      ? l.vencimentos.flatMap((v) => linhasValidade(doc, v, larg(5)))
      : [{ texto: '—', c: C.muted }],
  ]
  const maxLinhas = Math.max(...celulas.map((c) => c.length))
  const rowH = Math.max(7, maxLinhas * 3.6 + 3.4)

  if (idx % 2 === 1) {
    doc.setFillColor(...C.surfaceAlt)
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F')
  }
  doc.setDrawColor(...C.line)
  doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH)

  let x = MARGIN
  celulas.forEach((linhas, i) => {
    const col = COLS[i]
    const tx = col.align === 'center' ? x + col.width / 2 : x + 2
    linhas.forEach((ln, j) => {
      cor(doc, ln.c)
      doc.setFont('helvetica', ln.bold ? 'bold' : 'normal')
      doc.setFontSize(ln.pequena ? 6.8 : 7.5)
      doc.text(truncate(doc, ln.texto, col.width - 4), tx, y + 4.8 + j * 3.6, { align: col.align ?? 'left' })
    })
    x += col.width
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  return y + rowH
}

export function drawFooters(doc: jsPDF, titulo: string) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    const h = doc.internal.pageSize.getHeight()
    doc.setFillColor(...C.line)
    doc.rect(0, h - FOOTER_H, PAGE_W, 0.3, 'F')
    cor(doc, C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(titulo, MARGIN, h - 5)
    doc.text('Dados pessoais (CNH/telefone): uso interno.', PAGE_W / 2, h - 5, { align: 'center' })
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, h - 5, { align: 'right' })
  }
}

/** PDF da relação exibida na Gestão de frotas (respeita filtro e busca da tela). */
export function gerarPdfRelacaoFrota(input: PdfRelacaoFrotaInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  let y = drawHeader(doc, input)
  y = drawTableHeader(doc, y)
  const fim = () => doc.internal.pageSize.getHeight() - FOOTER_H - 2

  if (input.linhas.length === 0) {
    cor(doc, C.muted)
    doc.setFontSize(9)
    doc.text('Nenhum veículo nesta relação.', MARGIN + 2, y + 7)
  }
  input.linhas.forEach((l, i) => {
    if (y + 10 > fim()) {
      doc.addPage()
      y = drawTableHeader(doc, MARGIN)
    }
    y = drawRow(doc, y, i, l)
  })

  drawFooters(doc, `Relação de veículos · ${input.unidade}`)
  return doc
}
