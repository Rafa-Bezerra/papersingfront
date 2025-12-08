export type ItemRdv = {
    idprd: number;
    produto?: string;
    codconta: string;
    contabil?: string;
    ccusto: string;
    custo?: string;
    quantidade?: number;
    valor?: number;
    descricao?: string;
};
export type Rdv = {
    id?: number;
    descricao: string;
    periodo_de?: string;
    periodo_ate?: string;
    origem?: string;
    destino?: string;
    situacao: string;
    itens: ItemRdv[];
    anexos: AnexoRdv[];
    aprovadores: AprovadoresRdv[];
};
export type AnexoRdv = {
    anexo: string;
    nome: string;
};
export type AprovadoresRdv = {
    usuario: string;
    nome?: string;
    data_aprovacao?: string;
    aprovacao?: string;
};