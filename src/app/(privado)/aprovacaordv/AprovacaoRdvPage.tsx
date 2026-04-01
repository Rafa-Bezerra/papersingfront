'use client'

import React, {
    useEffect,
    useMemo,
    useState,
} from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Check, Filter, Loader2, RefreshCwIcon } from "lucide-react";
import { AnexoRdv, Rdv, ItemRdv, AprovadoresRdv, getAprovacoesRdv, aprovarRdv, AssinarRdv, assinar, getAnexoById } from '@/services/rdvService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { imprimirPdfBase64, safeDateLabel, safeDateLabelAprovacao, stripDiacritics } from '@/utils/functions';
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
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog';

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
    const [anexoSelecionado, setAnexoSelecionado] = useState<AnexoRdv | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const [documentoSelecionado, setDocumentoSelecionado] = useState<AnexoRdv | null>(null)
    const [isModalVisualizarDocumentoOpen, setIsModalVisualizarDocumentoOpen] = useState(false)
    const [arquivoParaImpressao, setArquivoParaImpressao] = useState<string | null>(null)
    const [anexoParaImpressao, setAnexoParaImpressao] = useState<string | null>(null)

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
            setAnexoParaImpressao(data.anexo);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalVisualizarAnexoOpen(true)
        }
    }

    function handleImprimirAnexo() {
        if (!anexoParaImpressao) return;
        let base64 = anexoParaImpressao.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
    }

    async function handleDocumento(aprovacao: Rdv) {
        console.log(aprovacao);

        if (!aprovacao.idmov || !aprovacao.codigo_atendimento) return;
        setIsLoading(true)

        const data = await getAnexoByIdmov(aprovacao.idmov, aprovacao.codigo_atendimento);
        const arquivoBase64 = data.arquivo;
        setArquivoParaImpressao(arquivoBase64);
        const anexo: AnexoRdv = {
            anexo: arquivoBase64,
            nome: `Documento RDV n° ${aprovacao.id}`
        };
        setDocumentoSelecionado(anexo);
        setSelectedResult(aprovacao);
        try {
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalVisualizarDocumentoOpen(true)
        }
    }

    function handleImprimirDocumento() {
        if (!arquivoParaImpressao) return;
        let base64 = arquivoParaImpressao.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
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

    async function confirmarAssinatura(signData: PdfSignData) {
        const dadosAssinatura: AssinarRdv = {
            idrdv: selectedResult!.id!,
            arquivo: selectedResult!.arquivo!,
            pagina: signData.page,
            posX: signData.posX,
            posY: signData.posY,
            largura: signData.largura,
            altura: signData.altura,
        };
        await handleAssinar(dadosAssinatura);
        await handleRefresh()
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
                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovadores(row.original)}>
                                Aprovadores
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
        <div className="p-3 sm:p-6">
            {/* Filtros */}
            <Card className="mb-6">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-xl sm:text-2xl font-bold leading-tight">{titulo}</CardTitle>
                    <div className="flex flex-wrap justify-start md:justify-end items-end gap-3 w-full md:w-auto">
                        {/* Datas: no mobile em coluna, em telas maiores lado a lado */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="flex flex-col flex-1 sm:flex-initial sm:w-40 min-w-0">
                                <Label htmlFor="dateFrom">Data de</Label>
                                <Input
                                    id="dateFrom"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full min-w-[140px] max-w-[200px] sm:w-40"
                                />
                            </div>

                            <div className="flex flex-col flex-1 sm:flex-initial sm:w-40 min-w-0">
                                <Label htmlFor="dateTo">Data até</Label>
                                <Input
                                    id="dateTo"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full min-w-[140px] max-w-[200px] sm:w-40"
                                />
                            </div>
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90vh]">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90vh]">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90vh]">
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
            <PdfViewerDialog
                open={isModalVisualizarAnexoOpen}
                onOpenChange={setIsModalVisualizarAnexoOpen}
                title={anexoSelecionado ? `Anexo ${anexoSelecionado.nome}` : ''}
                pdfBase64={anexoSelecionado?.anexo ?? null}
                onPrint={handleImprimirAnexo}
                isLoading={isLoading}
            />

            {/* Visualizar documento */}
            <PdfViewerDialog
                open={isModalVisualizarDocumentoOpen}
                onOpenChange={setIsModalVisualizarDocumentoOpen}
                title={documentoSelecionado ? `Documento ${documentoSelecionado.nome}` : ''}
                pdfBase64={documentoSelecionado?.anexo ?? null}
                canSign={selectedResult ? !selectedResult.arquivo_assinado : false}
                onSign={confirmarAssinatura}
                onPrint={handleImprimirDocumento}
                isLoading={isLoading}
            />

            {error && (<p className="mb-4 text-center text-sm text-destructive"> Erro: {error} </p>)}
        </div >
    )
}
