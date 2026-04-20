'use client'

import { Button } from "@/components/ui/button";
import { FiscalDocumento, FiscalGetAll, FiscalGetDocumento, FiscalResponseDto, assinar, getAll, getDocumento, FiscalAssinar, FiscalAprovarDocumento, aprovarFiscal, getAllAnexos } from "@/services/fiscalService";
import { notificarAprovador } from '@/services/requisicoesService';
import { FiscalAprovacao, FiscalItem } from "@/types/Fiscal";
import { base64ToBlob, dateToIso, safeDateLabel, stripDiacritics, toBase64, toMoney } from "@/utils/functions";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import PdfViewerDialog, { PdfSignData } from "@/components/PdfViewerDialog";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { Bell, Check, Filter, RefreshCw, SearchIcon, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@radix-ui/react-label';
import { createElement as createAnexo } from "@/services/anexoService";

function parseFiscalAnexoBase64(anexo: string): { base64: string; mime: string } {
    const t = anexo.trim();
    if (t.startsWith("data:")) {
        const semi = t.indexOf(";");
        const comma = t.indexOf(",");
        if (comma > semi && semi > 0) {
            return { mime: t.slice(5, semi), base64: t.slice(comma + 1) };
        }
    }
    return { base64: t.replace(/^data:.*;base64,/, ""), mime: "application/pdf" };
}

function extForMime(mime: string): string {
    if (mime === "application/pdf") return ".pdf";
    if (mime === "image/png") return ".png";
    if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
    if (mime === "image/gif") return ".gif";
    if (mime === "image/webp") return ".webp";
    if (mime.startsWith("image/")) return ".img";
    return ".bin";
}

function safeAnexoFileName(nome: string, id: number): string {
    const base = (nome || `anexo_${id}`).replace(/[/\\?%*:|"<>]/g, "_").trim() || `anexo_${id}`;
    return base;
}

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
    const [isPending, startTransition] = useTransition()
    const [tipoMovimentoFiltrado, setTipoMovimentoFiltrado] = useState<string>("")
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("Em Andamento")
    const [solicitantes, setSolicitantes] = useState<string[]>([])
    const [tiposMovimento, setTiposMovimento] = useState<string[]>([])
    const [podeAssinar, setPodeAssinar] = useState(false)
    const [novoAnexoFile, setNovoAnexoFile] = useState<File | null>(null)
    const [novoAnexoNome, setNovoAnexoNome] = useState<string>("")
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

            // Regra global: pendências ("Em Andamento") não limitam por período.
            const isPendente = stripDiacritics((situacaoFiltrada ?? "").toUpperCase().trim()) === "EM ANDAMENTO"
            const fromApi = isPendente ? "1900-01-01" : from

            const data: FiscalGetAll = {
                dateFrom: fromApi,
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
            setSelectedDocumento(responseData);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalDocumentosOpen(true)
        }
    }

    async function handleAnexo(requisicao: FiscalDocumento, tipo: string) {
        setIsLoading(true)
        setPodeAssinar(false);
        setSelectedDocumentoTipo(tipo);
        try {
            const arquivoBase64 = requisicao.anexo;
            setSelectedDocumento(arquivoBase64);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalDocumentosOpen(true)
        }
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

    async function confirmarAssinatura(data: PdfSignData) {
        if (!selectedResult || selectedDocumentoTipo != "fiscal" || !selectedDocumento) return;
        const dadosAssinatura: FiscalAssinar = {
            idmov: selectedResult.fiscal.idmov,
            atendimento: selectedResult.movimento.codigo_atendimento,
            arquivo: selectedDocumento,
            pagina: data.page,
            posX: data.posX,
            posY: data.posY,
            largura: data.largura,
            altura: data.altura,
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
            setNovoAnexoFile(null)
            setNovoAnexoNome("")
            setIsModalAnexosOpen(true)
        }
    }    

    async function handleAnexarNovoAnexo() {
        if (!selectedResult) return;
        if (!novoAnexoFile) return toast.error("Selecione um arquivo para anexar.");

        setIsLoading(true)
        try {
            const base64 = await toBase64(novoAnexoFile)
            const nome = (novoAnexoNome || novoAnexoFile.name || "anexo").trim()

            await createAnexo({
                idmov: selectedResult.movimento.idmov,
                anexo: base64,
                nome: nome,
            })

            const dados = await getAllAnexos(selectedResult.movimento.idmov)
            setResultAnexos(dados)
            setNovoAnexoFile(null)
            setNovoAnexoNome("")
            toast.success("Anexo incluído com sucesso!")
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownloadAnexoFiscal = useCallback((doc: FiscalDocumento) => {
        if (!doc.anexo) return;
        try {
            const { base64, mime } = parseFiscalAnexoBase64(doc.anexo);
            const blob = base64ToBlob(base64, mime);
            const ext = extForMime(mime);
            let name = safeAnexoFileName(doc.nome, doc.id);
            if (!name.toLowerCase().endsWith(ext)) name += ext;
            saveAs(blob, name);
        } catch (err) {
            toast.error((err as Error).message || "Não foi possível baixar o anexo.");
        }
    }, []);

    const handleDownloadAllAnexosFiscal = useCallback(async () => {
        if (!resultAnexos?.length || !selectedResult) return;
        try {
            const zip = new JSZip();
            const folder = zip.folder("anexos");
            if (!folder) throw new Error("Não foi possível criar o arquivo ZIP.");
            for (const doc of resultAnexos) {
                if (!doc.anexo) continue;
                try {
                    const { base64, mime } = parseFiscalAnexoBase64(doc.anexo);
                    const blob = base64ToBlob(base64, mime);
                    const ext = extForMime(mime);
                    let name = safeAnexoFileName(doc.nome, doc.id);
                    if (!name.toLowerCase().endsWith(ext)) name += ext;
                    folder.file(name, blob);
                } catch (e) {
                    console.error("Erro ao incluir anexo no ZIP:", doc, e);
                }
            }
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `anexos_mov_${selectedResult.fiscal.idmov}.zip`);
        } catch (err) {
            toast.error((err as Error).message || "Não foi possível gerar o arquivo ZIP.");
        }
    }, [resultAnexos, selectedResult]);

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

    async function handleNotificarAprovador(usuario: string) {
        if (!selectedResult) return
        try {
            const msg = await notificarAprovador(
                selectedResult.movimento.idmov,
                selectedResult.movimento.codigo_atendimento,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const colunasAprovacoes = useMemo<ColumnDef<FiscalAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'situacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabel(row.data_aprovacao) },
            {
                id: 'actions',
                header: '',
                cell: ({ row }) => row.original.situacao !== 'A' ? (
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

    const colunasAnexos = useMemo<ColumnDef<FiscalDocumento>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'nome', header: 'Anexo' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2 flex-wrap">
                        {row.original.anexo && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAnexo(row.original, "anexo")}
                            >
                                Visualizar
                            </Button>
                        )}
                        {row.original.anexo && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-400 border-amber-500/50 hover:bg-amber-500/10"
                                onClick={() => handleDownloadAnexoFiscal(row.original)}
                            >
                                Baixar
                            </Button>
                        )}
                    </div>
                )
            }
        ],
        [handleDownloadAnexoFiscal]
    )

    return (
        <div className="p-6">
            {/* Cabeçalho */}
            <Card className="mb-6">
                {/* Filtros */}
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle className="text-2xl font-bold">Painel Fiscal</CardTitle>
                    <div className="flex flex-wrap justify-end items-end gap-4">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${selectedResult.fiscal.idmov}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <Card className="p-4 mb-4">
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                        <div className="flex flex-col gap-1">
                                            <Label>Arquivo</Label>
                                            <Input
                                                type="file"
                                                accept="application/pdf,image/*"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0] ?? null
                                                    setNovoAnexoFile(f)
                                                    if (f && !novoAnexoNome) setNovoAnexoNome(f.name)
                                                }}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 md:col-span-2">
                                            <Label>Nome do anexo</Label>
                                            <Input
                                                value={novoAnexoNome}
                                                onChange={(e) => setNovoAnexoNome(e.target.value)}
                                                placeholder="Ex.: Nota fiscal, Comprovante, Foto..."
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            onClick={handleAnexarNovoAnexo}
                                            disabled={isLoading || !novoAnexoFile}
                                        >
                                            {isLoading ? "Anexando..." : "Anexar"}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                            <DataTable
                                columns={colunasAnexos}
                                data={resultAnexos}
                                loading={isLoading}
                                paginationExtra={
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={!resultAnexos.length || isLoading}
                                        className="text-amber-400 border-amber-500/50 hover:bg-amber-500/10"
                                        onClick={() => void handleDownloadAllAnexosFiscal()}
                                    >
                                        Baixar Todos
                                    </Button>
                                }
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Documento */}
            <PdfViewerDialog
                open={isModalDocumentosOpen}
                onOpenChange={setIsModalDocumentosOpen}
                title={(() => {
                    if (!selectedResult || !selectedDocumentoTipo) return "";
                    switch (selectedDocumentoTipo) {
                        case "anexo":
                            return "Visualizar anexo";
                        case "movimento":
                            return `Documento movimentação n° ${selectedResult.movimento.idmov}`;
                        default:
                            return `Documento fiscal n° ${selectedResult.fiscal.idmov}`;
                    }
                })()}
                pdfBase64={selectedDocumento || null}
                canSign={selectedDocumentoTipo === "fiscal" && !!selectedResult && selectedResult.fiscal.documento_assinado == 0 && podeAssinar}
                onSign={confirmarAssinatura}
                isLoading={isLoading}
            />

            {/* Loading */}
            <Dialog open={isLoading} onOpenChange={setIsLoading}>
                <DialogContent
                    showCloseButton={false}
                    scrollBody={false}
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
