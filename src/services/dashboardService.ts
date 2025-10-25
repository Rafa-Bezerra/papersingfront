import { API_BASE, headers } from "@/utils/constants";

export interface DashboardStats {
  documentos: number;
  aprovados: number;
  aprovados_hoje: number;
  em_andamento: number;
  concluidos: number;
  pendentes: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/Dashboard/stats`, { headers: headers(), });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Erro ${res.status} ao buscar estatísticas: ${msg}`);
  }

  return await res.json();
}
