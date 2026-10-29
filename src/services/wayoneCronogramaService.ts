import { API_BASE, headers } from '@/utils/constants'

export type CronogramaSsoSession = {
  token: string
  user: Record<string, unknown>
  workspace: string
}

export async function getCronogramaSession(): Promise<CronogramaSsoSession> {
  const res = await fetch(`${API_BASE}/api/WayOne/cronograma/session`, { headers: headers() })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || `Erro ${res.status} ao obter sessão do Cronograma.`)
  }
  return res.json() as Promise<CronogramaSsoSession>
}
