'use client'

import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from "@/components/ui/button";
import { Pagamento, PagamentoAprovador, PagamentoGetAll, PagamentoAprovadoresGetAll, getAll, getAllAprovadores, PagamentoAprovar, aprovarPagamento, PagamentoGerarDocumento, gerarDocumento, getDocumento, PagamentoGetDocumento, PagamentoAssinarDocumento, assinarDocumento } from "@/services/pagamentosService";
import { notificarAprovador } from '@/services/requisicoesService';
import { dateToIso, htmlToPdfBase64, imprimirPdfBase64, safeDateLabel, stripDiacritics, toMoney } from "@/utils/functions";
import { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { Label } from '@radix-ui/react-label';
import { useEffect, useMemo, useRef, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Bell, Check, Filter, Loader2, SearchIcon, X } from "lucide-react";
import { DataTable } from '@/components/ui/data-table'
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog';
import { toast } from 'sonner';

interface Props {
    titulo: string;
    grupo: string;
}

export default function Page({ titulo, grupo }: Props) {
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("EM ABERTO")
    const [statusFiltrado, setStatusFiltrado] = useState<string>("")
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Pagamento[]>([])
    const [selectedResult, setSelectedResult] = useState<Pagamento | null>(null)
    const [resultsAprovadores, setResultsAprovadores] = useState<PagamentoAprovador[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [documentoParaAssinatura, setDocumentoParaAssinatura] = useState<string>("")
    const [documentoSelecionado, setDocumentoSelecionado] = useState<string>("")
    const [isModalDocumentoOpen, setIsModalDocumentoOpen] = useState(false)
    const [documentoParaImpressao, setDocumentoParaImpressao] = useState<string | null>(null)

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
            setUserName(user.nome.toUpperCase());
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            handleSearch("")
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [dateFrom, dateTo, situacaoFiltrada, statusFiltrado])

    function clearQuery() {
        setQuery('')
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    async function handleSearchClick() {
        setIsLoading(true)
        await handleSearch(query)
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
            const data: PagamentoGetAll = {
                dateFrom: from,
                dateTo: to,
                grupo: grupo,
                status: situacaoFiltrada,
                situacao: statusFiltrado,
            };
            const dados = await getAll(data)

            const qNorm = stripDiacritics(q.toLowerCase().trim())

            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.tipo_documento ?? '').toLowerCase())
                const matchQuery = qNorm === "" || movimento.includes(qNorm) || String(d.idlan ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.status_lancamento == situacaoFiltrada
                const matchStatus = statusFiltrado === "" || d.status_aprovacao == statusFiltrado
                return matchQuery && matchSituacao && matchStatus
            })
            setResults(filtrados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleAprovacoes(data: Pagamento) {
        setIsLoading(true)
        setError(null)
        setSelectedResult(data)
        try {
            const dataAprovadores: PagamentoAprovadoresGetAll = {
                id: data.idlan,
                grupo: grupo
            };
            const dados = await getAllAprovadores(dataAprovadores)
            setResultsAprovadores(dados)
            setIsModalAprovacoesOpen(true);
        } catch (err) {
            setError((err as Error).message)
            setResultsAprovadores([])
            setSelectedResult(null)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleAprovar(data: Pagamento) {
        setIsLoading(true)
        setError(null)
        try {
            const dataAprovadores: PagamentoAprovar = {
                id: data.idlan,
                aprovacao: 'A',
                aprovar: true,
                grupo: grupo
            };
            await aprovarPagamento(dataAprovadores);
            await handleSearchClick();
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleReprovar(data: Pagamento) {
        setIsLoading(true)
        setError(null)
        try {
            const dataAprovadores: PagamentoAprovar = {
                id: data.idlan,
                aprovacao: 'R',
                aprovar: false,
                grupo: grupo
            };
            await aprovarPagamento(dataAprovadores);
            await handleSearchClick();
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setIsLoading(false)
        }
    }

    async function handleGerarDocumento(data: Pagamento) {
        setIsLoading(true);
        const html = `
          <html>
            <head>
              <title>Autorização de Pagamento</title>
              <style>
                body {
                  font-family: Arial, Helvetica, sans-serif;
                  padding: 20px;
                  color: #000;
                }
      
                .container {
                  width: 100%;
                  border: 1px solid #000;
                }
      
                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid #000;
                  padding: 10px;
                }
      
                .titulo {
                  text-align: center;
                  font-weight: bold;
                  font-size: 18px;
                  flex: 1;
                }
      
                .info-topo {
                  font-size: 12px;
                  text-align: right;
                }
      
                .linha {
                  border-bottom: 1px solid #000;
                  padding: 6px 10px;
                  font-size: 13px;
                }
      
                .historico {
                  padding: 10px;
                  min-height: 60px;
                  font-size: 13px;
                }
      
                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 13px;
                }
      
                td {
                  border: 1px solid #000;
                  padding: 6px;
                }
      
                .label {
                  font-weight: bold;
                  width: 180px;
                }
      
                .valor-final {
                  font-size: 18px;
                  font-weight: bold;
                  text-align: right;
                  padding-right: 20px;
                }
      
                .right {
                  text-align: right;
                }
      
                @media print {
                  body {
                    margin: 0;
                  }
                }
              </style>
            </head>
            <body>
              <div class="container">
                
                <div class="header">
                  <div>
                  <img src="/way.jpg" style="width: 120px;" />
                  </div>
      
                  <div class="titulo">
                    Autorização de Pagamento Financeiro
                  </div>
      
                  <div class="info-topo">
                    <div><strong>Data/Hora Emissão:</strong></div>
                    <div>${new Date().toLocaleString("pt-BR")}</div>
                  </div>
                </div>
      
                <div class="linha">
                  <strong>Documento:</strong> ${data.numero_documento}
                  &nbsp;&nbsp;&nbsp;
                  <strong>Tipo:</strong> ${data.tipo_documento}
                </div>
      
                <div class="linha">
                  <strong>Data de Vencimento:</strong> ${safeDateLabel(data.data_vencimento)}
                  &nbsp;&nbsp;&nbsp;
                  <strong>Previsão de Baixa:</strong> ${safeDateLabel(data.data_prev_baixa)}
                </div>
      
                <div class="historico">
                    <strong>Histórico do Lançamento:</strong> ${data.historico}
                </div>
      
                <table>
                  <tr>
                    <td class="label">Valor Documento</td>
                    <td class="right">${toMoney(data.valor_original)}</td>
                  </tr>
                  <tr>
                    <td class="label">Tributos</td>
                    <td class="right">${toMoney(data.tributos)}</td>
                  </tr>
                  <tr>
                    <td class="label">Multas</td>
                    <td class="right">${toMoney(data.multas)}</td>
                  </tr>
                  <tr>
                    <td class="label">Caução</td>
                    <td class="right">${toMoney(data.caucao)}</td>
                  </tr>
                  <tr>
                    <td class="label"><strong>Valor a Ser Pago</strong></td>
                    <td class="valor-final">${toMoney(data.valor_liquido)}</td>
                  </tr>
                </table>
                <br/><br/>

                <table style="margin-top:30px;">
                  <tr>
                    <td colspan="3" style="text-align:center; font-weight:bold;">
                      APROVAÇÃO
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align:center; font-weight:bold;">
                      FINANCEIRO
                    </td>
                    <td style="text-align:center; font-weight:bold;">
                      CONTROLADORIA
                    </td>
                    <td style="text-align:center; font-weight:bold;">
                      DIRETORIA
                    </td>
                  </tr>
                  <tr>
                    <td style="height:100px;"></td>
                    <td></td>
                    <td></td>
                  </tr>
                </table>
              </div>
            </body>
          </html>
        `;
        // const win = window.open("", "_blank");
        // if (win) {
        //     win.document.write(html);
        //     win.document.close();
        //     win.focus();
        // }
        const base64pdf = await htmlToPdfBase64(html);
        const payload: PagamentoGerarDocumento = {
            idlan: data.idlan,
            arquivo: base64pdf,
            grupo: grupo
        }
        try {
            await gerarDocumento(payload);
            await handleSearchClick();
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDocumento(data: Pagamento) {
        setIsLoading(true)
        try {
            const payload: PagamentoGetDocumento = {
                idlan: data.idlan,
                grupo: grupo
            }
            const arquivo = await getDocumento(payload);
            const pdfClean = arquivo.replace(/^data:.*;base64,/, '').trim();
            setDocumentoParaImpressao(pdfClean);
            setDocumentoParaAssinatura(arquivo);
            setSelectedResult(data)
            const arquivoBase64 = arquivo.replace(/^data:.*;base64,/, '').trim();
            setDocumentoSelecionado(arquivoBase64);
            setIsModalDocumentoOpen(true)
        } catch (err) {
            console.log(err);
        } finally {
            setIsLoading(false)
        }
    }

    function handleImprimir() {
        if (!documentoParaImpressao) return;
        imprimirPdfBase64(documentoParaImpressao);
    }

    async function confirmarAssinatura(signData: PdfSignData) {
        setIsLoading(true)
        try {
            const dadosAssinatura: PagamentoAssinarDocumento = {
                idlan: selectedResult!.idlan,
                caminho: selectedResult!.caminho_anexo,
                grupo: grupo,
                arquivo: documentoParaAssinatura!,
                pagina: signData.page,
                posX: signData.posX,
                posY: signData.posY,
                largura: signData.largura,
                altura: signData.altura,
            };
            await assinarDocumento(dadosAssinatura);
            handleSearchClick()
            toast.success("Pagamento assinado com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalDocumentoOpen(false)
            setIsLoading(false)
        }
    }

    const colunas = useMemo<ColumnDef<Pagamento>[]>(
        () => [
            { accessorKey: 'idlan', header: 'ID' },
            { accessorKey: 'nome_fantasia', header: 'Fantasia' },
            { accessorKey: 'numero_documento', header: 'N° Documento' },
            { accessorKey: 'tipo_documento', header: 'Tipo Documento' },
            { accessorKey: 'historico', header: 'Histórico', accessorFn: (row) => row.historico.length > 50 ? row.historico.slice(0, 50) + '...' : row.historico },
            { accessorKey: 'usuario_criacao', header: 'Usuário Criação' },
            { accessorKey: 'status_lancamento', header: 'Status' },
            { accessorKey: 'status_aprovacao', header: 'Situação' },
            { accessorKey: 'data_criacao', header: 'Data Criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'data_vencimento', header: 'Data Vencimento', accessorFn: (row) => safeDateLabel(row.data_vencimento) },
            { accessorKey: 'data_prev_baixa', header: 'Data Prev Baixa', accessorFn: (row) => safeDateLabel(row.data_prev_baixa) },
            { accessorKey: 'tributos', header: 'Tributos', accessorFn: (row) => toMoney(row.tributos) },
            { accessorKey: 'multas', header: 'Multas', accessorFn: (row) => toMoney(row.multas) },
            { accessorKey: 'caucao', header: 'Caução', accessorFn: (row) => toMoney(row.caucao) },
            { accessorKey: 'valor_liquido', header: 'Valor Líquido', accessorFn: (row) => toMoney(row.valor_liquido) },
            { accessorKey: 'valor_original', header: 'Valor Original', accessorFn: (row) => toMoney(row.valor_original) },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const status_liberado = ['EM ABERTO'].includes(row.original.status_lancamento);
                    const podeAprovar = row.original.pode_aprovar && status_liberado && row.original.documento_assinado;
                    const podeReprovar = row.original.pode_reprovar && status_liberado;
                    return (
                        <div className="flex gap-2">
                            {!row.original.possui_documento && (<Button size="sm" variant="outline" onClick={() => handleGerarDocumento(row.original)}>
                                Gerar Documento
                            </Button>)}
                            {row.original.possui_documento && (<Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                Documento {row.original.documento_assinado && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>)}
                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeReprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleReprovar(row.original)}
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

    async function handleNotificarAprovador(usuario: string) {
        if (!selectedResult) return
        try {
            const msg = await notificarAprovador(
                selectedResult.idlan,
                0,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const colunasAprovacoes = useMemo<ColumnDef<PagamentoAprovador>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) },
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

    return (
        <div className="p-6">
            {/* Cabeçalho */}
            <Card className="mb-6">
                {/* Filtros */}
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

                        {/* Status */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Status</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"EM ABERTO"} checked={situacaoFiltrada == "EM ABERTO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("EM ABERTO") }}>EM ABERTO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"BAIXADO"} checked={situacaoFiltrada == "BAIXADO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("BAIXADO") }}>BAIXADO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"BAIXADO PARCIALMENTE"} checked={situacaoFiltrada == "BAIXADO PARCIALMENTE"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("BAIXADO PARCIALMENTE") }}>BAIXADO PARCIALMENTE</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"CANCELADO"} checked={situacaoFiltrada == "CANCELADO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("CANCELADO") }}>CANCELADO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("") }}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Situação */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Situação</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Situação</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem key={"PENDENTE"} checked={statusFiltrado == "PENDENTE"} onCheckedChange={(checked) => { if (checked) setStatusFiltrado("PENDENTE") }}>PENDENTE</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"APROVADA"} checked={statusFiltrado == "APROVADA"} onCheckedChange={(checked) => { if (checked) setStatusFiltrado("APROVADA") }}>APROVADA</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"RECUSADA"} checked={statusFiltrado == "RECUSADA"} onCheckedChange={(checked) => { if (checked) setStatusFiltrado("RECUSADA") }}>RECUSADA</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={statusFiltrado == ""} onCheckedChange={(checked) => { if (checked) setStatusFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
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

            {/* Main */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
                </CardContent>
            </Card>

            {/* Aprovações */}
            {selectedResult && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${selectedResult.idlan}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={resultsAprovadores} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Documento */}
            <PdfViewerDialog
                open={isModalDocumentoOpen}
                onOpenChange={setIsModalDocumentoOpen}
                title={selectedResult ? `Pagamento n° ${selectedResult.idlan}` : ""}
                pdfBase64={documentoSelecionado}
                canSign={!!selectedResult && !selectedResult.documento_assinado}
                onSign={confirmarAssinatura}
                onPrint={handleImprimir}
                isLoading={isLoading}
            />

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
        </div>
    )
}
