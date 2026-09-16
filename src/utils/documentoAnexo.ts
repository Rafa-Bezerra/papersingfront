import type { DocumentoAnexo } from '@/types/Documento'

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
