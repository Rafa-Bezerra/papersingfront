export type Pagamento = {
    idlan: number,
    nome_fantasia: string,
    numero_documento: string,
    tipo_documento: string,
    historico: string,
    usuario_criacao: string,
    status_lancamento: string,
    grupo: string,
    data_criacao: string,
    data_vencimento: string,
    data_prev_baixa: string,
    tributos: number,
    multas: number,
    caucao: number,
    valor_liquido: number,
    valor_original: number,
    pode_aprovar: boolean,
    pode_reprovar: boolean,
    status_aprovacao: string,
}
export type PagamentoAprovador = {
    id: number,
    data_aprovacao?: string
    aprovacao: string,
    usuario: string,
    nome: string,
}
export type PagamentoGetAll = {
    dateFrom: string,
    dateTo: string,
    grupo: string,
    status: string,
    situacao: string,
}
export type PagamentoAprovadoresGetAll = {
    id: number,
    grupo: string,
}
export type PagamentoAprovar = {
    id: number,
    aprovacao: string,
    grupo?: string,
    aprovar?: boolean,
    usuario?: string,
    nome?: string,
}