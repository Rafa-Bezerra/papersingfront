// Uma linha do rateio: uma conta contábil dentro de um item, com valor absoluto ou percentual do
// valor total do item — o campo não editado é sempre recalculado a partir do que foi digitado.
export type ComunicadoRateioConta = {
    id?: number,
    codconta: string,
    modo: 'valor' | 'percentual',
    percentual: number,
    valor: number,
    codigo_natureza_financeira?: string | null,
}

// Um item do comunicado: centro de custo + valor total, rateado entre uma ou mais contas contábeis.
export type ComunicadoItemFinanceiro = {
    setor: string,
    ccusto: string,
    valor_total: number,
    rateio: ComunicadoRateioConta[],
}

// Formato "flat" usado pela API (uma linha por conta contábil) — espelha ComunicadoItemFinanceiroDto
// no backend. numero_item agrupa as linhas que pertencem ao mesmo item.
export type ComunicadoItemFinanceiroFlat = {
    id?: number,
    setor?: string | null,
    ccusto?: string | null,
    codconta?: string | null,
    valor: number,
    codigo_natureza_financeira?: string | null,
    numero_item?: number | null,
    valor_total_item?: number | null,
    percentual?: number | null,
}

export type Comunicado = {
    id: number,
    data_criacao: string,
    documento_assinado: number,
    anexo: string,
    situacao: string,
    nome: string,
    usuario_criacao: string,
    aprovadores: ComunicadoAprovacao[],
    pessoa_destinada: string,
    cargo: string,
    cidade_origem: string,
    concessionaria: string,
    itensFinanceiros: ComunicadoItemFinanceiro[],
    rodape: string,
    corpo_documento?: string | null,
    usuario_nome: string,
    pagamentos: ComunicadoPagamentos[],
    anexos: ComunicadoAnexo[],
    financeiro_gerado?: boolean,
    numero_financeiro?: string | null,
    idlan_financeiro_totvs?: number | null,
    erro_financeiro?: string | null,
    // Campos de criação do financeiro — só relevantes/persistidos para quem detém a claim financeiro_totvs.
    codcfo?: string | null,
    cod_tipo_documento?: string | null,
    data_vencimento?: string | null,
    data_emissao?: string | null,
    numero_documento?: string | null,
}

export type ComunicadoPagamentos = {
    sequencia: number,
    descricao: string,
    referencia: string,
    valor: number,
}

export type ComunicadoAprovacao = {
    id?: number,
    data_aprovacao?: string,
    aprovacao?: string,
    usuario: string,
    nome?: string,
    usuario_nome?: string,
}

export type ComunicadoAssinar = {
    id: number
    anexo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
    dataHoraAssinatura: string
}

export type ComunicadoAnexo = {
    id?: number,
    anexo: string,
    nome: string,
    usuario_criacao?: string
}