import { DashboardStats } from "@/types/Dashboard";
import { API_BASE, headers } from "@/utils/constants";


export async function getDashboardStats(): Promise<DashboardStats | null> {
  const token = sessionStorage.getItem('authToken')?.trim()
  if (!token) return null

  const res = await fetch(`${API_BASE}/api/Dashboard/stats`, { headers: headers() })

  if (res.status === 401) {
    return null
  }

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Erro ${res.status} ao buscar estatísticas: ${msg}`)
  }

  return await res.json()
}

export type { DashboardStats }