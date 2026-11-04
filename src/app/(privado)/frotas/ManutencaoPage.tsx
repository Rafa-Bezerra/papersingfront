'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  ChevronsUpDown,
  CircleDot,
  Coins,
  Loader2,
  PaintBucket,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  anexoManutencao,
  buscarFornecedoresRm,
  CLASSIFICACOES_MANUTENCAO,
  excluirManutencao,
  FornecedorRm,
  FrotaManutencao,
  FrotaPlaca,
  listarManutencoes,
  normalizarPlaca,
  salvarManutencao,
  SERVICOS_MANUTENCAO,
} from '@/services/frotasService';
import {
  BotaoPdf,
  BotoesAnexo,
  brl,
  CartaoIndicador,
  COR_PDF,
  DialogExclusao,
  FiltroPeriodo,
  inicioDoAno,
  isoHoje,
  RelatorioFrotaPdf,
  SeletorUnidade,
  textoFiltros,
  textoPeriodo,
  TomIndicador,
  useUnidadeFrotas,
  usePlacasFrota,
  valorParaApi,
  valorParaCampo,
} from './comum';
import { dataBr } from './VeiculoDialog';

const MAX_MB = 10;

const COR_CLASSIFICACAO: Record<string, string> = {
  PREVENTIVA: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
  CORRETIVA: 'border-amber-500 text-amber-700 dark:text-amber-400',
  FUNILARIA_PINTURA: 'border-sky-500 text-sky-700 dark:text-sky-400',
  BORRACHARIA: 'border-slate-500 text-slate-700 dark:text-slate-300',
};

const ESTILO_CLASSIFICACAO: Record<string, { icone: LucideIcon; tom: TomIndicador }> = {
  PREVENTIVA: { icone: ShieldCheck, tom: 'verde' },
  CORRETIVA: { icone: Wrench, tom: 'ambar' },
  FUNILARIA_PINTURA: { icone: PaintBucket, tom: 'azul' },
  BORRACHARIA: { icone: CircleDot, tom: 'cinza' },
};

function rotuloClassificacao(c: string) {
  return CLASSIFICACOES_MANUTENCAO.find((x) => x.valor === c)?.rotulo ?? c;
}

function rotuloServico(s?: string | null) {
  return s ? (SERVICOS_MANUTENCAO.find((x) => x.valor === s)?.rotulo ?? s) : '';
}

const qtd = (m: FrotaManutencao) => (m.quantidade && m.quantidade > 0 ? m.quantidade : 1);
const numeroBr = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function ManutencaoPage() {
  const sel = useUnidadeFrotas();
  const { unidade } = sel;
  const placas = usePlacasFrota(unidade);

  const [itens, setItens] = useState<FrotaManutencao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(isoHoje());
  const [placa, setPlaca] = useState('');
  const [classificacao, setClassificacao] = useState('TODAS');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<FrotaManutencao | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<FrotaManutencao | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    try {
      setItens(await listarManutencoes(unidade, de || undefined, ate || undefined));
    } catch (e) {
      setItens([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as manutenções.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Filtros de placa e busca valem para os quadros; a classificação filtra só a tabela.
  const semClassificacao = useMemo(() => {
    const p = normalizarPlaca(placa);
    const b = busca.trim().toLowerCase();
    return itens.filter(
      (m) =>
        (!p || m.placa.includes(p)) &&
        (!b || `${rotuloServico(m.servico)} ${m.descricao} ${m.fornecedor} ${m.fornecedor_cnpj ?? ''}`.toLowerCase().includes(b))
    );
  }, [itens, placa, busca]);
  const linhas = useMemo(
    () => (classificacao === 'TODAS' ? semClassificacao : semClassificacao.filter((m) => m.classificacao === classificacao)),
    [semClassificacao, classificacao]
  );
  const total = linhas.reduce((s, m) => s + m.valor, 0);
  const filtrosAtivos = !!placa || !!busca || classificacao !== 'TODAS';

  const colunas: ColumnDef<FrotaManutencao>[] = useMemo(
    () => [
      { id: 'data', header: 'Data', cell: ({ row }) => dataBr(row.original.data_manutencao) },
      {
        id: 'placa',
        header: 'Placa',
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.placa}</span>,
      },
      {
        id: 'classificacao',
        header: 'Classificação',
        cell: ({ row }) => (
          <Badge variant="outline" className={COR_CLASSIFICACAO[row.original.classificacao] ?? ''}>
            {rotuloClassificacao(row.original.classificacao)}
          </Badge>
        ),
      },
      {
        id: 'descricao',
        header: 'Serviço',
        cell: ({ row }) => (
          <div className="max-w-72 leading-tight">
            {row.original.servico ? (
              <p className="font-medium">{rotuloServico(row.original.servico)}</p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">Sem tipo de serviço</p>
            )}
            <p className="truncate text-xs text-muted-foreground" title={row.original.descricao}>
              {row.original.descricao}
            </p>
          </div>
        ),
      },
      {
        id: 'fornecedor',
        header: 'Fornecedor',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p>{row.original.fornecedor}</p>
            {row.original.fornecedor_cnpj && (
              <p className="text-xs text-muted-foreground">{row.original.fornecedor_cnpj}</p>
            )}
          </div>
        ),
      },
      {
        id: 'conclusao',
        header: 'Feita em',
        cell: ({ row }) =>
          row.original.data_conclusao ? (
            dataBr(row.original.data_conclusao)
          ) : (
            <Badge variant="secondary">Em andamento</Badge>
          ),
      },
      {
        id: 'valor',
        header: () => <div className="text-right">Valor</div>,
        cell: ({ row }) => (
          <div className="text-right leading-tight">
            <p className="font-medium">{brl(row.original.valor)}</p>
            {qtd(row.original) !== 1 && (
              <p className="text-xs text-muted-foreground">
                {numeroBr(qtd(row.original))} × {brl(row.original.valor / qtd(row.original))}
              </p>
            )}
          </div>
        ),
        footer: () => <div className="text-right font-semibold">{brl(total)}</div>,
      },
      {
        id: 'anexo',
        header: 'Anexo',
        cell: ({ row }) => (
          <BotoesAnexo
            nome={row.original.nome_arquivo}
            abrir={() => anexoManutencao(row.original.id)}
            baixar={() => anexoManutencao(row.original.id, row.original.nome_arquivo)}
          />
        ),
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Alterar"
              onClick={() => setEditando(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir"
              onClick={() => setExcluindo(row.original)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [total]
  );

  function montarPdf(): RelatorioFrotaPdf {
    const doTipo = (c: string) => semClassificacao.filter((m) => m.classificacao === c);
    return {
      titulo: 'Manutenções',
      subtitulo: 'Gestão de frotas',
      unidade,
      periodo: textoPeriodo(de, ate),
      arquivo: `manutencoes-${unidade}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      kpis: [
        { rotulo: 'Total no período', valor: brl(semClassificacao.reduce((s, m) => s + m.valor, 0)), detalhe: `${semClassificacao.length} serviço(s)` },
        ...CLASSIFICACOES_MANUTENCAO.map((c) => ({
          rotulo: c.rotulo,
          valor: brl(doTipo(c.valor).reduce((s, m) => s + m.valor, 0)),
          detalhe: `${doTipo(c.valor).length} serviço(s)`,
        })),
        { rotulo: 'Em andamento', valor: String(linhas.filter((m) => !m.data_conclusao).length), detalhe: 'sem data de conclusão' },
      ],
      secoes: [{
        titulo: 'Manutenções',
        nota: `${linhas.length} serviço(s) · ${brl(total)} · ${textoFiltros([
          ['Placa', normalizarPlaca(placa)],
          ['Classificação', classificacao !== 'TODAS' && rotuloClassificacao(classificacao)],
          ['Busca', busca.trim()],
        ])}`,
        colunas: [
          { titulo: 'Data', largura: 18 }, { titulo: 'Placa', largura: 18 }, { titulo: 'Classificação', largura: 26 },
          { titulo: 'Serviço / fornecedor', largura: 82 }, { titulo: 'Feita em', largura: 22 }, { titulo: 'Valor', largura: 24, alinhar: 'right' },
        ],
        linhas: linhas.map((m) => [
          { texto: dataBr(m.data_manutencao) },
          { texto: m.placa, negrito: true },
          { texto: rotuloClassificacao(m.classificacao), cor: m.classificacao === 'PREVENTIVA' ? COR_PDF.ok : COR_PDF.alerta },
          {
            texto: [rotuloServico(m.servico), m.descricao].filter(Boolean).join(' · '),
            sub: [qtd(m) !== 1 && `${numeroBr(qtd(m))} un.`, m.fornecedor, m.fornecedor_cnpj].filter(Boolean).join(' · '),
          },
          m.data_conclusao ? { texto: dataBr(m.data_conclusao) } : { texto: 'Em andamento', cor: COR_PDF.alerta },
          { texto: brl(m.valor), negrito: true },
        ]),
      }],
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Manutenção
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Serviços feitos nos veículos: data, classificação, fornecedor e valor gasto. Fica só no PaperSign.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <SeletorUnidade {...sel} />
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" onClick={() => setEditando('novo')} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Nova manutenção
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <CartaoIndicador icone={Coins} tom="verde" destaque rotulo="Total no período" ativo={classificacao === 'TODAS'}
          onClick={() => setClassificacao('TODAS')} valor={brl(semClassificacao.reduce((s, m) => s + m.valor, 0))}
          detalhe={`${semClassificacao.length} serviço(s)`} />
        {CLASSIFICACOES_MANUTENCAO.map((c) => {
          const doTipo = semClassificacao.filter((m) => m.classificacao === c.valor);
          return (
            <CartaoIndicador key={c.valor} {...ESTILO_CLASSIFICACAO[c.valor]} rotulo={c.rotulo} ativo={classificacao === c.valor}
              onClick={() => setClassificacao(classificacao === c.valor ? 'TODAS' : c.valor)}
              valor={brl(doTipo.reduce((s, m) => s + m.valor, 0))} detalhe={`${doTipo.length} serviço(s)`} />
          );
        })}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Manutenções ({unidade || '—'})</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Data" />
            <div className="space-y-1">
              <Label>Placa</Label>
              <Input
                list="placas-filtro-manutencao"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="Todas"
                className="w-32 font-mono"
              />
              <datalist id="placas-filtro-manutencao">
                {placas.map((p) => (
                  <option key={p.placa} value={p.placa} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Classificação</Label>
              <Select value={classificacao} onValueChange={setClassificacao}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {CLASSIFICACOES_MANUTENCAO.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Serviço ou fornecedor</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="w-56" />
            </div>
            {filtrosAtivos && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPlaca('');
                  setBusca('');
                  setClassificacao('TODAS');
                }}
              >
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
            <Button type="button" variant="ghost" title="Recarregar" disabled={!unidade} onClick={() => void carregar()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunas}
            data={linhas}
            loading={carregando}
            hideSearch
            emptyMessage={filtrosAtivos ? 'Nenhuma manutenção com esses filtros.' : 'Nenhuma manutenção no período.'}
          />
        </CardContent>
      </Card>

      <ComparativoFornecedores unidade={unidade} periodo={textoPeriodo(de, ate)} itens={semClassificacao} carregando={carregando} />

      <FormManutencao
        unidade={unidade}
        placas={placas}
        registro={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          void carregar();
        }}
      />

      <DialogExclusao
        aberto={!!excluindo}
        titulo="Excluir manutenção"
        descricao={
          excluindo
            ? `${excluindo.placa} · ${dataBr(excluindo.data_manutencao)} · ${excluindo.descricao} · ${brl(excluindo.valor)}`
            : ''
        }
        onCancelar={() => setExcluindo(null)}
        onConfirmar={async (motivo) => {
          if (!excluindo) return;
          try {
            await excluirManutencao(excluindo.id, motivo);
            toast.success('Manutenção excluída.');
            setExcluindo(null);
            void carregar();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
          }
        }}
      />
    </div>
  );
}

type LinhaComparativo = {
  chave: string;
  fornecedor: string;
  cnpj: string;
  servicos: number;
  quantidade: number;
  total: number;
  menor: number;
  maior: number;
  ultimaData: string;
  ultimoUnitario: number;
  medio: number;
};

/** Um fornecedor por linha (CNPJ, ou o nome quando não há CNPJ), do mais barato por unidade ao mais caro. */
function compararFornecedores(itens: FrotaManutencao[]): LinhaComparativo[] {
  const mapa = new Map<string, LinhaComparativo>();
  for (const m of itens) {
    const chave = m.fornecedor_cnpj || m.fornecedor.trim().toUpperCase();
    const unitario = m.valor / qtd(m);
    const l = mapa.get(chave) ?? {
      chave, fornecedor: m.fornecedor, cnpj: m.fornecedor_cnpj ?? '', servicos: 0, quantidade: 0, total: 0,
      menor: unitario, maior: unitario, ultimaData: '', ultimoUnitario: unitario, medio: 0,
    };
    l.servicos += 1;
    l.quantidade += qtd(m);
    l.total += m.valor;
    l.menor = Math.min(l.menor, unitario);
    l.maior = Math.max(l.maior, unitario);
    if (m.data_manutencao >= l.ultimaData) {
      l.ultimaData = m.data_manutencao;
      l.ultimoUnitario = unitario;
    }
    mapa.set(chave, l);
  }
  return [...mapa.values()].map((l) => ({ ...l, medio: l.total / l.quantidade })).sort((a, b) => a.medio - b.medio);
}

const acimaDoMaisBarato = (l: LinhaComparativo, maisBarato: LinhaComparativo) =>
  maisBarato.medio > 0 ? ((l.medio - maisBarato.medio) / maisBarato.medio) * 100 : 0;

function ComparativoFornecedores({ unidade, periodo, itens, carregando }: {
  unidade: string;
  periodo: string;
  itens: FrotaManutencao[];
  carregando: boolean;
}) {
  const [escolhido, setEscolhido] = useState('');

  const porServico = useMemo(() => {
    const grupos = new Map<string, FrotaManutencao[]>();
    for (const m of itens) {
      if (!m.servico || m.servico === 'OUTRO') continue;
      grupos.set(m.servico, [...(grupos.get(m.servico) ?? []), m]);
    }
    return SERVICOS_MANUTENCAO.filter((s) => grupos.has(s.valor)).map((s) => {
      const linhas = compararFornecedores(grupos.get(s.valor)!);
      return { ...s, lancamentos: grupos.get(s.valor)!.length, linhas };
    });
  }, [itens]);
  const semTipo = itens.filter((m) => !m.servico);

  const padrao = [...porServico].sort((a, b) => b.linhas.length - a.linhas.length || b.lancamentos - a.lancamentos)[0];
  const atual = porServico.find((s) => s.valor === escolhido) ?? padrao;
  const maisBarato = atual?.linhas[0];

  function montarPdf(): RelatorioFrotaPdf {
    return {
      titulo: 'Comparativo de fornecedores',
      subtitulo: 'Manutenção · mesmo tipo de serviço',
      unidade,
      periodo,
      arquivo: `comparativo-fornecedores-${unidade}-${periodo}`,
      kpis: [
        { rotulo: 'Tipos de serviço', valor: String(porServico.length), detalhe: 'com lançamento no período' },
        { rotulo: 'Comparáveis', valor: String(porServico.filter((s) => s.linhas.length > 1).length), detalhe: 'com 2 ou mais fornecedores' },
        { rotulo: 'Sem tipo', valor: String(semTipo.length), detalhe: 'lançamentos fora do comparativo' },
      ],
      secoes: porServico.map((s) => ({
        titulo: s.rotulo,
        nota: `${s.lancamentos} lançamento(s) · ${s.linhas.length} fornecedor(es) · preço por unidade = valor ÷ quantidade`,
        colunas: [
          { titulo: 'Fornecedor', largura: 54 }, { titulo: 'Serv.', largura: 14, alinhar: 'right' },
          { titulo: 'Qtd.', largura: 14, alinhar: 'right' }, { titulo: 'Médio/un.', largura: 24, alinhar: 'right' },
          { titulo: 'Menor', largura: 22, alinhar: 'right' }, { titulo: 'Maior', largura: 22, alinhar: 'right' },
          { titulo: 'Total', largura: 24, alinhar: 'right' }, { titulo: 'Dif.', largura: 16, alinhar: 'right' },
        ],
        linhas: s.linhas.map((l, i) => [
          { texto: l.fornecedor, sub: l.cnpj || undefined, negrito: i === 0 },
          { texto: String(l.servicos) },
          { texto: numeroBr(l.quantidade) },
          { texto: brl(l.medio), negrito: true, cor: i === 0 && s.linhas.length > 1 ? COR_PDF.ok : undefined },
          { texto: brl(l.menor) },
          { texto: brl(l.maior) },
          { texto: brl(l.total) },
          i === 0
            ? { texto: s.linhas.length > 1 ? 'menor' : '—', cor: COR_PDF.ok }
            : { texto: `+${acimaDoMaisBarato(l, s.linhas[0]).toFixed(0)}%`, cor: COR_PDF.alerta },
        ]),
      })),
    };
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> Comparativo de fornecedores por tipo de serviço
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Preço por unidade (valor ÷ quantidade) de cada fornecedor no mesmo serviço, com o período e os filtros acima.
            </p>
          </div>
          <BotaoPdf rotulo="PDF do comparativo" disabled={!unidade || carregando || porServico.length === 0} montar={montarPdf} />
        </div>
        {porServico.length > 0 && (
          <div className="space-y-1">
            <Label>Tipo de serviço</Label>
            <Select value={atual?.valor ?? ''} onValueChange={setEscolhido}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {porServico.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo} · {s.linhas.length} fornecedor(es)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!atual || !maisBarato ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma manutenção com tipo de serviço no período. As novas já pedem o tipo; as antigas entram aqui quando forem
            alteradas e o tipo for escolhido.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left font-medium">Fornecedor</th>
                  <th className="p-2 text-right font-medium">Serviços</th>
                  <th className="p-2 text-right font-medium">Qtd.</th>
                  <th className="p-2 text-right font-medium">Preço médio/un.</th>
                  <th className="p-2 text-right font-medium">Menor</th>
                  <th className="p-2 text-right font-medium">Maior</th>
                  <th className="p-2 text-right font-medium">Último</th>
                  <th className="p-2 text-right font-medium">Total gasto</th>
                  <th className="p-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {atual.linhas.map((l, i) => (
                  <tr key={l.chave} className="border-t">
                    <td className="p-2">
                      <p className="font-medium">{l.fornecedor}</p>
                      {l.cnpj && <p className="text-xs text-muted-foreground">{formatarDocumento(l.cnpj)}</p>}
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
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
                            Mais barato
                          </Badge>
                        ) : (
                          '—'
                        )
                      ) : (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          +{acimaDoMaisBarato(l, maisBarato).toFixed(0)}% ({brl(l.medio - maisBarato.medio)}/un.)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {atual && atual.linhas.length === 1 && (
          <p className="text-xs text-muted-foreground">Só um fornecedor fez este serviço no período; amplie o período para comparar.</p>
        )}
        {semTipo.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {semTipo.length} lançamento(s) sem tipo de serviço ({brl(semTipo.reduce((s, m) => s + m.valor, 0))}) ficam fora do
            comparativo. Use o lápis na tabela e escolha o tipo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const FORM_VAZIO = {
  placa: '',
  data_manutencao: '',
  data_conclusao: '',
  classificacao: 'PREVENTIVA',
  descricao: '',
  fornecedor: '',
  fornecedor_cnpj: '',
  valor: '',
  servico: '',
  quantidade: '1',
  motivo: '',
};

function formatarDocumento(v?: string | null) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}

/** Busca o fornecedor no FCFO do RM da unidade; o nome e o CNPJ gravados vêm do cadastro escolhido. */
function SeletorFornecedorRm({ unidade, nome, disabled, onEscolher }: {
  unidade: string;
  nome: string;
  disabled?: boolean;
  onEscolher: (f: { nome: string; cnpj: string }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<FornecedorRm[]>([]);
  const [buscando, setBuscando] = useState(false);
  const termo = busca.trim();

  useEffect(() => {
    if (!aberto || termo.length < 2) {
      setItens([]);
      return;
    }
    let cancelado = false;
    const espera = setTimeout(() => {
      setBuscando(true);
      buscarFornecedoresRm(unidade, termo)
        .then((r) => !cancelado && setItens(r))
        .catch((e) => !cancelado && toast.error(e instanceof Error ? e.message : 'Falha ao buscar fornecedores no RM.'))
        .finally(() => !cancelado && setBuscando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [aberto, termo, unidade]);

  const nomeExibido = (f: FornecedorRm) => f.nome_fantasia?.trim() || f.nome;

  return (
    <Popover modal open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={disabled}>
          <span className={`truncate ${nome ? '' : 'text-muted-foreground'}`}>{nome || 'Buscar fornecedor no RM'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-(--radix-popover-trigger-width) min-w-80 pointer-events-auto z-[9999]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nome, código ou CNPJ" value={busca} onValueChange={setBusca} />
          <CommandList>
            {buscando && itens.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {termo.length < 2 ? 'Digite pelo menos 2 letras.' : 'Nenhum fornecedor ativo encontrado no RM.'}
              </CommandEmpty>
            )}
            <CommandGroup>
              {itens.map((f) => (
                <CommandItem
                  key={f.codcfo}
                  value={f.codcfo}
                  onSelect={() => {
                    onEscolher({ nome: nomeExibido(f), cnpj: f.cnpj });
                    setAberto(false);
                  }}
                >
                  <div className="min-w-0 leading-tight">
                    <p className="truncate">{nomeExibido(f)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[f.codcfo, nomeExibido(f) !== f.nome && f.nome, formatarDocumento(f.cnpj), f.cidade].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FormManutencao({ unidade, placas, registro, onFechar, onSalvo }: {
  unidade: string;
  placas: FrotaPlaca[];
  registro: FrotaManutencao | 'novo' | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const edicao = registro && registro !== 'novo' ? registro : null;

  useEffect(() => {
    if (!registro) return;
    setArquivo(null);
    setForm(
      edicao
        ? {
            placa: edicao.placa,
            data_manutencao: edicao.data_manutencao.slice(0, 10),
            data_conclusao: edicao.data_conclusao?.slice(0, 10) ?? '',
            classificacao: edicao.classificacao,
            descricao: edicao.descricao,
            fornecedor: edicao.fornecedor,
            fornecedor_cnpj: edicao.fornecedor_cnpj ?? '',
            valor: valorParaCampo(edicao.valor),
            servico: edicao.servico ?? '',
            quantidade: String(qtd(edicao)).replace('.', ','),
            motivo: '',
          }
        : { ...FORM_VAZIO, data_manutencao: isoHoje() }
    );
  }, [registro, edicao]);

  const set = (campo: keyof typeof FORM_VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));

  async function salvar() {
    const placa = normalizarPlaca(form.placa);
    const valor = valorParaApi(form.valor);
    if (!placa) return void toast.error('Informe a placa.');
    if (!form.data_manutencao) return void toast.error('Informe a data da manutenção.');
    if (form.data_conclusao && form.data_conclusao < form.data_manutencao)
      return void toast.error('A data em que foi feita não pode ser antes da data da manutenção.');
    const quantidade = valorParaApi(form.quantidade || '1');
    if (!form.servico) return void toast.error('Escolha o tipo de serviço.');
    if (!quantidade || Number(quantidade) <= 0 || Number(quantidade) > 9999)
      return void toast.error('Quantidade inválida (de 1 a 9.999).');
    if (form.descricao.trim().length < 3) return void toast.error('Descreva o serviço.');
    if (form.fornecedor.trim().length < 2) return void toast.error('Escolha o fornecedor no cadastro do RM.');
    if (!valor || Number(valor) <= 0) return void toast.error('Informe o valor gasto.');
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) return void toast.error(`Arquivo maior que ${MAX_MB} MB.`);

    setSalvando(true);
    try {
      await salvarManutencao(
        {
          unidade,
          placa,
          data_manutencao: form.data_manutencao,
          data_conclusao: form.data_conclusao || undefined,
          classificacao: form.classificacao,
          descricao: form.descricao.trim(),
          fornecedor: form.fornecedor.trim(),
          fornecedor_cnpj: form.fornecedor_cnpj.replace(/\D/g, '') || undefined,
          valor,
          servico: form.servico,
          quantidade,
          motivo: form.motivo.trim() || undefined,
          arquivo,
        },
        edicao?.id
      );
      toast.success(edicao ? 'Manutenção alterada.' : `Manutenção da placa ${placa} registrada.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a manutenção.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!registro} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edicao ? `Alterar manutenção · ${edicao.placa}` : 'Nova manutenção'}</DialogTitle>
          <DialogDescription>
            {unidade} · o registro e o anexo ficam no PaperSign; quem gravou e o que mudou ficam no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Placa</Label>
            <Input
              list="placas-form-manutencao"
              value={form.placa}
              onChange={(e) => set('placa')(e.target.value.toUpperCase())}
              className="font-mono"
              maxLength={8}
              disabled={salvando}
            />
            <datalist id="placas-form-manutencao">
              {placas
                .filter((p) => p.ativo)
                .map((p) => (
                  <option key={p.placa} value={p.placa}>
                    {[p.frota, p.modelo].filter(Boolean).join(' · ')}
                  </option>
                ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Classificação</Label>
            <Select value={form.classificacao} onValueChange={set('classificacao')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICACOES_MANUTENCAO.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data da manutenção</Label>
            <Input type="date" value={form.data_manutencao} onChange={(e) => set('data_manutencao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Feita em (vazio = em andamento)</Label>
            <Input type="date" value={form.data_conclusao} onChange={(e) => set('data_conclusao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Tipo de serviço (usado no comparativo)</Label>
            <Select value={form.servico} onValueChange={set('servico')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o tipo" />
              </SelectTrigger>
              <SelectContent>
                {SERVICOS_MANUTENCAO.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quantidade (ex.: 4 pneus)</Label>
            <Input
              value={form.quantidade}
              inputMode="decimal"
              onChange={(e) => set('quantidade')(e.target.value)}
              disabled={salvando}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Descrição do serviço</Label>
            <Textarea
              value={form.descricao}
              maxLength={500}
              rows={2}
              placeholder="Ex.: troca de óleo e filtros, revisão dos 20.000 km"
              onChange={(e) => set('descricao')(e.target.value)}
              disabled={salvando}
            />
          </div>
          <div className="space-y-1">
            <Label>Fornecedor (cadastro do RM)</Label>
            <SeletorFornecedorRm
              unidade={unidade}
              nome={form.fornecedor}
              disabled={salvando}
              onEscolher={(f) => setForm((atual) => ({ ...atual, fornecedor: f.nome, fornecedor_cnpj: f.cnpj }))}
            />
          </div>
          <div className="space-y-1">
            <Label>CNPJ/CPF do fornecedor</Label>
            <Input value={formatarDocumento(form.fornecedor_cnpj) || '—'} readOnly disabled className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Valor gasto (R$)</Label>
            <Input
              value={form.valor}
              inputMode="decimal"
              placeholder="0,00"
              onChange={(e) => set('valor')(e.target.value)}
              disabled={salvando}
            />
          </div>
          <div className="space-y-1">
            <Label>{edicao?.nome_arquivo ? 'Trocar anexo (opcional)' : 'Nota / orçamento (opcional)'}</Label>
            <Input
              ref={inputArquivo}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              disabled={salvando}
            />
            {edicao?.nome_arquivo && !arquivo && (
              <p className="text-xs text-muted-foreground truncate">Atual: {edicao.nome_arquivo}</p>
            )}
          </div>
          {edicao && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo da alteração (opcional)</Label>
              <Input value={form.motivo} maxLength={500} onChange={(e) => set('motivo')(e.target.value)} disabled={salvando} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {edicao ? 'Salvar alteração' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
