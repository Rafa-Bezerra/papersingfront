'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Coins,
  FileDown,
  FileUp,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Split,
  Trash2,
  X,
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
import { Textarea } from '@/components/ui/textarea';
import { baixarModeloImportacaoNotas, parseArquivoImportacaoNotas } from '@/app/(privado)/frotas/manutencao/importacaoNotasPlanilha';
import {
  alterarStatusNota,
  anexoNota,
  ArquivoImportacaoNotas,
  CLASSIFICACOES_DESPESA,
  CLASSIFICACOES_MANUTENCAO,
  excluirNota,
  FrotaNota,
  FrotaPlaca,
  importarNotasPlanilha,
  listarNotas,
  normalizarPlaca,
  ResumoImportacaoNotas,
  salvarNota,
  SERVICOS_MANUTENCAO,
  STATUS_NOTA,
  TIPOS_NOTA,
} from '@/services/frotasService';
import { graficoPdfLista } from '../graficosFrotas';
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
  textoFiltros,
  textoPeriodo,
  usePlacasFrota,
  valorParaApi,
  valorParaCampo,
} from '../comum';
import { formatarDocumento, rotuloClassificacao, SeletorFornecedorRm } from './comumManutencao';
import { dataBr } from '../VeiculoDialog';

const MAX_MB = 10;

const COR_STATUS: Record<string, string> = {
  LANCADA: 'border-sky-500 text-sky-700 dark:text-sky-400',
  ENVIADA_BAIXA: 'border-violet-500 text-violet-700 dark:text-violet-400',
  CONCLUIDA: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
  PENDENTE: 'border-amber-500 text-amber-700 dark:text-amber-400',
  CANCELADA: 'border-slate-400 text-slate-500',
};

export const rotuloStatusNota = (s: string) => STATUS_NOTA.find((x) => x.valor === s)?.rotulo ?? s;
const rotuloTipo = (t?: string | null) => TIPOS_NOTA.find((x) => x.valor === t)?.rotulo ?? '';
const emAberto = (n: FrotaNota) => n.status !== 'CONCLUIDA' && n.status !== 'CANCELADA';

type FiltroRapido = 'TODAS' | 'LANCADA' | 'ENVIADA_BAIXA' | 'PENDENTE' | 'VENCENDO' | 'VENCIDAS' | 'CONCLUIDA' | 'SEM_ITENS';

export default function NotasManutencao({ unidade, onMudou }: { unidade: string; onMudou: () => void }) {
  const placas = usePlacasFrota(unidade);
  const [notas, setNotas] = useState<FrotaNota[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioHistoricoManutencao());
  const [ate, setAte] = useState(isoHoje());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroRapido>('TODAS');
  const [editando, setEditando] = useState<FrotaNota | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<FrotaNota | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState<{ nota: FrotaNota; status: string } | null>(null);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    try {
      setNotas(await listarNotas(unidade, de || undefined, ate || undefined));
    } catch (e) {
      setNotas([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as notas.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const recarregarTudo = useCallback(() => {
    void carregar();
    onMudou();
  }, [carregar, onMudou]);

  const hoje = isoHoje();
  const em7 = isoHoje(7);
  const vencida = (n: FrotaNota) => emAberto(n) && !!n.data_vencimento && n.data_vencimento.slice(0, 10) < hoje;
  const vencendo = (n: FrotaNota) =>
    emAberto(n) && !!n.data_vencimento && n.data_vencimento.slice(0, 10) >= hoje && n.data_vencimento.slice(0, 10) <= em7;

  const buscadas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const p = normalizarPlaca(busca);
    if (!b) return notas;
    return notas.filter(
      (n) =>
        `${n.numero_nf} ${n.pedido ?? ''} ${n.fornecedor ?? ''} ${n.fornecedor_cnpj ?? ''} ${n.observacao ?? ''} ${n.responsavel ?? ''}`
          .toLowerCase()
          .includes(b) || (p.length >= 3 && n.itens.some((i) => i.placa.includes(p)))
    );
  }, [notas, busca]);

  const linhas = useMemo(() => {
    switch (filtro) {
      case 'TODAS':
        return buscadas;
      case 'VENCENDO':
        return buscadas.filter(vencendo);
      case 'VENCIDAS':
        return buscadas.filter(vencida);
      case 'SEM_ITENS':
        return buscadas.filter((n) => n.status !== 'CANCELADA' && n.itens.length === 0);
      default:
        return buscadas.filter((n) => n.status === filtro);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscadas, filtro, hoje, em7]);
  const total = linhas.reduce((s, n) => s + n.valor_total, 0);
  const conta = (f: (n: FrotaNota) => boolean) => buscadas.filter(f);
  const alternar = (f: FiltroRapido) => setFiltro((atual) => (atual === f ? 'TODAS' : f));

  const colunas: ColumnDef<FrotaNota>[] = useMemo(
    () => [
      { id: 'entrada', header: 'Entrada', cell: ({ row }) => dataBr(row.original.data_entrada) },
      {
        id: 'nf',
        header: 'NF / pedido',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium">NF {row.original.numero_nf}</p>
            <p className="text-xs text-muted-foreground">
              {[rotuloTipo(row.original.tipo_nota), row.original.pedido && `Pedido ${row.original.pedido}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        ),
      },
      {
        id: 'fornecedor',
        header: 'Fornecedor (RM)',
        cell: ({ row }) =>
          row.original.fornecedor ? (
            <div className="max-w-64 leading-tight">
              <p className="truncate" title={row.original.fornecedor}>{row.original.fornecedor}</p>
              <p className="text-xs text-muted-foreground">
                {[row.original.fornecedor_codcfo, formatarDocumento(row.original.fornecedor_cnpj)].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : (
            <span className="text-xs text-amber-700 dark:text-amber-400">Escolha o fornecedor do RM</span>
          ),
      },
      {
        id: 'itens',
        header: 'Placas e serviços',
        cell: ({ row }) => {
          const itens = row.original.itens;
          if (itens.length === 0)
            return <span className="text-xs text-amber-700 dark:text-amber-400">Sem itens (fora dos comparativos)</span>;
          const placasNota = [...new Set(itens.map((i) => i.placa))];
          const classes = [...new Set(itens.map((i) => rotuloClassificacao(i.classificacao)))];
          return (
            <div className="max-w-64 leading-tight">
              <p className="font-mono text-xs">{placasNota.join(', ')}</p>
              <p className="truncate text-xs text-muted-foreground">{classes.join(', ')}</p>
            </div>
          );
        },
      },
      {
        id: 'vencimento',
        header: 'Vencimento',
        cell: ({ row }) => {
          const n = row.original;
          if (!n.data_vencimento) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={vencida(n) ? 'font-medium text-red-600' : vencendo(n) ? 'font-medium text-amber-600' : ''}>
              {dataBr(n.data_vencimento)}
            </span>
          );
        },
      },
      {
        id: 'valor',
        header: () => <div className="text-right">Valor</div>,
        cell: ({ row }) => <div className="text-right font-medium">{brl(row.original.valor_total)}</div>,
        footer: () => <div className="text-right font-semibold">{brl(total)}</div>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="space-y-1">
            <Select value={row.original.status} onValueChange={(v) => v !== row.original.status && setMudandoStatus({ nota: row.original, status: v })}>
              <SelectTrigger className={`h-7 w-44 text-xs ${COR_STATUS[row.original.status] ?? ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_NOTA.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {row.original.motivo_status && (
              <p className="max-w-44 truncate text-xs text-muted-foreground" title={row.original.motivo_status}>
                {row.original.motivo_status}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'anexo',
        header: 'Anexo',
        cell: ({ row }) => (
          <BotoesAnexo
            nome={row.original.nome_arquivo}
            abrir={() => anexoNota(row.original.id)}
            baixar={() => anexoNota(row.original.id, row.original.nome_arquivo)}
          />
        ),
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            {row.original.origem === 'PLANILHA' && (
              <Badge variant="outline" className="mr-1 text-[10px]" title={`Linha ${row.original.origem_linha ?? ''} da planilha`}>
                planilha
              </Badge>
            )}
            {row.original.origem === 'RM' && (
              <Badge variant="outline" className="mr-1 text-[10px]" title="Trazida do pedido 1.1.36 do RM">
                RM
              </Badge>
            )}
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Alterar" onClick={() => setEditando(row.original)}>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, hoje, em7]
  );

  function montarPdf(): RelatorioFrotaPdf {
    const porStatus = new Map<string, number>();
    for (const n of linhas) porStatus.set(n.status, (porStatus.get(n.status) ?? 0) + n.valor_total);
    const statusItens = [...porStatus.entries()].map(([status, valor]) => ({ status, valor }));
    const porForn = new Map<string, number>();
    for (const n of linhas) {
      const f = n.fornecedor?.trim() || 'Sem fornecedor';
      porForn.set(f, (porForn.get(f) ?? 0) + n.valor_total);
    }
    const fornItens = [...porForn.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    return {
      titulo: 'Notas e pedidos da frota',
      subtitulo: 'Manutenção · controle de NFs',
      unidade,
      periodo: textoPeriodo(de, ate),
      arquivo: `notas-frota-${unidade}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      graficos: [
        graficoPdfLista('Valor por status', statusItens, (x) => x.status, (x) => rotuloStatusNota(x.status), (x) => x.valor, brl),
        graficoPdfLista('Valor por fornecedor', fornItens, (x) => x.nome, (x) => x.nome, (x) => x.valor, brl),
      ],
      kpis: [
        { rotulo: 'Notas', valor: String(linhas.length), detalhe: brl(total) },
        { rotulo: 'Em aberto', valor: String(linhas.filter(emAberto).length), detalhe: 'lançadas, enviadas e pendentes' },
        { rotulo: 'Vencidas', valor: String(linhas.filter(vencida).length), detalhe: 'em aberto com vencimento passado' },
        { rotulo: 'Sem itens', valor: String(linhas.filter((n) => n.itens.length === 0).length), detalhe: 'fora dos comparativos' },
      ],
      secoes: [{
        titulo: 'Notas',
        nota: textoFiltros([['Status', filtro !== 'TODAS' && filtro], ['Busca', busca.trim()]]),
        colunas: [
          { titulo: 'Entrada', largura: 18 }, { titulo: 'NF / pedido', largura: 28 }, { titulo: 'Fornecedor / placas', largura: 70 },
          { titulo: 'Venc.', largura: 18 }, { titulo: 'Status', largura: 26 }, { titulo: 'Valor', largura: 24, alinhar: 'right' },
        ],
        linhas: linhas.map((n) => [
          { texto: dataBr(n.data_entrada) },
          { texto: `NF ${n.numero_nf}`, sub: n.pedido ? `Pedido ${n.pedido}` : undefined, negrito: true },
          { texto: n.fornecedor ?? 'Sem fornecedor do RM', sub: [...new Set(n.itens.map((i) => i.placa))].join(', ') || 'sem itens' },
          vencida(n) ? { texto: dataBr(n.data_vencimento), cor: COR_PDF.perigo } : { texto: dataBr(n.data_vencimento) },
          { texto: rotuloStatusNota(n.status), cor: n.status === 'PENDENTE' ? COR_PDF.alerta : n.status === 'CONCLUIDA' ? COR_PDF.ok : undefined },
          { texto: brl(n.valor_total), negrito: true },
        ]),
      }],
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-muted-foreground text-sm max-w-3xl">
          Controle das NFs e pedidos da frota (a planilha “Controle de NFs e pedidos”). Cada nota tem o fornecedor do RM e os itens
          por placa, que alimentam os lançamentos e os comparativos.
        </p>
        <div className="flex items-end gap-3">
          <Button type="button" variant="outline" onClick={() => setImportando(true)} disabled={!unidade}>
            <FileUp className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" onClick={() => setEditando('novo')} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Nova nota
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <CartaoIndicador icone={Coins} tom="verde" destaque rotulo="Total no período" ativo={filtro === 'TODAS'}
          onClick={() => setFiltro('TODAS')} valor={brl(buscadas.reduce((s, n) => s + n.valor_total, 0))} detalhe={`${buscadas.length} nota(s)`} />
        <CartaoIndicador icone={Clock} tom="azul" rotulo="Lançadas" ativo={filtro === 'LANCADA'} onClick={() => alternar('LANCADA')}
          valor={conta((n) => n.status === 'LANCADA').length} />
        <CartaoIndicador icone={Mail} tom="roxo" rotulo="Enviadas para baixa" ativo={filtro === 'ENVIADA_BAIXA'}
          onClick={() => alternar('ENVIADA_BAIXA')} valor={conta((n) => n.status === 'ENVIADA_BAIXA').length} />
        <CartaoIndicador icone={AlertTriangle} tom="ambar" rotulo="Pendentes" ativo={filtro === 'PENDENTE'} onClick={() => alternar('PENDENTE')}
          valor={conta((n) => n.status === 'PENDENTE').length} detalhe="nota sem placa, fornecedor fora do RM..." />
        <CartaoIndicador icone={CalendarClock} tom="laranja" rotulo="Vencendo em 7 dias" ativo={filtro === 'VENCENDO'}
          onClick={() => alternar('VENCENDO')} valor={conta(vencendo).length} />
        <CartaoIndicador icone={AlertTriangle} tom="vermelho" rotulo="Vencidas em aberto" ativo={filtro === 'VENCIDAS'}
          onClick={() => alternar('VENCIDAS')} valor={conta(vencida).length} corValor={conta(vencida).length ? 'text-red-600' : ''} />
        <CartaoIndicador icone={CheckCircle2} tom="cinza" rotulo="Sem itens" ativo={filtro === 'SEM_ITENS'} onClick={() => alternar('SEM_ITENS')}
          valor={conta((n) => n.status !== 'CANCELADA' && n.itens.length === 0).length} detalhe="não entram nos comparativos" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Notas ({unidade || '—'})</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Entrada" />
            <div className="space-y-1">
              <Label>NF, pedido, fornecedor ou placa</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="w-full max-w-xs sm:w-64" />
            </div>
            {(busca || filtro !== 'TODAS') && (
              <Button type="button" variant="ghost" onClick={() => { setBusca(''); setFiltro('TODAS'); }}>
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
            <Button type="button" variant="ghost" title="Recarregar" disabled={!unidade} onClick={() => void carregar()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <DataTable columns={colunas} data={linhas} loading={carregando} hideSearch
              emptyMessage={busca || filtro !== 'TODAS' ? 'Nenhuma nota com esses filtros.' : 'Nenhuma nota no período.'} />
          </div>
        </CardContent>
      </Card>

      <FormNota unidade={unidade} placas={placas} registro={editando} onFechar={() => setEditando(null)}
        onSalvo={() => { setEditando(null); recarregarTudo(); }} />

      <DialogStatus pedido={mudandoStatus} onFechar={() => setMudandoStatus(null)}
        onSalvo={() => { setMudandoStatus(null); recarregarTudo(); }} />

      <ImportarPlanilha unidade={unidade} aberto={importando} onFechar={() => setImportando(false)} onImportado={recarregarTudo} />

      <DialogExclusao
        aberto={!!excluindo}
        titulo="Excluir nota"
        descricao={excluindo ? `NF ${excluindo.numero_nf} · ${excluindo.fornecedor ?? ''} · ${brl(excluindo.valor_total)} (os itens saem junto)` : ''}
        onCancelar={() => setExcluindo(null)}
        onConfirmar={async (motivo) => {
          if (!excluindo) return;
          try {
            await excluirNota(excluindo.id, motivo);
            toast.success('Nota excluída.');
            setExcluindo(null);
            recarregarTudo();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
          }
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------- Mudança rápida de status

function DialogStatus({ pedido, onFechar, onSalvo }: {
  pedido: { nota: FrotaNota; status: string } | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const precisaMotivo = pedido?.status === 'PENDENTE' || pedido?.status === 'CANCELADA';

  useEffect(() => {
    if (!pedido) return;
    setMotivo('');
    // Sem motivo a mudança é direta (ex.: Lançada → Enviada para baixa).
    if (pedido.status !== 'PENDENTE' && pedido.status !== 'CANCELADA') void salvar('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  async function salvar(m: string) {
    if (!pedido) return;
    if (precisaMotivo && m.trim().length < 3) return void toast.error('Informe o motivo (mínimo 3 caracteres).');
    setSalvando(true);
    try {
      await alterarStatusNota(pedido.nota.id, pedido.status, m.trim() || undefined);
      toast.success(`NF ${pedido.nota.numero_nf}: ${rotuloStatusNota(pedido.status)}.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao mudar o status.');
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!pedido && precisaMotivo} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pedido ? `NF ${pedido.nota.numero_nf}: ${rotuloStatusNota(pedido.status)}` : ''}</DialogTitle>
          <DialogDescription>Diga o motivo (ex.: nota sem placa, placa fora da frota, valor indevido).</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} disabled={salvando} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar(motivo)} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------- Formulário da nota

type ItemForm = { placa: string; classificacao: string; servico: string; quantidade: string; valor: string; descricao: string };
const ITEM_VAZIO: ItemForm = { placa: '', classificacao: 'CORRETIVA', servico: '', quantidade: '1', valor: '', descricao: '' };

const FORM_VAZIO = {
  numero_nf: '',
  tipo_nota: '',
  pedido: '',
  data_emissao: '',
  data_entrada: '',
  data_vencimento: '',
  valor_total: '',
  fornecedor_codcfo: '',
  fornecedor: '',
  fornecedor_cnpj: '',
  status: 'LANCADA',
  motivo_status: '',
  responsavel: '',
  observacao: '',
  motivo: '',
};

const SEM_TIPO = '-';
const centavos = (texto: string) => Math.round(Number(valorParaApi(texto) || 0) * 100);

/** Texto técnico da importação fica no banco; na tela a observação começa vazia (só uso manual). */
function observacaoNotaFormulario(nota: FrotaNota): string {
  if (nota.origem === 'PLANILHA') return '';
  return nota.observacao ?? '';
}

function FormNota({ unidade, placas, registro, onFechar, onSalvo }: {
  unidade: string;
  placas: FrotaPlaca[];
  registro: FrotaNota | 'novo' | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const edicao = registro && registro !== 'novo' ? registro : null;

  useEffect(() => {
    if (!registro) return;
    setArquivo(null);
    if (edicao) {
      setForm({
        numero_nf: edicao.numero_nf,
        tipo_nota: edicao.tipo_nota ?? '',
        pedido: edicao.pedido ?? '',
        data_emissao: edicao.data_emissao?.slice(0, 10) ?? '',
        data_entrada: edicao.data_entrada.slice(0, 10),
        data_vencimento: edicao.data_vencimento?.slice(0, 10) ?? '',
        valor_total: valorParaCampo(edicao.valor_total),
        fornecedor_codcfo: edicao.fornecedor_codcfo ?? '',
        fornecedor: edicao.fornecedor ?? '',
        fornecedor_cnpj: edicao.fornecedor_cnpj ?? '',
        status: edicao.status,
        motivo_status: edicao.motivo_status ?? '',
        responsavel: edicao.responsavel ?? '',
        observacao: observacaoNotaFormulario(edicao),
        motivo: '',
      });
      setItens(edicao.itens.map((i) => ({
        placa: i.placa,
        classificacao: i.classificacao,
        servico: i.servico ?? '',
        quantidade: String(i.quantidade || 1).replace('.', ','),
        valor: valorParaCampo(i.valor),
        descricao: i.descricao ?? '',
      })));
    } else {
      setForm({ ...FORM_VAZIO, data_entrada: isoHoje() });
      setItens([{ ...ITEM_VAZIO }]);
    }
  }, [registro, edicao]);

  const set = (campo: keyof typeof FORM_VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));
  const setItem = (i: number, campo: keyof ItemForm) => (v: string) =>
    setItens((xs) => xs.map((x, j) => (j === i ? { ...x, [campo]: v, ...(campo === 'classificacao' && CLASSIFICACOES_DESPESA.has(v) && !x.servico ? { servico: 'OUTRO' } : {}) } : x)));

  const somaItens = itens.reduce((s, i) => s + centavos(i.valor), 0);
  const totalNota = centavos(form.valor_total);
  const diferenca = totalNota - somaItens;

  function ratear() {
    if (itens.length === 0 || totalNota <= 0) return void toast.error('Informe o valor da nota e ao menos um item.');
    const parte = Math.floor(totalNota / itens.length);
    setItens((xs) => xs.map((x, i) => ({
      ...x,
      valor: valorParaCampo((i === xs.length - 1 ? totalNota - parte * (xs.length - 1) : parte) / 100),
    })));
  }

  async function salvar() {
    const total = valorParaApi(form.valor_total);
    if (!form.numero_nf.trim()) return void toast.error('Informe o número da NF.');
    if (!form.data_entrada) return void toast.error('Informe a data de entrada.');
    if (!total || Number(total) <= 0) return void toast.error('Informe o valor da nota.');
    if (!form.fornecedor_codcfo) return void toast.error('Escolha o fornecedor no cadastro do RM.');
    if ((form.status === 'PENDENTE' || form.status === 'CANCELADA') && form.motivo_status.trim().length < 3)
      return void toast.error('Informe o motivo da pendência ou do cancelamento.');
    const preenchidos = itens.filter((i) => i.placa.trim() || i.valor.trim());
    for (const [n, i] of preenchidos.entries()) {
      if (!normalizarPlaca(i.placa)) return void toast.error(`Item ${n + 1}: informe a placa.`);
      if (!i.servico && !CLASSIFICACOES_DESPESA.has(i.classificacao)) return void toast.error(`Item ${n + 1}: escolha o tipo de serviço.`);
      if (!valorParaApi(i.valor) || Number(valorParaApi(i.valor)) <= 0) return void toast.error(`Item ${n + 1}: informe o valor.`);
    }
    if (preenchidos.length > 0 && preenchidos.reduce((s, i) => s + centavos(i.valor), 0) !== totalNota)
      return void toast.error('A soma dos itens precisa ser igual ao valor da nota. Use “Ratear igual” se for o caso.');
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) return void toast.error(`Arquivo maior que ${MAX_MB} MB.`);

    setSalvando(true);
    try {
      await salvarNota(
        {
          unidade,
          numero_nf: form.numero_nf.trim(),
          tipo_nota: form.tipo_nota || undefined,
          pedido: form.pedido.trim() || undefined,
          data_emissao: form.data_emissao || undefined,
          data_entrada: form.data_entrada,
          data_vencimento: form.data_vencimento || undefined,
          valor_total: total,
          fornecedor_codcfo: form.fornecedor_codcfo,
          status: form.status,
          motivo_status: form.motivo_status.trim() || undefined,
          responsavel: form.responsavel.trim() || undefined,
          observacao: form.observacao.trim() || undefined,
          itens: preenchidos.map((i) => ({
            placa: normalizarPlaca(i.placa),
            classificacao: i.classificacao,
            servico: i.servico || 'OUTRO',
            quantidade: Number(valorParaApi(i.quantidade || '1')) || 1,
            valor: Number(valorParaApi(i.valor)),
            descricao: i.descricao.trim() || undefined,
          })),
          motivo: form.motivo.trim() || undefined,
          arquivo,
        },
        edicao?.id
      );
      toast.success(edicao ? `NF ${form.numero_nf} alterada.` : `NF ${form.numero_nf} lançada.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a nota.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!registro} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicao ? `Alterar NF ${edicao.numero_nf}` : 'Nova nota'}</DialogTitle>
          <DialogDescription>
            {unidade} · fornecedor do cadastro do RM; os itens por placa entram nos lançamentos e nos comparativos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Nº da NF</Label>
            <Input value={form.numero_nf} maxLength={30} onChange={(e) => set('numero_nf')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Tipo de nota</Label>
            <Select value={form.tipo_nota || SEM_TIPO} onValueChange={(v) => set('tipo_nota')(v === SEM_TIPO ? '' : v)} disabled={salvando}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_TIPO}>Não informado</SelectItem>
                {TIPOS_NOTA.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pedido</Label>
            <Input value={form.pedido} maxLength={30} onChange={(e) => set('pedido')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Valor da nota (R$)</Label>
            <Input value={form.valor_total} inputMode="decimal" placeholder="0,00" onChange={(e) => set('valor_total')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Entrada no sistema</Label>
            <Input type="date" value={form.data_entrada} onChange={(e) => set('data_entrada')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Emissão da NF</Label>
            <Input type="date" value={form.data_emissao} onChange={(e) => set('data_emissao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Vencimento</Label>
            <Input type="date" value={form.data_vencimento} onChange={(e) => set('data_vencimento')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input value={form.responsavel} maxLength={100} onChange={(e) => set('responsavel')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Fornecedor (cadastro do RM)</Label>
            <SeletorFornecedorRm unidade={unidade} nome={form.fornecedor} disabled={salvando}
              onEscolher={(f) => setForm((a) => ({ ...a, fornecedor: f.nome, fornecedor_cnpj: f.cnpj, fornecedor_codcfo: f.codcfo }))} />
          </div>
          <div className="space-y-1">
            <Label>Código / CNPJ no RM</Label>
            <Input value={[form.fornecedor_codcfo, formatarDocumento(form.fornecedor_cnpj)].filter(Boolean).join(' · ') || '—'} readOnly disabled />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={set('status')} disabled={salvando}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_NOTA.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(form.status === 'PENDENTE' || form.status === 'CANCELADA') && (
            <div className="space-y-1 sm:col-span-4">
              <Label>Motivo ({form.status === 'PENDENTE' ? 'pendência' : 'cancelamento'})</Label>
              <Input value={form.motivo_status} maxLength={300} placeholder="Ex.: nota sem placa, placa fora da frota, fazer rateio"
                onChange={(e) => set('motivo_status')(e.target.value)} disabled={salvando} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm">Itens por placa</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${diferenca === 0 ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
                Itens {brl(somaItens / 100)} de {brl(totalNota / 100)}
                {diferenca !== 0 && ` · falta ${brl(diferenca / 100)}`}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={ratear} disabled={salvando}>
                <Split className="h-4 w-4 mr-1" /> Ratear igual
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setItens((xs) => [...xs, { ...ITEM_VAZIO }])}
                disabled={salvando || itens.length >= 50}>
                <Plus className="h-4 w-4 mr-1" /> Placa
              </Button>
            </div>
          </div>
          <datalist id="placas-form-nota">
            {placas.filter((p) => p.ativo).map((p) => (
              <option key={p.placa} value={p.placa}>{[p.frota, p.modelo].filter(Boolean).join(' · ')}</option>
            ))}
          </datalist>
          {itens.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Nota sem itens fica fora dos lançamentos e dos comparativos. Adicione a placa e o serviço.
            </p>
          )}
          {itens.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-12">
              <Input className="font-mono sm:col-span-2" list="placas-form-nota" placeholder="Placa" maxLength={8} value={it.placa}
                onChange={(e) => setItem(i, 'placa')(e.target.value.toUpperCase())} disabled={salvando} />
              <div className="sm:col-span-3">
                <Select value={it.classificacao} onValueChange={setItem(i, 'classificacao')} disabled={salvando}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACOES_MANUTENCAO.map((c) => (
                      <SelectItem key={c.valor} value={c.valor}>{c.rotulo}{c.grupo === 'DESPESA' ? ' (despesa)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Select value={it.servico} onValueChange={setItem(i, 'servico')} disabled={salvando}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Tipo de serviço" /></SelectTrigger>
                  <SelectContent>
                    {SERVICOS_MANUTENCAO.map((s) => <SelectItem key={s.valor} value={s.valor}>{s.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input className="sm:col-span-1" inputMode="decimal" title="Quantidade (ex.: 4 pneus)" value={it.quantidade}
                onChange={(e) => setItem(i, 'quantidade')(e.target.value)} disabled={salvando} />
              <Input className="sm:col-span-2" inputMode="decimal" placeholder="Valor" value={it.valor}
                onChange={(e) => setItem(i, 'valor')(e.target.value)} disabled={salvando} />
              <Button type="button" size="icon" variant="ghost" className="sm:col-span-1 text-destructive" title="Tirar item"
                onClick={() => setItens((xs) => xs.filter((_, j) => j !== i))} disabled={salvando}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Input className="sm:col-span-12" placeholder="Descrição (opcional): ex. troca de pastilhas dianteiras" maxLength={500}
                value={it.descricao} onChange={(e) => setItem(i, 'descricao')(e.target.value)} disabled={salvando} />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={2} maxLength={1000} value={form.observacao} onChange={(e) => set('observacao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>{edicao?.nome_arquivo ? 'Trocar anexo (opcional)' : 'NF / boleto (opcional)'}</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={salvando} />
            {edicao?.nome_arquivo && !arquivo && <p className="text-xs text-muted-foreground truncate">Atual: {edicao.nome_arquivo}</p>}
          </div>
          {edicao && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Motivo da alteração (opcional)</Label>
              <Input value={form.motivo} maxLength={500} onChange={(e) => set('motivo')(e.target.value)} disabled={salvando} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {edicao ? 'Salvar alteração' : 'Lançar nota'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------- Importação da planilha

const ROTULO_CASAMENTO: Record<string, { texto: string; classe: string }> = {
  ESCOLHIDO: { texto: 'Escolhido', classe: 'border-emerald-500 text-emerald-700 dark:text-emerald-400' },
  EXATO: { texto: 'Mesmo nome no RM', classe: 'border-emerald-500 text-emerald-700 dark:text-emerald-400' },
  PROVAVEL: { texto: 'Provável: confira', classe: 'border-sky-500 text-sky-700 dark:text-sky-400' },
  AMBIGUO: { texto: 'Mais de um no RM', classe: 'border-amber-500 text-amber-700 dark:text-amber-400' },
  NAO_ENCONTRADO: { texto: 'Não achado', classe: 'border-red-500 text-red-700 dark:text-red-400' },
};

function ImportarPlanilha({ unidade, aberto, onFechar, onImportado }: {
  unidade: string;
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<ArquivoImportacaoNotas | null>(null);
  const [resumo, setResumo] = useState<ResumoImportacaoNotas | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, { codcfo: string; nome: string }>>({});
  const [trabalhando, setTrabalhando] = useState(false);
  const [soPendentes, setSoPendentes] = useState(true);

  useEffect(() => {
    if (!aberto) return;
    setArquivo(null);
    setResumo(null);
    setEscolhas({});
  }, [aberto]);

  async function lerArquivo(f?: File) {
    if (entrada.current) entrada.current.value = '';
    if (!f) return;
    try {
      const dados = parseArquivoImportacaoNotas(await f.text(), f.name, unidade);
      if (!Array.isArray(dados.notas)) throw new Error('Arquivo sem a lista de notas.');
      if (dados.unidade && dados.unidade !== unidade)
        throw new Error(`Este arquivo é da ${dados.unidade}. Troque a unidade da tela para ${dados.unidade}.`);
      const normalizado = { ...dados, unidade };
      setArquivo(normalizado);
      setResumo(null);
      setEscolhas({});
      await conferir(normalizado, {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arquivo inválido.');
    }
  }

  const depara = (es: Record<string, { codcfo: string }>) =>
    Object.fromEntries(Object.entries(es).map(([k, v]) => [k, v.codcfo]));

  async function conferir(dados = arquivo, es = escolhas) {
    if (!dados) return;
    setTrabalhando(true);
    try {
      setResumo(await importarNotasPlanilha(unidade, dados.notas, depara(es), false));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao conferir a planilha.');
    } finally {
      setTrabalhando(false);
    }
  }

  async function aplicar() {
    if (!arquivo || !resumo) return;
    setTrabalhando(true);
    try {
      const r = await importarNotasPlanilha(unidade, arquivo.notas, depara(escolhas), true);
      setResumo(r);
      toast.success(`${r.notas_novas} nota(s) importada(s).`);
      onImportado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao importar.');
    } finally {
      setTrabalhando(false);
    }
  }

  const fornecedores = (resumo?.fornecedores ?? []).filter(
    (f) => !soPendentes || !['EXATO', 'ESCOLHIDO'].includes(f.situacao) || escolhas[f.nome_planilha]
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !trabalhando && onFechar()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar a planilha de NFs e pedidos ({unidade})</DialogTitle>
          <DialogDescription>
            Baixe o modelo Excel, preencha uma linha por nota (mesmas colunas do controle antigo) e salve como CSV UTF-8 com separador
            ponto e vírgula (;) para importar aqui. Também aceita JSON técnico (importar-notas-WAY-xxx). A tela só confere até você clicar
            em Importar; linhas já importadas são puladas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => baixarModeloImportacaoNotas(unidade)} disabled={trabalhando}>
            <FileDown className="h-4 w-4 mr-2" /> Baixar modelo (Excel)
          </Button>
          <input ref={entrada} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => void lerArquivo(e.target.files?.[0])} />
          <Button type="button" variant="outline" onClick={() => entrada.current?.click()} disabled={trabalhando}>
            <FileUp className="h-4 w-4 mr-2" /> {arquivo ? 'Trocar arquivo' : 'Importar arquivo preenchido'}
          </Button>
          {arquivo && <span className="text-sm text-muted-foreground">{arquivo.notas.length} linha(s) no arquivo</span>}
          {trabalhando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {resumo && (
          <div className="space-y-4">
            {resumo.aplicado && (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm">
                Importação concluída: {resumo.notas_novas} nota(s), {resumo.itens} item(ns), {brl(resumo.valor_total)}.
              </p>
            )}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <CartaoIndicador icone={Coins} tom="verde" rotulo={resumo.aplicado ? 'Notas importadas' : 'Notas novas'} valor={resumo.notas_novas}
                detalhe={brl(resumo.valor_total)} />
              <CartaoIndicador icone={CheckCircle2} tom="azul" rotulo="Com itens (placa)" valor={resumo.notas_com_itens} detalhe={`${resumo.itens} item(ns)`} />
              <CartaoIndicador icone={AlertTriangle} tom="ambar" rotulo="Sem fornecedor do RM" valor={resumo.sem_fornecedor_rm}
                detalhe="entram como pendentes" />
              <CartaoIndicador icone={AlertTriangle} tom="laranja" rotulo="Placas fora do RM" valor={resumo.placas_fora_rm.length}
                detalhe="itens não criados" />
              <CartaoIndicador icone={Clock} tom="cinza" rotulo="Já importadas" valor={resumo.ja_importadas} detalhe="puladas" />
            </div>

            {resumo.placas_fora_rm.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Placas que não estão no RM da {unidade} (a nota entra, sem item, com a placa na observação):{' '}
                {resumo.placas_fora_rm.join(', ')}
              </p>
            )}
            {resumo.ignoradas.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Ignoradas: {resumo.ignoradas.join(' · ')}</p>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Fornecedores da planilha → cadastro do RM ({resumo.fornecedores.length})
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSoPendentes((v) => !v)}>
                  {soPendentes ? 'Mostrar todos' : 'Só os que precisam de conferência'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O nome gravado é sempre o do RM. Confira os “prováveis” e escolha o fornecedor dos que não foram achados; os que
                ficarem sem fornecedor entram como notas pendentes.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left font-medium">Na planilha</th>
                      <th className="p-2 text-right font-medium">Notas</th>
                      <th className="p-2 text-left font-medium">Situação</th>
                      <th className="p-2 text-left font-medium w-96">Fornecedor no RM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedores.map((f) => {
                      const escolhido = escolhas[f.nome_planilha];
                      const situacao = escolhido ? 'ESCOLHIDO' : f.situacao;
                      return (
                        <tr key={f.nome_planilha} className="border-t align-top">
                          <td className="p-2">{f.nome_planilha}</td>
                          <td className="p-2 text-right">{f.ocorrencias}</td>
                          <td className="p-2">
                            <Badge variant="outline" className={ROTULO_CASAMENTO[situacao]?.classe ?? ''}>
                              {ROTULO_CASAMENTO[situacao]?.texto ?? situacao}
                            </Badge>
                          </td>
                          <td className="p-2 space-y-1">
                            <SeletorFornecedorRm unidade={unidade} disabled={trabalhando || resumo.aplicado}
                              nome={escolhido?.nome ?? f.nome_rm ?? ''} textoVazio="Escolher no RM"
                              onEscolher={(x) => setEscolhas((es) => ({ ...es, [f.nome_planilha]: { codcfo: x.codcfo, nome: x.nome } }))} />
                            {!escolhido && f.codcfo && (
                              <p className="text-xs text-muted-foreground">{[f.codcfo, formatarDocumento(f.cnpj)].filter(Boolean).join(' · ')}</p>
                            )}
                            {!escolhido && f.situacao === 'AMBIGUO' && f.candidatos.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {f.candidatos.map((c) => (
                                  <Button key={c.codcfo} type="button" size="sm" variant="outline" className="h-6 text-xs"
                                    onClick={() => setEscolhas((es) => ({ ...es, [f.nome_planilha]: { codcfo: c.codcfo, nome: c.nome } }))}>
                                    {c.nome} ({c.codcfo})
                                  </Button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {fornecedores.length === 0 && (
                      <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">Todos os fornecedores casaram com o RM.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={trabalhando}>Fechar</Button>
          {resumo && !resumo.aplicado && (
            <>
              <Button type="button" variant="outline" onClick={() => void conferir()} disabled={trabalhando}>
                <RefreshCw className="h-4 w-4 mr-2" /> Conferir de novo
              </Button>
              <Button type="button" onClick={() => void aplicar()} disabled={trabalhando || resumo.notas_novas === 0}>
                {trabalhando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar {resumo.notas_novas} nota(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
