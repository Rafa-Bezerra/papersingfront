import type { Documento, DocumentoAnexo, DocumentoAnexoAssinar, DocumentoAprovacao, DocumentoAssinar } from "@/types/Documento";
import { API_BASE, apiFetch, ASSINATURA_TIMEOUT_MS, CERTIFICADO_TIMEOUT_MS, headers } from "@/utils/constants";
const caminho = "Docusign";
const elemento_singular = "documento";
const elemento_plural = "documentos";

function normalizarDocumento(raw: Record<string, unknown>): Documento {
    const anexos = (raw.anexos ?? raw.Anexos ?? []) as DocumentoAnexo[];
    const aprovadores = (raw.aprovadores ?? raw.Aprovadores ?? []) as DocumentoAprovacao[];
    return { ...(raw as Documento), anexos: Array.isArray(anexos) ? anexos : [], aprovadores: Array.isArray(aprovadores) ? aprovadores : [] };
}

export async function getAll(): Promise<Documento[]> {
    const url = new URL(`${API_BASE}/api/${caminho}`);       
    const res = await fetch(url.toString(), {
        headers: headers(),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erro ${res.status} ao buscar ${elemento_plural}: ${msg}`);
    }
    const list = await res.json();
    return Array.isArray(list) ? list.map((item) => normalizarDocumento(item as Record<string, unknown>)) : [];
}

export async function getAnexosDocumento(id: number): Promise<DocumentoAnexo[]> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento/${id}/anexos`, {
        headers: headers(),
    });
    if (res.status === 404) {
        const msg = (await res.text()).trim();
        if (/não encontrado|sem permissão/i.test(msg)) {
            throw new Error(msg);
        }
        throw new Error(
            "Endpoint de anexos não encontrado na API. Reinicie a API local (porta 5170) ou atualize o servidor."
        );
    }
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Erro ${res.status} ao buscar anexos do documento`);
    }
    const list = await res.json();
    return Array.isArray(list) ? list : [];
}

export async function resgatarDocumentoPlugSign(id: number): Promise<DocumentoAnexo | null> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento/${id}/resgatar-plugsign`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Erro ${res.status} ao resgatar documento na PlugSign`);
    }
    const data = await res.json();
    const anexo = (data?.anexo ?? data) as DocumentoAnexo;
    return anexo?.id ? anexo : null;
}

export async function adicionarAnexoDocumento(
    id: number,
    data: Pick<DocumentoAnexo, "anexo" | "nome" | "documento_principal">
): Promise<DocumentoAnexo> {
    const res = await fetch(`${API_BASE}/api/${caminho}/documento/${id}/anexos`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Erro ${res.status} ao anexar documento`);
    }
    return await res.json();
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
  
/** @deprecated Exclusão de documento: use documentoService.excluirDocumento com motivo (DOCINTERNO). */
export async function deleteElement(id: number): Promise<void> {
    throw new Error(
        `Exclusão Docusign desativada (doc #${id}). Na WaySign, use Excluir em documento com origem Documentos internos (motivo obrigatório).`
    );
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
        return new Error("A API demorou a responder. Tente novamente.");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        const api = API_BASE.replace(/\/$/, "");
        const local = /localhost|127\.0\.0\.1|:5170/i.test(api);
        return new Error(
            local
                ? `Não foi possível ${acao}. Confirme se a API local está no ar em ${api} (porta 5170).`
                : `Não foi possível ${acao}. A tela não conseguiu falar com a API (${api}). Confirme se o pool da API está no ar.`
        );
    }
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

export async function postCertificado(certificadoBase64: string, senha: string): Promise<CertificadoA1Status> {
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

export async function getAnexo(caminho_anexo: string, id_anexo?: number): Promise<string> {
    const body = { caminho_anexo, id_anexo: id_anexo ?? null };
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

export type PlugSignFolderInfo = {
    id: number;
    name: string;
    accessibility: string;
};

export type PlugSignFileInfo = {
    documentKey: string;
    name: string;
    accessibility: string;
    folderName?: string | null;
    folderId?: number | null;
};

export type PlugSignPastasResponse = {
    accessibilityPadrao: string;
    folderIdPadrao: number;
    pastas: PlugSignFolderInfo[];
};

export type PlugSignPrivatizarResultado = {
    totalListados: number;
    pendentesEveryone: number;
    atualizados: number;
    dryRun: boolean;
    erros: string[];
    amostra: PlugSignFileInfo[];
};

async function lerErroApi(res: Response, acao: string): Promise<string> {
    const raw = (await res.text()).trim()
    const msg = raw.split("\n")[0].trim()
    if (
        /1015|rate.?limit|too many (requests|attempts)|429/i.test(raw) ||
        res.status === 429
    ) {
        return (
            "A PlugSign limitou as requisições (Too Many Attempts / rate limit). " +
            "Aguarde 15–30 minutos sem enviar de novo e tente outra vez."
        )
    }
    return msg || `Erro ${res.status} ao ${acao}`
}

export async function getPlugSignPastas(): Promise<PlugSignPastasResponse> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/plugsign/pastas`, { headers: headers() }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "listar pastas PlugSign"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("listar pastas PlugSign", err);
    }
}

export async function privatizarPlugSign(opts: {
    dryRun: boolean;
    folderId?: number;
    maxArquivos?: number;
}): Promise<PlugSignPrivatizarResultado> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/plugsign/privatizar`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({
                dryRun: opts.dryRun,
                folderId: opts.folderId && opts.folderId > 0 ? opts.folderId : null,
                maxArquivos: opts.maxArquivos ?? 150,
            }),
        }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "privatizar documentos PlugSign"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("privatizar documentos PlugSign", err);
    }
}

export async function atualizarPastaPlugSign(opts: {
    folderId: number;
    name: string;
    accessibility?: string;
    senhaAtual?: string;
}): Promise<void> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/plugsign/pasta`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify({
                folderId: opts.folderId,
                name: opts.name,
                accessibility: opts.accessibility ?? "OnlyMe",
                senhaAtual: opts.senhaAtual ?? "",
            }),
        }, CERTIFICADO_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "atualizar pasta PlugSign"));
    } catch (err) {
        throw mensagemFalhaRede("atualizar pasta PlugSign", err);
    }
}

export type SolicitacaoCampo = {
    type: string;
    page: number;
    width?: number;
    height?: number;
    xPos?: number;
    yPos?: number;
    posX?: number;
    posY?: number;
    largura?: number;
    altura?: number;
    text?: string;
    paginaExtra?: boolean;
    /** Índice do PDF em `documentos` — cada arquivo tem campos independentes. */
    documentoIndex?: number;
};

export type SolicitacaoDocumento = {
    base64: string;
    nome?: string;
};

export type SolicitacaoDestinatario = {
    nome: string;
    email: string;
    mensagemPrivada?: string;
    modoAssinatura?: string;
    /** Posição na cadeia (1, 2, 3…). */
    ordem?: number;
    campos?: SolicitacaoCampo[];
};

export type SolicitacaoAssinaturaPayload = {
    pdfBase64?: string;
    nomeDocumento?: string;
    documentos?: SolicitacaoDocumento[];
    mensagem?: string;
    assunto?: string;
    /** Legado: e-mails separados por vírgula */
    destinatarios?: string;
    nomes?: string;
    /** Preferencial: cards com ordem de assinatura */
    destinatariosLista?: SolicitacaoDestinatario[];
    identificarSignatarios?: boolean;
    exigirCertificadoDigital?: boolean;
    tipoCertificado?: number;
    adicionarObservadores?: boolean;
    observadores?: string;
    monitorarValidade?: boolean;
    validadeMeses?: number;
    autodestruir?: boolean;
    dataExpiracao?: string;
    autenticacaoDoisFatores?: boolean;
    solicitarCpf?: boolean;
    solicitarDataNascimento?: boolean;
    solicitarSelfieDocumento?: boolean;
    emCadeia?: boolean;
    modoAssinatura?: string;
};

export type SolicitacaoAssinaturaResult = {
    message: string;
    documentKey: string;
    loteId?: number;
    destinatarios: Array<{ email: string; signingKey: string; signingUrl: string }>;
    documentos?: Array<{
        nome: string;
        documentKey: string;
        destinatarios: Array<{ email: string; signingKey: string; signingUrl: string }>;
    }>;
    erros?: string[];
};

export async function criarSolicitacaoAssinatura(
    data: SolicitacaoAssinaturaPayload
): Promise<SolicitacaoAssinaturaResult> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao-assinatura`,
            {
                method: "POST",
                headers: headers(),
                body: JSON.stringify(data),
            },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "criar solicitação de assinatura"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("criar solicitação de assinatura", err);
    }
}

export type BaixarAssinadoResult = {
    message: string;
    documentKey: string;
    caminhoRelativo: string;
    nome: string;
    base64: string;
    tamanho: number;
};

export async function baixarDocumentoAssinadoSolicitacao(
    documentKey: string,
    nome?: string
): Promise<BaixarAssinadoResult> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao-assinatura/baixar`,
            {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({ documentKey, nome }),
            },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "baixar documento assinado"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("baixar documento assinado", err);
    }
}

export type EquipePlugSignMembro = {
    id: number;
    nome: string;
    primeiroNome?: string;
    ultimoNome?: string;
    email: string;
    tipo?: "team" | "customer";
};

export async function listarEquipePlugSign(q?: string): Promise<EquipePlugSignMembro[]> {
    try {
        const url = new URL(`${API_BASE}/api/${caminho}/equipe-plugsign`);
        if (q?.trim()) url.searchParams.set("q", q.trim());
        const res = await apiFetch(url.toString(), { headers: headers() }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "listar equipe PlugSign"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("listar equipe PlugSign", err);
    }
}

export type MinhaSolicitacaoItem = {
    id: number;
    documentKey: string;
    email: string;
    status: string;
    message?: string | null;
    signingKey: string;
    sendTime?: string | null;
    updateTime?: string | null;
    senderName?: string | null;
    senderEmail?: string | null;
    nomeDocumento?: string | null;
    caminhoLocal?: string | null;
    pdfNoPaperSign?: boolean;
    statusPaperSign?: string | null;
};

export type MinhasSolicitacoesResult = {
    data: MinhaSolicitacaoItem[];
    page: number;
    lastPage: number;
    total: number;
};

export async function listarMinhasSolicitacoes(
    page = 1,
    status?: string
): Promise<MinhasSolicitacoesResult> {
    try {
        const url = new URL(`${API_BASE}/api/${caminho}/minhas-solicitacoes`);
        url.searchParams.set("page", String(page));
        if (status?.trim()) url.searchParams.set("status", status.trim());
        const res = await apiFetch(url.toString(), { headers: headers() }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "listar minhas solicitações"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("listar minhas solicitações", err);
    }
}

/** T-WS3a: linha da lista única (fluxo interno + envios PlugSign do PaperSign). */
export type ItemWaySign = Documento & {
    origem: "INTERNO" | "PLUGSIGN" | "DOCINTERNO";
    chave: string;
    document_key?: string | null;
    data_utc?: string | null;
    enviado_por?: string | null;
    enviado_por_nome?: string | null;
    situacao_waysign: string;
    status_original?: string | null;
    unidade?: string | null;
    destinatarios?: string | null;
    pdf_no_papersign: boolean;
    eu_remetente: boolean;
    eu_destinatario: boolean;
    minha_acao: boolean;
};

export type ItensWaySignResult = {
    data: ItemWaySign[];
    page: number;
    pageSize: number;
    total: number;
    lastPage: number;
    solicitantes: string[];
    aviso?: string | null;
    /** PlugSign:WaySignAssinarHabilitado (desligado até o teste confirmar a assinatura em nome do signatário). */
    assinarHabilitado?: boolean;
};

export type ItensWaySignParams = {
    page?: number;
    pageSize?: number;
    texto?: string;
    situacao?: string;
    origem?: string;
    solicitante?: string;
    dataIni?: string;
    dataFim?: string;
    visao?: string;
    foco?: number | null;
    /** Só os documentos do próprio usuário (mesmo para Admin). */
    apenasMeus?: boolean;
};

export async function listarItensWaySign(params: ItensWaySignParams): Promise<ItensWaySignResult> {
    try {
        const url = new URL(`${API_BASE}/api/${caminho}/itens`);
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && String(v).trim() !== "") url.searchParams.set(k, String(v).trim());
        }
        const res = await apiFetch(url.toString(), { headers: headers() }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, `buscar ${elemento_plural}`));
        const json = (await res.json()) as ItensWaySignResult;
        return {
            ...json,
            data: (json.data ?? []).map((item) => normalizarDocumento(item as unknown as Record<string, unknown>) as ItemWaySign),
            solicitantes: json.solicitantes ?? [],
        };
    } catch (err) {
        throw mensagemFalhaRede(`buscar ${elemento_plural}`, err);
    }
}

/** Link para assinar na PlugSign e se o "Assinar" do WaySign está liberado (403 se não houver pendência sua). */
export async function obterMinhaAssinaturaPlugSign(
    documentKey: string
): Promise<{ linkPlugSign: string; assinarAqui: boolean }> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao/${encodeURIComponent(documentKey)}/minha-assinatura`,
            { headers: headers() },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "obter sua assinatura"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("obter sua assinatura", err);
    }
}

/** Assina, com o A1 do usuário, a solicitação PlugSign pendente dele (o servidor descobre o signing_key). */
export async function assinarSolicitacaoPlugSign(documentKey: string): Promise<string> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao/${encodeURIComponent(documentKey)}/assinar`,
            { method: "POST", headers: headers() },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "assinar"));
        const json = await res.json();
        return json?.message ?? "Documento assinado.";
    } catch (err) {
        throw mensagemFalhaRede("assinar", err);
    }
}

export type SignatarioPlugSign = {
    id?: number | null;
    email?: string | null;
    status?: string | null;
    doubleAuth: boolean;
    enviadaEm?: string | null;
    atualizadaEm?: string | null;
    expiraEm?: string | null;
    eu: boolean;
    signingKey?: string | null;
    link?: string | null;
};

/** Signatários de um envio PlugSign; gerenciar = quem enviou ou Admin da unidade (conferido no servidor). */
export async function listarSignatariosPlugSign(
    documentKey: string
): Promise<{ gerenciar: boolean; data: SignatarioPlugSign[] }> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao/${encodeURIComponent(documentKey)}/signatarios`,
            { headers: headers() },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "listar signatários"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("listar signatários", err);
    }
}

export type MensagemSignatario = {
    canal: "email" | "whatsapp";
    destino?: string | null;
    assunto?: string | null;
    status?: string | null;
    origem?: string | null;
    momento?: string | null;
};

/** E-mails e WhatsApps enviados a um signatário (remetente, Admin da unidade ou o próprio). */
export async function listarMensagensSignatario(documentKey: string, signingKey: string): Promise<MensagemSignatario[]> {
    try {
        const url = new URL(`${API_BASE}/api/${caminho}/solicitacao/${encodeURIComponent(documentKey)}/mensagens`);
        url.searchParams.set("signingKey", signingKey);
        const res = await apiFetch(url.toString(), { headers: headers() }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "listar mensagens"));
        const json = await res.json();
        return json?.data ?? [];
    } catch (err) {
        throw mensagemFalhaRede("listar mensagens", err);
    }
}

export type AcaoSolicitacaoPlugSign = {
    acao: "lembrete-email" | "lembrete-whatsapp" | "trocar-signatario" | "2fa" | "cancelar";
    signingKey: string;
    telefone?: string;
    contato?: string;
    mensagem?: string;
    assunto?: string;
    exigir2fa?: boolean;
};

export async function acaoSolicitacaoPlugSign(documentKey: string, dados: AcaoSolicitacaoPlugSign): Promise<string> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/solicitacao/${encodeURIComponent(documentKey)}/acao`,
            { method: "POST", headers: headers(), body: JSON.stringify(dados) },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "executar a ação"));
        const json = await res.json();
        return json?.message ?? "Feito.";
    } catch (err) {
        throw mensagemFalhaRede("executar a ação", err);
    }
}

// ---------------- WaySign · Administração (Admin; alterar só PlugSign:WaySignAdminsConta) ----------------

async function adminFetch<T>(caminhoRel: string, acao: string, init?: RequestInit): Promise<T> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/admin/${caminhoRel}`,
            { headers: headers(), ...init },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, acao));
        return (await res.json()) as T;
    } catch (err) {
        throw mensagemFalhaRede(acao, err);
    }
}

export type ClientePlugSign = { id: number; email: string; nome: string; sobrenome: string };
export type LembreteAutomatico = { id?: number | null; assunto?: string | null; mensagem?: string | null; dias?: number | null };
export type WebhookPlugSign = { id?: number | null; url?: string | null; tipo?: string | null; ativo: boolean };
export type NotificacaoWebhook = { id?: number | null; url?: string | null; tipo?: string | null; httpStatus?: number | null; dataHora?: string | null };

export const adminListarClientes = (q?: string) =>
    adminFetch<{ alterar: boolean; data: ClientePlugSign[] }>(
        `clientes${q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, "listar clientes");
export const adminAtualizarCliente = (email: string, dados: { name?: string; last_name?: string; phone?: string; cpf?: string; address?: string; birth?: string }) =>
    adminFetch<{ message: string }>(`clientes/${encodeURIComponent(email)}`, "atualizar cliente",
        { method: "PUT", body: JSON.stringify(dados) });
export const adminExcluirCliente = (email: string) =>
    adminFetch<{ message: string }>(`clientes/${encodeURIComponent(email)}`, "excluir cliente", { method: "DELETE" });

export const adminListarLembretes = () =>
    adminFetch<{ alterar: boolean; data: LembreteAutomatico[] }>("lembretes", "listar lembretes");
export const adminSalvarLembrete = (l: { id?: number | null; assunto: string; mensagem: string; dias: number }) =>
    adminFetch<{ message: string }>("lembretes", "salvar lembrete", { method: "POST", body: JSON.stringify(l) });
export const adminExcluirLembrete = (id: number) =>
    adminFetch<{ message: string }>(`lembretes/${id}`, "excluir lembrete", { method: "DELETE" });

export const adminWebhooks = (page = 1) =>
    adminFetch<{ alterar: boolean; webhooks: WebhookPlugSign[]; notificacoes: NotificacaoWebhook[]; page: number; lastPage: number }>(
        `webhooks?page=${page}`, "listar webhooks");
export const adminReenviarWebhooks = (documentKey: string) =>
    adminFetch<{ message: string }>("webhooks/reenviar", "reenviar webhooks",
        { method: "POST", body: JSON.stringify({ documentKey }) });

// ---------------- WaySign · Templates e Lotes ----------------

async function waySignFetch<T>(caminhoRel: string, acao: string, init?: RequestInit): Promise<T> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/${caminhoRel}`, { headers: headers(), ...init }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, acao));
        return (await res.json()) as T;
    } catch (err) {
        throw mensagemFalhaRede(acao, err);
    }
}

export type TemplateWaySign = {
    id?: number | null;
    nome?: string | null;
    arquivo?: string | null;
    extensao?: string | null;
    documentKey?: string | null;
    enviadoEm?: string | null;
    enviadoPor?: string | null;
};

export const listarTemplatesWaySign = (nome?: string) =>
    waySignFetch<{ excluir: boolean; data: TemplateWaySign[] }>(
        `templates${nome?.trim() ? `?nome=${encodeURIComponent(nome.trim())}` : ""}`, "listar templates");
export const enviarTemplateWaySign = (dados: { nome?: string; arquivoNome: string; base64: string }) =>
    waySignFetch<{ message: string; documentKey?: string }>("templates", "enviar template",
        { method: "POST", body: JSON.stringify(dados) });
export const excluirTemplateWaySign = (id: number) =>
    waySignFetch<{ message: string }>(`templates/${id}`, "excluir template", { method: "DELETE" });
export const tagsTemplateWaySign = (documentKey: string) =>
    waySignFetch<{ data: string[] }>(`templates/${encodeURIComponent(documentKey)}/tags`, "ler campos do template");
export const usarTemplateWaySign = (
    documentKey: string,
    dados: {
        nomeDocumento?: string;
        mensagem?: string;
        emCadeia?: boolean;
        doubleAuth?: boolean;
        tags?: Record<string, string>;
        destinatarios: { email: string; nome?: string }[];
    }
) =>
    waySignFetch<{ message: string; documentKey?: string | null; naLista: boolean }>(
        `templates/${encodeURIComponent(documentKey)}/enviar`, "enviar para assinatura",
        { method: "POST", body: JSON.stringify(dados) });

export type LoteResumo = { id?: number | null; nome?: string | null; criadoEm?: string | null; arquivos: number; solicitacoes: number; pendentes: number };
export type LoteDetalhe = {
    id?: number | null;
    nome?: string | null;
    criadoEm?: string | null;
    arquivos: { id?: number | null; nome?: string | null; documentKey?: string | null; status?: string | null }[];
    solicitacoes: { signingKey?: string | null; email?: string | null; status?: string | null; enviadaEm?: string | null; atualizadaEm?: string | null }[];
};

export const listarLotesWaySign = (page = 1) =>
    waySignFetch<{ data: LoteResumo[]; page: number; lastPage: number }>(`lotes?page=${page}`, "listar lotes");
export const detalheLoteWaySign = (id: number) => waySignFetch<LoteDetalhe>(`lotes/${id}`, "abrir lote");
export const acaoLoteWaySign = (id: number, acao: "lembrete" | "cancelar", signingKey: string) =>
    waySignFetch<{ message: string }>(`lotes/${id}/acao`, acao === "lembrete" ? "enviar lembrete" : "cancelar",
        { method: "POST", body: JSON.stringify({ acao, signingKey }) });

/** ZIP do lote (base64) para baixar no navegador. */
export async function baixarZipLoteWaySign(id: number): Promise<Blob> {
    try {
        const res = await apiFetch(`${API_BASE}/api/${caminho}/lotes/${id}/zip`, { headers: headers() }, ASSINATURA_TIMEOUT_MS);
        if (!res.ok) throw new Error(await lerErroApi(res, "baixar lote"));
        return await res.blob();
    } catch (err) {
        throw mensagemFalhaRede("baixar lote", err);
    }
}

export type HistoricoSolicitacaoItem = {
    id: number;
    activity: string;
    time: string;
    type?: string | null;
    user?: string | null;
    file: string;
    signingKey?: string | null;
};

export async function obterHistoricoSolicitacao(
    documentKey: string
): Promise<{ documentKey: string; data: HistoricoSolicitacaoItem[] }> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/minhas-solicitacoes/${encodeURIComponent(documentKey)}/historico`,
            { headers: headers() },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "obter histórico da solicitação"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("obter histórico da solicitação", err);
    }
}

export type LembreteSolicitacaoResult = {
    message: string;
    enviados: number;
    destinatarios?: string[];
    erros?: string[];
};

export async function enviarLembreteSolicitacao(
    documentKey: string,
    opts?: { mensagem?: string; assunto?: string }
): Promise<LembreteSolicitacaoResult> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/minhas-solicitacoes/lembrete`,
            {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    documentKey,
                    mensagem: opts?.mensagem,
                    assunto: opts?.assunto,
                }),
            },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "enviar lembrete da solicitação"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("enviar lembrete da solicitação", err);
    }
}

export type FornecedorParceiroPayload = {
    primeiroNome: string;
    ultimoNome: string;
    email: string;
    telefone?: string;
    nascimento?: string;
    cpf?: string;
    endereco?: string;
};

export type FornecedorParceiroResult = {
    message: string;
    plugSign?: {
        id: number;
        email: string;
        name: string;
        lastName: string;
        tipo?: string;
    } | null;
    paperSign?: {
        id: number;
        usuario: string;
        aviso: string;
    } | null;
};

export async function criarFornecedorParceiro(
    data: FornecedorParceiroPayload
): Promise<FornecedorParceiroResult> {
    try {
        const res = await apiFetch(
            `${API_BASE}/api/${caminho}/fornecedor-parceiro`,
            {
                method: "POST",
                headers: headers(),
                body: JSON.stringify(data),
            },
            ASSINATURA_TIMEOUT_MS
        );
        if (!res.ok) throw new Error(await lerErroApi(res, "criar fornecedor/parceiro"));
        return await res.json();
    } catch (err) {
        throw mensagemFalhaRede("criar fornecedor/parceiro", err);
    }
}

export type { Documento, DocumentoAssinar, DocumentoAprovacao, DocumentoAnexoAssinar }