import { API_BASE, headers } from "@/utils/constants";

export interface DashboardStats {
  documentos: number;
  aprovados: number;
  pendentes: number;
  aprovados_hoje: number;
  em_andamento: number;
  concluido_a_responder: number;
  concluido_respondido: number;
  concluido_confirmado: number;
  concluido_automatico: number;
  avaliado: number;
  agendado_a_responder: number;
  agendado_respondido: number;
  aguardando_terceiros: number;
  cancelado: number;
  despertado: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/Dashboard/stats`, { headers: headers(), });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Erro ${res.status} ao buscar estatísticas: ${msg}`);
  }

  return await res.json();
}
