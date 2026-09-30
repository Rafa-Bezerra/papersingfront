import type jsPDF from 'jspdf'

import { getAll as getAllUsuarios } from '@/services/usuariosService'
import type { RelatorioMensalRef } from '@/services/relatorioMensalSetorService'
import type { Usuario } from '@/types/Usuario'
import {
  agruparUsuariosPorLogin,
  limitesMesReferencia,
  mesReferenciaAtual,
  resolverCadastrosDoUsuario,
} from '@/lib/usuarioPermissoesRelatorio'
import {
  gerarPdfRelatorioMensalSetor,
  slugArquivo,
  type PdfColaboradorSetor,
} from '@/lib/usuarioPermissoesRelatorioPdf'
import { stripDiacritics } from '@/utils/functions'

function normLogin(s: string) {
  return stripDiacritics(s.toLowerCase().trim())
}

function loginsDaReferencia(ref: RelatorioMensalRef): string[] {
  if (ref.colaboradores.length > 0) {
    return [...new Set(ref.colaboradores.map(c => normLogin(c.codusuario)).filter(Boolean))]
  }
  return [...new Set(ref.logins.map(normLogin).filter(Boolean))]
}

function filtrarCadastrosDaRef(ref: RelatorioMensalRef, cadastros: Usuario[]): Usuario[] {
  if (ref.colaboradores.length === 0) return cadastros
  return cadastros.filter(u =>
    ref.colaboradores.some(
      c =>
        (c.unidade ?? '').trim() === (u.unidade ?? '').trim() &&
        normLogin(c.codusuario) === normLogin(u.codusuario ?? '')
    )
  )
}

export async function montarPdfRelatorioMensalDeReferencia(
  ref: RelatorioMensalRef,
  mesRefOverride?: string
): Promise<{ doc: jsPDF; nomeArquivo: string; mesRef: string; qtdColaboradores: number }> {
  const mesRef = (mesRefOverride?.trim() || mesReferenciaAtual()).slice(0, 7)
  const limites = limitesMesReferencia(mesRef)
  if (!limites) throw new Error('Mês de referência inválido.')

  const users = await getAllUsuarios(undefined)
  const colaboradores: PdfColaboradorSetor[] = []

  for (const k of loginsDaReferencia(ref)) {
    const grupo = agruparUsuariosPorLogin(users).find(g => normLogin(g.codusuario) === k)
    const termo = grupo?.codusuario ?? k
    const resolvido = resolverCadastrosDoUsuario(users, termo)
    if (!resolvido.ok) continue

    const cadastros = filtrarCadastrosDaRef(ref, resolvido.cadastros)
    if (cadastros.length === 0) continue

    colaboradores.push({
      login: resolvido.login,
      nome: resolvido.nome,
      email: cadastros.find(u => u.email)?.email ?? cadastros[0]?.email ?? '',
      cadastros,
    })
  }

  colaboradores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  if (colaboradores.length === 0) {
    throw new Error('Não foi possível montar os colaboradores desta referência (cadastros em GUSUARIO).')
  }

  const doc = gerarPdfRelatorioMensalSetor({
    mesRef,
    periodoDe: limites.de,
    periodoAte: limites.ate,
    nomeSetor: ref.nomeSetor,
    assinanteNome: ref.assinanteNome,
    assinanteLogin: ref.assinanteLogin,
    assinanteCargo: ref.assinanteCargo,
    colaboradores,
  })

  const nomeArquivo = `papersign-relatorio-mensal-${slugArquivo(ref.nomeSetor)}-${mesRef}.pdf`
  return { doc, nomeArquivo, mesRef, qtdColaboradores: colaboradores.length }
}
