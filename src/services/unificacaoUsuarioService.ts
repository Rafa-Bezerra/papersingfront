import { API_BASE, headers } from '@/utils/constants'

const caminho = 'UnificacaoUsuario'

export type UnificacaoUsuarioItem = {
  codusuario: string
  nome: string
}

export type UnificacaoLinha = {
  tabela: string
  coluna: string
  quantidade: number
}

export type UnificacaoGusuario = {
  sequencial: number
  codusuario: string
  nome: string
  unidade: string
  email: string
  ativo: boolean
  eh_chapa: boolean
  eh_nominal: boolean
}

export type UnificacaoPreview = {
  chapa: string
  nominal: string
  total_referencias: number
  linhas: UnificacaoLinha[]
  gusuarios: UnificacaoGusuario[]
  avisos: string[]
  pode_aplicar: boolean
}

export type UnificacaoResultado = {
  chapa: string
  nominal: string
  total_atualizado: number
  linhas: UnificacaoLinha[]
  gusuario: {
    acao: string
    unidades_renomeadas: number
    unidades_mescladas: number
    unidades_removidas: number
  }
}

async function lerErro(res: Response, fallback: string) {
  const msg = await res.text()
  throw new Error(msg || fallback)
}

export async function buscarUsuariosUnificacao(q = ''): Promise<UnificacaoUsuarioItem[]> {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
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
  })).filter((u: UnificacaoUsuarioItem) => !!u.codusuario)
}

export async function previewUnificacaoUsuario(
  chapa: string,
  nominal: string
): Promise<UnificacaoPreview> {
  const params = new URLSearchParams({
    chapa: chapa.trim(),
    nominal: nominal.trim(),
  })
  const res = await fetch(`${API_BASE}/api/${caminho}/preview?${params}`, {
    headers: headers(),
  })
  if (!res.ok) await lerErro(res, 'Erro ao simular unificação.')
  return res.json()
}

export async function aplicarUnificacaoUsuario(
  chapa: string,
  nominal: string,
  observacao?: string
): Promise<UnificacaoResultado> {
  const res = await fetch(`${API_BASE}/api/${caminho}/aplicar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ chapa: chapa.trim(), nominal: nominal.trim(), observacao }),
  })
  if (!res.ok) await lerErro(res, 'Erro ao aplicar unificação.')
  return res.json()
}
