export interface FiscalGetAll {
    dateFrom: string,
    dateTo: string,
    status: string,
    solicitante: string,
    tipo_movimento: string,
}

export interface FiscalGetDocumento {
    idmov: number,
    tipo: string,
}

export interface FiscalAprovarDocumento {
    idmov: number,
    codigo_atendimento: number,
    aprovar: boolean,
}

export interface FiscalDocumento {
    id: number,
    idmov: number,
    nome: string,
    anexo: string,
}

export interface FiscalResponseDto {
    fiscal: Fiscal,
    movimento: FiscalMovimento,
    movimento_itens: FiscalItem[],
    fiscal_aprovacoes: FiscalAprovacao[]
}

export interface Fiscal {
    idmov: number,
    nome_solicitante: string,
    data_emissao: string,
    movimento: string,
    tipo_movimento: string,
    status: string,
    documento_assinado: number,
}

export interface FiscalMovimento {
    idmov: number,
    codigo_atendimento: number,
    natureza_orcamentaria: string,
    etapa: string,
    fornecedor: string,
    valor_total: number,
    historico: string,
}

export interface FiscalItem {
    sequencia: number,
    centro_custo: string,
    preco_unitario: number,
    valor_total: number,
    quantidade: number,
    historico: string,
}

export interface FiscalAprovacao {
    id: number,
    usuario: string,
    nome: string,
    nivel: number,
    situacao?: string,
    data_aprovacao?: string,
}

export type FiscalAssinar = {
    idmov: number
    atendimento: number
    arquivo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}