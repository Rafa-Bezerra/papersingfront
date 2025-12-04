'use client'

declare global {
    interface Window {
        _pdfMessageListener?: boolean;
    }
}

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { Check, ChevronsUpDown, Filter, SearchIcon, SquarePlus, X } from 'lucide-react'

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
import { safeDateLabel, stripDiacritics, toBase64 } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { adicionarAprovador, aprovar, createElement, deleteElement, Documento, DocumentoAprovacao, DocumentoAssinar, getAll, updateElement } from '@/services/documentoService';
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
import {
    Usuario,
    getAll as getAllUsuarios
} from '@/services/usuariosService'
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

export default function Page() {
    const titulo = 'Documentos para Assinatura'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [userCodusuario, setCodusuario] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Documento[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<Documento>()
    const [requisicaoAprovacoesSelecionada, setRequisicaoAprovacoesSelecionada] = useState<DocumentoAprovacao[]>([])
    const [requisicaoDocumentoSelecionada, setRequisicaoDocumentoSelecionada] = useState<string>("")
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [isModalDocumentosOpen, setIsModalDocumentosOpen] = useState(false)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [coords, setCoords] = useState<{ x: number; y: number; x2: number; y2: number; yI: number } | null>(null);
    const [isFormDocumentoOpen, setIsFormDocumentoOpen] = useState(false)
    const [isFormAprovadoresOpen, setIsFormAprovadoresOpen] = useState(false)
    const [updateDocumentoMode, setUpdateDocumentoMode] = useState(false)
    const [deleteDocumentoId, setDeleteDocumentoId] = useState<number | null>(null);
    const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null);
    const [file, setFile] = useState<File | null>(null)
    const [usuarios, setUsuarios] = useState<Usuario[]>([])

    const form = useForm<Documento>({
        defaultValues: {
            id: 0,
            data_prazo: '',
            anexo: '',
            nome: '',
            aprovadores: []
        }
    })

    const formAprovadores = useForm<DocumentoAprovacao>({
        defaultValues: {
            id: 0,
            usuario: '',
            data_aprovacao: '',
            aprovacao: '',
            ordem: 1,
        }
    })

    function changePage(newPage: number) {
        if (!iframeRef.current) return;
        setCurrentPage(newPage);
        iframeRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    const carregou = useRef(false)
    useEffect(() => {
        if (carregou.current) return;
        buscaUsuarios();
    }, [])

    async function buscaUsuarios() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllUsuarios()
            setUsuarios(dados)
            carregou.current = true;
        } catch (err) {
            setError((err as Error).message)
            setUsuarios([])
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (dateFrom === "" && dateTo === "") {
            setDateFrom(new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().substring(0, 10));
            setDateTo(new Date().toISOString().substring(0, 10));
        }
        const storedUser = localStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserName(user.nome.toUpperCase());
            setCodusuario(user.codusuario.toUpperCase());
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            startTransition(() => {
                const sp = new URLSearchParams(Array.from(searchParams.entries()))
                if (query) sp.set('q', query)
                else sp.delete('q')
                router.replace(`?${sp.toString()}`)
            })
            handleSearch(query)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, situacaoFiltrada, dateFrom, dateTo])


    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAll()
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const matchQuery = qNorm === "" || String(d.nome ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.situacao == situacaoFiltrada
                return matchQuery && matchSituacao
            })

            setResults(filtrados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
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

    async function handleDocumento(requisicao: Documento) {
        setIsLoading(true)
        setTotalPages(1);
        setIsModalDocumentosOpen(true)
        setRequisicaoSelecionada(requisicao)
        const arquivoBase64 = requisicao.anexo;
        setRequisicaoDocumentoSelecionada(arquivoBase64);

        if (!window._pdfMessageListener) {
            window._pdfMessageListener = true;

            window.addEventListener("message", (event) => {
                if (event.data?.totalPages) {
                    setTotalPages(event.data.totalPages);
                }
            });
        }

        setTimeout(() => {
            iframeRef.current?.contentWindow?.postMessage(
                { pdfBase64: arquivoBase64 },
                '*'
            );
        }, 500);
        setIsLoading(false)
    }

    function handleClickPdf(e: React.MouseEvent<HTMLDivElement>) {
        const overlay = e.currentTarget as HTMLDivElement;
        const rect = overlay.getBoundingClientRect();

        const x = (e.clientX - rect.left) / rect.width;  // 0 a 1
        const y = (e.clientY - rect.top) / rect.height;  // 0 a 1        
        const x2 = e.clientX - rect.left;
        const y2 = e.clientY - rect.top;
        const yI = (rect.height - y2) / rect.height;

        setCoords({ x, y, x2, y2, yI });
    }

    async function confirmarAssinatura() {
        setIsLoading(true)
        if (!coords) {
            toast.error("Clique no local onde deseja assinar o documento.");
            return;
        }
        try {
            const dadosAssinatura: DocumentoAssinar = {
                id: requisicaoSelecionada!.id,
                anexo: requisicaoSelecionada!.anexo,
                pagina: currentPage,
                posX: coords.x,
                posY: coords.yI,
                largura: 90,
                altura: 30,
            };
            await updateElement(dadosAssinatura);
            handleSearchClick()
            toast.success("Documento assinado com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalDocumentosOpen(false)
            setIsLoading(false)
        }
    }

    function handleImprimir() {
        if (!iframeRef.current) return;

        const iframe = iframeRef.current as HTMLIFrameElement;
        const iframeWindow = iframe.contentWindow;

        if (iframeWindow) {
            iframeWindow.focus();
            iframeWindow.print();
        } else {
            toast.error("Não foi possível acessar o documento para impressão.");
        }
    }

    async function handleAprovacoes(requisicao: Documento) {
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.aprovadores)
    }

    async function handleAprovar(id: number, aprovado: number) {
        setIsLoading(true)
        try {
            await aprovar(id, aprovado)
            handleSearchClick()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleInserirDocumento() {
        form.reset({
            id: 0,
            data_prazo: '',
            anexo: '',
            nome: '',
            aprovadores: []
        })
        setUpdateDocumentoMode(false)
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
            await handleSearchClick()
        }
    }

    async function submitDocumento(data: Documento) {
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        data.anexo = base64;
        setError(null)
        try {
            await createElement(data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            form.reset()
            await handleSearchClick()
            setIsFormDocumentoOpen(false)
        }
    }

    async function handleInserirAprovador() {
        formAprovadores.reset({
            id: 0,
            usuario: '',
            ordem: 1
        })
        setIsFormAprovadoresOpen(true)
    }

    async function handleExcluirAprovador() {
        if (!deleteAprovadorId) return
        try {
            await deleteElement(deleteAprovadorId)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Aprovador excluído`)
            setDeleteAprovadorId(null)
            await handleSearchClick()
        }
    }

    async function submitAprovador(data: DocumentoAprovacao) {
        setError(null)
        try {
            await adicionarAprovador(requisicaoSelecionada!.id, data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            formAprovadores.reset()
            setIsFormAprovadoresOpen(false)
            setIsModalAprovacoesOpen(false)
            await handleSearchClick()
        }
    }

    const colunas = useMemo<ColumnDef<Documento>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Descrição' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'data_prazo', header: 'Data prazo', accessorFn: (row) => safeDateLabel(row.data_prazo) },
            { accessorKey: 'situacao', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const usuarioAprovador = row.original.aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );

                    const usuarioCriador = row.original.usuario_criacao.toLowerCase().trim() === userCodusuario.toLowerCase().trim();

                    const nivelUsuario = row.original.aprovadores.find(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    )?.ordem ?? 1;

                    const todasInferioresAprovadas = nivelUsuario == 1 || (row.original.aprovadores.filter(ap => ap.ordem < (nivelUsuario)).every(ap => ap.aprovacao === 'A'));

                    // const usuarioAprovou = row.original.aprovadores.some(ap =>
                    //     stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    // );
                    const usuarioAprovou = false;
                    const todasPendentes = row.original.aprovadores.every(ap => ap.aprovacao === 'P');

                    const status_liberado = ['Em Andamento'].includes(row.original.situacao);

                    const podeAprovar = todasInferioresAprovadas && (usuarioAprovador || usuarioCriador) && !usuarioAprovou && status_liberado;
                    const podeReprovar = todasInferioresAprovadas && (usuarioAprovador || usuarioCriador) && !usuarioAprovou && status_liberado;
                    const podeExcluir = usuarioCriador && todasPendentes;

                    return (
                        <div className="flex gap-2">
                            {row.original.anexo && (
                                <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                    Documento {row.original.documento_assinado == 1 && (
                                        <Check className="w-4 h-4 text-green-500" />
                                    )}
                                </Button>
                            )}

                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original.id, 1)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeReprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original.id, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}
                            {podeExcluir && (<Button
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
        [userName]
    )

    const colunasAprovacoes = useMemo<ColumnDef<DocumentoAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario', header: 'Usuário' },
            { accessorKey: 'ordem', header: 'Ordem' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) }
        ],
        []
    )

    return (
        <div className="p-6">
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    <div className="flex justify-end items-end gap-4">
                        {/* Botão de Filtros - Dropdown com checkboxes */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Filtros</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"Em Andamento"} checked={situacaoFiltrada == "Em Andamento"} onCheckedChange={() => setSituacaoFiltrada("Em Andamento")}>Em Andamento</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Aprovados"} checked={situacaoFiltrada == "Aprovados"} onCheckedChange={() => setSituacaoFiltrada("Aprovados")}>Aprovados</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Reprovados"} checked={situacaoFiltrada == "Reprovados"} onCheckedChange={() => setSituacaoFiltrada("Reprovados")}>Reprovados</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={() => setSituacaoFiltrada("")}>Todos</DropdownMenuCheckboxItem>
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

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Aprovações */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${requisicaoSelecionada.id}`}</DialogTitle>
                            <Button onClick={handleInserirAprovador} className="flex items-center">
                                <SquarePlus className="mr-1 h-4 w-4" /> Novo aprovador
                            </Button>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={requisicaoAprovacoesSelecionada} loading={loading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Documento */}
            {requisicaoSelecionada && (
                <Dialog open={isModalDocumentosOpen} onOpenChange={setIsModalDocumentosOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Documento movimentação n° ${requisicaoSelecionada.id}`}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex justify-center bg-gray-50">
                            {requisicaoDocumentoSelecionada ? (
                                <>
                                    {/* PDF sem overflow interno */}
                                    <iframe
                                        ref={iframeRef}
                                        src="/pdf-viewer.html"
                                        className="relative border-none  cursor-crosshair"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            maxWidth: '800px',
                                            aspectRatio: '1/sqrt(2)', // Proporção A4
                                        }}
                                        onClick={handleClickPdf}
                                    />

                                    {/* Overlay */}
                                    <div
                                        id="assinatura-overlay"
                                        className="absolute inset-0 cursor-crosshair"
                                        onClick={handleClickPdf}
                                    />

                                    {/* Indicador visual */}
                                    {coords && (
                                        <div
                                            className="absolute w-5 h-5 bg-blue-500/40 border-2 border-blue-700 rounded-full pointer-events-none"
                                            style={{
                                                left: coords.x2 - 10,
                                                top: coords.y2 - 10,
                                            }}
                                        />
                                    )}
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
                            {(requisicaoSelecionada.documento_assinado == 0 && <Button onClick={confirmarAssinatura} className="flex items-center">
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

            {/* Modal Documento */}
            <Dialog open={isFormDocumentoOpen} onOpenChange={setIsFormDocumentoOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateDocumentoMode ? `Editar: ${requisicaoSelecionada?.nome}` : `Novo documento`}
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitDocumento)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="nome"
                                rules={{ required: 'Descrição é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="data_prazo"
                                rules={{ required: 'Prazo é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prazo</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="anexo"
                                rules={{ required: 'Anexo é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Anexo (PDF)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] ?? null
                                                    field.onChange(file) // notifica o React Hook Form
                                                    setFile(file) // mantém o estado local, se quiser enviar depois
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* --- Aprovadores (useFieldArray) --- */}
                            <AprovadoresSection form={form} usuarios={usuarios} />

                            <Button type="submit" disabled={loading}>
                                {loading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal */}
            <Dialog open={isFormAprovadoresOpen} onOpenChange={setIsFormAprovadoresOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            Novo aprovador
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={formAprovadores.handleSubmit(submitAprovador)} className="grid gap-4">
                            <FormField
                                control={formAprovadores.control}
                                name="usuario"
                                rules={{ required: 'usuário é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usuário</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={formAprovadores.control}
                                name="ordem"
                                rules={{ required: 'Ordem é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ordem</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" disabled={loading}>
                                {loading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Confirmação de exclusão (simples) */}
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

            {/* Confirmação de exclusão (simples) */}
            {deleteAprovadorId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir aprovador
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o aprovador #{deleteAprovadorId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteAprovadorId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluirAprovador}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <p className="mb-4 text-center text-sm text-destructive">
                    Erro: {error}
                </p>
            )}

            {!searched && (
                <div className="grid gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                    ))}
                </div>
            )}

            {searched && results.length === 0 && !loading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                </p>
            )}
        </div>
    )
}

function AprovadoresSection({ form, usuarios }: { form: UseFormReturn<Documento>, usuarios: Usuario[] }) {
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
                                                                        value={u.codusuario}
                                                                        onSelect={() => {
                                                                            field.onChange(u.codusuario)
                                                                            setOpenIndex(null)
                                                                        }}
                                                                    >
                                                                        {u.nome}
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


                    {/* Ordem */}
                    <div className="flex flex-col">
                        <label>Ordem</label>
                        <Input
                            type="number"
                            {...register(`aprovadores.${index}.ordem`, {
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
                onClick={() => append({ usuario: "", ordem: fields.length + 1 })}
            >
                + Adicionar aprovador
            </Button>
        </div>
    );
}
