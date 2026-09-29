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
    receitas: boolean,
    extrato_gestor: boolean,
    controle_medicao: boolean,
    config_alcadas?: boolean,
    config_usuarios?: boolean,
    config_bordero_aprovadores?: boolean,
    config_restrito_aprovadores?: boolean,
    config_fornecedores_restritos?: boolean,
    config_impostos_aprovadores?: boolean,
    config_financeiro_aprovadores?: boolean,
    config_fiscal_aprovadores?: boolean,
    config_rh_aprovadores?: boolean,
    config_disparos?: boolean,
    config_cadastro_externos?: boolean,
    config_status_pedido?: boolean,
    replicar_todas_unidades?: boolean,
    unidade?: string,
}

export type UnidadeResultado = {
    unidade: string,
    status: 'criado' | 'atualizado' | 'ja_existe' | 'erro',
    sequencial?: number,
    mensagem?: string,
}

export type CreateUsuarioResultado = {
    replicado: boolean,
    resultados: UnidadeResultado[],
}

export type CopiarUsuarioResultado = {
    codusuario: string,
    nome: string,
    unidadeOrigem: string,
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