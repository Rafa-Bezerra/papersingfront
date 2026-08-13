export type Usuario = {
    sequencial: number,
    codusuario: string,
    nome: string,
    empresa: string,
    codperfil: string,
    diretoria: string,
    email: string,
    ativo: boolean,
    datacriacao: string,
    codsistema: string,
    admin: boolean,
    documentos: boolean,
    bordero: boolean,
    comunicados: boolean,
    rdv: boolean,
    ccusto: boolean,
    externo: boolean,
    restrito: boolean,
    administrativo: boolean,
    solicitante: boolean,
    pagamento_impostos: boolean,
    pagamento_rh: boolean,
    fiscal: boolean,
    gestao_pessoas: boolean,
    financeiro: boolean,
    docusign: boolean,
    projetos: boolean,
    contratos: boolean,
    financeiro_totvs: boolean,
    replicar_todas_unidades?: boolean,
}

export type UnidadeResultado = {
    unidade: string,
    status: 'criado' | 'ja_existe' | 'erro',
    sequencial?: number,
    mensagem?: string,
}

export type CreateUsuarioResultado = {
    replicado: boolean,
    resultados: UnidadeResultado[],
}

export interface LoginPayload {
    username: string;
    password: string;
}

export interface LoginResponse {
    sequencial: number;
    codusuario: string;
    nome: string;
    token: string;
}