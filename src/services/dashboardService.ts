import { DashboardStats } from "@/types/Dashboard";
import { API_BASE, headers } from "@/utils/constants";


export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/Dashboard/stats`, { headers: headers(), });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Erro ${res.status} ao buscar estatísticas: ${msg}`);
  }

  return await res.json();
}

export type { DashboardStats }