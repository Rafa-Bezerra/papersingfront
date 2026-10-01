import { getAll as getAllAnexos } from '@/services/anexoService'
import { getAnexoByIdmov } from '@/services/requisicoesService'
import type { Anexo } from '@/types/Anexo'

export function normalizarPdfMovimento(valor: string): string {
  let pdf = valor.trim()
  if (pdf.startsWith('data:')) pdf = pdf.split(',')[1] ?? pdf
  return pdf
}

/** Anexos da tabela PaperSign + documento principal do RM (quando existir). */
export async function listarAnexosMovimentoComPrincipal(
  idmov: number,
  codigoAtendimento: string | number | undefined | null,
  unidade?: string
): Promise<Anexo[]> {
  const extras = await getAllAnexos(idmov, unidade)
  const cod = Number(String(codigoAtendimento ?? '').trim())
  if (!Number.isFinite(cod) || cod <= 0) return extras

  try {
    const principal = await getAnexoByIdmov(idmov, cod)
    const pdf = principal?.arquivo?.trim()
    if (!pdf) return extras

    const normalized = normalizarPdfMovimento(pdf)
    const principalAnexo: Anexo = {
      id: 0,
      idmov,
      documento_assinado: 0,
      anexo: normalized,
      nome: `Movimentação nº ${idmov}`,
      usuario_criacao: '',
    }

    const duplicado = extras.some((e) => e.anexo === normalized)
    return duplicado ? extras : [principalAnexo, ...extras]
  } catch {
    return extras
  }
}
