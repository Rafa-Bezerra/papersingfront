'use client'

import { Button } from "@/components/ui/button";
import { FiscalDocumento, FiscalGetAll, FiscalGetDocumento, FiscalResponseDto, assinar, getAll, getDocumento, FiscalAssinar, FiscalAprovarDocumento, aprovarFiscal, getAllAnexos } from "@/services/fiscalService";
import { FiscalAprovacao, FiscalItem } from "@/types/Fiscal";
import { dateToIso, safeDateLabel, stripDiacritics, toMoney } from "@/utils/functions";
import { PdfClickCoords, PdfViewport, getPdfClickCoords, getSignaturePreviewStyle, getSignaturePreviewStyleFromPointer, handlePdfOverlayWheel } from "@/utils/pdfCoords";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Check, Filter, RefreshCw, SearchIcon, X, ZoomIn, ZoomOut, Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@radix-ui/react-label';

export default function Page() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [userAdmin, setUserAdmin] = useState(false);
    const [userCodusuario, setCodusuario] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<FiscalResponseDto[]>([])
    const [selectedResult, setSelectedResult] = useState<FiscalResponseDto | null>(null)
    const [resultAnexos, setResultAnexos] = useState<FiscalDocumento[]>([])
    const [resultItens, setResultItens] = useState<FiscalItem[]>([])
    const [resultAprovacoes, setResultAprovacoes] = useState<FiscalAprovacao[]>([])
    const [selectedDocumento, setSelectedDocumento] = useState<string>("")
    const [selectedDocumentoTipo, setSelectedDocumentoTipo] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [isModalDocumentosOpen, setIsModalDocumentosOpen] = useState(false)
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition()
    const [coords, setCoords] = useState<PdfClickCoords | null>(null);
    const [signatureCoords, setSignatureCoords] = useState<PdfClickCoords | null>(null);
    const [previewCoords, setPreviewCoords] = useState<PdfClickCoords | null>(null);
    const [isPreviewLocked, setIsPreviewLocked] = useState(false);
    const [pdfViewport, setPdfViewport] = useState<PdfViewport | null>(null);
    const [zoomDocumento, setZoomDocumento] = useState(1.5);
    const [tipoMovimentoFiltrado, setTipoMovimentoFiltrado] = useState<string>("")
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("Em Andamento")
    const [solicitantes, setSolicitantes] = useState<string[]>([])
    const [tiposMovimento, setTiposMovimento] = useState<string[]>([])
    const [podeAssinar, setPodeAssinar] = useState(false)
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
        if (dateFrom === "" && dateTo === "") {
            const today = new Date();
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(today.getDate() - 5);

            setDateFrom(fiveDaysAgo.toISOString().substring(0, 10));
            setDateTo(today.toISOString().substring(0, 10));
        }

        const storedUser = sessionStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserAdmin(user.admin);
            setCodusuario(user.codusuario.toUpperCase());
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            handleSearch("")
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [dateFrom, dateTo, situacaoFiltrada, solicitanteFiltrado, tipoMovimentoFiltrado])

    useEffect(() => {
        if (!results.length || !dateFrom || !dateTo) return
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") handleSearch(query)
        }, 60000)
        return () => clearInterval(timer)
    }, [results.length, query, dateFrom, dateTo, situacaoFiltrada, solicitanteFiltrado, tipoMovimentoFiltrado])

    async function handleSearchClick() {
        setIsLoading(true)
        startTransition(() => {
            const sp = new URLSearchParams(Array.from(searchParams.entries()))
            if (query) sp.set('q', query)
            else sp.delete('q')
            router.replace(`?${sp.toString()}`)
        })
        await handleSearch(query)
        setIsLoading(false)
    }

    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {
            const today = new Date();
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(today.getDate() - 5);
            const from = dateFrom ? dateFrom : dateToIso(fiveDaysAgo)
            const to = dateTo ? dateTo : dateToIso(today)

            const data: FiscalGetAll = {
                dateFrom: from,
                dateTo: to,
                status: situacaoFiltrada,
                solicitante: solicitanteFiltrado,
                tipo_movimento: tipoMovimentoFiltrado,
            };

            const dados = await getAll(data)

            const solicitantesUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.fiscal.nome_solicitante)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setSolicitantes(solicitantesUnicos)

            const tipos_movimento = Array.from(
                new Set(
                    dados
                        .map(d => d.fiscal.tipo_movimento)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setTiposMovimento(tipos_movimento)

            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.fiscal.movimento ?? '').toLowerCase())
                const matchQuery = qNorm === "" || movimento.includes(qNorm) || String(d.fiscal.idmov ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.fiscal.status == situacaoFiltrada
                const matchTipoMovimento = tipoMovimentoFiltrado === "" || d.fiscal.tipo_movimento == tipoMovimentoFiltrado
                const matchSolicitante = solicitanteFiltrado === "" || d.fiscal.nome_solicitante == solicitanteFiltrado

                let usuarioAprovador = d.fiscal_aprovacoes.some(
                    ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                );

                if (userAdmin) { usuarioAprovador = true; }
                return matchQuery && matchSituacao && usuarioAprovador && matchSolicitante && matchTipoMovimento
            })
            setResults(filtrados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleDocumento(requisicao: FiscalResponseDto, tipo: string) {
        setIsLoading(true)
        setCurrentPage(1);
        setTotalPages(null);
        setCoords(null);
        setSignatureCoords(null);
        setPreviewCoords(null);
        setIsPreviewLocked(false);
        setPdfViewport(null);
        setPodeAssinar(false);
        setSelectedDocumentoTipo(tipo);
        const usuarioAprovador = requisicao.fiscal_aprovacoes.some(
            ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
        );
        const nivelUsuario = requisicao.fiscal_aprovacoes.find(
            ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
        )?.nivel ?? 1;

        const todasInferioresAprovadas = nivelUsuario == 1 || (requisicao.fiscal_aprovacoes.filter(ap => ap.nivel < (nivelUsuario)).every(ap => ap.situacao === 'A'));
        const status_liberado = ['Em Andamento'].includes(requisicao.fiscal.status);
        const podeAssinar = todasInferioresAprovadas && usuarioAprovador && status_liberado;
        setPodeAssinar(podeAssinar);
        setSelectedResult(requisicao)
        try {
            const data: FiscalGetDocumento = {
                idmov: requisicao.fiscal.idmov,
                tipo: tipo
            };
            const responseData = await getDocumento(data);
            // console.log(responseData);
            
            // const arquivoBase64 = responseData;
            setSelectedDocumento(responseData);

            setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                    { pdfBase64: responseData },
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

    async function handleAnexo(requisicao: FiscalDocumento, tipo: string) {
        setIsLoading(true)
        setCurrentPage(1);
        setTotalPages(null);
        setCoords(null);
        setSignatureCoords(null);
        setPreviewCoords(null);
        setIsPreviewLocked(false);
        setPdfViewport(null);
        setPodeAssinar(false);
        setSelectedDocumentoTipo(tipo);
        try {
            const arquivoBase64 = requisicao.anexo;
            setSelectedDocumento(arquivoBase64);

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

    async function handleAssinar(data: FiscalAssinar) {
        setIsLoading(true)
        try {
            data.arquivo = selectedDocumento;
            await assinar(data)
            handleSearchClick()
            toast.success("Assinatura enviada com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalDocumentosOpen(false)
            setIsLoading(false)
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

    async function confirmarAssinatura() {
        if (!selectedResult || selectedDocumentoTipo != "fiscal" || !selectedDocumento) return;
        if (!coords) {
            toast.error("Clique no local onde deseja assinar o documento.");
            return;
        }
        const dadosAssinatura: FiscalAssinar = {
            idmov: selectedResult.fiscal.idmov,
            atendimento: selectedResult.movimento.codigo_atendimento,
            arquivo: selectedDocumento,
            pagina: currentPage,
            posX: coords.x,
            posY: coords.yI,
            largura: 90,
            altura: 30,
        };
        await handleAssinar(dadosAssinatura);
    }

    async function handleAprovar(requisicao: FiscalResponseDto, aprovar: boolean) {
        setIsLoading(true)
        try {
            const data: FiscalAprovarDocumento = {
                idmov: requisicao.fiscal.idmov,
                codigo_atendimento: requisicao.movimento.codigo_atendimento,
                aprovar: aprovar
            };
            await aprovarFiscal(data)
            setResults(prev => prev.filter(r => r.fiscal.idmov !== requisicao.fiscal.idmov))
            toast.success("Aprovado! Lista atualizada.")
            handleSearch(query)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleItens(requisicao: FiscalResponseDto) {
        setIsLoading(true)
        setIsModalItensOpen(true)
        setSelectedResult(requisicao)
        setResultItens(requisicao.movimento_itens)
        setIsLoading(false)
    }

    async function handleAprovacoes(requisicao: FiscalResponseDto) {
        setIsLoading(true)
        setIsModalAprovacoesOpen(true)
        setSelectedResult(requisicao)
        setResultAprovacoes(requisicao.fiscal_aprovacoes)
        setIsLoading(false)
    }

    async function handleAnexos(requisicao: FiscalResponseDto) {
        setSelectedResult(requisicao)
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllAnexos(requisicao.movimento.idmov)
            setResultAnexos(dados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setIsLoading(false)
            setIsModalAnexosOpen(true)
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

    const colunas = useMemo<ColumnDef<FiscalResponseDto>[]>(
        () => [
            { accessorKey: 'fiscal.idmov', header: 'ID' },
            { accessorKey: 'fiscal.data_emissao', header: 'Emissão', accessorFn: (row) => safeDateLabel(row.fiscal.data_emissao) },
            { accessorKey: 'fiscal.movimento', header: 'Movimento' },
            { accessorKey: 'fiscal.tipo_movimento', header: 'Tipo movimento' },
            { accessorKey: 'fiscal.nome_solicitante', header: 'Solicitante', accessorFn: (row) => row.fiscal?.nome_solicitante?.trim() || "—" },
            { accessorKey: 'fiscal.status', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const { fiscal, fiscal_aprovacoes } = row.original;
                    const usuarioAprovador = fiscal_aprovacoes.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );
                    const nivelUsuario = row.original.fiscal_aprovacoes.find(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    )?.nivel ?? 1;
                    const todasInferioresAprovadas = nivelUsuario == 1 || (fiscal_aprovacoes.filter(ap => ap.nivel < (nivelUsuario)).every(ap => ap.situacao === 'A'));
                    const status_liberado = ['Em Andamento'].includes(fiscal.status);
                    const podeAprovar = todasInferioresAprovadas && usuarioAprovador && status_liberado;
                    const podeReprovar = todasInferioresAprovadas && usuarioAprovador && status_liberado;

                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original, "fiscal")}>
                                Documento {fiscal.documento_assinado == 1 && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original, "movimento")}>
                                Doc. Movimento
                            </Button>
                            {fiscal && (
                                <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                    Anexos
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && fiscal.documento_assinado == 1 && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original, true)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeReprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original, false)}
                                >
                                    Reprovar
                                </Button>
                            )}
                        </div>
                    );
                }
            }
        ],
        [userCodusuario]
    )

    const colunasItens = useMemo<ColumnDef<FiscalItem>[]>(
        () => [
            { accessorKey: 'sequencia', header: 'Sequência' },
            { accessorKey: 'centro_custo', header: 'Centro de custo', accessorFn: (row) => row.centro_custo + ' - ' + (row.centro_custo ?? '-') },
            { accessorKey: 'preco_unitario', header: 'Preço unitário', accessorFn: (row) => toMoney(row.preco_unitario) },
            { accessorKey: 'quantidade', header: 'Quantidade' },
            { accessorKey: 'valor_total', header: 'Total', accessorFn: (row) => toMoney(row.preco_unitario) },
            // { accessorKey: 'historico_item', header: 'Histórico' }
        ],
        []
    )

    const colunasAprovacoes = useMemo<ColumnDef<FiscalAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'situacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) }
        ],
        []
    )

    const colunasAnexos = useMemo<ColumnDef<FiscalDocumento>[]>(
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
                            onClick={() => handleAnexo(row.original, "anexo")}
                        >
                            Visualizar
                        </Button>)}
                    </div>
                )
            }
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Cabeçalho */}
            <Card className="mb-6">
                {/* Filtros */}
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">Painel Fiscal</CardTitle>
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

                        {/* Tipo de movimento */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Tipo de movimento</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Tipo de movimento</DropdownMenuLabel>
                                {tiposMovimento.map((tipo_movimento) => (
                                    <DropdownMenuCheckboxItem
                                        key={tipo_movimento}
                                        checked={tipoMovimentoFiltrado === tipo_movimento}
                                        onCheckedChange={(checked) => { if (checked) setTipoMovimentoFiltrado(tipo_movimento) }}
                                    >
                                        {tipo_movimento}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuCheckboxItem key={"Todos"} checked={tipoMovimentoFiltrado == ""} onCheckedChange={(checked) => { if (checked) setTipoMovimentoFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Solicitantes */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Solicitantes</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Solicitantes</DropdownMenuLabel>
                                {solicitantes.map((solicitante) => (
                                    <DropdownMenuCheckboxItem
                                        key={solicitante}
                                        checked={solicitanteFiltrado === solicitante}
                                        onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado(solicitante) }}
                                    >
                                        {solicitante}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuCheckboxItem key={"Todos"} checked={solicitanteFiltrado == ""} onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Situação */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Filtros</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"Em Andamento"} checked={situacaoFiltrada == "Em Andamento"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Em Andamento") }}>Em Andamento</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído a responder"} checked={situacaoFiltrada == "Concluído a responder"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Concluído a responder") }}>Concluído a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído respondido"} checked={situacaoFiltrada == "Concluído respondido"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Concluído respondido") }}>Concluído respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído confirmado"} checked={situacaoFiltrada == "Concluído confirmado"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Concluído confirmado") }}>Concluído confirmado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído automático(pelo sistema)"} checked={situacaoFiltrada == "Concluído automático(pelo sistema)"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Concluído automático(pelo sistema)") }}>Concluído automático(pelo sistema)</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Avaliado"} checked={situacaoFiltrada == "Avaliado"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Avaliado") }}>Avaliado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado a responder"} checked={situacaoFiltrada == "Agendado a responder"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Agendado a responder") }}>Agendado a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado respondido"} checked={situacaoFiltrada == "Agendado respondido"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Agendado respondido") }}>Agendado respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Aguardando terceiros"} checked={situacaoFiltrada == "Aguardando terceiros"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Aguardando terceiros") }}>Aguardando terceiros</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Cancelado"} checked={situacaoFiltrada == "Cancelado"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Cancelado") }}>Cancelado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Despertado"} checked={situacaoFiltrada == "Despertado"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("Despertado") }}>Despertado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("") }}>Todos</DropdownMenuCheckboxItem>
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

                    <div className="flex gap-2">
                        <Button onClick={handleSearchClick} className="flex items-center">
                            <SearchIcon className="mr-1 h-4 w-4" /> Buscar
                        </Button>
                        <Button variant="outline" onClick={() => handleSearch(query)} className="flex items-center" title="Atualizar lista">
                            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Main */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
                </CardContent>
            </Card>

            {/* Itens */}
            {resultItens && selectedResult && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[1000px] ">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Itens movimentação n° ${selectedResult.fiscal.idmov}`}</DialogTitle>
                        </DialogHeader>

                        {resultItens?.length > 0 && (
                            <Card className="p-4 my-4">
                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Natureza Orçamentária:</span>
                                    <span>{selectedResult.movimento.natureza_orcamentaria}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Etapa:</span>
                                    <span>{selectedResult.movimento.etapa}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Fornecedor:</span>
                                    <span>{selectedResult.movimento.fornecedor}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Data emissão:</span>
                                    <span>{safeDateLabel(selectedResult.fiscal.data_emissao) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Valor bruto:</span>
                                    <span>{toMoney(selectedResult.movimento.valor_total.toFixed(2)) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Histórico:</span>
                                    <span>{safeDateLabel(selectedResult.movimento.historico) ?? "-"}</span>
                                </div>
                            </Card>
                        )}
                        <div className="w-full">
                            <DataTable columns={colunasItens} data={resultItens} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Aprovações */}
            {resultAprovacoes && selectedResult && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${selectedResult.fiscal.idmov}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={resultAprovacoes} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Anexos */}
            {resultAnexos && selectedResult && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${selectedResult.fiscal.idmov}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={resultAnexos} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Documento */}
            {selectedResult && selectedDocumento && selectedDocumentoTipo && (
                <Dialog open={isModalDocumentosOpen} onOpenChange={setIsModalDocumentosOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {(() => {
                                    switch (selectedDocumentoTipo) {
                                        case "anexo":
                                            return "Visualizar anexo";
                                        case "movimento":
                                            return `Documento movimentação n° ${selectedResult.movimento.idmov}`;
                                        default:
                                            return `Documento fiscal n° ${selectedResult.fiscal.idmov}`;
                                    }
                                })()}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex-1 overflow-auto flex justify-center bg-gray-50" data-pdf-scroll="true">
                            {selectedDocumento ? (
                                <>
                                    <div className="relative" style={pdfStyle}>
                                        {/* PDF */}
                                        <iframe
                                            ref={iframeRef}
                                            src="/pdf-viewer.html"
                                            className="relative border-none cursor-default pointer-events-none"
                                            style={{ width: '100%', height: '100%' }}
                                        />

                                        {/* Overlay */}
                                        {selectedDocumentoTipo == "fiscal" && (
                                            <div
                                                id="assinatura-overlay"
                                                className="absolute inset-0 cursor-default pointer-events-auto z-10"
                                                onClick={handleClickPdf}
                                                onMouseMove={handleHoverPdf}
                                                onMouseLeave={() => {
                                                    if (!isPreviewLocked) setPreviewCoords(null);
                                                }}
                                                onWheel={handlePdfOverlayWheel}
                                            />
                                        )}

                                        {/* Pré-visualização da assinatura */}
                                        {selectedDocumentoTipo == "fiscal" && !isPreviewLocked && previewCoords && (
                                            <div
                                                className="absolute border-2 border-blue-600/70 bg-blue-500/10 rounded-sm pointer-events-none z-20"
                                                style={getSignaturePreviewStyleFromPointer(previewCoords, pdfViewport) ?? undefined}
                                            />
                                        )}
                                        {selectedDocumentoTipo == "fiscal" && signatureCoords && (
                                            <div
                                                className="absolute border-2 border-blue-700 bg-blue-500/15 rounded-sm pointer-events-none z-20"
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
                            </div>

                            {(selectedResult.fiscal.documento_assinado == 0 && podeAssinar && <Button onClick={confirmarAssinatura} className="flex items-center">
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

            {error && (
                <p className="mb-4 text-center text-sm text-destructive">
                    Erro: {error}
                </p>
            )}

            {(isLoading || isPending) && (
                <div className="grid gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                    ))}
                </div>
            )}

            {results.length === 0 && !isLoading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                </p>
            )}
        </div>
    );
}