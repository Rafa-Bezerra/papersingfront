import { API_BASE, API_TIMEOUT_MS, apiFetch, headers } from "@/utils/constants";

/** WaySign · relatório, painel, mensagens, alertas e carga (api/WaySign). Lêem o espelho local. */
const base = `${API_BASE}/api/WaySign`;

async function erroApi(res: Response, acao: string): Promise<string> {
    const raw = (await res.text()).trim();
    if (/1015|rate.?limit|too many (requests|attempts)|429/i.test(raw) || res.status === 429)
        return "A PlugSign limitou as requisições. Aguarde alguns minutos e tente de novo.";
    return raw.split("\n")[0].trim() || `Erro ${res.status} ao ${acao}`;
}

async function getJson<T>(caminho: string, acao: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(`${base}/${caminho}`, { headers: headers(), ...init }, API_TIMEOUT_MS);
    if (!res.ok) throw new Error(await erroApi(res, acao));
    return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v).trim());
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
}

export type Indisponivel = { disponivel: false; motivo: string };

export type RelatorioLinha = {
    documentKey: string;
    nome?: string | null;
    pasta?: string | null;
    remetente?: string | null;
    enviadoPor?: string | null;
    enviadoEm?: string | null;
    concluidas: number;
    pendentes: number;
    status: string;
    unidade: string;
};

export type Paginado<T> = { disponivel: true; data: T[]; page: number; pageSize: number; total: number; lastPage: number };

export type RelatorioFiltro = { page?: number; pageSize?: number; texto?: string; status?: string; dataIni?: string; dataFim?: string };

export const listarRelatorio = (f: RelatorioFiltro) =>
    getJson<Paginado<RelatorioLinha> | Indisponivel>(`relatorio${qs(f)}`, "carregar o relatório");

/** CSV (abre no Excel) com os mesmos filtros, sem paginação. */
export async function baixarRelatorioCsv(f: RelatorioFiltro): Promise<Blob> {
    const res = await apiFetch(`${base}/relatorio${qs({ ...f, page: undefined, pageSize: undefined, formato: "csv" })}`,
        { headers: headers() }, API_TIMEOUT_MS);
    if (!res.ok) throw new Error(await erroApi(res, "exportar o relatório"));
    return await res.blob();
}

export type Painel = {
    disponivel: true;
    documentos: { total: number; mes: number; pastas: number; naoEnviados: number; parciais: number; assinados: number; pendentes: number; recusados: number };
    solicitacoes: { concluidas: number; pendentes: number; recusadasCanceladas: number; assinadasMes: number };
    percentualPendente: number;
    porDia: { dia: string; documentos: number }[];
};

export const obterPainel = (dias = 30) => getJson<Painel | Indisponivel>(`painel${qs({ dias })}`, "carregar o painel");

export type MensagemEnviada = {
    id: number;
    enviadaEm?: string | null;
    documentKey?: string | null;
    documento?: string | null;
    destino?: string | null;
    status?: string | null;
    atualizadaEm?: string | null;
};

export const listarMensagensEnviadas = (f: { canal: "email" | "whatsapp"; page?: number; pageSize?: number; texto?: string }) =>
    getJson<Paginado<MensagemEnviada> | Indisponivel>(`mensagens${qs(f)}`, "carregar as mensagens");

export type Alerta = { tipo: string; documentKey: string; texto: string; quando?: string | null; importante: boolean };

export const listarAlertas = () => getJson<{ disponivel: true; data: Alerta[] } | Indisponivel>("alertas", "carregar os alertas");

export type EstadoCarga = {
    situacao: string;
    modo?: string | null;
    iniciadoPor?: string | null;
    inicioUtc?: string | null;
    fimUtc?: string | null;
    recurso?: string | null;
    pagina: number;
    ultimaPagina: number;
    totalInformado: Record<string, number>;
    solicitacoes?: { total: number; porUnidade: Record<string, number>; indefPorMotivo: Record<string, number> } | null;
    documentos?: { total: number; porUnidade: Record<string, number>; porFonte: Record<string, number>; indefPorMotivo: Record<string, number> } | null;
    erro?: string | null;
};

export const estadoCarga = () => getJson<EstadoCarga>("carga/estado", "ver a carga");
export const iniciarCarga = (modo: "dry-run" | "gravar", ignorarJanela: boolean) =>
    getJson<EstadoCarga>(`carga/${modo}${qs({ ignorarJanela: ignorarJanela ? "true" : undefined })}`, "iniciar a carga",
        { method: "POST" });
/** Admin: atualiza agora o status dos envios PlugSign pendentes (em segundo plano). */
export const sincronizarStatusPlugSign = () =>
    getJson<{ message: string }>("sincronizar-status", "atualizar o status da PlugSign", { method: "POST" });
export const cancelarCarga = () => getJson<EstadoCarga>("carga/cancelar", "cancelar a carga", { method: "POST" });

/** Data UTC da API em horário local (dd/mm/aaaa hh:mm). */
export function dataLocal(utc?: string | null): string {
    if (!utc) return "—";
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(utc) ? utc : `${utc}Z`);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
