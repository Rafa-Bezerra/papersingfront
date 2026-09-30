import { API_BASE, headers } from '@/utils/constants'

export type HistoricoUsuarioEvento = {
  categoria: string
  modulo: string
  unidade: string
  dataHora: string
  titulo: string
  detalhe: string
  referencia?: string | null
}

export type HistoricoUsuarioResposta = {
  login: string
  nome: string
  loginsConsultados: string[]
  eventos: HistoricoUsuarioEvento[]
  contagemPorCategoria: Record<string, number>
}

export async function listarHistoricoAtividadesUsuario(params: {
  codusuario: string
  de?: string
  ate?: string
  top?: number
}): Promise<HistoricoUsuarioResposta> {
  const qs = new URLSearchParams()
  qs.set('codusuario', params.codusuario.trim())
  if (params.de) qs.set('de', params.de)
  if (params.ate) qs.set('ate', params.ate)
  if (params.top) qs.set('top', String(params.top))

  const urls = [
    `${API_BASE}/api/HistoricoUsuario?${qs}`,
    `${API_BASE}/api/Usuarios/historico-atividades?${qs}`,
  ]

  let res: Response | null = null
  let lastMsg = ''
  for (const url of urls) {
    res = await fetch(url, { headers: headers() })
    if (res.ok) break
    lastMsg = await res.text()
    if (res.status !== 404) break
  }
  if (!res?.ok) {
    const hint =
      res?.status === 404
        ? ' Endpoint não encontrado — reinicie a API local (dotnet run na pasta papersing) ou faça deploy da API atualizada.'
        : ''
    throw new Error((lastMsg?.trim() || `Erro ${res?.status ?? 0} ao buscar histórico`) + hint)
  }

  const data = (await res.json()) as Record<string, unknown>
  const eventosRaw = (data.eventos ?? data.Eventos ?? []) as Record<string, unknown>[]

  return {
    login: String(data.login ?? data.Login ?? ''),
    nome: String(data.nome ?? data.Nome ?? ''),
    loginsConsultados: (data.loginsConsultados ?? data.LoginsConsultados ?? []) as string[],
    contagemPorCategoria: (data.contagemPorCategoria ?? data.ContagemPorCategoria ?? {}) as Record<
      string,
      number
    >,
    eventos: eventosRaw.map(r => ({
      categoria: String(r.categoria ?? r.Categoria ?? ''),
      modulo: String(r.modulo ?? r.Modulo ?? ''),
      unidade: String(r.unidade ?? r.Unidade ?? ''),
      dataHora: String(r.dataHora ?? r.DataHora ?? ''),
      titulo: String(r.titulo ?? r.Titulo ?? ''),
      detalhe: String(r.detalhe ?? r.Detalhe ?? ''),
      referencia: (r.referencia ?? r.Referencia) as string | null | undefined,
    })),
  }
}
