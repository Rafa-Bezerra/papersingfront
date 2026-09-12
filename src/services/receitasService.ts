import { API_BASE, headers } from "@/utils/constants";

export type ReceitasUnidadeInfo = {
  codigo: string;
  label: string;
  permiteUpload: boolean;
  pendenteExigeIdlanNull: boolean;
  emStandby: boolean;
  podeConsultar: boolean;
  podeUpload: boolean;
  podeProcessar: boolean;
  modoCsc: boolean;
};

export type ReceitasUnidadesResponse = {
  unidadeLogin: string;
  admin: boolean;
  csc: boolean;
  unidades: ReceitasUnidadeInfo[];
};

export type ReceitasPendentesGrupo = {
  numPraca: string;
  tipoArrecadacao: string;
  quantidade: number;
  valorTotal: number;
  primeiraData?: string | null;
  ultimaData?: string | null;
};

export type ReceitasPendentesResumo = {
  codigo: string;
  label: string;
  totalPendente: number;
  totalComValor: number;
  totalValorZero: number;
  valorTotalPendente: number;
  erro?: string | null;
  emStandby?: boolean;
  porPracaTipo: ReceitasPendentesGrupo[];
};

export type ReceitasUploadLogItem = {
  id: number;
  unidadeCodigo: string;
  usuario: string;
  dataUpload: string;
  nomeArquivo?: string | null;
  qtdeLinhas: number;
  valorTotal: number;
};

export type ReceitasUploadResultado = {
  inseridos: number;
  ignorados: number;
  valorInserido: number;
  valorTotalPendenteApos: number;
  avisos: string[];
};

export type ReceitasLoteResultado = {
  codigo: string;
  label: string;
  confirmado: boolean;
  commitEfetuado: boolean;
  validacaoOk: boolean;
  mensagens: string[];
  totalProcessados: number;
  totalComValor: number;
  totalValorZero: number;
  valorTotalProcessado: number;
  totalFlanGerados: number;
  valorTotalFlan: number;
  totalRateios: number;
  valorTotalRateio: number;
  totalComplementos: number;
  semFlan: number;
  valorZeroInconsistente: number;
  idlanDuplicados: number;
  aindaPendentes: number;
  valorAindaPendente: number;
};

async function readError(res: Response): Promise<string> {
  const msg = await res.text();
  return msg || `Erro ${res.status}`;
}

export async function getUnidadesReceitas(): Promise<ReceitasUnidadesResponse> {
  const res = await fetch(`${API_BASE}/api/Receitas/unidades`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getPendentes(codigo: string): Promise<ReceitasPendentesResumo> {
  const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/pendentes`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getConsultaCsc(): Promise<ReceitasPendentesResumo[]> {
  const res = await fetch(`${API_BASE}/api/Receitas/consulta`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getUploadsReceitas(codigo: string): Promise<ReceitasUploadLogItem[]> {
  const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/uploads`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function uploadPlanilha(codigo: string, arquivo: File): Promise<ReceitasUploadResultado> {
  const form = new FormData();
  form.append("arquivo", arquivo);
  const token = sessionStorage.getItem("authToken");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(await readError(res));
    return res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new Error("O envio demorou demais. Verifique a conexão com a base e tente de novo.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function cancelarPendentes(codigo: string): Promise<{
  codigo: string
  label: string
  excluidos: number
  valorExcluido: number
}> {
  const res = await fetch(
    `${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/cancelar-pendentes`,
    { method: "POST", headers: headers() }
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function processarLote(codigo: string, confirmar: boolean): Promise<ReceitasLoteResultado> {
  const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/processar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ confirmar }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export function formatMoney(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
