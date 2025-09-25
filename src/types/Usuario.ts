export type Usuario = {
    SEQUENCIAL: number,
    CODUSUARIO: string,
    NOME: string,
    EMPRESA: string,
    CODPERFIL: string,
    DIRETORIA: string,
    EMAIL: string,
    ATIVO: Boolean,
    DATACRIACAO: string,
    CODSISTEMA: string,
}

export interface LoginPayload {
    username: string;
    password: string;
}

export interface LoginResponse {
    SEQUENCIAL: number;
    CODUSUARIO: string;
    NOME: string;
    TOKEN: string;
}