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
import { Check, ChevronsUpDown, Eye, Filter, Search, SearchIcon, SquarePlus, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'

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
import { adicionarAprovador, aprovar, assinar, createElement, deleteElement, Documento, DocumentoAprovacao, getAll, getAnexo } from '@/services/documentoService';
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
import { DocumentoAnexo, DocumentoAnexoAssinar } from '@/types/Documento';
import { getPdfClickCoords, getSignaturePreviewStyle, handlePdfOverlayWheel, PdfClickCoords, PdfViewport } from "@/utils/pdfCoords";

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
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const [isFormDocumentoOpen, setIsFormDocumentoOpen] = useState(false)
    const [isFormAprovadoresOpen, setIsFormAprovadoresOpen] = useState(false)
    const [updateDocumentoMode, setUpdateDocumentoMode] = useState(false)
    const [deleteDocumentoId, setDeleteDocumentoId] = useState<number | null>(null);
    const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null);
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [selectedAnexosResult, setSelectedAnexosResult] = useState<DocumentoAnexo[]>([])
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [currentPageAnexo, setCurrentPageAnexo] = useState(1);
    const [totalPagesAnexo, setTotalPagesAnexo] = useState<number | null>(null);
    const [anexoSelecionado, setAnexoSelecionado] = useState<DocumentoAnexo | null>(null)
    /** Base64 do PDF do anexo (vindo de getAnexo). Enviado na assinatura; anexo.anexo é só o caminho. */
    const [anexoPdfBase64ParaAssinatura, setAnexoPdfBase64ParaAssinatura] = useState<string | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [anexosSubmit, setAnexosSubmit] = useState<DocumentoAnexo[]>([])
    const [coordsAnexo, setCoordsAnexo] = useState<PdfClickCoords | null>(null);
    const [signatureCoordsAnexo, setSignatureCoordsAnexo] = useState<PdfClickCoords | null>(null);
    const [previewCoordsAnexo, setPreviewCoordsAnexo] = useState<PdfClickCoords | null>(null);
    const [isPreviewAnexoLocked, setIsPreviewAnexoLocked] = useState(false);
    const [pdfViewportAnexo, setPdfViewportAnexo] = useState<PdfViewport | null>(null);
    const [zoom, setZoom] = useState(1.5);
    const pdfAnexoStyle = pdfViewportAnexo
        ? { width: `${pdfViewportAnexo.width}px`, height: `${pdfViewportAnexo.height}px` }
        : { width: '100%', height: '100%', maxWidth: '800px', aspectRatio: '1/sqrt(2)' };

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source === iframeRef.current?.contentWindow) {
                if (event.data?.totalPages) {
                    setTotalPagesAnexo(event.data.totalPages);
                }
                if (event.data?.pdfViewport) {
                    setPdfViewportAnexo({
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

    const form = useForm<Documento>({
        defaultValues: {
            id: 0,
            nome: '',
            aprovadores: [],
            anexos: []
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
        const storedUser = sessionStorage.getItem("userData");
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
            setIsLoading(isPending)
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
                const usuarioAprovador = d.aprovadores.some(
                    ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                );
                return matchQuery && matchSituacao && usuarioAprovador
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

    async function handleAprovacoes(requisicao: Documento) {
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.aprovadores)
    }

    async function handleAnexos(requisicao: Documento) {
        console.log('requisicao', requisicao);
        setIsModalAnexosOpen(true)
        setRequisicaoSelecionada(requisicao)
        setSelectedAnexosResult(requisicao.anexos)
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
            nome: '',
            aprovadores: [],
            anexos: []
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
        setIsLoading(true)
        setError(null)
        try {
            data.anexos = anexosSubmit;
            await createElement(data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            form.reset()
            await handleSearchClick()
            setIsFormDocumentoOpen(false)
            setIsLoading(false)
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

    async function handleSubmitAnexos() {
        setIsLoading(true)
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: DocumentoAnexo = {
            anexo: base64,
            nome: fileName
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleVisualizarAnexo(anexo: DocumentoAnexo) {
        setIsLoading(true)
        try {
            // anexo.anexo é o caminho (ex: /anexos/documentos/xxx); getAnexo retorna o PDF em base64
            const arquivo = await getAnexo(anexo.anexo);
            const pdfClean = arquivo.replace(/^data:.*;base64,/, '').trim();
            
            setIsModalVisualizarAnexoOpen(true)
            setAnexoSelecionado(anexo);
            setAnexoPdfBase64ParaAssinatura(arquivo); // guarda para enviar na assinatura (evita "Base64 do PDF inválido")
            setCurrentPageAnexo(1);
            setTotalPagesAnexo(null);
            setCoordsAnexo(null);
            setSignatureCoordsAnexo(null);
            setPreviewCoordsAnexo(null);
            setIsPreviewAnexoLocked(false);
            setPdfViewportAnexo(null);

            setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                    { pdfBase64: pdfClean },
                    '*'
                );
            }, 500);
            setZoom(1.5);
        } catch (err) {
            console.log(err);
            toast.error("Não foi possível carregar o anexo.");
        } finally {
            setIsLoading(false)
        }
    }

    function changePageAnexo(newPage: number) {
        if (!iframeRef.current) return;
        setCurrentPageAnexo(newPage);
        iframeRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    function handleImprimirAnexo() {
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

    async function handleAssinarAnexo(data: DocumentoAnexoAssinar) {
        setIsLoading(true)
        setSearched(false)
        try {
            await assinar(data)
            toast.success("Assinatura enviada com sucesso!");
            handleSearchClick()
            handleAnexos(requisicaoSelecionada!)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalVisualizarAnexoOpen(false)
            setAnexoPdfBase64ParaAssinatura(null)
            setSearched(true)
            setIsLoading(false)
        }
    }

    function handleClickPdfAnexo(e: React.MouseEvent<HTMLDivElement>) {
        const nextCoords = getPdfClickCoords(e, pdfViewportAnexo);
        setCoordsAnexo(nextCoords);
        setSignatureCoordsAnexo(nextCoords);
        setPreviewCoordsAnexo(null);
        setIsPreviewAnexoLocked(true);
    }

    function handleHoverPdfAnexo(e: React.MouseEvent<HTMLDivElement>) {
        if (isPreviewAnexoLocked) return;
        setPreviewCoordsAnexo(getPdfClickCoords(e, pdfViewportAnexo));
    }

    async function confirmarAssinaturaAnexo() {
        if (!coordsAnexo) {
            toast.error("Clique no local onde deseja assinar o documento.");
            return;
        }
        // Backend espera base64 do PDF; anexoSelecionado.anexo é só caminho — usar base64 guardado ao abrir o anexo
        const pdfBase64 = anexoPdfBase64ParaAssinatura ?? anexoSelecionado?.anexo;
        if (!pdfBase64) {
            toast.error("Documento não carregado. Feche e abra o anexo novamente antes de assinar.");
            return;
        }
        const dadosAssinatura: DocumentoAnexoAssinar = {
            id: anexoSelecionado!.id,
            anexo: pdfBase64,
            pagina: currentPageAnexo,
            posX: coordsAnexo.x,
            posY: coordsAnexo.yI,
            largura: 90,
            altura: 30,
        };
        await handleAssinarAnexo(dadosAssinatura);
    }

    function handleZoomIn() {
        if (!iframeRef.current) return;
        const newZoom = Math.min(5, zoom + 0.25);
        setZoom(newZoom);
        iframeRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomOut() {
        if (!iframeRef.current) return;
        const newZoom = Math.max(0.5, zoom - 0.25);
        setZoom(newZoom);
        iframeRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    const colunas = useMemo<ColumnDef<Documento>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Descrição' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
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

                    const usuarioAprovou = row.original.aprovadores.some(ap =>
                        stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    );

                    const todasPendentes = row.original.aprovadores.every(ap => ap.aprovacao === 'P');

                    const status_liberado = ['EM ANDAMENTO'].includes(row.original.situacao);
                    const assinouOuSemAnexos = (row.original.anexos?.length ?? 0) === 0 || row.original.anexos?.some(a => a.documento_assinado === 1);
                    const podeAprovar = todasInferioresAprovadas && usuarioAprovador && !usuarioAprovou && status_liberado && assinouOuSemAnexos;
                    const podeExcluir = usuarioCriador && todasPendentes;

                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos
                            </Button>

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

                            {podeAprovar && (
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
            { accessorKey: 'usuario_nome', header: 'Usuário' },
            { accessorKey: 'ordem', header: 'Ordem' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao != null ? String(row.data_aprovacao) : null) }
        ],
        []
    )

    const colunasAnexos = useMemo<ColumnDef<DocumentoAnexo>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVisualizarAnexo(row.original)}
                        >
                            Visualizar {row.original.documento_assinado == 1 && (
                                <Check className="w-4 h-4 text-green-500" />
                            )}
                        </Button>
                    </div>
                )
            }
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Header */}
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

            {/* Main */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
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
                            <DataTable columns={colunasAprovacoes} data={requisicaoAprovacoesSelecionada} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Anexos */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${requisicaoSelecionada.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={selectedAnexosResult} loading={isLoading} />
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
                            {updateDocumentoMode ? `Editar: ${requisicaoSelecionada?.nome}` : `Novo documento`}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Anexos */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Anexos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    type="file"
                                    accept="application/pdf/*"
                                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                    className="w-40"
                                />
                                <Input
                                    type="text"
                                    onChange={(e) => setFileName(e.target.value)}
                                    className="w-40"
                                    aria-label='Descrição do anexo'
                                    placeholder='Descrição do anexo'
                                />
                                <Button
                                    onClick={handleSubmitAnexos}
                                    disabled={!file || isLoading}
                                    className="flex items-center"
                                >
                                    {isLoading ? "Enviando..." : "Anexar documento"}
                                </Button>
                            </div>
                            {anexosSubmit.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                                    <span>{item.nome}</span>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="destructive" size="icon" onClick={() => removerAnexo(i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleVisualizarAnexo(item)}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

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

                            {/* --- Aprovadores (useFieldArray) --- */}
                            <AprovadoresSection form={form} usuarios={usuarios} />

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>


                </DialogContent>
            </Dialog>

            {/* Form aprovadores */}
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

            {/* Confirmação de exclusão aprovadores */}
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

            {/* Visualizar anexo */}
            {anexoSelecionado && (
                <Dialog open={isModalVisualizarAnexoOpen} onOpenChange={(open) => { if (!open) setAnexoPdfBase64ParaAssinatura(null); setIsModalVisualizarAnexoOpen(open); }}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Anexo ${anexoSelecionado.nome}`}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex-1 overflow-auto flex justify-center bg-gray-50" data-pdf-scroll="true">
                            {anexoSelecionado ? (
                                <>
                                    <div className="relative" style={pdfAnexoStyle}>
                                        {/* PDF */}
                                        <iframe
                                            ref={iframeRef}
                                            src="/pdf-viewer.html"
                                            className="relative border-none cursor-default"
                                            style={pdfAnexoStyle}
                                        />

                                        {/* Overlay */}
                                        <div
                                            id="assinatura-overlay"
                                            className="absolute inset-0 cursor-default"
                                            onClick={handleClickPdfAnexo}
                                            onMouseMove={handleHoverPdfAnexo}
                                            onMouseLeave={() => {
                                                if (!isPreviewAnexoLocked) setPreviewCoordsAnexo(null);
                                            }}
                                            onWheel={handlePdfOverlayWheel}
                                        />

                                        {/* Pré-visualização da assinatura */}
                                        {!isPreviewAnexoLocked && previewCoordsAnexo && (
                                            <div
                                                className="absolute border-2 border-blue-600/70 bg-blue-500/10 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(previewCoordsAnexo, pdfViewportAnexo) ?? undefined}
                                            />
                                        )}
                                        {signatureCoordsAnexo && (
                                            <div
                                                className="absolute border-2 border-blue-700 bg-blue-500/15 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(signatureCoordsAnexo, pdfViewportAnexo) ?? undefined}
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
                                disabled={currentPageAnexo <= 1}
                                onClick={() => changePageAnexo(currentPageAnexo - 1)}
                            >
                                Anterior
                            </Button>
                            <span>
                                Página {currentPageAnexo}
                                {totalPagesAnexo ? ` / ${totalPagesAnexo}` : ""}
                            </span>
                            <Button
                                disabled={currentPageAnexo >= (totalPagesAnexo == null ? 1 : totalPagesAnexo)}
                                onClick={() => changePageAnexo(currentPageAnexo + 1)}
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
                            {(anexoSelecionado.documento_assinado == 0 && <Button onClick={confirmarAssinaturaAnexo} className="flex items-center">
                                Assinar
                            </Button>)}
                            <Button
                                variant="outline"
                                onClick={() => handleImprimirAnexo()}
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

            {!searched && (
                <div className="grid gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                    ))}
                </div>
            )}

            {searched && results.length === 0 && !isLoading && !error && (
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
