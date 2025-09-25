export type RequisicaoDto = {
    requisicao: Requisicao,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes: Requisicao_aprovacao[]
}

export type Requisicao = {
    id: number,
    tipo: string,
    base_de_dado: string,
    movimento: string,
    tipo_movimento: string,
    data_emissao: string,
    valor_bruto: number,
    situacao: string,
    arquivo: string,
    requisicao_itens: Requisicao_item[],
    requisicao_aprovacoes?: Requisicao_aprovacao[]
}

export type Requisicao_item = {
    id: number,
    requisicao_id: number,
    descricao: string,
    quantidade: number,
    cotacao_1: number,
    fornecedor_1: string,
    cotacao_2: number,
    fornecedor_2: string,
    cotacao_selecionada: number,
    fornecedor_selecionado: string
}

export type Requisicao_aprovacao = {
    id: number,
    requisicao_id: number,
    usuario_id: number,
    situacao: string,
    data_aprovacao: string
}