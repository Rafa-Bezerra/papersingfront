import { ComunicadoItemFinanceiroFlat } from '@/types/Comunicado'

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
    possui_documento: boolean,
    documento_assinado: boolean,
    status_aprovacao: string,
    caminho_anexo: string,
    itens_aglutinados?: PagamentoAglutinadoItem[] | null,
}
export type PagamentoAglutinadoItem = {
    idlan: number,
    nome_fantasia: string,
    data_vencimento: string,
    valor_original: number,
    status_aprovacao: string,
    caminho_anexo: string,
    possui_documento: boolean,
    documento_assinado: boolean,
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
    idlan?: number,
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
export type PagamentoAprovarLote = {
    ids: number[],
    grupo: string,
    aprovar: boolean,
}
export type PagamentoAprovarLoteResultado = {
    sucesso: number[],
    falhas: { id: number, erro: string }[],
}
export type PagamentoGerarDocumento = {
    idlan: number,
    grupo: string,
    arquivo: string
}
export type PagamentoGerarDocumentoLote = {
    ids: number[],
    grupo: string,
    arquivo: string
}
export type PagamentoGetDocumento = {
    idlan: number,
    grupo: string
}
export type PagamentoAssinarDocumento = {
    idlan: number
    grupo: string
    arquivo: string
    caminho: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
    dataHoraAssinatura: string
}
export type CriarFinanceiroPagamentoPayload = {
    grupo: string;
    codcfo: string;
    cod_tipo_documento: string;
    data_vencimento: string;
    data_emissao?: string;
    numero_documento?: string;
    // Rateio por item (flat — uma linha por conta contábil/centro de custo), mesmo formato usado
    // por /comunicados (ver achatarItensFinanceiros em @/utils/comunicadoRateio).
    itensFinanceiros: ComunicadoItemFinanceiroFlat[];
}
export type CriarFinanceiroPagamentoResult = {
    sucesso: boolean;
    message?: string;
    erro?: string;
    numeroFinanceiro?: string;
    idlanTotvs?: number;
}