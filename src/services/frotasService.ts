import { API_BASE, apiFetch, headers } from "@/utils/constants";

const caminho = "Frotas";

/** Unidades com cadastro de veículos no RM (OFOBJOFICINA). O backend resolve o banco de cada uma. */
export const UNIDADES_FROTAS = ["WAY 112", "WAY 153", "WAY 262", "WAY 306", "WAY 364", "WAY CSC"] as const;

/** Unidades operacionais (RM de frota). WAY CSC não tem OFOBJOFICINA — só troca de unidade na tela. */
export const UNIDADES_FROTAS_RM = UNIDADES_FROTAS.filter((u) => u !== "WAY CSC");

export type FrotaSubmodelo = {
  codsubmodelo: number;
  descricao: string;
};

export type FrotaModelo = {
  codmodelo: number;
  modelo: string;
  fabricante?: string | null;
  submodelos: FrotaSubmodelo[];
};

export type FrotaPlaca = {
  placa: string;
  frota?: string | null;
  codmodelo: number;
  modelo: string;
  codsubmodelo: number;
  submodelo: string;
  anomodelo?: number | null;
  anofabr?: number | null;
  status?: string | null;
  status_descricao?: string | null;
  ativo: boolean;
  criado_por?: string | null;
  criado_em?: string | null;
  responsavel_id?: number | null;
  responsavel_nome?: string | null;
  responsavel_setor?: string | null;
  responsavel_telefone?: string | null;
  responsavel_desde?: string | null;
  tem_cnh?: boolean;
  cnh_validade?: string | null;
  cnh_doc_id?: number | null;
  cnh_arquivo?: string | null;
  tem_crlv?: boolean;
  crlv_validade?: string | null;
  crlv_doc_id?: number | null;
  crlv_arquivo?: string | null;
  /** Validade mais recente de cada tipo de documento (CNH só a do responsável atual). */
  validades?: { tipo: string; validade?: string | null }[];
};

export type FrotaResponsavel = {
  id: number;
  nome: string;
  matricula?: string | null;
  setor?: string | null;
  telefone?: string | null;
  observacao?: string | null;
  data_inicio: string;
  usuario: string;
  usuario_nome?: string | null;
  data_fim?: string | null;
  motivo_fim?: string | null;
};

export type DefinirResponsavelPayload = {
  unidade: string;
  placa: string;
  nome: string;
  matricula?: string;
  setor?: string;
  telefone?: string;
  observacao?: string;
};

export type FrotaHistorico = {
  id: number;
  unidade: string;
  placa: string;
  acao: "CADASTRAR" | "DESATIVAR" | string;
  usuario: string;
  usuario_nome?: string | null;
  motivo?: string | null;
  detalhe?: string | null;
  data_hora: string;
};

export type CadastroPlacasPayload = {
  unidade: string;
  placas: { placa: string; frota?: string }[];
  /** Modelo existente; se ausente, o backend cria `novo_modelo` (formato "MARCA/MODELO"). */
  codmodelo?: number;
  novo_modelo?: { marca: string; modelo: string };
  /** Submodelo existente do modelo; se ausente, o backend cria `novo_submodelo`. */
  codsubmodelo?: number;
  novo_submodelo?: string;
  anomodelo?: number;
  anofabr?: number;
  /** true: roda o cadastro no RM e desfaz no fim (nada é gravado). */
  simular?: boolean;
};

export type CadastroPlacaResultado = {
  placa: string;
  status: "criado" | "ja_existe" | "erro";
  mensagem?: string;
};

export type CadastroPlacasResposta = {
  unidade: string;
  codmodelo: number;
  codsubmodelo: number;
  modelo_criado: boolean;
  submodelo_criado: boolean;
  resultados: CadastroPlacaResultado[];
  simulacao?: boolean;
};

/** Placa sem hífen/espaço, em maiúsculas (é assim que fica em OFOBJOFICINA.IDOBJOF). */
export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[\s-]/g, "");
}

/** Padrão antigo (ABC1234) e Mercosul (ABC1D23). */
export function placaValida(placa: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string; title?: string };
    return j.message || j.title || text || `Erro ${res.status}`;
  } catch {
    return text || `Erro ${res.status}`;
  }
}

export async function listarModelosFrota(unidade: string): Promise<FrotaModelo[]> {
  const qs = new URLSearchParams({ unidade });
  const res = await fetch(`${API_BASE}/api/${caminho}/modelos?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export async function listarPlacas(unidade: string, busca?: string): Promise<FrotaPlaca[]> {
  const qs = new URLSearchParams({ unidade });
  if (busca?.trim()) qs.set("busca", busca.trim());
  const res = await apiFetch(`${API_BASE}/api/${caminho}/placas?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export async function cadastrarPlacas(data: CadastroPlacasPayload): Promise<CadastroPlacasResposta> {
  const res = await fetch(`${API_BASE}/api/${caminho}/placas`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export type AlterarPlacaPayload = {
  unidade: string;
  placa: string;
  frota?: string;
  codmodelo: number;
  codsubmodelo: number;
  anomodelo?: number;
  anofabr?: number;
  motivo?: string;
};

/** Corrige frota, modelo/submodelo e anos (a placa não muda). O que mudou fica no histórico. */
export async function alterarPlaca(data: AlterarPlacaPayload): Promise<{ placa: string; alteracoes: string[] }> {
  const res = await fetch(`${API_BASE}/api/${caminho}/placas`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

/** Muda o STATUS do veículo no RM para "Inativo"; o motivo fica no histórico. */
export async function desativarPlaca(unidade: string, placa: string, motivo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/placas/desativar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ unidade, placa, motivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

export function unidadeDaSessao(): string {
  if (typeof window === "undefined") return "";
  try {
    const u = JSON.parse(sessionStorage.getItem("userData") ?? "{}") as Record<string, unknown>;
    return String(u.unidade ?? u.UNIDADE ?? "").trim().toUpperCase();
  } catch {
    return "";
  }
}

/** Unidade inicial nas telas de frota: CSC começa na 262 (dados da planilha); demais usam a própria. */
export function unidadeInicialFrotas(): string {
  const propria = unidadeDaSessao();
  if (propria === "WAY CSC") return "WAY 262";
  return (UNIDADES_FROTAS as readonly string[]).includes(propria) ? propria : "";
}

export const TIPOS_DOCUMENTO_FROTA = [
  { valor: "CRLV", rotulo: "CRLV (documento do veículo)" },
  { valor: "CNH", rotulo: "CNH do condutor" },
  { valor: "SEGURO", rotulo: "Apólice de seguro" },
  { valor: "LAUDO", rotulo: "Laudo / vistoria" },
  { valor: "OUTRO", rotulo: "Outro" },
] as const;

export type FrotaDocumento = {
  id: number;
  placa: string;
  tipo: string;
  descricao?: string | null;
  validade?: string | null;
  nome_arquivo: string;
  tamanho?: number | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
};

/** Cabeçalho sem Content-Type: o navegador monta o multipart com o boundary. */
function headersSemContentType(): Record<string, string> {
  const h = headers();
  delete h["Content-Type"];
  return h;
}

export async function listarDocumentosFrota(unidade: string, placa: string): Promise<FrotaDocumento[]> {
  const qs = new URLSearchParams({ unidade, placa });
  const res = await fetch(`${API_BASE}/api/${caminho}/documentos?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export async function enviarDocumentoFrota(data: {
  unidade: string;
  placa: string;
  tipo: string;
  descricao?: string;
  validade?: string;
  arquivo: File;
}): Promise<void> {
  const form = new FormData();
  form.append("unidade", data.unidade);
  form.append("placa", data.placa);
  form.append("tipo", data.tipo);
  if (data.descricao) form.append("descricao", data.descricao);
  if (data.validade) form.append("validade", data.validade);
  form.append("arquivo", data.arquivo);
  const res = await fetch(`${API_BASE}/api/${caminho}/documentos`, {
    method: "POST",
    headers: headersSemContentType(),
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

/** Abre o documento numa aba nova (o download exige login, por isso vem como blob). */
export async function abrirDocumentoFrota(id: number): Promise<void> {
  const aba = window.open("", "_blank");
  const res = await fetch(`${API_BASE}/api/${caminho}/documentos/${id}/arquivo`, { headers: headersSemContentType() });
  if (!res.ok) {
    aba?.close();
    throw new Error(await readErrorMessage(res));
  }
  const url = URL.createObjectURL(await res.blob());
  if (aba) aba.location.href = url;
  else window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Baixa o documento com o nome original do arquivo. */
export async function baixarDocumentoFrota(id: number, nomeArquivo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/documentos/${id}/arquivo?acao=baixar`, { headers: headersSemContentType() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo || `documento-${id}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function excluirDocumentoFrota(id: number, motivo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/documentos/${id}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

export async function listarResponsaveisFrota(unidade: string, placa: string): Promise<FrotaResponsavel[]> {
  const qs = new URLSearchParams({ unidade, placa });
  const res = await fetch(`${API_BASE}/api/${caminho}/responsaveis?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

/** Entrega o veículo a alguém; quem estava com ele antes fica no histórico. */
export async function definirResponsavelFrota(payload: DefinirResponsavelPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/responsaveis`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

export async function devolverVeiculoFrota(unidade: string, placa: string, motivo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/responsaveis/devolver`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ unidade, placa, motivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

export async function listarHistoricoFrota(unidade: string, placa?: string): Promise<FrotaHistorico[]> {
  const qs = new URLSearchParams({ unidade });
  if (placa?.trim()) qs.set("placa", placa.trim());
  const res = await fetch(`${API_BASE}/api/${caminho}/historico?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

// ------------------------------------------------------------------ Manutenção e multas

/** Mesma lista em ClassificacoesManutencao na API. grupo "DESPESA" = custo da frota que fica fora do comparativo de manutenção. */
export const CLASSIFICACOES_MANUTENCAO = [
  { valor: "PREVENTIVA", rotulo: "Preventiva", grupo: "MANUTENCAO" },
  { valor: "CORRETIVA", rotulo: "Corretiva", grupo: "MANUTENCAO" },
  { valor: "FUNILARIA_PINTURA", rotulo: "Funilaria e pintura", grupo: "MANUTENCAO" },
  { valor: "BORRACHARIA", rotulo: "Borracharia", grupo: "MANUTENCAO" },
  { valor: "ALINHAMENTO_BALANCEAMENTO", rotulo: "Alinhamento e balanceamento", grupo: "MANUTENCAO" },
  { valor: "VIDROS", rotulo: "Vidros e para-brisa", grupo: "MANUTENCAO" },
  { valor: "BATERIA", rotulo: "Bateria", grupo: "MANUTENCAO" },
  { valor: "LAVAGEM", rotulo: "Lavagem e higienização", grupo: "MANUTENCAO" },
  { valor: "COMPRA_EMERGENCIAL", rotulo: "Compra emergencial", grupo: "MANUTENCAO" },
  { valor: "SINALIZACAO_PLOTAGEM", rotulo: "Sinalização e plotagem", grupo: "MANUTENCAO" },
  { valor: "GUINCHO", rotulo: "Guincho e socorro", grupo: "MANUTENCAO" },
  { valor: "ABASTECIMENTO", rotulo: "Abastecimento e combustível", grupo: "DESPESA" },
  { valor: "LOCACAO", rotulo: "Locação de veículo", grupo: "DESPESA" },
  { valor: "TELEMETRIA", rotulo: "Telemetria", grupo: "DESPESA" },
  { valor: "DOCUMENTACAO", rotulo: "Documentação veicular", grupo: "DESPESA" },
  { valor: "PEDAGIO", rotulo: "Pedágio (Sem Parar)", grupo: "DESPESA" },
] as const;

/** Classificações que são despesa da frota (não manutenção). Mesma lista em ClassificacoesDespesa na API. */
export const CLASSIFICACOES_DESPESA: ReadonlySet<string> = new Set(
  CLASSIFICACOES_MANUTENCAO.filter((c) => c.grupo === "DESPESA").map((c) => c.valor)
);

/** Tipo de serviço padronizado: base do comparativo de fornecedores. Mesma lista em ServicosManutencao na API. */
export const SERVICOS_MANUTENCAO = [
  { valor: "TROCA_OLEO", rotulo: "Troca de óleo e filtros" },
  { valor: "REVISAO", rotulo: "Revisão programada" },
  { valor: "ALINHAMENTO_BALANCEAMENTO", rotulo: "Alinhamento e balanceamento" },
  { valor: "PNEU_TROCA", rotulo: "Troca de pneu" },
  { valor: "PNEU_CONSERTO", rotulo: "Conserto de pneu" },
  { valor: "FREIOS", rotulo: "Freios" },
  { valor: "SUSPENSAO", rotulo: "Suspensão e amortecedores" },
  { valor: "EMBREAGEM", rotulo: "Embreagem" },
  { valor: "MOTOR", rotulo: "Motor" },
  { valor: "CAMBIO", rotulo: "Câmbio e transmissão" },
  { valor: "ARREFECIMENTO", rotulo: "Arrefecimento e radiador" },
  { valor: "ELETRICA", rotulo: "Elétrica" },
  { valor: "BATERIA", rotulo: "Bateria" },
  { valor: "AR_CONDICIONADO", rotulo: "Ar-condicionado" },
  { valor: "FUNILARIA", rotulo: "Funilaria" },
  { valor: "PINTURA", rotulo: "Pintura" },
  { valor: "VIDROS", rotulo: "Vidros e para-brisa" },
  { valor: "LAVAGEM", rotulo: "Lavagem e higienização" },
  { valor: "GUINCHO", rotulo: "Guincho e socorro" },
  { valor: "OUTRO", rotulo: "Outro" },
] as const;

export const SITUACOES_MULTA = [
  { valor: "A_PAGAR", rotulo: "A pagar" },
  { valor: "PAGA", rotulo: "Paga" },
  { valor: "RECORRIDA", rotulo: "Recorrida" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
  { valor: "NAO_INFORMADA", rotulo: "Não informado" },
] as const;

export const NOTIFICACAO_AUTUACAO = [
  { valor: "NOTIFICACAO", rotulo: "Notificação" },
  { valor: "AUTUACAO", rotulo: "Autuação" },
] as const;

/** Valores usados na planilha "Gestão de multas" (o campo aceita outros). */
export const SUGESTOES_RQ131 = ["ASSINADO", "DISPENSADO", "PRÓPRIO", "EMPRESA", "NÃO CONCORDA", "e-mail enviado", "Minuta Papersign", "REFAZER"];
export const SUGESTOES_REEMBOLSO = ["SIM", "ND EM CONFECÇÃO", "SIM - ND EM CONFECÇÃO", "SIM - REFAZER"];

export type FrotaManutencao = {
  id: number;
  placa: string;
  data_manutencao: string;
  data_conclusao?: string | null;
  classificacao: string;
  descricao: string;
  fornecedor: string;
  fornecedor_cnpj?: string | null;
  valor: number;
  /** Vazio = lançamento antigo, ainda fora do comparativo de fornecedores. */
  servico?: string | null;
  quantidade?: number | null;
  /** Preenchido quando o lançamento é item de uma nota; aí só muda pela aba Notas. */
  id_nota?: number | null;
  numero_nf?: string | null;
  regiao?: string | null;
  nome_arquivo?: string | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
};

export type FrotaMulta = {
  id: number;
  placa: string;
  data_infracao: string;
  auto_infracao?: string | null;
  descricao: string;
  valor: number;
  data_vencimento?: string | null;
  condutor?: string | null;
  /** Condutor do cadastro (aba Condutores); vazio = só o nome digitado. */
  id_condutor?: number | null;
  situacao: string;
  tipo_frota?: string | null;
  setor?: string | null;
  pontuacao?: number | null;
  data_limite_identificacao?: string | null;
  local_infracao?: string | null;
  notificacao_autuacao?: string | null;
  infrator_identificado?: boolean | null;
  fatura?: string | null;
  faturada?: boolean | null;
  numero_pedido?: string | null;
  /** Coluna "Empresa" da planilha: o custo fica com a empresa. */
  empresa_arca?: boolean | null;
  rq131?: string | null;
  reembolso?: string | null;
  descontada?: boolean | null;
  data_desconto?: string | null;
  nome_arquivo?: string | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
};

/** Campos do formulário (datas yyyy-MM-dd, valor "1234.56"); arquivo opcional. */
export type ManutencaoPayload = {
  unidade: string;
  placa: string;
  data_manutencao: string;
  data_conclusao?: string;
  classificacao: string;
  descricao: string;
  fornecedor: string;
  fornecedor_cnpj?: string;
  valor: string;
  servico: string;
  quantidade?: string;
  motivo?: string;
  arquivo?: File | null;
};

export const SITUACOES_DESCONTO = [
  { valor: "DESCONTADA", rotulo: "Já descontada" },
  { valor: "A_DESCONTAR", rotulo: "A descontar" },
  { valor: "EMPRESA", rotulo: "Custo da empresa" },
  { valor: "NAO_SE_APLICA", rotulo: "Cancelada" },
] as const;

/** Mesma regra da API (aba Condutores): só fica "a descontar" se não foi cancelada nem assumida pela empresa. */
export function situacaoDesconto(m: Pick<FrotaMulta, "descontada" | "empresa_arca" | "situacao">): string {
  if (m.descontada) return "DESCONTADA";
  if (m.empresa_arca) return "EMPRESA";
  if (m.situacao === "CANCELADA") return "NAO_SE_APLICA";
  return "A_DESCONTAR";
}

export type MultaPayload = {
  unidade: string;
  placa: string;
  data_infracao: string;
  auto_infracao?: string;
  descricao: string;
  valor: string;
  data_vencimento?: string;
  condutor?: string;
  id_condutor?: string;
  situacao: string;
  tipo_frota?: string;
  setor?: string;
  pontuacao?: string;
  data_limite_identificacao?: string;
  local_infracao?: string;
  notificacao_autuacao?: string;
  /** "SIM", "NAO" ou vazio, como os demais campos sim/não. */
  infrator_identificado?: string;
  fatura?: string;
  faturada?: string;
  numero_pedido?: string;
  empresa_arca?: string;
  rq131?: string;
  reembolso?: string;
  descontada?: string;
  data_desconto?: string;
  motivo?: string;
  arquivo?: File | null;
};

function montarForm(campos: Record<string, string | File | null | undefined>): FormData {
  const form = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor instanceof File) form.append(chave, valor);
    else if (valor != null && valor !== "") form.append(chave, valor);
  }
  return form;
}

async function listarPorPeriodo<T>(recurso: string, unidade: string, de?: string, ate?: string): Promise<T[]> {
  const qs = new URLSearchParams({ unidade });
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);
  const res = await apiFetch(`${API_BASE}/api/${caminho}/${recurso}?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

async function salvarComAnexo(recurso: string, campos: Record<string, string | File | null | undefined>, id?: number) {
  const res = await fetch(`${API_BASE}/api/${caminho}/${recurso}${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    headers: headersSemContentType(),
    body: montarForm(campos),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

async function excluirRegistro(recurso: string, id: number, motivo: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/${recurso}/${id}`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ motivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

async function anexoRegistro(recurso: string, id: number, nomeArquivo?: string | null): Promise<void> {
  if (nomeArquivo !== undefined) {
    const res = await fetch(`${API_BASE}/api/${caminho}/${recurso}/${id}/arquivo?acao=baixar`, { headers: headersSemContentType() });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo || `anexo-${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const aba = window.open("", "_blank");
  const res = await fetch(`${API_BASE}/api/${caminho}/${recurso}/${id}/arquivo`, { headers: headersSemContentType() });
  if (!res.ok) {
    aba?.close();
    throw new Error(await readErrorMessage(res));
  }
  const url = URL.createObjectURL(await res.blob());
  if (aba) aba.location.href = url;
  else window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type FornecedorRm = { codcfo: string; nome: string; nome_fantasia?: string | null; cnpj: string; cidade: string };

/** Fornecedores ativos do RM da unidade (FCFO) por nome, nome fantasia, código ou CNPJ; até 30. */
export async function buscarFornecedoresRm(unidade: string, busca: string): Promise<FornecedorRm[]> {
  const qs = new URLSearchParams({ unidade, busca });
  const res = await fetch(`${API_BASE}/api/${caminho}/fornecedores?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export const listarManutencoes = (unidade: string, de?: string, ate?: string) =>
  listarPorPeriodo<FrotaManutencao>("manutencoes", unidade, de, ate);
export const salvarManutencao = ({ arquivo, ...p }: ManutencaoPayload, id?: number) =>
  salvarComAnexo("manutencoes", { ...p, arquivo }, id);
export const excluirManutencao = (id: number, motivo: string) => excluirRegistro("manutencoes", id, motivo);
/** Sem nome abre numa aba nova; com nome baixa o arquivo. Os dois ficam no histórico. */
export const anexoManutencao = (id: number, nomeParaBaixar?: string | null) => anexoRegistro("manutencoes", id, nomeParaBaixar);

export const listarMultas = (unidade: string, de?: string, ate?: string) =>
  listarPorPeriodo<FrotaMulta>("multas", unidade, de, ate);
export const salvarMulta = ({ arquivo, ...p }: MultaPayload, id?: number) => salvarComAnexo("multas", { ...p, arquivo }, id);
export const excluirMulta = (id: number, motivo: string) => excluirRegistro("multas", id, motivo);
export const anexoMulta = (id: number, nomeParaBaixar?: string | null) => anexoRegistro("multas", id, nomeParaBaixar);

/** Anexa ou substitui só o documento da multa (não altera os demais campos). */
export async function anexarArquivoMulta(id: number, arquivo: File): Promise<string> {
  const res = await fetch(`${API_BASE}/api/${caminho}/multas/${id}/arquivo`, {
    method: "POST",
    headers: headersSemContentType(),
    body: montarForm({ arquivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const corpo = (await res.json()) as { nome_arquivo?: string };
  return corpo.nome_arquivo ?? arquivo.name;
}

/** Todas as multas do condutor (vinculadas pelo cadastro ou gravadas com o mesmo nome), sem período. */
export async function listarMultasDoCondutor(unidade: string, idCondutor: number): Promise<FrotaMulta[]> {
  const qs = new URLSearchParams({ unidade, id_condutor: String(idCondutor) });
  const res = await fetch(`${API_BASE}/api/${caminho}/multas?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export type CondutorProvavel = {
  encontrado: boolean;
  id_viagem?: number;
  id_condutor?: number | null;
  condutor?: string;
  data_saida?: string;
  data_retorno?: string | null;
};

/** Quem estava em viagem com a placa no dia (aba Condutores > Viagens). */
export async function condutorProvavel(unidade: string, placa: string, data: string): Promise<CondutorProvavel> {
  const qs = new URLSearchParams({ unidade, placa, data });
  const res = await fetch(`${API_BASE}/api/${caminho}/multas/condutor-provavel?${qs}`, { headers: headers() });
  if (!res.ok) return { encontrado: false };
  return res.json();
}

// ------------------------------------------------------------------ Sinistros (acionamento de seguro)

export const CAUSAS_SINISTRO = [
  { valor: "CONDUTOR", rotulo: "Acidente causado pelo condutor" },
  { valor: "TERCEIROS", rotulo: "Acidente causado por terceiros" },
  { valor: "NAO_IDENTIFICADO", rotulo: "Causador não identificado" },
  { valor: "IMPRUDENCIA", rotulo: "Imprudência do condutor" },
  { valor: "NEGLIGENCIA", rotulo: "Negligência do condutor" },
  { valor: "PANE", rotulo: "Pane veicular" },
] as const;

export const TIPOS_FROTA = [
  { valor: "PROPRIA", rotulo: "Própria" },
  { valor: "LOCALIZA", rotulo: "Localiza" },
  { valor: "MOVIDA", rotulo: "Movida" },
  { valor: "MM", rotulo: "MM" },
  { valor: "OUTRA", rotulo: "Outra" },
] as const;

export type FrotaSinistro = {
  id: number;
  placa: string;
  data_sinistro?: string | null;
  causa: string;
  tipo_frota: string;
  setor?: string | null;
  condutor?: string | null;
  valor?: number | null;
  acionou_seguro?: boolean | null;
  seguro_terceiros?: boolean | null;
  descricao: string;
  faturado?: boolean | null;
  pago_pedido?: string | null;
  acao_decorrente?: string | null;
  situacao_reparo?: string | null;
  valor_reembolsado?: number | null;
  rq106?: string | null;
  nome_arquivo?: string | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
};

export const SITUACOES_REPARO = [
  { valor: "EM_ORCAMENTO", rotulo: "Em orçamento" },
  { valor: "PERDA_TOTAL", rotulo: "Perda total" },
] as const;

export const SUGESTOES_RQ106 = ["ANÁLISE", "APROVADO"];

/** "SIM", "NAO", "TERCEIROS" (seguro do terceiro) ou "" (não informado). */
export function seguroSinistro(s: Pick<FrotaSinistro, "acionou_seguro" | "seguro_terceiros">): string {
  if (s.seguro_terceiros) return "TERCEIROS";
  return s.acionou_seguro == null ? "" : s.acionou_seguro ? "SIM" : "NAO";
}

/** acionou_seguro: "SIM", "NAO", "TERCEIROS" ou vazio (não informado); valor vazio = sem orçamento. */
export type SinistroPayload = {
  unidade: string;
  placa: string;
  data_sinistro: string;
  causa: string;
  tipo_frota: string;
  setor?: string;
  condutor?: string;
  valor?: string;
  acionou_seguro?: string;
  descricao: string;
  faturado?: string;
  pago_pedido?: string;
  acao_decorrente?: string;
  situacao_reparo?: string;
  valor_reembolsado?: string;
  rq106?: string;
  motivo?: string;
  arquivo?: File | null;
};

export const listarSinistros = (unidade: string, de?: string, ate?: string) =>
  listarPorPeriodo<FrotaSinistro>("sinistros", unidade, de, ate);
export const salvarSinistro = ({ arquivo, ...p }: SinistroPayload, id?: number) =>
  salvarComAnexo("sinistros", { ...p, arquivo }, id);
export const excluirSinistro = (id: number, motivo: string) => excluirRegistro("sinistros", id, motivo);
export const anexoSinistro = (id: number, nomeParaBaixar?: string | null) => anexoRegistro("sinistros", id, nomeParaBaixar);

// ------------------------------------------------------------------ Condutores e viagens

export type FrotaCondutor = {
  id: number;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  email?: string | null;
  telefone?: string | null;
  setor?: string | null;
  cnh_numero?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  nome_arquivo?: string | null;
  ativo: boolean;
  funcao?: string | null;
  carro_dedicado?: string | null;
  ticket_log?: boolean | null;
  rotagyn?: boolean | null;
  cnh_arquivada?: boolean | null;
  viagens: number;
  placa_em_viagem?: string | null;
  multas: number;
  multas_valor: number;
  multas_a_pagar: number;
  multas_descontado: number;
  multas_a_descontar: number;
  usuario: string;
  data_hora: string;
};

export type CondutorPayload = {
  unidade: string;
  nome: string;
  cpf?: string;
  matricula?: string;
  email?: string;
  telefone?: string;
  setor?: string;
  cnh_numero?: string;
  cnh_categoria?: string;
  cnh_validade?: string;
  ativo: string;
  funcao?: string;
  carro_dedicado?: string;
  /** "SIM", "NAO" ou vazio (não informado). */
  ticket_log?: string;
  rotagyn?: string;
  cnh_arquivada?: string;
  motivo?: string;
  arquivo?: File | null;
};

export type FrotaViagem = {
  id: number;
  id_condutor?: number | null;
  condutor: string;
  placa: string;
  tipo_frota: string;
  data_saida: string;
  data_retorno?: string | null;
  destino?: string | null;
  chamado?: string | null;
  observacao?: string | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
};

/** Datas no formato do campo datetime-local (yyyy-MM-ddTHH:mm). */
export type ViagemPayload = {
  unidade: string;
  id_condutor?: string;
  condutor?: string;
  placa: string;
  tipo_frota: string;
  data_saida: string;
  data_retorno?: string;
  destino?: string;
  chamado?: string;
  observacao?: string;
  motivo?: string;
};

export async function listarCondutores(unidade: string): Promise<FrotaCondutor[]> {
  const res = await fetch(`${API_BASE}/api/${caminho}/condutores?${new URLSearchParams({ unidade })}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}
export const salvarCondutor = ({ arquivo, ...p }: CondutorPayload, id?: number) =>
  salvarComAnexo("condutores", { ...p, arquivo }, id);
export const excluirCondutor = (id: number, motivo: string) => excluirRegistro("condutores", id, motivo);
export const cnhCondutor = (id: number, nomeParaBaixar?: string | null) => anexoRegistro("condutores", id, nomeParaBaixar);

export const listarViagens = (unidade: string, de?: string, ate?: string) =>
  listarPorPeriodo<FrotaViagem>("viagens", unidade, de, ate);
export const salvarViagem = (p: ViagemPayload, id?: number) => salvarComAnexo("viagens", p, id);
export const excluirViagem = (id: number, motivo: string) => excluirRegistro("viagens", id, motivo);

// ----------------------------------------------------------------- Notas da manutenção

export const STATUS_NOTA = [
  { valor: "LANCADA", rotulo: "Lançada" },
  { valor: "ENVIADA_BAIXA", rotulo: "Enviada para baixa" },
  { valor: "CONCLUIDA", rotulo: "Concluída" },
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
] as const;

export const TIPOS_NOTA = [
  { valor: "SERVICO", rotulo: "Serviços" },
  { valor: "PRODUTO", rotulo: "Produtos" },
] as const;

export type FrotaNotaItem = {
  id?: number;
  placa: string;
  classificacao: string;
  servico?: string | null;
  quantidade: number;
  valor: number;
  descricao?: string | null;
  regiao?: string | null;
  codccusto?: string | null;
};

export type FrotaNota = {
  id: number;
  unidade: string;
  numero_nf: string;
  tipo_nota?: string | null;
  pedido?: string | null;
  data_emissao?: string | null;
  data_entrada: string;
  data_vencimento?: string | null;
  valor_total: number;
  fornecedor_codcfo?: string | null;
  /** Nome como está no RM. Vazio só em nota da planilha cujo fornecedor não foi achado no RM (fica pendente). */
  fornecedor?: string | null;
  fornecedor_cnpj?: string | null;
  status: string;
  motivo_status?: string | null;
  responsavel?: string | null;
  observacao?: string | null;
  origem: string;
  origem_linha?: number | null;
  nome_arquivo?: string | null;
  usuario: string;
  usuario_nome?: string | null;
  data_hora: string;
  itens: FrotaNotaItem[];
};

export type NotaPayload = {
  unidade: string;
  numero_nf: string;
  tipo_nota?: string;
  pedido?: string;
  data_emissao?: string;
  data_entrada: string;
  data_vencimento?: string;
  valor_total: string;
  fornecedor_codcfo: string;
  status: string;
  motivo_status?: string;
  responsavel?: string;
  observacao?: string;
  itens: { placa: string; classificacao: string; servico: string; quantidade: number; valor: number; descricao?: string }[];
  motivo?: string;
  arquivo?: File | null;
};

export const listarNotas = (unidade: string, de?: string, ate?: string) => listarPorPeriodo<FrotaNota>("notas", unidade, de, ate);
export const salvarNota = ({ arquivo, itens, ...p }: NotaPayload, id?: number) =>
  salvarComAnexo("notas", { ...p, itens: JSON.stringify(itens), arquivo }, id);
export const excluirNota = (id: number, motivo: string) => excluirRegistro("notas", id, motivo);
export const anexoNota = (id: number, nomeParaBaixar?: string | null) => anexoRegistro("notas", id, nomeParaBaixar);

export async function alterarStatusNota(id: number, status: string, motivo?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/notas/${id}/status`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ status, motivo }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

/** Uma linha do arquivo importar-notas-WAY-xxx.json (gerado da planilha CONTROLE DE NFS E PEDIDOS). */
export type NotaPlanilha = {
  linha: number;
  numero_nf: string;
  fornecedor_planilha?: string | null;
  valor_total?: number | null;
  [campo: string]: unknown;
};

export type ArquivoImportacaoNotas = { unidade: string; origem?: string; gerado_em?: string; notas: NotaPlanilha[] };

export type FornecedorImportacao = {
  nome_planilha: string;
  ocorrencias: number;
  /** ESCOLHIDO | EXATO | PROVAVEL | AMBIGUO | NAO_ENCONTRADO */
  situacao: string;
  codcfo?: string | null;
  nome_rm?: string | null;
  cnpj?: string | null;
  candidatos: FornecedorRm[];
};

export type ResumoImportacaoNotas = {
  unidade: string;
  aplicado: boolean;
  notas_novas: number;
  ja_importadas: number;
  notas_com_itens: number;
  itens: number;
  sem_fornecedor_rm: number;
  valor_total: number;
  placas_fora_rm: string[];
  ignoradas: string[];
  fornecedores: FornecedorImportacao[];
};

/** aplicar=false só confere; depara = nome na planilha → CODCFO escolhido no RM. */
export async function importarNotasPlanilha(
  unidade: string,
  notas: NotaPlanilha[],
  depara: Record<string, string>,
  aplicar: boolean
): Promise<ResumoImportacaoNotas> {
  const res = await fetch(`${API_BASE}/api/${caminho}/notas/importar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ unidade, aplicar, notas, depara }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

// ----------------------------------------------------------------- Lotação das placas (região)

export type FrotaLotacao = {
  placa: string;
  prefixo?: string | null;
  codccusto?: string | null;
  desc_ccusto?: string | null;
  regiao: string;
  inicio_vigencia: string;
  usuario: string;
  data_hora: string;
};

export type LotacaoPayload = {
  unidade: string;
  placa: string;
  prefixo?: string;
  codccusto?: string;
  desc_ccusto?: string;
  regiao: string;
  inicio_vigencia?: string;
};

export async function listarLotacoes(unidade: string): Promise<FrotaLotacao[]> {
  const res = await apiFetch(`${API_BASE}/api/${caminho}/lotacoes?${new URLSearchParams({ unidade })}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export async function definirLotacao(p: LotacaoPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/${caminho}/lotacoes`, { method: "PUT", headers: headers(), body: JSON.stringify(p) });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

// ----------------------------------------------------------------- Comparativo

export type ItemComparativo = {
  unidade: string;
  placa: string;
  data: string;
  classificacao: string;
  servico?: string | null;
  quantidade: number;
  valor: number;
  fornecedor: string;
  fornecedor_codcfo?: string | null;
  fornecedor_cnpj?: string | null;
  id_nota?: number | null;
  numero_nf?: string | null;
  regiao: string;
  codccusto?: string | null;
  desc_ccusto?: string | null;
};

export type DadosComparativo = {
  itens: ItemComparativo[];
  placas_por_regiao: { unidade: string; regiao: string; placas: number }[];
};

export async function dadosComparativo(unidades: string[], de?: string, ate?: string): Promise<DadosComparativo> {
  const qs = new URLSearchParams();
  unidades.forEach((u) => qs.append("unidades", u));
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);
  const res = await apiFetch(`${API_BASE}/api/${caminho}/manutencoes/comparativo?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

// ----------------------------------------------------------------- Pedidos 1.1.36 do RM

/** Status do pedido de compra (TMOV.STATUS) no RM. */
export const STATUS_PEDIDO_RM = [
  { valor: "A", rotulo: "Aberto" },
  { valor: "F", rotulo: "Faturado" },
  { valor: "C", rotulo: "Cancelado" },
] as const;

export type MovimentoRmItem = {
  nseq: number;
  codigo_produto?: string | null;
  produto?: string | null;
  quantidade: number;
  preco_unitario: number;
  valor: number;
  /** Placa do item no RM (IDOBJOFICINA) ou, se vazia, a citada no histórico. */
  placa?: string | null;
  placa_origem?: "RM" | "HISTORICO" | null;
  placas_historico: string[];
  hodometro?: string | null;
  tipo_rm?: string | null;
  codccusto?: string | null;
  desc_ccusto?: string | null;
  regiao_ccusto?: string | null;
  historico?: string | null;
  classificacao_sugerida: string;
  servico_sugerido: string;
};

export type MovimentoRmNf = {
  idmov: number;
  codtmv: string;
  nome_tmv?: string | null;
  numero: string;
  serie?: string | null;
  status?: string | null;
  data_emissao?: string | null;
  valor: number;
};

export type MovimentoRm = {
  idmov: number;
  numero: string;
  serie?: string | null;
  status: string;
  data_emissao?: string | null;
  data_extra?: string | null;
  fornecedor_codcfo?: string | null;
  fornecedor?: string | null;
  fornecedor_cnpj?: string | null;
  valor_pedido: number;
  valor_itens: number;
  nf?: MovimentoRmNf | null;
  qtd_nfs: number;
  nota_frotas_id?: number | null;
  nota_frotas_itens?: number | null;
  nota_frotas_status?: string | null;
  /** VINCULADA = já está no Frotas; NF_FORNECEDOR / NF_VALOR = nota da planilha com a mesma NF; AMBIGUA. */
  vinculo?: "VINCULADA" | "NF_FORNECEDOR" | "NF_VALOR" | "AMBIGUA" | null;
  itens: MovimentoRmItem[];
};

export async function listarMovimentosRm(unidade: string, de?: string, ate?: string, status?: string): Promise<MovimentoRm[]> {
  const qs = new URLSearchParams({ unidade });
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);
  if (status) qs.set("status", status);
  const res = await apiFetch(`${API_BASE}/api/${caminho}/movimentos-rm?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export type LancarMovimentoRmItem = { nseq: number; placa: string; classificacao: string; servico: string };

export async function lancarMovimentoRm(unidade: string, idmov: number, itens: LancarMovimentoRmItem[]): Promise<{ id: number; completada: boolean }> {
  const res = await fetch(`${API_BASE}/api/${caminho}/movimentos-rm/${idmov}/lancar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ unidade, itens }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

export type ResumoCompletarNotasRm = {
  aplicar: boolean;
  pedidos_lidos: number;
  completadas: number;
  itens: number;
  sem_placa: number;
  ambiguas: number;
  erros: number;
  linhas: {
    id_nota: number;
    numero_nf: string;
    pedido: string;
    idmov: number;
    fornecedor?: string | null;
    como: string;
    valor_nota: number;
    valor_rm: number;
    itens: number;
    itens_sem_placa: number;
    erro?: string | null;
  }[];
};

/** Notas da planilha sem itens que acham a NF no RM ganham os itens do pedido. aplicar=false só simula. */
export async function completarNotasComRm(unidade: string, aplicar: boolean, de?: string, ate?: string): Promise<ResumoCompletarNotasRm> {
  const res = await fetch(`${API_BASE}/api/${caminho}/movimentos-rm/completar`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ unidade, aplicar, de: de || null, ate: ate || null }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}
