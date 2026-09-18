export interface PendenciaGestorItem {
  unidade: string;
  tipo: string;
  titulo: string;
  referencia?: string | null;
  id?: number | null;
  valor?: number | null;
  data?: string | null;
  rota: string;
  filtro?: string | null;
  detalhe?: string | null;
  codigoAtendimento?: number | null;
}

export interface PendenciaGestorResumoUnidade {
  unidade: string;
  total: number;
}

export interface PendenciaGestorResumoUnidadeTipo {
  unidade: string;
  tipo: string;
  total: number;
}

export interface PendenciasGestorResponse {
  total: number;
  totalExibidos?: number;
  itens: PendenciaGestorItem[];
  porUnidade: PendenciaGestorResumoUnidade[];
  porUnidadeTipo?: PendenciaGestorResumoUnidadeTipo[];
}
