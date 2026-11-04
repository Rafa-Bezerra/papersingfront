'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Car, Loader2, MapPin, Pencil, RefreshCw } from 'lucide-react';
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
import { definirLotacao, FrotaLotacao, listarLotacoes, normalizarPlaca } from '@/services/frotasService';
import { CartaoIndicador, isoHoje, usePlacasFrota } from '../comum';
import { dataBr } from '../VeiculoDialog';

const REGIOES_PADRAO = [
  ...Array.from({ length: 9 }, (_, i) => `SAU ${i + 1}`),
  ...Array.from({ length: 11 }, (_, i) => `BSO ${i + 1}`),
  'Sede e apoio',
];

type Linha = {
  placa: string;
  frota?: string | null;
  modelo?: string | null;
  ativo: boolean;
  lotacao?: FrotaLotacao;
};

export default function LotacaoPlacas({ unidade, onMudou }: { unidade: string; onMudou: () => void }) {
  const placas = usePlacasFrota(unidade);
  const [lotacoes, setLotacoes] = useState<FrotaLotacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [soSem, setSoSem] = useState(false);
  const [editando, setEditando] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    if (!unidade) return;
    setCarregando(true);
    try {
      setLotacoes(await listarLotacoes(unidade));
    } catch (e) {
      setLotacoes([]);
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as lotações.');
    } finally {
      setCarregando(false);
    }
  }, [unidade]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhas = useMemo<Linha[]>(() => {
    const porPlaca = new Map(lotacoes.map((l) => [normalizarPlaca(l.placa), l]));
    const lista: Linha[] = placas.map((p) => ({
      placa: p.placa,
      frota: p.frota,
      modelo: [p.modelo, p.submodelo].filter(Boolean).join(' / '),
      ativo: p.ativo,
      lotacao: porPlaca.get(normalizarPlaca(p.placa)),
    }));
    // Lotação de placa que não está mais no RM continua visível.
    const noRm = new Set(placas.map((p) => normalizarPlaca(p.placa)));
    for (const l of lotacoes) {
      if (!noRm.has(normalizarPlaca(l.placa))) lista.push({ placa: l.placa, ativo: false, lotacao: l });
    }
    return lista.sort((a, b) => a.placa.localeCompare(b.placa));
  }, [placas, lotacoes]);

  const regioes = useMemo(() => {
    const s = new Set(REGIOES_PADRAO);
    lotacoes.forEach((l) => l.regiao && s.add(l.regiao));
    return Array.from(s);
  }, [lotacoes]);

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const p = normalizarPlaca(busca);
    return linhas.filter((l) => {
      if (soSem && l.lotacao) return false;
      if (!b) return true;
      return (
        (p && normalizarPlaca(l.placa).includes(p)) ||
        (l.frota ?? '').toLowerCase().includes(b) ||
        (l.modelo ?? '').toLowerCase().includes(b) ||
        (l.lotacao?.regiao ?? '').toLowerCase().includes(b) ||
        (l.lotacao?.codccusto ?? '').toLowerCase().includes(b) ||
        (l.lotacao?.desc_ccusto ?? '').toLowerCase().includes(b) ||
        (l.lotacao?.prefixo ?? '').toLowerCase().includes(b)
      );
    });
  }, [linhas, busca, soSem]);

  const semLotacao = linhas.filter((l) => !l.lotacao && l.ativo).length;
  const porRegiao = useMemo(() => {
    const m = new Map<string, number>();
    lotacoes.forEach((l) => m.set(l.regiao, (m.get(l.regiao) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { numeric: true }));
  }, [lotacoes]);

  const colunas: ColumnDef<Linha>[] = [
    {
      accessorKey: 'placa',
      header: 'Placa',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">{row.original.placa}</span>
          {!row.original.ativo && <Badge variant="outline" className="text-xs">inativa</Badge>}
        </div>
      ),
    },
    {
      id: 'veiculo',
      header: 'Frota / modelo',
      cell: ({ row }) => (
        <div className="text-sm">
          <div>{row.original.frota || '—'}</div>
          <div className="text-xs text-muted-foreground">{row.original.modelo}</div>
        </div>
      ),
    },
    { id: 'prefixo', header: 'Prefixo', cell: ({ row }) => row.original.lotacao?.prefixo || '—' },
    {
      id: 'regiao',
      header: 'Região',
      cell: ({ row }) =>
        row.original.lotacao ? (
          <Badge variant="outline">{row.original.lotacao.regiao}</Badge>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 text-sm">Sem lotação</span>
        ),
    },
    {
      id: 'cc',
      header: 'Centro de custo',
      cell: ({ row }) =>
        row.original.lotacao?.codccusto ? (
          <div className="text-sm">
            <div className="font-mono">{row.original.lotacao.codccusto}</div>
            <div className="text-xs text-muted-foreground">{row.original.lotacao.desc_ccusto}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'desde',
      header: 'Desde',
      cell: ({ row }) => (row.original.lotacao ? dataBr(row.original.lotacao.inicio_vigencia) : '—'),
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setEditando(row.original)} title="Definir lotação">
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CartaoIndicador icone={Car} tom="azul" rotulo="Placas no RM" valor={placas.length} />
        <CartaoIndicador icone={MapPin} tom="verde" rotulo="Com lotação" valor={lotacoes.length} />
        <CartaoIndicador
          icone={AlertTriangle}
          tom="ambar"
          rotulo="Ativas sem lotação"
          valor={semLotacao}
          detalhe="Os lançamentos dessas placas vão para “Sem lotação” no comparativo."
          ativo={soSem}
          onClick={() => setSoSem((v) => !v)}
        />
        <CartaoIndicador icone={MapPin} tom="roxo" rotulo="Regiões em uso" valor={porRegiao.length} />
      </div>

      {porRegiao.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {porRegiao.map(([r, n]) => (
            <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => setBusca(r)}>
              {r}: {n}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Lotação das placas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-full max-w-xs sm:w-64"
              placeholder="Buscar placa, região, CC..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <DataTable
              columns={colunas}
              data={filtradas}
              loading={carregando}
              hideSearch
              emptyMessage={soSem ? 'Todas as placas ativas têm lotação.' : 'Nenhuma placa encontrada.'}
            />
          </div>
        </CardContent>
      </Card>

      {editando && (
        <DialogLotacao
          unidade={unidade}
          linha={editando}
          regioes={regioes}
          onFechar={() => setEditando(null)}
          onSalvou={() => {
            setEditando(null);
            void carregar();
            onMudou();
          }}
        />
      )}
    </div>
  );
}

function DialogLotacao({
  unidade,
  linha,
  regioes,
  onFechar,
  onSalvou,
}: {
  unidade: string;
  linha: Linha;
  regioes: string[];
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const atual = linha.lotacao;
  const [regiao, setRegiao] = useState(atual?.regiao ?? '');
  const [prefixo, setPrefixo] = useState(atual?.prefixo ?? '');
  const [codccusto, setCodccusto] = useState(atual?.codccusto ?? '');
  const [descCcusto, setDescCcusto] = useState(atual?.desc_ccusto ?? '');
  const [inicio, setInicio] = useState(isoHoje());
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!regiao.trim()) {
      toast.error('Informe a região.');
      return;
    }
    if (atual && inicio < atual.inicio_vigencia.slice(0, 10)) {
      toast.error('O início não pode ser antes da lotação atual.');
      return;
    }
    setSalvando(true);
    try {
      await definirLotacao({
        unidade,
        placa: linha.placa,
        regiao: regiao.trim(),
        prefixo: prefixo.trim() || undefined,
        codccusto: codccusto.trim() || undefined,
        desc_ccusto: descCcusto.trim() || undefined,
        inicio_vigencia: inicio || undefined,
      });
      toast.success('Lotação salva.');
      onSalvou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar a lotação.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lotação da placa {linha.placa}</DialogTitle>
          <DialogDescription>
            {atual
              ? `Hoje em ${atual.regiao} desde ${dataBr(atual.inicio_vigencia)}. Ao salvar, a lotação atual é encerrada e a nova começa na data informada. Lançamentos antigos mantêm a região da época.`
              : 'Defina onde o veículo está lotado. Os próximos lançamentos dessa placa usam essa região no comparativo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Região *</Label>
            <Input list="frotas-regioes" value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="SAU 1, BSO 3, Sede e apoio..." />
            <datalist id="frotas-regioes">
              {regioes.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label>Centro de custo</Label>
            <Input value={codccusto} onChange={(e) => setCodccusto(e.target.value)} placeholder="153.3.03.001.001" />
          </div>
          <div className="space-y-1">
            <Label>Prefixo</Label>
            <Input value={prefixo} onChange={(e) => setPrefixo(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Descrição do centro de custo</Label>
            <Input value={descCcusto} onChange={(e) => setDescCcusto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Início da vigência</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
