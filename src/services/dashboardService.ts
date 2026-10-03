import { DashboardStats } from "@/types/Dashboard";
import { API_BASE, fetchJson, HOME_API_TIMEOUT_MS } from "@/utils/constants";


export async function getDashboardStats(): Promise<DashboardStats | null> {
  const token = sessionStorage.getItem('authToken')?.trim()
  if (!token) return null

  try {
    return await fetchJson<DashboardStats>(
      `${API_BASE}/api/Dashboard/stats`,
      {},
      'Erro ao buscar estatísticas',
      HOME_API_TIMEOUT_MS
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar estatísticas'
    if (message.includes('401')) return null
    throw new Error(
      message.startsWith('Erro') ? message : `Erro ao buscar estatísticas: ${message}`
    )
  }
}

export type { DashboardStats }
