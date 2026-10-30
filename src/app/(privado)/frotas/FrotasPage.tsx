'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Ban, Car, CarFront, CircleCheck, FlaskConical, History, Layers, Loader2, Pencil, RefreshCw, Save, Search } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  alterarPlaca,
  cadastrarPlacas,
  CadastroPlacaResultado,
  CadastroPlacasPayload,
  CadastroPlacasResposta,
  desativarPlaca,
  FrotaHistorico,
  FrotaModelo,
  FrotaPlaca,
  listarHistoricoFrota,
  listarModelosFrota,
  listarPlacas,
  normalizarPlaca,
  placaValida,
  unidadeDaSessao,
  UNIDADES_FROTAS,
} from '@/services/frotasService';

import { BotaoPdf, CartaoIndicador, COR_PDF, RelatorioFrotaPdf, textoFiltros } from './comum';

const NOVO = '__novo__';
// Limites das colunas do RM: OFMODELO.MODELO varchar(30), OFSUBMODELO.DESCRICAO varchar(25).
const MAX_MODELO = 30;
const MAX_SUBMODELO = 25;

type LinhaPlaca = { placa: string; frota?: string; valida: boolean };

function anoOuUndefined(v: string): number | undefined {
  const n = Number(v);
  return v.trim() && Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : undefined;
}

const STATUS_LABEL: Record<CadastroPlacaResultado['status'], string> = {
  criado: 'Cadastrada',
  ja_existe: 'Já existia',
  erro: 'Erro',
};

const STATUS_LABEL_SIMULACAO: Record<CadastroPlacaResultado['status'], string> = {
  criado: 'Será cadastrada',
  ja_existe: 'Já existe (será ignorada)',
  erro: 'Erro',
};

const ACAO_LABEL: Record<string, string> = {
  CADASTRAR: 'Cadastro',
  EDITAR: 'Alteração',
  DESATIVAR: 'Desativação',
  DOCUMENTO: 'Documento',
  DOC_EXCLUIDO: 'Documento excluído',
  DOC_VISUALIZADO: 'Documento visualizado',
  DOC_BAIXADO: 'Documento baixado',
  MANUTENCAO: 'Manutenção',
  MANUT_EDITADA: 'Manutenção alterada',
  MANUT_EXCLUIDA: 'Manutenção excluída',
  MULTA: 'Multa',
  MULTA_EDITADA: 'Multa alterada',
  MULTA_EXCLUIDA: 'Multa excluída',
  SINISTRO: 'Sinistro',
  SINISTRO_EDITADO: 'Sinistro alterado',
  SINISTRO_EXCLUIDO: 'Sinistro excluído',
  VIAGEM: 'Viagem',
  VIAGEM_EDITADA: 'Viagem alterada',
  VIAGEM_EXCLUIDA: 'Viagem excluída',
  RESPONSAVEL: 'Entrega',
  DEVOLUCAO: 'Devolução',
  ANEXO_VISUALIZADO: 'Anexo visualizado',
  ANEXO_BAIXADO: 'Anexo baixado',
  CONDUTOR: 'Condutor',
  CONDUTOR_EDITADO: 'Condutor alterado',
  CONDUTOR_EXCLUIDO: 'Condutor excluído',
  CONDUTOR_CNH_VISTA: 'CNH visualizada',
  CONDUTOR_CNH_BAIXADA: 'CNH baixada',
  IMPORTACAO: 'Importação de planilha',
};
type EdicaoPlaca = {
  placa: string;
  frota: string;
  codmodelo: string;
  codsubmodelo: string;
  anoModelo: string;
  anoFabr: string;
  motivo: string;
};

export default function FrotasPage() {
  const [unidade, setUnidade] = useState('');
  const [podeTrocarUnidade, setPodeTrocarUnidade] = useState(false);

  const [modelos, setModelos] = useState<FrotaModelo[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [placasRm, setPlacasRm] = useState<FrotaPlaca[]>([]);
  const [carregandoPlacas, setCarregandoPlacas] = useState(false);
  const [busca, setBusca] = useState('');

  const [placaNova, setPlacaNova] = useState('');
  const [frotaNova, setFrotaNova] = useState('');
  const [codmodelo, setCodmodelo] = useState('');
  const [novaMarca, setNovaMarca] = useState('');
  const [novoModelo, setNovoModelo] = useState('');
  const [codsubmodelo, setCodsubmodelo] = useState('');
  const [novoSubmodelo, setNovoSubmodelo] = useState('');
  const [anoModelo, setAnoModelo] = useState('');
  const [anoFabr, setAnoFabr] = useState('');
  const [resultados, setResultados] = useState<CadastroPlacaResultado[]>([]);
  const [gravando, startGravar] = useTransition();
  const [simulacao, setSimulacao] = useState<{ chave: string; resp: CadastroPlacasResposta } | null>(null);
  const [simulando, startSimular] = useTransition();

  const [historico, setHistorico] = useState<FrotaHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState('');
  const [placaDesativar, setPlacaDesativar] = useState<FrotaPlaca | null>(null);
  const [motivoDesativar, setMotivoDesativar] = useState('');
  const [desativando, startDesativar] = useTransition();
  const [edicao, setEdicao] = useState<EdicaoPlaca | null>(null);
  const [salvandoEdicao, startSalvarEdicao] = useTransition();

  useEffect(() => {
    const propria = unidadeDaSessao();
    const naLista = (UNIDADES_FROTAS as readonly string[]).includes(propria);
    // Só a WAY CSC atende todas as unidades; as demais (inclusive Admin) veem só a própria.
    setPodeTrocarUnidade(propria === 'WAY CSC');
    setUnidade(naLista ? propria : '');
  }, []);

  const carregarModelos = useCallback(async (u: string) => {
    setCarregandoModelos(true);
    try {
      setModelos(await listarModelosFrota(u));
    } catch (e) {
      setModelos([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os modelos do RM.');
    } finally {
      setCarregandoModelos(false);
    }
  }, []);

  const carregarPlacas = useCallback(async (u: string, termo?: string) => {
    setCarregandoPlacas(true);
    try {
      setPlacasRm(await listarPlacas(u, termo));
    } catch (e) {
      setPlacasRm([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as placas do RM.');
    } finally {
      setCarregandoPlacas(false);
    }
  }, []);

  const carregarHistorico = useCallback(async (u: string, placa?: string) => {
    setCarregandoHistorico(true);
    try {
      setHistorico(await listarHistoricoFrota(u, placa));
    } catch (e) {
      setHistorico([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar o histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  useEffect(() => {
    if (!unidade) return;
    setCodmodelo('');
    setCodsubmodelo('');
    setResultados([]);
    setSimulacao(null);
    setFiltroHistorico('');
    void carregarModelos(unidade);
    void carregarPlacas(unidade);
    void carregarHistorico(unidade);
  }, [unidade, carregarModelos, carregarPlacas, carregarHistorico]);

  const modeloEdicao = modelos.find((m) => String(m.codmodelo) === edicao?.codmodelo);

  function handleSalvarEdicao() {
    if (!edicao) return;
    if (!edicao.codmodelo || !edicao.codsubmodelo) {
      toast.error('Selecione o modelo e o submodelo.');
      return;
    }
    if (edicao.anoModelo.trim() && anoOuUndefined(edicao.anoModelo) == null) {
      toast.error('Ano do modelo inválido.');
      return;
    }
    if (edicao.anoFabr.trim() && anoOuUndefined(edicao.anoFabr) == null) {
      toast.error('Ano de fabricação inválido.');
      return;
    }
    const atual = edicao;
    startSalvarEdicao(async () => {
      try {
        const resp = await alterarPlaca({
          unidade,
          placa: atual.placa,
          frota: atual.frota.trim().toUpperCase() || undefined,
          codmodelo: Number(atual.codmodelo),
          codsubmodelo: Number(atual.codsubmodelo),
          anomodelo: anoOuUndefined(atual.anoModelo),
          anofabr: anoOuUndefined(atual.anoFabr),
          motivo: atual.motivo.trim() || undefined,
        });
        toast.success(`Placa ${resp.placa} alterada: ${resp.alteracoes.join('; ')}`);
        setEdicao(null);
        await Promise.all([carregarPlacas(unidade, busca), carregarHistorico(unidade, filtroHistorico)]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao alterar a placa.');
      }
    });
  }

  function handleDesativar() {
    if (!placaDesativar) return;
    const motivo = motivoDesativar.trim();
    if (motivo.length < 3) {
      toast.error('Informe o motivo da desativação (mínimo 3 caracteres).');
      return;
    }
    const placa = placaDesativar.placa;
    startDesativar(async () => {
      try {
        await desativarPlaca(unidade, placa, motivo);
        toast.success(`Placa ${placa} desativada no RM (${unidade}).`);
        setPlacaDesativar(null);
        setMotivoDesativar('');
        await Promise.all([carregarPlacas(unidade, busca), carregarHistorico(unidade, filtroHistorico)]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao desativar a placa.');
      }
    });
  }

  const linhas = useMemo<LinhaPlaca[]>(() => {
    const placa = normalizarPlaca(placaNova);
    if (!placa) return [];
    return [{ placa, frota: frotaNova.trim().toUpperCase() || undefined, valida: placaValida(placa) }];
  }, [placaNova, frotaNova]);
  const invalidas = linhas.filter((l) => !l.valida);

  const modeloSelecionado = modelos.find((m) => String(m.codmodelo) === codmodelo);
  const criandoModelo = codmodelo === NOVO;
  const criandoSubmodelo = criandoModelo || codsubmodelo === NOVO;
  // Padrão do cadastro: "MARCA/MODELO" (ex.: FIAT/STRADA ENDURANCE).
  const nomeNovoModelo = [novaMarca.trim(), novoModelo.trim()].filter(Boolean).join('/').toUpperCase();

  function validar(): string | null {
    if (!unidade) return 'Selecione a unidade.';
    if (linhas.length === 0) return 'Informe a placa.';
    if (invalidas.length > 0) return `Placa inválida: ${invalidas[0].placa} (use ABC1234 ou ABC1D23).`;
    if (!codmodelo) return 'Selecione o modelo.';
    if (criandoModelo) {
      if (!novaMarca.trim() || !novoModelo.trim()) return 'Informe a marca e o modelo novos.';
      if (nomeNovoModelo.length > MAX_MODELO) return `O modelo pode ter no máximo ${MAX_MODELO} caracteres (MARCA/MODELO).`;
    }
    if (!criandoModelo && !codsubmodelo) return 'Selecione o submodelo.';
    if (criandoSubmodelo) {
      if (!novoSubmodelo.trim()) return 'Informe o submodelo novo.';
      if (novoSubmodelo.trim().length > MAX_SUBMODELO) return `O submodelo pode ter no máximo ${MAX_SUBMODELO} caracteres.`;
    }
    if (anoModelo.trim() && anoOuUndefined(anoModelo) == null) return 'Ano do modelo inválido.';
    if (anoFabr.trim() && anoOuUndefined(anoFabr) == null) return 'Ano de fabricação inválido.';
    return null;
  }

  function montarPayload(): CadastroPlacasPayload {
    const payload: CadastroPlacasPayload = {
      unidade,
      placas: linhas.map(({ placa, frota }) => ({ placa, frota })),
      anomodelo: anoOuUndefined(anoModelo),
      anofabr: anoOuUndefined(anoFabr),
    };
    if (criandoModelo) {
      payload.novo_modelo = { marca: novaMarca.trim().toUpperCase(), modelo: nomeNovoModelo };
    } else {
      payload.codmodelo = Number(codmodelo);
    }
    if (criandoSubmodelo) {
      payload.novo_submodelo = novoSubmodelo.trim().toUpperCase();
    } else {
      payload.codsubmodelo = Number(codsubmodelo);
    }
    return payload;
  }

  // O Gravar só libera para exatamente o que foi simulado; qualquer mudança no formulário pede nova simulação.
  const chaveAtual = JSON.stringify(montarPayload());
  const simulacaoValida = simulacao !== null && simulacao.chave === chaveAtual;
  const simuladasParaGravar = simulacaoValida
    ? simulacao.resp.resultados.filter((r) => r.status === 'criado').length
    : 0;

  function handleSimular() {
    const erro = validar();
    if (erro) {
      toast.error(erro);
      return;
    }
    const payload = montarPayload();
    const chave = JSON.stringify(payload);
    startSimular(async () => {
      try {
        const resp = await cadastrarPlacas({ ...payload, simular: true });
        setResultados([]);
        setSimulacao({ chave, resp });
        const criadas = resp.resultados.filter((r) => r.status === 'criado').length;
        if (criadas === 0) toast.warning('Simulação: nenhuma placa nova para gravar.');
        else toast.success(`Simulação OK: ${criadas} placa(s) seriam cadastradas. Nada foi gravado.`);
      } catch (e) {
        setSimulacao(null);
        toast.error(e instanceof Error ? e.message : 'Falha na simulação.');
      }
    });
  }

  function handleGravar() {
    const erro = validar();
    if (erro) {
      toast.error(erro);
      return;
    }
    if (!simulacaoValida) {
      toast.error('Simule antes de gravar (os dados mudaram desde a última simulação).');
      return;
    }
    const payload = montarPayload();

    startGravar(async () => {
      try {
        const resp = await cadastrarPlacas(payload);
        setSimulacao(null);
        setResultados(resp.resultados);
        const criadas = resp.resultados.filter((r) => r.status === 'criado').length;
        const erros = resp.resultados.filter((r) => r.status === 'erro').length;
        if (erros > 0) toast.error(`${erros} placa(s) com erro. Veja o resultado abaixo.`);
        else toast.success(`${criadas} placa(s) cadastrada(s) no RM (${resp.unidade}).`);
        if (criadas > 0) {
          setPlacaNova('');
          setFrotaNova('');
        }
        await Promise.all([
          carregarModelos(unidade),
          carregarPlacas(unidade, busca),
          carregarHistorico(unidade, filtroHistorico),
        ]);
        if (resp.modelo_criado || resp.submodelo_criado) {
          setCodmodelo(String(resp.codmodelo));
          setCodsubmodelo(String(resp.codsubmodelo));
          setNovaMarca('');
          setNovoModelo('');
          setNovoSubmodelo('');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao gravar no RM.');
      }
    });
  }

  const colunas: ColumnDef<FrotaPlaca>[] = useMemo(
    () => [
      { accessorKey: 'placa', header: 'Placa' },
      { accessorKey: 'frota', header: 'Frota', cell: ({ row }) => row.original.frota || '—' },
      { accessorKey: 'modelo', header: 'Modelo' },
      { accessorKey: 'submodelo', header: 'Submodelo' },
      { accessorKey: 'anomodelo', header: 'Ano modelo', cell: ({ row }) => row.original.anomodelo ?? '—' },
      { accessorKey: 'criado_por', header: 'Cadastrado por', cell: ({ row }) => row.original.criado_por || '—' },
      {
        accessorKey: 'criado_em',
        header: 'Cadastrado em',
        cell: ({ row }) =>
          row.original.criado_em ? new Date(row.original.criado_em).toLocaleDateString('pt-BR') : '—',
      },
      {
        accessorKey: 'ativo',
        header: 'Situação',
        cell: ({ row }) => (
          <Badge variant={row.original.ativo ? 'secondary' : 'destructive'}>
            {row.original.status_descricao || (row.original.ativo ? 'Ativo' : 'Inativo')}
          </Badge>
        ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Ver histórico da placa"
              onClick={() => {
                setFiltroHistorico(row.original.placa);
                void carregarHistorico(unidade, row.original.placa);
                document.getElementById('frotas-historico')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Alterar dados da placa"
              onClick={() =>
                setEdicao({
                  placa: row.original.placa,
                  frota: row.original.frota ?? '',
                  codmodelo: String(row.original.codmodelo),
                  codsubmodelo: String(row.original.codsubmodelo),
                  anoModelo: row.original.anomodelo ? String(row.original.anomodelo) : '',
                  anoFabr: row.original.anofabr ? String(row.original.anofabr) : '',
                  motivo: '',
                })
              }
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {row.original.ativo && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  setMotivoDesativar('');
                  setPlacaDesativar(row.original);
                }}
              >
                <Ban className="h-4 w-4 mr-1" /> Desativar
              </Button>
            )}
          </div>
        ),
      },
    ],
    [unidade, carregarHistorico]
  );

  const colunasHistorico: ColumnDef<FrotaHistorico>[] = useMemo(
    () => [
      {
        accessorKey: 'data_hora',
        header: 'Data',
        cell: ({ row }) => new Date(row.original.data_hora).toLocaleString('pt-BR'),
      },
      { accessorKey: 'placa', header: 'Placa' },
      {
        accessorKey: 'acao',
        header: 'Ação',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.acao === 'DESATIVAR' ? 'destructive' : row.original.acao === 'EDITAR' ? 'secondary' : 'default'
            }
          >
            {ACAO_LABEL[row.original.acao] ?? row.original.acao}
          </Badge>
        ),
      },
      {
        accessorKey: 'usuario',
        header: 'Usuário',
        cell: ({ row }) => row.original.usuario_nome || row.original.usuario,
      },
      { accessorKey: 'motivo', header: 'Motivo', cell: ({ row }) => row.original.motivo || '—' },
      { accessorKey: 'detalhe', header: 'Detalhe', cell: ({ row }) => row.original.detalhe || '—' },
    ],
    []
  );

  function montarPdf(): RelatorioFrotaPdf {
    const ativas = placasRm.filter((p) => p.ativo).length;
    return {
      titulo: 'Placas cadastradas no RM',
      subtitulo: 'Gestão de frotas · cadastro no RM',
      unidade,
      periodo: 'situação atual',
      arquivo: `placas-rm-${unidade}-${new Date().toISOString().slice(0, 10)}`,
      kpis: [
        { rotulo: 'Placas listadas', valor: String(placasRm.length), detalhe: busca.trim() ? `busca: ${busca.trim()}` : 'todas da unidade' },
        { rotulo: 'Ativas', valor: String(ativas), detalhe: 'no RM' },
        { rotulo: 'Inativas', valor: String(placasRm.length - ativas), detalhe: 'desativadas no RM' },
        { rotulo: 'Modelos', valor: String(new Set(placasRm.map((p) => p.modelo)).size), detalhe: 'diferentes na lista' },
        { rotulo: 'Histórico', valor: String(historico.length), detalhe: filtroHistorico ? `placa ${filtroHistorico}` : 'registro(s)' },
      ],
      secoes: [
        {
          titulo: 'Placas',
          nota: `${placasRm.length} placa(s) · ${textoFiltros([['Busca', busca.trim()]])}`,
          colunas: [
            { titulo: 'Placa', largura: 20 }, { titulo: 'Frota', largura: 18 }, { titulo: 'Modelo', largura: 44 },
            { titulo: 'Submodelo', largura: 40 }, { titulo: 'Ano', largura: 14 }, { titulo: 'Cadastrado por', largura: 34 },
            { titulo: 'Situação', largura: 20 },
          ],
          linhas: placasRm.map((p) => [
            { texto: p.placa, negrito: true },
            { texto: p.frota || '—', cor: p.frota ? undefined : COR_PDF.muted },
            { texto: p.modelo },
            { texto: p.submodelo },
            { texto: p.anomodelo ? String(p.anomodelo) : '—' },
            { texto: p.criado_por || '—', sub: p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : undefined },
            { texto: p.status_descricao || (p.ativo ? 'Ativo' : 'Inativo'), cor: p.ativo ? COR_PDF.ok : COR_PDF.perigo },
          ]),
        },
        {
          titulo: 'Histórico',
          nota: `${historico.length} registro(s) · ${textoFiltros([['Placa', filtroHistorico]])}`,
          colunas: [
            { titulo: 'Data', largura: 28 }, { titulo: 'Placa', largura: 20 }, { titulo: 'Ação', largura: 28 },
            { titulo: 'Usuário', largura: 34 }, { titulo: 'Motivo / detalhe', largura: 80 },
          ],
          linhas: historico.map((h) => [
            { texto: new Date(h.data_hora).toLocaleString('pt-BR') },
            { texto: h.placa, negrito: true },
            { texto: ACAO_LABEL[h.acao] ?? h.acao, cor: h.acao === 'DESATIVAR' ? COR_PDF.perigo : undefined },
            { texto: h.usuario_nome || h.usuario },
            { texto: h.motivo || h.detalhe || '—', sub: h.motivo && h.detalhe ? h.detalhe : undefined },
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
            <Car className="h-6 w-6" /> Cadastro de placas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Frotas — cadastra os veículos direto no RM (Manutenção › objetos de oficina), para o lançamento de
            despesas e o consumo de combustível encontrarem a placa.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-48 space-y-1">
            <Label>Unidade</Label>
            {podeTrocarUnidade ? (
              <Select value={unidade} onValueChange={setUnidade} disabled={gravando}>
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
          <BotaoPdf disabled={!unidade || carregandoPlacas || carregandoHistorico} montar={montarPdf} />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <CartaoIndicador icone={CarFront} tom="azul" destaque rotulo="Placas no RM" valor={carregandoPlacas ? '…' : placasRm.length}
          detalhe={busca.trim() ? `busca: ${busca.trim()}` : 'todas da unidade'} />
        <CartaoIndicador icone={CircleCheck} tom="verde" rotulo="Ativas" valor={carregandoPlacas ? '…' : placasRm.filter((p) => p.ativo).length}
          detalhe="podem receber lançamentos" />
        <CartaoIndicador icone={Ban} tom="cinza" rotulo="Inativas" valor={carregandoPlacas ? '…' : placasRm.filter((p) => !p.ativo).length}
          detalhe="desativadas no RM" />
        <CartaoIndicador icone={Layers} tom="roxo" rotulo="Modelos" valor={carregandoPlacas ? '…' : new Set(placasRm.map((p) => p.modelo)).size}
          detalhe="diferentes na lista" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo veículo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe a placa (com ou sem hífen), o modelo e o submodelo. Simule e depois grave no RM.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="placa-nova">Placa</Label>
              <Input
                id="placa-nova"
                placeholder="UCQ3C99"
                maxLength={8}
                value={placaNova}
                onChange={(e) => setPlacaNova(e.target.value)}
                disabled={gravando}
                className="font-mono uppercase"
              />
              {linhas.length > 0 && !linhas[0].valida && (
                <p className="text-xs text-destructive">Use ABC1234 ou ABC1D23.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="frota-nova">Frota (opcional)</Label>
              <Input
                id="frota-nova"
                placeholder="F012"
                maxLength={60}
                value={frotaNova}
                onChange={(e) => setFrotaNova(e.target.value)}
                disabled={gravando}
                className="uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label>Ano modelo (opcional)</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex.: 2026"
                value={anoModelo}
                onChange={(e) => setAnoModelo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                disabled={gravando}
              />
            </div>
            <div className="space-y-1">
              <Label>Ano fabricação (opcional)</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex.: 2025"
                value={anoFabr}
                onChange={(e) => setAnoFabr(e.target.value.replace(/\D/g, '').slice(0, 4))}
                disabled={gravando}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="space-y-1">
                <Label>Modelo</Label>
                <Select
                  value={codmodelo}
                  onValueChange={(v) => {
                    setCodmodelo(v);
                    setCodsubmodelo('');
                  }}
                  disabled={gravando || carregandoModelos}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={carregandoModelos ? 'Carregando…' : 'Selecione o modelo'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOVO}>+ Cadastrar modelo novo</SelectItem>
                    {modelos.map((m) => (
                      <SelectItem key={m.codmodelo} value={String(m.codmodelo)}>
                        {m.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {criandoModelo && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Marca</Label>
                    <Input
                      placeholder="Ex.: FIAT"
                      value={novaMarca}
                      onChange={(e) => setNovaMarca(e.target.value)}
                      disabled={gravando}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Modelo</Label>
                    <Input
                      placeholder="Ex.: STRADA ENDURANCE"
                      value={novoModelo}
                      onChange={(e) => setNovoModelo(e.target.value)}
                      disabled={gravando}
                      className="uppercase"
                    />
                  </div>
                  <p
                    className={`sm:col-span-2 text-xs ${
                      nomeNovoModelo.length > MAX_MODELO ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    Será gravado como <strong>{nomeNovoModelo || 'MARCA/MODELO'}</strong> ({nomeNovoModelo.length}/
                    {MAX_MODELO}). Confira se o modelo já não existe na lista antes de criar.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Submodelo</Label>
              {criandoModelo ? null : (
                <Select
                  value={codsubmodelo}
                  onValueChange={setCodsubmodelo}
                  disabled={gravando || !modeloSelecionado}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o submodelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NOVO}>+ Cadastrar submodelo novo</SelectItem>
                    {modeloSelecionado?.submodelos.map((s) => (
                      <SelectItem key={s.codsubmodelo} value={String(s.codsubmodelo)}>
                        {s.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {criandoSubmodelo && (
                <Input
                  placeholder="Ex.: STRADA ENDURANCE CS FLEX"
                  value={novoSubmodelo}
                  onChange={(e) => setNovoSubmodelo(e.target.value)}
                  maxLength={MAX_SUBMODELO}
                  disabled={gravando}
                  className="uppercase"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {simulacao && !simulacaoValida && (
              <span className="text-xs text-muted-foreground">Os dados mudaram: simule de novo para liberar o Gravar.</span>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleSimular}
              disabled={simulando || gravando || linhas.length === 0}
            >
              {simulando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FlaskConical className="h-4 w-4 mr-2" />}
              Simular
            </Button>
            <Button
              type="button"
              onClick={handleGravar}
              disabled={gravando || simulando || simuladasParaGravar === 0}
              title={simulacaoValida ? undefined : 'Simule antes de gravar'}
            >
              {gravando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Gravar no RM
            </Button>
          </div>

          {simulacao && simulacaoValida && (
            <div className="rounded-md border border-dashed p-3 text-sm space-y-1">
              <p className="font-medium">Simulação — nada foi gravado no RM</p>
              <p className="text-muted-foreground">
                Modelo {simulacao.resp.modelo_criado ? 'novo, código' : 'código'} {simulacao.resp.codmodelo}
                {' · '}
                Submodelo {simulacao.resp.submodelo_criado ? 'novo, código' : 'código'} {simulacao.resp.codsubmodelo}
              </p>
              {simulacao.resp.resultados.map((r) => (
                <div key={r.placa} className="flex items-center gap-2">
                  <span className="font-mono w-24">{r.placa}</span>
                  <Badge
                    variant={r.status === 'erro' ? 'destructive' : r.status === 'criado' ? 'default' : 'secondary'}
                  >
                    {STATUS_LABEL_SIMULACAO[r.status]}
                  </Badge>
                  {r.mensagem && <span className="text-muted-foreground">{r.mensagem}</span>}
                </div>
              ))}
            </div>
          )}

          {resultados.length > 0 && (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">Resultado</p>
              {resultados.map((r) => (
                <div key={r.placa} className="flex items-center gap-2">
                  <span className="font-mono w-24">{r.placa}</span>
                  <Badge
                    variant={r.status === 'erro' ? 'destructive' : r.status === 'criado' ? 'default' : 'secondary'}
                  >
                    {STATUS_LABEL[r.status]}
                  </Badge>
                  {r.mensagem && <span className="text-muted-foreground">{r.mensagem}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Placas cadastradas no RM ({unidade})</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar placa, frota ou modelo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregarPlacas(unidade, busca);
              }}
              className="w-64"
            />
            <Button type="button" variant="secondary" onClick={() => void carregarPlacas(unidade, busca)}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              title="Recarregar"
              onClick={() => {
                setBusca('');
                void carregarPlacas(unidade);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunas}
            data={placasRm}
            loading={carregandoPlacas}
            hideSearch
            emptyMessage="Nenhuma placa encontrada."
          />
        </CardContent>
      </Card>

      <Card id="frotas-historico">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Histórico ({unidade}){filtroHistorico ? ` · placa ${filtroHistorico}` : ''}
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por placa"
              value={filtroHistorico}
              onChange={(e) => setFiltroHistorico(normalizarPlaca(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void carregarHistorico(unidade, filtroHistorico);
              }}
              className="w-48 font-mono uppercase"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void carregarHistorico(unidade, filtroHistorico)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              title="Ver todo o histórico"
              onClick={() => {
                setFiltroHistorico('');
                void carregarHistorico(unidade);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={colunasHistorico}
            data={historico}
            loading={carregandoHistorico}
            hideSearch
            emptyMessage="Nenhum registro no histórico."
          />
        </CardContent>
      </Card>

      <Dialog
        open={edicao !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !salvandoEdicao) setEdicao(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar placa {edicao?.placa}</DialogTitle>
            <DialogDescription>
              Corrige os dados no RM ({unidade}). A placa não muda; o que for alterado fica no histórico.
            </DialogDescription>
          </DialogHeader>
          {edicao && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Frota</Label>
                <Input
                  value={edicao.frota}
                  maxLength={60}
                  onChange={(e) => setEdicao({ ...edicao, frota: e.target.value })}
                  disabled={salvandoEdicao}
                  className="uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label>Modelo</Label>
                <Select
                  value={edicao.codmodelo}
                  onValueChange={(v) => setEdicao({ ...edicao, codmodelo: v, codsubmodelo: '' })}
                  disabled={salvandoEdicao}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.codmodelo} value={String(m.codmodelo)}>
                        {m.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Submodelo</Label>
                <Select
                  value={edicao.codsubmodelo}
                  onValueChange={(v) => setEdicao({ ...edicao, codsubmodelo: v })}
                  disabled={salvandoEdicao || !modeloEdicao}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o submodelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeloEdicao?.submodelos.map((s) => (
                      <SelectItem key={s.codsubmodelo} value={String(s.codsubmodelo)}>
                        {s.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Ano modelo</Label>
                  <Input
                    inputMode="numeric"
                    value={edicao.anoModelo}
                    onChange={(e) => setEdicao({ ...edicao, anoModelo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    disabled={salvandoEdicao}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ano fabricação</Label>
                  <Input
                    inputMode="numeric"
                    value={edicao.anoFabr}
                    onChange={(e) => setEdicao({ ...edicao, anoFabr: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    disabled={salvandoEdicao}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="motivo-edicao">Motivo (opcional)</Label>
                <Textarea
                  id="motivo-edicao"
                  rows={2}
                  maxLength={500}
                  placeholder="Ex.: modelo cadastrado errado"
                  value={edicao.motivo}
                  onChange={(e) => setEdicao({ ...edicao, motivo: e.target.value })}
                  disabled={salvandoEdicao}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Placa digitada errada não se corrige aqui: desative a placa errada e cadastre a certa.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdicao(null)} disabled={salvandoEdicao}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSalvarEdicao} disabled={salvandoEdicao}>
              {salvandoEdicao ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={placaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !desativando) setPlacaDesativar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar placa {placaDesativar?.placa}</DialogTitle>
            <DialogDescription>
              O veículo fica com status Inativo no RM ({unidade}) e o motivo é gravado no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-desativar">Motivo</Label>
            <Textarea
              id="motivo-desativar"
              rows={4}
              maxLength={500}
              placeholder="Ex.: veículo vendido / devolvido à locadora / sinistro"
              value={motivoDesativar}
              onChange={(e) => setMotivoDesativar(e.target.value)}
              disabled={desativando}
            />
            <p className="text-xs text-muted-foreground">{motivoDesativar.trim().length}/500</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlacaDesativar(null)} disabled={desativando}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDesativar}
              disabled={desativando || motivoDesativar.trim().length < 3}
            >
              {desativando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
