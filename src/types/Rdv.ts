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
    codcfo?: string;
    situacao: string;
    arquivo?: string;
    idmov?: number;
    codigo_atendimento?: number;
    arquivo_assinado?: boolean;
    itens: ItemRdv[];
    anexos: AnexoRdv[];
    aprovadores: AprovadoresRdv[];
};
export type AnexoRdv = {
    id?: number;
    anexo: string;
    nome: string;
};
export type AprovadoresRdv = {
    usuario: string;
    nome?: string;
    data_aprovacao?: string;
    aprovacao?: string;
};
export type Fornecedor = {
    codcfo: string;
    usuario: string;
    nome: string;
};
export type AssinarRdv = {
    idrdv: number
    arquivo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}