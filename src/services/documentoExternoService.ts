import type { DocumentoExterno, DocumentoExternoAprovador, DocumentoExternoAssinar, DocumentoExternoCreateDTO, DocumentoExternoFiltro } from "@/types/DocumentosExternos";
import { API_BASE, headers, headersExterno } from "@/utils/constants";
const caminho = "DocumentosExternos";
const elemento_singular = "documento";
const elemento_plural = "documentos";

export async function getAll(data: DocumentoExternoFiltro): Promise<DocumentoExterno[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/all`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: DocumentoExterno[] = await res.json();
    return list;
}

export async function createElement(data: DocumentoExternoCreateDTO): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/criar`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao criar ${elemento_singular}: ${msg}`);
    }
}

export async function getDocumento(id: number): Promise<string> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "GET", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    const data = await res.text();
    return data;
}

export async function getAllAprovadores(id: number): Promise<DocumentoExternoAprovador[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovadores/${id}`); 
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: DocumentoExternoAprovador[] = await res.json();
    return list;
}
  
export async function assinarDocumento(data: DocumentoExternoAssinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar/${data.id}`, { method: "POST", headers: headers(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function aprovar(id: number, aprovado: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar/${id}/${aprovado}`, { method: "POST", headers: headers(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function deleteElement(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/excluir/${id}`, { method: "POST", headers: headers() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function getAllExterno(data: DocumentoExternoFiltro): Promise<DocumentoExterno[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/all-externo`, { method: "POST", headers: headersExterno(), body: JSON.stringify(data) });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: DocumentoExterno[] = await res.json();
    return list;
}
  
export async function assinarDocumentoExterno(data: DocumentoExternoAssinar): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/assinar-externo/${data.id}`, { method: "POST", headers: headersExterno(), body: JSON.stringify(data) });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}
  
export async function aprovarExterno(id: number, aprovado: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/${caminho}/aprovar-externo/${id}/${aprovado}`, { method: "POST", headers: headersExterno(), body: JSON.stringify("") });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
}

export async function getDocumentoExterno(id: number): Promise<string> {
    const res = await fetch(`${API_BASE}/api/${caminho}/${id}`, { method: "GET", headers: headersExterno() });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Erro ${res.status} ao atualizar ${elemento_singular}: ${msg}`);
    }
    const data = await res.text();
    return data;
}

export async function getAllAprovadoresExterno(id: number): Promise<DocumentoExternoAprovador[]> {
    const url = new URL(`${API_BASE}/api/${caminho}/aprovadores/${id}`); 
    const res = await fetch(url.toString(), {
        headers: headersExterno(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list: DocumentoExternoAprovador[] = await res.json();
    return list;
}

export type { DocumentoExterno, DocumentoExternoAprovador, DocumentoExternoAssinar, DocumentoExternoCreateDTO, DocumentoExternoFiltro }