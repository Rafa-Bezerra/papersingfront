'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  CircleCheck,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Trash2,
  Undo2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  anexarArquivoMulta,
  anexoMulta,
  cnhCondutor,
  excluirCondutor,
  excluirViagem,
  FrotaCondutor,
  FrotaMulta,
  FrotaPlaca,
  FrotaViagem,
  listarCondutores,
  listarMultasDoCondutor,
  listarViagens,
  normalizarPlaca,
  salvarCondutor,
  salvarViagem,
  situacaoDesconto,
  SITUACOES_DESCONTO,
  SITUACOES_MULTA,
  TIPOS_FROTA,
} from '@/services/frotasService';
import {
  BotaoEnviarAnexo,
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
  SelectSimNao,
  SeletorUnidade,
  simNaoCampo,
  textoFiltros,
  textoPeriodo,
  useUnidadeFrotas,
  usePlacasFrota,
} from './comum';
import { dataBr } from './VeiculoDialog';

const MAX_MB = 10;
const CATEGORIAS = ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];

type SituacaoCnh = 'VENCIDA' | 'VENCE_30' | 'EM_DIA' | 'SEM_VALIDADE';

function situacaoCnh(validade: string | null | undefined, hoje: string): { tipo: SituacaoCnh; dias: number | null } {
  if (!validade) return { tipo: 'SEM_VALIDADE', dias: null };
  const dias = Math.round((Date.parse(validade.slice(0, 10)) - Date.parse(hoje)) / 86_400_000);
  return { tipo: dias < 0 ? 'VENCIDA' : dias <= 30 ? 'VENCE_30' : 'EM_DIA', dias };
}

function BadgeCnh({ validade, hoje }: { validade?: string | null; hoje: string }) {
  const { tipo, dias } = situacaoCnh(validade, hoje);
  if (tipo === 'SEM_VALIDADE') return <span className="text-muted-foreground">Sem validade</span>;
  const texto = dataBr(validade!);
  if (tipo === 'VENCIDA') return <Badge variant="destructive">{texto} · vencida</Badge>;
  if (tipo === 'VENCE_30')
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
        {texto} · {dias === 0 ? 'vence hoje' : `${dias} dia(s)`}
      </Badge>
    );
  return <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">{texto}</Badge>;
}

/** "2026-07-13T13:30:00" → "13/07/2026 13:30" sem conversão de fuso. */
function dataHoraBr(v?: string | null) {
  if (!v) return '';
  return `${dataBr(v)} ${v.slice(11, 16)}`;
}

function agoraLocal() {
  const d = new Date();
  return `${isoHoje()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function duracao(saida: string, retorno?: string | null) {
  const fim = retorno ? Date.parse(retorno) : Date.now();
  const min = Math.max(0, Math.round((fim - Date.parse(saida)) / 60_000));
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  return dias > 0 ? `${dias}d ${horas}h` : `${horas}h ${min % 60}min`;
}

function rotuloFrota(t: string) {
  return TIPOS_FROTA.find((x) => x.valor === t)?.rotulo ?? t;
}

export default function CondutoresPage() {
  const sel = useUnidadeFrotas();
  const { unidade } = sel;
  const placas = usePlacasFrota(unidade);
  const hoje = isoHoje();

  const [condutores, setCondutores] = useState<FrotaCondutor[]>([]);
  const [viagens, setViagens] = useState<FrotaViagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [parte, setParte] = useState('condutores');

  const [buscaCondutor, setBuscaCondutor] = useState('');
  const [filtroCnh, setFiltroCnh] = useState<'TODAS' | SituacaoCnh>('TODAS');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroCarro, setFiltroCarro] = useState('TODOS');
  const [filtroPendencia, setFiltroPendencia] = useState('TODAS');

  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(isoHoje());
  const [filtroCondutor, setFiltroCondutor] = useState('TODOS');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroVeiculo, setFiltroVeiculo] = useState('TODOS');
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS');
  const [buscaViagem, setBuscaViagem] = useState('');

  const [editandoCondutor, setEditandoCondutor] = useState<FrotaCondutor | 'novo' | null>(null);
  const [editandoViagem, setEditandoViagem] = useState<{ viagem?: FrotaViagem; idCondutor?: number; volta?: boolean } | null>(null);
  const [excluindoCondutor, setExcluindoCondutor] = useState<FrotaCondutor | null>(null);
  const [excluindoViagem, setExcluindoViagem] = useState<FrotaViagem | null>(null);
  const [multasDe, setMultasDe] = useState<FrotaCondutor | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    try {
      const [c, v] = await Promise.all([listarCondutores(unidade), listarViagens(unidade, de || undefined, ate || undefined)]);
      setCondutores(c);
      setViagens(v);
    } catch (e) {
      setCondutores([]);
      setViagens([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os condutores.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativos = useMemo(() => condutores.filter((c) => c.ativo), [condutores]);
  const contagem = useMemo(() => {
    const n = { VENCIDA: 0, VENCE_30: 0, EM_DIA: 0, SEM_VALIDADE: 0 } as Record<SituacaoCnh, number>;
    ativos.forEach((c) => n[situacaoCnh(c.cnh_validade, hoje).tipo]++);
    return n;
  }, [ativos, hoje]);
  const emViagem = viagens.filter((v) => !v.data_retorno).length;

  const linhasCondutores = useMemo(() => {
    const b = buscaCondutor.trim().toLowerCase();
    const digitos = b.replace(/\D/g, '');
    return condutores.filter(
      (c) =>
        (mostrarInativos || c.ativo) &&
        (filtroCnh === 'TODAS' || situacaoCnh(c.cnh_validade, hoje).tipo === filtroCnh) &&
        (filtroCarro === 'TODOS' || (filtroCarro === 'DEDICADO' ? !!c.carro_dedicado : !c.carro_dedicado)) &&
        (filtroPendencia === 'TODAS' ||
          (filtroPendencia === 'SEM_TICKET' && !c.ticket_log) ||
          (filtroPendencia === 'SEM_ROTAGYN' && !c.rotagyn) ||
          (filtroPendencia === 'SEM_CNH_COPIA' && !c.nome_arquivo)) &&
        (!b ||
          `${c.nome} ${c.matricula ?? ''} ${c.setor ?? ''} ${c.email ?? ''} ${c.funcao ?? ''} ${c.carro_dedicado ?? ''}`
            .toLowerCase()
            .includes(b) ||
          (digitos.length >= 3 && (c.cpf ?? '').includes(digitos)))
    );
  }, [condutores, buscaCondutor, filtroCnh, filtroCarro, filtroPendencia, mostrarInativos, hoje]);

  const linhasViagens = useMemo(() => {
    const p = normalizarPlaca(filtroPlaca);
    const b = buscaViagem.trim().toLowerCase();
    return viagens.filter(
      (v) =>
        (filtroCondutor === 'TODOS' || String(v.id_condutor ?? `nome:${v.condutor}`) === filtroCondutor) &&
        (!p || v.placa.includes(p)) &&
        (filtroVeiculo === 'TODOS' ||
          (filtroVeiculo === 'LOCADOS' ? v.tipo_frota !== 'PROPRIA' : v.tipo_frota === filtroVeiculo)) &&
        (filtroSituacao === 'TODAS' || (filtroSituacao === 'EM_VIAGEM' ? !v.data_retorno : !!v.data_retorno)) &&
        (!b || `${v.chamado ?? ''} ${v.destino ?? ''} ${v.observacao ?? ''}`.toLowerCase().includes(b))
    );
  }, [viagens, filtroCondutor, filtroPlaca, filtroVeiculo, filtroSituacao, buscaViagem]);

  const opcoesCondutorFiltro = useMemo(() => {
    const mapa = new Map<string, string>();
    condutores.forEach((c) => mapa.set(String(c.id), c.nome));
    viagens.forEach((v) => mapa.set(String(v.id_condutor ?? `nome:${v.condutor}`), v.condutor));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [condutores, viagens]);

  const condutorPorId = useMemo(() => new Map(condutores.map((c) => [c.id, c])), [condutores]);

  const filtrosCondutorAtivos = !!buscaCondutor || filtroCnh !== 'TODAS' || filtroCarro !== 'TODOS' || filtroPendencia !== 'TODAS';
  const filtrosViagemAtivos =
    filtroCondutor !== 'TODOS' || !!filtroPlaca || filtroVeiculo !== 'TODOS' || filtroSituacao !== 'TODAS' || !!buscaViagem;

  const colunasCondutores: ColumnDef<FrotaCondutor>[] = useMemo(
    () => [
      {
        id: 'nome',
        header: 'Condutor',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium">
              {row.original.nome}
              {!row.original.ativo && <Badge variant="secondary" className="ml-2">Inativo</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {[row.original.setor, row.original.matricula && `mat. ${row.original.matricula}`].filter(Boolean).join(' · ') || '—'}
            </p>
            {row.original.funcao && <p className="text-xs text-muted-foreground">{row.original.funcao}</p>}
          </div>
        ),
      },
      {
        id: 'carro',
        header: 'Carro e cadastros',
        cell: ({ row }) => {
          const c = row.original;
          const faltas = [!c.ticket_log && 'Ticket Log', !c.rotagyn && 'Rotagyn', !c.nome_arquivo && 'cópia da CNH'].filter(Boolean);
          return (
            <div className="leading-tight text-sm">
              <p>{c.carro_dedicado ? <span className="font-mono">{c.carro_dedicado}</span> : <span className="text-muted-foreground">Pool</span>}</p>
              {faltas.length > 0 ? (
                <p className="text-xs text-amber-600">Falta: {faltas.join(', ')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Cadastros ok</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'contato',
        header: 'Contato',
        cell: ({ row }) => (
          <div className="leading-tight text-sm">
            <p>{row.original.email || <span className="text-muted-foreground">sem e-mail</span>}</p>
            {row.original.telefone && <p className="text-xs text-muted-foreground">{row.original.telefone}</p>}
          </div>
        ),
      },
      {
        id: 'cnh',
        header: 'CNH',
        cell: ({ row }) =>
          row.original.cnh_numero ? (
            <div className="leading-tight">
              <p className="font-mono text-sm">{row.original.cnh_numero}</p>
              {row.original.cnh_categoria && <p className="text-xs text-muted-foreground">cat. {row.original.cnh_categoria}</p>}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'validade', header: 'Validade da CNH', cell: ({ row }) => <BadgeCnh validade={row.original.cnh_validade} hoje={hoje} /> },
      {
        id: 'viagem',
        header: 'Viagens',
        cell: ({ row }) =>
          row.original.placa_em_viagem ? (
            <Badge className="bg-sky-600 hover:bg-sky-600">Em viagem · {row.original.placa_em_viagem}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{row.original.viagens}</span>
          ),
      },
      {
        id: 'multas',
        header: 'Multas',
        cell: ({ row }) =>
          row.original.multas > 0 ? (
            <Button type="button" variant="link" className="h-auto p-0 text-left" title="Ver as multas deste condutor"
              onClick={() => setMultasDe(row.original)}>
              <span className="leading-tight">
                {row.original.multas} · {brl(row.original.multas_valor)}
                {row.original.multas_a_pagar > 0 && (
                  <span className="block text-xs text-destructive">{row.original.multas_a_pagar} a pagar</span>
                )}
                {row.original.multas_a_descontar > 0 && (
                  <span className="block text-xs text-amber-600">a descontar {brl(row.original.multas_a_descontar)}</span>
                )}
                {row.original.multas_descontado > 0 && (
                  <span className="block text-xs text-muted-foreground">descontado {brl(row.original.multas_descontado)}</span>
                )}
              </span>
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'anexo',
        header: 'CNH (cópia)',
        cell: ({ row }) => (
          <BotoesAnexo
            nome={row.original.nome_arquivo}
            abrir={() => cnhCondutor(row.original.id)}
            baixar={() => cnhCondutor(row.original.id, row.original.nome_arquivo)}
          />
        ),
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Nova viagem para este condutor"
              disabled={!row.original.ativo} onClick={() => setEditandoViagem({ idCondutor: row.original.id })}>
              <Route className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Alterar"
              onClick={() => setEditandoCondutor(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir"
              onClick={() => setExcluindoCondutor(row.original)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [hoje]
  );

  const colunasViagens: ColumnDef<FrotaViagem>[] = useMemo(
    () => [
      {
        id: 'condutor',
        header: 'Condutor',
        cell: ({ row }) => {
          const cad = row.original.id_condutor ? condutorPorId.get(row.original.id_condutor) : undefined;
          const sit = cad ? situacaoCnh(cad.cnh_validade, hoje).tipo : null;
          return (
            <div className="leading-tight">
              <p className="font-medium">{row.original.condutor}</p>
              {!row.original.id_condutor && <p className="text-xs text-muted-foreground">sem cadastro</p>}
              {sit === 'VENCIDA' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> CNH vencida
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: 'placa',
        header: 'Veículo',
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="font-mono font-medium">{row.original.placa}</span>
            <p className="text-xs text-muted-foreground">
              {row.original.tipo_frota === 'PROPRIA' ? 'Próprio' : `Locado · ${rotuloFrota(row.original.tipo_frota)}`}
            </p>
          </div>
        ),
      },
      { id: 'saida', header: 'Ida (saída)', cell: ({ row }) => dataHoraBr(row.original.data_saida) },
      {
        id: 'retorno',
        header: 'Volta',
        cell: ({ row }) =>
          row.original.data_retorno ? (
            dataHoraBr(row.original.data_retorno)
          ) : (
            <Badge className="bg-sky-600 hover:bg-sky-600">Em viagem</Badge>
          ),
      },
      {
        id: 'duracao',
        header: 'Duração',
        cell: ({ row }) => <span className="text-sm">{duracao(row.original.data_saida, row.original.data_retorno)}</span>,
      },
      {
        id: 'destino',
        header: 'Destino / chamado',
        cell: ({ row }) => (
          <div className="leading-tight max-w-64">
            <p className="truncate" title={row.original.destino ?? ''}>{row.original.destino || '—'}</p>
            {row.original.chamado && (
              <p className="text-xs text-muted-foreground truncate" title={row.original.chamado}>
                Chamado: {row.original.chamado}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'obs',
        header: 'Observação',
        cell: ({ row }) => (
          <p className="max-w-56 truncate text-sm" title={row.original.observacao ?? ''}>
            {row.original.observacao || <span className="text-muted-foreground">—</span>}
          </p>
        ),
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            {!row.original.data_retorno && (
              <Button type="button" size="sm" variant="outline" className="h-7 mr-1"
                onClick={() => setEditandoViagem({ viagem: row.original, volta: true })}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Registrar volta
              </Button>
            )}
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Alterar"
              onClick={() => setEditandoViagem({ viagem: row.original })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir"
              onClick={() => setExcluindoViagem(row.original)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [condutorPorId, hoje]
  );

  function montarPdf(): RelatorioFrotaPdf {
    const rotuloCnh = { TODAS: '', VENCIDA: 'vencida', VENCE_30: 'vence em até 30 dias', EM_DIA: 'em dia', SEM_VALIDADE: 'sem validade' };
    return {
      titulo: 'Condutores e viagens',
      subtitulo: 'Gestão de frotas',
      unidade,
      periodo: `viagens de ${textoPeriodo(de, ate)}`,
      arquivo: `condutores-${unidade}-${isoHoje()}`,
      kpis: [
        { rotulo: 'Condutores ativos', valor: String(ativos.length), detalhe: `${condutores.length - ativos.length} inativo(s)` },
        { rotulo: 'CNH vencida', valor: String(contagem.VENCIDA), detalhe: 'condutores ativos' },
        { rotulo: 'CNH vence em 30 dias', valor: String(contagem.VENCE_30), detalhe: 'condutores ativos' },
        { rotulo: 'Sem validade de CNH', valor: String(contagem.SEM_VALIDADE), detalhe: 'condutores ativos' },
        { rotulo: 'Em viagem agora', valor: String(emViagem), detalhe: 'veículos fora' },
        { rotulo: 'Viagens concluídas', valor: String(viagens.filter((v) => v.data_retorno).length), detalhe: 'no período' },
      ],
      secoes: [
        {
          titulo: 'Condutores',
          nota: `${linhasCondutores.length} condutor(es) · ${textoFiltros([
            ['CNH', rotuloCnh[filtroCnh]],
            ['Carro', filtroCarro !== 'TODOS' && (filtroCarro === 'DEDICADO' ? 'dedicado' : 'pool')],
            ['Pendência', filtroPendencia !== 'TODAS' &&
              ({ SEM_TICKET: 'sem Ticket Log', SEM_ROTAGYN: 'sem Rotagyn', SEM_CNH_COPIA: 'sem cópia da CNH' } as Record<string, string>)[filtroPendencia]],
            ['Inativos', mostrarInativos && 'incluídos'],
            ['Busca', buscaCondutor.trim()],
          ])}`,
          colunas: [
            { titulo: 'Condutor', largura: 52 }, { titulo: 'Carro e cadastros', largura: 28 }, { titulo: 'Contato', largura: 40 },
            { titulo: 'CNH', largura: 22 }, { titulo: 'Validade', largura: 22 }, { titulo: 'Multas', largura: 26, alinhar: 'right' },
          ],
          linhas: linhasCondutores.map((c) => {
            const cnh = situacaoCnh(c.cnh_validade, hoje);
            const faltas = [!c.ticket_log && 'Ticket', !c.rotagyn && 'Rotagyn', !c.nome_arquivo && 'cópia CNH'].filter(Boolean);
            return [
              {
                texto: c.nome + (c.ativo ? '' : ' (inativo)'),
                negrito: true,
                sub: [c.setor, c.matricula && `mat. ${c.matricula}`, c.funcao].filter(Boolean).join(' · ') || undefined,
              },
              {
                texto: c.placa_em_viagem ? `Em viagem · ${c.placa_em_viagem}` : c.carro_dedicado || 'Pool',
                sub: faltas.length ? `Falta: ${faltas.join(', ')}` : 'Cadastros ok',
              },
              { texto: c.email || 'sem e-mail', sub: c.telefone || undefined, cor: c.email ? undefined : COR_PDF.muted },
              { texto: c.cnh_numero || '—', sub: c.cnh_categoria ? `cat. ${c.cnh_categoria}` : undefined },
              {
                texto: c.cnh_validade ? dataBr(c.cnh_validade) : 'sem validade',
                cor: cnh.tipo === 'VENCIDA' ? COR_PDF.perigo : cnh.tipo === 'VENCE_30' ? COR_PDF.alerta : cnh.tipo === 'EM_DIA' ? COR_PDF.ok : COR_PDF.muted,
                sub: cnh.tipo === 'VENCIDA' ? 'vencida' : cnh.tipo === 'VENCE_30' ? `${cnh.dias} dia(s)` : undefined,
              },
              c.multas > 0
                ? { texto: `${c.multas} · ${brl(c.multas_valor)}`, sub: c.multas_a_descontar > 0 ? `a descontar ${brl(c.multas_a_descontar)}` : undefined }
                : { texto: '—', cor: COR_PDF.muted },
            ];
          }),
        },
        {
          titulo: 'Viagens',
          nota: `${linhasViagens.length} viagem(ns) · ${textoFiltros([
            ['Condutor', filtroCondutor !== 'TODOS' && opcoesCondutorFiltro.find(([k]) => k === filtroCondutor)?.[1]],
            ['Placa', normalizarPlaca(filtroPlaca)],
            ['Veículo', filtroVeiculo !== 'TODOS' && (filtroVeiculo === 'LOCADOS' ? 'locados' : filtroVeiculo === 'PROPRIA' ? 'próprio' : rotuloFrota(filtroVeiculo))],
            ['Situação', filtroSituacao !== 'TODAS' && (filtroSituacao === 'EM_VIAGEM' ? 'em viagem' : 'concluída')],
            ['Busca', buscaViagem.trim()],
          ])}`,
          colunas: [
            { titulo: 'Condutor', largura: 40 }, { titulo: 'Veículo', largura: 24 }, { titulo: 'Ida (saída)', largura: 26 },
            { titulo: 'Volta', largura: 26 }, { titulo: 'Duração', largura: 18 }, { titulo: 'Destino / chamado', largura: 56 },
          ],
          linhas: linhasViagens.map((v) => [
            { texto: v.condutor, negrito: true, sub: v.id_condutor ? undefined : 'sem cadastro' },
            { texto: v.placa, sub: v.tipo_frota === 'PROPRIA' ? 'Próprio' : `Locado · ${rotuloFrota(v.tipo_frota)}` },
            { texto: dataHoraBr(v.data_saida) },
            v.data_retorno ? { texto: dataHoraBr(v.data_retorno) } : { texto: 'Em viagem', cor: COR_PDF.alerta },
            { texto: duracao(v.data_saida, v.data_retorno) },
            {
              texto: v.destino || '—',
              sub: [v.chamado && `Chamado: ${v.chamado}`, v.observacao].filter(Boolean).join(' · ') || undefined,
            },
          ]),
        },
      ],
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> Condutores
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dados e CNH de quem dirige os veículos, e as viagens com ida e volta. Quem tem o módulo Frotas e o próprio
            condutor recebem e-mail 30, 15 e 7 dias antes da CNH vencer e no dia do vencimento.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <SeletorUnidade {...sel} />
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" variant="outline" onClick={() => setEditandoCondutor('novo')} disabled={!unidade}>
            <UserRound className="h-4 w-4 mr-2" /> Novo condutor
          </Button>
          <Button type="button" onClick={() => setEditandoViagem({})} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Nova viagem
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <CartaoIndicador icone={Users} tom="azul" destaque rotulo="Condutores ativos" valor={ativos.length}
          detalhe={`${contagem.SEM_VALIDADE} sem validade de CNH`} ativo={parte === 'condutores' && filtroCnh === 'TODAS'}
          onClick={() => { setParte('condutores'); setFiltroCnh('TODAS'); }} />
        <CartaoIndicador icone={AlertTriangle} tom="vermelho" rotulo="CNH vencida" valor={contagem.VENCIDA}
          corValor={contagem.VENCIDA > 0 ? 'text-destructive' : ''} detalhe="condutores ativos"
          ativo={parte === 'condutores' && filtroCnh === 'VENCIDA'}
          onClick={() => { setParte('condutores'); setFiltroCnh(filtroCnh === 'VENCIDA' ? 'TODAS' : 'VENCIDA'); }} />
        <CartaoIndicador icone={Clock} tom="ambar" rotulo="CNH vence em 30 dias" valor={contagem.VENCE_30}
          corValor={contagem.VENCE_30 > 0 ? 'text-amber-600 dark:text-amber-400' : ''} detalhe="avisados por e-mail"
          ativo={parte === 'condutores' && filtroCnh === 'VENCE_30'}
          onClick={() => { setParte('condutores'); setFiltroCnh(filtroCnh === 'VENCE_30' ? 'TODAS' : 'VENCE_30'); }} />
        <CartaoIndicador icone={CarFront} tom="roxo" rotulo="Em viagem agora" valor={emViagem} detalhe="veículos fora"
          ativo={parte === 'viagens' && filtroSituacao === 'EM_VIAGEM'}
          onClick={() => { setParte('viagens'); setFiltroSituacao(filtroSituacao === 'EM_VIAGEM' ? 'TODAS' : 'EM_VIAGEM'); }} />
        <CartaoIndicador icone={CircleCheck} tom="verde" rotulo="Viagens no período" valor={viagens.filter((v) => v.data_retorno).length}
          detalhe="concluídas" ativo={parte === 'viagens' && filtroSituacao === 'CONCLUIDA'}
          onClick={() => { setParte('viagens'); setFiltroSituacao(filtroSituacao === 'CONCLUIDA' ? 'TODAS' : 'CONCLUIDA'); }} />
      </div>

      <Tabs value={parte} onValueChange={setParte} className="space-y-3">
        <TabsList>
          <TabsTrigger value="condutores">
            <UserRound className="w-4 h-4" /> Condutores ({condutores.length})
          </TabsTrigger>
          <TabsTrigger value="viagens">
            <CalendarClock className="w-4 h-4" /> Viagens ({viagens.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="condutores">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Condutores ({unidade || '—'})</CardTitle>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Nome, CPF, matrícula, setor, função ou placa</Label>
                  <Input value={buscaCondutor} onChange={(e) => setBuscaCondutor(e.target.value)} placeholder="Buscar" className="w-72" />
                </div>
                <div className="space-y-1">
                  <Label>Situação da CNH</Label>
                  <Select value={filtroCnh} onValueChange={(v) => setFiltroCnh(v as typeof filtroCnh)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas</SelectItem>
                      <SelectItem value="VENCIDA">Vencida</SelectItem>
                      <SelectItem value="VENCE_30">Vence em até 30 dias</SelectItem>
                      <SelectItem value="EM_DIA">Em dia</SelectItem>
                      <SelectItem value="SEM_VALIDADE">Sem validade informada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Carro</Label>
                  <Select value={filtroCarro} onValueChange={setFiltroCarro}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      <SelectItem value="DEDICADO">Carro dedicado</SelectItem>
                      <SelectItem value="POOL">Pool</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Pendência de cadastro</Label>
                  <Select value={filtroPendencia} onValueChange={setFiltroPendencia}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas</SelectItem>
                      <SelectItem value="SEM_TICKET">Sem Ticket Log</SelectItem>
                      <SelectItem value="SEM_ROTAGYN">Sem Rotagyn</SelectItem>
                      <SelectItem value="SEM_CNH_COPIA">Sem cópia da CNH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm h-9">
                  <Checkbox checked={mostrarInativos} onCheckedChange={(v) => setMostrarInativos(v === true)} />
                  Mostrar inativos ({condutores.length - ativos.length})
                </label>
                {filtrosCondutorAtivos && (
                  <Button type="button" variant="ghost" onClick={() => { setBuscaCondutor(''); setFiltroCnh('TODAS'); setFiltroCarro('TODOS'); setFiltroPendencia('TODAS'); }}>
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
                columns={colunasCondutores}
                data={linhasCondutores}
                loading={carregando}
                hideSearch
                emptyMessage={filtrosCondutorAtivos ? 'Nenhum condutor com esses filtros.' : 'Nenhum condutor cadastrado.'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viagens">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Viagens ({unidade || '—'})</CardTitle>
              <div className="flex flex-wrap items-end gap-3">
                <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Saída" />
                <div className="space-y-1">
                  <Label>Condutor</Label>
                  <Select value={filtroCondutor} onValueChange={setFiltroCondutor}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      {opcoesCondutorFiltro.map(([chave, nome]) => (
                        <SelectItem key={chave} value={chave}>
                          {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Placa</Label>
                  <Input value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())} placeholder="Todas"
                    className="w-32 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label>Veículo</Label>
                  <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      <SelectItem value="PROPRIA">Próprio</SelectItem>
                      <SelectItem value="LOCADOS">Locado (todos)</SelectItem>
                      {TIPOS_FROTA.filter((t) => t.valor !== 'PROPRIA').map((t) => (
                        <SelectItem key={t.valor} value={t.valor}>
                          Locado · {t.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Situação</Label>
                  <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas</SelectItem>
                      <SelectItem value="EM_VIAGEM">Em viagem</SelectItem>
                      <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Chamado, destino ou observação</Label>
                  <Input value={buscaViagem} onChange={(e) => setBuscaViagem(e.target.value)} placeholder="Buscar" className="w-56" />
                </div>
                {filtrosViagemAtivos && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFiltroCondutor('TODOS');
                      setFiltroPlaca('');
                      setFiltroVeiculo('TODOS');
                      setFiltroSituacao('TODAS');
                      setBuscaViagem('');
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
                columns={colunasViagens}
                data={linhasViagens}
                loading={carregando}
                hideSearch
                emptyMessage={filtrosViagemAtivos ? 'Nenhuma viagem com esses filtros.' : 'Nenhuma viagem no período.'}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormCondutor
        unidade={unidade}
        setores={[...new Set(condutores.map((c) => c.setor).filter(Boolean) as string[])].sort()}
        funcoes={[...new Set(condutores.map((c) => c.funcao).filter(Boolean) as string[])].sort()}
        registro={editandoCondutor}
        onFechar={() => setEditandoCondutor(null)}
        onSalvo={() => {
          setEditandoCondutor(null);
          void carregar();
        }}
      />

      <FormViagem
        unidade={unidade}
        placas={placas}
        condutores={ativos}
        hoje={hoje}
        estado={editandoViagem}
        onFechar={() => setEditandoViagem(null)}
        onSalvo={() => {
          setEditandoViagem(null);
          void carregar();
        }}
      />

      <MultasDoCondutor unidade={unidade} condutor={multasDe} onFechar={() => setMultasDe(null)} />

      <DialogExclusao
        aberto={!!excluindoCondutor}
        titulo="Excluir condutor"
        descricao={excluindoCondutor ? `${excluindoCondutor.nome} · as viagens dele continuam registradas com o nome.` : ''}
        onCancelar={() => setExcluindoCondutor(null)}
        onConfirmar={async (motivo) => {
          if (!excluindoCondutor) return;
          try {
            await excluirCondutor(excluindoCondutor.id, motivo);
            toast.success('Condutor excluído.');
            setExcluindoCondutor(null);
            void carregar();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
          }
        }}
      />

      <DialogExclusao
        aberto={!!excluindoViagem}
        titulo="Excluir viagem"
        descricao={excluindoViagem ? `${excluindoViagem.condutor} · ${excluindoViagem.placa} · saída ${dataHoraBr(excluindoViagem.data_saida)}` : ''}
        onCancelar={() => setExcluindoViagem(null)}
        onConfirmar={async (motivo) => {
          if (!excluindoViagem) return;
          try {
            await excluirViagem(excluindoViagem.id, motivo);
            toast.success('Viagem excluída.');
            setExcluindoViagem(null);
            void carregar();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
          }
        }}
      />
    </div>
  );
}

/** Multas do condutor (vinculadas ou com o mesmo nome), de qualquer período. Lançar/alterar fica na aba Multas. */
function MultasDoCondutor({ unidade, condutor, onFechar }: {
  unidade: string;
  condutor: FrotaCondutor | null;
  onFechar: () => void;
}) {
  const [multas, setMultas] = useState<FrotaMulta[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!condutor) return;
    setCarregando(true);
    setMultas([]);
    listarMultasDoCondutor(unidade, condutor.id)
      .then(setMultas)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Falha ao carregar as multas.'))
      .finally(() => setCarregando(false));
  }, [unidade, condutor]);

  async function enviarAnexo(m: FrotaMulta, arquivo: File) {
    const nome = await anexarArquivoMulta(m.id, arquivo);
    setMultas((lista) => lista.map((x) => (x.id === m.id ? { ...x, nome_arquivo: nome } : x)));
  }

  const total = multas.reduce((s, m) => s + m.valor, 0);
  const aPagar = multas.filter((m) => m.situacao === 'A_PAGAR').reduce((s, m) => s + m.valor, 0);
  const somaDesconto = (s: string) => multas.filter((m) => situacaoDesconto(m) === s).reduce((t, m) => t + m.valor, 0);
  const rotuloDesconto = (m: FrotaMulta) => SITUACOES_DESCONTO.find((s) => s.valor === situacaoDesconto(m))?.rotulo ?? '';

  function montarPdf(): RelatorioFrotaPdf {
    return {
      titulo: `Multas de ${condutor?.nome ?? ''}`,
      subtitulo: 'Gestão de frotas · condutor',
      unidade,
      periodo: 'todas as multas',
      arquivo: `multas-${condutor?.nome ?? 'condutor'}`,
      kpis: [
        { rotulo: 'Multas', valor: String(multas.length), detalhe: 'vinculadas ou com o mesmo nome' },
        { rotulo: 'Total', valor: brl(total), detalhe: 'todas as situações' },
        { rotulo: 'A pagar', valor: brl(aPagar), detalhe: `${multas.filter((m) => m.situacao === 'A_PAGAR').length} multa(s)` },
        { rotulo: 'Já descontado', valor: brl(somaDesconto('DESCONTADA')), detalhe: 'do colaborador' },
        { rotulo: 'A descontar', valor: brl(somaDesconto('A_DESCONTAR')), detalhe: 'ainda não descontado' },
        { rotulo: 'Pontos', valor: String(multas.reduce((s, m) => s + (m.pontuacao ?? 0), 0)), detalhe: 'soma das multas' },
      ],
      secoes: [{
        titulo: 'Multas',
        nota: `${multas.length} multa(s) · ${brl(total)}`,
        colunas: [
          { titulo: 'Infração em', largura: 20 }, { titulo: 'Placa', largura: 20 }, { titulo: 'Infração', largura: 62 },
          { titulo: 'Vencimento', largura: 20 }, { titulo: 'Situação', largura: 22 }, { titulo: 'Desconto', largura: 24 },
          { titulo: 'Valor', largura: 22, alinhar: 'right' },
        ],
        linhas: multas.map((m) => [
          { texto: dataBr(m.data_infracao) },
          { texto: m.placa, negrito: true },
          { texto: m.descricao, sub: m.id_condutor ? undefined : 'vinculada pelo nome' },
          { texto: m.data_vencimento ? dataBr(m.data_vencimento) : '—' },
          {
            texto: SITUACOES_MULTA.find((s) => s.valor === m.situacao)?.rotulo ?? m.situacao,
            cor: m.situacao === 'A_PAGAR' ? COR_PDF.perigo : COR_PDF.muted,
          },
          {
            texto: rotuloDesconto(m),
            cor: situacaoDesconto(m) === 'A_DESCONTAR' ? COR_PDF.alerta : COR_PDF.muted,
            sub: m.descontada && m.data_desconto ? `em ${dataBr(m.data_desconto)}` : undefined,
          },
          { texto: brl(m.valor), negrito: true },
        ]),
      }],
    };
  }

  return (
    <Dialog open={!!condutor} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <DialogTitle>Multas de {condutor?.nome}</DialogTitle>
            <BotaoPdf disabled={carregando} montar={montarPdf} />
          </div>
          <DialogDescription>
            {multas.length} multa(s) · total {brl(total)} · a pagar {brl(aPagar)} · já descontado {brl(somaDesconto('DESCONTADA'))} ·
            a descontar {brl(somaDesconto('A_DESCONTAR'))}. O documento da multa pode ser enviado aqui; para lançar ou alterar os
            dados, use a aba Multas.
          </DialogDescription>
        </DialogHeader>
        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Infração em</th>
                  <th className="py-2 pr-3 font-medium">Placa</th>
                  <th className="py-2 pr-3 font-medium">Infração</th>
                  <th className="py-2 pr-3 font-medium">Vencimento</th>
                  <th className="py-2 pr-3 font-medium text-right">Valor</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Desconto do colaborador</th>
                  <th className="py-2 font-medium">Anexo</th>
                </tr>
              </thead>
              <tbody>
                {multas.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{dataBr(m.data_infracao)}</td>
                    <td className="py-2 pr-3 font-mono">{m.placa}</td>
                    <td className="py-2 pr-3 max-w-72">
                      <p className="truncate" title={m.descricao}>{m.descricao}</p>
                      {!m.id_condutor && <p className="text-xs text-muted-foreground">vinculada pelo nome</p>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{m.data_vencimento ? dataBr(m.data_vencimento) : '—'}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">{brl(m.valor)}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={m.situacao === 'A_PAGAR' ? 'destructive' : 'outline'}>
                        {SITUACOES_MULTA.find((s) => s.valor === m.situacao)?.rotulo ?? m.situacao}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Badge variant={situacaoDesconto(m) === 'A_DESCONTAR' ? 'secondary' : 'outline'}>
                        {SITUACOES_DESCONTO.find((s) => s.valor === situacaoDesconto(m))?.rotulo}
                      </Badge>
                      {m.descontada && m.data_desconto && (
                        <span className="block text-xs text-muted-foreground">em {dataBr(m.data_desconto)}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center">
                        <BotaoEnviarAnexo temArquivo={!!m.nome_arquivo} enviar={(arquivo) => enviarAnexo(m, arquivo)} />
                        {m.nome_arquivo && (
                          <BotoesAnexo nome={m.nome_arquivo} abrir={() => anexoMulta(m.id)} baixar={() => anexoMulta(m.id, m.nome_arquivo)} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {multas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhuma multa para este condutor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CONDUTOR_VAZIO = {
  nome: '',
  cpf: '',
  matricula: '',
  email: '',
  telefone: '',
  setor: '',
  cnh_numero: '',
  cnh_categoria: '',
  cnh_validade: '',
  ativo: true,
  funcao: '',
  carro_dedicado: '',
  ticket_log: '',
  rotagyn: '',
  cnh_arquivada: '',
  motivo: '',
};

function FormCondutor({ unidade, setores, funcoes, registro, onFechar, onSalvo }: {
  unidade: string;
  setores: string[];
  funcoes: string[];
  registro: FrotaCondutor | 'novo' | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(CONDUTOR_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const edicao = registro && registro !== 'novo' ? registro : null;

  useEffect(() => {
    if (!registro) return;
    setArquivo(null);
    setForm(
      edicao
        ? {
            nome: edicao.nome,
            cpf: edicao.cpf ?? '',
            matricula: edicao.matricula ?? '',
            email: edicao.email ?? '',
            telefone: edicao.telefone ?? '',
            setor: edicao.setor ?? '',
            cnh_numero: edicao.cnh_numero ?? '',
            cnh_categoria: edicao.cnh_categoria ?? '',
            cnh_validade: edicao.cnh_validade?.slice(0, 10) ?? '',
            ativo: edicao.ativo,
            funcao: edicao.funcao ?? '',
            carro_dedicado: edicao.carro_dedicado ?? '',
            ticket_log: simNaoCampo(edicao.ticket_log),
            rotagyn: simNaoCampo(edicao.rotagyn),
            cnh_arquivada: simNaoCampo(edicao.cnh_arquivada),
            motivo: '',
          }
        : CONDUTOR_VAZIO
    );
  }, [registro, edicao]);

  const set = (campo: keyof typeof CONDUTOR_VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));

  async function salvar() {
    if (form.nome.trim().length < 3) return void toast.error('Informe o nome do condutor.');
    const cpf = form.cpf.replace(/\D/g, '');
    if (cpf && cpf.length !== 11) return void toast.error('CPF deve ter 11 números.');
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) return void toast.error(`Arquivo maior que ${MAX_MB} MB.`);
    if (!form.cnh_validade) toast.warning('Sem validade da CNH o condutor não recebe o aviso de vencimento.');

    setSalvando(true);
    try {
      await salvarCondutor(
        {
          unidade,
          nome: form.nome.trim(),
          cpf: cpf || undefined,
          matricula: form.matricula.trim() || undefined,
          email: form.email.trim() || undefined,
          telefone: form.telefone.trim() || undefined,
          setor: form.setor.trim() || undefined,
          cnh_numero: form.cnh_numero.trim() || undefined,
          cnh_categoria: form.cnh_categoria || undefined,
          cnh_validade: form.cnh_validade || undefined,
          ativo: String(form.ativo),
          funcao: form.funcao.trim() || undefined,
          carro_dedicado: normalizarPlaca(form.carro_dedicado) || undefined,
          ticket_log: form.ticket_log || undefined,
          rotagyn: form.rotagyn || undefined,
          cnh_arquivada: form.cnh_arquivada || undefined,
          motivo: form.motivo.trim() || undefined,
          arquivo,
        },
        edicao?.id
      );
      toast.success(edicao ? 'Condutor alterado.' : 'Condutor cadastrado.');
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar o condutor.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!registro} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicao ? `Alterar condutor · ${edicao.nome}` : 'Novo condutor'}</DialogTitle>
          <DialogDescription>{unidade} · dados pessoais e CNH ficam só no PaperSign (uso interno).</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Nome completo</Label>
            <Input value={form.nome} maxLength={150} onChange={(e) => set('nome')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>CPF (opcional)</Label>
            <Input value={form.cpf} maxLength={14} inputMode="numeric" onChange={(e) => set('cpf')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Matrícula (opcional)</Label>
            <Input value={form.matricula} maxLength={30} onChange={(e) => set('matricula')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>E-mail (recebe o aviso da CNH)</Label>
            <Input type="email" value={form.email} maxLength={200} onChange={(e) => set('email')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.telefone} maxLength={30} onChange={(e) => set('telefone')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Setor</Label>
            <Input list="setores-condutor" value={form.setor} maxLength={100} onChange={(e) => set('setor')(e.target.value)} disabled={salvando} />
            <datalist id="setores-condutor">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Função</Label>
            <Input list="funcoes-condutor" value={form.funcao} maxLength={150} onChange={(e) => set('funcao')(e.target.value)} disabled={salvando} />
            <datalist id="funcoes-condutor">
              {funcoes.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Carro dedicado (placa; vazio = pool)</Label>
            <Input value={form.carro_dedicado} maxLength={8} className="font-mono"
              onChange={(e) => set('carro_dedicado')(e.target.value.toUpperCase())} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Cadastrado na Ticket Log?</Label>
            <SelectSimNao valor={form.ticket_log} onChange={set('ticket_log')} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Cadastrado na Rotagyn?</Label>
            <SelectSimNao valor={form.rotagyn} onChange={set('rotagyn')} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Nº da CNH</Label>
            <Input value={form.cnh_numero} maxLength={20} className="font-mono" onChange={(e) => set('cnh_numero')(e.target.value)} disabled={salvando} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.cnh_categoria || 'NI'} onValueChange={(v) => set('cnh_categoria')(v === 'NI' ? '' : v)} disabled={salvando}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NI">—</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Validade</Label>
              <Input type="date" value={form.cnh_validade} onChange={(e) => set('cnh_validade')(e.target.value)} disabled={salvando} />
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{edicao?.nome_arquivo ? 'Trocar cópia da CNH' : 'Cópia da CNH (PDF, JPG ou PNG)'}</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={salvando} />
            {edicao?.nome_arquivo && !arquivo ? (
              <p className="text-xs text-muted-foreground truncate">Atual: {edicao.nome_arquivo}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Fica no cadastro do condutor para consultar a qualquer momento (coluna CNH na lista). Sem a cópia, o condutor aparece com
                pendência.
              </p>
            )}
          </div>
          {edicao && (
            <>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v === true }))} disabled={salvando} />
                Condutor ativo (inativo não aparece para nova viagem nem recebe aviso)
              </label>
              <div className="space-y-1 sm:col-span-2">
                <Label>Motivo da alteração (opcional)</Label>
                <Input value={form.motivo} maxLength={500} onChange={(e) => set('motivo')(e.target.value)} disabled={salvando} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {edicao ? 'Salvar alteração' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const VIAGEM_VAZIA = {
  id_condutor: '',
  condutor: '',
  placa: '',
  tipo_frota: 'PROPRIA',
  data_saida: '',
  data_retorno: '',
  destino: '',
  chamado: '',
  observacao: '',
  motivo: '',
};

const SEM_CADASTRO = 'OUTRO';

function FormViagem({ unidade, placas, condutores, hoje, estado, onFechar, onSalvo }: {
  unidade: string;
  placas: FrotaPlaca[];
  condutores: FrotaCondutor[];
  hoje: string;
  estado: { viagem?: FrotaViagem; idCondutor?: number; volta?: boolean } | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(VIAGEM_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const edicao = estado?.viagem ?? null;

  useEffect(() => {
    if (!estado) return;
    const v = estado.viagem;
    setForm(
      v
        ? {
            id_condutor: v.id_condutor ? String(v.id_condutor) : SEM_CADASTRO,
            condutor: v.id_condutor ? '' : v.condutor,
            placa: v.placa,
            tipo_frota: v.tipo_frota,
            data_saida: v.data_saida.slice(0, 16),
            data_retorno: v.data_retorno?.slice(0, 16) ?? (estado.volta ? agoraLocal() : ''),
            destino: v.destino ?? '',
            chamado: v.chamado ?? '',
            observacao: v.observacao ?? '',
            motivo: '',
          }
        : { ...VIAGEM_VAZIA, id_condutor: estado.idCondutor ? String(estado.idCondutor) : '', data_saida: agoraLocal() }
    );
  }, [estado]);

  const set = (campo: keyof typeof VIAGEM_VAZIA) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));
  const escolhido = condutores.find((c) => String(c.id) === form.id_condutor);
  const cnh = escolhido ? situacaoCnh(escolhido.cnh_validade, hoje) : null;

  function trocarPlaca(valor: string) {
    const placa = valor.toUpperCase();
    const doRm = placas.some((p) => p.placa === normalizarPlaca(placa));
    setForm((f) => ({ ...f, placa, tipo_frota: doRm ? 'PROPRIA' : f.tipo_frota }));
  }

  async function salvar() {
    if (!form.id_condutor) return void toast.error('Escolha o condutor.');
    if (form.id_condutor === SEM_CADASTRO && form.condutor.trim().length < 3) return void toast.error('Informe o nome do condutor.');
    const placa = normalizarPlaca(form.placa);
    if (!placa) return void toast.error('Informe a placa.');
    if (!form.data_saida) return void toast.error('Informe a data e hora da ida.');
    if (form.data_retorno && form.data_retorno < form.data_saida) return void toast.error('A volta não pode ser antes da ida.');

    setSalvando(true);
    try {
      await salvarViagem(
        {
          unidade,
          id_condutor: form.id_condutor === SEM_CADASTRO ? undefined : form.id_condutor,
          condutor: form.id_condutor === SEM_CADASTRO ? form.condutor.trim() : undefined,
          placa,
          tipo_frota: form.tipo_frota,
          data_saida: form.data_saida,
          data_retorno: form.data_retorno || undefined,
          destino: form.destino.trim() || undefined,
          chamado: form.chamado.trim() || undefined,
          observacao: form.observacao.trim() || undefined,
          motivo: form.motivo.trim() || undefined,
        },
        edicao?.id
      );
      toast.success(estado?.volta ? 'Volta registrada.' : edicao ? 'Viagem alterada.' : 'Viagem registrada.');
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a viagem.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!estado} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {estado?.volta ? `Registrar volta · ${edicao?.placa}` : edicao ? `Alterar viagem · ${edicao.placa}` : 'Nova viagem'}
          </DialogTitle>
          <DialogDescription>{unidade} · ida = entrega do veículo ao condutor; volta = devolução.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Condutor</Label>
            <Select value={form.id_condutor} onValueChange={set('id_condutor')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o condutor" />
              </SelectTrigger>
              <SelectContent>
                {condutores.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                    {c.setor ? ` · ${c.setor}` : ''}
                  </SelectItem>
                ))}
                {edicao?.id_condutor && !condutores.some((c) => c.id === edicao.id_condutor) && (
                  <SelectItem value={String(edicao.id_condutor)}>{edicao.condutor} (inativo)</SelectItem>
                )}
                <SelectItem value={SEM_CADASTRO}>Outro (sem cadastro)</SelectItem>
              </SelectContent>
            </Select>
            {cnh?.tipo === 'VENCIDA' && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> CNH vencida em {dataBr(escolhido!.cnh_validade!)}.
              </p>
            )}
            {cnh?.tipo === 'VENCE_30' && (
              <p className="text-xs text-amber-600">CNH vence em {dataBr(escolhido!.cnh_validade!)}.</p>
            )}
            {cnh?.tipo === 'SEM_VALIDADE' && <p className="text-xs text-muted-foreground">Condutor sem validade de CNH cadastrada.</p>}
          </div>
          {form.id_condutor === SEM_CADASTRO && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome do condutor</Label>
              <Input value={form.condutor} maxLength={150} onChange={(e) => set('condutor')(e.target.value)} disabled={salvando} />
            </div>
          )}
          <div className="space-y-1">
            <Label>Placa</Label>
            <Input list="placas-form-viagem" value={form.placa} onChange={(e) => trocarPlaca(e.target.value)}
              className="font-mono" maxLength={8} disabled={salvando} />
            <datalist id="placas-form-viagem">
              {placas.map((p) => (
                <option key={p.placa} value={p.placa}>
                  {[p.frota, p.modelo].filter(Boolean).join(' · ')}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Veículo próprio ou locado</Label>
            <Select value={form.tipo_frota} onValueChange={set('tipo_frota')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FROTA.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.valor === 'PROPRIA' ? 'Próprio' : `Locado · ${t.rotulo}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ida (saída)</Label>
            <Input type="datetime-local" value={form.data_saida} onChange={(e) => set('data_saida')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Volta (devolução) — vazio se ainda em viagem</Label>
            <Input type="datetime-local" value={form.data_retorno} onChange={(e) => set('data_retorno')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Destino</Label>
            <Input value={form.destino} maxLength={200} onChange={(e) => set('destino')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Nº do chamado ou e-mail</Label>
            <Input value={form.chamado} maxLength={200} onChange={(e) => set('chamado')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Observação</Label>
            <Textarea value={form.observacao} maxLength={500} rows={2} onChange={(e) => set('observacao')(e.target.value)} disabled={salvando} />
          </div>
          {edicao && !estado?.volta && (
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
            {estado?.volta ? 'Registrar volta' : edicao ? 'Salvar alteração' : 'Registrar viagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
