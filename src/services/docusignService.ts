import type { Documento, DocumentoAnexoAssinar, DocumentoAprovacao, DocumentoAssinar } from "@/types/Documento";
import { API_BASE, apiFetch, ASSINATURA_TIMEOUT_MS, CERTIFICADO_TIMEOUT_MS, headers } from "@/utils/constants";
const caminho = "Docusign";
const elemento_singular = "documento";
const elemento_plural = "documentos";

export async function getAll(): Promise<Documento[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);       
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: Documento[] = await res.json();
    return list;
}

export async function createElement(data: Documento): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}
  
export async function updateElement(data: DocumentoAssinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function getAllAprovadores(id: number): Promise<DocumentoAprovacao[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovadores/${id}`); 
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: DocumentoAprovacao[] = await res.json();
    return list;
}
  
export async function adicionarAprovador(id: number, data: DocumentoAprovacao): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/adicionar/${id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function removerAprovador(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/remover/${id}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function aprovar(id: number, aprovado: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovadores/aprovacao/${id}/${aprovado}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function assinar(data: DocumentoAnexoAssinar): Promise<string> {
    const res = await apiFetch(
        `${API_BASE}/api/${caminho}/assinar/${data.id}`,
        { method: "POST", headers: headers(), body: JSON.stringify(data) },
        ASSINATURA_TIMEOUT_MS
    );
    const msg = await res.text();
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    return msg;
}

export type CertificadoA1Status = {
    plugsignAtivo: boolean;
    cadastrado: boolean;
    vinculadoPlugSign?: boolean;
    temCertificadoA1?: boolean;
    certificadoPersistido?: boolean;
    podeGerenciarCertificado?: boolean;
    motivo?: string;
    motivoCertificado?: string;
    usuario?: string;
    nome?: string;
    emailMascarado?: string;
    plugsignUserId?: number;
};

function mensagemFalhaRede(acao: string, err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if ((err as Error)?.name === "TimeoutError" || /timeout/i.test(msg))
        return new Error("A API demorou a responder ao tratar o certificado. Tente novamente.");
    if (/failed to fetch|networkerror|load failed/i.test(msg))
        return new Error(
            `Não foi possível ${acao}. A tela (:5063) não conseguiu falar com a API (:5062). ` +
            "Confirme se o endereço é https://papersign.grupowaybrasil.com.br:5063 e se o pool da API está no ar."
        );
    return err instanceof Error ? err : new Error(msg || `Erro ao ${acao}.`);
}

export async function getCertificadoStatus(): Promise<CertificadoA1Status> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/certificado`, { headers: headers() }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`Erro ${res.status} ao consultar certificado: ${msg}`);
        }
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("consultar o certificado", err);
    }
}

export async function vincularCertificadoPlugSign(): Promise<CertificadoA1Status> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/certificado/vincular`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({}),
        }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `Erro ${res.status} ao vincular conta`);
        }
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("vincular a conta PlugSign", err);
    }
}

export async function postCertificado(certificadoBase64: string, senha: string, _substituir = false): Promise<CertificadoA1Status> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/certificado`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ Certificado: certificadoBase64, Senha: senha }),
        }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `Erro ${res.status} ao enviar certificado`);
        }
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("enviar o certificado A1", err);
    }
}

export async function deleteCertificado(): Promise<CertificadoA1Status> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/certificado/remover`, {
            method: "POST",
            headers: headers(),
        }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `Erro ${res.status} ao remover certificado`);
        }
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("remover o certificado A1", err);
    }
}

/** Normaliza resposta da API (JSON string ou data URL) para data URL de PDF. */
export function normalizarPdfDataUrl(valor: string): string {
    let s = valor.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
        try {
            s = JSON.parse(s) as string;
        } catch {
            s = s.slice(1, -1);
        }
    }
    if (!s.startsWith("data:")) {
        s = `data:application/pdf;base64,${s.replace(/^data:.*;base64,/, "")}`;
    }
    return s;
}

export function base64PdfEhValido(dataUrlOuBase64: string): boolean {
    let b64 = dataUrlOuBase64.trim();
    if (b64.startsWith("data:")) b64 = b64.split(",")[1] ?? "";
    if (!b64) return false;
    try {
        const bin = atob(b64.slice(0, Math.min(b64.length, 32)));
        return bin.startsWith("%PDF");
    } catch {
        return false;
    }
}

export async function getAnexo(caminho_anexo: string): Promise<string> {
    const body = { caminho_anexo };
    const res = await fetch(`${API_BASE}/api/${caminho}/anexo`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || `Erro ${res.status} ao carregar anexo`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const raw = contentType.includes("application/json")
      ? (await res.json() as string)
      : await res.text();
    const dataUrl = normalizarPdfDataUrl(raw);
    if (!base64PdfEhValido(dataUrl)) {
        throw new Error(
            "O arquivo no servidor não é um PDF válido. Exclua o anexo e envie o documento novamente."
        );
    }
    return dataUrl;
}

export type { Documento, DocumentoAssinar, DocumentoAprovacao, DocumentoAnexoAssinar }