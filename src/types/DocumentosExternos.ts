export interface DocumentoExterno {
    id: number;
    assunto: string;
    status: string;
    unidade: string;
    usuario_criacao: string;
    data_criacao: string; // ISO string
    pode_aprovar?: boolean;
    pode_reprovar?: boolean;
    pode_excluir?: boolean;
    pode_assinar?: boolean;
    assinatura_externo?: boolean;
    usuario_assinou?: boolean;
}

export interface DocumentoExternoAprovador {
    id?: number;
    usuario: string;
    nome?: string;
    nivel: number;
    aprovacao?: string;
    data_aprovacao?: string;
}

export interface DocumentoExternoCreateDTO {
    arquivo: string;      // base64
    id_externo: number;
    assunto: string;
    aprovadores: DocumentoExternoAprovador[];
}

export interface DocumentoExternoFiltro {
    dateFrom?: string;   // ISO string
    dateTo?: string;  // ISO string
    status?: string;
    externo?: boolean;
}

export interface DocumentoExternoAssinar {
    id: number;
    pagina: number;
    posX: number;
    posY: number;
    largura: number;
    altura: number;
}
