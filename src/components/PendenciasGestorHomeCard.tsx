"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrowRight, Inbox, Loader2, RefreshCw } from "lucide-react";

import { getPendenciasGestor, unidadesComPendencias } from "@/services/pendenciasService";

import { abrirModalPendencias, corUnidadePendencia } from "@/utils/pendenciaNavigation";

import { cn } from "@/lib/utils";



export default function PendenciasGestorHomeCard() {

  const [total, setTotal] = useState(0);

  const [totalExibidos, setTotalExibidos] = useState(0);

  const [loading, setLoading] = useState(true);

  const [porUnidade, setPorUnidade] = useState<{ unidade: string; total: number }[]>([]);



  const carregar = useCallback(async () => {

    setLoading(true);

    try {

      const data = await getPendenciasGestor(30, { force: true });

      setTotal(data.total);

      setTotalExibidos(data.totalExibidos ?? data.itens.length);

      setPorUnidade(unidadesComPendencias(data.porUnidade));

    } catch {

      setTotal(0);

      setTotalExibidos(0);

      setPorUnidade([]);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 600);
    const onLogin = () => void carregar();
    window.addEventListener("papersign-login", onLogin);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("papersign-login", onLogin);
    };
  }, [carregar]);



  const unidadesAtivas = useMemo(() => porUnidade.slice(0, 4), [porUnidade]);



  return (

    <div
      id="tour-pendencias-card"
      className={cn(

        "group relative w-full overflow-hidden rounded-2xl border transition-all duration-300",

        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/5 dark:hover:shadow-red-950/30",

        total > 0

          ? "border-red-300/50 bg-gradient-to-br from-red-50 via-red-50/40 to-transparent dark:border-red-900/50 dark:from-red-950/25 dark:via-slate-900/50 dark:to-transparent"

          : "border-border/60 bg-muted/20 hover:bg-muted/30"

      )}

    >

      {total > 0 && (

        <span className="absolute left-4 top-4 flex h-2.5 w-2.5 pointer-events-none">

          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60 dark:bg-red-500/70" />

          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 dark:bg-red-400" />

        </span>

      )}



      <div className="flex items-stretch gap-2 p-5">

        <button

          type="button"

          onClick={() => abrirModalPendencias()}

          className={cn(

            "flex min-w-0 flex-1 flex-col gap-4 text-left transition-all sm:flex-row sm:items-center sm:justify-between",

            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-red-400"

          )}

        >

          <div className="flex items-start gap-4">

            <div

              className={cn(

                "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform group-hover:scale-105",

                total > 0

                  ? "bg-red-100 text-red-600 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60"

                  : "bg-muted text-muted-foreground ring-border"

              )}

            >

              {loading ? (

                <Loader2 className="h-6 w-6 animate-spin" />

              ) : (

                <Inbox className="h-6 w-6" />

              )}

            </div>



            <div>

              <p className="text-xs font-semibold uppercase tracking-wider text-red-700/90 dark:text-red-400/90">

                Todas as unidades

              </p>

              <h3 className="mt-0.5 text-lg font-bold text-foreground sm:text-xl">

                {loading

                  ? "Carregando pendências…"

                  : total === 0

                    ? "Nenhuma pendência no momento"

                    : total === 1

                      ? "1 pendência aguardando você"

                      : `${total} pendências aguardando você`}

              </h3>

              <p className="mt-1 text-sm text-muted-foreground">

                {total > 0

                  ? "Movimentos, documentos, RDV, fiscal, C.I., projetos e PlugSign em todas as WAY"

                  : "Todas as pendências de aprovação e assinatura em um só lugar"}

              </p>

              {total > 0 && totalExibidos < total && (

                <p className="mt-1 text-[11px] text-muted-foreground/80">

                  Prévia com os {totalExibidos} itens mais recentes — o total inclui todas

                </p>

              )}



              {unidadesAtivas.length > 1 && (
                <p className="mt-2 text-[11px] text-muted-foreground/90">
                  Por base: soma de movimentos, documentos, RDV, fiscal, C.I., projetos e demais tipos.
                </p>
              )}

              {unidadesAtivas.length > 1 && (

                <div className="mt-2 flex flex-wrap gap-1.5">

                  {unidadesAtivas.map(({ unidade, total: t }) => (

                    <span

                      key={unidade}

                      className={cn(

                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",

                        corUnidadePendencia(unidade)

                      )}

                    >

                      {unidade.replace("WAY ", "")}

                      <span className="font-bold">{t}</span>

                    </span>

                  ))}

                  {porUnidade.length > 4 && (

                    <span className="text-[11px] text-muted-foreground self-center">

                      +{porUnidade.length - 4}

                    </span>

                  )}

                </div>

              )}

            </div>

          </div>



          <span

            className={cn(

              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",

              total > 0

                ? "bg-red-600 text-white group-hover:bg-red-500 dark:border dark:border-red-700/50 dark:bg-red-950/50 dark:text-red-100 dark:group-hover:bg-red-950/70"

                : "bg-muted text-muted-foreground group-hover:bg-muted/80"

            )}

          >

            {total > 0 ? "Ver pendências" : "Abrir caixa"}

            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />

          </span>

        </button>



        <button

          type="button"

          onClick={() => void carregar()}

          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"

          title="Atualizar"

        >

          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />

          <span className="hidden sm:inline">Atualizar</span>

        </button>

      </div>

    </div>

  );

}


