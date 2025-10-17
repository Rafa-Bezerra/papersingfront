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
import { safeDateLabel, stripDiacritics, toBase64 } from '@/utils/functions'
import {
    RequisicaoDto,
    Requisicao_aprovacao,
    Requisicao_item,
    aprovar,
    getAll as getAllRequisicoes,
    reprovar
} from '@/services/requisicoesService'
import { Assinar, assinar } from '@/services/assinaturaService'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { Label } from '@radix-ui/react-label';
import { 
    Anexo, 
    AnexoAssinar, 
    AnexoUpload, 
    getAll as getAllAnexos,
    createElement as createAnexo,
    updateElement as updateAnexo,
    deleteElement as deleteAnexo
} from '@/services/anexoService';

export default function Page() {
    const titulo = 'Controle imobilizado'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
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
        '1.2.42',
        '1.2.44',
        '1.2.47',
        '1.2.48',
    ];
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [coords, setCoords] = useState<{ x: number; y: number; x2: number; y2: number; yI: number } | null>(null);
    const [anexos, setAnexos] = useState<Anexo[]>([])
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)    
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)   
    const [file, setFile] = useState<File | null>(null)  
    const [fileName, setFileName] = useState<string>("")    
    const [deleteAnexoId, setDeleteAnexoId] = useState<number | null>(null)
    const iframeAnexoRef = useRef<HTMLIFrameElement>(null);
    const [currentPageAnexo, setCurrentPageAnexo] = useState(1);
    const [totalPagesAnexo, setTotalPagesAnexo] = useState<number | null>(null);
    const [coordsAnexo, setCoordsAnexo] = useState<{ x: number; y: number; x2: number; y2: number; yI: number } | null>(null);
    const [anexoSelecionado, setAnexoSelecionado] = useState<Anexo | null>(null)
    
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
        setDateFrom(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
        setDateTo(new Date().toISOString().substring(0, 10));
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
    }, [query, situacaoFiltrada, dateFrom, dateTo])

    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {      
            const dados = await getAllRequisicoes(dateFrom ?? new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10), dateTo ?? new Date().toISOString().substring(0, 10))
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.requisicao.movimento ?? '').toLowerCase())
                const matchQuery = qNorm === "" || movimento.includes(qNorm) || String(d.requisicao.idmov ?? '').includes(qNorm)
                const matchTipos = tipos_movimento.includes(stripDiacritics((d.requisicao.tipo_movimento ?? '').trim()));
                const matchSituacao = situacaoFiltrada === "" || d.requisicao.status_movimento == situacaoFiltrada
                return matchQuery && matchTipos && matchSituacao
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

    async function handleDocumento (requisicao: RequisicaoDto) {
        setIsLoading(true)
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
        setIsLoading(false)
    }

    async function handleAssinar(data: Assinar) {
        setIsLoading(true)
        setSearched(false)
        try {
            await assinar(data)
            handleSearchClick()
            toast.success("Assinatura enviada com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)            
        } finally {
            setIsModalDocumentosOpen(false)
            setSearched(true)
            setIsLoading(false)
        }
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
        setIsLoading(true)
        try {
            await aprovar(id)
            handleSearchClick()
        } catch (err) {
            setError((err as Error).message)
        }  finally {
            setIsLoading(false)
        }
    }

    async function handleReprovar (id: number) {
        setIsLoading(true)
        try {
            await reprovar(id)
            handleSearchClick()
        } catch (err) {
            setError((err as Error).message)
        }  finally {
            setIsLoading(false)
        }
    }

    async function handleAnexos(requisicao: RequisicaoDto) {
        setRequisicaoSelecionada(requisicao)
        setIsLoading(true)
        setError(null)
        try {      
            const dados = await getAllAnexos(requisicao.requisicao.idmov)
            setAnexos(dados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setSearched(true)
            setIsLoading(false)
            setIsModalAnexosOpen(true)
        }
    }

    async function handleAnexarDocumento() {
        setIsLoading(true)
        if (!requisicaoSelecionada) return toast.error("Selecione um arquivo primeiro!")
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: AnexoUpload = {
            anexo: base64,
            nome: fileName,
            idmov: requisicaoSelecionada.requisicao.idmov
        }

        try {
            await createAnexo(anexo)
            toast.success("Arquivo enviado com sucesso!")
            setFile(null)                
            const dados = await getAllAnexos(requisicaoSelecionada.requisicao.idmov)
            setAnexos(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }   

    async function handleVisualizarAnexo (anexo: Anexo) {
        setIsLoading(true)
        setTotalPagesAnexo(1);
        setIsModalVisualizarAnexoOpen(true)
        setAnexoSelecionado(anexo);

        if (!window._pdfMessageListener) {
            window._pdfMessageListener = true;
        
            window.addEventListener("message", (event) => {
                if (event.data?.totalPages) {
                    setTotalPagesAnexo(event.data.totalPages);
                }
            });
        }

        setTimeout(() => {
            iframeAnexoRef.current?.contentWindow?.postMessage(
                { pdfBase64: anexo.anexo },
                '*'
            );
        }, 500);
        setIsLoading(false)
    }
    
    async function handleExcluirAnexo () {
        if (!deleteAnexoId) return            
        try {
            await deleteAnexo(deleteAnexoId)       
            handleAnexos(requisicaoSelecionada!) 
            setDeleteAnexoId(null)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Anexo excluído`)
        }
    }

    async function handleAssinarAnexo(data: AnexoAssinar) {
        setIsLoading(true)
        setSearched(false)
        try {
            await updateAnexo(data)
            toast.success("Assinatura enviada com sucesso!");
            handleAnexos(requisicaoSelecionada!) 
        } catch (err) {
            toast.error((err as Error).message)            
        } finally {
            setIsModalVisualizarAnexoOpen(false)
            setSearched(true)
            setIsLoading(false)
        }
    }

    function handleClickPdfAnexo(e: React.MouseEvent<HTMLDivElement>) {
        const overlay = e.currentTarget as HTMLDivElement;
        const rect = overlay.getBoundingClientRect();
        
        const x = (e.clientX - rect.left) / rect.width;  // 0 a 1
        const y = (e.clientY - rect.top) / rect.height;  // 0 a 1        
        const x2 = e.clientX - rect.left;
        const y2 = e.clientY - rect.top;
        const yI = (rect.height - y2)  / rect.height;
        
        setCoordsAnexo({ x, y, x2, y2, yI });
    }

    async function confirmarAssinaturaAnexo() {
        if (!coordsAnexo) {
          toast.error("Clique no local onde deseja assinar o documento.");
          return;
        }      
        const dadosAssinatura: AnexoAssinar = {
          id: anexoSelecionado!.id,
          anexo: anexoSelecionado!.anexo,
          pagina: currentPageAnexo,
          posX: coordsAnexo.x,
          posY: coordsAnexo.yI,
          largura: 90,
          altura: 30,
        };      
        await handleAssinarAnexo(dadosAssinatura);
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
            { accessorKey: 'requisicao.nome_fornecedor', header: 'Fornecedor' },
            { accessorKey: 'requisicao.data_emissao', header: 'Data emissão', accessorFn: (row) => safeDateLabel(row.requisicao.data_emissao) },
            { 
                accessorKey: 'requisicao.valorbruto', 
                header: 'Valor bruto', 
                accessorFn: (row) => `R$ ${row.requisicao.valor_total.toFixed(2)}`
            },
            { accessorKey: 'requisicao.historico_movimento', header: 'Histórico' },
            { accessorKey: 'requisicao.status_movimento', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        {row.original.requisicao.arquivo && (<Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDocumento(row.original)}
                        >
                            Documento
                        </Button>)}
                        {row.original.requisicao && (<Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAnexos(row.original)}
                        >
                            Anexos
                        </Button>)}
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
                        {row.original.requisicao_aprovacoes.some(
                                (ap) => ap.usuario === userName && ap.situacao != "A"
                            )
                            && (<Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleAprovar(row.original.requisicao.idmov)}
                        >
                            Aprovar
                        </Button>)}
                        {row.original.requisicao_aprovacoes.some(
                                (ap) => ap.usuario === userName && ap.situacao != "R"
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
            { accessorKey: 'centro_custo', header: 'Centro de custo' },
            { accessorKey: 'codigo_item_movimento', header: 'Cod. Item' },
            { accessorKey: 'item_preco_unitario', header: 'Quantidade' },
            { accessorKey: 'item_quantidade', header: 'Quantidade' },
            { accessorKey: 'item_total', header: 'Quantidade' },
            { accessorKey: 'historico_item', header: 'Histórico' }
        ],
        []
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    const colunasAnexos = useMemo<ColumnDef<Anexo>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Anexo' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        {row.original.anexo && (<Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVisualizarAnexo(row.original)}
                        >
                            Visualizar
                        </Button>)}
                        {row.original.anexo && (<Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteAnexoId(row.original.id)}
                        >
                            Excluir
                        </Button>)}
                    </div>
                )
            }
        ],
        [userName]
    )

    return (
        <div className="p-6">
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
                                <DropdownMenuCheckboxItem key={"Em Andamento"} checked={situacaoFiltrada == "Em Andamento"} onCheckedChange={() => setSituacaoFiltrada("Em Andamento")}>Em Andamento</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído a responder"} checked={situacaoFiltrada == "Concluído a responder"} onCheckedChange={() => setSituacaoFiltrada("Concluído a responder")}>Concluído a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído respondido"} checked={situacaoFiltrada == "Concluído respondido"} onCheckedChange={() => setSituacaoFiltrada("Concluído respondido")}>Concluído respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído confirmado"} checked={situacaoFiltrada == "Concluído confirmado"} onCheckedChange={() => setSituacaoFiltrada("Concluído confirmado")}>Concluído confirmado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído automático(pelo sistema)"} checked={situacaoFiltrada == "Concluído automático(pelo sistema)"} onCheckedChange={() => setSituacaoFiltrada("Concluído automático(pelo sistema)")}>Concluído automático(pelo sistema)</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Avaliado"} checked={situacaoFiltrada == "Avaliado"} onCheckedChange={() => setSituacaoFiltrada("Avaliado")}>Avaliado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado a responder"} checked={situacaoFiltrada == "Agendado a responder"} onCheckedChange={() => setSituacaoFiltrada("Agendado a responder")}>Agendado a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado respondido"} checked={situacaoFiltrada == "Agendado respondido"} onCheckedChange={() => setSituacaoFiltrada("Agendado respondido")}>Agendado respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Aguardando terceiros"} checked={situacaoFiltrada == "Aguardando terceiros"} onCheckedChange={() => setSituacaoFiltrada("Aguardando terceiros")}>Aguardando terceiros</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Cancelado"} checked={situacaoFiltrada == "Cancelado"} onCheckedChange={() => setSituacaoFiltrada("Cancelado")}>Cancelado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Despertado"} checked={situacaoFiltrada == "Despertado"} onCheckedChange={() => setSituacaoFiltrada("Despertado")}>Despertado</DropdownMenuCheckboxItem>
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

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Itens */}
            {requisicaoSelecionada && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px] ">
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
                                    <span>{requisicaoItensSelecionada[0]?.nome_natureza_orcamentaria ?? "-"}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Etapa:</span>
                                    <span>{requisicaoSelecionada.requisicao.nome_etapa ?? "-"}</span>
                                </div>
                            </Card>
                        )}
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={requisicaoItensSelecionada} loading={loading} />         
                        </div>  
                    </DialogContent>
                </Dialog>
            )}

            {/* Aprovações */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
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
                        <DialogHeader className="p-4 shrink-0 bg-white sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Documento movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}
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
                        <div className="flex justify-center mt-2 mb-4 gap-4 shrink-0 bg-white sticky bottom-0 p-4 border-t">
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
                            <Button onClick={confirmarAssinatura} className="flex items-center">
                                Assinar
                            </Button>
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
                    <div className="flex flex-col items-center justify-center bg-white rounded-2xl p-6 shadow-lg">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-600 mt-2">Carregando</p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Anexos */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader> 
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={anexos} loading={loading} />         
                        </div>  
                        {/* Ações */}
                        <div className="flex justify-center mt-2 mb-4 gap-4 shrink-0 bg-white sticky bottom-0 p-4 border-t">
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
                                onClick={handleAnexarDocumento}
                                disabled={!file || isLoading}
                                className="flex items-center"
                            >
                                {isLoading ? "Enviando..." : "Anexar documento"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Assinatura de anexo */}
            {anexoSelecionado && (
                <Dialog open={isModalVisualizarAnexoOpen} onOpenChange={setIsModalVisualizarAnexoOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 bg-white sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Anexo n° ${anexoSelecionado.id} - ${anexoSelecionado.nome}`}
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
                                    onClick={handleClickPdfAnexo}
                                />

                                {/* Overlay */}
                                <div
                                    id="assinatura-overlay"
                                    className="absolute inset-0 cursor-crosshair"
                                    onClick={handleClickPdfAnexo}
                                />

                                {/* Indicador visual */}
                                {coordsAnexo && (
                                    <div
                                        className="absolute w-5 h-5 bg-blue-500/40 border-2 border-blue-700 rounded-full pointer-events-none"
                                        style={{
                                            left: coordsAnexo.x2 - 10,
                                            top: coordsAnexo.y2 - 10,
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
                        <div className="flex justify-center mt-2 mb-4 gap-4 shrink-0 bg-white sticky bottom-0 p-4 border-t">
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
                            <Button onClick={confirmarAssinaturaAnexo} className="flex items-center">
                                Assinar
                            </Button>
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

            {/* Confirmação de exclusão usando Dialog */}
            <Dialog open={deleteAnexoId !== null} onOpenChange={() => setDeleteAnexoId(null)}>
                <DialogContent
                    className="max-w-sm rounded-xl bg-background p-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()} // evita propagação
                >
                    <DialogHeader>
                        <DialogTitle>Excluir anexo</DialogTitle>
                    </DialogHeader>
                    <p className="mb-4 text-sm text-muted-foreground">
                        Tem certeza que deseja excluir o anexo #{deleteAnexoId}?
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteAnexoId(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleExcluirAnexo}>
                            Excluir
                        </Button>
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