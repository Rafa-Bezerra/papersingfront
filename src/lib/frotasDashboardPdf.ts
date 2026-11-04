import jsPDF from 'jspdf'

import { C, drawFooters, truncate } from './frotasRelatorioPdf'

export type RankingCondutor = {
  chave: string
  nome: string
  cadastrado: boolean
  multas: number
  valor: number
  pontos: number
  aDescontar: number
  placas: string[]
}

export type RankingVeiculo = {
  placa: string
  descricao: string
  consertos: number
  corretivas: number
  valorCorretivas: number
  preventivas: number
  valorPreventivas: number
  sinistros: number
  valorSinistros: number
  multas: number
  valorMultas: number
  custo: number
}

export type CorPdf = [number, number, number]
export type ColunaPdf = { titulo: string; largura: number; alinhar?: 'left' | 'right' | 'center' }
export type CelulaPdf = { texto: string; sub?: string; cor?: CorPdf; negrito?: boolean }
export type KpiPdf = { rotulo: string; valor: string; detalhe: string }
export type GraficoPdf = { titulo: string; fatias: { rotulo: string; valor: number; texto: string; cor: CorPdf }[] }
export type SecaoPdf = { titulo: string; nota: string; colunas: ColunaPdf[]; linhas: CelulaPdf[][] }

type Base = { unidade: string; periodo: string; geradoPor: string; kpis: KpiPdf[] }

export type PdfDashboardFrotaInput = Base & {
  graficos: GraficoPdf[]
  condutores: RankingCondutor[]
  ordemCondutores: string
  semCondutor: { multas: number; valor: number }
  veiculos: RankingVeiculo[]
  ordemVeiculos: string
}

export type PdfDetalheFrotaInput = Base & { titulo: string; subtitulo: string; secoes: SecaoPdf[] }

const PAGE_W = 210
const MARGIN = 10
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_H = 12
const HEADER_BAND_H = 26

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fimPagina = (doc: jsPDF) => doc.internal.pageSize.getHeight() - FOOTER_H - 2

function cabecalho(doc: jsPDF, titulo: string, subtitulo: string, input: Base): number {
  doc.setFillColor(...C.brand)
  doc.rect(0, 0, PAGE_W, HEADER_BAND_H, 'F')
  doc.setFillColor(...C.brandMid)
  doc.rect(0, HEADER_BAND_H - 3, PAGE_W, 3, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('PaperSign', MARGIN, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(truncate(doc, subtitulo, 110), MARGIN, 15)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(truncate(doc, titulo, 120), MARGIN, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} por ${input.geradoPor || '—'}`, PAGE_W - MARGIN, 10, { align: 'right' })
  doc.text(`${input.unidade} · ${input.periodo}`, PAGE_W - MARGIN, 15, { align: 'right' })

  const gap = 3
  const porLinha = 3
  const boxW = (CONTENT_W - gap * (porLinha - 1)) / porLinha
  const boxH = 18
  const y0 = HEADER_BAND_H + 6
  input.kpis.forEach((k, i) => {
    const x = MARGIN + (i % porLinha) * (boxW + gap)
    const y = y0 + Math.floor(i / porLinha) * (boxH + gap)
    doc.setFillColor(...C.surface)
    doc.setDrawColor(...C.line)
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD')
    doc.setTextColor(...C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(k.rotulo.toUpperCase(), x + 3, y + 5)
    doc.setTextColor(...C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(truncate(doc, k.valor, boxW - 6), x + 3, y + 11)
    doc.setTextColor(...C.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(truncate(doc, k.detalhe, boxW - 6), x + 3, y + 15.5)
  })
  const linhas = Math.ceil(input.kpis.length / porLinha)
  return y0 + linhas * boxH + Math.max(0, linhas - 1) * gap + 8
}

/** Pizza (rosca) desenhada com pequenos triângulos; jsPDF não tem arco preenchido. */
function pizza(doc: jsPDF, cx: number, cy: number, r: number, fatias: GraficoPdf['fatias']) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  doc.setLineWidth(0.15)
  if (total <= 0) {
    doc.setFillColor(...C.line)
    doc.circle(cx, cy, r, 'F')
  } else {
    let a0 = -Math.PI / 2
    for (const f of fatias) {
      const a1 = a0 + (f.valor / total) * Math.PI * 2
      const passos = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 90)))
      doc.setFillColor(...f.cor)
      doc.setDrawColor(...f.cor)
      for (let i = 0; i < passos; i++) {
        const t0 = a0 + ((a1 - a0) * i) / passos
        const t1 = a0 + ((a1 - a0) * (i + 1)) / passos
        doc.triangle(cx, cy, cx + r * Math.cos(t0), cy + r * Math.sin(t0), cx + r * Math.cos(t1), cy + r * Math.sin(t1), 'FD')
      }
      a0 = a1
    }
  }
  doc.setFillColor(...C.white)
  doc.circle(cx, cy, r * 0.55, 'F')
}

function graficos(doc: jsPDF, y: number, lista: GraficoPdf[]): number {
  if (!lista.length) return y
  const gap = 4
  const w = (CONTENT_W - gap * (lista.length - 1)) / lista.length
  const r = 15
  const maxFatias = Math.max(...lista.map((g) => g.fatias.length))
  const h = 9 + r * 2 + 5 + maxFatias * 4.2 + 3
  if (y + h > fimPagina(doc)) {
    doc.addPage()
    y = MARGIN
  }
  lista.forEach((g, i) => {
    const x = MARGIN + i * (w + gap)
    doc.setFillColor(...C.surface)
    doc.setDrawColor(...C.line)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, y, w, h, 2, 2, 'FD')
    doc.setTextColor(...C.ink)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(truncate(doc, g.titulo, w - 6), x + 3, y + 6)
    pizza(doc, x + w / 2, y + 9 + r, r, g.fatias)
    const total = g.fatias.reduce((s, f) => s + f.valor, 0)
    let ly = y + 9 + r * 2 + 6
    if (!g.fatias.length) {
      doc.setTextColor(...C.muted)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Sem dados no período.', x + 3, ly)
    }
    for (const f of g.fatias) {
      doc.setFillColor(...f.cor)
      doc.rect(x + 3, ly - 2.4, 2.6, 2.6, 'F')
      doc.setTextColor(...C.ink)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      const pct = total > 0 ? `${Math.round((f.valor / total) * 100)}%` : ''
      const direita = `${f.texto} · ${pct}`
      const wDir = doc.getTextWidth(direita)
      doc.text(truncate(doc, f.rotulo, w - 10 - wDir - 2), x + 7, ly)
      doc.setTextColor(...C.muted)
      doc.text(direita, x + w - 3, ly, { align: 'right' })
      ly += 4.2
    }
  })
  return y + h + 8
}

function cabecalhoTabela(doc: jsPDF, y: number, colunas: ColunaPdf[]): number {
  const h = 8
  doc.setFillColor(...C.brand)
  doc.rect(MARGIN, y, CONTENT_W, h, 'F')
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  let x = MARGIN
  for (const c of colunas) {
    const tx = c.alinhar === 'right' ? x + c.largura - 2 : c.alinhar === 'center' ? x + c.largura / 2 : x + 2
    doc.text(c.titulo, tx, y + 5.5, { align: c.alinhar ?? 'left' })
    x += c.largura
  }
  return y + h
}

function tabela(doc: jsPDF, y: number, secao: SecaoPdf): number {
  const { titulo, nota, colunas, linhas } = secao
  if (y + 30 > fimPagina(doc)) {
    doc.addPage()
    y = MARGIN
  }
  doc.setTextColor(...C.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(titulo, MARGIN, y + 4)
  doc.setTextColor(...C.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(truncate(doc, nota, CONTENT_W), MARGIN, y + 8.5)
  y = cabecalhoTabela(doc, y + 11, colunas)

  if (linhas.length === 0) {
    doc.setTextColor(...C.muted)
    doc.setFontSize(8.5)
    doc.text('Nenhum registro no período.', MARGIN + 2, y + 6)
    return y + 14
  }
  linhas.forEach((linha, i) => {
    const h = linha.some((c) => c.sub) ? 9.6 : 7
    if (y + h > fimPagina(doc)) {
      doc.addPage()
      y = cabecalhoTabela(doc, MARGIN, colunas)
    }
    if (i % 2 === 1) {
      doc.setFillColor(...C.surfaceAlt)
      doc.rect(MARGIN, y, CONTENT_W, h, 'F')
    }
    doc.setDrawColor(...C.line)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, y + h, MARGIN + CONTENT_W, y + h)
    let x = MARGIN
    linha.forEach((cel, j) => {
      const col = colunas[j]
      const tx = col.alinhar === 'right' ? x + col.largura - 2 : col.alinhar === 'center' ? x + col.largura / 2 : x + 2
      doc.setTextColor(...(cel.cor ?? C.ink))
      doc.setFont('helvetica', cel.negrito ? 'bold' : 'normal')
      doc.setFontSize(7.5)
      doc.text(truncate(doc, cel.texto, col.largura - 4), tx, y + 4.6, { align: col.alinhar ?? 'left' })
      if (cel.sub) {
        doc.setTextColor(...C.muted)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.6)
        doc.text(truncate(doc, cel.sub, col.largura - 4), tx, y + 8, { align: col.alinhar ?? 'left' })
      }
      x += col.largura
    })
    y += h
  })
  return y + 8
}

const COLS_CONDUTORES: ColunaPdf[] = [
  { titulo: '#', largura: 8, alinhar: 'center' },
  { titulo: 'Condutor', largura: 74 },
  { titulo: 'Multas', largura: 16, alinhar: 'right' },
  { titulo: 'Valor', largura: 26, alinhar: 'right' },
  { titulo: 'Pontos', largura: 16, alinhar: 'right' },
  { titulo: 'A descontar', largura: 26, alinhar: 'right' },
  { titulo: 'Placas', largura: 24 },
]

const COLS_VEICULOS: ColunaPdf[] = [
  { titulo: '#', largura: 8, alinhar: 'center' },
  { titulo: 'Veículo', largura: 40 },
  { titulo: 'Consertos', largura: 18, alinhar: 'right' },
  { titulo: 'Manut. corretiva', largura: 28, alinhar: 'right' },
  { titulo: 'Sinistros', largura: 28, alinhar: 'right' },
  { titulo: 'Preventivas', largura: 22, alinhar: 'right' },
  { titulo: 'Multas', largura: 18, alinhar: 'right' },
  { titulo: 'Custo total', largura: 28, alinhar: 'right' },
]

/** PDF do dashboard de frotas: indicadores, gráficos e os rankings completos de condutores e veículos. */
export function gerarPdfDashboardFrota(input: PdfDashboardFrotaInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  let y = cabecalho(doc, 'Dashboard de frotas', 'Gestão de frotas', input)
  y = graficos(doc, y, input.graficos)

  const notaSemCondutor = input.semCondutor.multas
    ? ` · ${input.semCondutor.multas} multa(s) sem condutor identificado (${brl(input.semCondutor.valor)}) fora do ranking`
    : ''
  y = tabela(doc, y, {
    titulo: 'Condutores com mais multas',
    nota: `Ordenado por ${input.ordemCondutores}; multas canceladas não entram${notaSemCondutor}.`,
    colunas: COLS_CONDUTORES,
    linhas: input.condutores.map((c, i) => [
      { texto: String(i + 1), cor: C.muted },
      { texto: c.nome, negrito: i < 3, sub: c.cadastrado ? undefined : 'sem cadastro (nome da multa)' },
      { texto: String(c.multas), negrito: true },
      { texto: brl(c.valor) },
      { texto: c.pontos ? String(c.pontos) : '—', cor: c.pontos >= 20 ? C.danger : C.ink },
      { texto: c.aDescontar ? brl(c.aDescontar) : '—', cor: c.aDescontar ? C.warn : C.muted },
      { texto: c.placas.length > 1 ? `${c.placas[0]} +${c.placas.length - 1}` : c.placas[0] ?? '—', cor: C.muted },
    ]),
  })

  tabela(doc, y, {
    titulo: 'Veículos com mais consertos',
    nota: `Ordenado por ${input.ordemVeiculos}; consertos = manutenção corretiva, funilaria/pintura e borracharia + sinistros.`,
    colunas: COLS_VEICULOS,
    linhas: input.veiculos.map((v, i) => [
      { texto: String(i + 1), cor: C.muted },
      { texto: v.placa, negrito: true, sub: v.descricao || undefined },
      { texto: String(v.consertos), negrito: true },
      { texto: brl(v.valorCorretivas), sub: `${v.corretivas} serviço(s)` },
      { texto: brl(v.valorSinistros), sub: `${v.sinistros} sinistro(s)` },
      { texto: brl(v.valorPreventivas), sub: `${v.preventivas} serviço(s)`, cor: C.muted },
      { texto: String(v.multas), sub: v.multas ? brl(v.valorMultas) : undefined },
      { texto: brl(v.custo), negrito: true },
    ]),
  })

  drawFooters(doc, `Dashboard de frotas · ${input.unidade}`)
  return doc
}

/** PDF do histórico de um veículo ou condutor aberto no dashboard (indicadores + uma tabela por assunto). */
export function gerarPdfDetalheFrota(input: PdfDetalheFrotaInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  let y = cabecalho(doc, input.titulo, input.subtitulo, input)
  for (const s of input.secoes) y = tabela(doc, y, s)
  drawFooters(doc, `${input.titulo} · ${input.unidade}`)
  return doc
}
