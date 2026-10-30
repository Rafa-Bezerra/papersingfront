'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CarFront, Clock, Download, Eye, FileDown, Loader2, RefreshCw, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  abrirDocumentoFrota,
  baixarDocumentoFrota,
  FrotaPlaca,
  listarPlacas,
  unidadeDaSessao,
  UNIDADES_FROTAS,
} from '@/services/frotasService';
import type { CelulaValidade } from '@/lib/frotasRelatorioPdf';

import { CartaoIndicador, nomeDaSessao } from './comum';
import VeiculoDialog, { dataBr } from './VeiculoDialog';

const DIAS_ALERTA = 30;

type Filtro = 'todos' | 'vencidos' | 'vencendo';

function isoEmDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Vencimentos = {
  vencidos: { tipo: string; validade: string }[];
  vencendo: { tipo: string; validade: string }[];
};

function vencimentosDa(p: FrotaPlaca, hoje: string, limite: string): Vencimentos {
  const vencidos: Vencimentos['vencidos'] = [];
  const vencendo: Vencimentos['vencendo'] = [];
  for (const v of p.validades ?? []) {
    if (!v.validade) continue;
    const dia = v.validade.slice(0, 10);
    if (dia < hoje) vencidos.push({ tipo: v.tipo, validade: dia });
    else if (dia <= limite) vencendo.push({ tipo: v.tipo, validade: dia });
  }
  return { vencidos, vencendo };
}

function BadgeValidade({ tem, validade, hoje, limite }: { tem?: boolean; validade?: string | null; hoje: string; limite: string }) {
  if (!tem) return <Badge variant="outline">Sem</Badge>;
  if (!validade) return <Badge variant="secondary">Anexado</Badge>;
  const dia = validade.slice(0, 10);
  if (dia < hoje) return <Badge variant="destructive">Vencido {dataBr(dia)}</Badge>;
  if (dia <= limite)
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
        Vence {dataBr(dia)}
      </Badge>
    );
  return <Badge variant="secondary">Até {dataBr(dia)}</Badge>;
}

function CelulaDocumento({ tem, validade, docId, arquivo, rotulo, hoje, limite }: {
  tem?: boolean;
  validade?: string | null;
  docId?: number | null;
  arquivo?: string | null;
  rotulo: string;
  hoje: string;
  limite: string;
}) {
  const falha = (e: unknown) => toast.error(e instanceof Error ? e.message : `Falha ao abrir ${rotulo}.`);
  return (
    <div className="flex items-center gap-1">
      <BadgeValidade tem={tem} validade={validade} hoje={hoje} limite={limite} />
      {docId ? (
        <>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={`Visualizar ${rotulo}`}
            onClick={() => abrirDocumentoFrota(docId).catch(falha)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title={`Baixar ${rotulo}`}
            onClick={() => baixarDocumentoFrota(docId, arquivo ?? '').catch(falha)}>
            <Download className="h-4 w-4" />
          </Button>
        </>
      ) : null}
    </div>
  );
}

function celulaValidade(tem: boolean | undefined, validade: string | null | undefined, hoje: string, limite: string): CelulaValidade {
  if (!tem) return { texto: 'Sem', nivel: 'neutro' };
  if (!validade) return { texto: 'Anexado', nivel: 'neutro' };
  const dia = validade.slice(0, 10);
  if (dia < hoje) return { texto: `Vencido ${dataBr(dia)}`, nivel: 'vencido' };
  if (dia <= limite) return { texto: `Vence ${dataBr(dia)}`, nivel: 'alerta' };
  return { texto: `Até ${dataBr(dia)}`, nivel: 'ok' };
}

export default function GestaoFrotasPage() {
  const [unidade, setUnidade] = useState('');
  const [podeTrocarUnidade, setPodeTrocarUnidade] = useState(false);
  const [todas, setTodas] = useState<FrotaPlaca[]>([]);
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [placaAberta, setPlacaAberta] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const hoje = isoEmDias(0);
  const limite = isoEmDias(DIAS_ALERTA);

  useEffect(() => {
    const propria = unidadeDaSessao();
    const naLista = (UNIDADES_FROTAS as readonly string[]).includes(propria);
    // Só a WAY CSC atende todas as unidades; as demais (inclusive Admin) veem só a própria.
    setPodeTrocarUnidade(propria === 'WAY CSC');
    setUnidade(naLista ? propria : '');
  }, []);

  const carregar = useCallback(async (u: string, termo?: string) => {
    setCarregando(true);
    try {
      setTodas(await listarPlacas(u, termo));
      setBuscaAplicada((termo ?? '').trim());
    } catch (e) {
      setTodas([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os veículos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!unidade) return;
    setBusca('');
    setFiltro('todos');
    void carregar(unidade);
  }, [unidade, carregar]);

  // Desativado no RM não conta nos cards nem nos alertas; só aparece para consultar/baixar documentos.
  const placas = useMemo(() => todas.filter((p) => p.ativo), [todas]);
  const desativadas = useMemo(() => todas.filter((p) => !p.ativo), [todas]);

  const comVencimentos = useMemo(
    () => placas.map((p) => ({ placa: p, ...vencimentosDa(p, hoje, limite) })),
    [placas, hoje, limite]
  );
  const totalVencidos = comVencimentos.filter((x) => x.vencidos.length > 0).length;
  const totalVencendo = comVencimentos.filter((x) => x.vencidos.length === 0 && x.vencendo.length > 0).length;

  const linhas = useMemo(() => {
    const filtradas = comVencimentos.filter((x) =>
      filtro === 'vencidos'
        ? x.vencidos.length > 0
        : filtro === 'vencendo'
          ? x.vencidos.length === 0 && x.vencendo.length > 0
          : true
    );
    // Pendências primeiro: vencidos, depois vencendo, depois o resto.
    const peso = (x: (typeof filtradas)[number]) => (x.vencidos.length ? 0 : x.vencendo.length ? 1 : 2);
    const ordenadas = [...filtradas].sort((a, b) => peso(a) - peso(b));
    if (filtro !== 'todos' || !mostrarDesativados) return ordenadas;
    return [...ordenadas, ...desativadas.map((p) => ({ placa: p, vencidos: [], vencendo: [] } as typeof ordenadas[number]))];
  }, [comVencimentos, filtro, mostrarDesativados, desativadas]);

  async function handleGerarPdf() {
    setGerandoPdf(true);
    try {
      const [{ gerarPdfRelacaoFrota }, { salvarPdf, slugArquivo }] = await Promise.all([
        import('@/lib/frotasRelatorioPdf'),
        import('@/lib/usuarioPermissoesRelatorioPdf'),
      ]);
      const doc = gerarPdfRelacaoFrota({
        unidade,
        filtroLabel:
          filtro === 'vencidos'
            ? 'Com documento vencido'
            : filtro === 'vencendo'
              ? `Vencendo em ${DIAS_ALERTA} dias`
              : 'Todos os veículos ativos',
        busca: buscaAplicada,
        geradoPor: nomeDaSessao(),
        totais: {
          veiculos: placas.length,
          vencidos: totalVencidos,
          vencendo: totalVencendo,
          semResponsavel: placas.filter((p) => !p.responsavel_nome).length,
        },
        linhas: linhas.map((x) => ({
          placa: x.placa.placa,
          frota: x.placa.frota ?? '',
          modelo: x.placa.modelo,
          responsavel: x.placa.responsavel_nome ?? '',
          setor: x.placa.responsavel_setor ?? '',
          telefone: x.placa.responsavel_telefone ?? '',
          cnh: celulaValidade(x.placa.tem_cnh, x.placa.cnh_validade, hoje, limite),
          crlv: celulaValidade(x.placa.tem_crlv, x.placa.crlv_validade, hoje, limite),
          vencimentos: [
            ...x.vencidos.map((v) => ({ texto: `${v.tipo} vencido ${dataBr(v.validade)}`, nivel: 'vencido' as const })),
            ...x.vencendo.map((v) => ({ texto: `${v.tipo} vence ${dataBr(v.validade)}`, nivel: 'alerta' as const })),
          ],
        })),
      });
      const sufixo = filtro === 'todos' ? '' : `-${filtro}`;
      await salvarPdf(doc, `relacao-frota-${slugArquivo(unidade)}${sufixo}-${hoje}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  const colunas: ColumnDef<(typeof linhas)[number]>[] = useMemo(
    () => [
      {
        id: 'placa',
        header: 'Veículo',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-mono font-medium">
              {row.original.placa.placa}
              {!row.original.placa.ativo && (
                <Badge variant="outline" className="ml-2 font-sans text-muted-foreground">
                  Desativado
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {[row.original.placa.frota, row.original.placa.modelo].filter(Boolean).join(' · ')}
            </p>
          </div>
        ),
      },
      {
        id: 'responsavel',
        header: 'Com quem está',
        cell: ({ row }) =>
          row.original.placa.responsavel_nome ? (
            <div className="leading-tight">
              <p className="font-medium">{row.original.placa.responsavel_nome}</p>
              <p className="text-xs text-muted-foreground">
                {[row.original.placa.responsavel_setor, row.original.placa.responsavel_telefone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground">Ninguém</span>
          ),
      },
      {
        id: 'cnh',
        header: 'CNH',
        cell: ({ row }) => (
          <CelulaDocumento
            tem={row.original.placa.tem_cnh}
            validade={row.original.placa.cnh_validade}
            docId={row.original.placa.cnh_doc_id}
            arquivo={row.original.placa.cnh_arquivo}
            rotulo="a CNH"
            hoje={hoje}
            limite={limite}
          />
        ),
      },
      {
        id: 'crlv',
        header: 'CRLV',
        cell: ({ row }) => (
          <CelulaDocumento
            tem={row.original.placa.tem_crlv}
            validade={row.original.placa.crlv_validade}
            docId={row.original.placa.crlv_doc_id}
            arquivo={row.original.placa.crlv_arquivo}
            rotulo="o CRLV"
            hoje={hoje}
            limite={limite}
          />
        ),
      },
      {
        id: 'pendencias',
        header: 'Vencimentos',
        cell: ({ row }) => {
          const { vencidos, vencendo } = row.original;
          if (!vencidos.length && !vencendo.length) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {vencidos.map((v) => (
                <Badge key={`v-${v.tipo}`} variant="destructive">
                  {v.tipo} vencido {dataBr(v.validade)}
                </Badge>
              ))}
              {vencendo.map((v) => (
                <Badge
                  key={`a-${v.tipo}`}
                  variant="outline"
                  className="border-amber-500 text-amber-600 dark:text-amber-400"
                >
                  {v.tipo} vence {dataBr(v.validade)}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: 'acoes',
        header: '',
        cell: ({ row }) => (
          <Button type="button" size="sm" variant="outline" onClick={() => setPlacaAberta(row.original.placa.placa)}>
            <UserRound className="h-4 w-4 mr-1" /> Abrir
          </Button>
        ),
      },
    ],
    [hoje, limite]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CarFront className="h-6 w-6" /> Gestão de frotas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Com quem está cada veículo, CNH e documentos. Fica só no PaperSign; o cadastro da placa no RM é na aba
            Cadastro no RM.
          </p>
        </div>
        <div className="w-48 space-y-1">
          <Label>Unidade</Label>
          {podeTrocarUnidade ? (
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_FROTAS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 rounded-md border px-3 flex items-center text-sm">{unidade || '—'}</div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoIndicador
          icone={CarFront}
          tom="azul"
          destaque
          rotulo="Veículos ativos"
          valor={placas.length}
          detalhe={desativadas.length ? `${desativadas.length} desativado(s) no RM` : 'cadastrados no RM'}
          ativo={filtro === 'todos'}
          onClick={() => setFiltro('todos')}
        />
        <CartaoIndicador
          icone={AlertTriangle}
          tom="vermelho"
          rotulo="Com documento vencido"
          valor={totalVencidos}
          detalhe="veículos com algum documento vencido"
          corValor={totalVencidos ? 'text-destructive' : ''}
          ativo={filtro === 'vencidos'}
          onClick={() => setFiltro('vencidos')}
        />
        <CartaoIndicador
          icone={Clock}
          tom="ambar"
          rotulo={`Vencendo em ${DIAS_ALERTA} dias`}
          valor={totalVencendo}
          detalhe="renovar antes do vencimento"
          corValor={totalVencendo ? 'text-amber-600 dark:text-amber-400' : ''}
          ativo={filtro === 'vencendo'}
          onClick={() => setFiltro('vencendo')}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {filtro !== 'todos' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            {filtro === 'vencidos'
              ? 'Veículos com documento vencido'
              : filtro === 'vencendo'
                ? `Veículos com documento vencendo em ${DIAS_ALERTA} dias`
                : `Veículos (${unidade || '—'})`}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground mr-2" title="Veículos desativados no RM, para consultar e baixar os documentos">
              <Checkbox
                checked={mostrarDesativados}
                onCheckedChange={(v) => {
                  setMostrarDesativados(v === true);
                  if (v === true) setFiltro('todos');
                }}
              />
              Mostrar desativados{desativadas.length ? ` (${desativadas.length})` : ''}
            </label>
            <Input
              placeholder="Buscar placa, frota ou modelo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && unidade) void carregar(unidade, busca);
              }}
              className="w-64"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => unidade && void carregar(unidade, busca)}
              disabled={!unidade}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              title="Recarregar"
              disabled={!unidade}
              onClick={() => {
                setBusca('');
                if (unidade) void carregar(unidade);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleGerarPdf()}
              disabled={!unidade || carregando || gerandoPdf}
              title="Gera o PDF da relação exibida (com o filtro e a busca atuais)"
            >
              {gerandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunas}
            data={linhas}
            loading={carregando}
            hideSearch
            emptyMessage={filtro === 'todos' ? 'Nenhum veículo encontrado.' : 'Nenhum veículo nessa situação.'}
          />
        </CardContent>
      </Card>

      <VeiculoDialog
        unidade={unidade}
        placa={placaAberta}
        onClose={() => setPlacaAberta(null)}
        onAlterado={() => void carregar(unidade, busca)}
      />
    </div>
  );
}
