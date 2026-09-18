import type { DocumentoAnexo, DocumentoAprovacao } from '@/types/Documento'
import { normalizeUserCode, stripDiacritics } from '@/utils/functions'

/** Escolhe o PDF principal do documento (flag, depois anexo “normal”, depois o primeiro). */
export function resolverAnexoDocumento(anexos?: DocumentoAnexo[]): DocumentoAnexo | undefined {
    if (!anexos?.length) return undefined

    const principal = anexos.find((a) => a.documento_principal)
    if (principal) return principal

    const semComprovante = anexos.filter((a) => {
        const nome = (a.nome ?? '').toLowerCase()
        return !nome.includes('comprovante')
    })
    const pool = semComprovante.length > 0 ? semComprovante : anexos

    return pool.find((a) => a.documento_assinado === 1) ?? pool[0]
}

export function base64ParaImpressao(dataUrlOuBase64: string): string {
    let base64 = dataUrlOuBase64.trim()
    if (base64.startsWith('data:')) base64 = base64.split(',')[1] ?? ''
    return base64
}

/** Criador do documento (codusuario ou nome do solicitante). */
export function ehCriadorDocumento(opts: {
    usuario_criacao?: string | null
    usuario_nome?: string | null
    userCodusuario?: string | null
    userName?: string | null
}): boolean {
    const login = normalizeUserCode(opts.userCodusuario)
    const nome = normalizeUserCode(opts.userName)
    const criador = normalizeUserCode(opts.usuario_criacao)
    const solicitante = normalizeUserCode(opts.usuario_nome)
    if (criador && login && criador === login) return true
    if (!solicitante) return false
    return (!!login && solicitante === login) || (!!nome && solicitante === nome)
}

function aprovadorDecidiu(aprovacao?: string | null): boolean {
    const s = (aprovacao ?? 'P').trim().toUpperCase()
    return s === 'A' || s === 'R'
}

function mesmoUsuario(a: string, b: string): boolean {
    const na = normalizeUserCode(a)
    const nb = normalizeUserCode(b)
    return !!na && !!nb && na === nb
}

function nomesCoincidem(a?: string | null, b?: string | null): boolean {
    const na = stripDiacritics(String(a ?? '').toLowerCase().trim())
    const nb = stripDiacritics(String(b ?? '').toLowerCase().trim())
    return !!na && !!nb && na === nb
}

function ehAprovadorDoCriador(
    ap: DocumentoAprovacao,
    opts: { userCodusuario?: string | null; usuario_criacao?: string | null; userName?: string | null }
): boolean {
    if (opts.userCodusuario && mesmoUsuario(ap.usuario, opts.userCodusuario)) return true
    if (opts.usuario_criacao && mesmoUsuario(ap.usuario, opts.usuario_criacao)) return true
    if (opts.userName && ap.usuario_nome && nomesCoincidem(ap.usuario_nome, opts.userName)) return true
    return false
}

/**
 * Outro usuário (não o criador) já aprovou ou reprovou.
 * A ação do próprio criador não impede exclusão.
 */
export function outroUsuarioDecidiuAprovacao(
    aprovadores?: DocumentoAprovacao[],
    opts?: { userCodusuario?: string | null; usuario_criacao?: string | null; userName?: string | null }
): boolean {
    if (!aprovadores?.length) return false
    return aprovadores.some(
        (ap) => aprovadorDecidiu(ap.aprovacao) && !ehAprovadorDoCriador(ap, opts ?? {})
    )
}

/** Usuário participa do documento (criador, aprovador ou já assinou). */
export function usuarioParticipaDocumento(opts: {
    usuario_criacao?: string | null
    usuario_nome?: string | null
    userCodusuario?: string | null
    userName?: string | null
    aprovadores?: DocumentoAprovacao[]
    anexos?: DocumentoAnexo[]
}): boolean {
    if (ehCriadorDocumento(opts)) return true
    const login = normalizeUserCode(opts.userCodusuario)
    if (login && opts.aprovadores?.some((ap) => normalizeUserCode(ap.usuario) === login)) return true
    if (opts.anexos?.some((a) => a.documento_assinado === 1)) return true
    return false
}

/** Criador pode excluir até outro usuário aprovar/reprovar. */
export function podeExcluirDocumentoCriador(opts: {
    usuario_criacao?: string | null
    usuario_nome?: string | null
    userCodusuario?: string | null
    userName?: string | null
    aprovadores?: DocumentoAprovacao[]
}): boolean {
    if (!ehCriadorDocumento(opts)) return false
    return !outroUsuarioDecidiuAprovacao(opts.aprovadores, {
        userCodusuario: opts.userCodusuario,
        usuario_criacao: opts.usuario_criacao,
        userName: opts.userName,
    })
}
