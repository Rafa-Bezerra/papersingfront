'use client'

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { Check, Filter, Search, SearchIcon, X, ZoomIn, ZoomOut } from 'lucide-react'

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
import { getPdfClickCoords, getSignaturePreviewStyle, handlePdfOverlayWheel, PdfClickCoords, PdfViewport } from "@/utils/pdfCoords";
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
    const iframe = useRef<HTMLIFrameElement>(null);
    const [coords, setCoords] = useState<PdfClickCoords | null>(null);
    const [signatureCoords, setSignatureCoords] = useState<PdfClickCoords | null>(null);
    const [previewCoords, setPreviewCoords] = useState<PdfClickCoords | null>(null);
    const [isPreviewLocked, setIsPreviewLocked] = useState(false);
    const [pdfViewport, setPdfViewport] = useState<PdfViewport | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [zoom, setZoom] = useState(1.5);
    const pdfStyle = pdfViewport
        ? { width: `${pdfViewport.width}px`, height: `${pdfViewport.height}px` }
        : { width: '100%', height: '100%', maxWidth: '800px', aspectRatio: '1/sqrt(2)' };

    {/** Retorno pdf */ }
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source === iframe.current?.contentWindow) {
                if (event.data?.totalPages) {
                    setTotalPages(event.data.totalPages);
                }
                if (event.data?.pdfViewport) {
                    setPdfViewport({
                        width: event.data.pdfViewport.width,
                        height: event.data.pdfViewport.height,
                        scale: event.data.pdfViewport.scale
                    });
                }
            }
        };

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

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
            const pdfClean = arquivo.replace(/^data:.*;base64,/, '').trim();

            setSelectedResultDocumento(arquivo);
            setCurrentPage(1);
            setTotalPages(null);
            setCoords(null);
            setSignatureCoords(null);
            setPreviewCoords(null);
            setIsPreviewLocked(false);
            setPdfViewport(null);

            setTimeout(() => {
                iframe.current?.contentWindow?.postMessage(
                    { pdfBase64: pdfClean },
                    '*'
                );
            }, 500);

            setZoom(1.5);
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

    function changePage(newPage: number) {
        if (!iframe.current) return;
        setCurrentPage(newPage);
        iframe.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    function handleImprimir() {
        if (!iframe.current) return;

        const iframeRef = iframe.current as HTMLIFrameElement;
        const iframeWindow = iframeRef.contentWindow;

        if (iframeWindow) {
            iframeWindow.focus();
            iframeWindow.print();
        } else {
            toast.error("Não foi possível acessar o documento para impressão.");
        }
    }

    function handleClickPdf(e: React.MouseEvent<HTMLDivElement>) {
        const nextCoords = getPdfClickCoords(e, pdfViewport);
        setCoords(nextCoords);
        setSignatureCoords(nextCoords);
        setPreviewCoords(null);
        setIsPreviewLocked(true);
    }

    function handleHoverPdf(e: React.MouseEvent<HTMLDivElement>) {
        if (isPreviewLocked) return;
        setPreviewCoords(getPdfClickCoords(e, pdfViewport));
    }

    function handleZoomIn() {
        if (!iframe.current) return;
        const newZoom = Math.min(5, zoom + 0.25);
        setZoom(newZoom);
        iframe.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomOut() {
        if (!iframe.current) return;
        const newZoom = Math.max(0.5, zoom - 0.25);
        setZoom(newZoom);
        iframe.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
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

    async function confirmarAssinatura() {
        if (!coords) {
            toast.error("Clique no local onde deseja assinar o documento.");
            return;
        }

        if (!selectedResult) {
            toast.error("Assinatura não enviada.");
            return;
        }

        const dadosAssinatura: DocumentoExternoAssinar = {
            id: selectedResult.id,
            pagina: currentPage,
            posX: coords.x,
            posY: coords.yI,
            largura: 90,
            altura: 30,
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
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
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
            {selectedResult && selectedResultDocumento && (
                <Dialog open={isModalDocumentosOpen} onOpenChange={(open) => { if (!open) setSelectedResultDocumento(null); setIsModalDocumentosOpen(open); }}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {selectedResult.assunto}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex-1 overflow-auto flex justify-center bg-gray-50" data-pdf-scroll="true">
                            {selectedResultDocumento ? (
                                <>
                                    <div className="relative" style={pdfStyle}>
                                        {/* PDF */}
                                        <iframe
                                            ref={iframe}
                                            src="/pdf-viewer.html"
                                            className="relative border-none cursor-default"
                                            style={pdfStyle}
                                        />

                                        {/* Overlay */}
                                        {selectedResult.pode_assinar && (<div
                                            id="assinatura-overlay"
                                            className="absolute inset-0 cursor-default"
                                            onClick={handleClickPdf}
                                            onMouseMove={handleHoverPdf}
                                            onMouseLeave={() => {
                                                if (!isPreviewLocked) setPreviewCoords(null);
                                            }}
                                            onWheel={handlePdfOverlayWheel}
                                        />)}

                                        {/* Pré-visualização da assinatura */}
                                        {selectedResult.pode_assinar && !isPreviewLocked && previewCoords && (
                                            <div
                                                className="absolute border-2 border-blue-600/70 bg-blue-500/10 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(previewCoords, pdfViewport) ?? undefined}
                                            />
                                        )}
                                        {selectedResult.pode_assinar && signatureCoords && (
                                            <div
                                                className="absolute border-2 border-blue-700 bg-blue-500/15 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(signatureCoords, pdfViewport) ?? undefined}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="flex items-center justify-center h-full py-10">
                                    Nenhum documento disponível
                                </p>
                            )}
                        </div>

                        {/* Ações */}
                        <div className="flex justify-center mt-2 mb-4 gap-4 shrink-0 sticky bottom-0 p-4 border-t">
                            <Button
                                disabled={currentPage <= 1}
                                onClick={() => changePage(currentPage - 1)}
                            >
                                Anterior
                            </Button>
                            <span>
                                Página {currentPage}
                                {totalPages ? ` / ${totalPages}` : ""}
                            </span>
                            <Button
                                disabled={currentPage >= (totalPages == null ? 1 : totalPages)}
                                onClick={() => changePage(currentPage + 1)}
                            >
                                Próxima
                            </Button>

                            {/* Controles de Zoom */}
                            <div className="flex items-center gap-2 border-l pl-4 ml-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Zoom:</span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleZoomOut}
                                    disabled={zoom <= 0.5}
                                    title="Diminuir zoom"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-sm min-w-[3rem] text-center font-medium">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleZoomIn}
                                    disabled={zoom >= 5}
                                    title="Aumentar zoom"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </div>
                            {(selectedResult.pode_assinar && <Button onClick={confirmarAssinatura} className="flex items-center">
                                Assinar
                            </Button>)}
                            <Button
                                variant="outline"
                                onClick={() => handleImprimir()}
                                className="flex items-center"
                            >
                                Imprimir
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

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
