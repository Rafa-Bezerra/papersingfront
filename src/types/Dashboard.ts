export interface DashboardStats {
    movimentos: DashMovimentos[];
    quantidade_movimentos: number;
    quantidade_restritos: number;
    quantidade_pagamentos_rh: number;
    quantidade_pagamentos_impostos: number;
    quantidade_bordero: number;
    quantidade_comunicados: number;
    quantidade_rdv: number;
    quantidade_fiscal: number;
    quantidade_externo: number;
    quantidade_documentos: number;
}

export interface DashMovimentos {
    status_movimento: string;
    quantidade: number;
}