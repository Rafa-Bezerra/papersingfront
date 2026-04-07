export type ComunicadoItemFinanceiro = {
    setor: string,
    ccusto: string,
    codconta: string,
    valor: number,
}

export type Comunicado = {
    id: number,
    data_criacao: string,
    documento_assinado: number,
    anexo: string,
    situacao: string,
    nome: string,
    usuario_criacao: string,
    aprovadores: ComunicadoAprovacao[],
    pessoa_destinada: string,
    cargo: string,
    cidade_origem: string,
    concessionaria: string,
    itensFinanceiros: ComunicadoItemFinanceiro[],
    rodape: string,
    usuario_nome: string,
    pagamentos: ComunicadoPagamentos[],
    anexos: ComunicadoAnexo[],
}

export type ComunicadoPagamentos = {
    sequencia: number,
    descricao: string,
    referencia: string,
    valor: number,
}

export type ComunicadoAprovacao = {
    id?: number,
    data_aprovacao?: string,
    aprovacao?: string,
    usuario: string,
    nome?: string,
    usuario_nome?: string,
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

export type ComunicadoAnexo = {
    id?: number,
    anexo: string,
    nome: string,
    usuario_criacao?: string
}