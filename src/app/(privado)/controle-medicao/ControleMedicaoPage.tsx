'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  Download,
  Eye,
  FileStack,
  FileText,
  Layers,
  Loader2,
  Paperclip,
  Ruler,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import PdfViewerDialog from '@/components/PdfViewerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { baixarAnexo, getAll as getAllAnexos } from '@/services/anexoService';
import {
  ControleMedicaoAprovacao,
  ControleMedicaoAprovador,
  ControleMedicaoCentroCusto,
  ControleMedicaoItem,
  ControleMedicaoPainel,
  listarAprovacoesControleMedicao,
  listarAprovadoresControleMedicao,
  listarCentrosCustoControleMedicao,
  listarControleMedicao,
  obterPainelControleMedicao,
  StatusControleFiltro,
  UNIDADES_CONTROLE_MEDICAO,
} from '@/services/controleMedicaoService';
import type { Anexo } from '@/types/Anexo';
import { rotinaTipoMovimento, safeDateLabel, safeDateLabelAprovacao } from '@/utils/functions';
import { mensagemDownloadSucesso } from '@/utils/downloadFile';
import { cn } from '@/lib/utils';

function competenciaAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function labelSituacao(situacao: string): string {
  switch (situacao?.trim().toUpperCase()) {
    case 'A':
      return 'Aprovado';
    case 'R':
      return 'Reprovado';
    case 'P':
    default:
      return 'Pendente';
  }
}

function badgeStatusControle(status: string) {
  const s = status?.trim();
  if (s === 'Aprovado') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">{s}</Badge>;
  }
  if (s === 'Atrasado') {
    return <Badge variant="destructive">{s}</Badge>;
  }
  return <Badge variant="secondary">{s || 'Pendente'}</Badge>;
}

type StatCardProps = {
  title: string;
  count: number;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  accent: string;
};

function StatCard({ title, count, description, icon, active, onClick, accent }: StatCardProps) {
  return (
    <Card
      className={cn(
        'min-w-[min(85vw,280px)] shrink-0 snap-start sm:min-w-0',
        'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn('rounded-lg p-2', accent)}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{count}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function ControleMedicaoPage() {
  const [ehCsc, setEhCsc] = useState(false);
  const [unidadeUsuario, setUnidadeUsuario] = useState('');
  const [unidade, setUnidade] = useState('');
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [painel, setPainel] = useState<ControleMedicaoPainel | null>(null);
  const [itens, setItens] = useState<ControleMedicaoItem[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<StatusControleFiltro | ''>('');
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [buscaAprovador, setBuscaAprovador] = useState('');
  const [aprovadores, setAprovadores] = useState<ControleMedicaoAprovador[]>([]);
  const [carregandoAprovadores, setCarregandoAprovadores] = useState(false);
  const [aprovadorSelecionado, setAprovadorSelecionado] = useState<ControleMedicaoAprovador | null>(null);
  const [comboAberto, setComboAberto] = useState(false);

  const [modalAprovacoesAberto, setModalAprovacoesAberto] = useState(false);
  const [aprovacoes, setAprovacoes] = useState<ControleMedicaoAprovacao[]>([]);
  const [carregandoAprovacoes, setCarregandoAprovacoes] = useState(false);
  const [idmovSelecionado, setIdmovSelecionado] = useState<number | null>(null);

  const [modalAnexosAberto, setModalAnexosAberto] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  const [filtroAnexos, setFiltroAnexos] = useState('');

  const [modalCentrosAberto, setModalCentrosAberto] = useState(false);
  const [centrosCusto, setCentrosCusto] = useState<ControleMedicaoCentroCusto[]>([]);
  const [carregandoCentros, setCarregandoCentros] = useState(false);
  const [pdfAberto, setPdfAberto] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfTitulo, setPdfTitulo] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('userData');
    if (!stored) return;
    try {
      const user = JSON.parse(stored);
      const un = String(user.unidade ?? '').trim();
      setUnidadeUsuario(un);
      setEhCsc(un.toUpperCase() === 'WAY CSC');
      setUnidade(un || UNIDADES_CONTROLE_MEDICAO[0]);
    } catch {
      setUnidade(UNIDADES_CONTROLE_MEDICAO[0]);
    }
  }, []);

  useEffect(() => {
    const termo = buscaAprovador.trim();
    if (termo.length < 2) {
      setAprovadores([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setCarregandoAprovadores(true);
      try {
        const lista = await listarAprovadoresControleMedicao(termo, unidade);
        setAprovadores(lista);
      } catch (err) {
        setAprovadores([]);
        toast.error(err instanceof Error ? err.message : 'Falha ao buscar aprovadores.');
      } finally {
        setCarregandoAprovadores(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [buscaAprovador, unidade]);

  const unidadesDisponiveis = useMemo(() => {
    if (ehCsc) return [...UNIDADES_CONTROLE_MEDICAO];
    if (unidadeUsuario) return [unidadeUsuario];
    return [...UNIDADES_CONTROLE_MEDICAO];
  }, [ehCsc, unidadeUsuario]);

  async function buscar(statusOverride?: StatusControleFiltro | '') {
    if (!unidade?.trim()) {
      toast.error('Selecione a unidade.');
      return;
    }
    if (!competencia?.trim()) {
      toast.error('Informe a competência.');
      return;
    }

    const filtro = statusOverride ?? statusFiltro;
    const usuario = aprovadorSelecionado?.codusuario;
    setCarregando(true);
    setBuscou(true);
    try {
      const [dadosPainel, dadosLista] = await Promise.all([
        obterPainelControleMedicao(competencia, unidade, usuario),
        listarControleMedicao(
          competencia,
          unidade,
          filtro || undefined,
          usuario
        ),
      ]);
      setPainel(dadosPainel);
      setItens(dadosLista.itens);
    } catch (err) {
      toast.error((err as Error).message);
      setPainel(null);
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }

  function aplicarFiltroCard(status: StatusControleFiltro | '') {
    setStatusFiltro(status);
    if (buscou) {
      buscar(status);
    }
  }

  async function abrirAprovacoes(item: ControleMedicaoItem) {
    setIdmovSelecionado(item.idmov);
    setModalAprovacoesAberto(true);
    setCarregandoAprovacoes(true);
    setAprovacoes([]);
    try {
      const dados = await listarAprovacoesControleMedicao(item.idmov, unidade);
      setAprovacoes(dados);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCarregandoAprovacoes(false);
    }
  }

  async function abrirCentrosCusto(item: ControleMedicaoItem) {
    setIdmovSelecionado(item.idmov);
    setModalCentrosAberto(true);
    setCarregandoCentros(true);
    setCentrosCusto([]);
    try {
      const dados = await listarCentrosCustoControleMedicao(item.idmov, unidade);
      setCentrosCusto(dados);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCarregandoCentros(false);
    }
  }

  async function abrirAnexos(item: ControleMedicaoItem) {
    setIdmovSelecionado(item.idmov);
    setFiltroAnexos('');
    setModalAnexosAberto(true);
    setCarregandoAnexos(true);
    setAnexos([]);
    try {
      const dados = await getAllAnexos(item.idmov);
      setAnexos(dados);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCarregandoAnexos(false);
    }
  }

  function visualizarAnexo(anexo: Anexo) {
    if (!anexo.anexo) return;
    setPdfBase64(anexo.anexo);
    setPdfTitulo(anexo.nome || 'Anexo');
    setPdfAberto(true);
  }

  async function downloadAnexo(anexo: Anexo) {
    try {
      const result = await baixarAnexo(anexo);
      toast.success(mensagemDownloadSucesso(result, anexo.nome || 'anexo'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao baixar anexo.');
    }
  }

  const colunas = useMemo<ColumnDef<ControleMedicaoItem>[]>(
    () => [
      { accessorKey: 'idmov', header: 'ID' },
      { accessorKey: 'numero_movimento', header: 'RM' },
      {
        accessorKey: 'tipo_movimento',
        header: 'Tipo de movimento',
        cell: ({ row }) => {
          const codigo = row.original.tipo_movimento?.trim() ?? '';
          const nome = rotinaTipoMovimento(codigo);
          return nome && nome !== 'Desconhecida' ? `${codigo} — ${nome}` : codigo;
        },
      },
      {
        accessorKey: 'data_emissao',
        header: 'Emissão',
        accessorFn: (row) => safeDateLabel(row.data_emissao ?? undefined),
      },
      {
        accessorKey: 'status_controle',
        header: 'Status controle',
        cell: ({ row }) => badgeStatusControle(row.original.status_controle),
      },
      { accessorKey: 'status_movimento', header: 'Status RM' },
      {
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => abrirAprovacoes(row.original)}
            >
              <Users className="w-4 h-4 mr-1" />
              Aprovações
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => abrirCentrosCusto(row.original)}
            >
              <Layers className="w-4 h-4 mr-1" />
              Centros ({row.original.quantidade_centros_custo ?? 0})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => abrirAnexos(row.original)}
            >
              <Paperclip className="w-4 h-4 mr-1" />
              Anexos ({row.original.quantidade_anexos})
            </Button>
          </div>
        ),
      },
    ],
    [unidade]
  );

  const colunasAprovacoes = useMemo<ColumnDef<ControleMedicaoAprovacao>[]>(
    () => [
      { accessorKey: 'nivel', header: 'Nível' },
      { accessorKey: 'cargo', header: 'Cargo' },
      { accessorKey: 'nome', header: 'Usuário' },
      {
        accessorKey: 'situacao',
        header: 'Situação',
        accessorFn: (row) => labelSituacao(row.situacao),
      },
      {
        accessorKey: 'data_aprovacao',
        header: 'Data',
        accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao),
      },
    ],
    []
  );

  const anexosFiltrados = useMemo(() => {
    const q = filtroAnexos.trim().toLowerCase();
    if (!q) return anexos;
    return anexos.filter((a) =>
      String(a.id).includes(q) || String(a.nome ?? '').toLowerCase().includes(q)
    );
  }, [anexos, filtroAnexos]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Controle de Medição</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Painel de aprovações de medições (tipo 1.1.31) por competência — cadastro no RM.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                value={unidade}
                onValueChange={(value) => {
                  setUnidade(value);
                  setAprovadorSelecionado(null);
                  setBuscaAprovador('');
                  setAprovadores([]);
                }}
                disabled={!ehCsc && Boolean(unidadeUsuario)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidadesDisponiveis.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Competência</Label>
              <Input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full h-10" onClick={() => buscar()} disabled={carregando}>
                {carregando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Aprovador (alçadas) — opcional</Label>
            <Popover open={comboAberto} onOpenChange={setComboAberto}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between font-normal"
                >
                  <span className="truncate text-left">
                    {aprovadorSelecionado
                      ? `${aprovadorSelecionado.nome} (${aprovadorSelecionado.codusuario})`
                      : 'Todos os aprovadores — ou busque pelo nome/login…'}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="pointer-events-auto z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Ex.: nome do aprovador"
                    onValueChange={setBuscaAprovador}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {carregandoAprovadores
                        ? 'Buscando…'
                        : buscaAprovador.trim().length < 2
                          ? 'Digite pelo menos 2 caracteres.'
                          : 'Nenhum aprovador encontrado nas alçadas.'}
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="todos"
                        onSelect={() => {
                          setAprovadorSelecionado(null);
                          setComboAberto(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${!aprovadorSelecionado ? 'opacity-100' : 'opacity-0'}`}
                        />
                        Todos os aprovadores
                      </CommandItem>
                      {aprovadores.map((u) => (
                        <CommandItem
                          key={u.codusuario}
                          value={`${u.codusuario} ${u.nome}`}
                          onSelect={() => {
                            setAprovadorSelecionado(u);
                            setComboAberto(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              aprovadorSelecionado?.codusuario === u.codusuario
                                ? 'opacity-100'
                                : 'opacity-0'
                            }`}
                          />
                          <span>{u.nome} ({u.codusuario})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {buscou && painel && (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 sm:snap-none lg:grid-cols-4">
          <StatCard
            title="Aprovado"
            count={painel.aprovado}
            description="Fluxo concluído no RM"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            accent="bg-emerald-500/10"
            active={statusFiltro === 'Aprovado'}
            onClick={() => aplicarFiltroCard('Aprovado')}
          />
          <StatCard
            title="Pendente"
            count={painel.pendente}
            description="Aguardando aprovação (até dia 25)"
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            accent="bg-amber-500/10"
            active={statusFiltro === 'Pendente'}
            onClick={() => aplicarFiltroCard('Pendente')}
          />
          <StatCard
            title="Atrasado"
            count={painel.atrasado}
            description="Pendente após o dia 25"
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
            accent="bg-rose-500/10"
            active={statusFiltro === 'Atrasado'}
            onClick={() => aplicarFiltroCard('Atrasado')}
          />
          <StatCard
            title="Total"
            count={painel.total}
            description="Todas as medições da competência"
            icon={<Ruler className="w-5 h-5 text-sky-600" />}
            accent="bg-sky-500/10"
            active={statusFiltro === ''}
            onClick={() => aplicarFiltroCard('')}
          />
        </div>
      )}

      {buscou && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="w-5 h-5" />
              Medições
              {statusFiltro ? ` — ${statusFiltro}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={colunas}
              data={itens}
              loading={carregando}
              pageSize={10}
              globalFilterAccessorKey={[
                'idmov',
                'numero_movimento',
                'tipo_movimento',
                'status_movimento',
                'status_controle',
              ]}
              searchPlaceholder="Filtrar nesta lista…"
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={modalAprovacoesAberto} onOpenChange={setModalAprovacoesAberto}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-6 py-4 text-center sm:text-center">
            <DialogTitle className="w-full text-center text-lg font-semibold">
              Aprovações — ID {idmovSelecionado}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <DataTable
              columns={colunasAprovacoes}
              data={aprovacoes}
              loading={carregandoAprovacoes}
              hidePagination
              searchPlaceholder="Filtrar aprovações…"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalCentrosAberto} onOpenChange={setModalCentrosAberto}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-center sm:text-center">
            <DialogTitle className="text-lg font-semibold">Centros de custo</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Movimento ID {idmovSelecionado}
              {!carregandoCentros && centrosCusto.length > 0
                ? ` · ${centrosCusto.length} centro${centrosCusto.length === 1 ? '' : 's'}`
                : ''}
            </p>
          </DialogHeader>
          <div className="px-6 py-4">
            {carregandoCentros ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando centros de custo…
              </div>
            ) : centrosCusto.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum centro de custo encontrado para este movimento.
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {centrosCusto.map((centro) => (
                  <li
                    key={centro.centro_custo}
                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{centro.centro_custo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {centro.centro_custo_nome || 'Sem descrição'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalAnexosAberto} onOpenChange={setModalAnexosAberto}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-center sm:text-center">
            <DialogTitle className="text-lg font-semibold">Anexos</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Movimento ID {idmovSelecionado}
              {!carregandoAnexos && anexos.length > 0 ? ` · ${anexos.length} arquivo${anexos.length === 1 ? '' : 's'}` : ''}
            </p>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Input
              placeholder="Filtrar anexos…"
              value={filtroAnexos}
              onChange={(e) => setFiltroAnexos(e.target.value)}
              disabled={carregandoAnexos}
            />
            {carregandoAnexos ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando anexos…
              </div>
            ) : anexosFiltrados.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {anexos.length === 0 ? 'Nenhum anexo encontrado.' : 'Nenhum anexo corresponde ao filtro.'}
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {anexosFiltrados.map((anexo) => (
                  <li
                    key={anexo.id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{anexo.nome || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">ID {anexo.id}</p>
                    </div>
                    {anexo.anexo ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => visualizarAnexo(anexo)}
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          Visualizar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => downloadAnexo(anexo)}
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          Baixar
                        </Button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Indisponível</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PdfViewerDialog
        open={pdfAberto}
        onOpenChange={setPdfAberto}
        title={pdfTitulo}
        pdfBase64={pdfBase64}
      />
    </div>
  );
}
