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
import { Check, Filter, Loader2, ZoomIn, ZoomOut, Search, RefreshCwIcon } from "lucide-react";
import { AnexoRdv, Rdv, ItemRdv, AprovadoresRdv, getAprovacoesRdv, aprovarRdv, AssinarRdv, assinar, getAnexoById } from '@/services/rdvService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { safeDateLabel, safeDateLabelAprovacao, stripDiacritics } from '@/utils/functions';
import { getPdfClickCoords, getSignaturePreviewStyle, handlePdfOverlayWheel, PdfClickCoords, PdfViewport } from "@/utils/pdfCoords";
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Label } from '@radix-ui/react-label';
import { Input } from '@/components/ui/input';
import { getAnexoByIdmov } from '@/services/requisicoesService';

export default function Page() {
    const titulo = 'Aprovação de RDV';
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userCodusuario, setCodusuario] = useState("");
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("Em Andamento")
    const [results, setResults] = useState<Rdv[]>([])
    const [selectedResult, setSelectedResult] = useState<Rdv>()
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [selectedItensResult, setSelectedItensResult] = useState<ItemRdv[]>([])
    const [isModalAprovadoresOpen, setIsModalAprovadoresOpen] = useState(false)
    const [selectedAprovadoresResult, setSelectedAprovadoresResult] = useState<AprovadoresRdv[]>([])
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [selectedAnexosResult, setSelectedAnexosResult] = useState<AnexoRdv[]>([])
    const [currentPageAnexo, setCurrentPageAnexo] = useState(1);
    const [totalPagesAnexo, setTotalPagesAnexo] = useState<number | null>(null);
    const [anexoSelecionado, setAnexoSelecionado] = useState<AnexoRdv | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const iframeAnexoRef = useRef<HTMLIFrameElement>(null);
    const [currentPageDocumento, setCurrentPageDocumento] = useState(1);
    const [totalPagesDocumento, setTotalPagesDocumento] = useState<number | null>(null);
    const [documentoSelecionado, setDocumentoSelecionado] = useState<AnexoRdv | null>(null)
    const [isModalVisualizarDocumentoOpen, setIsModalVisualizarDocumentoOpen] = useState(false)
    const iframeDocumentoRef = useRef<HTMLIFrameElement>(null);
    const [coords, setCoords] = useState<PdfClickCoords | null>(null);
    const [signatureCoords, setSignatureCoords] = useState<PdfClickCoords | null>(null);
    const [previewCoords, setPreviewCoords] = useState<PdfClickCoords | null>(null);
    const [isPreviewLocked, setIsPreviewLocked] = useState(false);
    const [pdfViewportDocumento, setPdfViewportDocumento] = useState<PdfViewport | null>(null);
    const [pdfViewportAnexo, setPdfViewportAnexo] = useState<PdfViewport | null>(null);
    const [zoomAnexo, setZoomAnexo] = useState(1.5)
    const [zoomDocumento, setZoomDocumento] = useState(1.5);
    const pdfDocumentoStyle = pdfViewportDocumento
        ? { width: `${pdfViewportDocumento.width}px`, height: `${pdfViewportDocumento.height}px` }
        : { width: '100%', height: '100%', maxWidth: '800px', aspectRatio: '1/sqrt(2)' };
    const pdfAnexoStyle = pdfViewportAnexo
        ? { width: `${pdfViewportAnexo.width}px`, height: `${pdfViewportAnexo.height}px` }
        : { width: '100%', height: '100%', maxWidth: '800px', aspectRatio: '1/sqrt(2)' };

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source === iframeAnexoRef.current?.contentWindow) {
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
            if (event.source === iframeDocumentoRef.current?.contentWindow) {
                if (event.data?.totalPages) {
                    setTotalPagesDocumento(event.data.totalPages);
                }
                if (event.data?.pdfViewport) {
                    setPdfViewportDocumento({
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

    useEffect(() => {
        const storedUser = sessionStorage.getItem("userData");
        // console.log("storedUser: " + storedUser);
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCodusuario(user.codusuario.toUpperCase());
        }
    }, [])

    {/** Set Datas */ }
    useEffect(() => {
        const hoje = new Date().toISOString().substring(0, 10)
        const quinzeDiasAtras = new Date(
            new Date().setDate(new Date().getDate() - 15)
        ).toISOString().substring(0, 10)

        setDateFrom(quinzeDiasAtras)
        setDateTo(hoje)
    }, [])

    useEffect(() => {
        if (!dateFrom || !dateTo || !userCodusuario) return
        buscaAprovacoesRdv();
    }, [situacaoFiltrada, userCodusuario, dateFrom, dateTo])

    async function handleRefresh() {
        buscaAprovacoesRdv();
    }

    async function buscaAprovacoesRdv() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAprovacoesRdv(situacaoFiltrada, dateFrom, dateTo)
            setResults(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
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

    async function handleAprovar(result: Rdv, aprovacao: string) {
        setIsLoading(true)
        setError(null)
        try {
            await aprovarRdv(result.id!, aprovacao);
            toast.success(`RDV n° ${result.id} aprovada com sucesso.`);
            buscaAprovacoesRdv();
        }
        catch (err) {
            setError((err as Error).message)
        }
        finally {
            setIsLoading(false)
        }
    }

    async function handleVisualizarAnexo(anexo: AnexoRdv) {
        setIsLoading(true)
        try {
            const data = await getAnexoById(anexo.id!)
            setAnexoSelecionado(data);
            setCurrentPageAnexo(1);
            setTotalPagesAnexo(null);
            setPdfViewportAnexo(null);
            const pdfClean = data.anexo.replace(/^data:.*;base64,/, '').trim();

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

    async function handleDocumento(aprovacao: Rdv) {
        console.log(aprovacao);
        
        if (!aprovacao.idmov || !aprovacao.codigo_atendimento) return;
        setIsLoading(true)
        setCurrentPageDocumento(1);
        setTotalPagesDocumento(null);
        setCoords(null);
        setSignatureCoords(null);
        setPreviewCoords(null);
        setIsPreviewLocked(false);
        setPdfViewportDocumento(null);

        const data = await getAnexoByIdmov(aprovacao.idmov, aprovacao.codigo_atendimento);
        const arquivoBase64 = data.arquivo;

        const anexo: AnexoRdv = {
            anexo: arquivoBase64,
            nome: `Documento RDV n° ${aprovacao.id}`
        };
        setDocumentoSelecionado(anexo);
        setSelectedResult(aprovacao);
        try {
            const pdfClean = arquivoBase64.replace(/^data:.*;base64,/, '').trim();
            setTimeout(() => {
                iframeDocumentoRef.current?.contentWindow?.postMessage(
                    { pdfBase64: pdfClean },
                    '*'
                );
            }, 500);

            setZoomDocumento(1.5);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalVisualizarDocumentoOpen(true)
        }
    }

    function handleZoomInDocumento() {
        if (!iframeDocumentoRef.current) return;
        const newZoom = Math.min(5, zoomDocumento + 0.25);
        setZoomDocumento(newZoom);
        iframeDocumentoRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function handleZoomOutDocumento() {
        if (!iframeDocumentoRef.current) return;
        const newZoom = Math.max(0.5, zoomDocumento - 0.25);
        setZoomDocumento(newZoom);
        iframeDocumentoRef.current.contentWindow?.postMessage({ zoom: newZoom }, "*");
    }

    function changePageDocumento(newPage: number) {
        if (!iframeDocumentoRef.current) return;
        setCurrentPageDocumento(newPage);
        iframeDocumentoRef.current.contentWindow?.postMessage({ page: newPage }, "*");
    }

    function handleImprimirDocumento() {
        if (!iframeDocumentoRef.current) return;

        const iframe = iframeDocumentoRef.current as HTMLIFrameElement;
        const iframeWindow = iframe.contentWindow;

        if (iframeWindow) {
            iframeWindow.focus();
            iframeWindow.print();
        } else {
            toast.error("Não foi possível acessar o documento para impressão.");
        }
    }

    async function handleAssinar(data: AssinarRdv) {
        setIsLoading(true)
        try {
            await assinar(data)
            toast.success("Assinatura enviada com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalVisualizarDocumentoOpen(false)
            setIsLoading(false)
        }
    }

    function handleClickPdf(e: React.MouseEvent<HTMLDivElement>) {
        const nextCoords = getPdfClickCoords(e, pdfViewportDocumento);
        setCoords(nextCoords);
        setSignatureCoords(nextCoords);
        setPreviewCoords(null);
        setIsPreviewLocked(true);
    }

    function handleHoverPdf(e: React.MouseEvent<HTMLDivElement>) {
        if (isPreviewLocked) return;
        setPreviewCoords(getPdfClickCoords(e, pdfViewportDocumento));
    }

    async function confirmarAssinatura() {
        if (!coords) {
            toast.error("Clique no local onde deseja assinar o documento.");
            return;
        }
        const dadosAssinatura: AssinarRdv = {
            idrdv: selectedResult!.id!,
            arquivo: selectedResult!.arquivo!,
            pagina: currentPageDocumento,
            posX: coords.x,
            posY: coords.yI,
            largura: 90,
            altura: 30,
        };
        await handleAssinar(dadosAssinatura);
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
                    const usuarioAprovador = row.original.aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );

                    const usuarioAprovou = row.original.aprovadores.some(ap =>
                        stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    );

                    const status_liberado = ['Em andamento'].includes(row.original.situacao);
                    const assinouOuSemArquivo = !row.original.arquivo || row.original.arquivo_assinado === true;
                    const podeAprovar = usuarioAprovador && status_liberado && !usuarioAprovou && assinouOuSemArquivo;
                    // const podeAprovar = true;
                    const temDocumento = 
                        row.original.codigo_atendimento !== null 
                        && row.original.codigo_atendimento !== 0
                        && row.original.idmov !== null
                        && row.original.idmov !== 0;
                    return (
                        <div className="flex gap-2">
                            {temDocumento && (
                                <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                    Documento {row.original.arquivo_assinado! == true && (
                                        <Check className="w-4 h-4 text-green-500" />
                                    )}
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovadores(row.original)}>
                                Aprovadores
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos
                            </Button>
                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original, "A")}
                                >
                                    Aprovar
                                </Button>
                            )}
                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original, "R")}
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

    const colunasItens = useMemo<ColumnDef<ItemRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'ccusto', header: 'Centro de custo', accessorFn: (row) => row.ccusto + ' - ' + (row.custo ?? '-') },
            { accessorKey: 'codconta', header: 'Conta financeira', accessorFn: (row) => row.codconta + ' - ' + (row.contabil ?? '-') },
            { accessorKey: 'idprd', header: 'Produto', accessorFn: (row) => row.idprd + ' - ' + (row.produto ?? '-') },
            { accessorKey: 'quantidade', header: 'Qtd', accessorFn: (row) => String(row.quantidade ?? 1) },
            { accessorKey: 'valor', header: 'Valor unit.', accessorFn: (row) => (row.valor != null ? Number(row.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '') },
            { id: 'total', header: 'Total', accessorFn: (row) => ((row.quantidade ?? 1) * (row.valor ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
            { accessorKey: 'descricao', header: 'Descrição' },
        ],
        []
    )

    const colunasAprovadores = useMemo<ColumnDef<AprovadoresRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Aprovador' },
            { accessorKey: 'aprovacao', header: 'Aprovação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao != null ? String(row.data_aprovacao) : null) },
        ],
        []
    )

    const colunasAnexos = useMemo<ColumnDef<AnexoRdv>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Descrição' },
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
                            Visualizar
                        </Button>
                    </div>
                )
            }
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Filtros */}
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
                                <Button variant="outline">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Status</span>
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={situacaoFiltrada} onValueChange={setSituacaoFiltrada}>
                                    <DropdownMenuRadioItem value="Em Andamento">Em Andamento</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Aprovado">Aprovado</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Reprovado">Reprovado</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="">Todos</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button onClick={handleRefresh} className="flex items-center">
                            <RefreshCwIcon className="mr-1 h-4 w-4" /> Atualizar
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Main */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    {userCodusuario && (
                        <DataTable columns={colunas} data={results} loading={isLoading} />
                    )}
                </CardContent>
            </Card>

            {/* Loading */}
            <Dialog open={isLoading} modal={false}>
                <DialogContent
                    showCloseButton={false}
                    className="pointer-events-none flex flex-col items-center justify-center gap-4 border-none shadow-none bg-transparent max-w-[200px]"
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
                        <div className="relative w-full flex-1 overflow-auto flex justify-center bg-gray-50" data-pdf-scroll="true">
                            {anexoSelecionado ? (
                                <>
                                    <div className="relative" style={pdfAnexoStyle}>
                                        {/* PDF */}
                                        <iframe
                                            ref={iframeAnexoRef}
                                            src="/pdf-viewer.html"
                                            className="relative border-none cursor-crosshair"
                                            style={pdfAnexoStyle}
                                        />
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

            {/* Visualizar documento */}
            {documentoSelecionado && (
                <Dialog open={isModalVisualizarDocumentoOpen} onOpenChange={setIsModalVisualizarDocumentoOpen}>
                    <DialogContent className="w-[98vw] h-[98vh] max-w-none max-h-none flex flex-col overflow-y-auto  min-w-[850px]  overflow-x-auto p-0">
                        <DialogHeader className="p-4 shrink-0 sticky top-0 z-10">
                            <DialogTitle className="text-lg font-semibold text-center">
                                {`Documento ${documentoSelecionado.nome}`}
                            </DialogTitle>
                        </DialogHeader>

                        {/* Área do PDF */}
                        <div className="relative w-full flex-1 overflow-auto flex justify-center bg-gray-50" data-pdf-scroll="true">
                            {documentoSelecionado ? (
                                <>
                                    <div className="relative" style={pdfDocumentoStyle}>
                                        {/* PDF */}
                                        <iframe
                                            ref={iframeDocumentoRef}
                                            src="/pdf-viewer.html"
                                            className="relative border-none cursor-default"
                                            style={pdfDocumentoStyle}
                                        />

                                        {/* Overlay */}
                                        <div
                                            id="assinatura-overlay"
                                            className="absolute inset-0 cursor-default"
                                            onClick={handleClickPdf}
                                            onMouseMove={handleHoverPdf}
                                            onMouseLeave={() => {
                                                if (!isPreviewLocked) setPreviewCoords(null);
                                            }}
                                            onWheel={handlePdfOverlayWheel}
                                        />

                                        {/* Pré-visualização da assinatura */}
                                        {!isPreviewLocked && previewCoords && (
                                            <div
                                                className="absolute border-2 border-blue-600/70 bg-blue-500/10 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(previewCoords, pdfViewportDocumento) ?? undefined}
                                            />
                                        )}
                                        {signatureCoords && (
                                            <div
                                                className="absolute border-2 border-blue-700 bg-blue-500/15 rounded-sm pointer-events-none"
                                                style={getSignaturePreviewStyle(signatureCoords, pdfViewportDocumento) ?? undefined}
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
                                disabled={currentPageDocumento <= 1}
                                onClick={() => changePageDocumento(currentPageDocumento - 1)}
                            >
                                Anterior
                            </Button>
                            <span>
                                Página {currentPageDocumento}
                                {totalPagesDocumento ? ` / ${totalPagesDocumento}` : ""}
                            </span>
                            <Button
                                disabled={currentPageDocumento >= (totalPagesDocumento == null ? 1 : totalPagesDocumento)}
                                onClick={() => changePageDocumento(currentPageDocumento + 1)}
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

                            {(!selectedResult!.arquivo_assinado && <Button onClick={confirmarAssinatura} className="flex items-center">
                                Assinar
                            </Button>)}
                            <Button
                                variant="outline"
                                onClick={() => handleImprimirDocumento()}
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