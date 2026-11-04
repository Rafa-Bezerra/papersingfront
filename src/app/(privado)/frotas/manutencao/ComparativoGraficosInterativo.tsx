'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown, Eye, FileDown, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ItemComparativo, SERVICOS_MANUTENCAO } from '@/services/frotasService';
import { brl, nomeDaSessao } from '../comum';
import { FatiaGrafico, graficoPdf, GraficoBarrasHorizontais, GraficoPizza, ItemBarraGrafico, montarFatiasGrafico } from '../graficosFrotas';
import { rotuloServico } from './comumManutencao';

const TODOS = 'TODOS';

type ModoGrafico = 'preco_fornecedor' | 'gasto_servico' | 'custo_regiao';

type FolhaGrafico = {
  id: string;
  titulo: string;
  subtitulo: string;
  itens: ItemBarraGrafico[];
  maximo: number;
  modo: ModoGrafico;
};

const chaveFornecedor = (i: ItemComparativo) =>
  i.fornecedor_cnpj || (i.fornecedor_codcfo ? `${i.unidade}:${i.fornecedor_codcfo}` : i.fornecedor.trim().toUpperCase());

const curtaUnidade = (u: string) => u.replace('WAY ', '');

function precosFornecedor(itens: ItemComparativo[], chavesPermitidas: Set<string>): ItemBarraGrafico[] {
  const mapa = new Map<string, { rotulo: string; total: number; qtd: number; lanc: number }>();
  for (const i of itens) {
    const k = chaveFornecedor(i);
    if (chavesPermitidas.size > 0 && !chavesPermitidas.has(k)) continue;
    const q = i.quantidade > 0 ? i.quantidade : 1;
    const l = mapa.get(k) ?? { rotulo: i.fornecedor, total: 0, qtd: 0, lanc: 0 };
    l.total += i.valor;
    l.qtd += q;
    l.lanc += 1;
    mapa.set(k, l);
  }
  return [...mapa.values()]
    .map((l) => {
      const medio = l.total / l.qtd;
      return {
        rotulo: l.rotulo,
        sub: `${l.lanc} lanç. · ${l.qtd} un.`,
        valor: medio,
        pizzaValor: l.total,
        texto: brl(medio),
        corBarra: undefined as string | undefined,
      };
    })
    .sort((a, b) => a.valor - b.valor)
    .map((item, i, arr) => ({
      ...item,
      corBarra: i === 0 && arr.length > 1 ? 'bg-emerald-500' : 'bg-primary',
    }));
}

function gastoPorServicos(itens: ItemComparativo[], servicosSel: Set<string>): ItemBarraGrafico[] {
  const mapa = new Map<string, number>();
  for (const i of itens) {
    const s = i.servico && i.servico !== 'OUTRO' ? i.servico : '';
    if (!s || (servicosSel.size > 0 && !servicosSel.has(s))) continue;
    mapa.set(s, (mapa.get(s) ?? 0) + i.valor);
  }
  return [...mapa.entries()]
    .map(([s, total]) => ({
      rotulo: rotuloServico(s),
      valor: total,
      texto: brl(total),
    }))
    .sort((a, b) => b.valor - a.valor);
}

function custoPorRegioes(
  itens: ItemComparativo[],
  regioesSel: Set<string>,
  placasPorRegiao: { unidade: string; regiao: string; placas: number }[]
): ItemBarraGrafico[] {
  const lotadas = new Map(placasPorRegiao.map((p) => [`${p.unidade}|${p.regiao}`, p.placas]));
  const mapa = new Map<string, { rotulo: string; total: number; placas: Set<string> }>();
  for (const i of itens) {
    const chave = `${i.unidade}|${i.regiao}`;
    const rotulo = `${curtaUnidade(i.unidade)} · ${i.regiao}`;
    if (regioesSel.size > 0 && !regioesSel.has(chave) && !regioesSel.has(rotulo)) continue;
    const l = mapa.get(chave) ?? { rotulo, total: 0, placas: new Set<string>() };
    l.total += i.valor;
    l.placas.add(i.placa);
    mapa.set(chave, l);
  }
  return [...mapa.entries()]
    .map(([chave, l]) => {
      const veiculos = lotadas.get(chave) ?? l.placas.size;
      const porVeiculo = l.total / Math.max(veiculos, 1);
      return {
        rotulo: l.rotulo,
        sub: `${veiculos} veíc. · total ${brl(l.total)}`,
        valor: porVeiculo,
        texto: brl(porVeiculo),
        corBarra: 'bg-sky-600',
      };
    })
    .sort((a, b) => b.valor - a.valor);
}

function slugTituloGrafico(titulo: string) {
  return titulo.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'grafico';
}

const pesoPizza = (item: ItemBarraGrafico) => item.pizzaValor ?? item.valor;

/** Mesmo visual do Dashboard (pizza + legenda). */
function pizzaEstiloDashboard(f: FolhaGrafico, modo: ModoGrafico): { fatias: FatiaGrafico[]; centro: string } {
  const linhas = f.itens.map((item, i) => ({
    chave: String(i),
    rotulo: item.rotulo,
    total: pesoPizza(item),
    texto: item.texto,
  }));
  const textoPorChave = new Map(linhas.map((l) => [l.chave, l.texto]));
  let fatias = montarFatiasGrafico(
    linhas,
    (x) => x.chave,
    (x) => x.rotulo,
    (x) => x.total,
    (v) => brl(v)
  );
  fatias = fatias.map((fa) => ({
    ...fa,
    texto: fa.chave ? (textoPorChave.get(fa.chave) ?? fa.texto) : fa.texto,
  }));

  let centro: string;
  if (modo === 'preco_fornecedor') centro = f.itens[0]?.texto ?? '—';
  else if (modo === 'gasto_servico') centro = brl(linhas.reduce((s, l) => s + l.total, 0));
  else centro = f.itens.length ? brl(f.itens.reduce((s, i) => s + i.valor, 0) / f.itens.length) : '—';

  return { fatias, centro };
}

function secaoDetalheFolha(f: FolhaGrafico) {
  return {
    titulo: f.titulo,
    nota: f.subtitulo,
    colunas: [
      { titulo: 'Item', largura: 100 },
      { titulo: 'Valor', largura: 30, alinhar: 'right' as const },
    ],
    linhas: f.itens.map((item) => [
      { texto: item.rotulo, sub: item.sub },
      { texto: item.texto, negrito: true },
    ]),
  };
}

function unidadesTexto(itens: ItemComparativo[]) {
  return [...new Set(itens.map((i) => i.unidade))].join(' + ') || '—';
}

function rotuloFornecedoresGrafico(selecionados: number, total: number) {
  if (total === 0) return 'Nenhum fornecedor';
  if (selecionados === 0) return 'Nenhum selecionado';
  if (selecionados === total) return `Todos (${total})`;
  return `${selecionados} de ${total} selecionados`;
}

function GraficoDashboardComparativo({ f, modo, soCorpo }: { f: FolhaGrafico; modo: ModoGrafico; soCorpo?: boolean }) {
  const { fatias, centro } = pizzaEstiloDashboard(f, modo);
  return (
    <GraficoPizza
      titulo={soCorpo ? undefined : f.titulo}
      subtitulo={soCorpo ? undefined : f.subtitulo}
      fatias={fatias}
      centro={centro}
    />
  );
}

/** Preço por fornecedor: barras (preço/un.) + pizza (participação no gasto). Demais modos: só pizza. */
function PreviewGraficoComparativo({ f, soCorpo }: { f: FolhaGrafico; soCorpo?: boolean }) {
  if (f.modo === 'preco_fornecedor') {
    const { fatias } = pizzaEstiloDashboard(f, 'preco_fornecedor');
    const totalGasto = f.itens.reduce((s, i) => s + (i.pizzaValor ?? 0), 0);
    return (
      <div className="space-y-3">
        {!soCorpo && (
          <div>
            <h3 className="text-sm font-semibold leading-snug">{f.titulo}</h3>
            <p className="text-xs text-muted-foreground">{f.subtitulo}</p>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <GraficoBarrasHorizontais
            titulo="Preço médio por unidade"
            subtitulo="Verde = menor preço · todos os fornecedores selecionados"
            itens={f.itens}
            maximo={f.maximo}
          />
          <GraficoPizza
            titulo="Participação no gasto"
            subtitulo="Quanto cada um representou no total (top 6 + outros)"
            fatias={fatias}
            centro={brl(totalGasto)}
          />
        </div>
      </div>
    );
  }
  return <GraficoDashboardComparativo f={f} modo={f.modo} soCorpo={soCorpo} />;
}

export default function ComparativoGraficosInterativo({
  itens,
  periodo,
  filtros,
  placasPorRegiao,
}: {
  itens: ItemComparativo[];
  periodo: string;
  filtros: string;
  placasPorRegiao: { unidade: string; regiao: string; placas: number }[];
}) {
  const [modo, setModo] = useState<ModoGrafico>('preco_fornecedor');
  const [folhaDialog, setFolhaDialog] = useState<FolhaGrafico | null>(null);
  const [servico, setServico] = useState(TODOS);
  const [regiao, setRegiao] = useState(TODOS);
  const [fornecedoresSel, setFornecedoresSel] = useState<Set<string>>(new Set());
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [fornecedoresAberto, setFornecedoresAberto] = useState(false);
  const [servicosSel, setServicosSel] = useState<Set<string>>(new Set());
  const [regioesSel, setRegioesSel] = useState<Set<string>>(new Set());
  const [folhas, setFolhas] = useState<FolhaGrafico[]>([]);
  const [baixando, setBaixando] = useState(false);

  const servicosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const i of itens) if (i.servico && i.servico !== 'OUTRO') s.add(i.servico);
    return SERVICOS_MANUTENCAO.filter((x) => s.has(x.valor));
  }, [itens]);

  const regioesDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of itens) {
      const chave = `${i.unidade}|${i.regiao}`;
      m.set(chave, `${curtaUnidade(i.unidade)} · ${i.regiao}`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    let xs = itens;
    if (regiao !== TODOS) xs = xs.filter((i) => `${i.unidade} · ${i.regiao}` === regiao || `${i.unidade}|${i.regiao}` === regiao);
    if (servico !== TODOS && (modo === 'preco_fornecedor' || modo === 'gasto_servico')) xs = xs.filter((i) => i.servico === servico);
    return xs;
  }, [itens, regiao, modo, servico]);

  const fornecedoresDoServico = useMemo(() => {
    if (servico === TODOS) return [];
    const mapa = new Map<string, string>();
    for (const i of itensFiltrados.filter((x) => x.servico === servico)) {
      mapa.set(chaveFornecedor(i), i.fornecedor);
    }
    return [...mapa.entries()].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [itensFiltrados, servico]);

  const fornecedoresVisiveis = useMemo(() => {
    const q = buscaFornecedor.trim().toUpperCase();
    if (!q) return fornecedoresDoServico;
    return fornecedoresDoServico.filter((f) => f.nome.toUpperCase().includes(q));
  }, [fornecedoresDoServico, buscaFornecedor]);

  useEffect(() => {
    if (modo === 'preco_fornecedor' && servico === TODOS && servicosDisponiveis[0]) {
      setServico(servicosDisponiveis[0].valor);
    }
  }, [modo, servico, servicosDisponiveis]);

  useEffect(() => {
    setBuscaFornecedor('');
    if (servico === TODOS) {
      setFornecedoresSel(new Set());
      return;
    }
    const chaves = fornecedoresDoServico.map((f) => f.chave);
    setFornecedoresSel(new Set(chaves));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset ao trocar serviço
  }, [servico]);

  const graficoAtual = useMemo((): { titulo: string; subtitulo: string; itens: ItemBarraGrafico[]; maximo: number; ok: boolean; aviso?: string } => {
    if (modo === 'preco_fornecedor') {
      if (servico === TODOS) {
        return { titulo: 'Preço médio por fornecedor', subtitulo: 'Escolha o tipo de serviço', itens: [], maximo: 1, ok: false, aviso: 'Selecione um tipo de serviço para comparar preços.' };
      }
      const barras = precosFornecedor(
        itensFiltrados.filter((i) => i.servico === servico),
        fornecedoresSel
      );
      const regTxt = regiao !== TODOS ? ` · ${regiao}` : '';
      return {
        titulo: `Preço por fornecedor — ${rotuloServico(servico)}`,
        subtitulo: `Valor médio por unidade (menor barra = mais barato)${regTxt}`,
        itens: barras,
        maximo: barras.length ? Math.max(...barras.map((b) => b.valor)) : 1,
        aviso:
          fornecedoresSel.size === 0
            ? 'Marque ao menos um fornecedor.'
            : barras.length === 0
              ? 'Nenhum lançamento para esse serviço e filtros.'
              : barras.length === 1
                ? 'Só um fornecedor no recorte; amplie período ou região.'
                : undefined,
        ok: barras.length > 0 && fornecedoresSel.size > 0,
      };
    }
    if (modo === 'gasto_servico') {
      const barras = gastoPorServicos(itensFiltrados, servicosSel);
      return {
        titulo: 'Gasto por tipo de serviço',
        subtitulo: servicosSel.size > 0 ? `${servicosSel.size} serviço(s) selecionado(s)` : 'Todos os serviços com lançamento',
        itens: barras,
        maximo: barras[0]?.valor ?? 1,
        ok: barras.length > 0,
        aviso: barras.length === 0 ? 'Marque ao menos um serviço ou deixe todos desmarcados para ver todos.' : undefined,
      };
    }
    const barras = custoPorRegioes(itensFiltrados, regioesSel, placasPorRegiao);
    return {
      titulo: 'Custo por veículo por região',
      subtitulo: regioesSel.size > 0 ? `${regioesSel.size} região(ões) selecionada(s)` : 'Todas as regiões do período',
      itens: barras,
      maximo: barras.length ? Math.max(...barras.map((b) => b.valor)) : 1,
      ok: barras.length > 0,
    };
  }, [modo, servico, regiao, itensFiltrados, fornecedoresSel, servicosSel, regioesSel, placasPorRegiao]);

  const toggleSet = (set: Set<string>, key: string, checked: boolean) => {
    const next = new Set(set);
    if (checked) next.add(key);
    else next.delete(key);
    return next;
  };

  const adicionarFolha = () => {
    if (!graficoAtual.ok) return void toast.error(graficoAtual.aviso ?? 'Não há dados para adicionar.');
    setFolhas((xs) => [
      ...xs,
      {
        id: `${Date.now()}-${xs.length}`,
        titulo: graficoAtual.titulo,
        subtitulo: graficoAtual.subtitulo,
        itens: graficoAtual.itens,
        maximo: graficoAtual.maximo,
        modo,
      },
    ]);
    toast.success('Gráfico adicionado ao pacote de download.');
  };

  function folhaAtual(): FolhaGrafico | null {
    if (!graficoAtual.ok) return null;
    return {
      id: 'atual',
      titulo: graficoAtual.titulo,
      subtitulo: graficoAtual.subtitulo,
      itens: graficoAtual.itens,
      maximo: graficoAtual.maximo,
      modo,
    };
  }

  async function baixarPdfFolha(f: FolhaGrafico) {
    setBaixando(true);
    try {
      const [{ gerarPdfDetalheFrota }, { salvarPdf, slugArquivo }] = await Promise.all([
        import('@/lib/frotasDashboardPdf'),
        import('@/lib/usuarioPermissoesRelatorioPdf'),
      ]);
      const { fatias, centro } = pizzaEstiloDashboard(f, f.modo);
      const doc = gerarPdfDetalheFrota({
        titulo: f.titulo,
        subtitulo: f.subtitulo,
        unidade: unidadesTexto(itens),
        periodo,
        geradoPor: nomeDaSessao(),
        kpis: [{ rotulo: 'Referência', valor: centro, detalhe: filtros }],
        graficos: [graficoPdf(f.titulo, fatias)],
        secoes: [secaoDetalheFolha(f)],
      });
      await salvarPdf(doc, slugArquivo(`comparativo-${slugTituloGrafico(f.titulo)}`));
      toast.success('PDF baixado.');
    } catch {
      toast.error('Falha ao montar o PDF.');
    } finally {
      setBaixando(false);
    }
  }

  function verGrafico(f?: FolhaGrafico | null) {
    const alvo = f ?? folhaAtual();
    if (!alvo) return void toast.error(graficoAtual.aviso ?? 'Ajuste os filtros para gerar o gráfico.');
    setFolhaDialog(alvo);
  }

  async function baixarPacotePdf() {
    const alvo = folhas.length > 0 ? folhas : folhaAtual() ? [folhaAtual()!] : [];
    if (alvo.length === 0) return void toast.error('Adicione gráficos ao pacote ou configure um gráfico válido.');
    setBaixando(true);
    try {
      const [{ gerarPdfDetalheFrota }, { salvarPdf, slugArquivo }] = await Promise.all([
        import('@/lib/frotasDashboardPdf'),
        import('@/lib/usuarioPermissoesRelatorioPdf'),
      ]);
      const graficosPdf = alvo.map((f) => {
        const { fatias } = pizzaEstiloDashboard(f, f.modo);
        return graficoPdf(f.titulo, fatias);
      });
      const doc = gerarPdfDetalheFrota({
        titulo: alvo.length === 1 ? alvo[0].titulo : 'Pacote de gráficos comparativos',
        subtitulo: 'Manutenção · Montar gráficos',
        unidade: unidadesTexto(itens),
        periodo,
        geradoPor: nomeDaSessao(),
        kpis: [
          { rotulo: 'Gráficos', valor: String(alvo.length), detalhe: filtros },
          { rotulo: 'Período', valor: periodo.split(' a ')[0] ?? periodo, detalhe: periodo },
        ],
        graficos: graficosPdf,
        secoes: alvo.map((f) => secaoDetalheFolha(f)),
      });
      await salvarPdf(doc, slugArquivo(`comparativo-graficos-${periodo.replace(/\s+/g, '-')}`));
      toast.success(folhas.length ? `PDF com ${alvo.length} gráfico(s).` : 'PDF gerado.');
    } catch {
      toast.error('Falha ao montar o PDF.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Montar gráfico comparativo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o tipo de comparação, refine com serviço, região e fornecedores. Adicione vários gráficos ao pacote e baixe em PDF.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Tipo de gráfico</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as ModoGrafico)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preco_fornecedor">Preço por fornecedor (mesmo serviço)</SelectItem>
                  <SelectItem value="gasto_servico">Gasto por tipo de serviço</SelectItem>
                  <SelectItem value="custo_regiao">Custo por veículo (região)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(modo === 'preco_fornecedor' || modo === 'gasto_servico') && (
              <div className="space-y-1">
                <Label>{modo === 'preco_fornecedor' ? 'Tipo de serviço' : 'Filtro opcional (serviço único)'}</Label>
                <Select value={servico} onValueChange={setServico}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {modo === 'gasto_servico' && <SelectItem value={TODOS}>Todos (use checkboxes abaixo)</SelectItem>}
                    {servicosDisponiveis.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Região (opcional)</Label>
              <Select value={regiao} onValueChange={setRegiao}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {regioesDisponiveis.map(([k, rotulo]) => <SelectItem key={k} value={rotulo}>{rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {modo === 'preco_fornecedor' && servico !== TODOS && fornecedoresDoServico.length > 0 && (
              <div className="space-y-1">
                <Label>Fornecedores no gráfico</Label>
                <Popover
                  modal
                  open={fornecedoresAberto}
                  onOpenChange={(aberto) => {
                    setFornecedoresAberto(aberto);
                    if (!aberto) setBuscaFornecedor('');
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className="h-9 w-52 min-w-[12rem] max-w-full justify-between font-normal">
                      <span
                        className={`truncate ${fornecedoresSel.size === 0 ? 'text-muted-foreground' : ''}`}
                        title={rotuloFornecedoresGrafico(fornecedoresSel.size, fornecedoresDoServico.length)}
                      >
                        {rotuloFornecedoresGrafico(fornecedoresSel.size, fornecedoresDoServico.length)}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-(--radix-popover-trigger-width) min-w-80 max-w-[calc(100vw-2rem)] p-0 pointer-events-auto z-[9999]"
                    align="start"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                      <p className="text-sm font-medium">Fornecedores ({fornecedoresDoServico.length})</p>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => setFornecedoresSel(new Set(fornecedoresDoServico.map((f) => f.chave)))}
                        >
                          Selecionar todos
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setFornecedoresSel(new Set())}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                    <div className="border-b p-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={buscaFornecedor}
                          onChange={(e) => setBuscaFornecedor(e.target.value)}
                          placeholder="Buscar pelo nome…"
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {fornecedoresVisiveis.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum fornecedor com esse nome.</p>
                      ) : (
                        fornecedoresVisiveis.map((f) => (
                          <label
                            key={f.chave}
                            className="flex cursor-pointer items-start gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40"
                          >
                            <Checkbox
                              className="mt-0.5 shrink-0"
                              checked={fornecedoresSel.has(f.chave)}
                              onCheckedChange={(c) => setFornecedoresSel(toggleSet(fornecedoresSel, f.chave, c === true))}
                            />
                            <span className="min-w-0 flex-1 leading-snug break-words">{f.nome}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {fornecedoresSel.size} de {fornecedoresDoServico.length} selecionado(s)
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {modo === 'gasto_servico' && (
            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Serviços no gráfico (nenhum marcado = todos)</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-36 overflow-y-auto">
                {servicosDisponiveis.map((s) => (
                  <label key={s.valor} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={servicosSel.has(s.valor)} onCheckedChange={(c) => setServicosSel(toggleSet(servicosSel, s.valor, c === true))} />
                    {s.rotulo}
                  </label>
                ))}
              </div>
            </div>
          )}

          {modo === 'custo_regiao' && (
            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Regiões no gráfico (nenhuma = todas)</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-36 overflow-y-auto">
                {regioesDisponiveis.map(([k, rotulo]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={regioesSel.has(k)} onCheckedChange={(c) => setRegioesSel(toggleSet(regioesSel, k, c === true))} />
                    {rotulo}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => verGrafico()} disabled={!graficoAtual.ok}>
              <Eye className="h-4 w-4 mr-2" /> Ver gráfico
            </Button>
            <Button type="button" variant="outline" onClick={() => { const f = folhaAtual(); if (f) void baixarPdfFolha(f); }} disabled={baixando || !graficoAtual.ok}>
              {baixando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              Baixar PDF
            </Button>
            <Button type="button" variant="secondary" onClick={adicionarFolha} disabled={!graficoAtual.ok}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar ao pacote
            </Button>
            <Button type="button" variant="ghost" onClick={() => void baixarPacotePdf()} disabled={baixando || (folhas.length === 0 && !graficoAtual.ok)}>
              {baixando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              PDF do pacote {folhas.length > 0 ? `(${folhas.length})` : ''}
            </Button>
          </div>
          {graficoAtual.aviso && !graficoAtual.ok && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{graficoAtual.aviso}</p>
          )}
          {graficoAtual.ok && (
            <p className="text-xs text-muted-foreground">
              {modo === 'preco_fornecedor'
                ? 'Barras = preço/un.; pizza = participação no gasto. O PDF traz os dois + tabela.'
                : 'Pizza no estilo do Dashboard. Use Baixar PDF ou PDF do pacote.'}
            </p>
          )}
        </CardContent>
      </Card>

      {graficoAtual.ok && folhaAtual() && (
        <div className="w-full max-w-6xl">
          <PreviewGraficoComparativo f={folhaAtual()!} />
        </div>
      )}

      {folhas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gráficos salvos no pacote ({folhas.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {folhas.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="truncate min-w-0 flex-1">{f.titulo}</span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => verGrafico(f)} disabled={baixando}>
                    <Eye className="h-4 w-4 mr-1" /> Ver
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void baixarPdfFolha(f)} disabled={baixando}>
                    PDF
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setFolhas((xs) => xs.filter((x) => x.id !== f.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={folhaDialog !== null} onOpenChange={(aberto) => !aberto && setFolhaDialog(null)}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
          {folhaDialog && (
            <>
              <DialogHeader>
                <DialogTitle>{folhaDialog.titulo}</DialogTitle>
                <DialogDescription>
                  {folhaDialog.subtitulo}
                  <span className="block mt-1 text-xs">{periodo} · {filtros}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <PreviewGraficoComparativo f={folhaDialog} soCorpo />
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:justify-end">
                <Button type="button" disabled={baixando} onClick={() => void baixarPdfFolha(folhaDialog)}>
                  <FileDown className="h-4 w-4 mr-2" /> Baixar PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
