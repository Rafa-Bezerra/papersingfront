'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileSignature,
  Filter,
  Loader2,
  Paperclip,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import PdfViewerDialog from '@/components/PdfViewerDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  alterarAreaContrato,
  anexarArquivoContrato,
  AREAS_CONTRATO,
  AreaContrato,
  concluirContrato,
  Contrato,
  ContratoAprovacao,
  ContratoIndicadores,
  DestinatarioWaySign,
  enviarContratoWaySign,
  labelArea,
  labelStatus,
  listarContratos,
  obterAprovacaoContrato,
  obterArquivoAnexoContrato,
  obterContrato,
  obterIndicadoresContratos,
  resgatarContratoWaySign,
  SituacaoFiltro,
  TipoAnexoContrato,
} from '@/services/contratosService';
import { safeDateLabel, safeDateTimeLabel, toBase64, toMoney } from '@/utils/functions';
import { corUnidadePendencia } from '@/utils/pendenciaNavigation';

const INDICADORES_VAZIOS: ContratoIndicadores = {
  aguardando_contrato: 0,
  em_assinatura: 0,
  vencem_30_dias: 0,
  concluidos_mes: 0,
};

const KPIS: { chave: keyof ContratoIndicadores; label: string; cor: string }[] = [
  {
    chave: 'aguardando_contrato',
    label: 'Aguardando contrato',
    cor: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    chave: 'em_assinatura',
    label: 'Em assinatura (WaySign)',
    cor: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  {
    chave: 'vencem_30_dias',
    label: 'Vencem em 30 dias',
    cor: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  {
    chave: 'concluidos_mes',
    label: 'Concluídos no mês',
    cor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
];

const BTN_APROVACAO =
  'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300';
const BTN_CONTRATO =
  'border-blue-500/40 bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 dark:text-blue-300';
const BTN_DOC =
  'border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300';

function corArea(area: string): string {
  switch (area) {
    case 'JURIDICO':
      return 'border-amber-500/40 text-amber-700 dark:text-amber-300';
    case 'DU':
      return 'border-cyan-500/40 text-cyan-700 dark:text-cyan-300';
    case 'GAF':
      return 'border-pink-500/40 text-pink-700 dark:text-pink-300';
    default:
      return 'border-border text-muted-foreground';
  }
}

function corStatus(status: string): string {
  switch (status) {
    case 'AGUARDANDO_CONTRATO':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'EM_ASSINATURA':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
    case 'CONCLUIDO':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function labelVigencia(c: Contrato): string {
  if (!c.vigencia_inicio || !c.vigencia_fim) return 'Vigência a definir';
  const ini = new Date(c.vigencia_inicio);
  const fim = new Date(c.vigencia_fim);
  const meses = Math.max(
    1,
    (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth())
  );
  return `${meses} ${meses === 1 ? 'mês' : 'meses'} · até ${safeDateLabel(c.vigencia_fim)}`;
}

// Código do contrato no TOTVS; sem ele (falha ao gravar o controle), cai no movimento da requisição.
function numeroContrato(c: Contrato): string {
  return c.codigo_contrato || c.numero_precontrato || String(c.idmov_precontrato ?? c.id);
}

function tituloContrato(c: Contrato): string {
  const numero = numeroContrato(c);
  return c.fornecedor ? `Contrato ${numero} · ${c.fornecedor}` : `Contrato ${numero}`;
}

// O "Criar Contrato" não gera movimento no RM: o número gravado na fila é o da requisição de origem.
function movimentoRequisicao(c: Contrato): string | null {
  const mov = c.numero_precontrato || (c.idmov_precontrato ? String(c.idmov_precontrato) : '');
  return mov ? `Mov. ${mov} (movimento da requisição)` : null;
}

function concluidoOuCancelado(c: Contrato): boolean {
  return c.status === 'CONCLUIDO' || c.status === 'CANCELADO';
}

function Tabs<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border bg-muted/40 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            valor === o.valor
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AreaSoltar({
  titulo,
  subtitulo,
  variante,
  desabilitado,
  enviando,
  onArquivos,
}: {
  titulo: React.ReactNode;
  subtitulo?: string;
  variante: 'contrato' | 'doc';
  desabilitado?: boolean;
  enviando?: boolean;
  onArquivos: (arquivos: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !desabilitado && !enviando && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !desabilitado && !enviando) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!desabilitado) setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        if (desabilitado || enviando) return;
        onArquivos(Array.from(e.dataTransfer.files ?? []));
      }}
      className={cn(
        'rounded-xl border-[1.5px] border-dashed p-3.5 text-center text-sm transition-colors',
        variante === 'contrato'
          ? 'border-blue-500/50 bg-blue-500/5 text-blue-700 dark:text-blue-300'
          : 'border-violet-500/50 bg-violet-500/5 text-violet-700 dark:text-violet-300',
        arrastando && 'bg-primary/10',
        desabilitado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-primary/5'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple={variante === 'doc'}
        className="hidden"
        onChange={(e) => {
          onArquivos(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-center gap-2">
        {enviando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : variante === 'contrato' ? (
          <Upload className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span>{titulo}</span>
      </div>
      {subtitulo && <p className="mt-1 text-xs opacity-80">{subtitulo}</p>}
    </div>
  );
}

type EtapaLinha = { titulo: string; detalhe: string; estado: 'ok' | 'agora' | 'nao' };

function etapasContrato(c: Contrato): EtapaLinha[] {
  const concluido = c.status === 'CONCLUIDO';
  const situacaoArea =
    c.status === 'EM_ASSINATURA'
      ? 'Em assinatura no WaySign'
      : c.tem_contrato_assinado
        ? 'Contrato assinado anexado'
        : 'Aguardando contrato assinado';
  return [
    {
      titulo: 'Requisição marcada como contrato',
      detalhe: c.idmov_requisicao ? `Req. ${c.idmov_requisicao}` : 'Requisição de origem',
      estado: 'ok',
    },
    {
      titulo: 'Compras: QCP',
      detalhe: c.idmov_qcp ? `QCP ${c.idmov_qcp}` : 'Quadro comparativo',
      estado: 'ok',
    },
    {
      titulo: 'Hierarquia aprovou (PaperSign)',
      detalhe: 'Aprovação concluída',
      estado: 'ok',
    },
    {
      // data_aprovacao = momento em que o "Criar Contrato" gerou o contrato no TOTVS e ele entrou na fila.
      titulo: 'Contrato criado no TOTVS',
      detalhe: `Contrato ${numeroContrato(c)}${c.data_aprovacao ? ` · ${safeDateLabel(c.data_aprovacao)}` : ''}`,
      estado: 'ok',
    },
    {
      titulo: `Contratos · ${labelArea(c.area)}`,
      detalhe: concluido ? 'Contrato assinado anexado' : situacaoArea,
      estado: concluido ? 'ok' : 'agora',
    },
    {
      titulo: 'Concluído',
      detalhe: concluido
        ? `${safeDateLabel(c.data_conclusao ?? undefined)}${c.usuario_conclusao ? ` · ${c.usuario_conclusao}` : ''}`
        : 'Contrato assinado anexado',
      estado: concluido ? 'ok' : 'nao',
    },
  ];
}

export default function ContratosPage() {
  const [area, setArea] = useState<AreaContrato | ''>('');
  const [situacao, setSituacao] = useState<SituacaoFiltro>('pendentes');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [page, setPage] = useState(1);

  const [itens, setItens] = useState<Contrato[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [admin, setAdmin] = useState(false);
  const [tabelasExistem, setTabelasExistem] = useState(true);
  const [indicadores, setIndicadores] = useState<ContratoIndicadores>(INDICADORES_VAZIOS);
  const [carregando, setCarregando] = useState(true);

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<Contrato | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [enviandoTipo, setEnviandoTipo] = useState<TipoAnexoContrato | null>(null);
  const [vigenciaInicio, setVigenciaInicio] = useState('');
  const [vigenciaFim, setVigenciaFim] = useState('');
  const [confirmarConclusao, setConfirmarConclusao] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [resgatando, setResgatando] = useState(false);

  const [aprovacaoAberta, setAprovacaoAberta] = useState(false);
  const [aprovacaoTitulo, setAprovacaoTitulo] = useState('');
  const [aprovacoes, setAprovacoes] = useState<ContratoAprovacao[]>([]);
  const [carregandoAprovacao, setCarregandoAprovacao] = useState(false);

  const [contratoDialogo, setContratoDialogo] = useState<Contrato | null>(null);
  const [modoContrato, setModoContrato] = useState<'upload' | 'waysign'>('upload');
  const [arquivoWaySign, setArquivoWaySign] = useState<File | null>(null);
  const [anexoWaySign, setAnexoWaySign] = useState<string>('');
  const [destinatarios, setDestinatarios] = useState<DestinatarioWaySign[]>([{ nome: '', email: '' }]);
  const [mensagemWaySign, setMensagemWaySign] = useState('');
  const [enviandoWaySign, setEnviandoWaySign] = useState(false);
  const arquivoDocRef = useRef<HTMLInputElement>(null);
  const [contratoDocId, setContratoDocId] = useState<number | null>(null);

  const [pdfAberto, setPdfAberto] = useState(false);
  const [pdfTitulo, setPdfTitulo] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  const listaReqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const carregarIndicadores = useCallback(async () => {
    try {
      setIndicadores(await obterIndicadoresContratos());
    } catch {
      setIndicadores(INDICADORES_VAZIOS);
    }
  }, []);

  const carregarLista = useCallback(async () => {
    const reqId = ++listaReqRef.current;
    setCarregando(true);
    try {
      const data = await listarContratos({
        area,
        status: situacao,
        busca: buscaAplicada,
        page,
        dataDe,
        dataAte,
        valorMin,
        valorMax,
      });
      if (reqId !== listaReqRef.current) return;
      setItens(data.itens ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.page_size || 20);
      setAdmin(Boolean(data.admin));
      setTabelasExistem(data.tabelas_existem !== false);
      setSelecionadoId((atual) =>
        atual && (data.itens ?? []).some((i) => i.id === atual) ? atual : data.itens?.[0]?.id ?? null
      );
    } catch (err) {
      if (reqId !== listaReqRef.current) return;
      toast.error((err as Error).message);
      setItens([]);
      setTotal(0);
      setSelecionadoId(null);
    } finally {
      if (reqId === listaReqRef.current) setCarregando(false);
    }
  }, [area, situacao, buscaAplicada, page, dataDe, dataAte, valorMin, valorMax]);

  const carregarDetalhe = useCallback(async (id: number | null) => {
    if (!id) {
      setDetalhe(null);
      return;
    }
    setCarregandoDetalhe(true);
    try {
      const c = await obterContrato(id);
      setDetalhe(c);
      setVigenciaInicio(c.vigencia_inicio?.slice(0, 10) ?? '');
      setVigenciaFim(c.vigencia_fim?.slice(0, 10) ?? '');
    } catch (err) {
      toast.error((err as Error).message);
      setDetalhe(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    void carregarIndicadores();
  }, [carregarIndicadores]);

  useEffect(() => {
    void carregarDetalhe(selecionadoId);
  }, [selecionadoId, carregarDetalhe]);

  async function atualizarTudo() {
    await Promise.all([carregarLista(), carregarIndicadores(), carregarDetalhe(selecionadoId)]);
  }

  async function enviarArquivos(contratoId: number, tipo: TipoAnexoContrato, arquivos: File[]) {
    const pdfs = arquivos.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length === 0) {
      toast.error('Envie arquivos em PDF.');
      return;
    }
    if (tipo === 'CONTRATO_ASSINADO' && pdfs.length > 1) {
      toast.error('Envie um contrato assinado por vez.');
      return;
    }
    setEnviandoTipo(tipo);
    try {
      for (const arquivo of pdfs) {
        await anexarArquivoContrato(contratoId, tipo, arquivo.name, await toBase64(arquivo));
      }
      toast.success(
        tipo === 'CONTRATO_ASSINADO'
          ? 'Contrato assinado anexado.'
          : pdfs.length > 1
            ? `${pdfs.length} documentos anexados.`
            : 'Documento anexado.'
      );
      setSelecionadoId(contratoId);
      await atualizarTudo();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEnviandoTipo(null);
    }
  }

  async function abrirAprovacao(c: Contrato) {
    setAprovacaoTitulo(tituloContrato(c));
    setAprovacoes([]);
    setAprovacaoAberta(true);
    setCarregandoAprovacao(true);
    try {
      setAprovacoes(await obterAprovacaoContrato(c.id));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCarregandoAprovacao(false);
    }
  }

  function abrirDialogoContrato(c: Contrato) {
    setContratoDialogo(c);
    setModoContrato('upload');
    setArquivoWaySign(null);
    setAnexoWaySign('');
    setDestinatarios([{ nome: '', email: '' }]);
    setMensagemWaySign('');
  }

  function abrirDocAdicional(c: Contrato) {
    setContratoDocId(c.id);
    arquivoDocRef.current?.click();
  }

  async function enviarParaWaySign() {
    if (!contratoDialogo) return;
    const dest = destinatarios
      .map((d) => ({ nome: d.nome.trim(), email: d.email.trim() }))
      .filter((d) => d.email);
    if (dest.length === 0) {
      toast.error('Adicione ao menos um destinatário com e-mail.');
      return;
    }
    if (dest.some((d) => !d.nome)) {
      toast.error('Informe o nome de todos os destinatários.');
      return;
    }
    if (!anexoWaySign && !arquivoWaySign) {
      toast.error('Escolha o PDF do contrato.');
      return;
    }
    setEnviandoWaySign(true);
    try {
      const r = await enviarContratoWaySign(contratoDialogo.id, {
        id_anexo: anexoWaySign ? Number(anexoWaySign) : undefined,
        nome: arquivoWaySign?.name,
        anexo: !anexoWaySign && arquivoWaySign ? await toBase64(arquivoWaySign) : undefined,
        destinatarios: dest,
        mensagem: mensagemWaySign.trim() || undefined,
      });
      toast.success(r.message);
      setSelecionadoId(contratoDialogo.id);
      setContratoDialogo(null);
      await atualizarTudo();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setEnviandoWaySign(false);
    }
  }

  async function resgatarAssinado() {
    if (!detalhe) return;
    setResgatando(true);
    try {
      await resgatarContratoWaySign(detalhe.id);
      toast.success('Contrato assinado trazido do WaySign.');
      await atualizarTudo();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResgatando(false);
    }
  }

  async function concluir() {
    if (!detalhe) return;
    setConcluindo(true);
    try {
      const r = await concluirContrato(detalhe.id, {
        vigencia_inicio: vigenciaInicio || undefined,
        vigencia_fim: vigenciaFim || undefined,
      });
      toast.success(r.message);
      setConfirmarConclusao(false);
      await atualizarTudo();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConcluindo(false);
    }
  }

  async function trocarArea(novaArea: AreaContrato) {
    if (!detalhe || novaArea === detalhe.area) return;
    try {
      await alterarAreaContrato(detalhe.id, novaArea);
      toast.success(`Área alterada para ${labelArea(novaArea)}.`);
      await atualizarTudo();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function abrirAnexo(anexoId: number, nome: string) {
    try {
      const arquivo = await obterArquivoAnexoContrato(anexoId);
      setPdfTitulo(nome);
      setPdfBase64(arquivo);
      setPdfAberto(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function limparFiltros() {
    setDataDe('');
    setDataAte('');
    setValorMin('');
    setValorMax('');
    setPage(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const temFiltrosAvancados = Boolean(dataDe || dataAte || valorMin || valorMax);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 via-transparent to-transparent p-5 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/50 dark:from-blue-950/30 dark:via-slate-900/40 dark:to-transparent">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900/60">
            <FileSignature className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Contratos criados no TOTVS aguardando o contrato assinado. Anexe o contrato e os
              documentos adicionais para concluir.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void atualizarTudo()} disabled={carregando}>
          <RefreshCw className={cn('mr-2 h-4 w-4', carregando && 'animate-spin')} />
          Atualizar
        </Button>
      </header>

      {!tabelasExistem && admin && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          As tabelas do módulo Contratos ainda não foram criadas no banco. Rode o script
          <code className="mx-1 font-mono text-xs">docs/fix/contratos-ddl.sql</code>
          para a fila começar a receber os contratos criados no TOTVS.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.chave} className={cn('rounded-xl border p-3.5', k.cor)}>
            <p className="text-xs font-medium opacity-90">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{indicadores[k.chave]}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-3">
          <Tabs
            opcoes={[{ valor: '' as AreaContrato | '', label: 'Todos' }, ...AREAS_CONTRATO.map((a) => ({ valor: a.valor as AreaContrato | '', label: a.label }))]}
            valor={area}
            onChange={(v) => {
              setArea(v);
              setPage(1);
            }}
          />
          <Tabs
            opcoes={[
              { valor: 'pendentes' as SituacaoFiltro, label: 'Pendentes' },
              { valor: 'concluidos' as SituacaoFiltro, label: 'Concluídos' },
            ]}
            valor={situacao}
            onChange={(v) => {
              setSituacao(v);
              setPage(1);
            }}
          />
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, fornecedor ou requisição..."
              className="pl-9"
            />
          </div>
          <Button
            variant={mostrarFiltros || temFiltrosAvancados ? 'secondary' : 'outline'}
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          {mostrarFiltros && (
            <div className="grid w-full grid-cols-2 gap-3 border-t pt-3 md:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Aprovado de</Label>
                <Input type="date" value={dataDe} onChange={(e) => { setDataDe(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aprovado até</Label>
                <Input type="date" value={dataAte} onChange={(e) => { setDataAte(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor mínimo (R$)</Label>
                <Input inputMode="decimal" value={valorMin} onChange={(e) => { setValorMin(e.target.value.replace(',', '.')); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor máximo (R$)</Label>
                <Input inputMode="decimal" value={valorMax} onChange={(e) => { setValorMax(e.target.value.replace(',', '.')); setPage(1); }} />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" className="w-full" onClick={limparFiltros} disabled={!temFiltrosAvancados}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-2.5">
          {carregando && itens.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          ) : itens.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <FileSignature className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">Nenhum contrato encontrado</p>
                <p className="text-sm text-muted-foreground">
                  {situacao === 'pendentes'
                    ? 'Os contratos criados no TOTVS aparecem aqui.'
                    : 'Nenhum contrato concluído com esses filtros.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            itens.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelecionadoId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelecionadoId(c.id);
                }}
                className={cn(
                  'grid cursor-pointer grid-cols-[38px_1fr] gap-3 rounded-xl border bg-card p-3.5 text-left transition-all sm:grid-cols-[38px_1fr_auto]',
                  'hover:border-primary/40 hover:shadow-sm',
                  selecionadoId === c.id ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border/60'
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileSignature className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{tituloContrato(c)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase', corUnidadePendencia(c.unidade))}>
                      {c.unidade}
                    </span>
                    <span className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', corArea(c.area))}>
                      {labelArea(c.area)}
                    </span>
                    {(c.idmov_requisicao || c.idmov_qcp) && (
                      <span>
                        {c.idmov_requisicao ? `Req. ${c.idmov_requisicao}` : 'Req. —'}
                        {' → '}
                        {c.idmov_qcp ? `QCP ${c.idmov_qcp}` : 'QCP —'}
                      </span>
                    )}
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase', corStatus(c.status))}>
                      {labelStatus(c.status)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold tabular-nums">
                    {c.valor != null ? toMoney(c.valor) : 'Valor não informado'}
                    <span className="font-normal text-muted-foreground"> · {labelVigencia(c)}</span>
                  </p>
                  {c.anexos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.anexos.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void abrirAnexo(a.id, a.nome_arquivo);
                          }}
                          className="inline-flex max-w-[220px] items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11.5px] hover:bg-muted"
                          title={a.nome_arquivo}
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.nome_arquivo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 flex flex-row flex-wrap gap-1.5 sm:col-span-1 sm:flex-col">
                  <Button
                    size="sm"
                    variant="outline"
                    className={BTN_APROVACAO}
                    onClick={(e) => {
                      e.stopPropagation();
                      void abrirAprovacao(c);
                    }}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Ver aprovação
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={BTN_CONTRATO}
                    disabled={concluidoOuCancelado(c)}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirDialogoContrato(c);
                    }}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Contrato assinado
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={BTN_DOC}
                    disabled={concluidoOuCancelado(c)}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirDocAdicional(c);
                    }}
                  >
                    <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                    Doc adicional
                  </Button>
                </div>
              </div>
            ))
          )}

          {total > pageSize && (
            <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
              <span>
                Página {page} de {totalPaginas} · {total} contrato{total !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || carregando} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPaginas || carregando} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="self-start rounded-xl border bg-card p-4 lg:sticky lg:top-3">
          {carregandoDetalhe && !detalhe ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !detalhe ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecione um contrato para ver a linha do tempo.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold">
                  Contrato {numeroContrato(detalhe)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {[detalhe.fornecedor, detalhe.unidade, labelArea(detalhe.area)].filter(Boolean).join(' · ')}
                </p>
                {movimentoRequisicao(detalhe) && (
                  <p className="text-xs text-muted-foreground">{movimentoRequisicao(detalhe)}</p>
                )}
              </div>

              {admin && !concluidoOuCancelado(detalhe) && (
                <div className="flex items-center gap-2">
                  <Label className="shrink-0 text-xs text-muted-foreground">Área</Label>
                  <Select value={detalhe.area} onValueChange={(v) => void trocarArea(v as AreaContrato)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS_CONTRATO.map((a) => (
                        <SelectItem key={a.valor} value={a.valor}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <ol>
                {etapasContrato(detalhe).map((etapa, idx, arr) => (
                  <li key={etapa.titulo} className="relative grid grid-cols-[22px_1fr] gap-2.5 pb-3.5">
                    {idx < arr.length - 1 && (
                      <span className="absolute bottom-0 left-[10px] top-[22px] w-0.5 bg-border" />
                    )}
                    <span
                      className={cn(
                        'z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold',
                        etapa.estado === 'ok' && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
                        etapa.estado === 'agora' && 'bg-blue-600/20 text-blue-700 ring-[3px] ring-blue-500/20 dark:text-blue-300',
                        etapa.estado === 'nao' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {etapa.estado === 'ok' ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-semibold leading-tight">{etapa.titulo}</p>
                      <p className="text-xs text-muted-foreground">{etapa.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {detalhe.anexos.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Anexos</p>
                  {detalhe.anexos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void abrirAnexo(a.id, a.nome_arquivo)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                      title={a.nome_arquivo}
                    >
                      {a.tipo === 'CONTRATO_ASSINADO' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{a.nome_arquivo}</span>
                      {a.document_key_waysign && a.tipo !== 'CONTRATO_ASSINADO' && (
                        <span className="shrink-0 text-[10px] text-blue-600 dark:text-blue-300">WaySign</span>
                      )}
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {safeDateTimeLabel(a.data ?? undefined)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!concluidoOuCancelado(detalhe) && (
                <>
                  <AreaSoltar
                    variante="contrato"
                    titulo={<>Arraste o <b>contrato assinado</b> (PDF) ou clique para escolher</>}
                    subtitulo="ou envie para assinatura pelo WaySign"
                    enviando={enviandoTipo === 'CONTRATO_ASSINADO'}
                    onArquivos={(arquivos) => void enviarArquivos(detalhe.id, 'CONTRATO_ASSINADO', arquivos)}
                  />
                  <div className="-mt-1 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {
                      abrirDialogoContrato(detalhe);
                      setModoContrato('waysign');
                    }}>
                      <PenLine className="mr-1 h-3.5 w-3.5" />
                      Enviar pelo WaySign
                    </Button>
                    {detalhe.status === 'EM_ASSINATURA' && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={resgatando} onClick={() => void resgatarAssinado()}>
                        {resgatando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                        Buscar assinado no WaySign
                      </Button>
                    )}
                  </div>
                  <AreaSoltar
                    variante="doc"
                    titulo={<><b>Documentos adicionais</b> (aditivos, certidões, garantias)</>}
                    enviando={enviandoTipo === 'DOC_ADICIONAL'}
                    onArquivos={(arquivos) => void enviarArquivos(detalhe.id, 'DOC_ADICIONAL', arquivos)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Vigência início</Label>
                      <Input type="date" className="h-8" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vigência fim</Label>
                      <Input type="date" className="h-8" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={!detalhe.tem_contrato_assinado || concluindo}
                    onClick={() => setConfirmarConclusao(true)}
                  >
                    {concluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Concluir contrato
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    O botão Concluir só habilita depois que o contrato assinado é anexado.
                  </p>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      <input
        ref={arquivoDocRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const arquivos = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (contratoDocId) void enviarArquivos(contratoDocId, 'DOC_ADICIONAL', arquivos);
        }}
      />

      <Dialog open={aprovacaoAberta} onOpenChange={setAprovacaoAberta}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovação na hierarquia</DialogTitle>
            <DialogDescription>{aprovacaoTitulo}</DialogDescription>
          </DialogHeader>
          {carregandoAprovacao ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : aprovacoes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma aprovação registrada.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {aprovacoes.map((a, i) => {
                const s = (a.situacao || 'P').toUpperCase();
                return (
                  <li key={`${a.usuario}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.nome || a.usuario}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.data_aprovacao ? safeDateTimeLabel(a.data_aprovacao) : 'Sem data'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        s === 'A' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                        s === 'R' && 'bg-red-500/15 text-red-700 dark:text-red-300',
                        s !== 'A' && s !== 'R' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      )}
                    >
                      {s === 'A' ? 'Aprovado' : s === 'R' ? 'Reprovado' : 'Pendente'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!contratoDialogo} onOpenChange={(open) => !open && setContratoDialogo(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contrato assinado</DialogTitle>
            <DialogDescription>{contratoDialogo ? tituloContrato(contratoDialogo) : ''}</DialogDescription>
          </DialogHeader>

          <Tabs
            opcoes={[
              { valor: 'upload' as const, label: 'Anexar PDF assinado' },
              { valor: 'waysign' as const, label: 'Enviar pelo WaySign' },
            ]}
            valor={modoContrato}
            onChange={setModoContrato}
          />

          {modoContrato === 'upload' ? (
            <div className="space-y-2">
              <AreaSoltar
                variante="contrato"
                titulo={<>Arraste o <b>contrato assinado</b> (PDF) ou clique para escolher</>}
                enviando={enviandoTipo === 'CONTRATO_ASSINADO'}
                onArquivos={async (arquivos) => {
                  if (!contratoDialogo) return;
                  const id = contratoDialogo.id;
                  setContratoDialogo(null);
                  await enviarArquivos(id, 'CONTRATO_ASSINADO', arquivos);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Documento</Label>
                {(contratoDialogo?.anexos.length ?? 0) > 0 && (
                  <Select value={anexoWaySign || '__novo__'} onValueChange={(v) => setAnexoWaySign(v === '__novo__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__novo__">Enviar um PDF novo</SelectItem>
                      {contratoDialogo?.anexos.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.nome_arquivo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!anexoWaySign && (
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setArquivoWaySign(e.target.files?.[0] ?? null)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Destinatários</Label>
                {destinatarios.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Nome"
                      value={d.nome}
                      onChange={(e) =>
                        setDestinatarios((prev) => prev.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                      }
                    />
                    <Input
                      placeholder="E-mail"
                      type="email"
                      value={d.email}
                      onChange={(e) =>
                        setDestinatarios((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={destinatarios.length === 1}
                      onClick={() => setDestinatarios((prev) => prev.filter((_, j) => j !== i))}
                      aria-label="Remover destinatário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDestinatarios((prev) => [...prev, { nome: '', email: '' }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar destinatário
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mensagem (opcional)</Label>
                <Textarea rows={3} value={mensagemWaySign} onChange={(e) => setMensagemWaySign(e.target.value)} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setContratoDialogo(null)} disabled={enviandoWaySign}>
                  Cancelar
                </Button>
                <Button onClick={() => void enviarParaWaySign()} disabled={enviandoWaySign}>
                  {enviandoWaySign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar para assinatura
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarConclusao} onOpenChange={setConfirmarConclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O contrato será arquivado como concluído e não aceitará novos anexos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={concluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={concluindo}
              onClick={(e) => {
                e.preventDefault();
                void concluir();
              }}
            >
              {concluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfViewerDialog
        open={pdfAberto}
        onOpenChange={(open) => {
          setPdfAberto(open);
          if (!open) setPdfBase64(null);
        }}
        title={pdfTitulo}
        pdfBase64={pdfBase64}
        canSign={false}
      />
    </div>
  );
}
