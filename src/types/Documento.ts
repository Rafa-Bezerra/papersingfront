export type Documento = {
    id: number,
    data_criacao: string,
    data_prazo: string,
    documento_assinado: number,
    anexo: string,
    situacao: string,
    nome: string,
    aprovadores: DocumentoAprovacao[],
}

export type DocumentoAprovacao = {
    id?: number,
    data_aprovacao?: string,
    aprovacao?: string,
    ordem: number,
    usuario: string,
}

export type DocumentoAssinar = {
    id: number
    anexo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}