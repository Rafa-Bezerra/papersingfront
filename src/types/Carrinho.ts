export type ItemCarrinho = {
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

export type Carrinho = {
    tipo_movimento: string;
    descricao: string;
    periodo_de?: string;
    periodo_ate?: string;
    origem?: string;
    destino?: string;
    itens: ItemCarrinho[];
    anexos: AnexoCarrinho[];
};

export type CentroDeCusto = {
    ccusto: string;
    custo: string;
};

export type ContaFinanceira = {
    codconta: string;
    contabil: string;
};

export type Produto = {
    idprd: number;
    produto: string;
};

export type AnexoCarrinho = {
    anexo: string;
    descricao: string;
};