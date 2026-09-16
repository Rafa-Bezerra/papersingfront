"use client";

import { ArrowRight, FileSignature, FileText, FolderKanban, Globe, Inbox, Landmark, Loader2, MessageSquare, Package, Percent, Receipt, ShieldAlert, Users, Wallet } from "lucide-react";
import { PendenciaGestorItem } from "@/types/Pendencias";
import {
  corUnidadePendencia,
  formatarDataPendencia,
  formatarValorPendencia,
  labelTipoPendencia,
  metaTipoPendencia,
} from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";

function IconeTipo({ tipo, className }: { tipo: string; className?: string }) {
  const meta = metaTipoPendencia(tipo);
  const cnIcon = cn("h-4 w-4", className);
  switch (meta.icon) {
    case "package":
      return <Package className={cnIcon} />;
    case "wallet":
      return <Wallet className={cnIcon} />;
    case "receipt":
      return <Receipt className={cnIcon} />;
    case "file-text":
      return <FileText className={cnIcon} />;
    case "message-square":
      return <MessageSquare className={cnIcon} />;
    case "folder-kanban":
      return <FolderKanban className={cnIcon} />;
    case "file-signature":
      return <FileSignature className={cnIcon} />;
    case "shield-alert":
      return <ShieldAlert className={cnIcon} />;
    case "landmark":
      return <Landmark className={cnIcon} />;
    case "users":
      return <Users className={cnIcon} />;
    case "percent":
      return <Percent className={cnIcon} />;
    case "globe":
      return <Globe className={cnIcon} />;
    default:
      return <Inbox className={cnIcon} />;
  }
}

interface PendenciaItemCardProps {
  item: PendenciaGestorItem;
  onClick?: () => void;
  loading?: boolean;
  selected?: boolean;
  compact?: boolean;
}

export function PendenciaItemCard({
  item,
  onClick,
  loading = false,
  selected = false,
  compact = false,
}: PendenciaItemCardProps) {
  const meta = metaTipoPendencia(item.tipo);
  const valor = formatarValorPendencia(item.valor);
  const data = formatarDataPendencia(item.data);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border text-left transition-all duration-200",
        "hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:cursor-wait disabled:opacity-70",
        compact ? "p-2.5" : "p-3",
        selected
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-card"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
          compact ? "h-8 w-8" : "h-9 w-9 mt-0.5",
          meta.cor
        )}
      >
        <IconeTipo tipo={item.tipo} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-medium leading-snug text-foreground line-clamp-2 transition-colors group-hover:text-primary",
              compact && "text-sm"
            )}
          >
            {item.titulo}
          </p>
          {data && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{data}</span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              corUnidadePendencia(item.unidade)
            )}
          >
            {item.unidade}
          </span>
          <span className="text-xs text-muted-foreground">{labelTipoPendencia(item.tipo)}</span>
          {item.detalhe && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground line-clamp-1">{item.detalhe}</span>
            </>
          )}
        </div>

        {valor && (
          <p className="mt-1 text-xs font-semibold text-foreground/80 tabular-nums">{valor}</p>
        )}
      </div>

      {loading ? (
        <Loader2 className="mt-2 h-4 w-4 shrink-0 animate-spin text-primary" />
      ) : (
        <ArrowRight
          className={cn(
            "shrink-0 text-muted-foreground/40 transition-all",
            "group-hover:translate-x-0.5 group-hover:text-primary",
            compact ? "mt-1.5 h-3.5 w-3.5" : "mt-2 h-4 w-4"
          )}
        />
      )}
    </button>
  );
}
