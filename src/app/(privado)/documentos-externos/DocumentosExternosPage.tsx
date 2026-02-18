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
import { Check, ChevronsUpDown, Filter, Search, SearchIcon, SquarePlus, X, ZoomIn, ZoomOut } from 'lucide-react'

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
import { safeDateLabel, safeDateLabelAprovacao, stripDiacritics, toBase64 } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { useForm, UseFormReturn } from 'react-hook-form';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'
import { useFieldArray } from "react-hook-form";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"
import { PopoverPortal } from '@radix-ui/react-popover';
import { getPdfClickCoords, getSignaturePreviewStyle, handlePdfOverlayWheel, PdfClickCoords, PdfViewport } from "@/utils/pdfCoords";
import { DocumentoExterno, DocumentoExternoAprovador, DocumentoExternoAssinar, DocumentoExternoCreateDTO, DocumentoExternoFiltro, aprovar, assinarDocumento, createElement, deleteElement, getAll, getAllAprovadores, getDocumento } from '@/services/documentoExternoService'
import {
    Usuario,
    getAll as getAllUsuarios
} from '@/services/usuariosService'
import {
    Externo,
    getAll as getAllExternos
} from '@/services/externosService'
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
    const [isFormDocumentoOpen, setIsFormDocumentoOpen] = useState(false)

    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [externos, setExternos] = useState<Externo[]>([])

    {/** Documentos - visualização */ }
    const [results, setResults] = useState<DocumentoExterno[]>([])
    const [selectedResult, setSelectedResult] = useState<DocumentoExterno>()
    const [deleteDocumentoId, setDeleteDocumentoId] = useState<number | null>(null);
    {/** Documentos - form */ }
    const [file, setFile] = useState<File | null>(null)
    const [openPopover, setOpenPopover] = useState<boolean>(false);

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


    {/** Set externos e usuarios */ }
    useEffect(() => {
        buscaUsuarios();
        buscaExternos();
    }, []);

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
        const snapshot = {
            dateFrom,
            dateTo,
            status: statusFiltrado
        }
        console.log('useeffect');

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { handleSearch(query, snapshot) }, 300)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [query, statusFiltrado, dateFrom, dateTo])

    const form = useForm<DocumentoExternoCreateDTO>({
        defaultValues: {
            assunto: '',
            id_externo: 0,
            arquivo: '',
            aprovadores: [],
        }
    })

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    async function buscaUsuarios() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllUsuarios()
            setUsuarios(dados)
        } catch (err) {
            setError((err as Error).message)
            setUsuarios([])
        } finally {
            setIsLoading(false)
        }
    }

    async function buscaExternos() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllExternos()
            setExternos(dados)
        } catch (err) {
            setError((err as Error).message)
            setExternos([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSearch(q: string, snapshot: {
        dateFrom: string,
        dateTo: string,
        status: string,
    }) {
        setIsLoading(true)
        setError(null)
        try {
            const data: DocumentoExternoFiltro = {
                dateFrom: snapshot?.dateFrom ?? dateFrom,
                dateTo: snapshot?.dateTo ?? dateTo,
                status: snapshot?.status ?? statusFiltrado,
                externo: false
            }
            const dados = await getAll(data);
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
            console.log('dateFrom' + dateFrom);
            console.log('dateTo' + dateTo);
            console.log('statusFiltrado' + statusFiltrado);
        }        
    }

    async function handleSearchClick() {
        const snapshot = {
            dateFrom,
            dateTo,
            status: statusFiltrado
        }
        console.log('handleSearchClick');
        console.log(isPending);
        startTransition(() => {
            const sp = new URLSearchParams(Array.from(searchParams.entries()))
            if (query) sp.set('q', query)
            else sp.delete('q')
            router.replace(`?${sp.toString()}`)
        })
        await handleSearch(query, snapshot)
    }

    async function refreshData(origem:string) {
        const snapshot = {
            dateFrom,
            dateTo,
            status: statusFiltrado
        }
        console.log('refreshData');
        console.log('origem:'+ origem);
        console.log(snapshot);
        await handleSearch(query, snapshot)
    }

    async function handleAprovacoes(data: DocumentoExterno) {
        setSelectedResult(data);
        setIsLoading(true)
        try {
            const dados = await getAllAprovadores(data.id);
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
            const arquivo = await getDocumento(data.id);
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
            await aprovar(id, aprovado)
            await refreshData('handleAprovar')
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleInserirDocumento() {
        form.reset({
            id_externo: 0,
            arquivo: '',
            assunto: '',
            aprovadores: [],
        })
        setIsFormDocumentoOpen(true)
    }

    async function handleExcluirDocumento() {
        if (!deleteDocumentoId) return
        try {
            await deleteElement(deleteDocumentoId)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Documento excluído`)
            setDeleteDocumentoId(null)
            await refreshData('handleExcluirDocumento')
        }
    }

    async function submitDocumento(data: DocumentoExternoCreateDTO) {
        if (!file) {
            toast.error("Arquivo não incluído!");
            return;
        }

        setIsLoading(true)
        setError(null)
        try {
            const base64 = await toBase64(file);
            data.arquivo = base64;
            await createElement(data)
            toast.success(`Registro enviado`)
            form.reset()
            await refreshData('submitDocumento')
            setIsFormDocumentoOpen(false)
        } catch (err) {
            toast.error((err as Error).message)
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
                                Documento {row.original.usuario_assinou && (
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

                            {row.original.pode_reprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original.id, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}

                            {row.original.pode_excluir && (<Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setDeleteDocumentoId(row.original.id); }}
                            >
                                Excluir
                            </Button>)}
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
            await assinarDocumento(dadosAssinatura);
            await refreshData('confirmarAssinatura')
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

                    <Button onClick={handleInserirDocumento} className="flex items-center">
                        <SquarePlus className="mr-1 h-4 w-4" /> Novo
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

            {/* Form documento */}
            <Dialog open={isFormDocumentoOpen} onOpenChange={setIsFormDocumentoOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            Novo documento
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitDocumento)} className="grid gap-4">
                            {/** Arquivo */}
                            <FormItem>
                                <FormLabel>Arquivo (PDF)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                    />
                                </FormControl>
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="assunto"
                                rules={{ required: 'Descrição é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Assunto</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name={`id_externo`}
                                rules={{ required: "Externo é obrigatório" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Externo</FormLabel>
                                        <FormControl>
                                            <Popover
                                                open={openPopover}
                                                onOpenChange={() => setOpenPopover(true)}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full justify-between"
                                                    >
                                                        {
                                                            externos.find(u => u.id === field.value)?.nome ??
                                                            "Selecione o externo"
                                                        }
                                                        <ChevronsUpDown className="opacity-50 size-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverPortal>
                                                    <PopoverContent
                                                        className="p-0 w-[250px] pointer-events-auto overflow-visible z-[9999]"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Command>
                                                            <CommandInput placeholder="Buscar usuário..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhum externo encontrado.</CommandEmpty>

                                                                <CommandGroup>
                                                                    {externos.map((u) => (
                                                                        <CommandItem
                                                                            key={u.id}
                                                                            value={`${u.id} ${u.nome}`}
                                                                            onSelect={() => {
                                                                                field.onChange(u.id)
                                                                                setOpenPopover(false)
                                                                            }}
                                                                        >
                                                                            {`${u.id} ${u.nome}`}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </PopoverPortal>
                                            </Popover>
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* --- Aprovadores (useFieldArray) --- */}
                            <AprovadoresSection form={form} usuarios={usuarios} />

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Confirmação de exclusão */}
            {deleteDocumentoId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir documento
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o documento #{deleteDocumentoId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteDocumentoId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluirDocumento}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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

function AprovadoresSection({ form, usuarios }: { form: UseFormReturn<DocumentoExternoCreateDTO>, usuarios: Usuario[] }) {
    const { control, register } = form;
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const { fields, append, remove } = useFieldArray({
        control,
        name: "aprovadores"
    });

    return (
        <div className="flex flex-col gap-2 border p-3 rounded-md">
            <label className="font-semibold">Aprovadores</label>

            {fields.map((field, index) => (
                <div
                    key={field.id}
                    className="grid grid-cols-3 gap-2 items-end border p-2 rounded"
                >
                    {/* Usuário (Select com busca) */}
                    <div className="flex flex-col">
                        <label>Usuário</label>

                        <FormField
                            control={form.control}
                            name={`aprovadores.${index}.usuario`}
                            rules={{ required: "Usuário obrigatório" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Popover
                                            open={openIndex === index}
                                            onOpenChange={(o) => setOpenIndex(o ? index : null)}
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-between"
                                                >
                                                    {
                                                        usuarios.find(u => u.codusuario === field.value)?.nome ??
                                                        "Selecione o usuário"
                                                    }
                                                    <ChevronsUpDown className="opacity-50 size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverPortal>
                                                <PopoverContent
                                                    className="p-0 w-[250px] pointer-events-auto overflow-visible z-[9999]"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Command>
                                                        <CommandInput placeholder="Buscar usuário..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>

                                                            <CommandGroup>
                                                                {usuarios.map((u) => (
                                                                    <CommandItem
                                                                        key={u.codusuario}
                                                                        value={`${u.codusuario} ${u.nome}`}
                                                                        onSelect={() => {
                                                                            field.onChange(u.codusuario)
                                                                            setOpenIndex(null)
                                                                        }}
                                                                    >
                                                                        {`${u.codusuario} ${u.nome}`}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </PopoverPortal>
                                        </Popover>
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>


                    {/* Nível */}
                    <div className="flex flex-col">
                        <label>Nível</label>
                        <Input
                            type="number"
                            {...register(`aprovadores.${index}.nivel`, {
                                required: "Ordem obrigatória",
                                valueAsNumber: true,
                            })}
                        />
                    </div>

                    {/* Remover */}
                    <Button
                        type="button"
                        onClick={() => remove(index)}
                        variant="destructive"
                    >
                        Remover
                    </Button>
                </div>
            ))}

            <Button
                type="button"
                variant="secondary"
                onClick={() => append({ usuario: "", nivel: 1 })}
            >
                + Adicionar aprovador
            </Button>
        </div>
    );
}
