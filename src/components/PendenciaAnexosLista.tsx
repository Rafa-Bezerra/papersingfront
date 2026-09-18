"use client";

import {
  Check,
  FileSignature,
  FileText,
  Mail,
  Receipt,
  ScrollText,
} from "lucide-react";
import type { PendenciaAnexoListaItem } from "@/types/PendenciaAnexo";
import { cn } from "@/lib/utils";

export type { PendenciaAnexoListaItem };

function tipoAnexo(item: PendenciaAnexoListaItem): string {
  if (item.tipo) return item.tipo;
  const nome = (item.nome ?? "").toLowerCase();
  if (item.documento_principal) return "Principal";
  if (nome.includes("comprovante plugsign")) return "Comprovante";
  if (nome.includes("comprovante")) return "Comprovante";
  if (nome.includes("nf") || nome.includes("nota fiscal")) return "Nota fiscal";
  if (nome.includes("email") || nome.includes("e-mail")) return "E-mail";
  return "Anexo";
}

function IconeTipo({ item }: { item: PendenciaAnexoListaItem }) {
  const nome = (item.nome ?? "").toLowerCase();
  const tipo = tipoAnexo(item).toLowerCase();
  const cls = "h-4 w-4 shrink-0";

  if (item.documento_principal || tipo.includes("principal")) {
    return <FileSignature className={cls} />;
  }
  if (tipo.includes("nota fiscal") || nome.includes("nf")) {
    return <Receipt className={cls} />;
  }
  if (tipo.includes("e-mail") || nome.includes("email")) {
    return <Mail className={cls} />;
  }
  if (tipo.includes("comprovante")) {
    return <ScrollText className={cls} />;
  }
  return <FileText className={cls} />;
}

type Props = {
  titulo?: string;
  itens: PendenciaAnexoListaItem[];
  indiceAtivo: number;
  onSelecionar: (indice: number) => void;
  disabled?: boolean;
  className?: string;
};

export function PendenciaAnexosLista({
  titulo = "Anexos",
  itens,
  indiceAtivo,
  onSelecionar,
  disabled = false,
  className,
}: Props) {
  if (itens.length === 0) return null;

  return (
    <aside
      className={cn(
        "relative z-10 flex shrink-0 flex-col border-b bg-background md:w-60 md:border-b-0 md:border-r",
        className
      )}
    >
      {/* Cabeçalho compacto */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="truncate text-xs font-semibold text-foreground">{titulo}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {indiceAtivo + 1}/{itens.length}
        </span>
      </div>

      {/* Mobile: chips horizontais */}
      <div className="flex gap-1.5 overflow-x-auto border-b px-2 py-2 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {itens.map((item, i) => {
          const ativo = i === indiceAtivo;
          const nome = item.nome?.trim() || `Anexo ${i + 1}`;
          return (
            <button
              key={item.id ?? `${nome}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelecionar(i)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                "disabled:opacity-50",
                ativo
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {nome.length > 22 ? `${nome.slice(0, 20)}…` : nome}
            </button>
          );
        })}
      </div>

      {/* Desktop: lista enxuta */}
      <ul
        className="hidden flex-1 overflow-y-auto py-1 md:flex md:flex-col [scrollbar-width:thin]"
        role="listbox"
        aria-label={titulo}
      >
        {itens.map((item, i) => {
          const ativo = i === indiceAtivo;
          const nome = item.nome?.trim() || `Anexo ${i + 1}`;
          const tipo = tipoAnexo(item);
          const assinado = item.documento_assinado === 1;

          return (
            <li key={item.id ?? `${nome}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={ativo}
                disabled={disabled}
                onClick={() => onSelecionar(i)}
                className={cn(
                  "group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:bg-accent",
                  "disabled:cursor-wait disabled:opacity-50",
                  ativo
                    ? "border-l-2 border-l-foreground bg-muted/60"
                    : "border-l-2 border-l-transparent hover:bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    ativo ? "bg-background text-foreground shadow-sm" : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <IconeTipo item={item} />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-medium leading-tight text-foreground"
                    title={nome}
                  >
                    {nome}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {tipo}
                    {assinado ? " · assinado" : ""}
                  </span>
                </span>

                {assinado && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Assinado" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
