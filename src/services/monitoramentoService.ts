import { API_BASE, fetchJson, headers } from '@/utils/constants'

const BASE = () => `${API_BASE}/api/monitoramento`

export type MonitorAlvoPainel = {
  nome: string
  tipo: string
  unidade?: string | null
  endereco: string
  status: string
  foraDesde?: string | null
  falhasSeguidas: number
  ultimoErro?: string | null
  ultimaVerificacao?: string | null
  tempoRespostaMs?: number | null
}

export type MonitorPainel = {
  habilitado: boolean
  ultimoCicloEm?: string | null
  proximoCicloEm?: string | null
  alvos: MonitorAlvoPainel[]
}

export type MonitorEvento = {
  id: number
  dataHora: string
  alvo: string
  endereco?: string | null
  evento: string
  erro?: string | null
  minutosFora?: number | null
}

export type MonitorDestinatario = {
  id: number
  unidade: string
  codUsuario: string
  nome: string
  email: string
  ativo: boolean
  recebeQueda: boolean
  recebeVolta: boolean
  recebeErroSistema: boolean
  alvos?: string | null
  recCreatedOn?: string | null
  recCreatedBy?: string | null
  recModifiedOn?: string | null
  recModifiedBy?: string | null
}

export type ErroSistemaItem = {
  id: number
  dataHora: string
  unidade?: string | null
  codUsuario?: string | null
  metodo: string
  rota: string
  modulo?: string | null
  statusHttp: number
  mensagemUsuario?: string | null
  tipoExcecao?: string | null
  mensagemTecnica?: string | null
  stackTrace?: string | null
  assinatura: string
  traceId?: string | null
  emailEnviado: boolean
}

export type ErroSistemaGrupo = {
  assinatura: string
  total: number
  ultimo: string
  usuariosDistintos: number
  modulo?: string | null
  rota?: string | null
  mensagemUsuario?: string | null
  tipoExcecao?: string | null
  ultimoId: number
}

export type MonitorUsuarioBusca = {
  unidade: string
  codUsuario: string
  nome: string
  email: string
}

export async function getPainel(): Promise<MonitorPainel> {
  return fetchJson<MonitorPainel>(`${BASE()}/painel`, undefined, 'Erro ao carregar painel')
}

export async function verificarAgora(): Promise<MonitorPainel> {
  return fetchJson<MonitorPainel>(
    `${BASE()}/verificar-agora`,
    { method: 'POST' },
    'Erro ao verificar agora',
    120_000
  )
}

export async function getAlvos(): Promise<string[]> {
  return fetchJson<string[]>(`${BASE()}/alvos`, undefined, 'Erro ao listar alvos')
}

export async function getEventos(dias = 30, alvo?: string): Promise<MonitorEvento[]> {
  const q = new URLSearchParams({ dias: String(dias) })
  if (alvo) q.set('alvo', alvo)
  return fetchJson<MonitorEvento[]>(`${BASE()}/eventos?${q}`, undefined, 'Erro ao listar eventos')
}

export async function buscarUsuarios(busca: string): Promise<MonitorUsuarioBusca[]> {
  const q = new URLSearchParams({ busca })
  return fetchJson<MonitorUsuarioBusca[]>(`${BASE()}/usuarios?${q}`, undefined, 'Erro ao buscar usuários')
}

export async function getDestinatarios(): Promise<MonitorDestinatario[]> {
  return fetchJson<MonitorDestinatario[]>(`${BASE()}/destinatarios`, undefined, 'Erro ao listar destinatários')
}

export async function criarDestinatario(data: {
  unidade: string
  codUsuario: string
  recebeQueda: boolean
  recebeVolta: boolean
  recebeErroSistema?: boolean
  alvos?: string | null
  ativo?: boolean
}): Promise<MonitorDestinatario> {
  return fetchJson<MonitorDestinatario>(
    `${BASE()}/destinatarios`,
    { method: 'POST', headers: headers(), body: JSON.stringify(data) },
    'Erro ao criar destinatário'
  )
}

export async function getErrosSistema(params: {
  dias?: number
  modulo?: string
  unidade?: string
  busca?: string
  agrupar?: boolean
}): Promise<ErroSistemaItem[] | ErroSistemaGrupo[]> {
  const q = new URLSearchParams()
  q.set('dias', String(params.dias ?? 7))
  if (params.modulo) q.set('modulo', params.modulo)
  if (params.unidade) q.set('unidade', params.unidade)
  if (params.busca) q.set('busca', params.busca)
  if (params.agrupar) q.set('agrupar', 'true')
  return fetchJson(`${BASE()}/erros?${q}`, undefined, 'Erro ao listar erros de sistema')
}

export async function getErroSistema(id: number): Promise<ErroSistemaItem> {
  return fetchJson<ErroSistemaItem>(`${BASE()}/erros/${id}`, undefined, 'Erro ao carregar detalhe')
}

export async function atualizarDestinatario(
  id: number,
  data: Partial<MonitorDestinatario>
): Promise<MonitorDestinatario> {
  return fetchJson<MonitorDestinatario>(
    `${BASE()}/destinatarios/${id}`,
    { method: 'PUT', headers: headers(), body: JSON.stringify(data) },
    'Erro ao atualizar destinatário'
  )
}

export async function desativarDestinatario(id: number): Promise<void> {
  await fetchJson(`${BASE()}/destinatarios/${id}`, { method: 'DELETE' }, 'Erro ao desativar destinatário')
}

export async function testeDestinatario(id: number): Promise<void> {
  await fetchJson(`${BASE()}/destinatarios/${id}/teste`, { method: 'POST' }, 'Erro ao enviar teste')
}
