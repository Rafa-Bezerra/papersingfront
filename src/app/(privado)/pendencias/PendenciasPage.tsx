"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PendenciaInlineViewer } from "@/components/PendenciaInlineViewer";
import { PendenciaItemCard } from "@/components/PendenciaItemCard";
import {
  getPendenciasGestor,
  normalizarPorUnidade,
  PENDENCIAS_ATUALIZADAS_EVENT,
  PENDENCIAS_INVALIDAR_EVENT,
  tiposComPendencias,
  unidadesComPendencias,
} from "@/services/pendenciasService";
import type { PendenciasGestorResponse } from "@/types/Pendencias";
import { PendenciaGestorItem, PendenciaGestorResumoUnidadeTipo } from "@/types/Pendencias";
import {
  corUnidadePendencia,
  labelTipoPendencia,
} from "@/utils/pendenciaNavigation";
import { mesmaPendencia, pendenciaItemKey } from "@/utils/pendenciaItemKey";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export default function PendenciasPage() {
  const [itensGeral, setItensGeral] = useState<PendenciaGestorItem[]>([]);
  const [itensExibidos, setItensExibidos] = useState<PendenciaGestorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalExibidos, setTotalExibidos] = useState(0);
  const [porUnidade, setPorUnidade] = useState<{ unidade: string; total: number }[]>([]);
  const [porUnidadeTipo, setPorUnidadeTipo] = useState<PendenciaGestorResumoUnidadeTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [itemInline, setItemInline] = useState<PendenciaGestorItem | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const carregarReqRef = useRef(0);
  const filtroReqRef = useRef(0);

  const temFiltroApi = Boolean(filtroUnidade || filtroTipo);

  const aplicarDados = useCallback((data: PendenciasGestorResponse) => {
    setItensGeral(data.itens);
    setTotal(data.total);
    setPorUnidade(normalizarPorUnidade(data.porUnidade, data.itens));
    setPorUnidadeTipo(data.porUnidadeTipo ?? []);
    setTotalExibidos(data.totalExibidos ?? data.itens.length);
    setLoading(false);
  }, []);

  const carregar = useCallback(async (force = false) => {
    const reqId = ++carregarReqRef.current;
    setLoading(true);

    try {
      const data = await getPendenciasGestor(30, force ? { force: true } : undefined);
      if (reqId !== carregarReqRef.current) return;
      aplicarDados(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar pendências");
      if (reqId === carregarReqRef.current) setLoading(false);
    }
  }, [aplicarDados]);

  useEffect(() => {
    void carregar(false);

    const onAtualizado = (event: Event) => {
      const data = (event as CustomEvent<PendenciasGestorResponse>).detail;
      if (data) aplicarDados(data);
    };
    const onInvalidar = () => void carregar(true);

    window.addEventListener(PENDENCIAS_ATUALIZADAS_EVENT, onAtualizado);
    window.addEventListener(PENDENCIAS_INVALIDAR_EVENT, onInvalidar);
    return () => {
      window.removeEventListener(PENDENCIAS_ATUALIZADAS_EVENT, onAtualizado);
      window.removeEventListener(PENDENCIAS_INVALIDAR_EVENT, onInvalidar);
    };
  }, [carregar, aplicarDados]);

  useEffect(() => {
    const local = filtrarItens(itensGeral, filtroUnidade, filtroTipo);
    setItensExibidos(local);

    if (!temFiltroApi) return;

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
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar pendências");
      })
      .finally(() => {
        if (reqId === filtroReqRef.current) setRecarregando(false);
      });
  }, [itensGeral, filtroUnidade, filtroTipo, temFiltroApi]);

  const tipos = useMemo(
    () => tiposComPendencias(porUnidadeTipo, filtroUnidade || undefined),
    [porUnidadeTipo, filtroUnidade]
  );

  const resumoUnidades = useMemo(() => unidadesComPendencias(porUnidade), [porUnidade]);

  const totalUnidadeSelecionada = useMemo(() => {
    if (!filtroUnidade) return 0;
    return porUnidade.find((u) => eqUnidade(u.unidade, filtroUnidade))?.total ?? 0;
  }, [filtroUnidade, porUnidade]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itensExibidos;

    return itensExibidos.filter((item) => {
      const blob = [
        item.titulo,
        item.referencia,
        item.detalhe,
        item.unidade,
        labelTipoPendencia(item.tipo),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [itensExibidos, busca]);

  function handleAbrir(item: PendenciaGestorItem, idx: number) {
    if (!item.id) return;
    const key = pendenciaItemKey(item, idx);
    setAbrindo(key);
    setItemInline(item);
    setAbrindo(null);
  }

  function fecharAssinaturaInline() {
    setItemInline(null);
    void carregar(true);
  }

  function concluirItemInline() {
    const concluido = itemInline;
    setItemInline(null);
    if (concluido) {
      setItensGeral((prev) => prev.filter((i) => !mesmaPendencia(i, concluido)));
      setTotal((prev) => Math.max(0, prev - 1));
      setTotalExibidos((prev) => Math.max(0, prev - 1));
    }
    void carregar(true);
  }

  function selecionarUnidade(unidade: string) {
    const next = eqUnidade(filtroUnidade, unidade) ? "" : unidade;
    setFiltroTipo("");
    setFiltroUnidade(next);
  }

  const temFiltro = Boolean(filtroUnidade || filtroTipo || busca);

  return (
    <div className="space-y-6">
      <header
        id="tour-pendencias-titulo"
        className="flex flex-col gap-4 rounded-2xl border border-red-200/60 bg-gradient-to-br from-red-50/80 via-transparent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/50 dark:from-red-950/30 dark:via-slate-900/40 dark:to-transparent"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pendências do gestor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Carregando…"
                : filtroUnidade
                  ? `${totalUnidadeSelecionada} pendência${totalUnidadeSelecionada !== 1 ? "s" : ""} em ${filtroUnidade.replace("WAY ", "Base ")} · exibindo ${filtrados.length}`
                  : totalExibidos < total
                    ? `${total} pendências no total · exibindo ${totalExibidos} mais recentes`
                    : `${total} item${total !== 1 ? "s" : ""} em todas as unidades · clique para abrir`}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void carregar(true)}
          disabled={loading || recarregando}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading || recarregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <div id="tour-pendencias-filtros">
        {resumoUnidades.length > 1 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {resumoUnidades.map(({ unidade, total: t }) => (
              <button
                key={unidade}
                type="button"
                onClick={() => selecionarUnidade(unidade)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all duration-200",
                  "hover:shadow-sm hover:-translate-y-0.5",
                  eqUnidade(filtroUnidade, unidade)
                    ? "ring-2 ring-primary border-primary/30 bg-primary/5"
                    : corUnidadePendencia(unidade)
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {unidade.replace("WAY ", "Base ")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{loading ? "—" : t}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use os filtros por tipo e a busca abaixo para encontrar uma pendência específica.
          </p>
        )}
      </div>

      <div id="tour-pendencias-busca" className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, referência, unidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {tipos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tipos.map(([tipo, qtd]) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFiltroTipo(eqTipo(filtroTipo, tipo) ? "" : tipo)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  eqTipo(filtroTipo, tipo)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/30"
                )}
              >
                {labelTipoPendencia(tipo)} ({qtd})
              </button>
            ))}
          </div>
        )}

        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              setFiltroUnidade("");
              setFiltroTipo("");
              setBusca("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {itemInline && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <PendenciaInlineViewer
              item={itemInline}
              onClose={fecharAssinaturaInline}
              onConcluido={concluirItemInline}
            />
          </CardContent>
        </Card>
      )}

      {loading && itensGeral.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : recarregando && filtrados.length === 0 && temFiltroApi ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card id="tour-pendencias-lista">
          <CardContent className="py-12 text-center text-muted-foreground">
            {total === 0
              ? "Nenhuma pendência encontrada para você em nenhuma unidade."
              : filtroUnidade && filtroTipo
                ? `Não há ${labelTipoPendencia(filtroTipo).toLowerCase()} pendente em ${filtroUnidade.replace("WAY ", "Base ")}.`
                : "Nenhum item corresponde aos filtros aplicados."}
          </CardContent>
        </Card>
      ) : (
        <ul id="tour-pendencias-lista" className="space-y-2">
          {filtrados.map((item, idx) => {
            const key = pendenciaItemKey(item, idx);
            return (
              <li key={key}>
                <PendenciaItemCard
                  item={item}
                  loading={abrindo === key}
                  onClick={() => void handleAbrir(item, idx)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
