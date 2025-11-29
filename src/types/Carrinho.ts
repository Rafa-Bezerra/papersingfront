export type ItemCarrinho = {
    idprd: number;
    produto?: string;
    codconta: string;
    contabil?: string;
    ccusto: string;
    custo?: string;
    quantidade?: number;
    descricao?: string;
};

export type Carrinho = {
    tipo_movimento: string;
    descricao: string;
    itens: ItemCarrinho[];
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