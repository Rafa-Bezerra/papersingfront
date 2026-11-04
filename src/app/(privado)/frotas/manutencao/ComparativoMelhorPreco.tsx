'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ItemComparativo } from '@/services/frotasService';
import { BotaoPdf, brl, COR_PDF, RelatorioFrotaPdf } from '../comum';
import { FatiaGrafico, GraficoBarrasHorizontais, GraficoPizza, graficoPdf, graficoPdfLista, ItemBarraGrafico, montarFatiasGrafico } from '../graficosFrotas';
import { formatarDocumento, rotuloServico } from './comumManutencao';

const curtaUnidade = (u: string) => u.replace('WAY ', '');
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;

const chaveFornecedor = (i: ItemComparativo) =>
  i.fornecedor_cnpj || (i.fornecedor_codcfo ? `${i.unidade}:${i.fornecedor_codcfo}` : i.fornecedor.trim().toUpperCase());

type ModoGrupo = 'servico' | 'servico_regiao';

type ContagemNotas = { nfs: number; avulsos: number };

function contarNotas(itens: ItemComparativo[]): ContagemNotas {
  const ids = new Set<number>();
  let avulsos = 0;
  for (const i of itens) {
    if (i.id_nota != null && i.id_nota > 0) ids.add(i.id_nota);
    else avulsos += 1;
  }
  return { nfs: ids.size, avulsos };
}

function textoNotas({ nfs, avulsos }: ContagemNotas) {
  if (nfs === 0 && avulsos === 0) return '—';
  const p: string[] = [];
  if (nfs > 0) p.push(`${nfs} NF`);
  if (avulsos > 0) p.push(`${avulsos} avulso${avulsos > 1 ? 's' : ''}`);
  return p.join(' · ');
}

type LinhaFornecedor = {
  chave: string;
  fornecedor: string;
  cnpj: string;
  lancamentos: number;
  notas: ContagemNotas;
  quantidade: number;
  total: number;
  medio: number;
};

function agregarFornecedores(itens: ItemComparativo[]): LinhaFornecedor[] {
  const mapa = new Map<string, ItemComparativo[]>();
  for (const i of itens) {
    const k = chaveFornecedor(i);
    mapa.set(k, [...(mapa.get(k) ?? []), i]);
  }
  return [...mapa.entries()]
    .map(([chave, grupo]) => {
      const qtd = grupo.reduce((t, i) => t + (i.quantidade > 0 ? i.quantidade : 1), 0);
      const total = grupo.reduce((t, i) => t + i.valor, 0);
      const ref = grupo[0];
      return {
        chave,
        fornecedor: ref.fornecedor,
        cnpj: ref.fornecedor_cnpj ?? '',
        lancamentos: grupo.length,
        notas: contarNotas(grupo),
        quantidade: qtd,
        total,
        medio: total / qtd,
      };
    })
    .sort((a, b) => a.medio - b.medio);
}

type GrupoMelhorPreco = {
  id: string;
  servico: string;
  rotulo: string;
  unidade?: string;
  regiao?: string;
  lancamentos: number;
  notas: ContagemNotas;
  quantidade: number;
  total: number;
  fornecedores: LinhaFornecedor[];
};

function montarGrupos(itens: ItemComparativo[], modo: ModoGrupo): GrupoMelhorPreco[] {
  const mapa = new Map<string, ItemComparativo[]>();
  for (const i of itens) {
    if (!i.servico || i.servico === 'OUTRO') continue;
    const id =
      modo === 'servico'
        ? i.servico
        : `${i.servico}|${i.unidade}|${i.regiao ?? ''}`;
    mapa.set(id, [...(mapa.get(id) ?? []), i]);
  }
  const saida: GrupoMelhorPreco[] = [];
  for (const [id, grupo] of mapa) {
    const servico = grupo[0].servico!;
    const fornecedores = agregarFornecedores(grupo);
    const qtd = grupo.reduce((t, i) => t + (i.quantidade > 0 ? i.quantidade : 1), 0);
    const total = grupo.reduce((t, i) => t + i.valor, 0);
    const base: GrupoMelhorPreco = {
      id,
      servico,
      rotulo: rotuloServico(servico) || servico,
      lancamentos: grupo.length,
      notas: contarNotas(grupo),
      quantidade: qtd,
      total,
      fornecedores,
    };
    if (modo === 'servico_regiao') {
      const [sv, un, reg] = id.split('|');
      base.servico = sv;
      base.unidade = un;
      base.regiao = reg;
    }
    saida.push(base);
  }
  return saida.sort((a, b) => b.total - a.total);
}

function tituloGrupo(g: GrupoMelhorPreco, modo: ModoGrupo) {
  if (modo === 'servico_regiao') return `${g.rotulo} · ${curtaUnidade(g.unidade ?? '')} · ${g.regiao ?? '—'}`;
  return g.rotulo;
}

function gapSegundoFornecedor(g: GrupoMelhorPreco) {
  const barato = g.fornecedores[0];
  const segundo = g.fornecedores[1];
  if (!segundo || barato.medio <= 0) return null;
  const pctGap = ((segundo.medio - barato.medio) / barato.medio) * 100;
  return {
    barato,
    segundo,
    pctGap,
    economiaTotal: (segundo.medio - barato.medio) * g.quantidade,
  };
}

function barrasFornecedoresGrupo(g: GrupoMelhorPreco): ItemBarraGrafico[] {
  return g.fornecedores.map((f, i) => ({
    rotulo: f.fornecedor,
    sub: `${textoNotas(f.notas)} · ${f.lancamentos} lanç. · ${f.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un.`,
    valor: f.medio,
    texto: brl(f.medio),
    corBarra: i === 0 && g.fornecedores.length > 1 ? 'bg-emerald-500' : 'bg-primary',
  }));
}

export default function ComparativoMelhorPreco({
  itens,
  periodo,
  filtros,
  unidades,
  carregando,
}: {
  itens: ItemComparativo[];
  periodo: string;
  filtros: string;
  unidades: string[];
  carregando: boolean;
}) {
  const [modo, setModo] = useState<ModoGrupo>('servico');
  const [soComparaveis, setSoComparaveis] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [grupoGrafico, setGrupoGrafico] = useState<string>('');

  const grupos = useMemo(() => montarGrupos(itens, modo), [itens, modo]);
  const visiveis = useMemo(
    () => (soComparaveis ? grupos.filter((g) => g.fornecedores.length > 1) : grupos),
    [grupos, soComparaveis]
  );

  const comparaveis = grupos.filter((g) => g.fornecedores.length > 1).length;

  const rankingGap = useMemo(() => {
    return visiveis
      .map((g) => ({ g, gap: gapSegundoFornecedor(g) }))
      .filter((x): x is { g: GrupoMelhorPreco; gap: NonNullable<ReturnType<typeof gapSegundoFornecedor>> } => x.gap != null)
      .sort((a, b) => b.gap.pctGap - a.gap.pctGap);
  }, [visiveis]);

  const barrasRanking = useMemo((): ItemBarraGrafico[] => {
    return rankingGap.slice(0, 10).map(({ g, gap }, i) => ({
      rotulo: tituloGrupo(g, modo),
      sub: `${gap.barato.fornecedor} · 2º ${gap.segundo.fornecedor} · ${textoNotas(g.notas)}`,
      valor: gap.pctGap,
      texto: pct(gap.pctGap),
      corBarra: i === 0 ? 'bg-amber-500' : i < 3 ? 'bg-orange-400' : 'bg-primary',
    }));
  }, [rankingGap, modo]);

  const vitoriasMaisBarato = useMemo((): FatiaGrafico[] => {
    const mapa = new Map<string, { rotulo: string; wins: number }>();
    for (const g of visiveis.filter((x) => x.fornecedores.length > 1)) {
      const f = g.fornecedores[0];
      const k = f.chave;
      const l = mapa.get(k) ?? { rotulo: f.fornecedor, wins: 0 };
      l.wins += 1;
      mapa.set(k, l);
    }
    return montarFatiasGrafico(
      [...mapa.values()].sort((a, b) => b.wins - a.wins),
      (x) => x.rotulo,
      (x) => x.rotulo.length > 28 ? `${x.rotulo.slice(0, 26)}…` : x.rotulo,
      (x) => x.wins,
      (v) => `${v} grupo${v > 1 ? 's' : ''}`
    );
  }, [visiveis]);

  const grupoParaGrafico = useMemo(() => {
    const alvo = grupoGrafico || rankingGap[0]?.g.id || visiveis[0]?.id || '';
    return visiveis.find((g) => g.id === alvo) ?? visiveis[0];
  }, [grupoGrafico, rankingGap, visiveis]);

  const barrasGrupoSel = useMemo(
    () => (grupoParaGrafico ? barrasFornecedoresGrupo(grupoParaGrafico) : []),
    [grupoParaGrafico]
  );

  const maxPrecoGrupo = useMemo(
    () => Math.max(...(grupoParaGrafico?.fornecedores.map((f) => f.medio) ?? [1]), 1),
    [grupoParaGrafico]
  );

  function montarPdf(): RelatorioFrotaPdf {
    const tituloModo = modo === 'servico' ? 'Mesmo tipo de serviço' : 'Serviço e região';
    return {
      titulo: 'Fornecedor mais barato — comparativo',
      subtitulo: `${tituloModo} · Manutenção · ${filtros}`,
      unidade: unidades.join(' + '),
      periodo,
      arquivo: `comparativo-melhor-preco-${unidades.map(curtaUnidade).join('-')}-${periodo}`,
      kpis: [
        { rotulo: 'Grupos listados', valor: String(visiveis.length), detalhe: soComparaveis ? 'com 2+ fornecedores' : 'todos com serviço tipado' },
        { rotulo: 'Comparáveis', valor: String(comparaveis), detalhe: 'podem escolher fornecedor mais barato' },
        { rotulo: 'Agrupamento', valor: tituloModo, detalhe: 'critério do comparativo' },
      ],
      graficos: [
        ...(barrasRanking.length > 0
          ? [graficoPdfLista('Ranking — diferença do 2º vs mais barato (%)', rankingGap.slice(0, 8).map(({ g, gap }) => ({ g, gap })), () => '', (x) => tituloGrupo(x.g, modo), (x) => x.gap.pctGap, (v) => pct(v))]
          : []),
        ...(vitoriasMaisBarato.length > 0 ? [graficoPdf('Quem lidera como mais barato', vitoriasMaisBarato)] : []),
      ],
      secoes: visiveis.map((g) => {
        const barato = g.fornecedores[0];
        const segundo = g.fornecedores[1];
        const ctx =
          modo === 'servico_regiao'
            ? `${g.rotulo} · ${curtaUnidade(g.unidade ?? '')} · ${g.regiao ?? '—'}`
            : g.rotulo;
        return {
          titulo: ctx,
          nota: `${textoNotas(g.notas)} · ${g.lancamentos} lanç. · ${g.fornecedores.length} fornec. · mais barato ${barato.fornecedor} (${brl(barato.medio)}/un.)${
            segundo ? ` · 2º ${pct(((segundo.medio - barato.medio) / barato.medio) * 100)}` : ''
          }`,
          colunas: [
            { titulo: 'Fornecedor', largura: 52 },
            { titulo: 'NF / avulsos', largura: 28 },
            { titulo: 'Lanç.', largura: 14, alinhar: 'right' },
            { titulo: 'Qtd.', largura: 14, alinhar: 'right' },
            { titulo: 'Médio/un.', largura: 22, alinhar: 'right' },
            { titulo: 'Total', largura: 22, alinhar: 'right' },
            { titulo: 'vs menor', largura: 16, alinhar: 'right' },
          ],
          linhas: g.fornecedores.map((f, i) => [
            { texto: f.fornecedor, sub: f.cnpj ? formatarDocumento(f.cnpj) : undefined, negrito: i === 0 },
            { texto: textoNotas(f.notas) },
            { texto: String(f.lancamentos) },
            { texto: String(Math.round(f.quantidade * 100) / 100) },
            { texto: brl(f.medio), negrito: true, cor: i === 0 && g.fornecedores.length > 1 ? COR_PDF.ok : undefined },
            { texto: brl(f.total) },
            i === 0
              ? { texto: g.fornecedores.length > 1 ? 'menor' : '—', cor: COR_PDF.ok }
              : { texto: pct(((f.medio - barato.medio) / barato.medio) * 100), cor: COR_PDF.alerta },
          ]),
        };
      }),
    };
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Fornecedor mais barato
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compara preço médio por unidade (valor ÷ quantidade) entre fornecedores no mesmo serviço e, se quiser, na mesma região.
              Use a quantidade de notas fiscais e de lançamentos para ver quem tem mais histórico.
            </p>
          </div>
          <BotaoPdf rotulo="PDF comparativo" disabled={carregando || visiveis.length === 0} montar={montarPdf} />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[14rem]">
            <Label>Agrupar por</Label>
            <Select value={modo} onValueChange={(v) => { setModo(v as ModoGrupo); setExpandido(null); setGrupoGrafico(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="servico">Mesmo tipo de serviço (todas as regiões)</SelectItem>
                <SelectItem value="servico_regiao">Mesmo serviço na mesma região</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Checkbox id="so-comparaveis" checked={soComparaveis} onCheckedChange={(v) => setSoComparaveis(v === true)} />
            <Label htmlFor="so-comparaveis" className="font-normal cursor-pointer">
              Só grupos com 2+ fornecedores ({comparaveis})
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{periodo} · {visiveis.length} grupo(s) · {grupos.reduce((s, g) => s + g.lancamentos, 0)} lançamento(s) no recorte</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {visiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {grupos.length === 0
              ? 'Nenhum lançamento com tipo de serviço definido (exceto “Outro”) neste período.'
              : 'Nenhum grupo com dois ou mais fornecedores. Desmarque o filtro acima para ver todos os serviços.'}
          </p>
        ) : (
          <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoBarrasHorizontais
              titulo="Ranking — maior diferença vs 2º colocado"
              subtitulo="Quanto o 2º fornecedor fica acima do mais barato (%), no mesmo serviço/região"
              itens={barrasRanking}
              maximo={Math.max(...barrasRanking.map((b) => b.valor), 1)}
            />
            <GraficoPizza
              titulo="Quem lidera como mais barato"
              subtitulo="Quantos grupos comparáveis cada fornecedor vence no preço/un."
              fatias={vitoriasMaisBarato}
              centro={`${rankingGap.length} comp.`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top 10 — ranking numérico</CardTitle>
                <p className="text-xs text-muted-foreground">Clique na linha para ver o gráfico de fornecedores ao lado.</p>
              </CardHeader>
              <CardContent className="pt-0">
                {rankingGap.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Precisa de pelo menos dois fornecedores no grupo.</p>
                ) : (
                  <ol className="space-y-2 max-h-[min(22rem,50vh)] overflow-y-auto pr-1 text-sm">
                    {rankingGap.slice(0, 10).map(({ g, gap }, idx) => {
                      const sel = grupoParaGrafico?.id === g.id;
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50 ${sel ? 'border-primary bg-primary/5' : ''}`}
                            onClick={() => { setGrupoGrafico(g.id); setExpandido(g.id); }}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${idx < 3 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug line-clamp-2">{tituloGrupo(g, modo)}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">{gap.barato.fornecedor}</span>
                                  {' · '}{brl(gap.barato.medio)}/un.
                                  {' · '}2º {pct(gap.pctGap)}
                                  {' · '}{textoNotas(g.notas)}
                                </p>
                              </div>
                              <Badge variant={idx === 0 ? 'default' : 'secondary'} className="shrink-0 tabular-nums">{pct(gap.pctGap)}</Badge>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>Gráfico de preço/un. por fornecedor</Label>
                <Select
                  value={grupoParaGrafico?.id ?? ''}
                  onValueChange={(v) => { setGrupoGrafico(v); setExpandido(v); }}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha o serviço/região" /></SelectTrigger>
                  <SelectContent>
                    {visiveis.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {tituloGrupo(g, modo)} ({g.fornecedores.length} forn.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GraficoBarrasHorizontais
                titulo={grupoParaGrafico ? tituloGrupo(grupoParaGrafico, modo) : 'Fornecedores'}
                subtitulo="Menor barra = menor preço médio por unidade (valor ÷ qtd.)"
                itens={barrasGrupoSel}
                maximo={maxPrecoGrupo}
              />
            </div>
          </div>

          <div className="overflow-auto max-h-[min(32rem,60vh)] rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2 text-left font-medium">{modo === 'servico_regiao' ? 'Serviço · unidade · região' : 'Tipo de serviço'}</th>
                  <th className="p-2 text-right font-medium">Forn.</th>
                  <th className="p-2 text-left font-medium">Notas / avulsos</th>
                  <th className="p-2 text-right font-medium">Lanç.</th>
                  <th className="p-2 text-right font-medium">Qtd.</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-left font-medium">Mais barato (médio/un.)</th>
                  <th className="p-2 text-right font-medium">vs 2º</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((g) => {
                  const barato = g.fornecedores[0];
                  const segundo = g.fornecedores[1];
                  const aberto = expandido === g.id;
                  const dif2 =
                    segundo && barato.medio > 0
                      ? ((segundo.medio - barato.medio) / barato.medio) * 100
                      : null;
                  const titulo =
                    modo === 'servico_regiao'
                      ? (
                          <span>
                            <span className="font-medium">{g.rotulo}</span>
                            <span className="text-muted-foreground"> · {curtaUnidade(g.unidade ?? '')} · {g.regiao}</span>
                          </span>
                        )
                      : <span className="font-medium">{g.rotulo}</span>;
                  return (
                    <React.Fragment key={g.id}>
                      <tr
                        className="border-t cursor-pointer hover:bg-muted/30"
                        onClick={() => {
                          const next = aberto ? null : g.id;
                          setExpandido(next);
                          if (next) setGrupoGrafico(next);
                        }}
                      >
                        <td className="p-2 text-muted-foreground">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="p-2">{titulo}</td>
                        <td className="p-2 text-right tabular-nums">{g.fornecedores.length}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{textoNotas(g.notas)}</td>
                        <td className="p-2 text-right tabular-nums">{g.lancamentos}</td>
                        <td className="p-2 text-right tabular-nums">{g.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right tabular-nums font-medium">{brl(g.total)}</td>
                        <td className="p-2">
                          <p className="font-medium truncate max-w-[14rem]" title={barato.fornecedor}>{barato.fornecedor}</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">{brl(barato.medio)}/un.</p>
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {dif2 != null ? (
                            <Badge variant="secondary" className="font-normal">{pct(dif2)}</Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                      {aberto && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={9} className="p-3">
                            <p className="text-xs text-muted-foreground mb-2">Ranking por preço médio/un. · {rotuloServico(g.servico)}</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="p-1.5 text-left font-medium">#</th>
                                  <th className="p-1.5 text-left font-medium">Fornecedor</th>
                                  <th className="p-1.5 text-left font-medium">Notas</th>
                                  <th className="p-1.5 text-right font-medium">Lanç.</th>
                                  <th className="p-1.5 text-right font-medium">Qtd.</th>
                                  <th className="p-1.5 text-right font-medium">Médio/un.</th>
                                  <th className="p-1.5 text-right font-medium">Total</th>
                                  <th className="p-1.5 text-right font-medium">vs menor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.fornecedores.map((f, idx) => (
                                  <tr key={f.chave} className="border-t border-border/50">
                                    <td className="p-1.5">{idx + 1}</td>
                                    <td className="p-1.5">
                                      <span className={idx === 0 ? 'font-semibold' : ''}>{f.fornecedor}</span>
                                      {f.cnpj && <span className="block text-muted-foreground">{formatarDocumento(f.cnpj)}</span>}
                                    </td>
                                    <td className="p-1.5 text-muted-foreground">{textoNotas(f.notas)}</td>
                                    <td className="p-1.5 text-right tabular-nums">{f.lancamentos}</td>
                                    <td className="p-1.5 text-right tabular-nums">{f.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                    <td className={`p-1.5 text-right tabular-nums ${idx === 0 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}`}>
                                      {brl(f.medio)}
                                    </td>
                                    <td className="p-1.5 text-right tabular-nums">{brl(f.total)}</td>
                                    <td className="p-1.5 text-right tabular-nums text-muted-foreground">
                                      {idx === 0 ? (g.fornecedores.length > 1 ? 'menor' : '—') : pct(((f.medio - barato.medio) / barato.medio) * 100)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
