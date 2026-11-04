'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, Car, Coins, LayoutGrid, MapPin, PieChart, RefreshCw, Scale, Store, TrendingDown, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLASSIFICACOES_DESPESA,
  CLASSIFICACOES_MANUTENCAO,
  dadosComparativo,
  DadosComparativo,
  ItemComparativo,
  SERVICOS_MANUTENCAO,
  UNIDADES_FROTAS,
} from '@/services/frotasService';
import {
  BotaoPdf,
  brl,
  CartaoIndicador,
  COR_PDF,
  FiltroPeriodo,
  inicioHistoricoManutencao,
  isoHoje,
  RelatorioFrotaPdf,
  textoFiltros,
  textoPeriodo,
} from '../comum';
import { GraficoPizza, graficoPdf, graficoPdfLista, montarFatiasGrafico } from '../graficosFrotas';
import { dataBr } from '../VeiculoDialog';
import ComparativoGraficosInterativo from './ComparativoGraficosInterativo';
import ComparativoMelhorPreco from './ComparativoMelhorPreco';
import { formatarDocumento, numeroBr, rotuloClassificacao, rotuloServico } from './comumManutencao';

const TODOS = 'TODOS';
type Grupo = 'MANUTENCAO' | 'DESPESA' | 'TUDO';
type DetalheKpi = 'lancamentos' | 'fornecedores' | 'placas';
type VisaoTab = 'dashboard' | 'resumo' | 'servico' | 'melhor_preco' | 'fornecedor' | 'regiao' | 'graficos';

/** Mesmo fornecedor nas duas unidades tem código diferente em cada RM: junta pelo CNPJ e, sem CNPJ, pelo código. */
const chaveFornecedor = (i: ItemComparativo) =>
  i.fornecedor_cnpj || (i.fornecedor_codcfo ? `${i.unidade}:${i.fornecedor_codcfo}` : i.fornecedor.trim().toUpperCase());
const unitario = (i: ItemComparativo) => i.valor / (i.quantidade > 0 ? i.quantidade : 1);
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;
const curtaUnidade = (u: string) => u.replace('WAY ', '');

function mesesNoPeriodo(de: string, ate: string, itens: ItemComparativo[]) {
  const ini = de || itens.reduce((m, i) => (i.data < m ? i.data : m), ate || isoHoje()).slice(0, 10);
  const fim = ate || isoHoje();
  const [a1, m1, d1] = ini.split('-').map(Number);
  const [a2, m2, d2] = fim.split('-').map(Number);
  return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + (d2 - d1 + 1) / 30);
}

export default function ComparativosManutencao({ unidade, podeTrocarUnidade, versao }: {
  unidade: string;
  podeTrocarUnidade: boolean;
  versao: number;
}) {
  const [unidades, setUnidades] = useState<string[]>([]);
  const [dados, setDados] = useState<DadosComparativo>({ itens: [], placas_por_regiao: [] });
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioHistoricoManutencao());
  const [ate, setAte] = useState(isoHoje());
  const [grupo, setGrupo] = useState<Grupo>('MANUTENCAO');
  const [classificacao, setClassificacao] = useState(TODOS);
  const [regiao, setRegiao] = useState(TODOS);
  const [visao, setVisao] = useState<VisaoTab>('dashboard');
  const [abasAbertas, setAbasAbertas] = useState<Set<VisaoTab>>(() => new Set(['dashboard']));
  const [servicoEscolhido, setServicoEscolhido] = useState('');
  const [filtroResumo, setFiltroResumo] = useState<DetalheKpi>('lancamentos');
  const [unidadeDetalhe, setUnidadeDetalhe] = useState<string | null>(null);

  // Quem pode trocar de unidade (WAY CSC) começa comparando 262 e 153; os demais veem só a própria unidade.
  useEffect(() => {
    if (!unidade) return;
    setUnidades(podeTrocarUnidade ? ['WAY 262', 'WAY 153'] : [unidade]);
  }, [unidade, podeTrocarUnidade]);

  const carregar = useCallback(async () => {
    if (unidades.length === 0) return;
    if (de && ate && de > ate) return void toast.error('A data inicial não pode ser depois da final.');
    setCarregando(true);
    try {
      setDados(await dadosComparativo(unidades, de || undefined, ate || undefined));
    } catch (e) {
      setDados({ itens: [], placas_por_regiao: [] });
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar o comparativo.');
    } finally {
      setCarregando(false);
    }
  }, [unidades, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar, versao]);

  const doGrupo = useMemo(
    () =>
      dados.itens.filter((i) =>
        grupo === 'TUDO' ? true : grupo === 'DESPESA' ? CLASSIFICACOES_DESPESA.has(i.classificacao) : !CLASSIFICACOES_DESPESA.has(i.classificacao)
      ),
    [dados.itens, grupo]
  );
  const regioes = useMemo(() => [...new Set(doGrupo.map((i) => `${i.unidade} · ${i.regiao}`))].sort(), [doGrupo]);
  const itens = useMemo(
    () =>
      doGrupo.filter(
        (i) => (classificacao === TODOS || i.classificacao === classificacao) && (regiao === TODOS || `${i.unidade} · ${i.regiao}` === regiao)
      ),
    [doGrupo, classificacao, regiao]
  );
  const classificacoesGrupo = CLASSIFICACOES_MANUTENCAO.filter((c) =>
    grupo === 'TUDO' ? true : grupo === 'DESPESA' ? c.grupo === 'DESPESA' : c.grupo === 'MANUTENCAO'
  );

  const total = itens.reduce((s, i) => s + i.valor, 0);
  const placasAtendidas = new Set(itens.map((i) => `${i.unidade}:${i.placa}`)).size;
  const qtdFornecedores = new Set(itens.map(chaveFornecedor)).size;
  const porUnidade = unidades.map((u) => ({ u, total: itens.filter((i) => i.unidade === u).reduce((s, i) => s + i.valor, 0) }));
  const periodo = textoPeriodo(de, ate);

  const resumoGraficos = useMemo(() => {
    type Par = { chave: string; rotulo: string; total: number };
    const porServico = new Map<string, number>();
    const porClass = new Map<string, number>();
    const porUn = new Map<string, number>();
    const porForn = new Map<string, Par>();
    for (const i of itens) {
      if (i.servico && i.servico !== 'OUTRO') porServico.set(i.servico, (porServico.get(i.servico) ?? 0) + i.valor);
      porClass.set(i.classificacao, (porClass.get(i.classificacao) ?? 0) + i.valor);
      porUn.set(i.unidade, (porUn.get(i.unidade) ?? 0) + i.valor);
      const kf = chaveFornecedor(i);
      const pf = porForn.get(kf) ?? { chave: kf, rotulo: i.fornecedor, total: 0 };
      pf.total += i.valor;
      porForn.set(kf, pf);
    }
    const lista = (m: Map<string, number>, rotulo: (k: string) => string): Par[] =>
      [...m.entries()].map(([chave, total]) => ({ chave, rotulo: rotulo(chave), total })).sort((a, b) => b.total - a.total);
    const listaForn = [...porForn.values()].sort((a, b) => b.total - a.total);
    return {
      servico: montarFatiasGrafico(lista(porServico, rotuloServico), (x) => x.chave, (x) => x.rotulo, (x) => x.total, brl),
      classificacao: montarFatiasGrafico(lista(porClass, rotuloClassificacao), (x) => x.chave, (x) => x.rotulo, (x) => x.total, brl),
      fornecedor: montarFatiasGrafico(listaForn, (x) => x.chave, (x) => x.rotulo, (x) => x.total, brl),
      unidade: montarFatiasGrafico(lista(porUn, (u) => u), (x) => x.chave, (x) => x.rotulo, (x) => x.total, brl),
    };
  }, [itens]);

  const porPlaca = useMemo(() => {
    const mapa = new Map<string, { unidade: string; placa: string; total: number; lancamentos: number; regiao: string }>();
    for (const i of itens) {
      const k = `${i.unidade}:${i.placa}`;
      const l = mapa.get(k) ?? { unidade: i.unidade, placa: i.placa, total: 0, lancamentos: 0, regiao: i.regiao };
      l.total += i.valor;
      l.lancamentos += 1;
      mapa.set(k, l);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [itens]);

  const fornecedoresDetalhe = useMemo(() => {
    const mapa = new Map<string, { nome: string; cnpj: string; total: number; lancamentos: number; placas: Set<string> }>();
    for (const i of itens) {
      const k = chaveFornecedor(i);
      const l = mapa.get(k) ?? { nome: i.fornecedor, cnpj: i.fornecedor_cnpj ?? '', total: 0, lancamentos: 0, placas: new Set<string>() };
      l.total += i.valor;
      l.lancamentos += 1;
      l.placas.add(i.placa);
      mapa.set(k, l);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [itens]);

  const itensDetalhe = useMemo(
    () => (unidadeDetalhe ? itens.filter((i) => i.unidade === unidadeDetalhe) : itens),
    [itens, unidadeDetalhe]
  );

  const alternarResumo = (tipo: Exclude<DetalheKpi, 'lancamentos'>) => {
    setUnidadeDetalhe(null);
    setFiltroResumo((atual) => (atual === tipo ? 'lancamentos' : tipo));
  };

  const alternarLancamentos = (unidadeFiltro?: string | null) => {
    const u = unidadeFiltro ?? null;
    if (filtroResumo === 'lancamentos' && unidadeDetalhe === u) {
      if (u) setUnidadeDetalhe(null);
      return;
    }
    setFiltroResumo('lancamentos');
    setUnidadeDetalhe(u);
  };

  const limparFiltroResumo = () => {
    setFiltroResumo('lancamentos');
    setUnidadeDetalhe(null);
  };

  const resumoFiltrado = filtroResumo !== 'lancamentos' || unidadeDetalhe !== null;

  const trocarVisao = (v: string) => {
    const tab = v as VisaoTab;
    setVisao(tab);
    setAbasAbertas((s) => (s.has(tab) ? s : new Set(s).add(tab)));
  };

  const conteudoAba = (valor: VisaoTab, pagina: React.ReactNode) => (
    <TabsContent value={valor} forceMount className="mt-0 data-[state=inactive]:hidden">
      {abasAbertas.has(valor) ? pagina : null}
    </TabsContent>
  );

  const filtros = textoFiltros([
    ['Unidades', unidades.map(curtaUnidade).join(' + ')],
    ['Grupo', grupo === 'MANUTENCAO' ? 'Manutenção' : grupo === 'DESPESA' ? 'Outras despesas' : 'Tudo'],
    ['Classificação', classificacao !== TODOS && rotuloClassificacao(classificacao)],
    ['Região', regiao !== TODOS && regiao],
  ]);

  const montarPdfComparativo = (): RelatorioFrotaPdf => {
    const kpisPdf: RelatorioFrotaPdf['kpis'] = [
      { rotulo: 'Total no período', valor: brl(total), detalhe: `${itens.length} lançamento(s)` },
      { rotulo: 'Fornecedores', valor: String(qtdFornecedores), detalhe: 'fornecedores distintos (RM)' },
      {
        rotulo: 'Placas atendidas',
        valor: String(placasAtendidas),
        detalhe: placasAtendidas > 0 ? `${brl(total / placasAtendidas)} por placa` : '—',
      },
    ];
    if (porUnidade.length > 1) {
      for (const p of porUnidade) {
        kpisPdf.push({
          rotulo: curtaUnidade(p.u),
          valor: brl(p.total),
          detalhe: total > 0 ? `${((p.total / total) * 100).toFixed(0)}% do total` : '',
        });
      }
    } else {
      kpisPdf.push({
        rotulo: 'Média por lançamento',
        valor: brl(itens.length ? total / itens.length : 0),
        detalhe: 'valor ÷ quantidade de lançamentos',
      });
    }

    const graficosPdf = [
      graficoPdf('Por tipo de serviço', resumoGraficos.servico),
      graficoPdf('Por classificação', resumoGraficos.classificacao),
      graficoPdf('Por fornecedor', resumoGraficos.fornecedor),
    ];
    if (unidades.length > 1) graficosPdf.push(graficoPdf('Por unidade', resumoGraficos.unidade));

    return {
      titulo: 'Comparativo de manutenção',
      subtitulo: 'Gestão de frotas · Dashboard e resumo',
      unidade: unidades.join(' + '),
      periodo,
      arquivo: `comparativo-dashboard-${unidades.map(curtaUnidade).join('-')}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      kpis: kpisPdf,
      graficos: graficosPdf,
      secoes: [
        {
          titulo: 'Fornecedores no período',
          nota: `${fornecedoresDetalhe.length} fornecedor(es) · total ${brl(total)} · ${filtros}`,
          colunas: [
            { titulo: 'Fornecedor (RM)', largura: 62 },
            { titulo: 'Lanç.', largura: 14, alinhar: 'right' },
            { titulo: 'Placas', largura: 14, alinhar: 'right' },
            { titulo: 'Total', largura: 28, alinhar: 'right' },
            { titulo: '% período', largura: 16, alinhar: 'right' },
          ],
          linhas: fornecedoresDetalhe.slice(0, 25).map((f) => [
            { texto: f.nome, sub: f.cnpj ? formatarDocumento(f.cnpj) : undefined },
            { texto: String(f.lancamentos) },
            { texto: String(f.placas.size) },
            { texto: brl(f.total), negrito: true },
            { texto: total > 0 ? `${((f.total / total) * 100).toFixed(1)}%` : '—' },
          ]),
        },
        {
          titulo: 'Placas com maior gasto',
          nota: `${porPlaca.length} placa(s) no período`,
          colunas: [
            { titulo: 'Placa', largura: 22 },
            { titulo: 'Unidade', largura: 18 },
            { titulo: 'Região', largura: 36 },
            { titulo: 'Lanç.', largura: 14, alinhar: 'right' },
            { titulo: 'Total', largura: 28, alinhar: 'right' },
          ],
          linhas: porPlaca.slice(0, 25).map((p) => [
            { texto: p.placa, negrito: true },
            { texto: curtaUnidade(p.unidade) },
            { texto: p.regiao },
            { texto: String(p.lancamentos) },
            { texto: brl(p.total), negrito: true },
          ]),
        },
      ],
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-base">Filtros do comparativo</CardTitle>
            <BotaoPdf
              rotulo="Gerar PDF (Dashboard)"
              disabled={carregando || itens.length === 0}
              montar={montarPdfComparativo}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O PDF traz os indicadores, os gráficos em pizza da aba Dashboard e as listas de fornecedores e placas (mesmo layout do Dashboard de frotas).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {podeTrocarUnidade && (
              <div className="space-y-1">
                <Label>Unidades</Label>
                <div className="flex flex-wrap gap-1">
                  {UNIDADES_FROTAS.map((u) => {
                    const ativa = unidades.includes(u);
                    return (
                      <Button key={u} type="button" size="sm" variant={ativa ? 'default' : 'outline'} className="h-9"
                        onClick={() => setUnidades((xs) => (ativa ? (xs.length > 1 ? xs.filter((x) => x !== u) : xs) : [...xs, u]))}>
                        {curtaUnidade(u)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Data" />
            <div className="space-y-1">
              <Label>O que comparar</Label>
              <Select value={grupo} onValueChange={(v) => { setGrupo(v as Grupo); setClassificacao(TODOS); }}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                  <SelectItem value="DESPESA">Outras despesas (combustível, locação...)</SelectItem>
                  <SelectItem value="TUDO">Tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Classificação</Label>
              <Select value={classificacao} onValueChange={setClassificacao}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {classificacoesGrupo.map((c) => <SelectItem key={c.valor} value={c.valor}>{c.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Região</Label>
              <Select value={regiao} onValueChange={setRegiao}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {regioes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" title="Recarregar" onClick={() => void carregar()} disabled={carregando}>
              <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={visao} onValueChange={trocarVisao} className="space-y-4">
        <TabsList className="flex-wrap h-auto w-full sm:w-fit gap-1">
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="resumo"><LayoutGrid className="w-4 h-4" /> Resumo</TabsTrigger>
          <TabsTrigger value="servico"><Wrench className="w-4 h-4" /> Por serviço</TabsTrigger>
          <TabsTrigger value="melhor_preco"><TrendingDown className="w-4 h-4" /> Melhor preço</TabsTrigger>
          <TabsTrigger value="fornecedor"><Store className="w-4 h-4" /> Por fornecedor</TabsTrigger>
          <TabsTrigger value="regiao"><MapPin className="w-4 h-4" /> Por região</TabsTrigger>
          <TabsTrigger value="graficos"><PieChart className="w-4 h-4" /> Montar gráficos</TabsTrigger>
        </TabsList>

        {conteudoAba('dashboard', (
          itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento nesses filtros. Ajuste o período ou recarregue.</p>
          ) : (
            <div className={`grid gap-4 ${unidades.length > 1 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              <GraficoPizza
                titulo="Por tipo de serviço"
                subtitulo="Clique → guia Por serviço"
                fatias={resumoGraficos.servico}
                centro={brl(total)}
                onClicar={(k) => { setServicoEscolhido(k); trocarVisao('servico'); }}
              />
              <GraficoPizza titulo="Por classificação" subtitulo="Preventiva, corretiva, despesas..." fatias={resumoGraficos.classificacao} centro={brl(total)} />
              <GraficoPizza
                titulo="Por fornecedor"
                subtitulo="Clique → lista no Resumo"
                fatias={resumoGraficos.fornecedor}
                centro={`${qtdFornecedores} forn.`}
                onClicar={() => { trocarVisao('resumo'); setUnidadeDetalhe(null); setFiltroResumo('fornecedores'); }}
              />
              {unidades.length > 1 && <GraficoPizza titulo="Por unidade" fatias={resumoGraficos.unidade} centro={brl(total)} />}
            </div>
          )
        ))}

        {conteudoAba('resumo', (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Indicadores do período. Clique para filtrar a lista abaixo (como em Notas e pedidos).</p>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <CartaoIndicador icone={Coins} tom="verde" destaque rotulo="Total no período" valor={brl(total)} detalhe={`${itens.length} lançamento(s)`}
                ativo={filtroResumo === 'lancamentos' && !unidadeDetalhe}
                onClick={() => alternarLancamentos()} />
              {porUnidade.length > 1 &&
                porUnidade.map((p) => (
                  <CartaoIndicador key={p.u} icone={Building2} tom="azul" rotulo={p.u} valor={brl(p.total)}
                    detalhe={total > 0 ? `${((p.total / total) * 100).toFixed(0)}% do total` : undefined}
                    ativo={filtroResumo === 'lancamentos' && unidadeDetalhe === p.u}
                    onClick={() => alternarLancamentos(p.u)} />
                ))}
              <CartaoIndicador icone={Store} tom="roxo" rotulo="Fornecedores" valor={qtdFornecedores}
                ativo={filtroResumo === 'fornecedores'}
                onClick={() => alternarResumo('fornecedores')} />
              <CartaoIndicador icone={Car} tom="cinza" rotulo="Placas atendidas" valor={placasAtendidas}
                detalhe={placasAtendidas > 0 ? `${brl(total / placasAtendidas)} por placa` : undefined}
                ativo={filtroResumo === 'placas'}
                onClick={() => alternarResumo('placas')} />
            </div>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">
                    {filtroResumo === 'lancamentos' && (
                      <>Lançamentos no período{unidadeDetalhe ? ` · ${curtaUnidade(unidadeDetalhe)}` : ''}</>
                    )}
                    {filtroResumo === 'fornecedores' && 'Fornecedores no período'}
                    {filtroResumo === 'placas' && 'Placas atendidas'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {periodo}
                    {filtroResumo === 'lancamentos' && (
                      <> · {itensDetalhe.length} lançamento(s) · total {brl(itensDetalhe.reduce((s, i) => s + i.valor, 0))}</>
                    )}
                    {filtroResumo === 'fornecedores' && (
                      <> · {fornecedoresDetalhe.length} fornecedor(es) · total {brl(total)}</>
                    )}
                    {filtroResumo === 'placas' && (
                      <> · {porPlaca.length} placa(s) · média {placasAtendidas > 0 ? brl(total / placasAtendidas) : '—'} por placa</>
                    )}
                  </p>
                </div>
                {resumoFiltrado && (
                  <Button type="button" variant="ghost" size="sm" onClick={limparFiltroResumo}>
                    <X className="h-4 w-4 mr-1" /> Limpar filtro
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {filtroResumo === 'lancamentos' && (
                  <div className="overflow-auto max-h-[min(28rem,55vh)] rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="p-2 text-left font-medium">Data</th>
                          <th className="p-2 text-left font-medium">Placa</th>
                          <th className="p-2 text-left font-medium">Fornecedor</th>
                          <th className="p-2 text-left font-medium">Classificação</th>
                          <th className="p-2 text-left font-medium">Serviço</th>
                          <th className="p-2 text-right font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...itensDetalhe].sort((a, b) => b.data.localeCompare(a.data)).map((i, idx) => (
                          <tr key={`${i.unidade}-${i.placa}-${i.data}-${idx}`} className="border-t">
                            <td className="p-2 whitespace-nowrap">{dataBr(i.data)}</td>
                            <td className="p-2 font-medium">{i.placa}</td>
                            <td className="p-2 max-w-[12rem] truncate" title={i.fornecedor}>{i.fornecedor}</td>
                            <td className="p-2 text-muted-foreground">{rotuloClassificacao(i.classificacao)}</td>
                            <td className="p-2 text-muted-foreground">{rotuloServico(i.servico ?? '') || '—'}</td>
                            <td className="p-2 text-right tabular-nums font-medium">{brl(i.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filtroResumo === 'fornecedores' && (
                  <>
                    <div className="overflow-auto max-h-[min(28rem,55vh)] rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                          <tr>
                            <th className="p-2 text-left font-medium">Fornecedor (RM)</th>
                            <th className="p-2 text-right font-medium">Lanç.</th>
                            <th className="p-2 text-right font-medium">Placas</th>
                            <th className="p-2 text-right font-medium">Total</th>
                            <th className="p-2 text-right font-medium">% período</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fornecedoresDetalhe.map((f) => (
                            <tr key={f.nome + f.cnpj} className="border-t">
                              <td className="p-2">
                                <p className="font-medium">{f.nome}</p>
                                {f.cnpj && <p className="text-xs text-muted-foreground">{formatarDocumento(f.cnpj)}</p>}
                              </td>
                              <td className="p-2 text-right">{f.lancamentos}</td>
                              <td className="p-2 text-right">{f.placas.size}</td>
                              <td className="p-2 text-right font-semibold">{brl(f.total)}</td>
                              <td className="p-2 text-right text-muted-foreground">{total > 0 ? `${((f.total / total) * 100).toFixed(1)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Para comparar preços por serviço, use a guia Por fornecedor.</p>
                      <Button type="button" size="sm" onClick={() => trocarVisao('fornecedor')}>
                        Abrir guia Por fornecedor
                      </Button>
                    </div>
                  </>
                )}
                {filtroResumo === 'placas' && (
                  <>
                    <div className="overflow-auto max-h-[min(28rem,55vh)] rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                          <tr>
                            <th className="p-2 text-left font-medium">Placa</th>
                            <th className="p-2 text-left font-medium">Unidade</th>
                            <th className="p-2 text-left font-medium">Região</th>
                            <th className="p-2 text-right font-medium">Lanç.</th>
                            <th className="p-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {porPlaca.map((p) => (
                            <tr key={`${p.unidade}:${p.placa}`} className="border-t">
                              <td className="p-2 font-medium">{p.placa}</td>
                              <td className="p-2">{curtaUnidade(p.unidade)}</td>
                              <td className="p-2 text-muted-foreground">{p.regiao}</td>
                              <td className="p-2 text-right">{p.lancamentos}</td>
                              <td className="p-2 text-right font-semibold">{brl(p.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => trocarVisao('regiao')}>
                      Ver por região
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ))}

        {conteudoAba('servico', (
          <PorServico itens={itens} periodo={periodo} filtros={filtros} unidades={unidades} carregando={carregando}
            servicoEscolhido={servicoEscolhido} onServicoEscolhido={setServicoEscolhido} />
        ))}
        {conteudoAba('melhor_preco', (
          <ComparativoMelhorPreco itens={itens} periodo={periodo} filtros={filtros} unidades={unidades} carregando={carregando} />
        ))}
        {conteudoAba('fornecedor', (
          <PorFornecedor itens={itens} periodo={periodo} filtros={filtros} unidades={unidades} carregando={carregando} />
        ))}
        {conteudoAba('regiao', (
          <PorRegiao itens={itens} dados={dados} periodo={periodo} filtros={filtros} unidades={unidades} carregando={carregando}
            meses={mesesNoPeriodo(de, ate, dados.itens)} classificacoes={classificacoesGrupo.map((c) => c.valor)} />
        ))}
        {conteudoAba('graficos', (
          <ComparativoGraficosInterativo itens={itens} periodo={periodo} filtros={filtros} placasPorRegiao={dados.placas_por_regiao} />
        ))}
      </Tabs>
    </div>
  );
}

type PropsVisao = { itens: ItemComparativo[]; periodo: string; filtros: string; unidades: string[]; carregando: boolean };

// ----------------------------------------------------------------- Por tipo de serviço

type LinhaFornecedorServico = {
  chave: string;
  fornecedor: string;
  cnpj: string;
  unidades: Set<string>;
  servicos: number;
  quantidade: number;
  total: number;
  menor: number;
  maior: number;
  ultimaData: string;
  ultimoUnitario: number;
  medio: number;
};

function compararFornecedores(itens: ItemComparativo[]): LinhaFornecedorServico[] {
  const mapa = new Map<string, LinhaFornecedorServico>();
  for (const i of itens) {
    const chave = chaveFornecedor(i);
    const u = unitario(i);
    const l = mapa.get(chave) ?? {
      chave, fornecedor: i.fornecedor, cnpj: i.fornecedor_cnpj ?? '', unidades: new Set<string>(), servicos: 0, quantidade: 0, total: 0,
      menor: u, maior: u, ultimaData: '', ultimoUnitario: u, medio: 0,
    };
    l.unidades.add(i.unidade);
    l.servicos += 1;
    l.quantidade += i.quantidade > 0 ? i.quantidade : 1;
    l.total += i.valor;
    l.menor = Math.min(l.menor, u);
    l.maior = Math.max(l.maior, u);
    if (i.data >= l.ultimaData) {
      l.ultimaData = i.data;
      l.ultimoUnitario = u;
    }
    mapa.set(chave, l);
  }
  return [...mapa.values()].map((l) => ({ ...l, medio: l.total / l.quantidade })).sort((a, b) => a.medio - b.medio);
}

function PorServico({ itens, periodo, filtros, unidades, carregando, servicoEscolhido, onServicoEscolhido }: PropsVisao & {
  servicoEscolhido?: string;
  onServicoEscolhido?: (valor: string) => void;
}) {
  const [escolhidoLocal, setEscolhidoLocal] = useState('');
  const escolhido = onServicoEscolhido ? (servicoEscolhido ?? '') : escolhidoLocal;
  const setEscolhido = onServicoEscolhido ?? setEscolhidoLocal;
  const porServico = useMemo(() => {
    const grupos = new Map<string, ItemComparativo[]>();
    for (const i of itens) {
      if (!i.servico || i.servico === 'OUTRO') continue;
      grupos.set(i.servico, [...(grupos.get(i.servico) ?? []), i]);
    }
    return SERVICOS_MANUTENCAO.filter((s) => grupos.has(s.valor))
      .map((s) => {
        const doServico = grupos.get(s.valor)!;
        const qtdTotal = doServico.reduce((t, i) => t + (i.quantidade > 0 ? i.quantidade : 1), 0);
        const totalServico = doServico.reduce((t, i) => t + i.valor, 0);
        return { ...s, lancamentos: doServico.length, total: totalServico, medio: totalServico / qtdTotal, linhas: compararFornecedores(doServico) };
      })
      .sort((a, b) => b.total - a.total);
  }, [itens]);
  const semTipo = itens.filter((i) => !i.servico || i.servico === 'OUTRO');
  const atual = porServico.find((s) => s.valor === escolhido) ?? porServico[0];
  const maisBarato = atual?.linhas[0];

  function montarPdf(): RelatorioFrotaPdf {
    return {
      titulo: 'Comparativo por tipo de serviço',
      subtitulo: `Manutenção · ${filtros}`,
      unidade: unidades.join(' + '),
      periodo,
      arquivo: `comparativo-servico-${unidades.map(curtaUnidade).join('-')}-${periodo}`,
      graficos: [
        graficoPdfLista('Gasto por tipo de serviço', porServico, (s) => s.valor, (s) => s.rotulo, (s) => s.total, brl),
      ],
      kpis: [
        { rotulo: 'Tipos de serviço', valor: String(porServico.length), detalhe: 'com lançamento no período' },
        { rotulo: 'Comparáveis', valor: String(porServico.filter((s) => s.linhas.length > 1).length), detalhe: 'com 2 ou mais fornecedores' },
        { rotulo: 'Sem tipo / outro', valor: String(semTipo.length), detalhe: brl(semTipo.reduce((t, i) => t + i.valor, 0)) },
      ],
      secoes: porServico.map((s) => ({
        titulo: s.rotulo,
        nota: `${s.lancamentos} lançamento(s) · ${s.linhas.length} fornecedor(es) · preço médio ${brl(s.medio)}/un.`,
        colunas: [
          { titulo: 'Fornecedor', largura: 56 }, { titulo: 'Un.', largura: 14 }, { titulo: 'Serv.', largura: 12, alinhar: 'right' },
          { titulo: 'Médio/un.', largura: 24, alinhar: 'right' }, { titulo: 'Menor', largura: 22, alinhar: 'right' },
          { titulo: 'Maior', largura: 22, alinhar: 'right' }, { titulo: 'Total', largura: 24, alinhar: 'right' }, { titulo: 'Dif.', largura: 14, alinhar: 'right' },
        ],
        linhas: s.linhas.map((l, i) => [
          { texto: l.fornecedor, sub: l.cnpj ? formatarDocumento(l.cnpj) : undefined, negrito: i === 0 },
          { texto: [...l.unidades].map(curtaUnidade).join('/') },
          { texto: String(l.servicos) },
          { texto: brl(l.medio), negrito: true, cor: i === 0 && s.linhas.length > 1 ? COR_PDF.ok : undefined },
          { texto: brl(l.menor) },
          { texto: brl(l.maior) },
          { texto: brl(l.total) },
          i === 0
            ? { texto: s.linhas.length > 1 ? 'menor' : '—', cor: COR_PDF.ok }
            : { texto: pct(((l.medio - s.linhas[0].medio) / s.linhas[0].medio) * 100), cor: COR_PDF.alerta },
        ]),
      })),
    };
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" /> Quem cobra menos por serviço</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Preço por unidade (valor ÷ quantidade) de cada fornecedor no mesmo tipo de serviço. Escolha o serviço na lista.
            </p>
          </div>
          <BotaoPdf rotulo="PDF por serviço" disabled={carregando || porServico.length === 0} montar={montarPdf} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {porServico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento com tipo de serviço nesses filtros.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left font-medium">Serviço</th>
                    <th className="p-2 text-right font-medium">Forn.</th>
                    <th className="p-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porServico.map((s) => (
                    <tr key={s.valor} onClick={() => setEscolhido(s.valor)}
                      className={`border-t cursor-pointer hover:bg-muted/50 ${atual?.valor === s.valor ? 'bg-primary/10' : ''}`}>
                      <td className="p-2">
                        <p className="font-medium">{s.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{s.lancamentos} lanç. · médio {brl(s.medio)}/un.</p>
                      </td>
                      <td className="p-2 text-right">{s.linhas.length}</td>
                      <td className="p-2 text-right">{brl(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {atual && maisBarato && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{atual.rotulo}</p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left font-medium">Fornecedor (RM)</th>
                        <th className="p-2 text-right font-medium">Serviços</th>
                        <th className="p-2 text-right font-medium">Qtd.</th>
                        <th className="p-2 text-right font-medium">Médio/un.</th>
                        <th className="p-2 text-right font-medium">Menor</th>
                        <th className="p-2 text-right font-medium">Maior</th>
                        <th className="p-2 text-right font-medium">Último</th>
                        <th className="p-2 text-right font-medium">Total</th>
                        <th className="p-2 text-right font-medium">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atual.linhas.map((l, i) => (
                        <tr key={l.chave} className="border-t">
                          <td className="p-2">
                            <p className="font-medium">{l.fornecedor}</p>
                            <p className="text-xs text-muted-foreground">
                              {[[...l.unidades].map(curtaUnidade).join(' / '), formatarDocumento(l.cnpj)].filter(Boolean).join(' · ')}
                            </p>
                          </td>
                          <td className="p-2 text-right">{l.servicos}</td>
                          <td className="p-2 text-right">{numeroBr(l.quantidade)}</td>
                          <td className="p-2 text-right font-semibold">{brl(l.medio)}</td>
                          <td className="p-2 text-right">{brl(l.menor)}</td>
                          <td className="p-2 text-right">{brl(l.maior)}</td>
                          <td className="p-2 text-right">
                            <p>{brl(l.ultimoUnitario)}</p>
                            <p className="text-xs text-muted-foreground">{dataBr(l.ultimaData)}</p>
                          </td>
                          <td className="p-2 text-right">{brl(l.total)}</td>
                          <td className="p-2 text-right">
                            {i === 0 ? (
                              atual.linhas.length > 1 ? (
                                <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">Mais barato</Badge>
                              ) : '—'
                            ) : (
                              <span className="font-medium text-amber-700 dark:text-amber-400">
                                {pct(((l.medio - maisBarato.medio) / maisBarato.medio) * 100)} ({brl(l.medio - maisBarato.medio)}/un.)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {atual.linhas.length === 1 && (
                  <p className="text-xs text-muted-foreground">Só um fornecedor fez este serviço; amplie o período ou as unidades para comparar.</p>
                )}
              </div>
            )}
          </div>
        )}
        {semTipo.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {semTipo.length} lançamento(s) com tipo “Outro” ou sem tipo ({brl(semTipo.reduce((t, i) => t + i.valor, 0))}) não entram
            na comparação por serviço; eles aparecem nas visões por fornecedor e por região.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------- Por fornecedor

type LinhaFornecedor = {
  chave: string;
  fornecedor: string;
  cnpj: string;
  unidades: Set<string>;
  notas: Set<string>;
  lancamentos: number;
  placas: Set<string>;
  total: number;
  servicos: Map<string, { total: number; quantidade: number }>;
  /** Média de (preço/un. dele ÷ preço/un. médio do serviço) nos serviços que ele fez; 1 = na média. */
  indice: number | null;
};

function PorFornecedor({ itens, periodo, filtros, unidades, carregando }: PropsVisao) {
  const [aberto, setAberto] = useState<string | null>(null);
  const linhas = useMemo(() => {
    const medioServico = new Map<string, number>();
    const acum = new Map<string, { t: number; q: number }>();
    for (const i of itens) {
      if (!i.servico || i.servico === 'OUTRO') continue;
      const a = acum.get(i.servico) ?? { t: 0, q: 0 };
      a.t += i.valor;
      a.q += i.quantidade > 0 ? i.quantidade : 1;
      acum.set(i.servico, a);
    }
    acum.forEach((a, s) => medioServico.set(s, a.t / a.q));

    const mapa = new Map<string, LinhaFornecedor>();
    for (const i of itens) {
      const chave = chaveFornecedor(i);
      const l = mapa.get(chave) ?? {
        chave, fornecedor: i.fornecedor, cnpj: i.fornecedor_cnpj ?? '', unidades: new Set<string>(), notas: new Set<string>(),
        lancamentos: 0, placas: new Set<string>(), total: 0, servicos: new Map(), indice: null,
      };
      l.unidades.add(i.unidade);
      if (i.id_nota) l.notas.add(`${i.unidade}:${i.id_nota}`);
      l.lancamentos += 1;
      l.placas.add(i.placa);
      l.total += i.valor;
      const chaveServico = i.servico || 'OUTRO';
      const s = l.servicos.get(chaveServico) ?? { total: 0, quantidade: 0 };
      s.total += i.valor;
      s.quantidade += i.quantidade > 0 ? i.quantidade : 1;
      l.servicos.set(chaveServico, s);
      mapa.set(chave, l);
    }
    for (const l of mapa.values()) {
      const razoes = [...l.servicos.entries()]
        .filter(([s]) => s !== 'OUTRO' && medioServico.get(s))
        .map(([s, v]) => v.total / v.quantidade / medioServico.get(s)!);
      l.indice = razoes.length ? razoes.reduce((a, b) => a + b, 0) / razoes.length : null;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [itens]);
  const total = linhas.reduce((s, l) => s + l.total, 0);

  function montarPdf(): RelatorioFrotaPdf {
    return {
      titulo: 'Comparativo por fornecedor',
      subtitulo: `Manutenção · ${filtros}`,
      unidade: unidades.join(' + '),
      periodo,
      arquivo: `comparativo-fornecedor-${unidades.map(curtaUnidade).join('-')}-${periodo}`,
      graficos: [
        graficoPdfLista('Gasto por fornecedor', linhas, (l) => l.fornecedor, (l) => l.fornecedor, (l) => l.total, brl),
      ],
      kpis: [
        { rotulo: 'Fornecedores', valor: String(linhas.length), detalhe: brl(total) },
        { rotulo: 'Maior', valor: linhas[0]?.fornecedor ?? '—', detalhe: linhas[0] ? brl(linhas[0].total) : '' },
        {
          rotulo: 'Top 5',
          valor: total > 0 ? `${((linhas.slice(0, 5).reduce((s, l) => s + l.total, 0) / total) * 100).toFixed(0)}%` : '—',
          detalhe: 'do gasto no período',
        },
      ],
      secoes: [{
        titulo: 'Fornecedores por gasto',
        nota: 'Preço x média = quanto o preço por unidade dele fica acima (+) ou abaixo (−) da média do mesmo serviço.',
        colunas: [
          { titulo: 'Fornecedor', largura: 62 }, { titulo: 'Un.', largura: 14 }, { titulo: 'NFs', largura: 12, alinhar: 'right' },
          { titulo: 'Lanç.', largura: 14, alinhar: 'right' }, { titulo: 'Total', largura: 26, alinhar: 'right' },
          { titulo: '% total', largura: 16, alinhar: 'right' }, { titulo: 'x média', largura: 18, alinhar: 'right' },
        ],
        linhas: linhas.map((l) => [
          { texto: l.fornecedor, sub: l.cnpj ? formatarDocumento(l.cnpj) : undefined },
          { texto: [...l.unidades].map(curtaUnidade).join('/') },
          { texto: String(l.notas.size) },
          { texto: String(l.lancamentos) },
          { texto: brl(l.total), negrito: true },
          { texto: total > 0 ? `${((l.total / total) * 100).toFixed(1)}%` : '—' },
          l.indice == null
            ? { texto: '—' }
            : { texto: pct((l.indice - 1) * 100), cor: l.indice > 1.1 ? COR_PDF.alerta : l.indice < 0.95 ? COR_PDF.ok : undefined },
        ]),
      }],
    };
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" /> Gasto por fornecedor</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Nome como está no RM. “Preço x média” compara o preço por unidade dele com a média dos outros no mesmo serviço.
              Clique na linha para ver os serviços.
            </p>
          </div>
          <BotaoPdf rotulo="PDF por fornecedor" disabled={carregando || linhas.length === 0} montar={montarPdf} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento nesses filtros.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left font-medium">Fornecedor (RM)</th>
                  <th className="p-2 text-right font-medium">NFs</th>
                  <th className="p-2 text-right font-medium">Lançamentos</th>
                  <th className="p-2 text-right font-medium">Placas</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Ticket médio</th>
                  <th className="p-2 text-left font-medium w-40">% do total</th>
                  <th className="p-2 text-right font-medium">Preço x média</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const parte = total > 0 ? (l.total / total) * 100 : 0;
                  return (
                    <React.Fragment key={l.chave}>
                      <tr className="border-t cursor-pointer hover:bg-muted/50" onClick={() => setAberto(aberto === l.chave ? null : l.chave)}>
                        <td className="p-2">
                          <p className="font-medium">{l.fornecedor}</p>
                          <p className="text-xs text-muted-foreground">
                            {[[...l.unidades].map(curtaUnidade).join(' / '), formatarDocumento(l.cnpj)].filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        <td className="p-2 text-right">{l.notas.size || '—'}</td>
                        <td className="p-2 text-right">{l.lancamentos}</td>
                        <td className="p-2 text-right">{l.placas.size}</td>
                        <td className="p-2 text-right font-semibold">{brl(l.total)}</td>
                        <td className="p-2 text-right">{brl(l.total / l.lancamentos)}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded bg-muted">
                              <div className="h-2 rounded bg-primary" style={{ width: `${Math.max(parte, 1)}%` }} />
                            </div>
                            <span className="w-12 text-right text-xs tabular-nums">{parte.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                          {l.indice == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={l.indice > 1.1 ? 'font-medium text-amber-700 dark:text-amber-400' : l.indice < 0.95 ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''}>
                              {pct((l.indice - 1) * 100)}
                            </span>
                          )}
                        </td>
                      </tr>
                      {aberto === l.chave && (
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="p-2">
                            <div className="flex flex-wrap gap-2">
                              {[...l.servicos.entries()].sort((a, b) => b[1].total - a[1].total).map(([s, v]) => (
                                <Badge key={s} variant="outline" className="font-normal">
                                  {rotuloServico(s) || 'Outro'}: {brl(v.total)}
                                  {v.quantidade > 0 && s !== 'OUTRO' ? ` · ${brl(v.total / v.quantidade)}/un.` : ''}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------- Por região

function PorRegiao({ itens, dados, periodo, filtros, unidades, carregando, meses, classificacoes }: PropsVisao & {
  dados: DadosComparativo;
  meses: number;
  classificacoes: string[];
}) {
  const [agrupar, setAgrupar] = useState<'regiao' | 'cc'>('regiao');
  const presentes = useMemo(() => {
    const porTotal = new Map<string, number>();
    for (const i of itens) porTotal.set(i.classificacao, (porTotal.get(i.classificacao) ?? 0) + i.valor);
    return classificacoes.filter((c) => porTotal.has(c)).sort((a, b) => (porTotal.get(b) ?? 0) - (porTotal.get(a) ?? 0)).slice(0, 5);
  }, [itens, classificacoes]);

  const linhas = useMemo(() => {
    const placasLotadas = new Map(dados.placas_por_regiao.map((p) => [`${p.unidade}|${p.regiao}`, p.placas]));
    const mapa = new Map<string, { unidade: string; nome: string; sub: string; total: number; lancamentos: number; placas: Set<string>; porClasse: Map<string, number> }>();
    for (const i of itens) {
      const nome = agrupar === 'regiao' ? i.regiao : i.desc_ccusto || i.codccusto || 'Sem centro de custo';
      const chave = `${i.unidade}|${nome}`;
      const l = mapa.get(chave) ?? {
        unidade: i.unidade, nome, sub: agrupar === 'cc' ? i.codccusto ?? '' : '', total: 0, lancamentos: 0, placas: new Set<string>(), porClasse: new Map(),
      };
      l.total += i.valor;
      l.lancamentos += 1;
      l.placas.add(i.placa);
      l.porClasse.set(i.classificacao, (l.porClasse.get(i.classificacao) ?? 0) + i.valor);
      mapa.set(chave, l);
    }
    return [...mapa.entries()]
      .map(([chave, l]) => {
        // Custo por veículo: pelas placas lotadas na região (cadastro de lotação); sem cadastro, pelas placas atendidas.
        const lotadas = agrupar === 'regiao' ? placasLotadas.get(chave) ?? 0 : 0;
        const base = lotadas || l.placas.size;
        return { ...l, veiculos: base, lotadas, porVeiculo: l.total / base, porVeiculoMes: l.total / base / meses };
      })
      .sort((a, b) => a.unidade.localeCompare(b.unidade) || b.porVeiculo - a.porVeiculo);
  }, [itens, dados.placas_por_regiao, agrupar, meses]);

  const mediaPorVeiculo = (() => {
    const t = linhas.reduce((s, l) => s + l.total, 0);
    const v = linhas.reduce((s, l) => s + l.veiculos, 0);
    return v > 0 ? t / v : 0;
  })();
  const acima = (v: number) => mediaPorVeiculo > 0 && v > mediaPorVeiculo * 1.2;

  function montarPdf(): RelatorioFrotaPdf {
    return {
      titulo: agrupar === 'regiao' ? 'Comparativo por região' : 'Comparativo por centro de custo',
      subtitulo: `Manutenção · ${filtros}`,
      unidade: unidades.join(' + '),
      periodo,
      arquivo: `comparativo-regiao-${unidades.map(curtaUnidade).join('-')}-${periodo}`,
      graficos: [
        graficoPdfLista(
          agrupar === 'regiao' ? 'Gasto por região' : 'Gasto por centro de custo',
          linhas,
          (l) => `${l.unidade}|${l.nome}`,
          (l) => `${curtaUnidade(l.unidade)} · ${l.nome}`,
          (l) => l.total,
          brl
        ),
      ],
      kpis: [
        { rotulo: 'Média por veículo', valor: brl(mediaPorVeiculo), detalhe: `${brl(mediaPorVeiculo / meses)} por mês` },
        { rotulo: agrupar === 'regiao' ? 'Regiões' : 'Centros de custo', valor: String(linhas.length), detalhe: '' },
        { rotulo: 'Acima da média', valor: String(linhas.filter((l) => acima(l.porVeiculo)).length), detalhe: 'mais de 20% acima por veículo' },
      ],
      secoes: [{
        titulo: agrupar === 'regiao' ? 'Regiões' : 'Centros de custo',
        nota: `Custo por veículo = total ÷ placas lotadas (ou atendidas, sem lotação). Período de ${numeroBr(meses)} mês(es).`,
        colunas: [
          { titulo: 'Unidade · região', largura: 56 }, { titulo: 'Veíc.', largura: 14, alinhar: 'right' },
          { titulo: 'Lanç.', largura: 14, alinhar: 'right' }, { titulo: 'Total', largura: 28, alinhar: 'right' },
          { titulo: 'Por veículo', largura: 28, alinhar: 'right' }, { titulo: 'Veíc./mês', largura: 24, alinhar: 'right' },
        ],
        linhas: linhas.map((l) => [
          { texto: `${curtaUnidade(l.unidade)} · ${l.nome}`, sub: l.sub || undefined },
          { texto: String(l.veiculos) },
          { texto: String(l.lancamentos) },
          { texto: brl(l.total) },
          { texto: brl(l.porVeiculo), negrito: true, cor: acima(l.porVeiculo) ? COR_PDF.alerta : undefined },
          { texto: brl(l.porVeiculoMes) },
        ]),
      }],
    };
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Gasto por região</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Região e centro de custo vêm da lotação da placa (sub-aba Lotação das placas). Em destaque, as que gastam mais de
              20% acima da média por veículo ({brl(mediaPorVeiculo)}).
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Select value={agrupar} onValueChange={(v) => setAgrupar(v as 'regiao' | 'cc')}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="regiao">Agrupar por região</SelectItem>
                <SelectItem value="cc">Agrupar por centro de custo</SelectItem>
              </SelectContent>
            </Select>
            <BotaoPdf rotulo="PDF por região" disabled={carregando || linhas.length === 0} montar={montarPdf} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento nesses filtros.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left font-medium">{agrupar === 'regiao' ? 'Unidade · região' : 'Unidade · centro de custo'}</th>
                  <th className="p-2 text-right font-medium">Veículos</th>
                  <th className="p-2 text-right font-medium">Lanç.</th>
                  {presentes.map((c) => <th key={c} className="p-2 text-right font-medium">{rotuloClassificacao(c)}</th>)}
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Por veículo</th>
                  <th className="p-2 text-right font-medium">Veículo/mês</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`${l.unidade}|${l.nome}`} className={`border-t ${acima(l.porVeiculo) ? 'bg-amber-500/10' : ''}`}>
                    <td className="p-2">
                      <p className="font-medium">{curtaUnidade(l.unidade)} · {l.nome}</p>
                      {l.sub && <p className="text-xs text-muted-foreground">{l.sub}</p>}
                    </td>
                    <td className="p-2 text-right" title={l.lotadas ? 'placas lotadas na região' : 'placas atendidas (região sem lotação cadastrada)'}>
                      {l.veiculos}{!l.lotadas && agrupar === 'regiao' ? '*' : ''}
                    </td>
                    <td className="p-2 text-right">{l.lancamentos}</td>
                    {presentes.map((c) => (
                      <td key={c} className="p-2 text-right text-muted-foreground">{l.porClasse.get(c) ? brl(l.porClasse.get(c)!) : '—'}</td>
                    ))}
                    <td className="p-2 text-right">{brl(l.total)}</td>
                    <td className={`p-2 text-right font-semibold ${acima(l.porVeiculo) ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                      {brl(l.porVeiculo)}
                    </td>
                    <td className="p-2 text-right">{brl(l.porVeiculoMes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {agrupar === 'regiao' && linhas.some((l) => !l.lotadas) && (
          <p className="text-xs text-muted-foreground">* Região sem placas lotadas: o custo por veículo usa as placas atendidas.</p>
        )}
      </CardContent>
    </Card>
  );
}
