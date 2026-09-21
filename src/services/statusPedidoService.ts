import { API_BASE, fetchJson } from "@/utils/constants";

export type StatusPedidoConsulta = {
  unidade: string;
  idmov: number;
  codatendimento: number | null;
  codstatus: string | null;
  status_descricao: string | null;
};

export type StatusPedidoConclusao = {
  ok: boolean;
  mensagem: string;
  unidade: string;
  idmov: number;
  codatendimento: number;
  codstatus_anterior: string | null;
  codstatus_atual: string;
};

/** Unidades Corpore suportadas (espelha StatusPedidoController). */
export const UNIDADES_STATUS_PEDIDO = [
  "WAY 112",
  "WAY 153",
  "WAY 262",
  "WAY 306",
  "WAY 364",
] as const;

export async function consultarStatusPedido(
  unidade: string,
  idmov: number
): Promise<StatusPedidoConsulta> {
  const url = new URL(`${API_BASE}/api/StatusPedido/consultar`);
  url.searchParams.set("unidade", unidade);
  url.searchParams.set("idmov", String(idmov));
  return fetchJson<StatusPedidoConsulta>(
    url.toString(),
    undefined,
    "Erro ao consultar pedido"
  );
}

export async function concluirStatusPedido(
  unidade: string,
  idmov: number
): Promise<StatusPedidoConclusao> {
  return fetchJson<StatusPedidoConclusao>(
    `${API_BASE}/api/StatusPedido/concluir`,
    {
      method: "POST",
      body: JSON.stringify({ unidade, idmov }),
    },
    "Erro ao concluir pedido"
  );
}
