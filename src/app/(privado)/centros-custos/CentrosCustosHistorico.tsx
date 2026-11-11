'use client'

import React, { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { History, Loader2, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CcHistoricoEvento, getCentrosCustosHistorico } from '@/services/mgoFinanceiroService'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
  podeFiltrarUnidade: boolean
}

function formatDataHora(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}

function trintaDiasAtrasIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function CentrosCustosHistorico({ unidadeLogada, podeFiltrarUnidade }: Props) {
  const [usuario, setUsuario] = useState('')
  const [unidade, setUnidade] = useState(unidadeLogada)
  const [de, setDe] = useState(trintaDiasAtrasIso())
  const [ate, setAte] = useState(hojeIso())
  const [carregando, setCarregando] = useState(false)
  const [eventos, setEventos] = useState<CcHistoricoEvento[]>([])
  const [consultado, setConsultado] = useState(false)

  async function consultar() {
    setCarregando(true)
    setConsultado(true)
    try {
      const r = await getCentrosCustosHistorico({
        usuario: usuario.trim() || undefined,
        unidade: podeFiltrarUnidade && unidade.trim() ? unidade.trim() : unidadeLogada || undefined,
        de: de || undefined,
        ate: ate || undefined,
        top: 500,
      })
      setEventos(r.eventos)
      if (r.eventos.length === 0) toast.info('Nenhum registro no período.')
    } catch (e) {
      mostrarErro(e)
      setEventos([])
    } finally {
      setCarregando(false)
    }
  }

  const colunas = useMemo<ColumnDef<CcHistoricoEvento>[]>(
    () => [
      {
        id: 'data',
        header: 'Data / hora',
        cell: ({ row }) => formatDataHora(row.original.dataHora),
      },
      { accessorKey: 'codusuario', header: 'Usuário' },
      { accessorKey: 'unidade', header: 'Unidade' },
      { accessorKey: 'titulo', header: 'Ação' },
      {
        accessorKey: 'detalhe',
        header: 'Detalhe',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground" title={row.original.detalhe}>
            {row.original.detalhe || '—'}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" /> Histórico do módulo Centros de custo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vínculos, alterações de cadastro e <strong>download de planilhas</strong> (AUDIT_LOG). Visível apenas para Admin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="grid min-w-[10rem] gap-2">
            <Label htmlFor="hist-cc-usuario">Usuário (opcional)</Label>
            <Input
              id="hist-cc-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Login de quem fez a ação"
            />
          </div>
          {podeFiltrarUnidade && (
            <div className="grid min-w-[10rem] gap-2">
              <Label htmlFor="hist-cc-unidade">Unidade</Label>
              <Input
                id="hist-cc-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex.: WAY 262"
              />
            </div>
          )}
          <div className="grid min-w-[9rem] gap-2">
            <Label htmlFor="hist-cc-de">De</Label>
            <Input id="hist-cc-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="grid min-w-[9rem] gap-2">
            <Label htmlFor="hist-cc-ate">Até</Label>
            <Input id="hist-cc-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <Button type="button" onClick={() => void consultar()} disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
            Consultar
          </Button>
        </div>

        <DataTable columns={colunas} data={eventos} loading={carregando} hideSearch />
        {consultado && !carregando && eventos.length > 0 && (
          <p className="text-xs text-muted-foreground">{eventos.length} registro(s) exibido(s) (máx. 500).</p>
        )}
      </CardContent>
    </Card>
  )
}
