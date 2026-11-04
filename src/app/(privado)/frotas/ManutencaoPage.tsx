'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  CircleDot,
  Coins,
  FileText,
  ListChecks,
  Loader2,
  MapPin,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  anexoManutencao,
  CLASSIFICACOES_MANUTENCAO,
  excluirManutencao,
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
  inicioHistoricoManutencao,
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
import { graficoPdfLista } from './graficosFrotas';
import { dataBr } from './VeiculoDialog';
import ComparativosManutencao from './manutencao/ComparativosManutencao';
import LotacaoPlacas from './manutencao/LotacaoPlacas';
import NotasManutencao from './manutencao/NotasManutencao';
import {
  formatarDocumento,
  numeroBr,
  qtd,
  rotuloClassificacao,
  rotuloServico,
  SeletorFornecedorRm,
} from './manutencao/comumManutencao';

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

/** Quadros do topo: as 4 classificações de sempre; as demais somam no total. */
const CARTOES_CLASSIFICACAO = CLASSIFICACOES_MANUTENCAO.filter((c) => c.valor in ESTILO_CLASSIFICACAO);

type SubAba = 'notas' | 'lancamentos' | 'comparativos' | 'lotacao';

/** Aba Manutenção: notas fiscais (substitui a planilha), lançamentos por placa, comparativos e lotação das placas. */
export default function ManutencaoPage() {
  const sel = useUnidadeFrotas();
  const [subaba, setSubaba] = useState<SubAba>('notas');
  // Cada sub-aba só monta na primeira vez que é aberta; ao salvar uma nota, os lançamentos/comparativos recarregam.
  const [abertas, setAbertas] = useState<Set<SubAba>>(() => new Set(['notas']));
  const [versao, setVersao] = useState(0);
  const mudou = useCallback(() => setVersao((v) => v + 1), []);

  function trocar(v: string) {
    const a = v as SubAba;
    setSubaba(a);
    setAbertas((s) => (s.has(a) ? s : new Set(s).add(a)));
  }

  const conteudo = (valor: SubAba, pagina: React.ReactNode) => (
    <TabsContent value={valor} forceMount className="data-[state=inactive]:hidden">
      {abertas.has(valor) ? pagina : null}
    </TabsContent>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Manutenção
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Notas e pedidos da frota, serviços por placa e comparativos por tipo de serviço, fornecedor e região. O fornecedor
            vem sempre do cadastro do RM.
          </p>
        </div>
        <SeletorUnidade {...sel} />
      </div>
      <Tabs value={subaba} onValueChange={trocar} className="space-y-4">
        <TabsList className="flex h-auto max-w-full flex-wrap gap-1">
          <TabsTrigger value="notas" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4 shrink-0" /> Notas e pedidos
          </TabsTrigger>
          <TabsTrigger value="lancamentos" className="gap-1.5 text-xs sm:text-sm">
            <ListChecks className="h-4 w-4 shrink-0" /> Lançamentos por placa
          </TabsTrigger>
          <TabsTrigger value="comparativos" className="gap-1.5 text-xs sm:text-sm">
            <Scale className="h-4 w-4 shrink-0" /> Comparativos
          </TabsTrigger>
          <TabsTrigger value="lotacao" className="gap-1.5 text-xs sm:text-sm">
            <MapPin className="h-4 w-4 shrink-0" /> Lotação das placas
          </TabsTrigger>
        </TabsList>
        {conteudo('notas', <NotasManutencao unidade={sel.unidade} onMudou={mudou} />)}
        {conteudo('lancamentos', <LancamentosManutencao unidade={sel.unidade} versao={versao} />)}
        {conteudo('comparativos', (
          <ComparativosManutencao unidade={sel.unidade} podeTrocarUnidade={sel.podeTrocarUnidade} versao={versao} />
        ))}
        {conteudo('lotacao', <LotacaoPlacas unidade={sel.unidade} onMudou={mudou} />)}
      </Tabs>
    </div>
  );
}

function LancamentosManutencao({ unidade, versao }: { unidade: string; versao: number }) {
  const placas = usePlacasFrota(unidade);

  const [itens, setItens] = useState<FrotaManutencao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioHistoricoManutencao());
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
  }, [carregar, versao]);

  // Placa e busca valem para os quadros; classificação filtra tabela e o total em destaque.
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
  const totalQuadros = semClassificacao.reduce((s, m) => s + m.valor, 0);
  const periodoLabel = textoPeriodo(de, ate);
  const filtrosAtivos = !!placa || !!busca || classificacao !== 'TODAS';
  const valorIndicador = (v: number) => (carregando ? '…' : brl(v));

  const colunas: ColumnDef<FrotaManutencao>[] = useMemo(
    () => [
      { id: 'data', header: 'Data', cell: ({ row }) => dataBr(row.original.data_manutencao) },
      {
        id: 'placa',
        header: 'Placa',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-mono font-medium">{row.original.placa}</p>
            {row.original.regiao && <p className="text-xs text-muted-foreground">{row.original.regiao}</p>}
          </div>
        ),
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
            <p className="text-xs text-muted-foreground">
              {[row.original.numero_nf && `NF ${row.original.numero_nf}`, row.original.fornecedor_cnpj].filter(Boolean).join(' · ')}
            </p>
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
        cell: ({ row }) => {
          const daNota = row.original.id_nota != null;
          const dica = daNota ? `Item da NF ${row.original.numero_nf ?? ''}: altere pela sub-aba Notas e pedidos` : '';
          return (
          <div className="flex justify-end">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={dica || 'Alterar'} disabled={daNota}
              onClick={() => setEditando(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title={dica || 'Excluir'}
              disabled={daNota} onClick={() => setExcluindo(row.original)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          );
        },
      },
    ],
    [total]
  );

  function montarPdf(): RelatorioFrotaPdf {
    const doTipo = (c: string) => semClassificacao.filter((m) => m.classificacao === c);
    const classItens = CARTOES_CLASSIFICACAO.map((c) => ({
      valor: c.valor,
      rotulo: c.rotulo,
      total: doTipo(c.valor).reduce((s, m) => s + m.valor, 0),
    })).filter((x) => x.total > 0);
    const porServ = new Map<string, number>();
    for (const m of semClassificacao) {
      const s = m.servico && m.servico !== 'OUTRO' ? m.servico : 'SEM_TIPO';
      porServ.set(s, (porServ.get(s) ?? 0) + m.valor);
    }
    const servItens = [...porServ.entries()].map(([servico, total]) => ({ servico, total }));
    return {
      titulo: 'Manutenções',
      subtitulo: 'Gestão de frotas',
      unidade,
      periodo: textoPeriodo(de, ate),
      arquivo: `manutencoes-${unidade}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      graficos: [
        graficoPdfLista('Gasto por classificação', classItens, (x) => x.valor, (x) => x.rotulo, (x) => x.total, brl),
        graficoPdfLista(
          'Gasto por tipo de serviço',
          servItens,
          (x) => x.servico,
          (x) => (x.servico === 'SEM_TIPO' ? 'Sem tipo' : rotuloServico(x.servico)),
          (x) => x.total,
          brl
        ),
      ],
      kpis: [
        { rotulo: 'Total no período', valor: brl(semClassificacao.reduce((s, m) => s + m.valor, 0)), detalhe: `${semClassificacao.length} serviço(s)` },
        ...CARTOES_CLASSIFICACAO.map((c) => ({
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
        <p className="text-muted-foreground text-sm max-w-3xl">
          Um serviço por placa. Os itens das notas aparecem aqui e só mudam pela nota; use “Lançamento avulso” para um serviço
          sem nota.
        </p>
        <div className="flex items-end gap-3">
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" variant="outline" onClick={() => setEditando('novo')} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Lançamento avulso
          </Button>
        </div>
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
            <Button type="button" variant="ghost" title="Recarregar" disabled={!unidade || carregando} onClick={() => void carregar()}>
              <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Período: {periodoLabel}. Ao mudar as datas, a lista e os números abaixo recarregam automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <CartaoIndicador icone={Coins} tom="verde" destaque rotulo="Total no período" ativo={classificacao === 'TODAS'}
              onClick={() => setClassificacao('TODAS')}
              valor={valorIndicador(classificacao === 'TODAS' ? totalQuadros : total)}
              detalhe={carregando ? 'Carregando…' : `${classificacao === 'TODAS' ? semClassificacao.length : linhas.length} serviço(s)`} />
            {CARTOES_CLASSIFICACAO.map((c) => {
              const doTipo = semClassificacao.filter((m) => m.classificacao === c.valor);
              return (
                <CartaoIndicador key={c.valor} {...ESTILO_CLASSIFICACAO[c.valor]} rotulo={c.rotulo} ativo={classificacao === c.valor}
                  onClick={() => setClassificacao(classificacao === c.valor ? 'TODAS' : c.valor)}
                  valor={valorIndicador(doTipo.reduce((s, m) => s + m.valor, 0))}
                  detalhe={carregando ? 'Carregando…' : `${doTipo.length} serviço(s)`} />
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-md border">
          <DataTable
            columns={colunas}
            data={linhas}
            loading={carregando}
            hideSearch
            emptyMessage={filtrosAtivos ? 'Nenhuma manutenção com esses filtros.' : 'Nenhuma manutenção no período.'}
          />
          </div>
        </CardContent>
      </Card>

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
