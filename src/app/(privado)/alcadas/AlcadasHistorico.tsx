'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { History, Loader2, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HistoricoUsuarioFiltroGusuario } from '@/components/historico/HistoricoUsuarioFiltroGusuario'
import { useNomesUsuariosUnidade } from '@/components/historico/useNomesUsuariosUnidade'
import { UsuarioAncoraTriggerLabel } from '@/components/usuario/UsuarioSelecionadoChip'
import { AlcadaHistoricoEvento, getAlcadasHistorico } from '@/services/alcadasService'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
}

function formatDataHora(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function trintaDiasAtrasIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export default function AlcadasHistorico({ unidadeLogada }: Props) {
  const [usuario, setUsuario] = useState('')
  const [de, setDe] = useState(trintaDiasAtrasIso())
  const [ate, setAte] = useState(hojeIso())
  const [carregando, setCarregando] = useState(false)
  const [eventos, setEventos] = useState<AlcadaHistoricoEvento[]>([])
  const [consultado, setConsultado] = useState(false)

  const unidadeConsulta = unidadeLogada.trim() || undefined
  const { resolverNome } = useNomesUsuariosUnidade(unidadeConsulta)

  useEffect(() => {
    setUsuario('')
  }, [unidadeLogada])

  async function consultar() {
    setCarregando(true)
    setConsultado(true)
    try {
      const r = await getAlcadasHistorico({
        usuario: usuario.trim() || undefined,
        unidade: unidadeConsulta,
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

  const colunas = useMemo<ColumnDef<AlcadaHistoricoEvento>[]>(
    () => [
      {
        id: 'data',
        header: 'Data / hora',
        cell: ({ row }) => formatDataHora(row.original.dataHora),
      },
      {
        id: 'usuario',
        header: 'Usuário',
        cell: ({ row }) => (
          <UsuarioAncoraTriggerLabel
            login={row.original.codusuario}
            nome={resolverNome(row.original.codusuario, row.original.nome)}
            vazio="—"
          />
        ),
      },
      { accessorKey: 'unidade', header: 'Unidade' },
      {
        accessorKey: 'titulo',
        header: 'Ação',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground" title={row.original.titulo}>
            {row.original.titulo || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'detalhe',
        header: 'Detalhe',
        cell: ({ row }) => {
          const texto =
            row.original.detalhe?.trim() ||
            row.original.referencia?.trim() ||
            ''
          return (
            <span className="text-sm text-muted-foreground leading-snug" title={texto}>
              {texto || '—'}
            </span>
          )
        },
      },
    ],
    [resolverNome]
  )

  return (
    <Card id="tour-alcadas-historico">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" /> Histórico do módulo Alçadas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Registro do que cada usuário alterou em alçadas, aprovadores, substituição e transferência (AUDIT_LOG).
          Visível apenas para Admin. Unidade: <strong className="text-foreground">{unidadeLogada || '—'}</strong> —
          consulta limitada à sua base.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="grid min-w-[14rem] max-w-md gap-2 flex-1">
            <Label htmlFor="hist-usuario">Usuário (opcional)</Label>
            <HistoricoUsuarioFiltroGusuario
              id="hist-usuario"
              value={usuario}
              onValueChange={setUsuario}
              unidadeFiltro={unidadeConsulta}
              resolverNome={(login) => resolverNome(login)}
            />
          </div>
          <div className="grid min-w-[9rem] gap-2">
            <Label htmlFor="hist-de">De</Label>
            <Input id="hist-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="grid min-w-[9rem] gap-2">
            <Label htmlFor="hist-ate">Até</Label>
            <Input id="hist-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
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
