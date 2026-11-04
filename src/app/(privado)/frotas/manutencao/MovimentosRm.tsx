'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  Wand2,
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
import {
  CLASSIFICACOES_DESPESA,
  CLASSIFICACOES_MANUTENCAO,
  completarNotasComRm,
  lancarMovimentoRm,
  listarMovimentosRm,
  MovimentoRm,
  normalizarPlaca,
  placaValida,
  ResumoCompletarNotasRm,
  SERVICOS_MANUTENCAO,
  STATUS_PEDIDO_RM,
} from '@/services/frotasService';
import { brl, CartaoIndicador, FiltroPeriodo, inicioDoAno, isoHoje, usePlacasFrota } from '../comum';
import { dataBr } from '../VeiculoDialog';
import { formatarDocumento } from './comumManutencao';

const TODOS = 'TODOS';

const ESTILO_STATUS: Record<string, string> = {
  A: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  F: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  C: 'border-red-500/40 text-red-700 dark:text-red-300',
};

function rotuloStatusPedido(s: string) {
  return STATUS_PEDIDO_RM.find((x) => x.valor === s)?.rotulo ?? s;
}

const placasDoPedido = (m: MovimentoRm) =>
  Array.from(new Set(m.itens.map((i) => i.placa).filter((p): p is string => !!p)));

/**
 * Pedidos de compra da frota no RM (movimento 1.1.36): status, NF gerada, itens com placa e centro de custo.
 * Daqui o pedido vira nota do Frotas (fornecedor e itens do RM) e as notas da planilha sem itens são completadas.
 */
export default function MovimentosRm({ unidade, onMudou }: { unidade: string; onMudou: () => void }) {
  const [movimentos, setMovimentos] = useState<MovimentoRm[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(isoHoje());
  const [status, setStatus] = useState<string>(TODOS);
  const [busca, setBusca] = useState('');
  const [filtroFrotas, setFiltroFrotas] = useState<'' | 'fora' | 'dentro' | 'sem_placa'>('');
  const [aberto, setAberto] = useState<MovimentoRm | null>(null);
  const [completando, setCompletando] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    setCarregando(true);
    try {
      setMovimentos(await listarMovimentosRm(unidade, de, ate));
    } catch (e) {
      setMovimentos([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os movimentos do RM.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const conta = useMemo(() => {
    const c = { A: 0, F: 0, C: 0, valor: 0, dentro: 0, fora: 0, semPlaca: 0 };
    for (const m of movimentos) {
      if (m.status in c) c[m.status as 'A' | 'F' | 'C']++;
      if (m.status !== 'C') {
        c.valor += m.valor_itens;
        if (m.vinculo === 'VINCULADA' || (m.nota_frotas_itens ?? 0) > 0) c.dentro++;
        else c.fora++;
        if (m.itens.some((i) => !i.placa)) c.semPlaca++;
      }
    }
    return c;
  }, [movimentos]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const p = normalizarPlaca(busca);
    return movimentos.filter((m) => {
      if (status !== TODOS && m.status !== status) return false;
      const noFrotas = m.vinculo === 'VINCULADA' || (m.nota_frotas_itens ?? 0) > 0;
      if (filtroFrotas === 'dentro' && !noFrotas) return false;
      if (filtroFrotas === 'fora' && (noFrotas || m.status === 'C')) return false;
      if (filtroFrotas === 'sem_placa' && (m.status === 'C' || !m.itens.some((i) => !i.placa))) return false;
      if (!b) return true;
      return (
        m.numero.includes(b) ||
        (m.nf?.numero ?? '').includes(b) ||
        (m.fornecedor ?? '').toLowerCase().includes(b) ||
        (m.fornecedor_codcfo ?? '').toLowerCase().includes(b) ||
        m.itens.some(
          (i) =>
            (p.length >= 3 && normalizarPlaca(i.placa ?? '').includes(p)) ||
            (i.historico ?? '').toLowerCase().includes(b) ||
            (i.produto ?? '').toLowerCase().includes(b) ||
            (i.desc_ccusto ?? '').toLowerCase().includes(b)
        )
      );
    });
  }, [movimentos, status, busca, filtroFrotas]);

  const alternarStatus = (s: string) => setStatus((atual) => (atual === s ? TODOS : s));
  const alternarFrotas = (f: typeof filtroFrotas) => setFiltroFrotas((atual) => (atual === f ? '' : f));
  const limparFiltrosPedidos = () => {
    setStatus(TODOS);
    setFiltroFrotas('');
  };

  const colunas: ColumnDef<MovimentoRm>[] = [
    {
      id: 'pedido',
      header: 'Pedido 1.1.36',
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-mono font-medium">{row.original.numero}</div>
          <div className="text-xs text-muted-foreground">{row.original.data_emissao ? dataBr(row.original.data_emissao) : '—'}</div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={ESTILO_STATUS[row.original.status] ?? ''}>
          {rotuloStatusPedido(row.original.status)}
        </Badge>
      ),
    },
    {
      id: 'fornecedor',
      header: 'Fornecedor (RM)',
      cell: ({ row }) => (
        <div className="max-w-[16rem] text-sm">
          <div className="truncate" title={row.original.fornecedor ?? ''}>
            {row.original.fornecedor || '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.original.fornecedor_codcfo} {row.original.fornecedor_cnpj ? `· ${formatarDocumento(row.original.fornecedor_cnpj)}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'nf',
      header: 'NF gerada',
      cell: ({ row }) => {
        const nf = row.original.nf;
        if (!nf) return <span className="text-xs text-muted-foreground">{row.original.status === 'A' ? 'Aguardando NF' : '—'}</span>;
        return (
          <div className="text-sm">
            <div className="font-mono">{nf.numero.replace(/^0+(?=\d)/, '')}</div>
            <div className="text-xs text-muted-foreground" title={nf.nome_tmv ?? ''}>
              {nf.codtmv} · {nf.data_emissao ? dataBr(nf.data_emissao) : ''}
              {row.original.qtd_nfs > 1 ? ` · +${row.original.qtd_nfs - 1}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      id: 'valor',
      header: 'Valor',
      cell: ({ row }) => (
        <div className="text-sm tabular-nums">
          <div>{brl(row.original.valor_itens)}</div>
          {row.original.nf && Math.abs(row.original.nf.valor - row.original.valor_itens) > 0.01 && (
            <div className="text-xs text-muted-foreground" title="Valor líquido da NF (com descontos e retenções)">
              NF {brl(row.original.nf.valor)}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'placas',
      header: 'Placas',
      cell: ({ row }) => {
        const placas = placasDoPedido(row.original);
        const sem = row.original.itens.filter((i) => !i.placa).length;
        return (
          <div className="flex max-w-[14rem] flex-wrap gap-1">
            {placas.map((p) => (
              <Badge key={p} variant="secondary" className="font-mono text-xs">
                {p}
              </Badge>
            ))}
            {sem > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-xs text-amber-700 dark:text-amber-300">
                {sem} sem placa
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'frotas',
      header: 'No Frotas',
      cell: ({ row }) => <SituacaoFrotas m={row.original} />,
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setAberto(row.original)}>
          {podeLancar(row.original) ? 'Lançar' : 'Ver'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CartaoIndicador icone={ClipboardList} tom="cinza" destaque rotulo="Pedidos no período" valor={movimentos.length}
          detalhe={`${brl(conta.valor)} sem os cancelados`}
          ativo={status === TODOS && filtroFrotas === ''} onClick={limparFiltrosPedidos} />
        <CartaoIndicador icone={Clock} tom="azul" rotulo="Abertos" valor={conta.A} ativo={status === 'A'} onClick={() => alternarStatus('A')}
          detalhe="Ainda sem NF no RM" />
        <CartaoIndicador icone={FileCheck2} tom="verde" rotulo="Faturados" valor={conta.F} ativo={status === 'F'} onClick={() => alternarStatus('F')}
          detalhe="Já geraram a NF" />
        <CartaoIndicador icone={Ban} tom="vermelho" rotulo="Cancelados" valor={conta.C} ativo={status === 'C'} onClick={() => alternarStatus('C')} />
        <CartaoIndicador icone={CheckCircle2} tom="roxo" rotulo="Já no Frotas" valor={conta.dentro}
          detalhe={`${conta.fora} ainda fora`} ativo={filtroFrotas === 'dentro'} onClick={() => alternarFrotas('dentro')} />
        <CartaoIndicador icone={AlertTriangle} tom="ambar" rotulo="Com item sem placa" valor={conta.semPlaca}
          detalhe="Informe a placa ao lançar" ativo={filtroFrotas === 'sem_placa'} onClick={() => alternarFrotas('sem_placa')} />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Pedidos de compra da frota (RM 1.1.36)</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant={filtroFrotas === 'fora' ? 'default' : 'outline'} size="sm" onClick={() => alternarFrotas('fora')}>
                Só os que faltam no Frotas
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCompletando(true)}>
                <Wand2 className="mr-1.5 h-4 w-4" /> Completar notas da planilha
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Emissão" />
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {STATUS_PEDIDO_RM.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Pedido, NF, fornecedor, placa, histórico..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando} title="Recarregar do RM">
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <DataTable
              columns={colunas}
              data={filtrados}
              loading={carregando}
              hideSearch
              emptyMessage="Nenhum pedido 1.1.36 no período."
            />
          </div>
        </CardContent>
      </Card>

      {aberto && (
        <DialogLancarMovimento
          unidade={unidade}
          movimento={aberto}
          onFechar={() => setAberto(null)}
          onLancou={() => {
            setAberto(null);
            void carregar();
            onMudou();
          }}
        />
      )}

      {completando && (
        <DialogCompletarNotas
          unidade={unidade}
          de={de}
          ate={ate}
          onFechar={() => setCompletando(false)}
          onAplicou={() => {
            void carregar();
            onMudou();
          }}
        />
      )}
    </div>
  );
}

function podeLancar(m: MovimentoRm) {
  return m.status !== 'C' && m.vinculo !== 'VINCULADA' && !((m.nota_frotas_itens ?? 0) > 0);
}

function SituacaoFrotas({ m }: { m: MovimentoRm }) {
  if (m.vinculo === 'VINCULADA')
    return (
      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
        Nota #{m.nota_frotas_id}
      </Badge>
    );
  if (m.nota_frotas_id && (m.nota_frotas_itens ?? 0) > 0)
    return (
      <Badge variant="outline" title="A planilha já trouxe essa NF com itens">
        Planilha #{m.nota_frotas_id}
      </Badge>
    );
  if (m.nota_frotas_id)
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300" title="Nota da planilha sem itens: ao lançar, ela é completada">
        Planilha sem itens
      </Badge>
    );
  if (m.vinculo === 'AMBIGUA')
    return <span className="text-xs text-amber-600 dark:text-amber-400">NF repetida no Frotas</span>;
  return <span className="text-xs text-muted-foreground">—</span>;
}

type LinhaItem = { nseq: number; incluir: boolean; placa: string; classificacao: string; servico: string };

function DialogLancarMovimento({
  unidade,
  movimento: m,
  onFechar,
  onLancou,
}: {
  unidade: string;
  movimento: MovimentoRm;
  onFechar: () => void;
  onLancou: () => void;
}) {
  const placasRm = usePlacasFrota(unidade);
  const editavel = podeLancar(m);
  const [linhas, setLinhas] = useState<LinhaItem[]>(() =>
    m.itens.map((i) => ({
      nseq: i.nseq,
      incluir: i.valor > 0,
      placa: i.placa ?? '',
      classificacao: i.classificacao_sugerida,
      servico: i.servico_sugerido,
    }))
  );
  const [salvando, setSalvando] = useState(false);

  const alterar = (nseq: number, mudanca: Partial<LinhaItem>) =>
    setLinhas((ls) => ls.map((l) => (l.nseq === nseq ? { ...l, ...mudanca } : l)));

  const incluidos = linhas.filter((l) => l.incluir);
  const total = m.itens.filter((i) => incluidos.some((l) => l.nseq === i.nseq)).reduce((s, i) => s + i.valor, 0);

  const lancar = async () => {
    if (incluidos.length === 0) {
      toast.error('Marque ao menos um item para lançar.');
      return;
    }
    const semPlaca = incluidos.find((l) => !placaValida(normalizarPlaca(l.placa)));
    if (semPlaca) {
      toast.error(`Item ${semPlaca.nseq}: informe uma placa válida.`);
      return;
    }
    setSalvando(true);
    try {
      const r = await lancarMovimentoRm(
        unidade,
        m.idmov,
        incluidos.map((l) => ({ nseq: l.nseq, placa: normalizarPlaca(l.placa), classificacao: l.classificacao, servico: l.servico }))
      );
      toast.success(r.completada ? `Nota da planilha #${r.id} completada com os itens do RM.` : `Nota #${r.id} lançada no Frotas.`);
      onLancou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao lançar o pedido.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Pedido {m.numero} · {rotuloStatusPedido(m.status)}
          </DialogTitle>
          <DialogDescription>
            {m.fornecedor} ({m.fornecedor_codcfo}) · emitido em {m.data_emissao ? dataBr(m.data_emissao) : '—'}
            {m.nf
              ? ` · NF ${m.nf.numero.replace(/^0+(?=\d)/, '')} (${m.nf.codtmv}) de ${m.nf.data_emissao ? dataBr(m.nf.data_emissao) : '—'}, ${brl(m.nf.valor)}`
              : ' · ainda sem NF'}
            {m.nota_frotas_id && !editavel ? ` · já está no Frotas (nota #${m.nota_frotas_id})` : ''}
            {m.nota_frotas_id && editavel ? ` · vai completar a nota #${m.nota_frotas_id} da planilha` : ''}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          O fornecedor e os valores vêm do RM. A placa veio do item ou do histórico; confira a classificação sugerida e desmarque o que não é da frota.
          A região sai da lotação da placa; sem lotação, do centro de custo do item.
        </p>

        <div className="space-y-3">
          {m.itens.map((i) => {
            const l = linhas.find((x) => x.nseq === i.nseq)!;
            const opcoesPlaca = Array.from(new Set([...i.placas_historico, ...(i.placa ? [i.placa] : [])]));
            return (
              <div key={i.nseq} className={`rounded-lg border p-3 ${l.incluir ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={l.incluir}
                      disabled={!editavel}
                      onChange={(e) => alterar(i.nseq, { incluir: e.target.checked })}
                    />
                    <span>
                      <span className="font-medium">
                        {i.nseq}. {i.produto || i.codigo_produto}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {i.codigo_produto} · {i.desc_ccusto || i.codccusto || 'sem centro de custo'}
                        {i.regiao_ccusto ? ` (${i.regiao_ccusto})` : ''}
                        {i.hodometro ? ` · hodômetro ${i.hodometro}` : ''}
                      </span>
                    </span>
                  </label>
                  <span className="text-sm font-semibold tabular-nums">{brl(i.valor)}</span>
                </div>
                {i.historico && <p className="mt-1 text-xs text-muted-foreground">{i.historico}</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Placa{' '}
                      {i.placa_origem === 'HISTORICO' && <span className="text-muted-foreground">(achada no histórico)</span>}
                      {i.placa_origem === 'RM' && <span className="text-muted-foreground">(do item no RM)</span>}
                    </Label>
                    <Input
                      list={`placas-rm-${i.nseq}`}
                      value={l.placa}
                      disabled={!editavel || !l.incluir}
                      onChange={(e) => alterar(i.nseq, { placa: e.target.value.toUpperCase() })}
                      placeholder="ABC1D23"
                      className="font-mono"
                    />
                    <datalist id={`placas-rm-${i.nseq}`}>
                      {[...opcoesPlaca, ...placasRm.map((p) => p.placa)].map((p, k) => (
                        <option key={`${p}-${k}`} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Classificação</Label>
                    <Select
                      value={l.classificacao}
                      disabled={!editavel || !l.incluir}
                      onValueChange={(v) => alterar(i.nseq, { classificacao: v, servico: CLASSIFICACOES_DESPESA.has(v) ? 'OUTRO' : l.servico })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLASSIFICACOES_MANUTENCAO.map((c) => (
                          <SelectItem key={c.valor} value={c.valor}>
                            {c.rotulo}
                            {c.grupo === 'DESPESA' ? ' (despesa)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de serviço</Label>
                    <Select
                      value={l.servico}
                      disabled={!editavel || !l.incluir || CLASSIFICACOES_DESPESA.has(l.classificacao)}
                      onValueChange={(v) => alterar(i.nseq, { servico: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {incluidos.length} de {m.itens.length} itens · {brl(total)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onFechar} disabled={salvando}>
              {editavel ? 'Cancelar' : 'Fechar'}
            </Button>
            {editavel && (
              <Button onClick={() => void lancar()} disabled={salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {m.nota_frotas_id ? 'Completar a nota' : 'Lançar no Frotas'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROTULO_CASAMENTO: Record<string, string> = {
  NF_FORNECEDOR: 'NF e fornecedor',
  NF_VALOR: 'NF e valor (sem fornecedor)',
};

function DialogCompletarNotas({
  unidade,
  de,
  ate,
  onFechar,
  onAplicou,
}: {
  unidade: string;
  de: string;
  ate: string;
  onFechar: () => void;
  onAplicou: () => void;
}) {
  const [resumo, setResumo] = useState<ResumoCompletarNotasRm | null>(null);
  const [rodando, setRodando] = useState(false);

  const rodar = async (aplicar: boolean) => {
    setRodando(true);
    try {
      const r = await completarNotasComRm(unidade, aplicar, de, ate);
      setResumo(r);
      if (aplicar) {
        toast.success(`${r.completadas - r.erros} notas completadas com ${r.itens} itens do RM.`);
        onAplicou();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao completar as notas.');
    } finally {
      setRodando(false);
    }
  };

  useEffect(() => {
    void rodar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const comItens = resumo?.linhas.filter((l) => l.itens > 0) ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Completar as notas da planilha com o RM</DialogTitle>
          <DialogDescription>
            Para as notas sem itens, procura no RM o pedido 1.1.36 faturado com a mesma NF (e o mesmo fornecedor, ou o mesmo valor quando a
            nota está sem fornecedor) e cria os itens com a placa e a classificação sugeridas. Nota pendente por falta de fornecedor recebe
            o fornecedor do pedido. Período: {dataBr(de)} a {dataBr(ate)}.
          </DialogDescription>
        </DialogHeader>

        {rodando && !resumo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Simulando...
          </div>
        )}

        {resumo && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Resumo rotulo="Pedidos faturados lidos" valor={resumo.pedidos_lidos} />
              <Resumo rotulo={resumo.aplicar ? 'Notas completadas' : 'Notas a completar'} valor={resumo.completadas - resumo.erros} />
              <Resumo rotulo="Itens" valor={resumo.itens} />
              <Resumo rotulo="Casaram, mas sem placa" valor={resumo.sem_placa} />
            </div>
            {resumo.ambiguas > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {resumo.ambiguas} NFs aparecem mais de uma vez no Frotas e ficaram de fora; lance essas pela lista.
              </p>
            )}
            {resumo.erros > 0 && <p className="text-sm text-red-600 dark:text-red-400">{resumo.erros} notas deram erro ao gravar.</p>}
            {comItens.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-md border text-sm">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted text-xs">
                    <tr>
                      <th className="p-2 text-left">NF</th>
                      <th className="p-2 text-left">Pedido</th>
                      <th className="p-2 text-left">Casou por</th>
                      <th className="p-2 text-right">Nota</th>
                      <th className="p-2 text-right">RM</th>
                      <th className="p-2 text-right">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comItens.slice(0, 300).map((l) => (
                      <tr key={l.id_nota} className="border-t">
                        <td className="p-2 font-mono">{l.numero_nf}</td>
                        <td className="p-2 font-mono">{l.pedido}</td>
                        <td className="p-2">{ROTULO_CASAMENTO[l.como] ?? l.como}</td>
                        <td className="p-2 text-right tabular-nums">{brl(l.valor_nota)}</td>
                        <td className={`p-2 text-right tabular-nums ${Math.abs(l.valor_nota - l.valor_rm) > 0.01 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {brl(l.valor_rm)}
                        </td>
                        <td className="p-2 text-right">
                          {l.itens}
                          {l.itens_sem_placa > 0 ? ` (+${l.itens_sem_placa} sem placa)` : ''}
                          {l.erro ? <span className="block text-xs text-red-600">{l.erro}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={rodando}>
            Fechar
          </Button>
          {resumo && !resumo.aplicar && resumo.completadas > 0 && (
            <Button onClick={() => void rodar(true)} disabled={rodando}>
              {rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gravar {resumo.completadas} notas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-bold tabular-nums">{valor}</p>
    </div>
  );
}
