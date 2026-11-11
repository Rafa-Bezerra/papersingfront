import { getMatrizUsuariosCentroCusto, registrarExportacaoPlanilhaCentrosCustos } from '@/services/mgoFinanceiroService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { toast } from 'sonner'

function escapeCsv(v: string) {
  const s = String(v ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Planilha CSV (Excel) com todos os vínculos centro de custo × usuário da unidade logada. */
export async function exportarMatrizCcUsuariosExcel() {
  const m = await getMatrizUsuariosCentroCusto()
  if (!m.linhas.length) {
    toast.info('Nenhum vínculo CC × usuário nesta unidade.')
    return
  }
  const cab = ['Centro de custo', 'Descrição', 'Diretoria', 'Usuário', 'Nome']
  const linhas = m.linhas.map((l) =>
    [l.ccusto, l.custo, l.diretoria, l.usuario, l.nome].map(escapeCsv).join(';')
  )
  const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
  const slug = m.unidade.replace(/\s+/g, '_')
  await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `centros-custos-usuarios-${slug}.csv`)
  void registrarExportacaoPlanilhaCentrosCustos(
    'cc_usuarios_matriz',
    `${m.unidade}: ${m.total_centros} CC, ${m.total_linhas} vínculos`
  )
  toast.success(`Planilha exportada (${m.total_centros} CC, ${m.total_linhas} linhas). Abra no Excel.`)
}
