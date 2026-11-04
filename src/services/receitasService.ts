import { API_BASE, headers } from "@/utils/constants";

export type ReceitasUnidadeInfo = {
  codigo: string;
  label: string;
  permiteUpload: boolean;
  pendenteExigeIdlanNull: boolean;
  /** Conferência praça×dia (integrador → 2030): WAY 112 e 306 quando habilitado na API. */
  conferenciaCompletude?: boolean;
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

export type ReceitasHistoricoItem = {
  id: number;
  tipo: "UPLOAD" | "PROCESSAMENTO";
  unidadeCodigo: string;
  usuario: string;
  dataHora: string;
  nomeArquivo?: string | null;
  qtdeLinhas: number;
  valorTotal: number;
  valorFlan?: number | null;
};

export type ReceitasUploadResultado = {
  inseridos: number;
  ignorados: number;
  valorInserido: number;
  valorTotalPendenteApos: number;
  avisos: string[];
};

export type ReceitasConferenciaProblema = {
  praca: string;
  dia: string;
  tiposRecebidos: string;
  linhas: number;
  valor: number;
  problema: string;
  tipoArrecadacao?: string | null;
};

export type ReceitasConferenciaResumo = {
  totalPeriodo: number;
  totalPendente: number;
  totalIntegrado: number;
  qtdProblemas: number;
};

export type ReceitasConferenciaResultado = {
  codigo: string;
  label: string;
  dataIni: string;
  dataFim: string;
  resumo: ReceitasConferenciaResumo;
  problemas: ReceitasConferenciaProblema[];
};

export type ReceitasResumoPracaDiaItem = {
  praca: string;
  dia: string;
  tipo10: number;
  tipo13: number;
  tipo8: number;
  tipo2: number;
  tipo6: number;
  tipo7: number;
  tipo14: number;
  tipo15: number;
  total: number;
  qtdTiposDistintos: number;
};

export type ReceitasResumoPracaDiaResultado = {
  codigo: string;
  label: string;
  dataIni: string;
  dataFim: string;
  linhas: ReceitasResumoPracaDiaItem[];
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
  conferencia?: ReceitasConferenciaResultado | null;
  conferenciaBloqueou?: boolean;
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

export async function getHistoricoReceitas(codigo: string): Promise<ReceitasHistoricoItem[]> {
  const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/historico`, {
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

export async function getConferenciaReceitas(
  codigo: string,
  dataIni: string,
  dataFim: string
): Promise<ReceitasConferenciaResultado> {
  const q = new URLSearchParams({
    codigo,
    dataIni,
    dataFim,
  });
  const res = await fetch(`${API_BASE}/api/Receitas/conferencia?${q}`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function getResumoPorPracaReceitas(
  codigo: string,
  dataIni: string,
  dataFim: string
): Promise<ReceitasResumoPracaDiaResultado> {
  const q = new URLSearchParams({
    codigo,
    dataIni,
    dataFim,
  });
  const res = await fetch(`${API_BASE}/api/Receitas/resumo-por-praca?${q}`, { headers: headers() });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function processarLote(
  codigo: string,
  confirmar: boolean,
  opts?: { dataIniConferencia?: string; dataFimConferencia?: string }
): Promise<ReceitasLoteResultado> {
  const res = await fetch(`${API_BASE}/api/Receitas/${encodeURIComponent(codigo)}/processar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      confirmar,
      dataIniConferencia: opts?.dataIniConferencia,
      dataFimConferencia: opts?.dataFimConferencia,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export function labelProblemaConferencia(codigo: string): string {
  switch (codigo) {
    case "DIA_NAO_RECEBIDO":
      return "Dia não recebido";
    case "DIA_INCOMPLETO":
      return "Dia incompleto";
    case "LINHA_DUPLICADA":
      return "Linha duplicada";
    case "SEM_DEPARA":
      return "Sem de-para (ZMDREFERENCIA)";
    default:
      return codigo;
  }
}

export function formatMoney(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
