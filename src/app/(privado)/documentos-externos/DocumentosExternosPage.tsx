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
import { Bell, Check, ChevronsUpDown, Filter, SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'

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
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog'
import { DocumentoExterno, DocumentoExternoAprovador, DocumentoExternoAssinar, DocumentoExternoCreateDTO, DocumentoExternoFiltro, aprovar, assinarDocumento, createElement, deleteElement, getAll, getAllAprovadores, getDocumento } from '@/services/documentoExternoService'
import { notificarAprovador } from '@/services/requisicoesService'
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


    {/** Set externos e usuarios */ }
    useEffect(() => {
        buscaUsuarios();
        buscaExternos();
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

    async function handleNotificarAprovador(usuario: string) {
        if (!selectedResult) return
        try {
            const msg = await notificarAprovador(
                selectedResult.id,
                0,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const colunasAprovacoes = useMemo<ColumnDef<DocumentoExternoAprovador>[]>(
        () => [
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'nivel', header: 'Nível' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao != null ? String(row.data_aprovacao) : null) },
            {
                id: 'actions',
                header: '',
                cell: ({ row }) => row.original.aprovacao !== 'A' ? (
                    <Button
                        size="sm"
                        variant="outline"
                        title="Notificar aprovador por e-mail"
                        onClick={() => handleNotificarAprovador(row.original.usuario)}
                    >
                        <Bell className="w-4 h-4" />
                    </Button>
                ) : null
            }
        ],
        [handleNotificarAprovador]
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
                    <div className="relative flex-1 w-full">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                    scrollBody={false}
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
                <DialogContent className="max-w-2xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                    className="flex items-end gap-2 border p-2 rounded"
                >
                    {/* Usuário (Select com busca) */}
                    <div className="flex flex-col flex-1 min-w-0">
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
                                                    className="w-full justify-between min-w-0"
                                                >
                                                    <span className="truncate">
                                                        {
                                                            usuarios.find(u => u.codusuario === field.value)?.nome ??
                                                            "Selecione o usuário"
                                                        }
                                                    </span>
                                                    <ChevronsUpDown className="opacity-50 size-4 shrink-0" />
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
                    <div className="flex flex-col w-20 shrink-0">
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
                        size="icon"
                        className="shrink-0"
                    >
                        <Trash2 className="w-4 h-4" />
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
