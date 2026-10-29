'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Route,
  Scale,
  Trash2,
  UserCheck,
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
import {
  anexoMulta,
  condutorProvavel,
  CondutorProvavel,
  excluirMulta,
  FrotaCondutor,
  FrotaMulta,
  FrotaPlaca,
  listarCondutores,
  listarMultas,
  normalizarPlaca,
  NOTIFICACAO_AUTUACAO,
  salvarMulta,
  situacaoDesconto,
  SITUACOES_DESCONTO,
  SITUACOES_MULTA,
  SUGESTOES_REEMBOLSO,
  SUGESTOES_RQ131,
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

const ESTILO_SITUACAO: Record<string, { icone: LucideIcon; tom: TomIndicador }> = {
  A_PAGAR: { icone: Clock, tom: 'ambar' },
  PAGA: { icone: CircleCheck, tom: 'verde' },
  RECORRIDA: { icone: Scale, tom: 'roxo' },
  CANCELADA: { icone: CircleX, tom: 'cinza' },
  NAO_INFORMADA: { icone: CircleHelp, tom: 'cinza' },
};

const COR_SITUACAO: Record<string, string> = {
  A_PAGAR: 'border-amber-500 text-amber-700 dark:text-amber-400',
  PAGA: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
  RECORRIDA: 'border-sky-500 text-sky-700 dark:text-sky-400',
  CANCELADA: 'border-slate-400 text-slate-600 dark:text-slate-300',
  NAO_INFORMADA: 'border-dashed border-slate-400 text-muted-foreground',
};

function rotuloSituacao(s: string) {
  return SITUACOES_MULTA.find((x) => x.valor === s)?.rotulo ?? s;
}

function rotuloFrota(t?: string | null) {
  return t ? (TIPOS_FROTA.find((x) => x.valor === t)?.rotulo ?? t) : '';
}

/** Opções distintas de um campo de texto (para filtros e sugestões). */
function distintos(itens: FrotaMulta[], campo: (m: FrotaMulta) => string | null | undefined) {
  return [...new Set(itens.map(campo).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
}

function multaVencida(m: FrotaMulta, hoje: string) {
  return m.situacao === 'A_PAGAR' && !!m.data_vencimento && m.data_vencimento.slice(0, 10) < hoje;
}

/** Chave do filtro de condutor: id do cadastro ou o nome digitado (multa sem vínculo). */
function chaveCondutor(m: FrotaMulta) {
  return m.id_condutor ? String(m.id_condutor) : m.condutor ? `nome:${m.condutor}` : 'SEM';
}

export default function MultasPage() {
  const sel = useUnidadeFrotas();
  const { unidade } = sel;
  const placas = usePlacasFrota(unidade);
  const hoje = isoHoje();

  const [itens, setItens] = useState<FrotaMulta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(isoHoje());
  const [placa, setPlaca] = useState('');
  const [situacao, setSituacao] = useState('TODAS');
  const [filtroCondutor, setFiltroCondutor] = useState('TODOS');
  const [filtroFrota, setFiltroFrota] = useState('TODAS');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [filtroFaturada, setFiltroFaturada] = useState('TODAS');
  const [filtroRq131, setFiltroRq131] = useState('TODOS');
  const [filtroDesconto, setFiltroDesconto] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [cadastrados, setCadastrados] = useState<FrotaCondutor[]>([]);

  useEffect(() => {
    if (!unidade) return;
    listarCondutores(unidade)
      .then(setCadastrados)
      .catch(() => setCadastrados([]));
  }, [unidade]);
  const [editando, setEditando] = useState<FrotaMulta | 'novo' | null>(null);
  const [excluindo, setExcluindo] = useState<FrotaMulta | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    try {
      setItens(await listarMultas(unidade, de || undefined, ate || undefined));
    } catch (e) {
      setItens([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as multas.');
    } finally {
      setCarregando(false);
    }
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Placa e busca valem para os quadros; a situação filtra só a tabela.
  const semSituacao = useMemo(() => {
    const p = normalizarPlaca(placa);
    const b = busca.trim().toLowerCase();
    return itens.filter(
      (m) =>
        (!p || m.placa.includes(p)) &&
        (filtroCondutor === 'TODOS' || chaveCondutor(m) === filtroCondutor) &&
        (filtroFrota === 'TODAS' ||
          (filtroFrota === 'LOCADOS' ? !!m.tipo_frota && m.tipo_frota !== 'PROPRIA' : (m.tipo_frota ?? 'SEM') === filtroFrota)) &&
        (filtroSetor === 'TODOS' || (m.setor ?? 'SEM') === filtroSetor) &&
        (filtroFaturada === 'TODAS' || (simNaoCampo(m.faturada) || 'SEM') === filtroFaturada) &&
        (filtroRq131 === 'TODOS' || (m.rq131 ?? 'SEM') === filtroRq131) &&
        (filtroDesconto === 'TODOS' || situacaoDesconto(m) === filtroDesconto) &&
        (!b ||
          [m.descricao, m.auto_infracao, m.condutor, m.local_infracao, m.numero_pedido, m.fatura, m.reembolso]
            .join(' ')
            .toLowerCase()
            .includes(b))
    );
  }, [itens, placa, busca, filtroCondutor, filtroFrota, filtroSetor, filtroFaturada, filtroRq131, filtroDesconto]);
  const setores = useMemo(() => distintos(itens, (m) => m.setor), [itens]);
  const situacoesRq131 = useMemo(() => distintos(itens, (m) => m.rq131), [itens]);
  const opcoesCondutor = useMemo(() => {
    const mapa = new Map<string, string>();
    cadastrados.forEach((c) => mapa.set(String(c.id), c.nome));
    itens.forEach((m) => {
      const chave = chaveCondutor(m);
      if (chave !== 'SEM') mapa.set(chave, m.id_condutor ? (m.condutor ?? '') : `${m.condutor} (sem cadastro)`);
    });
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [cadastrados, itens]);
  const linhas = useMemo(
    () => (situacao === 'TODAS' ? semSituacao : semSituacao.filter((m) => m.situacao === situacao)),
    [semSituacao, situacao]
  );
  const total = linhas.reduce((s, m) => s + m.valor, 0);
  const condutores = useMemo(
    () => [...new Set([...itens.map((m) => m.condutor), ...placas.map((p) => p.responsavel_nome)].filter(Boolean) as string[])].sort(),
    [itens, placas]
  );
  const filtrosAtivos =
    !!placa || !!busca || situacao !== 'TODAS' || filtroCondutor !== 'TODOS' || filtroFrota !== 'TODAS' ||
    filtroSetor !== 'TODOS' || filtroFaturada !== 'TODAS' || filtroRq131 !== 'TODOS' || filtroDesconto !== 'TODOS';

  const colunas: ColumnDef<FrotaMulta>[] = useMemo(
    () => [
      { id: 'data', header: 'Infração em', cell: ({ row }) => dataBr(row.original.data_infracao) },
      {
        id: 'placa',
        header: 'Placa',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-mono font-medium">{row.original.placa}</p>
            {(row.original.tipo_frota || row.original.setor) && (
              <p className="text-xs text-muted-foreground max-w-44 truncate" title={row.original.setor ?? ''}>
                {[rotuloFrota(row.original.tipo_frota), row.original.setor].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'descricao',
        header: 'Infração',
        cell: ({ row }) => {
          const m = row.original;
          const detalhe = [
            m.auto_infracao && `Auto ${m.auto_infracao}`,
            m.pontuacao != null && `${m.pontuacao} ponto(s)`,
            m.notificacao_autuacao && NOTIFICACAO_AUTUACAO.find((n) => n.valor === m.notificacao_autuacao)?.rotulo,
          ].filter(Boolean).join(' · ');
          return (
            <div className="leading-tight max-w-72">
              <p className="truncate" title={m.descricao}>
                {m.descricao}
              </p>
              {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
              {m.local_infracao && (
                <p className="text-xs text-muted-foreground truncate" title={m.local_infracao}>{m.local_infracao}</p>
              )}
              {m.data_limite_identificacao && (
                <p className="text-xs text-muted-foreground">
                  Identificar condutor até {dataBr(m.data_limite_identificacao)}
                  {m.infrator_identificado != null && ` · identificado: ${rotuloSimNao(m.infrator_identificado)}`}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: 'condutor',
        header: 'Condutor',
        cell: ({ row }) =>
          row.original.condutor ? (
            <span className="flex items-center gap-1" title={row.original.id_condutor ? 'Vinculada ao cadastro do condutor' : 'Nome digitado (sem cadastro)'}>
              {row.original.id_condutor && <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
              {row.original.condutor}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'vencimento',
        header: 'Vencimento',
        cell: ({ row }) =>
          row.original.data_vencimento ? (
            <span className={multaVencida(row.original, hoje) ? 'text-destructive font-medium' : ''}>
              {dataBr(row.original.data_vencimento)}
              {multaVencida(row.original, hoje) ? ' (vencida)' : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'valor',
        header: () => <div className="text-right">Valor</div>,
        cell: ({ row }) => <div className="text-right font-medium">{brl(row.original.valor)}</div>,
        footer: () => <div className="text-right font-semibold">{brl(total)}</div>,
      },
      {
        id: 'situacao',
        header: 'Situação',
        cell: ({ row }) => (
          <Badge variant="outline" className={COR_SITUACAO[row.original.situacao] ?? ''}>
            {rotuloSituacao(row.original.situacao)}
          </Badge>
        ),
      },
      {
        id: 'controle',
        header: 'Faturamento e desconto',
        cell: ({ row }) => {
          const m = row.original;
          const desconto = situacaoDesconto(m);
          const linhas = [
            desconto === 'DESCONTADA' &&
              `Descontada do colaborador${m.data_desconto ? ` em ${dataBr(m.data_desconto)}` : ''}`,
            desconto === 'A_DESCONTAR' && m.condutor && 'A descontar do colaborador',
            m.faturada != null && `Faturada: ${rotuloSimNao(m.faturada)}${m.fatura ? ` (fatura ${m.fatura})` : ''}`,
            m.numero_pedido && `Pedido: ${m.numero_pedido}`,
            m.rq131 && `RQ-131: ${m.rq131}`,
            m.reembolso && `Reembolso: ${m.reembolso}`,
            m.empresa_arca && 'Custo da empresa',
          ].filter(Boolean) as string[];
          return linhas.length ? (
            <div className="text-xs leading-tight space-y-0.5 max-w-52">
              {linhas.map((l) => (
                <p key={l} className="truncate" title={l}>{l}</p>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: 'anexo',
        header: 'Anexo',
        cell: ({ row }) => (
          <BotoesAnexo
            nome={row.original.nome_arquivo}
            abrir={() => anexoMulta(row.original.id)}
            baixar={() => anexoMulta(row.original.id, row.original.nome_arquivo)}
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
    [total, hoje]
  );

  const vencidas = semSituacao.filter((m) => multaVencida(m, hoje)).length;

  function montarPdf(): RelatorioFrotaPdf {
    const doTipo = (s: string) => semSituacao.filter((m) => m.situacao === s);
    const rotuloOpcao = (lista: readonly { valor: string; rotulo: string }[], v: string) => lista.find((x) => x.valor === v)?.rotulo ?? v;
    return {
      titulo: 'Multas',
      subtitulo: 'Gestão de frotas',
      unidade,
      periodo: textoPeriodo(de, ate),
      arquivo: `multas-${unidade}-${de || 'inicio'}-a-${ate || isoHoje()}`,
      kpis: [
        { rotulo: 'Total no período', valor: brl(semSituacao.reduce((s, m) => s + m.valor, 0)), detalhe: `${semSituacao.length} multa(s)` },
        ...SITUACOES_MULTA.map((s) => ({
          rotulo: s.rotulo,
          valor: brl(doTipo(s.valor).reduce((t, m) => t + m.valor, 0)),
          detalhe: `${doTipo(s.valor).length} multa(s)${s.valor === 'A_PAGAR' && vencidas ? ` · ${vencidas} vencida(s)` : ''}`,
        })),
      ],
      secoes: [{
        titulo: 'Multas',
        nota: `${linhas.length} multa(s) · ${brl(total)} · ${textoFiltros([
          ['Placa', normalizarPlaca(placa)],
          ['Situação', situacao !== 'TODAS' && rotuloSituacao(situacao)],
          ['Condutor', filtroCondutor !== 'TODOS' && (filtroCondutor === 'SEM' ? 'sem condutor' : opcoesCondutor.find(([k]) => k === filtroCondutor)?.[1])],
          ['Frota', filtroFrota !== 'TODAS' && (filtroFrota === 'LOCADOS' ? 'locados' : filtroFrota === 'SEM' ? 'não informada' : rotuloFrota(filtroFrota))],
          ['Setor', filtroSetor !== 'TODOS' && (filtroSetor === 'SEM' ? 'não informado' : filtroSetor)],
          ['Faturada', filtroFaturada !== 'TODAS' && ({ SIM: 'sim', NAO: 'não', SEM: 'não informado' } as Record<string, string>)[filtroFaturada]],
          ['RQ-131', filtroRq131 !== 'TODOS' && (filtroRq131 === 'SEM' ? 'não informado' : filtroRq131)],
          ['Desconto', filtroDesconto !== 'TODOS' && rotuloOpcao(SITUACOES_DESCONTO, filtroDesconto)],
          ['Busca', busca.trim()],
        ])}`,
        colunas: [
          { titulo: 'Infração em', largura: 18 }, { titulo: 'Placa', largura: 20 }, { titulo: 'Infração', largura: 58 },
          { titulo: 'Condutor', largura: 34 }, { titulo: 'Vencimento', largura: 18 }, { titulo: 'Situação', largura: 20 },
          { titulo: 'Valor', largura: 22, alinhar: 'right' },
        ],
        linhas: linhas.map((m) => {
          const desconto = situacaoDesconto(m);
          return [
            { texto: dataBr(m.data_infracao) },
            { texto: m.placa, negrito: true, sub: [rotuloFrota(m.tipo_frota), m.setor].filter(Boolean).join(' · ') || undefined },
            {
              texto: m.descricao,
              sub: [m.auto_infracao && `Auto ${m.auto_infracao}`, m.pontuacao != null && `${m.pontuacao} pt(s)`, m.local_infracao]
                .filter(Boolean).join(' · ') || undefined,
            },
            {
              texto: m.condutor || '—',
              sub: m.condutor ? rotuloOpcao(SITUACOES_DESCONTO, desconto) : undefined,
              cor: m.condutor ? undefined : COR_PDF.muted,
            },
            m.data_vencimento
              ? { texto: dataBr(m.data_vencimento), cor: multaVencida(m, hoje) ? COR_PDF.perigo : undefined, sub: multaVencida(m, hoje) ? 'vencida' : undefined }
              : { texto: '—', cor: COR_PDF.muted },
            { texto: rotuloSituacao(m.situacao), cor: m.situacao === 'A_PAGAR' ? COR_PDF.alerta : m.situacao === 'PAGA' ? COR_PDF.ok : COR_PDF.muted },
            { texto: brl(m.valor), negrito: m.situacao !== 'CANCELADA', cor: m.situacao === 'CANCELADA' ? COR_PDF.muted : undefined },
          ];
        }),
      }],
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ReceiptText className="h-6 w-6" /> Multas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Multas dos veículos com o documento da notificação, valor, condutor e situação. Fica só no PaperSign.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <SeletorUnidade {...sel} />
          <BotaoPdf disabled={!unidade || carregando} montar={montarPdf} />
          <Button type="button" onClick={() => setEditando('novo')} disabled={!unidade}>
            <Plus className="h-4 w-4 mr-2" /> Nova multa
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <CartaoIndicador icone={ReceiptText} tom="azul" destaque rotulo="Total no período" ativo={situacao === 'TODAS'}
          onClick={() => setSituacao('TODAS')} valor={brl(semSituacao.reduce((s, m) => s + m.valor, 0))}
          detalhe={`${semSituacao.length} multa(s)`} />
        {SITUACOES_MULTA.map((s) => {
          const doTipo = semSituacao.filter((m) => m.situacao === s.valor);
          return (
            <CartaoIndicador
              key={s.valor}
              {...ESTILO_SITUACAO[s.valor]}
              rotulo={s.rotulo}
              ativo={situacao === s.valor}
              onClick={() => setSituacao(situacao === s.valor ? 'TODAS' : s.valor)}
              valor={brl(doTipo.reduce((t, m) => t + m.valor, 0))}
              detalhe={
                <>
                  {doTipo.length} multa(s)
                  {s.valor === 'A_PAGAR' && vencidas > 0 && (
                    <span className="text-destructive font-medium"> · {vencidas} vencida(s)</span>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Multas ({unidade || '—'})</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Infração" />
            <div className="space-y-1">
              <Label>Placa</Label>
              <Input
                list="placas-filtro-multa"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="Todas"
                className="w-32 font-mono"
              />
              <datalist id="placas-filtro-multa">
                {placas.map((p) => (
                  <option key={p.placa} value={p.placa} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Situação</Label>
              <Select value={situacao} onValueChange={setSituacao}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {SITUACOES_MULTA.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Condutor</Label>
              <Select value={filtroCondutor} onValueChange={setFiltroCondutor}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="SEM">Sem condutor informado</SelectItem>
                  {opcoesCondutor.map(([chave, nome]) => (
                    <SelectItem key={chave} value={chave}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frota</Label>
              <Select value={filtroFrota} onValueChange={setFiltroFrota}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="LOCADOS">Locados (todas)</SelectItem>
                  {TIPOS_FROTA.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                  <SelectItem value="SEM">Não informada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {setores.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Faturada</Label>
              <Select value={filtroFaturada} onValueChange={setFiltroFaturada}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NAO">Não</SelectItem>
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>RQ-131</Label>
              <Select value={filtroRq131} onValueChange={setFiltroRq131}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {situacoesRq131.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value="SEM">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Desconto do colaborador</Label>
              <Select value={filtroDesconto} onValueChange={setFiltroDesconto}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {SITUACOES_DESCONTO.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Infração, auto, local, pedido...</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="w-56" />
            </div>
            {filtrosAtivos && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPlaca('');
                  setBusca('');
                  setSituacao('TODAS');
                  setFiltroCondutor('TODOS');
                  setFiltroFrota('TODAS');
                  setFiltroSetor('TODOS');
                  setFiltroFaturada('TODAS');
                  setFiltroRq131('TODOS');
                  setFiltroDesconto('TODOS');
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
            emptyMessage={filtrosAtivos ? 'Nenhuma multa com esses filtros.' : 'Nenhuma multa no período.'}
          />
        </CardContent>
      </Card>

      <FormMulta
        unidade={unidade}
        placas={placas}
        condutores={condutores}
        setores={setores}
        cadastrados={cadastrados.filter((c) => c.ativo)}
        registro={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          void carregar();
        }}
      />

      <DialogExclusao
        aberto={!!excluindo}
        titulo="Excluir multa"
        descricao={
          excluindo
            ? `${excluindo.placa} · ${dataBr(excluindo.data_infracao)} · ${excluindo.descricao} · ${brl(excluindo.valor)}`
            : ''
        }
        onCancelar={() => setExcluindo(null)}
        onConfirmar={async (motivo) => {
          if (!excluindo) return;
          try {
            await excluirMulta(excluindo.id, motivo);
            toast.success('Multa excluída.');
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

const NENHUM = 'NENHUM';
const OUTRO = 'OUTRO';

const FORM_VAZIO = {
  placa: '',
  data_infracao: '',
  auto_infracao: '',
  descricao: '',
  valor: '',
  data_vencimento: '',
  id_condutor: NENHUM,
  condutor: '',
  situacao: 'A_PAGAR',
  tipo_frota: '',
  setor: '',
  pontuacao: '',
  data_limite_identificacao: '',
  local_infracao: '',
  notificacao_autuacao: '',
  infrator_identificado: '',
  fatura: '',
  faturada: '',
  numero_pedido: '',
  empresa_arca: '',
  rq131: '',
  reembolso: '',
  descontada: '',
  data_desconto: '',
  motivo: '',
};

const SEM_OPCAO = '-';

function FormMulta({ unidade, placas, condutores, setores, cadastrados, registro, onFechar, onSalvo }: {
  unidade: string;
  placas: FrotaPlaca[];
  condutores: string[];
  setores: string[];
  cadastrados: FrotaCondutor[];
  registro: FrotaMulta | 'novo' | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sugestao, setSugestao] = useState<CondutorProvavel | null>(null);
  const edicao = registro && registro !== 'novo' ? registro : null;

  useEffect(() => {
    if (!registro) return;
    setArquivo(null);
    setSugestao(null);
    setForm(
      edicao
        ? {
            placa: edicao.placa,
            data_infracao: edicao.data_infracao.slice(0, 10),
            auto_infracao: edicao.auto_infracao ?? '',
            descricao: edicao.descricao,
            valor: valorParaCampo(edicao.valor),
            data_vencimento: edicao.data_vencimento?.slice(0, 10) ?? '',
            id_condutor: edicao.id_condutor ? String(edicao.id_condutor) : edicao.condutor ? OUTRO : NENHUM,
            condutor: edicao.id_condutor ? '' : edicao.condutor ?? '',
            situacao: edicao.situacao,
            tipo_frota: edicao.tipo_frota ?? '',
            setor: edicao.setor ?? '',
            pontuacao: edicao.pontuacao != null ? String(edicao.pontuacao) : '',
            data_limite_identificacao: edicao.data_limite_identificacao?.slice(0, 10) ?? '',
            local_infracao: edicao.local_infracao ?? '',
            notificacao_autuacao: edicao.notificacao_autuacao ?? '',
            infrator_identificado: simNaoCampo(edicao.infrator_identificado),
            fatura: edicao.fatura ?? '',
            faturada: simNaoCampo(edicao.faturada),
            numero_pedido: edicao.numero_pedido ?? '',
            empresa_arca: simNaoCampo(edicao.empresa_arca),
            rq131: edicao.rq131 ?? '',
            reembolso: edicao.reembolso ?? '',
            descontada: simNaoCampo(edicao.descontada),
            data_desconto: edicao.data_desconto?.slice(0, 10) ?? '',
            motivo: '',
          }
        : FORM_VAZIO
    );
  }, [registro, edicao]);

  const set = (campo: keyof typeof FORM_VAZIO) => (v: string) => setForm((f) => ({ ...f, [campo]: v }));

  /** Nome → condutor do cadastro (mesmo nome) ou "Outro" com o nome digitado. */
  const porNome = useCallback(
    (nome: string, id?: number | null) => {
      const cad = (id && cadastrados.find((c) => c.id === id)) || cadastrados.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase());
      return cad ? { id_condutor: String(cad.id), condutor: '' } : { id_condutor: OUTRO, condutor: nome };
    },
    [cadastrados]
  );

  // Quem estava em viagem com o carro no dia da infração; preenche se o condutor ainda não foi escolhido.
  const placaNorm = normalizarPlaca(form.placa);
  useEffect(() => {
    if (!registro || !unidade || placaNorm.length < 7 || !form.data_infracao) {
      setSugestao(null);
      return;
    }
    let vivo = true;
    condutorProvavel(unidade, placaNorm, form.data_infracao).then((s) => {
      if (!vivo) return;
      setSugestao(s.encontrado ? s : null);
      if (s.encontrado && s.condutor)
        setForm((f) => (f.id_condutor === NENHUM ? { ...f, ...porNome(s.condutor!, s.id_condutor) } : f));
    });
    return () => {
      vivo = false;
    };
  }, [registro, unidade, placaNorm, form.data_infracao, porNome]);

  function trocarPlaca(valor: string) {
    const placa = valor.toUpperCase();
    // Sem viagem no dia, sugere quem está com o veículo (Gestão de frotas), se o condutor ainda não foi escolhido.
    const doRm = placas.find((p) => p.placa === normalizarPlaca(placa));
    const atual = doRm?.responsavel_nome;
    setForm((f) => ({
      ...f,
      placa,
      tipo_frota: doRm && !f.tipo_frota ? 'PROPRIA' : f.tipo_frota,
      setor: f.setor || doRm?.responsavel_setor || '',
      ...(f.id_condutor === NENHUM && atual ? porNome(atual) : {}),
    }));
  }

  async function salvar() {
    const placa = normalizarPlaca(form.placa);
    const valor = valorParaApi(form.valor);
    if (!placa) return void toast.error('Informe a placa.');
    if (!form.data_infracao) return void toast.error('Informe a data da infração.');
    if (form.descricao.trim().length < 3) return void toast.error('Descreva a infração.');
    if (!valor || Number(valor) <= 0) return void toast.error('Informe o valor da multa.');
    if (form.pontuacao && !/^\d{1,2}$/.test(form.pontuacao.trim())) return void toast.error('Pontuação inválida.');
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) return void toast.error(`Arquivo maior que ${MAX_MB} MB.`);
    const texto = (v: string) => v.trim() || undefined;

    setSalvando(true);
    try {
      await salvarMulta(
        {
          unidade,
          placa,
          data_infracao: form.data_infracao,
          auto_infracao: form.auto_infracao.trim() || undefined,
          descricao: form.descricao.trim(),
          valor,
          data_vencimento: form.data_vencimento || undefined,
          id_condutor: form.id_condutor !== OUTRO && form.id_condutor !== NENHUM ? form.id_condutor : undefined,
          condutor: form.id_condutor === OUTRO ? form.condutor.trim() || undefined : undefined,
          situacao: form.situacao,
          tipo_frota: texto(form.tipo_frota),
          setor: texto(form.setor),
          pontuacao: texto(form.pontuacao),
          data_limite_identificacao: texto(form.data_limite_identificacao),
          local_infracao: texto(form.local_infracao),
          notificacao_autuacao: texto(form.notificacao_autuacao),
          infrator_identificado: texto(form.infrator_identificado),
          fatura: texto(form.fatura),
          faturada: texto(form.faturada),
          numero_pedido: texto(form.numero_pedido),
          empresa_arca: texto(form.empresa_arca),
          rq131: texto(form.rq131),
          reembolso: texto(form.reembolso),
          descontada: texto(form.descontada),
          data_desconto: form.descontada === 'SIM' ? texto(form.data_desconto) : undefined,
          motivo: form.motivo.trim() || undefined,
          arquivo,
        },
        edicao?.id
      );
      toast.success(edicao ? 'Multa alterada.' : `Multa da placa ${placa} registrada.`);
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a multa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!registro} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicao ? `Alterar multa · ${edicao.placa}` : 'Nova multa'}</DialogTitle>
          <DialogDescription>
            {unidade} · o registro e o documento ficam no PaperSign; quem gravou e o que mudou ficam no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Placa</Label>
            <Input
              list="placas-form-multa"
              value={form.placa}
              onChange={(e) => trocarPlaca(e.target.value)}
              className="font-mono"
              maxLength={8}
              disabled={salvando}
            />
            <datalist id="placas-form-multa">
              {placas.map((p) => (
                <option key={p.placa} value={p.placa}>
                  {[p.frota, p.modelo].filter(Boolean).join(' · ')}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Data da infração</Label>
            <Input type="date" value={form.data_infracao} onChange={(e) => set('data_infracao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Infração</Label>
            <Input
              value={form.descricao}
              maxLength={300}
              placeholder="Ex.: excesso de velocidade até 20%"
              onChange={(e) => set('descricao')(e.target.value)}
              disabled={salvando}
            />
          </div>
          <div className="space-y-1">
            <Label>Nº do auto de infração (opcional)</Label>
            <Input value={form.auto_infracao} maxLength={40} onChange={(e) => set('auto_infracao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Condutor (aba Condutores)</Label>
            <Select value={form.id_condutor} onValueChange={set('id_condutor')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Não informado</SelectItem>
                {cadastrados.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
                {edicao?.id_condutor && !cadastrados.some((c) => c.id === edicao.id_condutor) && (
                  <SelectItem value={String(edicao.id_condutor)}>{edicao.condutor} (inativo)</SelectItem>
                )}
                <SelectItem value={OUTRO}>Outro (sem cadastro)</SelectItem>
              </SelectContent>
            </Select>
            {form.id_condutor === OUTRO && (
              <>
                <Input
                  list="condutores-multa"
                  value={form.condutor}
                  maxLength={150}
                  placeholder="Nome do condutor"
                  onChange={(e) => set('condutor')(e.target.value)}
                  disabled={salvando}
                />
                <datalist id="condutores-multa">
                  {condutores.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
            {sugestao?.condutor && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3 shrink-0" />
                Em viagem com o veículo neste dia: <b>{sugestao.condutor}</b>
                {(() => {
                  const s = porNome(sugestao.condutor, sugestao.id_condutor);
                  return s.id_condutor !== form.id_condutor || (s.id_condutor === OUTRO && s.condutor !== form.condutor) ? (
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setForm((f) => ({ ...f, ...s }))}>
                      usar
                    </Button>
                  ) : null;
                })()}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Valor (R$)</Label>
            <Input value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => set('valor')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Vencimento (opcional)</Label>
            <Input type="date" value={form.data_vencimento} onChange={(e) => set('data_vencimento')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Situação</Label>
            <Select value={form.situacao} onValueChange={set('situacao')} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUACOES_MULTA.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Frota</Label>
            <Select value={form.tipo_frota || SEM_OPCAO} onValueChange={(v) => set('tipo_frota')(v === SEM_OPCAO ? '' : v)} disabled={salvando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_OPCAO}>Não informada</SelectItem>
                {TIPOS_FROTA.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Setor</Label>
            <Input list="setores-multa" value={form.setor} maxLength={100} onChange={(e) => set('setor')(e.target.value)} disabled={salvando} />
            <datalist id="setores-multa">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <p className="sm:col-span-2 pt-2 text-sm font-medium border-t">Notificação e identificação do condutor</p>
          <div className="space-y-1">
            <Label>Notificação ou autuação</Label>
            <Select
              value={form.notificacao_autuacao || SEM_OPCAO}
              onValueChange={(v) => set('notificacao_autuacao')(v === SEM_OPCAO ? '' : v)}
              disabled={salvando}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_OPCAO}>Não informado</SelectItem>
                {NOTIFICACAO_AUTUACAO.map((n) => (
                  <SelectItem key={n.valor} value={n.valor}>
                    {n.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pontuação (pontos na CNH)</Label>
            <Input value={form.pontuacao} inputMode="numeric" maxLength={2} onChange={(e) => set('pontuacao')(e.target.value.replace(/\D/g, ''))} disabled={salvando} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Local da infração</Label>
            <Input value={form.local_infracao} maxLength={200} onChange={(e) => set('local_infracao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Data limite para identificação</Label>
            <Input type="date" value={form.data_limite_identificacao} onChange={(e) => set('data_limite_identificacao')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Foi identificado o infrator?</Label>
            <SelectSimNao valor={form.infrator_identificado} onChange={set('infrator_identificado')} disabled={salvando} />
          </div>

          <p className="sm:col-span-2 pt-2 text-sm font-medium border-t">Faturamento, reembolso e desconto do colaborador</p>
          <div className="space-y-1">
            <Label>Faturada</Label>
            <SelectSimNao valor={form.faturada} onChange={set('faturada')} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Nº da fatura</Label>
            <Input value={form.fatura} maxLength={40} onChange={(e) => set('fatura')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Nº do pedido</Label>
            <Input value={form.numero_pedido} maxLength={40} placeholder="Nº, PRÓPRIO, CI..." onChange={(e) => set('numero_pedido')(e.target.value)} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>Custo fica com a empresa?</Label>
            <SelectSimNao valor={form.empresa_arca} onChange={set('empresa_arca')} disabled={salvando} />
          </div>
          <div className="space-y-1">
            <Label>RQ-131</Label>
            <Input list="rq131-multa" value={form.rq131} maxLength={40} onChange={(e) => set('rq131')(e.target.value)} disabled={salvando} />
            <datalist id="rq131-multa">
              {SUGESTOES_RQ131.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Reembolsado / encaminhado para reembolso</Label>
            <Input list="reembolso-multa" value={form.reembolso} maxLength={40} onChange={(e) => set('reembolso')(e.target.value)} disabled={salvando} />
            <datalist id="reembolso-multa">
              {SUGESTOES_REEMBOLSO.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Já descontada do colaborador?</Label>
            <SelectSimNao
              valor={form.descontada}
              onChange={(v) => setForm((f) => ({ ...f, descontada: v, data_desconto: v === 'SIM' ? f.data_desconto : '' }))}
              disabled={salvando}
            />
          </div>
          <div className="space-y-1">
            <Label>Data do desconto (opcional)</Label>
            <Input type="date" value={form.data_desconto} onChange={(e) => set('data_desconto')(e.target.value)}
              disabled={salvando || form.descontada !== 'SIM'} />
          </div>

          <div className="space-y-1 sm:col-span-2 pt-2 border-t">
            <Label>{edicao?.nome_arquivo ? 'Trocar documento (opcional)' : 'Documento da multa (opcional)'}</Label>
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
