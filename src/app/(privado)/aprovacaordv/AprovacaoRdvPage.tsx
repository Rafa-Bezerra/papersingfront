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
import { Filter, Loader2 } from "lucide-react";
import { AnexoRdv, Rdv, ItemRdv, AprovadoresRdv, getAprovacoesRdv, aprovarRdv } from '@/services/rdvService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { safeDateLabel, stripDiacritics } from '@/utils/functions';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuCheckboxItem } from '@radix-ui/react-dropdown-menu';

export default function Page() {
    const titulo = 'Aprovação de RDV';
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userCodusuario, setCodusuario] = useState("");
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("Em andamento")

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

    useEffect(() => {
        const storedUser = localStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setCodusuario(user.codusuario.toUpperCase());
        }
        buscaAprovacoesRdv();
    }, [])

    async function buscaAprovacoesRdv() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAprovacoesRdv(situacaoFiltrada)
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
        setTotalPagesAnexo(1);
        setIsModalVisualizarAnexoOpen(true)
        setAnexoSelecionado(anexo);
        const pdfClean = anexo.anexo.replace(/^data:.*;base64,/, '').trim();

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
                { pdfBase64: pdfClean },
                '*'
            );
        }, 500);
        setIsLoading(false)
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
                    const usuarioAprovador = row.original.aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );

                    const usuarioAprovou = row.original.aprovadores.some(ap =>
                        stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    );

                    const status_liberado = ['Em Andamento'].includes(row.original.situacao);

                    const podeAprovar = usuarioAprovador && status_liberado && !usuarioAprovou;
                    // const podeAprovar = true;

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
                                    Aprovar
                                </Button>
                            )}
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
            { accessorKey: 'valor', header: 'Valor' },
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
                    </div>
                )
            }
        ],
        []
    )

    return (
        <div className="p-6">
            {/* Título */}
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
                            <DropdownMenuCheckboxItem key={"Em Andamento"} checked={situacaoFiltrada == "Em Andamento"} onCheckedChange={() => setSituacaoFiltrada("Em Andamento")}>Em Andamento</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"Aprovado"} checked={situacaoFiltrada == "Aprovado"} onCheckedChange={() => setSituacaoFiltrada("Aprovado")}>Aprovado</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"Reprovado"} checked={situacaoFiltrada == "Reprovado"} onCheckedChange={() => setSituacaoFiltrada("Reprovado")}>Reprovado</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={() => setSituacaoFiltrada("")}>Todos</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
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