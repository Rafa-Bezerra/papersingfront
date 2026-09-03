import { API_BASE, fetchJson, headers } from "@/utils/constants";

export interface DisparoEmail {
  id: number;
  data_envio: string;
  unidade: string;
  destinatarios: string;
  assunto: string;
  status: string;
  erro: string;
}

export interface DisparoDestinatario {
  usuario: string;
  nome: string;
  email: string;
}

export interface DisparoEnvioResultado {
  ok: boolean;
  enviados: number;
  falhas: number;
  erros: string[];
}

export const PERFIS_DISPARO = [
  { id: "admin", label: "Admin" },
  { id: "documentos", label: "Documentos" },
  { id: "bordero", label: "Borderô" },
  { id: "comunicados", label: "Pagamentos" },
  { id: "rdv", label: "RDV" },
  { id: "ccusto", label: "Centros de custo" },
  { id: "restrito", label: "Restrito" },
  { id: "pagamento_impostos", label: "Pag. Impostos" },
  { id: "pagamento_rh", label: "Pag. RH" },
  { id: "fiscal", label: "P. Fiscal" },
  { id: "externo", label: "Doc. Externo" },
  { id: "administrativo", label: "Administrativo" },
  { id: "solicitante", label: "Solicitante" },
  { id: "gestao_pessoas", label: "Gestão de pessoas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "docusign", label: "PlugSing" },
  { id: "projetos", label: "Projetos" },
  { id: "contratos", label: "Contratos" },
  { id: "financeiro_totvs", label: "Financeiro TOTVS" },
] as const;

export async function getDisparos(q = "", status = ""): Promise<DisparoEmail[]> {
  const url = new URL(`${API_BASE}/api/Disparos`);
  if (q.trim()) url.searchParams.set("q", q.trim());
  if (status.trim()) url.searchParams.set("status", status.trim());
  return fetchJson<DisparoEmail[]>(url.toString());
}

export async function getDestinatariosDisparo(perfis: string[]): Promise<DisparoDestinatario[]> {
  const url = new URL(`${API_BASE}/api/Disparos/destinatarios`);
  url.searchParams.set("perfis", perfis.join(","));
  return fetchJson<DisparoDestinatario[]>(url.toString());
}

export async function enviarDisparoPerfil(
  perfis: string[],
  assunto: string,
  corpo: string
): Promise<DisparoEnvioResultado> {
  return fetchJson<DisparoEnvioResultado>(
    `${API_BASE}/api/Disparos/enviar`,
    {
      method: "POST",
      body: JSON.stringify({ perfis: perfis.join(","), assunto, corpo }),
    },
    "Erro ao disparar e-mail",
    180_000
  );
}

export async function reenviarDisparo(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/Disparos/${id}/reenviar`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Erro ${res.status} ao reenviar`);
  }
}

export interface EmailPainelConfig {
  modo_teste: boolean;
  email_teste: string;
  lembrete_horas: number;
  max_emails_ciclo: number;
  financeiro_recebe_alertas: boolean;
  senha_novo_usuario: boolean;
  smtp: string;
  remetente: string;
  modulos: Record<string, boolean>;
}

export const MODULOS_EMAIL = [
  { id: "Movimentos", label: "Movimentos" },
  { id: "Comunicados", label: "Pagamentos CI" },
  { id: "Documentos", label: "Documentos" },
  { id: "Rdv", label: "RDV" },
  { id: "Restritos", label: "Gestão de pessoas" },
  { id: "PagRh", label: "Pag. RH" },
  { id: "PagImpostos", label: "Pag. Impostos" },
  { id: "Bordero", label: "Borderô" },
  { id: "DocExternos", label: "Doc. externos" },
  { id: "Fiscal", label: "Fiscal" },
] as const;

export async function getConfigDisparos(): Promise<EmailPainelConfig> {
  return fetchJson<EmailPainelConfig>(`${API_BASE}/api/Disparos/config`);
}

export async function salvarConfigDisparos(cfg: EmailPainelConfig): Promise<EmailPainelConfig> {
  return fetchJson<EmailPainelConfig>(
    `${API_BASE}/api/Disparos/config`,
    { method: "PUT", body: JSON.stringify(cfg) },
    "Erro ao salvar configuração"
  );
}

export async function enviarEmailTeste(email: string): Promise<void> {
  await fetchJson<{ ok: boolean }>(
    `${API_BASE}/api/Disparos/teste`,
    { method: "POST", body: JSON.stringify({ email }) },
    "Erro ao enviar e-mail de teste"
  );
}
