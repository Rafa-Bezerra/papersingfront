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
import { Bell, Check, ChevronsUpDown, Eye, Filter, SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'

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
import { imprimirPdfBase64, safeDateLabel, safeDateLabelAprovacao, stripDiacritics, toBase64 } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { adicionarAprovador, aprovar, assinar, createElement, deleteElement, Documento, DocumentoAprovacao, getAll, getAnexo } from '@/services/documentoService';
import { notificarAprovador } from '@/services/requisicoesService';
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
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog';
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'


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
    // Valores retornados pela API: 'EM ANDAMENTO' | 'APROVADO' | 'REPROVADO'
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
    const [anexoSelecionado, setAnexoSelecionado] = useState<DocumentoAnexo | null>(null)
    const [isDocumentoPrincipal, setDocumentoPrincipal] = useState(false)
    const [anexoPdfBase64ParaAssinatura, setAnexoPdfBase64ParaAssinatura] = useState<string | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const [anexosSubmit, setAnexosSubmit] = useState<DocumentoAnexo[]>([])
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [solicitantes, setSolicitantes] = useState<string[]>([])
    const [openUsuarioAprovadorSearch, setOpenUsuarioAprovadorSearch] = useState(false)

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
    }, [query, situacaoFiltrada, dateFrom, dateTo, solicitanteFiltrado])


    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAll()

            const solicitantesUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.usuario_nome)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setSolicitantes(solicitantesUnicos)

            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const nomeNorm = stripDiacritics(String(d.nome ?? '').toLowerCase())
                const situacaoNorm = stripDiacritics(String(d.situacao ?? '').toUpperCase().trim())
                const filtroSituacaoNorm = stripDiacritics(String(situacaoFiltrada ?? '').toUpperCase().trim())

                const matchQuery = qNorm === "" || nomeNorm.includes(qNorm) || String(d.id ?? '').includes(qNorm)
                const matchSituacao = filtroSituacaoNorm === "" || situacaoNorm === filtroSituacaoNorm
                const usuarioAprovador = d.aprovadores.some(
                    ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                );
                const matchSolicitante = solicitanteFiltrado === "" || d.usuario_nome == solicitanteFiltrado
                // Regra: pendências ("EM ANDAMENTO") sempre aparecem, independente do período.
                const isPendente = situacaoNorm === "EM ANDAMENTO"
                const matchDateFrom = isPendente || dateFrom === "" || new Date(d.data_criacao) >= new Date(dateFrom)
                const matchDateTo = isPendente || dateTo === "" || new Date(d.data_criacao) <= new Date(dateTo + "T23:59:59")
                return matchQuery && matchSituacao && (usuarioAprovador || d.usuario_criacao == userCodusuario) && matchSolicitante && matchDateFrom && matchDateTo
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
        setIsModalAnexosOpen(true)
        setRequisicaoSelecionada(requisicao)
        setSelectedAnexosResult((requisicao.anexos ?? []).filter((a) => a.documento_principal != true))
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
            if (!data.aprovadores.some(a => a.usuario === userCodusuario)) {
                data.aprovadores = [
                    { usuario: userCodusuario, ordem: 1 },
                    ...data.aprovadores
                ];
            }
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
            nome: fileName,
            documento_principal: isDocumentoPrincipal
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setFile(null)
        setFileName("")
        setDocumentoPrincipal(false)
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleVisualizarAnexo(anexo: DocumentoAnexo) {
        setIsLoading(true)
        try {
            let arquivo: string;
            if (anexo.anexo.startsWith('data:') || anexo.anexo.length > 500) {
                // Já é base64 (anexo local adicionado no formulário, ainda não salvo)
                arquivo = anexo.anexo;
            } else {
                // É um caminho de servidor; faz o download
                arquivo = await getAnexo(anexo.anexo);
            }
            setAnexoSelecionado(anexo);
            setAnexoPdfBase64ParaAssinatura(arquivo);
            setIsModalVisualizarAnexoOpen(true)
        } catch (err) {
            console.log(err);
            toast.error("Não foi possível carregar o anexo.");
        } finally {
            setIsLoading(false)
        }
    }

    function handleImprimirAnexo() {
        if (!anexoPdfBase64ParaAssinatura) return;
        let base64 = anexoPdfBase64ParaAssinatura.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
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

    async function confirmarAssinaturaAnexo({ page, posX, posY, largura, altura }: PdfSignData) {
        const pdfBase64 = anexoPdfBase64ParaAssinatura ?? anexoSelecionado?.anexo;
        if (!pdfBase64) {
            toast.error("Documento não carregado. Feche e abra o anexo novamente antes de assinar.");
            return;
        }
        const dadosAssinatura: DocumentoAnexoAssinar = {
            id: anexoSelecionado!.id,
            anexo: pdfBase64,
            pagina: page,
            posX,
            posY,
            largura,
            altura,
        };
        await handleAssinarAnexo(dadosAssinatura);
    }

    const colunas = useMemo<ColumnDef<Documento>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'usuario_nome', header: 'Solicitante' },
            { accessorKey: 'nome', header: 'Descrição' },
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

                    const anexoPrincipal = row.original.anexos?.filter(a => a.documento_principal === true)[0];

                    return (
                        <div className="flex gap-2">
                            {anexoPrincipal && (<Button size="sm" variant="outline" onClick={() => handleVisualizarAnexo(anexoPrincipal)}>
                                Documento {anexoPrincipal.documento_assinado == 1 && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>)}

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

    async function handleNotificarAprovador(usuario: string) {
        if (!requisicaoSelecionada) return
        try {
            const msg = await notificarAprovador(
                requisicaoSelecionada.id,
                0,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const colunasAprovacoes = useMemo<ColumnDef<DocumentoAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario_nome', header: 'Usuário' },
            { accessorKey: 'ordem', header: 'Ordem' },
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
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    <div className="flex flex-wrap justify-end items-end gap-3">
                        {/* Data de */}
                        <div className="flex flex-col">
                            <Label htmlFor="docDateFrom">Data de</Label>
                            <Input
                                id="docDateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Data até */}
                        <div className="flex flex-col">
                            <Label htmlFor="docDateTo">Data até</Label>
                            <Input
                                id="docDateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Solicitante */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Filtrar por solicitante">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Solicitante</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Solicitante</DropdownMenuLabel>
                                {solicitantes.map((s) => (
                                    <DropdownMenuCheckboxItem
                                        key={s}
                                        checked={solicitanteFiltrado === s}
                                        onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado(s) }}
                                    >
                                        {s}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuCheckboxItem checked={solicitanteFiltrado === ""} onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                <DropdownMenuCheckboxItem
                                    key={"EM ANDAMENTO"}
                                    checked={situacaoFiltrada == "EM ANDAMENTO"}
                                    onCheckedChange={() => setSituacaoFiltrada("EM ANDAMENTO")}
                                >
                                    Em Andamento
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    key={"APROVADO"}
                                    checked={situacaoFiltrada == "APROVADO"}
                                    onCheckedChange={() => setSituacaoFiltrada("APROVADO")}
                                >
                                    Aprovados
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    key={"REPROVADO"}
                                    checked={situacaoFiltrada == "REPROVADO"}
                                    onCheckedChange={() => setSituacaoFiltrada("REPROVADO")}
                                >
                                    Reprovados
                                </DropdownMenuCheckboxItem>
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                <DialogContent className="max-w-2xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <Label>Arquivo</Label>
                                    <Input
                                        type="file"
                                        accept="application/pdf/*"
                                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label>Descrição do anexo</Label>
                                    <Input
                                        type="text"
                                        value={fileName}
                                        onChange={(e) => setFileName(e.target.value)}
                                        aria-label='Descrição do anexo'
                                        placeholder='Descrição do anexo'
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={isDocumentoPrincipal}
                                        onCheckedChange={(value) => setDocumentoPrincipal(!!value)}
                                    />
                                    <Label>Documento principal</Label>
                                </div>
                                <Button
                                    onClick={handleSubmitAnexos}
                                    disabled={!file || isLoading || !fileName?.trim()}
                                    className="flex items-center"
                                >
                                    {isLoading ? "Enviando..." : "Anexar documento"}
                                </Button>
                            </div>
                            {anexosSubmit.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                                    <span>{item.nome}{item.documento_principal ? ' - Documento principal' : ''}</span>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="destructive" size="icon" onClick={() => removerAnexo(i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="icon"
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
                <DialogContent className="max-w-2xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                                            <Popover open={openUsuarioAprovadorSearch} onOpenChange={setOpenUsuarioAprovadorSearch}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full justify-between"
                                                    >
                                                        {field.value
                                                            ? `${field.value} - ${usuarios.find(u => u.codusuario === field.value)?.nome ?? ''}`
                                                            : 'Selecione o usuário'}
                                                        <ChevronsUpDown className="opacity-50 size-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverPortal>
                                                    <PopoverContent
                                                        className="p-0 w-[400px] pointer-events-auto z-[9999]"
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
                                                                                setOpenUsuarioAprovadorSearch(false)
                                                                            }}
                                                                        >
                                                                            {u.codusuario} - {u.nome}
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
                <PdfViewerDialog
                    open={isModalVisualizarAnexoOpen}
                    onOpenChange={(open) => { if (!open) setAnexoPdfBase64ParaAssinatura(null); setIsModalVisualizarAnexoOpen(open); }}
                    title={`Anexo ${anexoSelecionado.nome}`}
                    pdfBase64={anexoPdfBase64ParaAssinatura}
                    canSign={anexoSelecionado.documento_assinado == 0}
                    onSign={confirmarAssinaturaAnexo}
                    onPrint={handleImprimirAnexo}
                    isLoading={isLoading}
                />
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
                <div key={field.id} className="flex items-end gap-2 border p-2 rounded">
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


                    {/* Ordem */}
                    <div className="flex flex-col w-20 shrink-0">
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
                onClick={() => append({ usuario: "", ordem: fields.length + 1 })}
            >
                + Adicionar aprovador
            </Button>
        </div>
    );
}
