import { API_BASE, headers } from '@/utils/constants'
import { buscarUsuariosSubstituicao, SubstituicaoUsuario } from '@/services/substituicaoAprovadoresService'

export type { SubstituicaoUsuario as TransferenciaUsuario }

const caminho = 'TransferenciaAlcadas'

async function lerErro(res: Response, fallback: string) {
  const msg = await res.text()
  throw new Error(msg || fallback)
}

export type TransferenciaTipo = 'DEMISSAO' | 'ADMISSAO' | 'TRANSFERENCIA'

export type TransferenciaHistorico = {
  id: number
  tipo: string
  colaborador: string
  nome_colaborador: string
  destino_saida?: string | null
  nome_destino?: string | null
  origem_heranca?: string | null
  nome_origem?: string | null
  qtd_saida: number
  qtd_entrada: number
  observacao?: string | null
  criado_por?: string | null
  data_criacao: string
}

export type TransferenciaLinha = {
  id: number
  id_alcada: number
  centro_custo: string
  centro_custo_nome: string
  aprovador_atual: string
  nome_aprovador: string
  cargo: string
  nivel: number
  unidade: string
}

export type TransferenciaLote = {
  total: number
  por_unidade: { unidade: string; qtd: number }[]
  linhas: TransferenciaLinha[]
}

export type TransferenciaPreview = {
  saida: TransferenciaLote
  entrada: TransferenciaLote
}

export type TransferenciaAplicarPayload = {
  tipo: TransferenciaTipo
  colaborador: string
  destino_saida?: string
  origem_heranca?: string
  unidades_saida?: string
  unidades_entrada?: string
  observacao?: string
}

export async function buscarUsuariosTransferencia(
  q = '',
  somenteAprovadores = false
): Promise<SubstituicaoUsuario[]> {
  return buscarUsuariosSubstituicao(q, somenteAprovadores)
}

export async function listarHistoricoTransferencia(q = ''): Promise<TransferenciaHistorico[]> {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  const qs = params.toString()
  const res = await fetch(
    `${API_BASE}/api/${caminho}/historico${qs ? `?${qs}` : ''}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro ao listar histórico.')
  return res.json()
}

export async function unidadesDoAprovador(
  codusuario: string
): Promise<{ unidade: string; qtd: number }[]> {
  const params = new URLSearchParams({ codusuario })
  const res = await fetch(
    `${API_BASE}/api/${caminho}/unidades?${params}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro ao listar unidades.')
  return res.json()
}

export async function previewTransferencia(opts: {
  colaborador?: string
  destinoSaida?: string
  origemHeranca?: string
  unidadesSaida?: string[]
  unidadesEntrada?: string[]
}): Promise<TransferenciaPreview> {
  const params = new URLSearchParams()
  if (opts.colaborador) params.set('colaborador', opts.colaborador)
  if (opts.destinoSaida) params.set('destinoSaida', opts.destinoSaida)
  if (opts.origemHeranca) params.set('origemHeranca', opts.origemHeranca)
  if (opts.unidadesSaida?.length)
    params.set('unidadesSaida', opts.unidadesSaida.join(','))
  if (opts.unidadesEntrada?.length)
    params.set('unidadesEntrada', opts.unidadesEntrada.join(','))

  const res = await fetch(
    `${API_BASE}/api/${caminho}/preview?${params}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro na prévia.')
  return res.json()
}

export async function aplicarTransferencia(
  payload: TransferenciaAplicarPayload
): Promise<{ id: number; qtd_saida: number; qtd_entrada: number }> {
  const res = await fetch(`${API_BASE}/api/${caminho}/aplicar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) await lerErro(res, 'Erro ao aplicar transferência.')
  return res.json()
}
