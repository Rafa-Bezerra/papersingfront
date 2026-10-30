'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  CircleHelp,
  Loader2,
  OctagonAlert,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
  UserX,
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
import { Textarea } from '@/components/ui/textarea';
import {
  anexoSinistro,
  CAUSAS_SINISTRO,
  excluirSinistro,
  FrotaPlaca,
  FrotaSinistro,
  listarSinistros,
  normalizarPlaca,
  salvarSinistro,
  seguroSinistro,
  SITUACOES_REPARO,
  SUGESTOES_RQ106,
  TIPOS_FROTA,
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
  rotuloSimNao,
  SelectSimNao,
  SeletorUnidade,
  simNaoCampo,
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

const ESTILO_CAUSA: Record<string, { icone: LucideIcon; tom: TomIndicador }> = {
  CONDUTOR: { icone: UserX, tom: 'vermelho' },
  TERCEIROS: { icone: Users, tom: 'laranja' },
  NAO_IDENTIFICADO: { icone: CircleHelp, tom: 'cinza' },
  IMPRUDENCIA: { icone: AlertTriangle, tom: 'ambar' },
  NEGLIGENCIA: { icone: OctagonAlert, tom: 'vermelho' },
  PANE: { icone: Wrench, tom: 'azul' },
};

function rotuloCausa(c: string) {
  return CAUSAS_SINISTRO.find((x) => x.valor === c)?.rotulo ?? c;
}

function rotuloFrota(t: string) {
  return TIPOS_FROTA.find((x) => x.valor === t)?.rotulo ?? t;
}

const SEGURO_TERCEIROS = [{ valor: 'TERCEIROS', rotulo: 'Seguro de terceiros' }];

function seguroTexto(s: FrotaSinistro) {
  const v = seguroSinistro(s);
  return v === 'TERCEIROS' ? 'Terceiros' : v === 'SIM' ? 'Sim' : v === 'NAO' ? 'Não' : '—';
}

function rotuloReparo(r?: string | null) {
  return SITUACOES_REPARO.find((x) => x.valor === r)?.rotulo ?? r ?? '';
}

export default function SinistrosPage() {
  const sel = useUnidadeFrotas();
  const { unidade } = sel;
  const placas = usePlacasFrota(unidade);

  const [itens, setItens] = useState<FrotaSinistro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(isoHoje());
  const [placa, setPlaca] = useState('');
  const [causa, setCausa] = useState('TODAS');
  const [frota, setFrota] = useState('TODAS');
  const [seguro, setSeguro] = useState('TODOS');
  const [reparo, setReparo] = useState('TODOS');
  const [faturado, setFaturado] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<FrotaSinistro | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<FrotaSinistro | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    try {
      setItens(await listarSinistros(unidade, de || undefined, ate || undefined));
    } catch (e) {
      setItens([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os sinistros.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // A causa filtra só a tabela; os quadros mostram todas as causas com os demais filtros.
  const semCausa = useMemo(() => {
    const p = normalizarPlaca(placa);
    const b = busca.trim().toLowerCase();
    return itens.filter(
      (s) =>
        (!p || s.placa.includes(p)) &&
        (frota === 'TODAS' || s.tipo_frota === frota) &&
        (seguro === 'TODOS' || (seguroSinistro(s) || 'SEM') === seguro) &&
        (reparo === 'TODOS' || (s.situacao_reparo || 'SEM') === reparo) &&
        (faturado === 'TODOS' || (simNaoCampo(s.faturado) || 'SEM') === faturado) &&
        (!b ||
          `${s.condutor ?? ''} ${s.setor ?? ''} ${s.descricao} ${s.acao_decorrente ?? ''} ${s.pago_pedido ?? ''} ${s.rq106 ?? ''}`
            .toLowerCase()
            .includes(b))
    );
  }, [itens, placa, frota, seguro, reparo, faturado, busca]);
  const linhas = useMemo(
    () => (causa === 'TODAS' ? semCausa : semCausa.filter((s) => s.causa === causa)),
    [semCausa, causa]
  );
  const soma = (lista: FrotaSinistro[]) => lista.reduce((t, s) => t + (s.valor ?? 0), 0);
  const total = soma(linhas);
  const setores = useMemo(() => [...new Set(itens.map((s) => s.setor).filter(Boolean) as string[])].sort(), [itens]);
  const condutores = useMemo(
    () => [...new Set([...itens.map((s) => s.condutor), ...placas.map((p) => p.responsavel_nome)].filter(Boolean) as string[])].sort(),
    [itens, placas]
  );
  const filtrosAtivos =
    !!placa || !!busca || causa !== 'TODAS' || frota !== 'TODAS' || seguro !== 'TODOS' || reparo !== 'TODOS' || faturado !== 'TODOS';

  const colunas: ColumnDef<FrotaSinistro>[] = useMemo(
    () => [
      {
        id: 'data',
        header: 'Data',
        cell: ({ row }) =>
          row.original.data_sinistro ? dataBr(row.original.data_sinistro) : <span className="text-muted-foreground">Sem data</span>,
      },
      {
        id: 'placa',
        header: 'Placa',
        cell: ({ row }) => (
          <div className="leading-tight">
            <span className="font-mono font-medium">{row.original.placa}</span>
            <p className="text-xs text-muted-foreground">{rotuloFrota(row.original.tipo_frota)}</p>
          </div>
        ),
      },
      { id: 'causa', header: 'Causa', cell: ({ row }) => <span className="text-sm">{rotuloCausa(row.original.causa)}</span> },
      {
        id: 'condutor',
        header: 'Condutor / setor',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p>{row.original.condutor || <span className="text-muted-foreground">—</span>}</p>
            {row.original.setor && <p className="text-xs text-muted-foreground">{row.original.setor}</p>}
          </div>
        ),
      },
      {
        id: 'descricao',
        header: 'Resumo',
        cell: ({ row }) => (
          <div className="leading-tight max-w-80">
            <p className="truncate" title={row.original.descricao}>
              {row.original.descricao}
            </p>
            {row.original.acao_decorrente && (
              <p className="text-xs text-muted-foreground truncate" title={row.original.acao_decorrente}>
                Ação: {row.original.acao_decorrente}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'seguro',
        header: 'Seguro',
        cell: ({ row }) => {
          const v = seguroSinistro(row.original);
          return !v ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Badge variant={v === 'NAO' ? 'outline' : v === 'TERCEIROS' ? 'secondary' : 'default'}>{seguroTexto(row.original)}</Badge>
          );
        },
      },
      {
        id: 'controle',
        header: 'Reparo e faturamento',
        cell: ({ row }) => {
          const s = row.original;
          const partes = [
            s.situacao_reparo && rotuloReparo(s.situacao_reparo),
            s.faturado != null && `Faturado: ${rotuloSimNao(s.faturado)}`,
            s.pago_pedido && `Pago/pedido: ${s.pago_pedido}`,
            s.valor_reembolsado != null && `Reembolsado: ${brl(s.valor_reembolsado)}`,
            s.rq106 && `RQ-106: ${s.rq106}`,
          ].filter(Boolean) as string[];
          return partes.length ? (
            <div className="text-xs leading-tight space-y-0.5">
              {partes.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: 'valor',
        header: () => <div className="text-right">Custo de reparo</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {row.original.valor != null ? brl(row.original.valor) : <span className="text-muted-foreground">—</span>}
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
            abrir={() => anexoSinistro(row.original.id)}
            baixar={() => anexoSinistro(row.original.id, row.original.nome_arquivo)}
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
    const daCausa = (c: string) => semCausa.filter((s) => s.causa === c);
    const simNao = { SIM: 'sim', NAO: 'não', TERCEIROS: 'seguro de terceiros', SEM: 'não informado' } as Record<string, string>;
    return {
      titulo: 'Sinistros',
      subtitulo: 'Gestão de frotas',
      unidade,
      periodo: textoPeriodo(de, ate),
      arquivo: `sinistros-${unidade}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      kpis: [
        { rotulo: 'Total', valor: brl(soma(semCausa)), detalhe: `${semCausa.length} sinistro(s)` },
        ...CAUSAS_SINISTRO.map((c) => ({ rotulo: c.rotulo, valor: brl(soma(daCausa(c.valor))), detalhe: `${daCausa(c.valor).length} sinistro(s)` })),
      ],
      secoes: [{
        titulo: 'Sinistros',
        nota: `${linhas.length} sinistro(s) · ${brl(total)} · ${textoFiltros([
          ['Placa', normalizarPlaca(placa)],
          ['Causa', causa !== 'TODAS' && rotuloCausa(causa)],
          ['Frota', frota !== 'TODAS' && rotuloFrota(frota)],
          ['Seguro', seguro !== 'TODOS' && simNao[seguro]],
          ['Reparo', reparo !== 'TODOS' && (reparo === 'SEM' ? 'não informado' : rotuloReparo(reparo))],
          ['Faturado', faturado !== 'TODOS' && simNao[faturado]],
          ['Busca', busca.trim()],
        ])}`,
        colunas: [
          { titulo: 'Data', largura: 17 }, { titulo: 'Placa', largura: 19 }, { titulo: 'Causa', largura: 28 },
          { titulo: 'Condutor / setor', largura: 30 }, { titulo: 'Resumo', largura: 48 }, { titulo: 'Seguro / reparo', largura: 24 },
          { titulo: 'Custo de reparo', largura: 24, alinhar: 'right' },
        ],
        linhas: linhas.map((s) => [
          s.data_sinistro ? { texto: dataBr(s.data_sinistro) } : { texto: 'Sem data', cor: COR_PDF.muted },
          { texto: s.placa, negrito: true, sub: rotuloFrota(s.tipo_frota) },
          { texto: rotuloCausa(s.causa) },
          { texto: s.condutor || '—', sub: s.setor || undefined, cor: s.condutor ? undefined : COR_PDF.muted },
          { texto: s.descricao, sub: s.acao_decorrente ? `Ação: ${s.acao_decorrente}` : undefined },
          {
            texto: `Seguro: ${seguroTexto(s)}`,
            sub: [s.situacao_reparo && rotuloReparo(s.situacao_reparo), s.valor_reembolsado != null && `reemb. ${brl(s.valor_reembolsado)}`]
              .filter(Boolean).join(' · ') || undefined,
          },
          s.valor != null ? { texto: brl(s.valor), negrito: true } : { texto: '—', cor: COR_PDF.muted },
        ]),
      }],
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Sinistros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acidentes, panes e acionamentos de seguro, inclusive de carros de locadora. Fica só no PaperSign.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <SeletorUnidade {...sel} />
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" onClick={() => setEditando('novo')} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Novo sinistro
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <CartaoIndicador icone={ShieldAlert} tom="vermelho" destaque rotulo="Total" ativo={causa === 'TODAS'}
          onClick={() => setCausa('TODAS')} valor={brl(soma(semCausa))} detalhe={`${semCausa.length} sinistro(s)`} />
        {CAUSAS_SINISTRO.map((c) => {
          const daCausa = semCausa.filter((s) => s.causa === c.valor);
          return (
            <CartaoIndicador key={c.valor} {...ESTILO_CAUSA[c.valor]} rotulo={c.rotulo} ativo={causa === c.valor}
              onClick={() => setCausa(causa === c.valor ? 'TODAS' : c.valor)}
              valor={brl(soma(daCausa))} detalhe={`${daCausa.length} sinistro(s)`} />
          );
        })}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Sinistros ({unidade || '—'})</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Sinistro" />
            <div className="space-y-1">
              <Label>Placa</Label>
              <Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Todas" className="w-32 font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Causa</Label>
              <Select value={causa} onValueChange={setCausa}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {CAUSAS_SINISTRO.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frota</Label>
              <Select value={frota} onValueChange={setFrota}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {TIPOS_FROTA.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Seguro acionado</Label>
              <Select value={seguro} onValueChange={setSeguro}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NAO">Não</SelectItem>
                  <SelectItem value="TERCEIROS">Seguro de terceiros</SelectItem>
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reparo</Label>
              <Select value={reparo} onValueChange={setReparo}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {SITUACOES_REPARO.map((r) => (
                    <SelectItem key={r.valor} value={r.valor}>
                      {r.rotulo}
                    </SelectItem>
                  ))}
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Faturado</Label>
              <Select value={faturado} onValueChange={setFaturado}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NAO">Não</SelectItem>
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Condutor, setor, resumo, ação...</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="w-56" />
            </div>
            {filtrosAtivos && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPlaca('');
                  setBusca('');
                  setCausa('TODAS');
                  setFrota('TODAS');
                  setSeguro('TODOS');
                  setReparo('TODOS');
                  setFaturado('TODOS');
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
            emptyMessage={filtrosAtivos ? 'Nenhum sinistro com esses filtros.' : 'Nenhum sinistro no período.'}
          />
        </CardContent>
      </Card>

      <FormSinistro
        unidade={unidade}
        placas={placas}
        setores={setores}
        condutores={condutores}
        registro={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          void carregar();
        }}
      />

      <DialogExclusao
        aberto={!!excluindo}
        titulo="Excluir sinistro"
        descricao={
          excluindo
            ? `${excluindo.placa} · ${excluindo.data_sinistro ? dataBr(excluindo.data_sinistro) : 'sem data'} · ${rotuloCausa(excluindo.causa)}`
            : ''
        }
        onCancelar={() => setExcluindo(null)}
        onConfirmar={async (motivo) => {
          if (!excluindo) return;
          try {
            await excluirSinistro(excluindo.id, motivo);
            toast.success('Sinistro excluído.');
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
  data_sinistro: '',
  causa: '',
  tipo_frota: 'PROPRIA',
  setor: '',
  condutor: '',
  valor: '',
  acionou_seguro: '',
  descricao: '',
  faturado: '',
  pago_pedido: '',
  acao_decorrente: '',
  situacao_reparo: '',
  valor_reembolsado: '',
  rq106: '',
  motivo: '',
};

const SEM_OPCAO = '-';

function FormSinistro({ unidade, placas, setores, condutores, registro, onFechar, onSalvo }: {
  unidade: string;
  placas: FrotaPlaca[];
  setores: string[];
  condutores: string[];
  registro: FrotaSinistro | 'novo' | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const edicao = registro && registro !== 'novo' ? registro : null;

  useEffect(() => {
    if (!registro) return;
    setArquivo(null);
    setForm(
      edicao
        ? {
            placa: edicao.placa,
            data_sinistro: edicao.data_sinistro?.slice(0, 10) ?? '',
            causa: edicao.causa,
            tipo_frota: edicao.tipo_frota,
            setor: edicao.setor ?? '',
            condutor: edicao.condutor ?? '',
            valor: edicao.valor != null ? valorParaCampo(edicao.valor) : '',
            acionou_seguro: seguroSinistro(edicao),
            descricao: edicao.descricao,
            faturado: simNaoCampo(edicao.faturado),
            pago_pedido: edicao.pago_pedido ?? '',
            acao_decorrente: edicao.acao_decorrente ?? '',
            situacao_reparo: edicao.situacao_reparo ?? '',
            valor_reembolsado: edicao.valor_reembolsado != null ? valorParaCampo(edicao.valor_reembolsado) : '',
            rq106: edicao.rq106 ?? '',
            motivo: '',
          }
        : FORM_VAZIO
    );
  }, [registro, edicao]);

  const set = (campo: keyof typeof FORM_VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));

  function trocarPlaca(valor: string) {
    const placa = valor.toUpperCase();
    const doRm = placas.find((p) => p.placa === normalizarPlaca(placa));
    setForm((f) => ({ ...f, placa, condutor: f.condutor || doRm?.responsavel_nome || '' }));
  }

  async function salvar() {
    const placa = normalizarPlaca(form.placa);
    if (!placa) return void toast.error('Informe a placa.');
    if (!form.data_sinistro) return void toast.error('Informe a data do sinistro.');
    if (!form.causa) return void toast.error('Escolha a causa.');
    if (form.descricao.trim().length < 3) return void toast.error('Descreva o ocorrido.');
    const valor = form.valor.trim() ? valorParaApi(form.valor) : '';
    if (form.valor.trim() && (!valor || Number(valor) < 0)) return void toast.error('Custo de reparo inválido.');
    const reembolsado = form.valor_reembolsado.trim() ? valorParaApi(form.valor_reembolsado) : '';
    if (form.valor_reembolsado.trim() && (!reembolsado || Number(reembolsado) < 0))
      return void toast.error('Valor reembolsado inválido.');
    const texto = (v: string) => v.trim() || undefined;
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) return void toast.error(`Arquivo maior que ${MAX_MB} MB.`);

    setSalvando(true);
    try {
      await salvarSinistro(
        {
          unidade,
          placa,
          data_sinistro: form.data_sinistro,
          causa: form.causa,
          tipo_frota: form.tipo_frota,
          setor: form.setor.trim() || undefined,
          condutor: form.condutor.trim() || undefined,
          valor: valor || undefined,
          acionou_seguro: texto(form.acionou_seguro),
          descricao: form.descricao.trim(),
          faturado: texto(form.faturado),
          pago_pedido: texto(form.pago_pedido),
          acao_decorrente: texto(form.acao_decorrente),
          situacao_reparo: texto(form.situacao_reparo),
          valor_reembolsado: reembolsado || undefined,
          rq106: texto(form.rq106),
          motivo: form.motivo.trim() || undefined,
          arquivo,
        },
        edicao?.id
      );
      toast.success(edicao ? 'Sinistro alterado.' : `Sinistro da placa ${placa} registrado.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar o sinistro.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!registro} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicao ? `Alterar sinistro · ${edicao.placa}` : 'Novo sinistro'}</DialogTitle>
          <DialogDescription>
            {unidade} · placa de locadora pode ser digitada mesmo que não esteja no RM.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Placa</Label>
            <Input
              list="placas-form-sinistro"
              value={form.placa}
              onChange={(e) => trocarPlaca(e.target.value)}
              className="font-mono"
              maxLength={8}
              disabled={salvando}
            />
            <datalist id="placas-form-sinistro">
              {placas.map((p) => (
                <option key={p.placa} value={p.placa}>
                  {[p.frota, p.modelo].filter(Boolean).join(' · ')}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Data do sinistro</Label>
            <Input type="date" value={form.data_sinistro} onChange={(e) => set('data_sinistro')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Causa</Label>
            <Select value={form.causa} onValueChange={set('causa')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {CAUSAS_SINISTRO.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Frota (de quem é o carro)</Label>
            <Select value={form.tipo_frota} onValueChange={set('tipo_frota')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FROTA.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Condutor</Label>
            <Input list="condutores-sinistro" value={form.condutor} maxLength={150}
              onChange={(e) => set('condutor')(e.target.value)} disabled={salvando} />
            <datalist id="condutores-sinistro">
              {condutores.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Setor</Label>
            <Input list="setores-sinistro" value={form.setor} maxLength={100}
              onChange={(e) => set('setor')(e.target.value)} disabled={salvando} />
            <datalist id="setores-sinistro">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Custo de reparo (R$, opcional)</Label>
            <Input value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => set('valor')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Acionou o seguro?</Label>
            <SelectSimNao valor={form.acionou_seguro} onChange={set('acionou_seguro')} disabled={salvando} extras={SEGURO_TERCEIROS} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Resumo do ocorrido</Label>
            <Textarea value={form.descricao} maxLength={2000} rows={4}
              onChange={(e) => set('descricao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Ação decorrente</Label>
            <Textarea value={form.acao_decorrente} maxLength={500} rows={2}
              onChange={(e) => set('acao_decorrente')(e.target.value)} disabled={salvando} />
          </div>

          <p className="sm:col-span-2 pt-2 text-sm font-medium border-t">Reparo e faturamento</p>
          <div className="space-y-1">
            <Label>Situação do reparo</Label>
            <Select
              value={form.situacao_reparo || SEM_OPCAO}
              onValueChange={(v) => set('situacao_reparo')(v === SEM_OPCAO ? '' : v)}
              disabled={salvando}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_OPCAO}>Não informado</SelectItem>
                {SITUACOES_REPARO.map((r) => (
                  <SelectItem key={r.valor} value={r.valor}>
                    {r.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Faturado</Label>
            <SelectSimNao valor={form.faturado} onChange={set('faturado')} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Pago / nº do pedido</Label>
            <Input value={form.pago_pedido} maxLength={60} onChange={(e) => set('pago_pedido')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Valor reembolsado (R$)</Label>
            <Input value={form.valor_reembolsado} inputMode="decimal" placeholder="0,00"
              onChange={(e) => set('valor_reembolsado')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>RQ-106</Label>
            <Input list="rq106-sinistro" value={form.rq106} maxLength={40} onChange={(e) => set('rq106')(e.target.value)} disabled={salvando} />
            <datalist id="rq106-sinistro">
              {SUGESTOES_RQ106.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>{edicao?.nome_arquivo ? 'Trocar anexo (opcional)' : 'B.O., fotos ou orçamento (opcional)'}</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={salvando} />
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
