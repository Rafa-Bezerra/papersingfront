"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  mensagem: string;
  processando?: boolean;
  podeAprovar?: boolean;
  podeReprovar?: boolean;
  labelAprovar?: string;
  labelReprovar?: string;
  onAprovar: () => void;
  onReprovar: () => void;
};

export function PendenciaAcoesFooter({
  mensagem,
  processando = false,
  podeAprovar = true,
  podeReprovar = true,
  labelAprovar = "Aprovar",
  labelReprovar = "Recusar",
  onAprovar,
  onReprovar,
}: Props) {
  if (!podeAprovar && !podeReprovar) return null;

  return (
    <div className="shrink-0 border-t bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{mensagem}</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {podeReprovar && (
            <Button
              type="button"
              variant="destructive"
              onClick={onReprovar}
              disabled={processando}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              {processando ? "Processando…" : labelReprovar}
            </Button>
          )}
          {podeAprovar && (
            <Button
              type="button"
              onClick={onAprovar}
              disabled={processando}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              {processando ? "Processando…" : labelAprovar}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
