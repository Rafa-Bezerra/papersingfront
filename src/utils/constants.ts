const isDev = process.env.NODE_ENV === 'development';

export const GLPI_SUPPORT_URL = "http://servicedesk.grupowaybrasil.com.br/";

function resolveApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  const envLocal = fromEnv && /localhost|127\.0\.0\.1/i.test(fromEnv);

  if (!isDev) {
    if (fromEnv && !envLocal) return fromEnv.replace(/\/$/, '');
    return 'https://papersign.grupowaybrasil.com.br:5062';
  }
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:5170`;
  }
  return 'http://localhost:5170';
}

export const API_BASE = resolveApiBase();

export const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("authToken")}`,
})

export const headersExterno = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${sessionStorage.getItem("authTokenExterno")}`,
})

/** Timeout padrão das chamadas de API (ms). */
export const API_TIMEOUT_MS = 30_000;

/** Timeout para assinatura (comprovante PlugSign pode levar alguns minutos). */
export const ASSINATURA_TIMEOUT_MS = 300_000;

/** Timeout para upload/sincronização de certificado A1. */
export const CERTIFICADO_TIMEOUT_MS = 120_000;

/**
 * `fetch` com timeout e propagação do AbortSignal do chamador. Se o chamador
 * abortar (troca de filtro/nova busca) ou o timeout estourar, a Promise rejeita
 * em vez de ficar pendente para sempre.
 */
export async function apiFetch(url: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("O servidor demorou a responder.", "TimeoutError")),
    timeoutMs
  );

  const externo = init.signal;
  if (externo) {
    if (externo.aborted) controller.abort(externo.reason);
    else externo.addEventListener("abort", () => controller.abort(externo.reason), { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lê a resposta como JSON com tratamento robusto: converte timeout em mensagem
 * amigável, extrai a 1ª linha do corpo em erros HTTP, e protege contra corpo
 * vazio ou HTML (ex.: página de erro de proxy) que quebraria `res.json()`.
 * Erros de aborto (`AbortError`) são propagados para o chamador ignorar.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  erroPadrao = "Erro ao carregar dados",
  timeoutMs = API_TIMEOUT_MS
): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(url, { headers: headers(), ...init }, timeoutMs);
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      throw new Error("O servidor demorou a responder. Tente novamente.");
    }
    throw err;
  }

  const texto = await res.text();
  if (!res.ok) {
    const primeiraLinha = (texto ?? "").trim().split("\n")[0].trim();
    throw new Error(primeiraLinha || `${erroPadrao} (${res.status}).`);
  }
  if (!texto) return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }
}