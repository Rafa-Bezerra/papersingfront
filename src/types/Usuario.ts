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
    externo: boolean,
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