"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  clearGestorUnidadeContext,
  corUnidadePendencia,
  getGestorUnidadeContext,
} from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";

/** Aviso fixo: gestor está operando pendência de outra WAY sem trocar a base de login. */
export default function GestorUnidadeBanner() {
  const [gestorUnidade, setGestorUnidade] = useState<string | null>(null);
  const [loginUnidade, setLoginUnidade] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setGestorUnidade(getGestorUnidadeContext());
      try {
        const raw = sessionStorage.getItem("userData");
        if (raw) setLoginUnidade(JSON.parse(raw).unidade ?? null);
        else setLoginUnidade(null);
      } catch {
        setLoginUnidade(null);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("papersign-gestor-unidade", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("papersign-gestor-unidade", sync);
    };
  }, []);

  if (!gestorUnidade || gestorUnidade === loginUnidade) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm",
        "bg-amber-50/95 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
        "border-amber-200/80 dark:border-amber-800/60"
      )}
      role="status"
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Pendência de outra unidade</span>
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
            corUnidadePendencia(gestorUnidade)
          )}
        >
          {gestorUnidade}
        </span>
        <span className="text-muted-foreground">
          — você continua logado em <strong>{loginUnidade}</strong>. Documentos e assinaturas usam a unidade da pendência.
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          clearGestorUnidadeContext();
          setGestorUnidade(null);
          window.dispatchEvent(new Event("papersign-gestor-unidade"));
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/60 bg-background/60 px-2 py-1 text-xs font-medium hover:bg-background dark:border-amber-700/50"
        aria-label="Voltar a usar apenas a unidade do seu login"
      >
        <X className="h-3.5 w-3.5" />
        Voltar à minha unidade
      </button>
    </div>
  );
}
