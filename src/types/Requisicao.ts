export type RequisicaoDto = {
    requisicao: Requisicao,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes: Requisicao_aprovacao[]
}

export type Requisicao = {
    codcoligada: number,
    idmov: number,
    documento_assinado: number,
    codigo_atendimento: number,
    movimento: string,
    tipo_movimento: string,
    nome_solicitante: string,
    data_emissao: string,
    valor_total: number,
    codigo_fornecedor: string,
    nome_fornecedor: string,
    status_movimento: string,
    historico_movimento: string,
    nome_etapa: string,
    arquivo: string,
    quantidade_anexos: number,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes?: Requisicao_aprovacao[]
}

export type Requisicao_item = {
    codigo_item_movimento: number,
    centro_custo: string,
    nome_centro_custo: string,
    item_quantidade: number
    item_preco_unitario: number,
    item_total: number,
    historico_item: string,
    codigo_natureza_orcamentaria: string,
    nome_natureza_orcamentaria: string,
}

export type Requisicao_aprovacao = {
    id: number,
    usuario: string,
    nome: string,
    nivel: number,
    situacao: string,
    data_aprovacao: string
}