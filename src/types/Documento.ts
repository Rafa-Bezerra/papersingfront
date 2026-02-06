export type Documento = {
    id: number,
    data_criacao: string,
    situacao: string,
    nome: string,
    usuario_criacao: string,
    anexos: DocumentoAnexo[],
    aprovadores: DocumentoAprovacao[],
}

export type DocumentoAprovacao = {
    id?: number,
    data_aprovacao?: string,
    aprovacao?: string,
    ordem: number,
    usuario: string,
    usuario_nome?: string,
}

export type DocumentoAnexo = {
    id?: number,
    anexo: string,
    nome: string,
    usuario_criacao?: string,
    documento_assinado?: number,
}

export type DocumentoAssinar = {
    id: number
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}

export type DocumentoAnexoAssinar = {
    id?: number
    anexo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}