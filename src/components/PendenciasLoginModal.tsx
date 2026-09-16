"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PendenciaItemCard } from "@/components/PendenciaItemCard";
import {
  getPendenciasGestor,
  normalizarPorUnidade,
  tiposComPendencias,
  unidadesComPendencias,
} from "@/services/pendenciasService";
import { PendenciaGestorItem, PendenciaGestorResumoUnidadeTipo } from "@/types/Pendencias";
import {
  abrirPendencia,
  consumirAbrirPendenciasAposLogin,
  corUnidadePendencia,
  labelTipoPendencia,
  markPendenciasModalDismissed,
  notificarPendenciasModalResolvido,
  wasPendenciasModalDismissed,
} from "@/utils/pendenciaNavigation";
import { cn } from "@/lib/utils";
import { pendenciaItemKey } from "@/utils/pendenciaItemKey";

function eqUnidade(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function eqTipo(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function filtrarItens(
  itens: PendenciaGestorItem[],
  unidade: string,
  tipo: string
): PendenciaGestorItem[] {
  return itens.filter((item) => {
    if (unidade && !eqUnidade(item.unidade, unidade)) return false;
    if (tipo && !eqTipo(item.tipo, tipo)) return false;
    return true;
  });
}

function contagemEsperada(
  unidade: string,
  tipo: string,
  total: number,
  porUnidade: { unidade: string; total: number }[],
  porUnidadeTipo: PendenciaGestorResumoUnidadeTipo[]
): number {
  if (unidade && tipo) {
    return (
      porUnidadeTipo.find((r) => eqUnidade(r.unidade, unidade) && eqTipo(r.tipo, tipo))?.total ?? 0
    );
  }
  if (unidade) {
    return porUnidade.find((u) => eqUnidade(u.unidade, unidade))?.total ?? 0;
  }
  if (tipo) {
    return porUnidadeTipo
      .filter((r) => eqTipo(r.tipo, tipo))
      .reduce((s, r) => s + r.total, 0);
  }
  return total;
}

export default function PendenciasLoginModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [itensGeral, setItensGeral] = useState<PendenciaGestorItem[]>([]);
  const [itensExibidos, setItensExibidos] = useState<PendenciaGestorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalExibidos, setTotalExibidos] = useState(0);
  const [porUnidade, setPorUnidade] = useState<{ unidade: string; total: number }[]>([]);
  const [porUnidadeTipo, setPorUnidadeTipo] = useState<PendenciaGestorResumoUnidadeTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [avaliado, setAvaliado] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const timerRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const aguardandoAbrirRef = useRef(false);
  const resolvidoRef = useRef(false);
  const carregarReqRef = useRef(0);
  const filtroReqRef = useRef(0);

  const marcarResolvido = useCallback(() => {
    if (resolvidoRef.current) return;
    resolvidoRef.current = true;
    notificarPendenciasModalResolvido();
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!avaliado || loading || open || aguardandoAbrirRef.current) return;
    marcarResolvido();
  }, [avaliado, loading, open, marcarResolvido]);

  const temFiltro = Boolean(filtroUnidade || filtroTipo);

  const carregar = useCallback(async (opts?: { forcarAbrir?: boolean }) => {
    const token = sessionStorage.getItem("authToken");
    if (!token) {
      setItensGeral([]);
      setItensExibidos([]);
      setTotal(0);
      setOpen(false);
      marcarResolvido();
      return;
    }

    const reqId = ++carregarReqRef.current;
    const abrirPorLogin = opts?.forcarAbrir || consumirAbrirPendenciasAposLogin();
    const manterAberto = openRef.current;

    if (abrirPorLogin) setOpen(true);
    setLoading(true);

    try {
      const data = await getPendenciasGestor(30, { force: true });
      if (reqId !== carregarReqRef.current) return;

      setItensGeral(data.itens);
      setTotal(data.total);
      setTotalExibidos(data.totalExibidos ?? data.itens.length);
      setPorUnidade(normalizarPorUnidade(data.porUnidade, data.itens));
      setPorUnidadeTipo(data.porUnidadeTipo ?? []);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (manterAberto || abrirPorLogin) {
        if (data.total > 0) setOpen(true);
        return;
      }

      if (data.total > 0 && !wasPendenciasModalDismissed()) {
        aguardandoAbrirRef.current = true;
        timerRef.current = window.setTimeout(() => {
          aguardandoAbrirRef.current = false;
          setOpen(true);
        }, 400);
        return;
      }

      marcarResolvido();
    } catch (error) {
      console.warn("PendenciasLoginModal: falha ao carregar pendências", error);
      if (reqId !== carregarReqRef.current) return;
      setPorUnidade([]);
      if (abrirPorLogin && !manterAberto) setOpen(false);
      marcarResolvido();
    } finally {
      if (reqId === carregarReqRef.current) {
        setLoading(false);
        setAvaliado(true);
      }
    }
  }, [marcarResolvido]);

  useEffect(() => {
    void carregar();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [carregar, pathname]);

  useEffect(() => {
    const onLogin = () => void carregar({ forcarAbrir: true });
    const onAbrir = () => void carregar({ forcarAbrir: true });
    window.addEventListener("papersign-login", onLogin);
    window.addEventListener("papersign-abrir-pendencias-modal", onAbrir);
    return () => {
      window.removeEventListener("papersign-login", onLogin);
      window.removeEventListener("papersign-abrir-pendencias-modal", onAbrir);
    };
  }, [carregar]);

  useEffect(() => {
    if (!open) return;

    const local = filtrarItens(itensGeral, filtroUnidade, filtroTipo);
    setItensExibidos(local);

    if (!temFiltro) return;

    const reqId = ++filtroReqRef.current;
    setRecarregando(true);

    void getPendenciasGestor(30, {
      unidade: filtroUnidade || null,
      tipo: filtroTipo || null,
      force: true,
    })
      .then((data) => {
        if (reqId !== filtroReqRef.current) return;
        if (data.itens.length > 0) {
          setItensExibidos(data.itens);
        }
      })
      .catch((error) => {
        console.warn("PendenciasLoginModal: falha ao filtrar pendências", error);
      })
      .finally(() => {
        if (reqId === filtroReqRef.current) setRecarregando(false);
      });
  }, [open, filtroUnidade, filtroTipo, temFiltro, itensGeral]);

  const resumoUnidades = useMemo(() => unidadesComPendencias(porUnidade), [porUnidade]);

  const tipos = useMemo(
    () => tiposComPendencias(porUnidadeTipo, filtroUnidade || undefined),
    [porUnidadeTipo, filtroUnidade]
  );

  const esperado = useMemo(
    () => contagemEsperada(filtroUnidade, filtroTipo, total, porUnidade, porUnidadeTipo),
    [filtroUnidade, filtroTipo, total, porUnidade, porUnidadeTipo]
  );

  const totalFiltrado = useMemo(() => {
    if (esperado > 0) return esperado;
    if (filtroTipo) {
      const qtd = tipos.find(([t]) => eqTipo(t, filtroTipo))?.[1];
      if (qtd) return qtd;
    }
    if (filtroUnidade) {
      const qtd = resumoUnidades.find((u) => eqUnidade(u.unidade, filtroUnidade))?.total;
      if (qtd) return qtd;
    }
    return itensExibidos.length || total;
  }, [esperado, filtroTipo, filtroUnidade, tipos, resumoUnidades, itensExibidos.length, total]);

  function fechar() {
    markPendenciasModalDismissed();
    aguardandoAbrirRef.current = false;
    setOpen(false);
    setFiltroUnidade("");
    setFiltroTipo("");
    marcarResolvido();
  }

  function verTodas() {
    markPendenciasModalDismissed();
    aguardandoAbrirRef.current = false;
    setOpen(false);
    marcarResolvido();
    router.push("/pendencias");
  }

  async function abrirItem(item: PendenciaGestorItem, idx: number) {
    const key = pendenciaItemKey(item, idx);
    setAbrindoId(key);
    markPendenciasModalDismissed();
    setOpen(false);
    try {
      await abrirPendencia(item);
    } catch (error) {
      console.warn("PendenciasLoginModal: erro ao abrir item", error);
      setAbrindoId(null);
    }
  }

  if (total === 0 && !open && !loading) return null;

  const restantes = total - totalExibidos;
  const listaVazia = itensExibidos.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); else setOpen(true); }}>
      <DialogContent
        scrollBody={false}
        showCloseButton={false}
        className="z-[10001] gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl max-h-[min(92vh,900px)]"
      >
        <div className="relative border-b border-red-200/60 bg-gradient-to-br from-red-50/80 via-red-50/30 to-transparent px-6 pt-6 pb-4 dark:border-red-900/50 dark:from-red-950/30 dark:via-slate-900/40 dark:to-transparent">
          <button
            type="button"
            onClick={fechar}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700/80 dark:text-red-400/90">
                Caixa de entrada do gestor
              </p>
              <DialogTitle className="mt-1 text-2xl font-bold leading-tight text-foreground">
                {loading && total === 0
                  ? "Carregando pendências…"
                  : totalFiltrado === 1
                    ? "1 pendência"
                    : `${totalFiltrado} pendências`}
                {!loading || total > 0 ? (
                  <span className="font-normal text-muted-foreground">
                    {filtroUnidade && filtroTipo
                      ? ` · ${filtroUnidade.replace("WAY ", "Base ")} · ${labelTipoPendencia(filtroTipo)}`
                      : filtroUnidade
                        ? ` · ${filtroUnidade.replace("WAY ", "Base ")}`
                        : filtroTipo
                          ? ` · ${labelTipoPendencia(filtroTipo)}`
                          : " · todas as unidades"}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Lista de pendências de aprovação e assinatura em todas as unidades WAY.
              </DialogDescription>
            </div>
          </div>

          {resumoUnidades.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFiltroTipo("");
                  setFiltroUnidade("");
                }}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                  !filtroUnidade && !filtroTipo
                    ? "border-red-400/50 bg-red-100/80 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
                    : "border-border bg-background/50 text-muted-foreground hover:border-primary/30"
                )}
              >
                Todas · {total}
              </button>
              {resumoUnidades.map(({ unidade, total: qtd }) => (
                <button
                  key={unidade}
                  type="button"
                  onClick={() => {
                    setFiltroTipo("");
                    setFiltroUnidade(filtroUnidade === unidade ? "" : unidade);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                    eqUnidade(filtroUnidade, unidade)
                      ? "ring-2 ring-primary/30"
                      : "hover:scale-105",
                    corUnidadePendencia(unidade)
                  )}
                >
                  {unidade.replace("WAY ", "")}
                  <span className="font-bold">{qtd}</span>
                </button>
              ))}
            </div>
          )}

          {tipos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tipos.map(([tipo, qtd]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFiltroTipo(filtroTipo === tipo ? "" : tipo)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
                    eqTipo(filtroTipo, tipo)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {labelTipoPendencia(tipo)} ({qtd})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto px-5 py-4">
          {loading && itensGeral.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : recarregando && listaVazia ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Carregando itens do filtro…
            </div>
          ) : listaVazia ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {total > 0 && itensGeral.length === 0
                ? "Não foi possível carregar os itens. Clique em Atualizar."
                : esperado > 0
                  ? "Nenhum item carregado para este filtro. Clique em Atualizar."
                  : "Nenhum item com os filtros selecionados."}
            </p>
          ) : (
            <ul className={cn("space-y-2", recarregando && "opacity-70")}>
              {itensExibidos.map((item, idx) => {
                const key = pendenciaItemKey(item, idx);
                return (
                  <li key={key}>
                    <PendenciaItemCard
                      item={item}
                      loading={abrindoId === key}
                      onClick={() => void abrirItem(item, idx)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {restantes > 0 && !temFiltro && !listaVazia && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Mostrando {totalExibidos} de {total} — veja todas na página completa
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => void carregar({ forcarAbrir: true })}
              disabled={loading || recarregando}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (loading || recarregando) && "animate-spin")} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={fechar}>
              Agora não
            </Button>
          </div>
          <Button type="button" size="sm" onClick={verTodas} className="gap-2">
            Ver página completa
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
