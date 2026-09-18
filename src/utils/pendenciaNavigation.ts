import { PendenciaGestorItem } from "@/types/Pendencias";

export const GESTOR_UNIDADE_KEY = "papersign-gestor-unidade";

const ROTAS_COM_STATUS = new Set([
  "/geral",
  "/gestao-pessoas",
  "/solicitacoes",
  "/requisicoes",
  "/controle",
  "/ordens",
  "/aquisicoes",
  "/outras",
]);

const ROTAS_COM_FILTRO = new Set([
  "/fiscal",
  "/bordero",
  "/pagamentos-rh",
  "/pagamentos-impostos",
  "/aprovacaordv",
  "/documentos",
  "/comunicados",
  "/projetos",
  "/docusign",
  "/documentos-externos",
]);

export function buildPendenciaUrl(
  rota: string,
  filtro?: string | null,
  id?: number | null
): string {
  const path = rota.startsWith("/") ? rota : `/${rota}`;
  const params = new URLSearchParams();

  if (filtro) {
    if (ROTAS_COM_STATUS.has(path)) params.set("status", filtro);
    else if (ROTAS_COM_FILTRO.has(path)) params.set("filtro", filtro);
  }

  if (id != null && id > 0) params.set("id", String(id));

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function labelTipoPendencia(tipo: string): string {
  switch (tipo) {
    case "movimento":
      return "Movimento";
    case "rdv":
      return "RDV";
    case "fiscal":
      return "Fiscal";
    case "documento":
      return "Documento";
    case "comunicado":
      return "C.I.";
    case "projeto":
      return "Projeto";
    case "plugsign":
      return "WaySign";
    case "restrito":
      return "Restrito";
    case "bordero":
      return "Borderô";
    case "pagamento_rh":
      return "Pagamento RH";
    case "pagamento_imposto":
      return "Impostos";
    case "externo":
      return "Doc. externo";
    default:
      return tipo;
  }
}

/** Classes Tailwind para badge da unidade WAY. */
export function corUnidadePendencia(unidade: string): string {
  switch (unidade) {
    case "WAY 112":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25";
    case "WAY 153":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25";
    case "WAY 262":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
    case "WAY 306":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25";
    case "WAY 364":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25";
    case "WAY CSC":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Ícone + cor do tipo de pendência (nome do ícone lucide). */
export function metaTipoPendencia(tipo: string): { icon: string; cor: string } {
  switch (tipo) {
    case "movimento":
      return { icon: "package", cor: "text-orange-600 dark:text-orange-400 bg-orange-500/10" };
    case "rdv":
      return { icon: "wallet", cor: "text-purple-600 dark:text-purple-400 bg-purple-500/10" };
    case "fiscal":
      return { icon: "receipt", cor: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" };
    case "documento":
      return { icon: "file-text", cor: "text-blue-600 dark:text-blue-400 bg-blue-500/10" };
    case "comunicado":
      return { icon: "message-square", cor: "text-yellow-700 dark:text-yellow-400 bg-yellow-500/10" };
    case "projeto":
      return { icon: "folder-kanban", cor: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" };
    case "plugsign":
      return { icon: "file-signature", cor: "text-teal-600 dark:text-teal-400 bg-teal-500/10" };
    case "restrito":
      return { icon: "shield-alert", cor: "text-red-600 dark:text-red-400 bg-red-500/10" };
    case "bordero":
      return { icon: "landmark", cor: "text-slate-600 dark:text-slate-400 bg-slate-500/10" };
    case "pagamento_rh":
      return { icon: "users", cor: "text-pink-600 dark:text-pink-400 bg-pink-500/10" };
    case "pagamento_imposto":
      return { icon: "percent", cor: "text-lime-700 dark:text-lime-400 bg-lime-500/10" };
    case "externo":
      return { icon: "globe", cor: "text-sky-600 dark:text-sky-400 bg-sky-500/10" };
    default:
      return { icon: "inbox", cor: "text-muted-foreground bg-muted" };
  }
}

export function formatarValorPendencia(valor?: number | null): string {
  if (valor == null) return "";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataPendencia(data?: string | null): string {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function getUnidadeAtual(): string {
  try {
    const raw = sessionStorage.getItem("userData");
    if (!raw) return "";
    const user = JSON.parse(raw);
    return String(user.unidade ?? "");
  } catch {
    return "";
  }
}

export function getGestorUnidadeContext(): string | null {
  try {
    return sessionStorage.getItem(GESTOR_UNIDADE_KEY);
  } catch {
    return null;
  }
}

export function setGestorUnidadeContext(unidade: string | null): void {
  try {
    if (unidade) sessionStorage.setItem(GESTOR_UNIDADE_KEY, unidade);
    else sessionStorage.removeItem(GESTOR_UNIDADE_KEY);
    window.dispatchEvent(new Event("papersign-gestor-unidade"));
  } catch {
    /* ignore */
  }
}

export function clearGestorUnidadeContext(): void {
  setGestorUnidadeContext(null);
}

/**
 * Abre a pendência mantendo a unidade de login na interface.
 * Se a pendência é de outra WAY, envia X-Gestor-Unidade nas chamadas à API.
 */
export async function abrirPendencia(item: PendenciaGestorItem): Promise<void> {
  const destino = buildPendenciaUrl(item.rota, item.filtro, item.id);
  const atual = getUnidadeAtual();

  if (item.unidade && item.unidade !== atual) {
    setGestorUnidadeContext(item.unidade);
  } else {
    clearGestorUnidadeContext();
  }

  window.location.href = destino;
}

const DISMISS_KEY = "papersign-pendencias-modal-dismissed";
const ABRIR_APOS_LOGIN_KEY = "papersign-pendencias-abrir-login";

export function clearPendenciasModalDismissed(): void {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyPapersignLogin(): void {
  try {
    clearGestorUnidadeContext();
    clearPendenciasModalDismissed();
    sessionStorage.setItem(ABRIR_APOS_LOGIN_KEY, "1");
    window.dispatchEvent(new Event("papersign-login"));
  } catch {
    /* ignore */
  }
}

/** Indica que o modal deve abrir assim que a área logada montar (após redirect do login). */
export function consumirAbrirPendenciasAposLogin(): boolean {
  try {
    const flag = sessionStorage.getItem(ABRIR_APOS_LOGIN_KEY) === "1";
    if (flag) sessionStorage.removeItem(ABRIR_APOS_LOGIN_KEY);
    return flag;
  } catch {
    return false;
  }
}

/** Abre o modal de pendências (ex.: clique no card da home). */
export function abrirModalPendencias(): void {
  try {
    window.dispatchEvent(new Event("papersign-abrir-pendencias-modal"));
  } catch {
    /* ignore */
  }
}

export function wasPendenciasModalDismissed(): boolean {
  try {
    const token = sessionStorage.getItem("authToken");
    if (!token) return false;
    return sessionStorage.getItem(DISMISS_KEY) === token;
  } catch {
    return false;
  }
}

export function markPendenciasModalDismissed(): void {
  try {
    const token = sessionStorage.getItem("authToken");
    if (token) sessionStorage.setItem(DISMISS_KEY, token);
  } catch {
    /* ignore */
  }
}

/** Dispara quando o fluxo do modal de pendências terminou (fechou ou não abriu). O tour Raphaela escuta isso. */
export function notificarPendenciasModalResolvido(): void {
  try {
    window.dispatchEvent(new Event("papersign-pendencias-modal-resolvido"));
  } catch {
    /* ignore */
  }
}
