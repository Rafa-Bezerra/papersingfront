'use client'

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { NumericFormat } from "react-number-format";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { ChevronsUpDown, Eye, Loader2, Trash2, ZoomIn, ZoomOut, Search } from "lucide-react";
import { CentroDeCusto, ContaFinanceira, getAllCentrosDeCusto, getAllContasFinanceiras, getAllProdutos, Produto } from '@/services/carrinhoService';
import { AnexoRdv, Rdv, ItemRdv, AprovadoresRdv, createElement, getUltimosRdvs, getAllFornecedores, Fornecedor } from '@/services/rdvService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useForm } from "react-hook-form"
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormControl
} from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"
import { safeDateLabel, toBase64 } from '@/utils/functions';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Usuario } from '@/types/Usuario';
import { getAll } from '@/services/usuariosService';
import { PopoverPortal } from '@radix-ui/react-popover';

export default function Page() {
    const titulo = 'Lançamento de RDV';
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [results, setResults] = useState<Rdv[]>([])
    const [selectedResult, setSelectedResult] = useState<Rdv>()
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [selectedItensResult, setSelectedItensResult] = useState<ItemRdv[]>([])
    const [isModalAprovadoresOpen, setIsModalAprovadoresOpen] = useState(false)
    const [selectedAprovadoresResult, setSelectedAprovadoresResult] = useState<AprovadoresRdv[]>([])

    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [selectedAnexosResult, setSelectedAnexosResult] = useState<AnexoRdv[]>([])
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [currentPageAnexo, setCurrentPageAnexo] = useState(1);
    const [totalPagesAnexo, setTotalPagesAnexo] = useState<number | null>(null);
    const [anexoSelecionado, setAnexoSelecionado] = useState<AnexoRdv | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const iframeAnexoRef = useRef<HTMLIFrameElement>(null);

    const [openCcustoSearch, setOpenCcustoSearch] = useState(false)
    const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
    const [openFornecedorSearch, setOpenFornecedorSearch] = useState(false)
    const [openCodcontaSearch, setOpenCodcontaSearch] = useState(false)
    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
    const [openProdutoSearch, setOpenProdutoSearch] = useState(false)
    const [produtos, setProdutos] = useState<Produto[]>([])

    const [rdv] = useState<Rdv>({ descricao: '', situacao: 'Em andamento', itens: [], anexos: [], aprovadores: [] })
    const [produtosSubmit, setProdutosSubmit] = useState<ItemRdv[]>([])
    const [anexosSubmit, setAnexosSubmit] = useState<AnexoRdv[]>([])
    const [aprovadoresSubmit, setAprovadoresSubmit] = useState<AprovadoresRdv[]>([])
    const [openUsuarioSearch, setOpenUsuarioSearch] = useState(false)
    const [zoomAnexo, setZoomAnexo] = useState(1.5);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source !== iframeAnexoRef.current?.contentWindow) return;
            if (event.data?.totalPages) {
                setTotalPagesAnexo(event.data.totalPages);
            }
        };

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    useEffect(() => {
        buscaCentrosDeCusto();
        buscaUsuarios();
        buscaFornecedores();
        buscaUltimosRdvs();
    }, [])

    const form = useForm<Rdv>({
        defaultValues: {
            descricao: "",
            periodo_de: "",
            periodo_ate: "",
            origem: "",
            destino: "",
            codcfo: "",
            itens: [],
            anexos: [],
            aprovadores: [],
        }
    })

    const formItem = useForm<ItemRdv>({
        defaultValues: {
            ccusto: "",
            codconta: "",
            idprd: undefined,
            quantidade: 1,
            valor: 0,
            descricao: "",
        }
    });

    const formAprovadores = useForm<AprovadoresRdv>({
        defaultValues: {
            usuario: "",
        }
    });

    async function buscaCentrosDeCusto() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllCentrosDeCusto()
            setCentrosDeCusto(dados)
            setContasFinanceiras([])
            setProdutos([])
        } catch (err) {
            setError((err as Error).message)
            setCentrosDeCusto([])
        } finally {
            setIsLoading(false)
        }
    }

    async function buscaUsuarios() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAll()
            setUsuarios(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function buscaFornecedores() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllFornecedores()
            setFornecedores(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function buscaUltimosRdvs() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getUltimosRdvs()
            setResults(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSelectedCentroDeCusto(data: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllContasFinanceiras(data);
            setContasFinanceiras(dados)
            setProdutos([])
        } catch (err) {
            setError((err as Error).message)
            setContasFinanceiras([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSelectedContaFinanceira(data: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllProdutos(data);
            setProdutos(dados)
        } catch (err) {
            setError((err as Error).message)
            setProdutos([])
        } finally {
            setIsLoading(false)
        }
    }

    async function onSubmit() {
        setIsLoading(true)
        setError(null)
        rdv.descricao = form.getValues("descricao")
        rdv.origem = form.getValues("origem")
        rdv.destino = form.getValues("destino")
        rdv.periodo_de = form.getValues("periodo_de")
        rdv.periodo_ate = form.getValues("periodo_ate")
        rdv.codcfo = form.getValues("codcfo")
        rdv.itens = produtosSubmit
        rdv.anexos = anexosSubmit
        rdv.aprovadores = aprovadoresSubmit
        try {
            await createElement(rdv)
            toast.success('RDV enviado com sucesso!')
            window.location.reload()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    function adicionarItem() {
        const item: ItemRdv = formItem.getValues()
        const produto = produtos.find(p => p.idprd === item.idprd)
        item.produto = produto?.produto ?? "";
        console.log(item);
        setProdutosSubmit(prev => [...prev, item])
        formItem.reset()
    }

    function removerItem(index: number) {
        setProdutosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    function adicionarAprovador() {
        const aprovador: AprovadoresRdv = formAprovadores.getValues()
        const usuario = usuarios.find(u => u.codusuario === aprovador.usuario)
        aprovador.usuario = usuario?.codusuario ?? "";
        setAprovadoresSubmit(prev => [...prev, aprovador])
        formAprovadores.reset()
    }

    function removerAprovador(index: number) {
        setAprovadoresSubmit(prev => prev.filter((_, i) => i !== index))
    }

    function handleItens(result: Rdv) {
        setIsModalItensOpen(true)
        setSelectedResult(result)
        setSelectedItensResult(result.itens)
    }

    function handleAnexos(result: Rdv) {
        setIsModalAnexosOpen(true)
        setSelectedResult(result)
        setSelectedAnexosResult(result.anexos)
    }

    function handleAprovadores(result: Rdv) {
        setIsModalAprovadoresOpen(true)
        setSelectedResult(result)
        setSelectedAprovadoresResult(result.aprovadores)
    }

    async function handleSubmitAnexos() {
        setIsLoading(true)
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: AnexoRdv = {
            anexo: base64,
            nome: fileName
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleVisualizarAnexo(anexo: AnexoRdv) {
        setIsLoading(true)
        try {
            setAnexoSelecionado(anexo);
            const pdfClean = anexo.anexo.replace(/^data:.*;base64,/, '').trim();

            setTimeout(() => {
                iframeAnexoRef.current?.contentWindow?.postMessage(
                    { pdfBase64: pdfClean },
                    '*'
                );
            }, 500);
            setZoomAnexo(1.5);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalVisualizarAnexoOpen(true)
        }
    }

    function handleZoomInAnexo() {
        if (!iframeAnexoRef.current) return;
        const newZoom = Math.min(5, zoomAnexo + 0.25);
        setZoomAnexo(newZoom);
        iframeAnexoRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomOutAnexo() {
        if (!iframeAnexoRef.current) return;
        const newZoom = Math.max(0.5, zoomAnexo - 0.25);
        setZoomAnexo(newZoom);
        iframeAnexoRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function changePageAnexo(newPage: number) {
        if (!iframeAnexoRef.current) return;
        setCurrentPageAnexo(newPage);
        iframeAnexoRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }


    function handleImprimirAnexo() {
        if (!iframeAnexoRef.current) return;

        const iframe = iframeAnexoRef.current as HTMLIFrameElement;
        const iframeWindow = iframe.contentWindow;

        if (iframeWindow) {
            iframeWindow.focus();
            iframeWindow.print();
        } else {
            toast.error("Não foi possível acessar o documento para impressão.");
        }
    }

    const colunas = useMemo<ColumnDef<Rdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'periodo_de', header: 'Período de', accessorFn: (row) => row.periodo_de ? safeDateLabel(row.periodo_de) : '' },
            { accessorKey: 'periodo_ate', header: 'Período até', accessorFn: (row) => row.periodo_ate ? safeDateLabel(row.periodo_ate) : '' },
            { accessorKey: 'origem', header: 'Origem' },
            { accessorKey: 'destino', header: 'Destino' },
            { accessorKey: 'situacao', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovadores(row.original)}>
                                Aprovadores
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos
                            </Button>
                        </div>
                    );
                }
            }
        ],
        []
    )

    const colunasItens = useMemo<ColumnDef<ItemRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'ccusto', header: 'Centro de custo', accessorFn: (row) => row.ccusto + ' - ' + (row.custo ?? '-') },
            { accessorKey: 'codconta', header: 'Conta financeira', accessorFn: (row) => row.codconta + ' - ' + (row.contabil ?? '-') },
            { accessorKey: 'idprd', header: 'Produto', accessorFn: (row) => row.idprd + ' - ' + (row.produto ?? '-') },
            { accessorKey: 'valor', header: 'Valor', accessorFn: (row) => row.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '' },
            { accessorKey: 'descricao', header: 'Descrição' },
        ],
        []
    )

    const colunasAprovadores = useMemo<ColumnDef<AprovadoresRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Aprovador' },
            { accessorKey: 'aprovacao', header: 'Aprovação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => row.data_aprovacao ? safeDateLabel(row.data_aprovacao) : '' },
        ],
        []
    )

    const colunasAnexos = useMemo<ColumnDef<AnexoRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Descrição' },
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Título */}
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">Últimas requisições</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
                </CardContent>
            </Card>

            {/* Main */}
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4"></form>
                        <FormField
                            control={form.control}
                            name={`codcfo`}
                            rules={{ required: "Fornecedor obrigatório" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Popover
                                            open={openFornecedorSearch}
                                            onOpenChange={setOpenFornecedorSearch}
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-between"
                                                >
                                                    {
                                                        fornecedores.find(u => u.codcfo === field.value)?.nome ??
                                                        "Selecione o fornecedor"
                                                    }
                                                    <ChevronsUpDown className="opacity-50 size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverPortal>
                                                <PopoverContent
                                                    className="p-0 w-[600px] pointer-events-auto overflow-visible z-[9999]"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Command>
                                                        <CommandInput placeholder="Buscar fornecedor..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>

                                                            <CommandGroup>
                                                                {fornecedores.map((u) => (
                                                                    <CommandItem
                                                                        key={u.codcfo}
                                                                        value={`${u.codcfo} ${u.nome}`.toLowerCase()}
                                                                        onSelect={() => {
                                                                            field.onChange(u.codcfo);
                                                                            setOpenFornecedorSearch(false);
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

                        <FormField
                            control={form.control}
                            name="descricao"
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="periodo_de"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Período de</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="periodo_ate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Período até</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="origem"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Origem</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="destino"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Destino</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                    </Form>
                </CardContent>
            </Card>

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

            {/* Itens */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Itens Adicionados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col">
                        <Form {...formItem}>
                            <form onSubmit={formItem.handleSubmit(adicionarItem)} className="grid gap-4">
                                <FormField
                                    control={formItem.control}
                                    name="ccusto"
                                    rules={{ required: "Centro de custo obrigatório" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Centro de Custo</FormLabel>
                                            <FormControl>
                                                <Popover open={openCcustoSearch} onOpenChange={setOpenCcustoSearch}>
                                                    <PopoverTrigger asChild>
                                                        <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCcustoSearch(true)}>
                                                            {centrosDeCusto.find(c => c.ccusto === field.value)?.custo ?? "Selecione"}
                                                            <ChevronsUpDown className="opacity-50 size-4" />
                                                        </Button>
                                                    </PopoverTrigger>

                                                    <PopoverContent className="p-0 w-[600px]">
                                                        <Command
                                                            filter={(value, search) => {
                                                                const label = centrosDeCusto.find(m => m.ccusto === value)?.custo || ""
                                                                const searchLower = search.toLowerCase()

                                                                return (
                                                                    label.toLowerCase().includes(searchLower) ||
                                                                    value.toLowerCase().includes(searchLower)
                                                                ) ? 1 : 0
                                                            }}
                                                        >                                                    <CommandInput placeholder="Buscar centro..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                                <CommandGroup>
                                                                    {centrosDeCusto.map(c => (
                                                                        <CommandItem
                                                                            key={c.ccusto}
                                                                            value={c.ccusto}
                                                                            onSelect={() => {
                                                                                field.onChange(c.ccusto)
                                                                                handleSelectedCentroDeCusto(c.ccusto)
                                                                                setOpenCcustoSearch(false)
                                                                            }}
                                                                        >
                                                                            {c.ccusto} - {c.custo}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={formItem.control}
                                    name="codconta"
                                    rules={{ required: "Conta financeira obrigatória" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Conta Financeira</FormLabel>
                                            <FormControl>
                                                <Popover open={openCodcontaSearch} onOpenChange={setOpenCodcontaSearch}>
                                                    <PopoverTrigger asChild>
                                                        <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCodcontaSearch(true)}>
                                                            {contasFinanceiras.find(x => x.codconta === field.value)?.contabil ?? "Selecione"}
                                                            <ChevronsUpDown className="opacity-50 size-4" />
                                                        </Button>
                                                    </PopoverTrigger>

                                                    <PopoverContent className="p-0 w-[600px]">
                                                        <Command
                                                            filter={(value, search) => {
                                                                const label = contasFinanceiras.find(m => m.codconta === value)?.contabil || contasFinanceiras.find(m => m.codconta === value)?.codconta || ""
                                                                const searchLower = search.toLowerCase()

                                                                return (
                                                                    label.toLowerCase().includes(searchLower) ||
                                                                    value.toLowerCase().includes(searchLower)
                                                                ) ? 1 : 0
                                                            }}
                                                        >
                                                            <CommandInput placeholder="Buscar conta..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                                <CommandGroup>
                                                                    {contasFinanceiras.map(x => (
                                                                        <CommandItem
                                                                            key={x.codconta}
                                                                            value={x.codconta}
                                                                            onSelect={() => {
                                                                                field.onChange(x.codconta)
                                                                                handleSelectedContaFinanceira(x.codconta)
                                                                                setOpenCodcontaSearch(false)
                                                                            }}
                                                                        >
                                                                            {x.codconta} - {x.contabil}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={formItem.control}
                                    name="idprd"
                                    rules={{ required: "Produto obrigatório" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Produto</FormLabel>
                                            <FormControl>
                                                <Popover open={openProdutoSearch} onOpenChange={setOpenProdutoSearch}>
                                                    <PopoverTrigger asChild>
                                                        <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenProdutoSearch(true)}>
                                                            {produtos.find(p => p.idprd === field.value)?.produto ?? "Selecione"}
                                                            <ChevronsUpDown className="opacity-50 size-4" />
                                                        </Button>
                                                    </PopoverTrigger>

                                                    <PopoverContent className="p-0 w-[600px]">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar produto..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                                <CommandGroup>
                                                                    {produtos.map(p => (
                                                                        <CommandItem
                                                                            key={p.idprd}
                                                                            value={p.idprd.toString()}
                                                                            onSelect={() => {
                                                                                field.onChange(p.idprd)
                                                                                setOpenProdutoSearch(false)
                                                                            }}
                                                                        >
                                                                            {p.idprd} - {p.produto}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={formItem.control}
                                    name="descricao"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descrição do item</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={formItem.control}
                                        name="quantidade"
                                        rules={{ required: "Qtd obrigatória" }}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Qtd</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={formItem.control}
                                        name="valor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Valor</FormLabel>
                                                <FormControl>
                                                    <NumericFormat
                                                        value={field.value}
                                                        onValueChange={(values) => {
                                                            field.onChange(values.floatValue ?? 0);
                                                        }}
                                                        thousandSeparator="."
                                                        decimalSeparator=","
                                                        decimalScale={2}
                                                        fixedDecimalScale
                                                        allowNegative={false}
                                                        customInput={Input}
                                                        placeholder="0,00"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? 'Adicionando…' : 'Adicionar Item'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                    {produtosSubmit.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{item.quantidade}x - {item.produto} - {item.descricao}</span>
                            <Button variant="destructive" size="icon" onClick={() => removerItem(i)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Aprovadores */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Aprovadores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col">
                        <Form {...formAprovadores}>
                            <form onSubmit={formAprovadores.handleSubmit(adicionarAprovador)} className="grid gap-4">
                                <FormField
                                    control={formAprovadores.control}
                                    name={`usuario`}
                                    rules={{ required: "Usuário obrigatório" }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Popover
                                                    open={openUsuarioSearch}
                                                    onOpenChange={setOpenUsuarioSearch}
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
                                                            className="p-0 w-[600px] pointer-events-auto overflow-visible z-[9999]"
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
                                                                                    field.onChange(u.codusuario);
                                                                                    setOpenUsuarioSearch(false);
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

                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? 'Adicionando…' : 'Adicionar Aprovador'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                    {aprovadoresSubmit.map((aprovador, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{aprovador.usuario}</span>
                            <Button variant="destructive" size="icon" onClick={() => removerAprovador(i)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Button onClick={onSubmit}>Enviar carrinho</Button>

            {/* Loading */}
            <Dialog open={isLoading} onOpenChange={setIsLoading}>
                <DialogContent
                    showCloseButton={false}
                    className="flex flex-col items-center justify-center gap-4 border-none shadow-none bg-transparent max-w-[200px]"
                    aria-description='Carregando...'
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

            {/* Itens ultimos movimentos */}
            {selectedResult && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[1000px] ">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Itens movimentação n° ${selectedResult.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={selectedItensResult} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Anexos ultimos movimentos */}
            {selectedResult && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[1000px] ">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${selectedResult.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={selectedAnexosResult} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Aprovadores ultimos movimentos */}
            {selectedResult && (
                <Dialog open={isModalAprovadoresOpen} onOpenChange={setIsModalAprovadoresOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[1000px] ">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovadores movimentação n° ${selectedResult.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovadores} data={selectedAprovadoresResult} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Visualizar anexo */}
            {anexoSelecionado && (
                <Dialog open={isModalVisualizarAnexoOpen} onOpenChange={setIsModalVisualizarAnexoOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Anexo ${anexoSelecionado.nome}`}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex justify-center bg-gray-50">
                            {anexoSelecionado ? (
                                <>
                                    {/* PDF sem overflow interno */}
                                    <iframe
                                        ref={iframeAnexoRef}
                                        src="/pdf-viewer.html"
                                        className="relative border-none  cursor-crosshair"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            maxWidth: '800px',
                                            aspectRatio: '1/sqrt(2)', // Proporção A4
                                        }}
                                    />
                                </>
                            ) : (
                                <p className="flex items-center justify-center h-full py-10">
                                    Nenhum documento disponível
                                </p>
                            )}
                        </div>

                        {/* Ações */}
                        <div className="flex justify-center items-center mt-2 mb-4 gap-4 shrink-0 sticky bottom-0 p-4 border-t flex-wrap">
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
                                    onClick={handleZoomOutAnexo}
                                    disabled={zoomAnexo <= 0.5}
                                    title="Diminuir zoom"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-sm min-w-[3rem] text-center font-medium">
                                    {Math.round(zoomAnexo * 100)}%
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleZoomInAnexo}
                                    disabled={zoomAnexo >= 5}
                                    title="Aumentar zoom"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </div>

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

            {error && (<p className="mb-4 text-center text-sm text-destructive"> Erro: {error} </p>)}
        </div >
    )
}