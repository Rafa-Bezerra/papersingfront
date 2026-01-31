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
import { Filter, SearchIcon, X } from 'lucide-react'
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
import { dateToIso, safeDateLabel, stripDiacritics, toMoney } from '@/utils/functions'
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Search } from "lucide-react";
import {
    aprovar,
    Bordero,
    BorderoAprovacao,
    BorderoItem,
    getAll,
    getAllAprovadores,
    getAllItens,
    getAnexoById
} from '@/services/borderoService';
import { Label } from '@radix-ui/react-label';
import { toast } from 'sonner';
import { PdfViewport } from '@/utils/pdfCoords'

export default function Page() {
    const titulo = 'Borderôs'
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [userCodusuario, setCodusuario] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Bordero[]>([])
    const [itensResults, setItensResults] = useState<BorderoItem[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<Bordero>()
    const [requisicaoAprovacoesSelecionada, setRequisicaoAprovacoesSelecionada] = useState<BorderoAprovacao[]>([])
    const [aprovadores, setAprovadores] = useState<BorderoAprovacao[]>([])
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("AGUARDANDO APROVAÇÃO")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [isModalDocumentosOpen, setIsModalDocumentosOpen] = useState(false)
    const [itemSelecionado, setItemSelecionado] = useState<BorderoItem | null>(null)
    const [documentoItemSelecionado, setDocumentoItemSelecionado] = useState<string>("")
    const [zoomDocumento, setZoomDocumento] = useState(1.5);
    const [pdfViewport, setPdfViewport] = useState<PdfViewport | null>(null);
    const pdfStyle = pdfViewport
        ? { width: `${pdfViewport.width}px`, height: `${pdfViewport.height}px` }
        : { width: '100%', height: '100%', maxWidth: '800px', aspectRatio: '1/sqrt(2)' };

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source === iframeRef.current?.contentWindow) {
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

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    useEffect(() => {
        buscaAprovadores();
    }, [])

    async function buscaAprovadores() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllAprovadores(0)
            setAprovadores(dados)
        } catch (err) {
            setError((err as Error).message)
            setAprovadores([])
        } finally {
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
            const today = new Date();
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(today.getDate() - 5);
            const from = dateFrom ? dateFrom : dateToIso(fiveDaysAgo)
            const to = dateTo ? dateTo : dateToIso(today)
            const dados = await getAll(from, to)
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const matchQuery = qNorm === "" || String(d.descricao ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.statusaprovacaobordero == situacaoFiltrada
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

    async function handleAprovacoes(requisicao: Bordero) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllAprovadores(requisicao.id_bordero)
            setRequisicaoAprovacoesSelecionada(dados)
            setIsModalAprovacoesOpen(true)
            setRequisicaoSelecionada(requisicao)
        } catch (err) {
            setError((err as Error).message)
            setItensResults([])
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
    }

    async function handleItens(requisicao: Bordero) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllItens(requisicao.id_bordero)
            setItensResults(dados)
            setIsModalItensOpen(true)
            setRequisicaoSelecionada(requisicao)
        } catch (err) {
            setError((err as Error).message)
            setItensResults([])
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
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

    const colunas = useMemo<ColumnDef<Bordero>[]>(
        () => [
            { accessorKey: 'id_bordero', header: 'ID' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'descricao', header: 'Descrição' },
            { accessorKey: 'cod_conta_caixa', header: 'Conta caixa' },
            { accessorKey: 'nome_banco', header: 'Banco' },
            { accessorKey: 'numero_banco', header: 'Número banco' },
            { accessorKey: 'numero_agencia_banco', header: 'Agência' },
            { accessorKey: 'numero_conta_banco', header: 'Conta' },
            { accessorKey: 'statusaprovacaobordero', header: 'Status' },
            { accessorKey: 'cod_convenio_banco', header: 'Convênio' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const usuarioAprovador = aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );
                    console.log(usuarioAprovador)

                    const status_bloqueado = ['BORDERO APROVADO', '0', 'APROVADO E REMETIDO'].includes(row.original.statusaprovacaobordero);

                    const podeAprovar = usuarioAprovador && !status_bloqueado;
                    const podeReprovar = usuarioAprovador && !status_bloqueado;

                    // const podeAprovar = true;
                    // const podeReprovar = true;
                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original.id_bordero, 1)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeReprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original.id_bordero, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}
                        </div>
                    );
                }
            }
        ],
        [userName]
    )

    const colunasAprovacoes = useMemo<ColumnDef<BorderoAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario', header: 'Usuário' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) }
        ],
        []
    )

    function sumColumn(data: BorderoItem[], key: keyof BorderoItem) {
        return data.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
    }

    async function handleDocumento(item: BorderoItem) {
        setIsLoading(true)
        setCurrentPage(1);
        setTotalPages(null);
        setPdfViewport(null);
        setItemSelecionado(item)
        try {
            const data = await getAnexoById(item.id_movimento_ligacao);
            const arquivoBase64 = data.arquivo!.replace(/^data:.*;base64,/, '').trim();
            setDocumentoItemSelecionado(arquivoBase64);
            setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                    { pdfBase64: arquivoBase64 },
                    '*'
                );
            }, 500);

            setZoomDocumento(1.5);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalDocumentosOpen(true)
        }
    }

    function handleZoomInDocumento() {
        if (!iframeRef.current) return;
        const newZoom = Math.min(5, zoomDocumento + 0.25);
        setZoomDocumento(newZoom);
        iframeRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomOutDocumento() {
        if (!iframeRef.current) return;
        const newZoom = Math.max(0.5, zoomDocumento - 0.25);
        setZoomDocumento(newZoom);
        iframeRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomResetDocumento() {
        if (!iframeRef.current) return;
        setZoomDocumento(1.5);
        iframeRef.current.contentWindow?.postMessage({ zoomReset: true }, "*");
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

    function changePage(newPage: number) {
        if (!iframeRef.current) return;
        setCurrentPage(newPage);
        iframeRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    const colunasItens = useMemo<ColumnDef<BorderoItem>[]>(
        () => [
            // { accessorKey: 'id_bordero', header: 'Id' },
            // { accessorKey: 'id_lancamento_fin', header: 'Lanc. Fin.' },
            { accessorKey: 'numero_nota_financeiro', header: 'Nota Fin.' },
            { accessorKey: 'id_movimento_ligacao', header: 'Movimento' },
            { accessorKey: 'cod_fornecedor', header: 'Fornecedor' },
            {
                accessorKey: 'valor_bruto_lan', header: 'Vl Bruto', accessorFn: (row) => toMoney(row.valor_bruto_lan),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'valor_bruto_lan');
                    return toMoney(total);
                }
            },
            {
                accessorKey: 'desc_vl_irrf', header: 'IRRF', accessorFn: (row) => toMoney(row.desc_vl_irrf),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'desc_vl_irrf');
                    return toMoney(total);
                }
            },
            {
                accessorKey: 'desc_vl_iss', header: 'ISS', accessorFn: (row) => toMoney(row.desc_vl_iss),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'desc_vl_iss');
                    return toMoney(total);
                }
            },
            {
                accessorKey: 'desc_vl_taxas', header: 'Taxas', accessorFn: (row) => toMoney(row.desc_vl_taxas),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'desc_vl_taxas');
                    return toMoney(total);
                }
            },
            {
                accessorKey: 'desc_vl_inss', header: 'INSS', accessorFn: (row) => toMoney(row.desc_vl_inss),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'desc_vl_inss');
                    return toMoney(total);
                }
            },
            {
                accessorKey: 'desc_vl_multa', header: 'Multa', accessorFn: (row) => toMoney(row.desc_vl_multa),
                footer: (ctx) => {
                    const total = sumColumn(ctx.table.getCoreRowModel().rows.map(r => r.original), 'desc_vl_multa');
                    return toMoney(total);
                }
            },
            { accessorKey: 'descricao_historico_lan', header: 'Histórico' },
            // { accessorKey: 'tipo_documento_lan', header: 'Tipo documento' },
            { accessorKey: 'conta_de_centrocusto', header: 'Centro de custo' },
            { accessorKey: 'nat_financeira', header: 'Natureza_financeira' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'validade_bordero', header: 'Validade', accessorFn: (row) => safeDateLabel(row.validade_bordero) },
            { accessorKey: 'data_criacao_lan', header: 'Data criação lanc.', accessorFn: (row) => safeDateLabel(row.data_criacao_lan) },
            { accessorKey: 'data_vencimento_lan', header: 'Data venc. lanc.', accessorFn: (row) => safeDateLabel(row.data_vencimento_lan) },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    return (
                        <div className="flex gap-2">
                            {row.original.possui_anexo ? (
                                <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                    Documento
                                </Button>
                            ) : (
                                <span>Nenhum anexo</span>
                            )}
                        </div>
                    );
                }
            }
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Filtros e Busca */}
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    <div className="flex justify-end items-end gap-4">
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
                                    <span className="hidden sm:inline">Filtros</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"BORDERO APROVADO"} checked={situacaoFiltrada == "BORDERO APROVADO"} onCheckedChange={() => setSituacaoFiltrada("BORDERO APROVADO")}>BORDERO APROVADO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"APROVADO E REMETIDO"} checked={situacaoFiltrada == "APROVADO E REMETIDO"} onCheckedChange={() => setSituacaoFiltrada("APROVADO E REMETIDO")}>APROVADO E REMETIDO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"AGUARDANDO APROVAÇÃO"} checked={situacaoFiltrada == "AGUARDANDO APROVAÇÃO"} onCheckedChange={() => setSituacaoFiltrada("AGUARDANDO APROVAÇÃO")}>AGUARDANDO APROVAÇÃO</DropdownMenuCheckboxItem>
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
                </CardContent>
            </Card>

            {/* Borderos */}
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
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${requisicaoSelecionada.id_bordero}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={requisicaoAprovacoesSelecionada} loading={loading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Itens */}
            {requisicaoSelecionada && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-left">{`Aprovações movimentação n° ${requisicaoSelecionada.id_bordero}`}</DialogTitle>
                        </DialogHeader>
                        {itensResults?.length > 0 && (
                            <Card className="p-4 my-4">
                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Tipo de documento:</span>
                                    <span>{itensResults[0].tipo_documento_lan}</span>
                                </div>
                            </Card>
                        )}
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={itensResults} loading={loading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Documento */}
            {itemSelecionado && (
                <Dialog open={isModalDocumentosOpen} onOpenChange={setIsModalDocumentosOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Documento item n° ${itemSelecionado.id_movimento_ligacao}`}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex justify-center bg-gray-50">
                            {documentoItemSelecionado ? (
                                <>
                                    {/* PDF sem overflow interno */}
                                    <iframe
                                        ref={iframeRef}
                                        src="/pdf-viewer.html"
                                        className="relative border-none  cursor-crosshair"
                                        style={pdfStyle}
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
                                    onClick={handleZoomOutDocumento}
                                    disabled={zoomDocumento <= 0.5}
                                    title="Diminuir zoom"
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-sm min-w-[3rem] text-center font-medium">
                                    {Math.round(zoomDocumento * 100)}%
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleZoomInDocumento}
                                    disabled={zoomDocumento >= 5}
                                    title="Aumentar zoom"
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleZoomResetDocumento}
                                    title="Resetar zoom"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>

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