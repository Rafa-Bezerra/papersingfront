export type RequisicaoDto = {
    requisicao: Requisicao,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes: Requisicao_aprovacao[]
}

export type Requisicao = {
    idmov: number,
    centro_custo: string,
    nome_solicitante: string,
    numero_movimento: string,
    tipo_movimento: string,
    data_emissao: string,
    valorbruto: number,
    historico_solicitacao: string,
    cod_status_aprovacao: string,
    arquivo: string,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes?: Requisicao_aprovacao[]
}

export type Requisicao_item = {
    cod_item: number,
    quantidade_produto: number,
    historico_item: string
    codcoligada: string,
    cod_fornecedor: string,
    centro_custo: string,
    nat_orcamentaria: string,
    nome_etapa: string,
}

export type Requisicao_aprovacao = {
    id: number,
    usuario: string,
    situacao: string,
    data_aprovacao: string
}