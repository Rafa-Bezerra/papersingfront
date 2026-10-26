'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Loader2, RefreshCw, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    listarAcoesHistoricoDocumentos,
    type DocumentoInternoAcaoHistorico,
} from '@/services/documentoService'
import { safeDateLabel } from '@/utils/functions'

const TIPO_OPCOES = [
    { value: '', label: 'Todos' },
    { value: 'EXCLUIR', label: 'Exclusões' },
    { value: 'CANCELAR', label: 'Cancelamentos' },
] as const

function rotuloAcao(tipo: string) {
    const t = tipo.trim().toUpperCase()
    if (t === 'EXCLUIR') return 'Exclusão'
    if (t === 'CANCELAR') return 'Cancelamento'
    return tipo
}

export function WaySignDocumentosInternosAcoesPanel() {
    const hoje = new Date()
    const quinzeDias = new Date(hoje)
    quinzeDias.setDate(hoje.getDate() - 15)

    const [dateFrom, setDateFrom] = useState(quinzeDias.toISOString().substring(0, 10))
    const [dateTo, setDateTo] = useState(hoje.toISOString().substring(0, 10))
    const [tipo, setTipo] = useState('')
    const [unidade, setUnidade] = useState('')
    const [itens, setItens] = useState<DocumentoInternoAcaoHistorico[]>([])
    const [carregando, setCarregando] = useState(false)

    const carregar = useCallback(async () => {
        setCarregando(true)
        try {
            const res = await listarAcoesHistoricoDocumentos({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                tipo: tipo || undefined,
            })
            setUnidade(res.unidade ?? '')
            setItens(res.itens ?? [])
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Falha ao carregar histórico.')
            setItens([])
        } finally {
            setCarregando(false)
        }
    }, [dateFrom, dateTo, tipo])

    useEffect(() => {
        void carregar()
    }, [carregar])

    const colunas = useMemo<ColumnDef<DocumentoInternoAcaoHistorico>[]>(
        () => [
            {
                accessorKey: 'data_hora',
                header: 'Data/hora',
                accessorFn: (row) => safeDateLabel(row.data_hora),
            },
            {
                accessorKey: 'tipo_acao',
                header: 'Ação',
                cell: ({ row }) => {
                    const t = row.original.tipo_acao?.toUpperCase() ?? ''
                    const variant = t === 'EXCLUIR' ? 'destructive' : 'secondary'
                    return <Badge variant={variant}>{rotuloAcao(t)}</Badge>
                },
            },
            { accessorKey: 'iddocumento', header: 'ID doc.' },
            {
                accessorKey: 'nome_documento',
                header: 'Documento',
                cell: ({ row }) => row.original.nome_documento?.trim() || '—',
            },
            {
                id: 'usuario',
                header: 'Usuário',
                cell: ({ row }) => {
                    const nome = row.original.usuario_nome?.trim()
                    const login = row.original.usuario?.trim()
                    if (nome && login && nome.toLowerCase() !== login.toLowerCase()) {
                        return `${nome} (${login})`
                    }
                    return nome || login || '—'
                },
            },
            {
                accessorKey: 'motivo',
                header: 'Motivo',
                cell: ({ row }) => {
                    const m = row.original.motivo?.trim()
                    if (m) return m
                    return row.original.tipo_acao?.toUpperCase() === 'CANCELAR'
                        ? '—'
                        : '—'
                },
            },
        ],
        []
    )

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                    <CardTitle>Motivos — documentos internos</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Exclusões e cancelamentos registrados na unidade
                        {unidade ? ` ${unidade}` : ''}. Somente Admin.
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">Atualizar</span>
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <Label htmlFor="acoes-de">De</Label>
                        <Input
                            id="acoes-de"
                            type="date"
                            className="w-[160px]"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="acoes-ate">Até</Label>
                        <Input
                            id="acoes-ate"
                            type="date"
                            className="w-[160px]"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="acoes-tipo">Tipo</Label>
                        <select
                            id="acoes-tipo"
                            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 text-sm"
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                        >
                            {TIPO_OPCOES.map((o) => (
                                <option key={o.value || 'todos'} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button type="button" onClick={() => void carregar()} disabled={carregando}>
                        <SearchIcon className="h-4 w-4 mr-2" />
                        Buscar
                    </Button>
                </div>

                {carregando && itens.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando…
                    </div>
                ) : (
                    <DataTable columns={colunas} data={itens} />
                )}

                {!carregando && itens.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum registro no período.</p>
                )}
            </CardContent>
        </Card>
    )
}
