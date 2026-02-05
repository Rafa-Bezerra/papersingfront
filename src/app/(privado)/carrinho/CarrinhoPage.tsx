'use client'

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { ChevronsUpDown, Eye, Loader2, Trash2, ZoomIn, ZoomOut, Search } from "lucide-react";
import { AnexoCarrinho, Carrinho, CentroDeCusto, ContaFinanceira, createElement, getAllCentrosDeCusto, getAllContasFinanceiras, getAllProdutos, getUltimasRequisicoes, ItemCarrinho, Produto } from '@/services/carrinhoService';
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
import { Requisicao_item, RequisicaoDto } from '@/services/requisicoesService';
import { safeDateLabel, toBase64, toMoney } from '@/utils/functions';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

export default function Page() {
    const titulo = 'Carrinho de Compras'
    const [isLoading, setIsLoading] = useState(false)
    const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
    const [results, setResults] = useState<RequisicaoDto[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoDto>()
    const [requisicaoItensSelecionada, setRequisicaoItensSelecionada] = useState<Requisicao_item[]>([])
    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carrinho] = useState<Carrinho>({ descricao: '', tipo_movimento: '', itens: [], anexos: [] })
    const [produtosSubmit, setProdutosSubmit] = useState<ItemCarrinho[]>([])
    const [anexosSubmit, setAnexosSubmit] = useState<AnexoCarrinho[]>([])
    const [error, setError] = useState<string | null>(null)
    const [openTmovSearch, setOpenTmovSearch] = useState(false)
    const [openProdutoSearch, setOpenProdutoSearch] = useState(false)
    const [openCcustoSearch, setOpenCcustoSearch] = useState(false)
    const [openCodcontaSearch, setOpenCodcontaSearch] = useState(false)
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [currentPageAnexo, setCurrentPageAnexo] = useState(1);
    const [totalPagesAnexo, setTotalPagesAnexo] = useState<number | null>(null);
    const [anexoSelecionado, setAnexoSelecionado] = useState<AnexoCarrinho | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const iframeAnexoRef = useRef<HTMLIFrameElement>(null);
    const [zoomAnexo, setZoomAnexo] = useState(1.5);
    const [bloqueado, setBloqueado] = useState(true)

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
        setBloqueado(true);
        if (produtos.length > 0) setBloqueado(false);
    }, [produtos])

    const form = useForm<Carrinho>({
        defaultValues: {
            descricao: "",
            tipo_movimento: "",
            periodo_de: "",
            periodo_ate: "",
            origem: "",
            destino: "",
            itens: [],
            anexos: []
        }
    })

    const formItem = useForm<ItemCarrinho>({
        defaultValues: {
            ccusto: "",
            codconta: "",
            idprd: undefined,
            quantidade: 1,
            valor: 0,
            descricao: ""
        }
    });

    const movimentos = [
        { value: "1.1.01", label: "1.1.01 - Requisição de compra" },
        { value: "1.1.02", label: "1.1.02 - Requisições administrativas" },
        { value: "1.1.04", label: "1.1.04 - Requisição de sistemas - Terceiros" },
        { value: "1.1.05", label: "1.1.05 - Requisição manutenção" },
        { value: "1.1.10", label: "1.1.10 - Requisição de adiantamento" },
        // { value: "1.1.11", label: "1.1.11 - Requisição de RDV" },
        { value: "1.1.12", label: "1.1.12 - Requisição de estoque" },
    ];

    useEffect(() => {
        buscaCentrosDeCusto();
        buscaUltimasRequisicoes();
    }, [])

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

    async function buscaUltimasRequisicoes() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getUltimasRequisicoes()
            setResults(dados)
        } catch (err) {
            setError((err as Error).message)
            setCentrosDeCusto([])
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
        carrinho.descricao = form.getValues("descricao")
        carrinho.tipo_movimento = form.getValues("tipo_movimento")
        carrinho.origem = form.getValues("origem")
        carrinho.destino = form.getValues("destino")
        carrinho.periodo_de = form.getValues("periodo_de")
        carrinho.periodo_ate = form.getValues("periodo_ate")
        carrinho.itens = produtosSubmit
        carrinho.anexos = anexosSubmit
        try {
            await createElement(carrinho)
            toast.success('Carrinho enviado com sucesso!')
            window.location.reload()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    function adicionarItem() {
        console.log('adicionarItem');
        const item: ItemCarrinho = formItem.getValues()
        const produto = produtos.find(p => p.idprd === item.idprd)
        item.produto = produto?.produto ?? "";
        console.log(item);
        setProdutosSubmit(prev => [...prev, item])
        formItem.reset()
    }

    function removerItem(index: number) {
        setProdutosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleItens(requisicao: RequisicaoDto) {
        setIsModalItensOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoItensSelecionada(requisicao.requisicao_itens)
    }

    async function handleAnexos() {
        setIsLoading(true)
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: AnexoCarrinho = {
            anexo: base64,
            descricao: fileName
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleVisualizarAnexo(anexo: AnexoCarrinho) {
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

    const colunas = useMemo<ColumnDef<RequisicaoDto>[]>(
        () => [
            { accessorKey: 'requisicao.idmov', header: 'ID' },
            { accessorKey: 'requisicao.movimento', header: 'Movimento' },
            { accessorKey: 'requisicao.tipo_movimento', header: 'Tipo movimento' },
            { accessorKey: 'requisicao.nome_solicitante', header: 'Solicitante' },
            { accessorKey: 'requisicao.status_movimento', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                        </div>
                    );
                }
            }
        ],
        []
    )

    const colunasItens = useMemo<ColumnDef<Requisicao_item>[]>(
        () => [
            { accessorKey: 'centro_custo', header: 'Centro de custo', accessorFn: (row) => row.centro_custo + ' - ' + (row.nome_centro_custo ?? '-') },
            { accessorKey: 'codigo_item_movimento', header: 'Cod. Item' },
            { accessorKey: 'item_preco_unitario', header: 'Preço unitário' },
            { accessorKey: 'item_quantidade', header: 'Quantidade' },
            { accessorKey: 'item_total', header: 'Total' },
            // { accessorKey: 'historico_item', header: 'Histórico' }
        ],
        []
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            name="tipo_movimento"
                            rules={{ required: "Tipo obrigatório" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de movimento</FormLabel>
                                    <FormControl>
                                        <Popover open={openTmovSearch} onOpenChange={setOpenTmovSearch}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-between"
                                                    onClick={() => setOpenTmovSearch(true)}
                                                >
                                                    {field.value
                                                        ? movimentos.find(m => m.value === field.value)?.label
                                                        : "Selecione"}
                                                    <ChevronsUpDown className="opacity-50 size-4" />
                                                </Button>
                                            </PopoverTrigger>

                                            <PopoverContent
                                                className="p-0 w-[600px]"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Command
                                                    filter={(value, search) => {
                                                        const label = movimentos.find(m => m.value === value)?.label || ""
                                                        const searchLower = search.toLowerCase()

                                                        return (
                                                            label.toLowerCase().includes(searchLower) ||
                                                            value.toLowerCase().includes(searchLower)
                                                        ) ? 1 : 0
                                                    }}
                                                >                                                    <CommandInput placeholder="Buscar..." />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum encontrado</CommandEmpty>

                                                        <CommandGroup>
                                                            {movimentos.map(m => (
                                                                <CommandItem
                                                                    key={m.value}
                                                                    value={m.value}
                                                                    onSelect={() => {
                                                                        field.onChange(m.value)
                                                                        setOpenTmovSearch(false)
                                                                    }}
                                                                >
                                                                    {m.label}
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
                    </Form>

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
                                {["1.1.10", "1.1.11"].includes(form.watch("tipo_movimento")) && <FormField
                                    control={formItem.control}
                                    name="valor"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />}
                            </div>

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Adicionando…' : 'Adicionar Item'}
                            </Button>
                        </form>
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
                            onClick={handleAnexos}
                            disabled={!file || isLoading}
                            className="flex items-center"
                        >
                            {isLoading ? "Enviando..." : "Anexar documento"}
                        </Button>
                    </div>
                    {anexosSubmit.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{item.descricao}</span>
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
                    {produtosSubmit.map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{item.quantidade}x - {item.produto} - {item.descricao}{item.valor ? " - "+ toMoney(item.valor ?? 0) : ""}</span>
                            <Button variant="destructive" size="icon" onClick={() => removerItem(i)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    <Button onClick={onSubmit} disabled={isLoading || bloqueado}>
                        {isLoading ? 'Enviando…' : 'Enviar carrinho'}
                    </Button>
                </CardContent>
            </Card>

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
            {requisicaoSelecionada && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[1000px] ">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Itens movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader>

                        {requisicaoItensSelecionada?.length > 0 && (
                            <Card className="p-4 my-4">
                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Coligada:</span>
                                    <span>{requisicaoSelecionada.requisicao.codcoligada}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Natureza Orçamentária:</span>
                                    <span>{requisicaoItensSelecionada[0]?.codigo_natureza_orcamentaria} - {requisicaoItensSelecionada[0]?.nome_natureza_orcamentaria ?? "-"}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Etapa:</span>
                                    <span>{requisicaoSelecionada.requisicao.nome_etapa ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Fornecedor:</span>
                                    <span>{requisicaoSelecionada.requisicao.nome_fornecedor ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Data emissão:</span>
                                    <span>{safeDateLabel(requisicaoSelecionada.requisicao.data_emissao) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Valor bruto:</span>
                                    <span>{requisicaoSelecionada.requisicao.valor_total.toFixed(2) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Histórico:</span>
                                    <span>{safeDateLabel(requisicaoSelecionada.requisicao.historico_movimento) ?? "-"}</span>
                                </div>
                            </Card>
                        )}
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={requisicaoItensSelecionada} loading={isLoading} />
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
                                {`Anexo ${anexoSelecionado.descricao}`}
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