import { getAll, getMatrizCcConta, registrarExportacaoPlanilhaCentrosCustos } from '@/services/mgoFinanceiroService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { toast } from 'sonner'

function escapeCsv(v: string) {
  const s = String(v ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

type LinhaExport = {
  ccusto: string
  custo: string
  diretoria?: string
  conta: string
  conta_nome: string
}

async function carregarLinhasMatriz(): Promise<{ unidade: string; linhas: LinhaExport[] }> {
  try {
    const m = await getMatrizCcConta()
    return {
      unidade: m.unidade,
      linhas: m.linhas.map((l) => ({
        ccusto: l.ccusto,
        custo: l.custo,
        diretoria: l.diretoria,
        conta: l.conta,
        conta_nome: l.conta_nome,
      })),
    }
  } catch {
    const all = await getAll()
    return {
      unidade: 'unidade',
      linhas: all.map((l) => ({
        ccusto: l.centro_custo,
        custo: l.centro_custo_nome ?? '',
        conta: l.conta_contabil,
        conta_nome: l.conta_contabil_nome ?? '',
      })),
    }
  }
}

/** Planilha CSV (Excel) — todos os vínculos CC × conta da unidade. */
export async function exportarMatrizCcContaExcel() {
  const { linhas } = await carregarLinhasMatriz()
  if (!linhas.length) {
    toast.info('Nenhum vínculo CC × conta nesta unidade.')
    return
  }
  const centros = new Set(linhas.map((l) => l.ccusto.toLowerCase())).size
  const cab = ['Centro de custo', 'Descrição CC', 'Diretoria', 'Conta contábil', 'Nome conta']
  const rows = linhas.map((l) =>
    [l.ccusto, l.custo, l.diretoria ?? '', l.conta, l.conta_nome].map(escapeCsv).join(';')
  )
  const csv = `\uFEFF${cab.join(';')}\r\n${rows.join('\r\n')}\r\n`
  await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `centros-custos-contas-matriz.csv`)
  void registrarExportacaoPlanilhaCentrosCustos('cc_conta_matriz', `${centros} CC, ${linhas.length} vínculos`)
  toast.success(`Planilha exportada (${centros} CC, ${linhas.length} vínculos). Abra no Excel.`)
}

/** Planilha CSV (Excel) — contas de um centro de custo. */
export async function exportarContasDoCentroExcel(
  ccusto: string,
  nomeCc: string,
  linhas: { conta_contabil: string; conta_contabil_nome: string }[]
) {
  if (!linhas.length) {
    toast.info('Nenhuma conta vinculada a este centro de custo.')
    return
  }
  const cab = ['Centro de custo', 'Descrição CC', 'Conta contábil', 'Nome conta']
  const rows = linhas.map((l) =>
    [ccusto, nomeCc, l.conta_contabil, l.conta_contabil_nome].map(escapeCsv).join(';')
  )
  const csv = `\uFEFF${cab.join(';')}\r\n${rows.join('\r\n')}\r\n`
  const slug = ccusto.replace(/[^\w.-]+/g, '_')
  await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `cc-contas-${slug}.csv`)
  void registrarExportacaoPlanilhaCentrosCustos(
    'cc_conta_centro',
    `CC ${ccusto}${nomeCc ? ` — ${nomeCc}` : ''}: ${linhas.length} conta(s)`
  )
  toast.success(`${linhas.length} conta(s) exportada(s). Abra no Excel.`)
}
