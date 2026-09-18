'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listarAuditoriaPermissoes,
  type UsuarioPermAuditItem,
} from '@/services/usuariosService'

const UNIDADES = [
  'WAY 112',
  'WAY 153',
  'WAY 262',
  'WAY 306',
  'WAY 364',
  'WAY CSC',
  'MIGRA BR',
]

function labelAcao(acao: string) {
  switch ((acao || '').toUpperCase()) {
    case 'CRIACAO':
      return 'Criação'
    case 'ALTERACAO':
      return 'Alteração'
    case 'COPIA':
      return 'Cópia'
    case 'COPIA_ATUALIZA':
      return 'Cópia (atualização)'
    case 'UNIFICACAO':
      return 'Unificação'
    default:
      return acao
  }
}

function formatDataHora(raw: string) {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}

/** Painel de auditoria (CSC): criação, alteração e cópia de permissões. */
export default function AuditoriaUsuariosPanel({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [itens, setItens] = useState<UsuarioPermAuditItem[]>([])
  const [q, setQ] = useState('')
  const [unidade, setUnidade] = useState<string>('todas')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const data = await listarAuditoriaPermissoes({
        q: q.trim() || undefined,
        unidade: unidade === 'todas' ? undefined : unidade,
        de: de || undefined,
        ate: ate || undefined,
        top: 500,
      })
      setItens(data)
    } catch (err) {
      toast.error((err as Error).message)
      setItens([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const colunas = useMemo<ColumnDef<UsuarioPermAuditItem>[]>(
    () => [
      {
        accessorKey: 'dataHora',
        header: 'Quando',
        cell: ({ row }) => formatDataHora(row.original.dataHora),
      },
      {
        accessorKey: 'acao',
        header: 'Ação',
        cell: ({ row }) => labelAcao(row.original.acao),
      },
      {
        id: 'quem',
        header: 'Quem fez',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm">
              <div className="font-medium">{r.actorNome || r.actorCodusuario}</div>
              <div className="text-muted-foreground">
                {r.actorCodusuario}
                {r.actorUnidade ? ` · ${r.actorUnidade}` : ''}
              </div>
            </div>
          )
        },
      },
      {
        id: 'alvo',
        header: 'Usuário / base',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm">
              <div className="font-medium">{r.targetNome || r.targetCodusuario}</div>
              <div className="text-muted-foreground">
                {r.targetCodusuario} · {r.targetUnidade}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'detalhe',
        header: 'O que mudou',
        cell: ({ row }) => (
          <div className="max-w-md whitespace-pre-wrap text-sm text-muted-foreground">
            {row.original.detalhe || '—'}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className={compact ? '' : 'space-y-6'}>
      {!compact && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Auditoria de usuários</h2>
          <p className="text-sm text-muted-foreground">
            Quem criou, alterou permissões ou copiou usuários para outras bases.
          </p>
        </div>
      )}

      <Card className="mb-6">
        {compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
        )}
        <CardContent className={`flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end ${compact ? 'pt-4' : 'pt-6'}`}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="audDe">De</Label>
            <Input id="audDe" type="date" value={de} onChange={e => setDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="audAte">Até</Label>
            <Input id="audAte" type="date" value={ate} onChange={e => setAte(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label>Base do usuário</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {UNIDADES.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Label htmlFor="audQ">Busca</Label>
            <Input
              id="audQ"
              placeholder="Nome, matrícula ou detalhe…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void carregar()
                }
              }}
            />
          </div>
          <Button onClick={() => void carregar()} disabled={loading} className="flex items-center">
            <SearchIcon className="mr-1 h-4 w-4" />
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataTable columns={colunas} data={itens} loading={loading} />
          {!loading && itens.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Nenhum registro de auditoria encontrado. Os eventos passam a ser gravados
              após criação, alteração de permissão ou cópia de usuário.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
