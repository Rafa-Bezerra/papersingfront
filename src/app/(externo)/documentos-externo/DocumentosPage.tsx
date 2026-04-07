'use client'

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition
} from 'react'
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { Check, Filter, SearchIcon, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { safeDateLabel, safeDateLabelAprovacao, stripDiacritics } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { DocumentoExterno, DocumentoExternoAprovador, DocumentoExternoAssinar, DocumentoExternoFiltro, aprovarExterno, assinarDocumentoExterno, getAllAprovadoresExterno, getAllExterno, getDocumentoExterno } from '@/services/documentoExternoService'
import { Label } from '@/components/ui/label'

export default function Page() {
    const titulo = 'Documentos Externos para Assinatura'
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [statusFiltrado, setStatusFiltrado] = useState<string>("")
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    {/** Documentos - visualização */ }
    const [results, setResults] = useState<DocumentoExterno[]>([])
    const [selectedResult, setSelectedResult] = useState<DocumentoExterno>()

    {/** Aprovações - visualização */ }
    const [selectedResultAprovacoes, setSelectedResultAprovacoes] = useState<DocumentoExternoAprovador[]>([])
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)

    {/** Arquivo - visualização */ }
    const [selectedResultDocumento, setSelectedResultDocumento] = useState<string | null>(null);
    const [isModalDocumentosOpen, setIsModalDocumentosOpen] = useState(false)

    {/** Set Datas */ }
    useEffect(() => {
        const hoje = new Date().toISOString().substring(0, 10)
        const quinzeDiasAtras = new Date(
            new Date().setDate(new Date().getDate() - 15)
        ).toISOString().substring(0, 10)

        setDateFrom(quinzeDiasAtras)
        setDateTo(hoje)
    }, [])

    {/** Search */ }
    useEffect(() => {
        if (!dateFrom || !dateTo) return
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { handleSearch(query) }, 300)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [query, statusFiltrado, dateFrom, dateTo])

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {
            const data: DocumentoExternoFiltro = {
                dateFrom: dateFrom,
                dateTo: dateTo,
                status: statusFiltrado,
                externo: false
            }
            const dados = await getAllExterno(data);
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const matchQuery = qNorm === "" || String(d.assunto ?? '').includes(qNorm)
                const matchSituacao = statusFiltrado === "" || d.status == statusFiltrado
                return matchQuery && matchSituacao
            })
            setResults(filtrados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setIsLoading(false)
            console.log(isPending);
            
        }
    }

    async function refreshData() {
        await handleSearch(query)
    }

    async function handleSearchClick() {
        startTransition(() => {
            const sp = new URLSearchParams(Array.from(searchParams.entries()))
            if (query) sp.set('q', query)
            else sp.delete('q')
            router.replace(`?${sp.toString()}`)
        })
        await handleSearch(query)
    }

    async function handleAprovacoes(data: DocumentoExterno) {
        setSelectedResult(data);
        setIsLoading(true)
        try {
            const dados = await getAllAprovadoresExterno(data.id);
            setSelectedResultAprovacoes(dados)
        } catch (err) {
            setError((err as Error).message)
            setSelectedResultAprovacoes([])
        } finally {
            setIsLoading(false)
            setIsModalAprovacoesOpen(true)
        }
    }

    async function handleDocumento(data: DocumentoExterno) {
        setSelectedResult(data);
        setIsLoading(true)
        try {
            const arquivo = await getDocumentoExterno(data.id);
            setSelectedResultDocumento(arquivo);
            setIsModalDocumentosOpen(true)
        } catch (err) {
            setError((err as Error).message)
            setSelectedResultDocumento(null)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleAprovar(id: number, aprovado: number) {
        setIsLoading(true)
        try {
            await aprovarExterno(id, aprovado)
            await refreshData()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    const colunas = useMemo<ColumnDef<DocumentoExterno>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'unidade', header: 'Unidade' },
            { accessorKey: 'assunto', header: 'Assunto' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'status', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                Documento {row.original.assinatura_externo && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {row.original.pode_aprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original.id, 1)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {row.original.status != 'aprovado interno' && row.original.status != 'reprovado interno' && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original.id, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}
                        </div>
                    );
                }
            }
        ],
        []
    )

    const colunasAprovacoes = useMemo<ColumnDef<DocumentoExternoAprovador>[]>(
        () => [
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'nivel', header: 'Nível' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao != null ? String(row.data_aprovacao) : null) }
        ],
        []
    )

    async function confirmarAssinatura(data: PdfSignData) {
        if (!selectedResult) {
            toast.error("Assinatura não enviada.");
            return;
        }

        const dadosAssinatura: DocumentoExternoAssinar = {
            id: selectedResult.id,
            pagina: data.page,
            posX: data.posX,
            posY: data.posY,
            largura: data.largura,
            altura: data.altura,
        };

        try {
            await assinarDocumentoExterno(dadosAssinatura);
            await refreshData()
            setIsModalDocumentosOpen(false)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Documento assinado`)
        }
    }

    return (
        <div className="p-6">
            {/* Header */}
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    <div className="flex justify-end items-end gap-4">
                        {/* Data de */}
                        <div className="flex flex-col">
                            <Label htmlFor="dateFrom">Data de</Label>
                            <Input
                                id="dateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>

                        {/* Data até */}
                        <div className="flex flex-col">
                            <Label htmlFor="dateTo">Data até</Label>
                            <Input
                                id="dateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Botão de Filtros - Dropdown com checkboxes */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Status</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"aguardando aprovacao externo"} checked={statusFiltrado == "aguardando aprovacao externo"} onCheckedChange={() => setStatusFiltrado("aguardando aprovacao externo")}>EXT. Aguardando aprovação</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"aprovado externo"} checked={statusFiltrado == "aprovado externo"} onCheckedChange={() => setStatusFiltrado("aprovado externo")}>EXT. Aprovado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"reprovado externo"} checked={statusFiltrado == "reprovado externo"} onCheckedChange={() => setStatusFiltrado("reprovado externo")}>EXT. Reprovado</DropdownMenuCheckboxItem>
                                {/* <DropdownMenuCheckboxItem key={"aguardando aprovacao interno"} checked={statusFiltrado == "aguardando aprovacao interno"} onCheckedChange={() => setStatusFiltrado("aguardando aprovacao interno")}>INT. Aguardando aprovação</DropdownMenuCheckboxItem> */}
                                <DropdownMenuCheckboxItem key={"aprovado interno"} checked={statusFiltrado == "aprovado interno"} onCheckedChange={() => setStatusFiltrado("aprovado interno")}>INT. Aprovado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"reprovado interno"} checked={statusFiltrado == "reprovado interno"} onCheckedChange={() => setStatusFiltrado("reprovado interno")}>INT. Reprovado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={statusFiltrado == ""} onCheckedChange={() => setStatusFiltrado("")}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 md:flex-row">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Pesquise por nome ou ID"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pr-10"
                            aria-label="Campo de busca"
                        />
                        {query && (
                            <button
                                aria-label="Limpar busca"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                                onClick={clearQuery}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <Button onClick={handleSearchClick} className="flex items-center">
                        <SearchIcon className="mr-1 h-4 w-4" /> Buscar
                    </Button>
                </CardContent>
            </Card>

            {/* Main */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
                </CardContent>
            </Card>

            {/* Aprovações */}
            {selectedResult && selectedResultAprovacoes && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações documento n° ${selectedResult.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={selectedResultAprovacoes} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Loading */}
            <Dialog open={isLoading} onOpenChange={setIsLoading}>
                <DialogContent
                    showCloseButton={false}
                    className="flex flex-col items-center justify-center gap-4 border-none shadow-none bg-transparent max-w-[200px]"
                >
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center"></DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center rounded-2xl p-6 shadow-lg">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        <p className="text-sm text-gray-600 mt-2">Carregando</p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Visualizar anexo */}
            <PdfViewerDialog
                open={isModalDocumentosOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedResultDocumento(null);
                    setIsModalDocumentosOpen(open);
                }}
                title={selectedResult?.assunto ?? ''}
                pdfBase64={selectedResultDocumento}
                canSign={selectedResult?.pode_assinar}
                onSign={confirmarAssinatura}
                isLoading={isLoading}
            />

            {error && (
                <p className="mb-4 text-center text-sm text-destructive">
                    Erro: {error}
                </p>
            )}

            {results.length === 0 && !isLoading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                </p>
            )}
        </div>
    )
}
