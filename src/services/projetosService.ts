import type { Documento, DocumentoAnexoAssinar, DocumentoAprovacao, DocumentoAssinar } from "@/types/Documento";
import { API_BASE, headers } from "@/utils/constants";
const caminho = "Projetos";
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
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    const msg = await res.text();
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    return msg;
}

/** Normaliza resposta da API (JSON string ou data URL) preservando o MIME quando informado. */
export function normalizarDataUrl(valor: string): string {
    let s = valor.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
        try {
            s = JSON.parse(s) as string;
        } catch {
            s = s.slice(1, -1);
        }
    }
    if (s.startsWith("data:")) return s;
    return `data:application/octet-stream;base64,${s.replace(/^data:.*;base64,/, "")}`;
}

/** @deprecated Use normalizarDataUrl — mantido para PDFs na visualização/assinatura. */
export function normalizarPdfDataUrl(valor: string): string {
    const dataUrl = normalizarDataUrl(valor);
    if (dataUrl.startsWith("data:application/pdf")) return dataUrl;
    if (!dataUrl.startsWith("data:")) {
        return `data:application/pdf;base64,${dataUrl.replace(/^data:.*;base64,/, "")}`;
    }
    return dataUrl;
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
    const dataUrl = normalizarDataUrl(raw);
    if (dataUrl.startsWith("data:application/pdf") && !base64PdfEhValido(dataUrl)) {
        throw new Error(
            "O arquivo no servidor não é um PDF válido. Exclua o anexo e envie o documento novamente."
        );
    }
    return dataUrl;
}

export type { Documento, DocumentoAssinar, DocumentoAprovacao, DocumentoAnexoAssinar }