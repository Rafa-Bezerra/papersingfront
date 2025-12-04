export type Comunicado = {
    id: number,
    data_criacao: string,
    documento_assinado: number,
    anexo: string,
    situacao: string,
    nome: string,
    usuario_criacao: string,
    aprovadores: ComunicadoAprovacao[],
}

export type ComunicadoAprovacao = {
    id?: number,
    data_aprovacao?: string,
    aprovacao?: string,
    usuario: string,
    nome?: string,
}

export type ComunicadoAssinar = {
    id: number
    anexo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}