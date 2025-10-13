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
import { getStatusDescricao, safeDateLabel, stripDiacritics } from '@/utils/functions'
import {
    RequisicaoDto,
    Requisicao_aprovacao,
    Requisicao_item,
    getAll as getAllRequisicoes
} from '@/services/requisicoesService'
import { toast } from 'sonner'
import { Assinar, assinar } from '@/services/assinaturaService'

export default function PageUsuarios() {
    const titulo = 'Recebimento de materiais'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [userName, setUserName] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<RequisicaoDto[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoDto>()
    const [requisicaoItensSelecionada, setRequisicaoItensSelecionada] = useState<Requisicao_item[]>([])
    const [requisicaoAprovacoesSelecionada, setRequisicaoAprovacoesSelecionada] = useState<Requisicao_aprovacao[]>([])
    const [requisicaoDocumentoSelecionada, setRequisicaoDocumentoSelecionada] = useState<string>("")
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [isModalDocumentosOpen, setIsModalDocumentosOpen] = useState(false)
    const tipos_movimento : string[] = [
        '1.2.40',
        '1.2.41',
        '1.2.45',
        '1.2.46',
        '1.2.49',
        '1.2.70',
    ];
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [coords, setCoords] = useState<{ x: number; y: number; x2: number; y2: number; yI: number } | null>(null);
    
    function changePage(newPage: number) {
        if (!iframeRef.current) return;
        setCurrentPage(newPage);
        iframeRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    function clearQuery() {
        setQuery('')
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    useEffect(() => {        
        const storedUser = localStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserName(user.nome.toUpperCase());
        }
        handleSearch(searchParams.get('q') ?? '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
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
    }, [query, situacaoFiltrada])

    async function handleSearch(q: string) {
        setError(null)
        try {      
            const dados = await getAllRequisicoes()
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.requisicao.numero_movimento ?? '').toLowerCase())
                const base = stripDiacritics((d.requisicao.centro_custo ?? '').toLowerCase())
                const matchQuery = qNorm === "" || movimento.includes(qNorm)|| base.includes(qNorm) || String(d.requisicao.idmov ?? '').includes(qNorm)
                const matchTipos = tipos_movimento.includes(stripDiacritics((d.requisicao.tipo_movimento ?? '').trim()));
                const matchSituacao = situacaoFiltrada === "" || d.requisicao.cod_status_aprovacao == situacaoFiltrada
                return matchQuery && matchTipos && matchSituacao
            })

            setResults(filtrados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setSearched(true)
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

    async function handleDocumento (requisicao: RequisicaoDto) {
        setTotalPages(1);
        setIsModalDocumentosOpen(true)  
        setRequisicaoSelecionada(requisicao)
        const arquivoBase64 = requisicao.requisicao.arquivo;        
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
    }

    async function handleAssinar(data: Assinar) {
        setSearched(false)
        try {
            await assinar(data)
            toast.success("Assinatura enviada com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)            
        } finally {
            setSearched(true)
        }
    }

    async function confirmarAssinatura() {
        if (!coords) {
          toast.error("Clique no local onde deseja assinar o documento.");
          return;
        }      
        const dadosAssinatura: Assinar = {
          idmov: requisicaoSelecionada!.requisicao.idmov,
          arquivo: requisicaoSelecionada!.requisicao.arquivo,
          pagina: currentPage,
          posX: coords.x,
          posY: coords.yI,
          largura: 90,
          altura: 30,
        };      
        await handleAssinar(dadosAssinatura);
    }    

    function handleClickPdf(e: React.MouseEvent<HTMLDivElement>) {
        const overlay = e.currentTarget as HTMLDivElement;
        const rect = overlay.getBoundingClientRect();
        
        const x = (e.clientX - rect.left) / rect.width;  // 0 a 1
        const y = (e.clientY - rect.top) / rect.height;  // 0 a 1        
        const x2 = e.clientX - rect.left;
        const y2 = e.clientY - rect.top;
        const yI = (rect.height - y2)  / rect.height;
        
        setCoords({ x, y, x2, y2, yI });
    }

    async function handleItens (requisicao: RequisicaoDto) {
        setIsModalItensOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoItensSelecionada(requisicao.requisicao_itens)
    }

    async function handleAprovacoes (requisicao: RequisicaoDto) {
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.requisicao_aprovacoes)
    }

    async function handleAprovar (id: number) {
        console.log(id);
    }

    async function handleReprovar (id: number) {
        console.log(id);
    }
    
    const colunas = useMemo<ColumnDef<RequisicaoDto>[]>(
        () => [
            { accessorKey: 'requisicao.idmov', header: 'ID' },
            { accessorKey: 'requisicao.centro_custo', header: 'Centro de custo' },
            { accessorKey: 'requisicao.nome_solicitante', header: 'Solicitante' },
            { accessorKey: 'requisicao.numero_movimento', header: 'Movimento' },
            { accessorKey: 'requisicao.tipo_movimento', header: 'Tipo movimento' },
            { accessorKey: 'requisicao.data_emissao', header: 'Data emissão', accessorFn: (row) => safeDateLabel(row.requisicao.data_emissao) },
            { 
                accessorKey: 'requisicao.valorbruto', 
                header: 'Valor bruto', 
                accessorFn: (row) => `R$ ${row.requisicao.valorbruto.toFixed(2)}`
            },
            { accessorKey: 'requisicao.historico_solicitacao', header: 'Histórico' },
            { accessorKey: 'requisicao.cod_status_aprovacao', header: 'Situação', accessorFn: (row) => getStatusDescricao(row.requisicao.cod_status_aprovacao) },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDocumento(row.original)}
                        >
                            Documento
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleItens(row.original)}
                        >
                            Itens
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAprovacoes(row.original)}
                        >
                            Aprovações
                        </Button>
                        {row.original.requisicao.cod_status_aprovacao == "A" 
                            && row.original.requisicao_aprovacoes.some(
                                (ap) => ap.usuario === userName
                            )
                            && (<Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleAprovar(row.original.requisicao.idmov)}
                        >
                            Aprovar
                        </Button>)}
                        {row.original.requisicao.cod_status_aprovacao == "A" 
                            && row.original.requisicao_aprovacoes.some(
                                (ap) => ap.usuario === userName
                            )
                            && (<Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReprovar(row.original.requisicao.idmov)}
                        >
                            Reprovar
                        </Button>)}
                    </div>
                )
            }
        ],
        [userName]
    )
    
    const colunasItens = useMemo<ColumnDef<Requisicao_item>[]>(
        () => [
            { accessorKey: 'cod_item', header: 'Cod. Item' },
            { accessorKey: 'quantidade_produto', header: 'Quantidade' },
            { accessorKey: 'historico_item', header: 'Histórico' }
        ],
        []
    )
    
    const colunasAprovacoes = useMemo<ColumnDef<Requisicao_aprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario', header: 'Usuário' },
            { accessorKey: 'situacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) }
        ],
        []
    )

    return (
        <div className="p-6">
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    
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
                            <DropdownMenuCheckboxItem key={"A"} checked={situacaoFiltrada == "A"} onCheckedChange={() => setSituacaoFiltrada("A")}>Em Andamento</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"R"} checked={situacaoFiltrada == "R"} onCheckedChange={() => setSituacaoFiltrada("R")}>Concluído a responder</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"O"} checked={situacaoFiltrada == "O"} onCheckedChange={() => setSituacaoFiltrada("O")}>Concluído respondido</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"D"} checked={situacaoFiltrada == "D"} onCheckedChange={() => setSituacaoFiltrada("D")}>Concluído confirmado</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"U"} checked={situacaoFiltrada == "U"} onCheckedChange={() => setSituacaoFiltrada("U")}>Concluído automático (pelo sistema)</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"V"} checked={situacaoFiltrada == "V"} onCheckedChange={() => setSituacaoFiltrada("V")}>Avaliado</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"G"} checked={situacaoFiltrada == "G"} onCheckedChange={() => setSituacaoFiltrada("G")}>Agendado a responder</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"S"} checked={situacaoFiltrada == "S"} onCheckedChange={() => setSituacaoFiltrada("S")}>Agendado respondido</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"T"} checked={situacaoFiltrada == "T"} onCheckedChange={() => setSituacaoFiltrada("T")}>Aguardando terceiros</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"C"} checked={situacaoFiltrada == "C"} onCheckedChange={() => setSituacaoFiltrada("C")}>Cancelado</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"E"} checked={situacaoFiltrada == "E"} onCheckedChange={() => setSituacaoFiltrada("E")}>Despertado</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Modal */}
            {requisicaoSelecionada && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Itens requisição n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader>  
                        
                        {requisicaoItensSelecionada?.length > 0 && (
                            <Card className="p-4 my-4">
                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Coligada:</span>
                                    <span>{requisicaoItensSelecionada[0]?.codcoligada ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Fornecedor:</span>
                                    <span>{requisicaoItensSelecionada[0]?.cod_fornecedor ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Natureza Orçamentária:</span>
                                    <span>{requisicaoItensSelecionada[0]?.nat_orcamentaria ?? "-"}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Etapa:</span>
                                    <span>{requisicaoItensSelecionada[0]?.nome_etapa ?? "-"}</span>
                                </div>
                            </Card>
                        )}
                        
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={requisicaoItensSelecionada} loading={loading} />         
                        </div>  
                    </DialogContent>
                </Dialog>
            )}

            {/* Modal */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações requisição n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader> 
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={requisicaoAprovacoesSelecionada} loading={loading} />         
                        </div>  
                    </DialogContent>
                </Dialog>
            )}

            {/* Modal */}
            {requisicaoSelecionada && (
                <Dialog open={isModalDocumentosOpen} onOpenChange={setIsModalDocumentosOpen}>
                    <DialogContent className="w-full max-w-4xl h-full flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Documento requisição n° ${requisicaoSelecionada.requisicao.idmov}`}
                            </DialogTitle>
                        </DialogHeader>
            
                        <div className="relative flex-1">
                            {requisicaoDocumentoSelecionada ? (
                                <>
                                    <iframe
                                        ref={iframeRef}
                                        src="/pdf-viewer.html"
                                        className="w-full h-full"
                                        style={{ border: "none" }}
                                    />

                                    {/* Captura do clique */}
                                    <div
                                        id="assinatura-overlay"
                                        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                                        onClick={handleClickPdf}
                                    />

                                    {/* Indicador visual */} 
                                    {coords && (<div className="absolute w-5 h-5 bg-blue-500/40 border-2 border-blue-700 rounded-full pointer-events-none" style={{ left: coords.x2 - 10, top: coords.y2 - 10 }}/>)}
                                </>
                            ) : (
                                <p>Nenhum documento disponível</p>
                            )}
                        </div>
            
                        {/* Paginação */}
                        <div className="flex justify-center items-center gap-2 mt-2">
                            <Button disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>
                                Anterior
                            </Button>
                            <span>Página {currentPage}{totalPages ? ` / ${totalPages}` : ""}</span>
                            <Button disabled={currentPage >= (totalPages == null ? 1 : totalPages)} onClick={() => changePage(currentPage + 1)}>
                                Próxima
                            </Button>
                        </div>
                
                        <Button onClick={confirmarAssinatura} className="flex items-center">
                            Assinar
                        </Button>
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

            {searched && results.length === 0 && !loading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                </p>
            )}
        </div>
    )
}
