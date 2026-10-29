'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Coins,
  FileDown,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  anexarArquivoMulta,
  anexoManutencao,
  anexoMulta,
  anexoSinistro,
  CAUSAS_SINISTRO,
  CLASSIFICACOES_MANUTENCAO,
  FrotaCondutor,
  FrotaManutencao,
  FrotaMulta,
  FrotaSinistro,
  listarCondutores,
  listarManutencoes,
  listarMultas,
  listarSinistros,
  SITUACOES_DESCONTO,
  SITUACOES_MULTA,
  SITUACOES_REPARO,
  situacaoDesconto,
  TIPOS_FROTA,
} from '@/services/frotasService';
import type { CelulaPdf, ColunaPdf, CorPdf, KpiPdf, RankingCondutor, RankingVeiculo, SecaoPdf } from '@/lib/frotasDashboardPdf';

import {
  BotaoEnviarAnexo,
  BotaoPdf,
  BotoesAnexo,
  brl,
  CartaoIndicador,
  COR_PDF,
  RelatorioFrotaPdf,
  TomIndicador,
  FiltroPeriodo,
  isoHoje,
  nomeDaSessao,
  SeletorUnidade,
  useUnidadeFrotas,
  usePlacasFrota,
} from './comum';
import { dataBr } from './VeiculoDialog';

/** Manutenções que contam como conserto (preventiva fica à parte). */
const CONSERTOS = new Set(['CORRETIVA', 'FUNILARIA_PINTURA', 'BORRACHARIA']);
const TOP = 10;
const FATIAS = 6;

const ORDEM_CONDUTORES = { QTD: 'quantidade de multas', VALOR: 'valor das multas', PONTOS: 'pontos na CNH' } as const;
const ORDEM_VEICULOS = { QTD: 'quantidade de consertos', CUSTO: 'custo total' } as const;

const PALETA: CorPdf[] = [
  [37, 99, 235], [245, 158, 11], [16, 185, 129], [239, 68, 68], [139, 92, 246], [6, 182, 212], [236, 72, 153], [148, 163, 184],
];
const COR_OUTROS: CorPdf = [100, 116, 139];

/** Na ordem dos indicadores: multas, a descontar, condutores, manutenções, sinistros, gasto total. */
const ESTILO_KPI: { icone: LucideIcon; tom: TomIndicador }[] = [
  { icone: AlertTriangle, tom: 'ambar' },
  { icone: Wallet, tom: 'laranja' },
  { icone: Users, tom: 'roxo' },
  { icone: Wrench, tom: 'azul' },
  { icone: ShieldAlert, tom: 'vermelho' },
  { icone: Coins, tom: 'verde' },
];
const rgb = (c: CorPdf) => `rgb(${c.join(',')})`;

type Fatia = { chave: string; rotulo: string; valor: number; texto: string; cor: CorPdf };

function inicioAnoPassado() {
  return `${new Date().getFullYear() - 1}-01-01`;
}

function chaveNome(nome: string) {
  return nome.trim().replace(/\s+/g, ' ').toUpperCase();
}

const rotuloClassificacao = (c: string) => CLASSIFICACOES_MANUTENCAO.find((x) => x.valor === c)?.rotulo ?? c;
const rotuloCausa = (c: string) => CAUSAS_SINISTRO.find((x) => x.valor === c)?.rotulo ?? c;
const rotuloSituacao = (s: string) => SITUACOES_MULTA.find((x) => x.valor === s)?.rotulo ?? s;
const rotuloDesconto = (m: FrotaMulta) => SITUACOES_DESCONTO.find((x) => x.valor === situacaoDesconto(m))?.rotulo ?? '';
const rotuloReparo = (r?: string | null) => SITUACOES_REPARO.find((x) => x.valor === r)?.rotulo ?? r ?? '';
const porData = <T,>(campo: (x: T) => string | null | undefined) => (a: T, b: T) => (campo(b) ?? '').localeCompare(campo(a) ?? '');

/** Primeiras fatias com cor própria; o resto vira "Outros". */
function montarFatias<T>(itens: T[], chave: (x: T) => string, rotulo: (x: T) => string, valor: (x: T) => number,
  texto: (v: number) => string): Fatia[] {
  const comValor = itens.filter((x) => valor(x) > 0);
  const fatias: Fatia[] = comValor.slice(0, FATIAS).map((x, i) => ({
    chave: chave(x), rotulo: rotulo(x), valor: valor(x), texto: texto(valor(x)), cor: PALETA[i % PALETA.length],
  }));
  const resto = comValor.slice(FATIAS);
  if (resto.length) {
    const soma = resto.reduce((s, x) => s + valor(x), 0);
    fatias.push({ chave: '', rotulo: `Outros (${resto.length})`, valor: soma, texto: texto(soma), cor: COR_OUTROS });
  }
  return fatias;
}

function arco(r: number, ri: number, a0: number, a1: number) {
  const fim = Math.min(a1, a0 + Math.PI * 2 - 0.0001);
  const grande = fim - a0 > Math.PI ? 1 : 0;
  const p = (raio: number, a: number) => `${60 + raio * Math.cos(a)} ${60 + raio * Math.sin(a)}`;
  return `M${p(r, a0)} A${r} ${r} 0 ${grande} 1 ${p(r, fim)} L${p(ri, fim)} A${ri} ${ri} 0 ${grande} 0 ${p(ri, a0)}Z`;
}

function Pizza({ titulo, subtitulo, fatias, centro, onClicar }: {
  titulo: string;
  subtitulo?: string;
  fatias: Fatia[];
  centro: string;
  onClicar?: (chave: string) => void;
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  let a0 = -Math.PI / 2;
  const caminhos = fatias.map((f) => {
    const a1 = a0 + (total > 0 ? f.valor / total : 0) * Math.PI * 2;
    const d = arco(56, 40, a0, a1);
    a0 = a1;
    return d;
  });
  const clicavel = (f: Fatia) => !!(f.chave && onClicar);
  const pct = (f: Fatia) => (total > 0 ? Math.round((f.valor / total) * 100) : 0);
  const destaque = ativa !== null ? fatias[ativa] : undefined;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 pt-5">
        <div className="relative mx-auto h-44 w-44 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full" onMouseLeave={() => setAtiva(null)}>
            {total <= 0 ? (
              <path d={arco(56, 40, 0, Math.PI * 2)} className="fill-muted" />
            ) : (
              fatias.map((f, i) => (
                <path
                  key={`${f.rotulo}-${i}`}
                  d={caminhos[i]}
                  fill={rgb(f.cor)}
                  strokeWidth={fatias.length > 1 ? 1 : 0}
                  opacity={ativa !== null && ativa !== i ? 0.3 : 1}
                  className={`stroke-card transition-opacity ${clicavel(f) ? 'cursor-pointer' : ''}`}
                  onMouseEnter={() => setAtiva(i)}
                  onClick={() => clicavel(f) && onClicar!(f.chave)}
                >
                  <title>{`${f.rotulo}: ${f.texto}`}</title>
                </path>
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
            <span className="text-sm font-bold leading-tight tabular-nums">{destaque ? destaque.texto : centro}</span>
            <span className="text-[11px] text-muted-foreground">{destaque ? `${pct(destaque)}%` : 'total'}</span>
          </div>
        </div>
        {fatias.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {fatias.map((f, i) => (
              <li
                key={`${f.rotulo}-${i}`}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md px-2 py-1 transition-colors ${clicavel(f) ? 'cursor-pointer hover:bg-muted/60' : ''} ${ativa === i ? 'bg-muted/60' : ''}`}
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
                onClick={() => clicavel(f) && onClicar!(f.chave)}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rgb(f.cor) }} />
                <span className="truncate" title={f.rotulo}>{f.rotulo}</span>
                <span className="whitespace-nowrap tabular-nums">
                  <span className="font-medium">{f.texto}</span>
                  <span className="ml-1.5 inline-block w-9 text-right text-muted-foreground">{pct(f)}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Barra({ valor, maximo, cor = 'bg-primary' }: { valor: number; maximo: number; cor?: string }) {
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded bg-muted">
      <div className={`h-2 rounded ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Indicadores({ kpis }: { kpis: KpiPdf[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
      {kpis.map((k) => (
        <div key={k.rotulo} className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{k.rotulo}</p>
          <p className="text-base font-bold">{k.valor}</p>
          <p className="text-xs text-muted-foreground truncate" title={k.detalhe}>{k.detalhe}</p>
        </div>
      ))}
    </div>
  );
}

const { muted: MUTED, perigo: PERIGO, alerta: ALERTA } = COR_PDF;

/** Histórico do veículo no período: manutenções, sinistros e multas, com valores. */
function DetalheVeiculo({ veiculo, manutencoes, sinistros, multas, unidade, periodo, onFechar }: {
  veiculo: RankingVeiculo | null;
  manutencoes: FrotaManutencao[];
  sinistros: FrotaSinistro[];
  multas: FrotaMulta[];
  unidade: string;
  periodo: string;
  onFechar: () => void;
}) {
  const placa = veiculo?.placa ?? '';
  const ma = useMemo(() => manutencoes.filter((m) => m.placa === placa).sort(porData((m) => m.data_manutencao)), [manutencoes, placa]);
  const si = useMemo(() => sinistros.filter((s) => s.placa === placa).sort(porData((s) => s.data_sinistro)), [sinistros, placa]);
  const mu = useMemo(() => multas.filter((m) => m.placa === placa).sort(porData((m) => m.data_infracao)), [multas, placa]);
  if (!veiculo) return null;

  const somaMa = ma.reduce((s, m) => s + m.valor, 0);
  const somaSi = si.reduce((s, x) => s + (x.valor ?? 0), 0);
  const muValidas = mu.filter((m) => m.situacao !== 'CANCELADA');
  const somaMu = muValidas.reduce((s, m) => s + m.valor, 0);
  const kpis: KpiPdf[] = [
    { rotulo: 'Consertos', valor: String(veiculo.consertos), detalhe: 'corretiva, funilaria, borracharia e sinistros' },
    { rotulo: 'Manutenções', valor: brl(somaMa), detalhe: `${ma.length} serviço(s) · ${veiculo.preventivas} preventiva(s)` },
    { rotulo: 'Sinistros', valor: brl(somaSi), detalhe: `${si.length} sinistro(s)` },
    { rotulo: 'Custo total', valor: brl(somaMa + somaSi), detalhe: 'manutenções + sinistros' },
    { rotulo: 'Multas', valor: brl(somaMu), detalhe: `${muValidas.length} multa(s), sem canceladas` },
    { rotulo: 'Veículo', valor: veiculo.placa, detalhe: veiculo.descricao || '—' },
  ];

  function secoes(): SecaoPdf[] {
    const cm: ColunaPdf[] = [
      { titulo: 'Data', largura: 20 }, { titulo: 'Classificação', largura: 28 }, { titulo: 'Serviço / fornecedor', largura: 96 },
      { titulo: 'Feito em', largura: 20 }, { titulo: 'Valor', largura: 26, alinhar: 'right' },
    ];
    const cs: ColunaPdf[] = [
      { titulo: 'Data', largura: 20 }, { titulo: 'Causa', largura: 46 }, { titulo: 'Condutor', largura: 50 },
      { titulo: 'Reparo', largura: 34 }, { titulo: 'Valor', largura: 40, alinhar: 'right' },
    ];
    const cmu: ColunaPdf[] = [
      { titulo: 'Data', largura: 20 }, { titulo: 'Infração', largura: 70 }, { titulo: 'Condutor', largura: 44 },
      { titulo: 'Situação', largura: 26 }, { titulo: 'Valor', largura: 30, alinhar: 'right' },
    ];
    return [
      {
        titulo: 'Manutenções', nota: `${ma.length} serviço(s) · ${brl(somaMa)}`, colunas: cm,
        linhas: ma.map((m): CelulaPdf[] => [
          { texto: dataBr(m.data_manutencao) }, { texto: rotuloClassificacao(m.classificacao), cor: CONSERTOS.has(m.classificacao) ? ALERTA : MUTED },
          { texto: m.descricao, sub: m.fornecedor }, { texto: m.data_conclusao ? dataBr(m.data_conclusao) : '—', cor: MUTED },
          { texto: brl(m.valor), negrito: true },
        ]),
      },
      {
        titulo: 'Sinistros', nota: `${si.length} sinistro(s) · ${brl(somaSi)}`, colunas: cs,
        linhas: si.map((s): CelulaPdf[] => [
          { texto: s.data_sinistro ? dataBr(s.data_sinistro) : 'sem data' }, { texto: rotuloCausa(s.causa), sub: s.descricao },
          { texto: s.condutor || '—' }, { texto: rotuloReparo(s.situacao_reparo) || '—', cor: MUTED },
          { texto: s.valor != null ? brl(s.valor) : '—', negrito: true },
        ]),
      },
      {
        titulo: 'Multas', nota: `${muValidas.length} multa(s) · ${brl(somaMu)} (canceladas aparecem, mas não somam)`, colunas: cmu,
        linhas: mu.map((m): CelulaPdf[] => [
          { texto: dataBr(m.data_infracao) }, { texto: m.descricao }, { texto: m.condutor || '—' },
          { texto: rotuloSituacao(m.situacao), cor: m.situacao === 'A_PAGAR' ? PERIGO : MUTED },
          { texto: brl(m.valor), negrito: m.situacao !== 'CANCELADA', cor: m.situacao === 'CANCELADA' ? MUTED : undefined },
        ]),
      },
    ];
  }

  const montarPdf = (): RelatorioFrotaPdf => ({
    titulo: `Histórico do veículo ${veiculo.placa}`,
    subtitulo: veiculo.descricao || 'Gestão de frotas',
    unidade,
    periodo,
    kpis,
    secoes: secoes(),
    arquivo: `historico-veiculo-${veiculo.placa}`,
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>Histórico do veículo <span className="font-mono">{veiculo.placa}</span></DialogTitle>
              <DialogDescription>{veiculo.descricao || 'Sem cadastro no RM'} · {unidade} · {periodo}</DialogDescription>
            </div>
            <BotaoPdf montar={montarPdf} />
          </div>
        </DialogHeader>
        <Indicadores kpis={kpis} />

        <h3 className="font-semibold mt-2">Manutenções ({ma.length} · {brl(somaMa)})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Classificação</th><th className="py-2 pr-3">Serviço</th>
                <th className="py-2 pr-3">Fornecedor</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2">Anexo</th>
              </tr>
            </thead>
            <tbody>
              {ma.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataBr(m.data_manutencao)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={CONSERTOS.has(m.classificacao) ? 'secondary' : 'outline'}>{rotuloClassificacao(m.classificacao)}</Badge>
                  </td>
                  <td className="py-2 pr-3 max-w-72"><p className="truncate" title={m.descricao}>{m.descricao}</p></td>
                  <td className="py-2 pr-3 max-w-48"><p className="truncate" title={m.fornecedor}>{m.fornecedor}</p></td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">{brl(m.valor)}</td>
                  <td className="py-2">
                    <BotoesAnexo nome={m.nome_arquivo} abrir={() => anexoManutencao(m.id)} baixar={() => anexoManutencao(m.id, m.nome_arquivo)} />
                  </td>
                </tr>
              ))}
              {ma.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhuma manutenção no período.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-2">Sinistros ({si.length} · {brl(somaSi)})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Causa</th><th className="py-2 pr-3">Resumo</th>
                <th className="py-2 pr-3">Condutor</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2">Anexo</th>
              </tr>
            </thead>
            <tbody>
              {si.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{s.data_sinistro ? dataBr(s.data_sinistro) : 'sem data'}</td>
                  <td className="py-2 pr-3">{rotuloCausa(s.causa)}</td>
                  <td className="py-2 pr-3 max-w-72"><p className="truncate" title={s.descricao}>{s.descricao}</p></td>
                  <td className="py-2 pr-3">{s.condutor || '—'}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">{s.valor != null ? brl(s.valor) : '—'}</td>
                  <td className="py-2">
                    <BotoesAnexo nome={s.nome_arquivo} abrir={() => anexoSinistro(s.id)} baixar={() => anexoSinistro(s.id, s.nome_arquivo)} />
                  </td>
                </tr>
              ))}
              {si.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhum sinistro no período.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 className="font-semibold mt-2">Multas ({muValidas.length} · {brl(somaMu)})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Infração</th><th className="py-2 pr-3">Condutor</th>
                <th className="py-2 pr-3">Situação</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2">Anexo</th>
              </tr>
            </thead>
            <tbody>
              {mu.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataBr(m.data_infracao)}</td>
                  <td className="py-2 pr-3 max-w-72"><p className="truncate" title={m.descricao}>{m.descricao}</p></td>
                  <td className="py-2 pr-3">{m.condutor || '—'}</td>
                  <td className="py-2 pr-3"><Badge variant={m.situacao === 'A_PAGAR' ? 'destructive' : 'outline'}>{rotuloSituacao(m.situacao)}</Badge></td>
                  <td className={`py-2 pr-3 text-right whitespace-nowrap ${m.situacao === 'CANCELADA' ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                    {brl(m.valor)}
                  </td>
                  <td className="py-2">
                    <BotoesAnexo nome={m.nome_arquivo} abrir={() => anexoMulta(m.id)} baixar={() => anexoMulta(m.id, m.nome_arquivo)} />
                  </td>
                </tr>
              ))}
              {mu.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Nenhuma multa no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Multas do condutor no período, com valores, pontos, situação e desconto; o anexo pode ser enviado aqui. */
function DetalheCondutor({ condutor, multas, unidade, periodo, onAnexo, onFechar }: {
  condutor: RankingCondutor | null;
  multas: FrotaMulta[];
  unidade: string;
  periodo: string;
  onAnexo: (id: number, nome: string) => void;
  onFechar: () => void;
}) {
  if (!condutor) return null;

  const lista = [...multas].sort(porData((m) => m.data_infracao));
  const validas = lista.filter((m) => m.situacao !== 'CANCELADA');
  const soma = (f: (m: FrotaMulta) => boolean) => validas.filter(f).reduce((s, m) => s + m.valor, 0);
  const kpis: KpiPdf[] = [
    { rotulo: 'Multas', valor: String(validas.length), detalhe: `${lista.length - validas.length} cancelada(s) fora da soma` },
    { rotulo: 'Valor total', valor: brl(soma(() => true)), detalhe: `placas: ${condutor.placas.join(', ') || '—'}` },
    { rotulo: 'Pontos na CNH', valor: String(condutor.pontos), detalhe: condutor.pontos >= 20 ? 'atenção: 20 pontos ou mais' : 'no período' },
    { rotulo: 'A pagar', valor: brl(soma((m) => m.situacao === 'A_PAGAR')), detalhe: 'situação A pagar' },
    { rotulo: 'Já descontado', valor: brl(soma((m) => situacaoDesconto(m) === 'DESCONTADA')), detalhe: 'do colaborador' },
    { rotulo: 'A descontar', valor: brl(soma((m) => situacaoDesconto(m) === 'A_DESCONTAR')), detalhe: 'ainda não descontado' },
  ];

  function montarPdf(): RelatorioFrotaPdf {
    const colunas: ColunaPdf[] = [
      { titulo: 'Data', largura: 20 }, { titulo: 'Placa', largura: 20 }, { titulo: 'Infração', largura: 62 },
      { titulo: 'Pontos', largura: 14, alinhar: 'right' }, { titulo: 'Situação', largura: 24 }, { titulo: 'Desconto', largura: 26 },
      { titulo: 'Valor', largura: 24, alinhar: 'right' },
    ];
    return {
      titulo: `Multas de ${condutor!.nome}`,
      subtitulo: condutor!.cadastrado ? 'Gestão de frotas · condutor cadastrado' : 'Gestão de frotas · nome informado na multa (sem cadastro)',
      unidade,
      periodo,
      kpis,
      arquivo: `multas-${condutor!.nome}`,
      secoes: [{
        titulo: 'Multas', nota: `${validas.length} multa(s) · ${brl(soma(() => true))} (canceladas aparecem, mas não somam)`, colunas,
        linhas: lista.map((m): CelulaPdf[] => [
          { texto: dataBr(m.data_infracao) }, { texto: m.placa }, { texto: m.descricao, sub: m.data_vencimento ? `vence ${dataBr(m.data_vencimento)}` : undefined },
          { texto: m.pontuacao ? String(m.pontuacao) : '—', cor: MUTED },
          { texto: rotuloSituacao(m.situacao), cor: m.situacao === 'A_PAGAR' ? PERIGO : MUTED },
          { texto: rotuloDesconto(m), cor: situacaoDesconto(m) === 'A_DESCONTAR' ? ALERTA : MUTED },
          { texto: brl(m.valor), negrito: m.situacao !== 'CANCELADA', cor: m.situacao === 'CANCELADA' ? MUTED : undefined },
        ]),
      }],
    };
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>Multas de {condutor.nome}</DialogTitle>
              <DialogDescription>
                {condutor.cadastrado ? 'Condutor cadastrado' : 'Nome informado na multa (sem cadastro)'} · {unidade} · {periodo}
              </DialogDescription>
            </div>
            <BotaoPdf montar={montarPdf} />
          </div>
        </DialogHeader>
        <Indicadores kpis={kpis} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Placa</th><th className="py-2 pr-3">Infração</th>
                <th className="py-2 pr-3">Vencimento</th><th className="py-2 pr-3 text-right">Pontos</th><th className="py-2 pr-3">Situação</th>
                <th className="py-2 pr-3">Desconto</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2">Anexo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataBr(m.data_infracao)}</td>
                  <td className="py-2 pr-3 font-mono">{m.placa}</td>
                  <td className="py-2 pr-3 max-w-64"><p className="truncate" title={m.descricao}>{m.descricao}</p></td>
                  <td className="py-2 pr-3 whitespace-nowrap">{m.data_vencimento ? dataBr(m.data_vencimento) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{m.pontuacao || '—'}</td>
                  <td className="py-2 pr-3"><Badge variant={m.situacao === 'A_PAGAR' ? 'destructive' : 'outline'}>{rotuloSituacao(m.situacao)}</Badge></td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Badge variant={situacaoDesconto(m) === 'A_DESCONTAR' ? 'secondary' : 'outline'}>{rotuloDesconto(m)}</Badge>
                  </td>
                  <td className={`py-2 pr-3 text-right whitespace-nowrap ${m.situacao === 'CANCELADA' ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                    {brl(m.valor)}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center">
                      <BotaoEnviarAnexo temArquivo={!!m.nome_arquivo}
                        enviar={async (arquivo) => onAnexo(m.id, await anexarArquivoMulta(m.id, arquivo))} />
                      {m.nome_arquivo && (
                        <BotoesAnexo nome={m.nome_arquivo} abrir={() => anexoMulta(m.id)} baixar={() => anexoMulta(m.id, m.nome_arquivo)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">Nenhuma multa no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const sel = useUnidadeFrotas();
  const { unidade } = sel;
  const placas = usePlacasFrota(unidade);

  const [de, setDe] = useState(inicioAnoPassado());
  const [ate, setAte] = useState(isoHoje());
  const [carregando, setCarregando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [multas, setMultas] = useState<FrotaMulta[]>([]);
  const [manutencoes, setManutencoes] = useState<FrotaManutencao[]>([]);
  const [sinistros, setSinistros] = useState<FrotaSinistro[]>([]);
  const [condutores, setCondutores] = useState<FrotaCondutor[]>([]);
  const [ordemCondutores, setOrdemCondutores] = useState<keyof typeof ORDEM_CONDUTORES>('QTD');
  const [ordemVeiculos, setOrdemVeiculos] = useState<keyof typeof ORDEM_VEICULOS>('QTD');
  const [todosCondutores, setTodosCondutores] = useState(false);
  const [todosVeiculos, setTodosVeiculos] = useState(false);
  const [condutorAberto, setCondutorAberto] = useState<string | null>(null);
  const [veiculoAberto, setVeiculoAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    if (de && ate && de > ate) {
      toast.error('A data inicial não pode ser depois da final.');
      return;
    }
    setCarregando(true);
    // Cada fonte carrega sozinha: se uma falhar (ex.: script do banco pendente), as outras aparecem.
    const [mu, ma, si, co] = await Promise.allSettled([
      listarMultas(unidade, de || undefined, ate || undefined),
      listarManutencoes(unidade, de || undefined, ate || undefined),
      listarSinistros(unidade, de || undefined, ate || undefined),
      listarCondutores(unidade),
    ]);
    const falhas: string[] = [];
    const valor = <T,>(r: PromiseSettledResult<T[]>, nome: string): T[] => {
      if (r.status === 'fulfilled') return r.value;
      falhas.push(`${nome}: ${r.reason instanceof Error ? r.reason.message : 'falha ao carregar'}`);
      return [];
    };
    setMultas(valor(mu, 'Multas'));
    setManutencoes(valor(ma, 'Manutenções'));
    setSinistros(valor(si, 'Sinistros'));
    setCondutores(valor(co, 'Condutores'));
    falhas.forEach((f) => toast.error(f));
    setCarregando(false);
  }, [unidade, de, ate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const validas = useMemo(() => multas.filter((m) => m.situacao !== 'CANCELADA'), [multas]);

  // Condutor de cada multa: o cadastro vinculado; sem vínculo, o cadastro de mesmo nome (regra da aba Condutores);
  // sem cadastro, o nome digitado na multa.
  const { chavePorMulta, nomes } = useMemo(() => {
    const porId = new Map(condutores.map((c) => [c.id, c.nome]));
    const porNome = new Map(condutores.map((c) => [chaveNome(c.nome), c]));
    const chaves = new Map<number, string>();
    const info = new Map<string, { nome: string; cadastrado: boolean }>();
    for (const m of multas) {
      const cadastro = m.id_condutor ? porId.get(m.id_condutor) : undefined;
      const nomeMulta = m.condutor?.trim();
      if (!cadastro && !nomeMulta) continue;
      const mesmoNome = !cadastro && nomeMulta ? porNome.get(chaveNome(nomeMulta)) : undefined;
      const chave = cadastro ? `id:${m.id_condutor}` : mesmoNome ? `id:${mesmoNome.id}` : `nome:${chaveNome(nomeMulta!)}`;
      chaves.set(m.id, chave);
      if (!info.has(chave)) info.set(chave, { nome: cadastro ?? mesmoNome?.nome ?? chaveNome(nomeMulta!), cadastrado: !!(cadastro || mesmoNome) });
    }
    return { chavePorMulta: chaves, nomes: info };
  }, [multas, condutores]);

  const rankingCondutores = useMemo(() => {
    const mapa = new Map<string, RankingCondutor>();
    for (const m of validas) {
      const chave = chavePorMulta.get(m.id);
      if (!chave) continue;
      const n = nomes.get(chave)!;
      const r = mapa.get(chave) ?? { chave, nome: n.nome, cadastrado: n.cadastrado, multas: 0, valor: 0, pontos: 0, aDescontar: 0, placas: [] };
      r.multas++;
      r.valor += m.valor;
      r.pontos += m.pontuacao ?? 0;
      if (situacaoDesconto(m) === 'A_DESCONTAR') r.aDescontar += m.valor;
      if (!r.placas.includes(m.placa)) r.placas.push(m.placa);
      mapa.set(chave, r);
    }
    const criterio = {
      QTD: (a: RankingCondutor, b: RankingCondutor) => b.multas - a.multas || b.valor - a.valor,
      VALOR: (a: RankingCondutor, b: RankingCondutor) => b.valor - a.valor || b.multas - a.multas,
      PONTOS: (a: RankingCondutor, b: RankingCondutor) => b.pontos - a.pontos || b.multas - a.multas,
    }[ordemCondutores];
    return [...mapa.values()].sort(criterio);
  }, [validas, chavePorMulta, nomes, ordemCondutores]);

  const semCondutor = useMemo(() => {
    const sem = validas.filter((m) => !chavePorMulta.has(m.id));
    return { multas: sem.length, valor: sem.reduce((s, m) => s + m.valor, 0) };
  }, [validas, chavePorMulta]);

  const rankingVeiculos = useMemo(() => {
    const info = new Map(placas.map((p) => [p.placa, [p.frota, p.modelo].filter(Boolean).join(' · ')]));
    const frota = (t?: string | null) => (t && t !== 'PROPRIA' ? TIPOS_FROTA.find((x) => x.valor === t)?.rotulo ?? t : '');
    const mapa = new Map<string, RankingVeiculo>();
    const doVeiculo = (placa: string, tipo?: string | null) => {
      let r = mapa.get(placa);
      if (!r) {
        r = {
          placa,
          descricao: info.get(placa) || (frota(tipo) ? `Locado · ${frota(tipo)}` : ''),
          consertos: 0, corretivas: 0, valorCorretivas: 0, preventivas: 0, valorPreventivas: 0,
          sinistros: 0, valorSinistros: 0, multas: 0, valorMultas: 0, custo: 0,
        };
        mapa.set(placa, r);
      }
      return r;
    };
    for (const m of manutencoes) {
      const r = doVeiculo(m.placa);
      if (CONSERTOS.has(m.classificacao)) {
        r.corretivas++;
        r.valorCorretivas += m.valor;
        r.consertos++;
      } else {
        r.preventivas++;
        r.valorPreventivas += m.valor;
      }
      r.custo += m.valor;
    }
    for (const s of sinistros) {
      const r = doVeiculo(s.placa, s.tipo_frota);
      r.sinistros++;
      r.valorSinistros += s.valor ?? 0;
      r.consertos++;
      r.custo += s.valor ?? 0;
    }
    // Multas só complementam veículos que já tiveram manutenção ou sinistro.
    for (const m of validas) {
      const r = mapa.get(m.placa);
      if (!r) continue;
      r.multas++;
      r.valorMultas += m.valor;
    }
    const criterio = {
      QTD: (a: RankingVeiculo, b: RankingVeiculo) => b.consertos - a.consertos || b.custo - a.custo,
      CUSTO: (a: RankingVeiculo, b: RankingVeiculo) => b.custo - a.custo || b.consertos - a.consertos,
    }[ordemVeiculos];
    return [...mapa.values()].sort(criterio);
  }, [manutencoes, sinistros, validas, placas, ordemVeiculos]);

  const totais = useMemo(() => {
    const valorMultas = validas.reduce((s, m) => s + m.valor, 0);
    const valorManut = manutencoes.reduce((s, m) => s + m.valor, 0);
    const valorCorretiva = manutencoes.filter((m) => CONSERTOS.has(m.classificacao)).reduce((s, m) => s + m.valor, 0);
    const valorSin = sinistros.reduce((s, x) => s + (x.valor ?? 0), 0);
    const aDescontar = validas.filter((m) => situacaoDesconto(m) === 'A_DESCONTAR').reduce((s, m) => s + m.valor, 0);
    const consertos = manutencoes.filter((m) => CONSERTOS.has(m.classificacao)).length + sinistros.length;
    return { valorMultas, valorManut, valorCorretiva, valorSin, aDescontar, consertos, gasto: valorManut + valorSin + valorMultas };
  }, [validas, manutencoes, sinistros]);

  const kpis: KpiPdf[] = [
    { rotulo: 'Multas', valor: brl(totais.valorMultas), detalhe: `${validas.length} multa(s), sem canceladas` },
    { rotulo: 'A descontar dos colaboradores', valor: brl(totais.aDescontar), detalhe: 'multas ainda não descontadas' },
    { rotulo: 'Condutores com multa', valor: String(rankingCondutores.length), detalhe: rankingCondutores[0] ? `mais multas: ${rankingCondutores[0].nome}` : '—' },
    { rotulo: 'Manutenções', valor: brl(totais.valorManut), detalhe: `${manutencoes.length} serviço(s)` },
    { rotulo: 'Sinistros', valor: brl(totais.valorSin), detalhe: `${sinistros.length} sinistro(s)` },
    { rotulo: 'Gasto total', valor: brl(totais.gasto), detalhe: `${totais.consertos} conserto(s) · manutenção + sinistros + multas` },
  ];

  const metricaCondutor = (c: RankingCondutor) => (ordemCondutores === 'VALOR' ? c.valor : ordemCondutores === 'PONTOS' ? c.pontos : c.multas);
  const textoCondutor = (v: number) => (ordemCondutores === 'VALOR' ? brl(v) : ordemCondutores === 'PONTOS' ? `${v} pts` : `${v} multa(s)`);
  const metricaVeiculo = (v: RankingVeiculo) => (ordemVeiculos === 'CUSTO' ? v.custo : v.consertos);
  const textoVeiculo = (v: number) => (ordemVeiculos === 'CUSTO' ? brl(v) : `${v} conserto(s)`);

  const pizzaGasto = montarFatias(
    [
      { rotulo: 'Manutenção corretiva', valor: totais.valorCorretiva },
      { rotulo: 'Manutenção preventiva', valor: totais.valorManut - totais.valorCorretiva },
      { rotulo: 'Sinistros', valor: totais.valorSin },
      { rotulo: 'Multas', valor: totais.valorMultas },
    ],
    () => '', (x) => x.rotulo, (x) => x.valor, brl
  );
  const pizzaCondutores = montarFatias(rankingCondutores, (c) => c.chave, (c) => c.nome, metricaCondutor, textoCondutor);
  const pizzaVeiculos = montarFatias(rankingVeiculos, (v) => v.placa, (v) => v.placa + (v.descricao ? ` · ${v.descricao}` : ''),
    metricaVeiculo, textoVeiculo);
  const graficos = [
    { titulo: 'Para onde vai o gasto', fatias: pizzaGasto, centro: brl(totais.gasto) },
    { titulo: { QTD: 'Multas por condutor', VALOR: 'Valor das multas por condutor', PONTOS: 'Pontos por condutor' }[ordemCondutores],
      fatias: pizzaCondutores, centro: textoCondutor(rankingCondutores.reduce((s, c) => s + metricaCondutor(c), 0)) },
    { titulo: ordemVeiculos === 'CUSTO' ? 'Custo por veículo' : 'Consertos por veículo', fatias: pizzaVeiculos,
      centro: textoVeiculo(rankingVeiculos.reduce((s, v) => s + metricaVeiculo(v), 0)) },
  ];

  const periodo = `${de ? dataBr(de) : 'início'} a ${ate ? dataBr(ate) : 'hoje'}`;

  async function gerarPdf() {
    setGerandoPdf(true);
    try {
      const [{ gerarPdfDashboardFrota }, { salvarPdf, slugArquivo }] = await Promise.all([
        import('@/lib/frotasDashboardPdf'),
        import('@/lib/usuarioPermissoesRelatorioPdf'),
      ]);
      const doc = gerarPdfDashboardFrota({
        unidade,
        periodo,
        geradoPor: nomeDaSessao(),
        kpis,
        graficos: graficos.map((g) => ({ titulo: g.titulo, fatias: g.fatias })),
        condutores: rankingCondutores,
        ordemCondutores: ORDEM_CONDUTORES[ordemCondutores],
        semCondutor,
        veiculos: rankingVeiculos,
        ordemVeiculos: ORDEM_VEICULOS[ordemVeiculos],
      });
      await salvarPdf(doc, `dashboard-frotas-${slugArquivo(unidade)}-${de || 'inicio'}-a-${ate || isoHoje()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  const condutoresVisiveis = todosCondutores ? rankingCondutores : rankingCondutores.slice(0, TOP);
  const veiculosVisiveis = todosVeiculos ? rankingVeiculos : rankingVeiculos.slice(0, TOP);
  const maxCondutor = Math.max(0, ...rankingCondutores.map(metricaCondutor));
  const maxVeiculo = Math.max(0, ...rankingVeiculos.map(metricaVeiculo));
  const condutorSelecionado = condutorAberto
    ? rankingCondutores.find((c) => c.chave === condutorAberto) ?? null
    : null;
  const veiculoSelecionado = veiculoAberto ? rankingVeiculos.find((v) => v.placa === veiculoAberto) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Condutores com mais multas e veículos com mais consertos no período. Clique num condutor ou veículo para ver o histórico.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} rotulo="Período" />
          <SeletorUnidade {...sel} />
          <Button type="button" variant="ghost" title="Recarregar" disabled={!unidade || carregando} onClick={() => void carregar()}>
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" onClick={() => void gerarPdf()} disabled={!unidade || carregando || gerandoPdf}>
            {gerandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <CartaoIndicador key={k.rotulo} {...ESTILO_KPI[i % ESTILO_KPI.length]} rotulo={k.rotulo}
            valor={carregando ? '…' : k.valor} detalhe={k.detalhe} destaque={i === kpis.length - 1} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Pizza titulo={graficos[0].titulo} subtitulo="Manutenção, sinistros e multas" fatias={graficos[0].fatias}
          centro={graficos[0].centro} />
        <Pizza titulo={graficos[1].titulo} subtitulo="Clique no condutor para ver as multas" fatias={graficos[1].fatias}
          centro={graficos[1].centro} onClicar={setCondutorAberto} />
        <Pizza titulo={graficos[2].titulo} subtitulo="Clique no veículo para ver o histórico" fatias={graficos[2].fatias}
          centro={graficos[2].centro} onClicar={setVeiculoAberto} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Condutores com mais multas</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ordenar por</span>
                <Select value={ordemCondutores} onValueChange={(v) => setOrdemCondutores(v as keyof typeof ORDEM_CONDUTORES)}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QTD">Quantidade de multas</SelectItem>
                    <SelectItem value="VALOR">Valor das multas</SelectItem>
                    <SelectItem value="PONTOS">Pontos na CNH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique no condutor para ver as multas. Multas canceladas não entram.
              {semCondutor.multas > 0 && ` ${semCondutor.multas} multa(s) sem condutor identificado (${brl(semCondutor.valor)}) ficam fora do ranking.`}
            </p>
          </CardHeader>
          <CardContent>
            {condutoresVisiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{carregando ? 'Carregando…' : 'Nenhuma multa no período.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 w-8">#</th>
                      <th className="py-2 pr-2">Condutor</th>
                      <th className="py-2 pr-2 text-right">Multas</th>
                      <th className="py-2 pr-2 text-right">Valor</th>
                      <th className="py-2 pr-2 text-right">Pontos</th>
                      <th className="py-2 text-right">A descontar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {condutoresVisiveis.map((c, i) => (
                      <tr key={c.chave} className="border-b last:border-0 align-top cursor-pointer hover:bg-muted/50"
                        title="Ver as multas" onClick={() => setCondutorAberto(c.chave)}>
                        <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-2 min-w-48">
                          <p className={i < 3 ? 'font-semibold' : ''}>
                            {c.nome}
                            {!c.cadastrado && <Badge variant="outline" className="ml-2 text-[10px]">sem cadastro</Badge>}
                          </p>
                          <Barra valor={metricaCondutor(c)} maximo={maxCondutor} cor="bg-amber-500" />
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-72" title={c.placas.join(', ')}>
                            {c.placas.join(', ')}
                          </p>
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">{c.multas}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(c.valor)}</td>
                        <td className={`py-2 pr-2 text-right ${c.pontos >= 20 ? 'text-red-600 font-semibold' : ''}`}>{c.pontos || '—'}</td>
                        <td className={`py-2 text-right whitespace-nowrap ${c.aDescontar ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {c.aDescontar ? brl(c.aDescontar) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rankingCondutores.length > TOP && (
                  <Button type="button" variant="link" className="px-0" onClick={() => setTodosCondutores((v) => !v)}>
                    {todosCondutores ? `Mostrar só os ${TOP} primeiros` : `Ver todos (${rankingCondutores.length})`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Veículos com mais consertos</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ordenar por</span>
                <Select value={ordemVeiculos} onValueChange={(v) => setOrdemVeiculos(v as keyof typeof ORDEM_VEICULOS)}>
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QTD">Quantidade de consertos</SelectItem>
                    <SelectItem value="CUSTO">Custo total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique no veículo para ver o histórico de manutenção e valores. Consertos = manutenção corretiva, funilaria/pintura e
              borracharia + sinistros; preventiva aparece à parte. Custo total = manutenções + sinistros.
            </p>
          </CardHeader>
          <CardContent>
            {veiculosVisiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {carregando ? 'Carregando…' : 'Nenhuma manutenção ou sinistro no período.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 w-8">#</th>
                      <th className="py-2 pr-2">Veículo</th>
                      <th className="py-2 pr-2 text-right">Consertos</th>
                      <th className="py-2 pr-2 text-right">Corretiva</th>
                      <th className="py-2 pr-2 text-right">Sinistros</th>
                      <th className="py-2 pr-2 text-right">Preventiva</th>
                      <th className="py-2 text-right">Custo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculosVisiveis.map((v, i) => (
                      <tr key={v.placa} className="border-b last:border-0 align-top cursor-pointer hover:bg-muted/50"
                        title="Ver o histórico" onClick={() => setVeiculoAberto(v.placa)}>
                        <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-2 min-w-40">
                          <p className={`font-mono ${i < 3 ? 'font-semibold' : ''}`}>{v.placa}</p>
                          <Barra valor={metricaVeiculo(v)} maximo={maxVeiculo} cor="bg-sky-600" />
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-56" title={v.descricao}>
                            {v.descricao || '—'}
                            {v.multas > 0 && ` · ${v.multas} multa(s)`}
                          </p>
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold">{v.consertos}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {brl(v.valorCorretivas)}
                          <p className="text-xs text-muted-foreground">{v.corretivas} serviço(s)</p>
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {brl(v.valorSinistros)}
                          <p className="text-xs text-muted-foreground">{v.sinistros} sinistro(s)</p>
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap text-muted-foreground">
                          {brl(v.valorPreventivas)}
                          <p className="text-xs">{v.preventivas} serviço(s)</p>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap font-semibold">{brl(v.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rankingVeiculos.length > TOP && (
                  <Button type="button" variant="link" className="px-0" onClick={() => setTodosVeiculos((v) => !v)}>
                    {todosVeiculos ? `Mostrar só os ${TOP} primeiros` : `Ver todos (${rankingVeiculos.length})`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DetalheCondutor
        condutor={condutorSelecionado}
        multas={condutorAberto ? multas.filter((m) => chavePorMulta.get(m.id) === condutorAberto) : []}
        unidade={unidade}
        periodo={periodo}
        onAnexo={(id, nome) => setMultas((lista) => lista.map((m) => (m.id === id ? { ...m, nome_arquivo: nome } : m)))}
        onFechar={() => setCondutorAberto(null)}
      />
      <DetalheVeiculo
        veiculo={veiculoSelecionado}
        manutencoes={manutencoes}
        sinistros={sinistros}
        multas={multas}
        unidade={unidade}
        periodo={periodo}
        onFechar={() => setVeiculoAberto(null)}
      />
    </div>
  );
}
