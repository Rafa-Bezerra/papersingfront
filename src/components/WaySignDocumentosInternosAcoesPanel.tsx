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
    restaurarDocumento,
    getById,
    type DocumentoInternoAcaoHistorico,
} from '@/services/documentoService'
import { safeDateLabel } from '@/utils/functions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PdfViewerDialog from './PdfViewerDialog'
import { normalizarPdfDataUrl, base64PdfEhValido } from '@/services/documentoService'

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

type Props = { refreshToken?: number }

export function WaySignDocumentosInternosAcoesPanel({ refreshToken = 0 }: Props) {
    const hoje = new Date()
    const noventaDias = new Date(hoje)
    noventaDias.setDate(hoje.getDate() - 90)

    const [dateFrom, setDateFrom] = useState(noventaDias.toISOString().substring(0, 10))
    const [dateTo, setDateTo] = useState(hoje.toISOString().substring(0, 10))
    const [tipo, setTipo] = useState('')
    const [unidade, setUnidade] = useState('')
    const [itens, setItens] = useState<DocumentoInternoAcaoHistorico[]>([])
    const [carregando, setCarregando] = useState(false)
    const [erroApi, setErroApi] = useState<string | null>(null)
    const [buildFront, setBuildFront] = useState<string | null>(null)
    const [restaurandoId, setRestaurdandoId] = useState<number | null>(null)
    const [carregandoRestauracao, setCarregandoRestauracao] = useState(false)
    const [visualizandoId, setVisualizandoId] = useState<number | null>(null)
    const documentoVisualizado = itens.find(i => i.iddocumento === visualizandoId)
    const [carregandoDocumento, setCarregandoDocumento] = useState(false)
    const [pdfParaVisualizar, setPdfParaVisualizar] = useState<string | null>(null)
    const [nomeDocumentoVisualizar, setNomeDocumentoVisualizar] = useState<string>('')
    const [isModalPdfOpen, setIsModalPdfOpen] = useState(false)

    const carregar = useCallback(async () => {
        setCarregando(true)
        setErroApi(null)
        try {
            const res = await listarAcoesHistoricoDocumentos({
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                tipo: tipo || undefined,
            })
            setUnidade(res.unidade ?? '')
            setItens(res.itens ?? [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Falha ao carregar histórico.'
            setErroApi(msg)
            toast.error(msg)
            setItens([])
        } finally {
            setCarregando(false)
        }
    }, [dateFrom, dateTo, tipo])

    useEffect(() => {
        fetch('/build-info.txt', { cache: 'no-store' })
            .then((r) => (r.ok ? r.text() : ''))
            .then((t) => setBuildFront(t.trim() || null))
            .catch(() => setBuildFront(null))
    }, [])

    useEffect(() => {
        void carregar()
    }, [carregar, refreshToken])

    async function handleRestaurar() {
        if (!restaurandoId) return
        setCarregandoRestauracao(true)
        try {
            await restaurarDocumento(restaurandoId)
            toast.success('Documento restaurado')
            setRestaurdandoId(null)
            await carregar()
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setCarregandoRestauracao(false)
        }
    }

    async function handleAbrirDocumento() {
        if (!visualizandoId) return
        setCarregandoDocumento(true)
        try {
            const doc = await getById(visualizandoId)
            const anexoPrincipal = doc.anexos?.find(a => a.documento_principal)
            if (!anexoPrincipal) {
                toast.error('Documento não possui anexo principal')
                return
            }
            let arquivo = anexoPrincipal.anexo
            if (arquivo.startsWith('data:') || (arquivo.length > 500 && !arquivo.startsWith('/anexos/'))) {
                arquivo = normalizarPdfDataUrl(arquivo)
            }
            if (!base64PdfEhValido(arquivo)) {
                throw new Error('PDF inválido ou corrompido')
            }
            setPdfParaVisualizar(arquivo)
            setNomeDocumentoVisualizar(anexoPrincipal.nome || `Documento ${visualizandoId}`)
            setIsModalPdfOpen(true)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setCarregandoDocumento(false)
        }
    }

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
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const isExclusao = row.original.tipo_acao?.toUpperCase() === 'EXCLUIR'
                    if (!isExclusao) return null
                    return (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setVisualizandoId(row.original.iddocumento)}
                            >
                                Visualizar
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setRestaurdandoId(row.original.iddocumento)}
                            >
                                Restaurar
                            </Button>
                        </div>
                    )
                },
            },
        ],
        []
    )

    return (
        <>
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

                    {erroApi && (
                        <p className="text-sm text-destructive">
                            {erroApi.includes('404')
                                ? 'A API em produção não expõe GET /api/Documentos/acoes-historico — faça deploy da API (papersingapi-update.zip) além do front.'
                                : erroApi}
                        </p>
                    )}
                    {!carregando && itens.length === 0 && !erroApi && (
                        <p className="text-sm text-muted-foreground">
                            Nenhum registro no período. Só entram exclusões via POST /api/Documentos/excluir/{'{id}'} com motivo
                            (origem <strong>Documentos internos</strong> / DOCINTERNO). Origem INTERNO não grava aqui.
                            Amplie as datas ou confira DOCUMENTOS_INTERNOS_ACAO_HISTORICO no banco.
                        </p>
                    )}
                    {buildFront && (
                        <p className="text-xs text-muted-foreground">Front IIS: {buildFront}</p>
                    )}
                </CardContent>
            </Card>

            {documentoVisualizado && (
                <Dialog open={visualizandoId !== null} onOpenChange={(open) => { if (!open) setVisualizandoId(null) }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Detalhes da exclusão</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">ID do documento</p>
                                <p className="text-sm">{documentoVisualizado.iddocumento}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Documento</p>
                                <p className="text-sm">{documentoVisualizado.nome_documento || '—'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Data/hora</p>
                                <p className="text-sm">{safeDateLabel(documentoVisualizado.data_hora)}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Usuário</p>
                                <p className="text-sm">
                                    {documentoVisualizado.usuario_nome && documentoVisualizado.usuario_nome.toLowerCase() !== documentoVisualizado.usuario?.toLowerCase()
                                        ? `${documentoVisualizado.usuario_nome} (${documentoVisualizado.usuario})`
                                        : documentoVisualizado.usuario_nome || documentoVisualizado.usuario || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Motivo</p>
                                <p className="text-sm">{documentoVisualizado.motivo?.trim() || '—'}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setVisualizandoId(null)}>
                                Fechar
                            </Button>
                            <Button onClick={handleAbrirDocumento} disabled={carregandoDocumento}>
                                {carregandoDocumento ? 'Carregando…' : 'Abrir documento'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {restaurandoId !== null && (
                <Dialog open={restaurandoId !== null} onOpenChange={(open) => { if (!open) setRestaurdandoId(null) }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Restaurar documento</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mb-4">
                            Tem certeza que deseja restaurar o documento #{restaurandoId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRestaurdandoId(null)}>
                                Voltar
                            </Button>
                            <Button
                                onClick={handleRestaurar}
                                disabled={carregandoRestauracao}
                                className="disabled:cursor-not-allowed"
                            >
                                {carregandoRestauracao ? 'Restaurando…' : 'Restaurar'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {pdfParaVisualizar && (
                <PdfViewerDialog
                    open={isModalPdfOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPdfParaVisualizar(null)
                            setIsModalPdfOpen(false)
                        }
                    }}
                    title={`Documento: ${nomeDocumentoVisualizar}`}
                    pdfBase64={pdfParaVisualizar}
                    canSign={false}
                    isLoading={false}
                />
            )}
        </>
    )
}
