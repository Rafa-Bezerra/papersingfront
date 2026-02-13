'use client'

import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from "@/components/ui/button";
import { Pagamento, PagamentoAprovador, PagamentoGetAll, PagamentoAprovadoresGetAll, getAll, getAllAprovadores, PagamentoAprovar, aprovarPagamento } from "@/services/pagamentosService";
import { dateToIso, safeDateLabel, stripDiacritics, toMoney } from "@/utils/functions";
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
import { Filter, Loader2, SearchIcon, X } from "lucide-react";
import { DataTable } from '@/components/ui/data-table'

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
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Pagamento[]>([])
    const [selectedResult, setSelectedResult] = useState<Pagamento | null>(null)
    const [resultsAprovadores, setResultsAprovadores] = useState<PagamentoAprovador[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)

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
    }, [dateFrom, dateTo, situacaoFiltrada])

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
                status: situacaoFiltrada
            };
            const dados = await getAll(data)

            const qNorm = stripDiacritics(q.toLowerCase().trim())

            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.tipo_documento ?? '').toLowerCase())
                const matchQuery = qNorm === "" || movimento.includes(qNorm) || String(d.idlan ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.status_lancamento == situacaoFiltrada
                return matchQuery && matchSituacao
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
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
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
                    const podeAprovar = row.original.pode_aprovar && status_liberado;
                    const podeReprovar = row.original.pode_reprovar && status_liberado;
                    return (
                        <div className="flex gap-2">
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

    const colunasAprovacoes = useMemo<ColumnDef<PagamentoAprovador>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) }
        ],
        []
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
                                <DropdownMenuCheckboxItem key={"EM ABERTO"} checked={situacaoFiltrada == "EM ABERTO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("EM ABERTO") }}>EM ABERTO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"BAIXADO"} checked={situacaoFiltrada == "BAIXADO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("BAIXADO") }}>BAIXADO</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"BAIXADO PARCIALMENTE"} checked={situacaoFiltrada == "BAIXADO PARCIALMENTE"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("BAIXADO PARCIALMENTE") }}>BAIXADO PARCIALMENTE</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"CANCELADO"} checked={situacaoFiltrada == "CANCELADO"} onCheckedChange={(checked) => { if (checked) setSituacaoFiltrada("CANCELADO") }}>CANCELADO</DropdownMenuCheckboxItem>
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
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${selectedResult.idlan}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={resultsAprovadores} loading={isLoading} />
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
        </div>
    )
}