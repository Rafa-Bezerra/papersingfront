'use client';

import { ShoppingCart } from 'lucide-react';

import MovimentosRm from './manutencao/MovimentosRm';
import { SeletorUnidade, useUnidadeFrotas } from './comum';

/** Pedidos 1.1.36 do RM — lançamento vira nota da Manutenção. */
export default function PedidosCompraPage() {
  const sel = useUnidadeFrotas();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" /> Pedidos de compra
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pedidos da frota no RM (movimento 1.1.36), com status, NF gerada e itens por placa. Daqui o pedido vira nota da
            Manutenção.
          </p>
        </div>
        <SeletorUnidade {...sel} />
      </div>
      <MovimentosRm unidade={sel.unidade} onMudou={() => {}} />
    </div>
  );
}
