import { API_BASE, headers } from '@/utils/constants'

export type SubstituicaoPeriodo = {
  id: number
  unidade: string
  titular: string
  nome_titular: string
  substituto: string
  nome_substituto: string
  data_inicio: string
  data_fim: string
  status: string
  qtd_linhas: number
  criado_por?: string | null
  criado_em: string
  encerrado_em?: string | null
  observacao?: string | null
  dias_restantes?: number | null
}

export type SubstituicaoLinha = {
  id: number
  id_alcada: number
  centro_custo: string
  centro_custo_nome: string
  aprovador_atual: string
  nome_aprovador_atual: string
  substituto?: string | null
  usuario_original?: string | null
  cargo: string
  nivel: number
  valor_inicial: number
  valor_final: number
  unidade: string
}

export type SubstituicaoPreview = {
  total: number
  por_unidade: { unidade: string; qtd: number }[]
  linhas: SubstituicaoLinha[]
}

export type SubstituicaoAplicarPayload = {
  titular: string
  substituto: string
  data_inicio: string
  data_fim: string
  observacao?: string
}

const caminho = 'SubstituicaoAprovadores'

async function lerErro(res: Response, fallback: string) {
  const msg = await res.text()
  throw new Error(msg || fallback)
}

export async function buscarUsuariosSubstituicao(
  q = '',
  somenteAprovadores = false
): Promise<SubstituicaoUsuario[]> {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (somenteAprovadores) params.set('somenteAprovadores', 'true')
  const qs = params.toString()
  const res = await fetch(
    `${API_BASE}/api/${caminho}/usuarios${qs ? `?${qs}` : ''}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro ao buscar usuários.')
  const list = await res.json()
  return (Array.isArray(list) ? list : []).map((u: Record<string, unknown>) => ({
    codusuario: String(u.codusuario ?? u.CODUSUARIO ?? ''),
    nome: String(u.nome ?? u.NOME ?? ''),
    email: (u.email ?? u.EMAIL ?? null) as string | null,
  })).filter((u: SubstituicaoUsuario) => !!u.codusuario)
}

export type SubstituicaoUsuario = {
  codusuario: string
  nome: string
  email?: string | null
}

export async function listarPeriodos(
  q = '',
  status = 'todos'
): Promise<SubstituicaoPeriodo[]> {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (status && status !== 'todos') params.set('status', status)
  const qs = params.toString()
  const res = await fetch(
    `${API_BASE}/api/${caminho}/periodos${qs ? `?${qs}` : ''}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro ao listar substituições.')
  return res.json()
}

export async function previewTitular(titular: string): Promise<SubstituicaoPreview> {
  const params = new URLSearchParams({ titular: titular.trim() })
  const res = await fetch(
    `${API_BASE}/api/${caminho}/preview?${params}`,
    { headers: headers() }
  )
  if (!res.ok) await lerErro(res, 'Erro ao carregar alçadas do titular.')
  const data = await res.json()
  if (Array.isArray(data)) {
    return { total: data.length, por_unidade: [], linhas: data }
  }
  return {
    total: Number(data.total ?? data.linhas?.length ?? 0),
    por_unidade: Array.isArray(data.por_unidade) ? data.por_unidade : [],
    linhas: Array.isArray(data.linhas) ? data.linhas : [],
  }
}

export async function aplicarSubstituicao(
  payload: SubstituicaoAplicarPayload
): Promise<{
  id: number
  afetados: number
  por_unidade?: { unidade: string; qtd: number }[]
}> {
  const res = await fetch(`${API_BASE}/api/${caminho}/aplicar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) await lerErro(res, 'Erro ao aplicar substituição.')
  return res.json()
}

export async function encerrarSubstituicao(
  id: number
): Promise<{ id: number; afetados: number }> {
  const res = await fetch(`${API_BASE}/api/${caminho}/encerrar/${id}`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) await lerErro(res, 'Erro ao encerrar substituição.')
  return res.json()
}
