import { API_BASE, headers } from '@/utils/constants'

export type WayOneModuleSsoSession = {
  tokens: Record<string, unknown>
  user: Record<string, unknown>
}

async function fetchModuleSession(path: string): Promise<WayOneModuleSsoSession> {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers() })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Erro ${res.status} ao obter sessão WayOne.`)
  }
  return res.json() as Promise<WayOneModuleSsoSession>
}

export function getRq08Session(): Promise<WayOneModuleSsoSession> {
  return fetchModuleSession('/api/WayOne/rq08/session')
}

export function getIndicadoresSession(): Promise<WayOneModuleSsoSession> {
  return fetchModuleSession('/api/WayOne/indicadores/session')
}
