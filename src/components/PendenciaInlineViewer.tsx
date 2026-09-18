"use client";

import type { PendenciaGestorItem } from "@/types/Pendencias";
import { PendenciaAssinaturaViewer } from "@/components/PendenciaAssinaturaViewer";
import { PendenciaMovimentoViewer } from "@/components/PendenciaMovimentoViewer";
import { PendenciaPagamentoViewer } from "@/components/PendenciaPagamentoViewer";
import { PendenciaComunicadoViewer } from "@/components/PendenciaComunicadoViewer";
import { PendenciaFiscalViewer } from "@/components/PendenciaFiscalViewer";
import { pendenciaSuportaAssinaturaInline } from "@/utils/pendenciaAssinatura";
import { pendenciaEhMovimento } from "@/utils/pendenciaMovimento";
import { pendenciaEhPagamento } from "@/utils/pendenciaPagamento";
import { pendenciaEhComunicado } from "@/utils/pendenciaComunicado";
import { pendenciaEhFiscal } from "@/utils/pendenciaFiscal";
import { buildPendenciaUrl, labelTipoPendencia } from "@/utils/pendenciaNavigation";
import { aplicarGestorUnidadePendencia } from "@/utils/pendenciaAssinatura";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

type Props = {
  item: PendenciaGestorItem;
  onClose: () => void;
  onConcluido?: () => void;
};

function PendenciaFallbackViewer({ item, onClose }: Props) {
  function abrirNovaAba() {
    const restaurar = aplicarGestorUnidadePendencia(item);
    const url = buildPendenciaUrl(item.rota, item.filtro, item.id);
    window.open(url, "_blank", "noopener,noreferrer");
    restaurar();
  }

  return (
    <div className="flex min-h-[280px] flex-col p-6">
      <div className="mb-4 flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
      <p className="text-sm font-semibold">{item.titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.unidade.replace("WAY ", "Base ")} · {labelTipoPendencia(item.tipo)}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Este tipo ainda não abre totalmente dentro da caixa. Você pode continuar na página
        completa sem fechar o modal — abrimos em uma nova aba.
      </p>
      <Button type="button" className="mt-6 gap-2 self-start" onClick={abrirNovaAba}>
        <ExternalLink className="h-4 w-4" />
        Abrir em nova aba
      </Button>
    </div>
  );
}

export function PendenciaInlineViewer({ item, onClose, onConcluido }: Props) {
  if (pendenciaEhMovimento(item.tipo)) {
    return (
      <PendenciaMovimentoViewer
        item={item}
        onClose={onClose}
        onConcluido={onConcluido}
      />
    );
  }

  if (pendenciaEhPagamento(item.tipo)) {
    return (
      <PendenciaPagamentoViewer
        item={item}
        onClose={onClose}
        onConcluido={onConcluido}
      />
    );
  }

  if (pendenciaEhComunicado(item.tipo)) {
    return (
      <PendenciaComunicadoViewer
        item={item}
        onClose={onClose}
        onConcluido={onConcluido}
      />
    );
  }

  if (pendenciaEhFiscal(item.tipo)) {
    return (
      <PendenciaFiscalViewer
        item={item}
        onClose={onClose}
        onConcluido={onConcluido}
      />
    );
  }

  if (pendenciaSuportaAssinaturaInline(item.tipo)) {
    return (
      <PendenciaAssinaturaViewer
        item={item}
        onClose={onClose}
        onSigned={onConcluido}
      />
    );
  }

  return <PendenciaFallbackViewer item={item} onClose={onClose} onConcluido={onConcluido} />;
}
