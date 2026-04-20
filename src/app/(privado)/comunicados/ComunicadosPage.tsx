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
import { Bell, Check, ChevronsUpDown, Eye, Filter, SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'

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
import { imprimirPdfBase64, safeDateLabel, stripDiacritics, toBase64 } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog'
import { adicionarAprovador, aprovar, deleteElement, Comunicado, ComunicadoAprovacao, ComunicadoAssinar, getAll, updateElement, getAnexo, getDocumento, createElement } from '@/services/comunicadoService';
import { notificarAprovador } from '@/services/requisicoesService';
import { useForm, UseFormReturn } from 'react-hook-form';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'
import { useFieldArray } from "react-hook-form";
import {
    Usuario,
    getAll as getAllUsuarios
} from '@/services/usuariosService'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
} from "@/components/ui/command"
import { PopoverPortal } from '@radix-ui/react-popover';
import {
    ComunicadoAnexo,
    // ComunicadoPagamentos
} from '@/types/Comunicado'
import { CentroDeCusto, ContaFinanceira, getAllCentrosDeCusto, getAllContasFinanceiras } from '@/services/carrinhoService'
import { Label } from '@/components/ui/label'

export default function Page() {
    const titulo = 'Pagamentos CI'
    const router = useRouter()
    const searchParams = useSearchParams()
    const [logo, setLogo] = useState("/way.jpg");
    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [userCodusuario, setCodusuario] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Comunicado[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<Comunicado>()
    const [requisicaoAprovacoesSelecionada, setRequisicaoAprovacoesSelecionada] = useState<ComunicadoAprovacao[]>([])
    const [requisicaoComunicadoSelecionada, setRequisicaoComunicadoSelecionada] = useState<string>("")
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    const [isModalComunicadosOpen, setIsModalComunicadosOpen] = useState(false)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const [isFormComunicadoOpen, setIsFormComunicadoOpen] = useState(false)
    const [isFormAprovadoresOpen, setIsFormAprovadoresOpen] = useState(false)
    const [updateComunicadoMode, setUpdateComunicadoMode] = useState(false)
    const [deleteComunicadoId, setDeleteComunicadoId] = useState<number | null>(null);
    const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null);
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [anexoParaAssinatura, setAnexoParaAssinatura] = useState<string>("")
    const [arquivoParaImpressao, setArquivoParaImpressao] = useState<string | null>(null)
    const carregou = useRef(false)

    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
    const [openCodcontaIndex, setOpenCodcontaIndex] = useState<number | null>(null)
    const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
    const [openCcustoIndex, setOpenCcustoIndex] = useState<number | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")

    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [selectedAnexosResult, setSelectedAnexosResult] = useState<ComunicadoAnexo[]>([])

    const [anexosSubmit, setAnexosSubmit] = useState<ComunicadoAnexo[]>([])
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const [anexoSelecionado, setAnexoSelecionado] = useState<ComunicadoAnexo | null>(null)
    const [anexoParaImpressao, setAnexoParaImpressao] = useState<string | null>(null)
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [solicitantes, setSolicitantes] = useState<string[]>([])

    const form = useForm<Comunicado>({
        defaultValues: {
            id: 0,
            anexo: '',
            nome: '',
            aprovadores: [],
            pessoa_destinada: '',
            cargo: '',
            cidade_origem: '',
            concessionaria: '',
            itensFinanceiros: [{ setor: '', ccusto: '', codconta: '', valor: 0 }],
            rodape: '',
            pagamentos: [],
        }
    })

    const formAprovadores = useForm<ComunicadoAprovacao>({
        defaultValues: {
            id: 0,
            usuario: '',
            data_aprovacao: '',
            aprovacao: '',
        }
    })

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    useEffect(() => {
        if (carregou.current) return;
        buscaUsuarios();
        buscaDados();
    }, [])

    async function buscaUsuarios() {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllUsuarios()
            setUsuarios(dados)
            carregou.current = true;
        } catch (err) {
            setError((err as Error).message)
            setUsuarios([])
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
    }

    async function buscaDados() {
        setIsLoading(true)
        setError(null)
        try {
            const ccustos = await getAllCentrosDeCusto();
            setCentrosDeCusto(ccustos)
            const contas = await getAllContasFinanceiras("TODAS");
            const contasUnicas = Array.from(
                new Map(contas.map(c => [c.codconta, c])).values()
            );

            setContasFinanceiras(contasUnicas);
        } catch (err) {
            setError((err as Error).message)
            setCentrosDeCusto([])
            setContasFinanceiras([])
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
            switch (user.unidade) {
                case "WAY 112":
                    setLogo("/logos/way112.png");
                    break;
                case "WAY 153":
                    setLogo("/logos/way153.png");
                    break;
                case "WAY 262":
                    setLogo("/logos/way262.png");
                    break;
                case "WAY 306":
                    setLogo("/logos/way306.png");
                    break;
                case "WAY 364":
                    setLogo("/logos/way364.png");
                    break;
                default:
                    setLogo("/way.jpg");
                    break;
            }
        }

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            startTransition(() => {
                const sp = new URLSearchParams(Array.from(searchParams.entries()))
                if (query) sp.set('q', query)
                else sp.delete('q')
                router.replace(`?${sp.toString()}`)
            })
            setIsLoading(isPending)
            handleSearch(query)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, situacaoFiltrada, dateFrom, dateTo, solicitanteFiltrado])

    async function handleSearch(q: string) {
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAll()

            const solicitantesUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.usuario_nome)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setSolicitantes(solicitantesUnicos)

            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const matchQuery = qNorm === "" || String(d.nome ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada === "" || d.situacao == situacaoFiltrada
                const matchSolicitante = solicitanteFiltrado === "" || d.usuario_nome == solicitanteFiltrado

                // Regra global: pendências ("Em Andamento") não limitam por período.
                const situacaoNorm = stripDiacritics(String(d.situacao ?? '').toUpperCase().trim())
                const isPendente = situacaoNorm === "EM ANDAMENTO"
                const matchDateFrom = isPendente || dateFrom === "" || new Date(d.data_criacao) >= new Date(dateFrom)
                const matchDateTo = isPendente || dateTo === "" || new Date(d.data_criacao) <= new Date(dateTo + "T23:59:59")

                return matchQuery && matchSituacao && matchSolicitante && matchDateFrom && matchDateTo
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

    async function handleComunicado(requisicao: Comunicado) {
        setIsLoading(true)
        try {
            const arquivo = await getDocumento(requisicao.id);
            const pdfClean = arquivo.replace(/^data:.*;base64,/, '').trim();
            setArquivoParaImpressao(pdfClean);
            setRequisicaoComunicadoSelecionada(pdfClean);
            setAnexoParaAssinatura(pdfClean);
            setRequisicaoSelecionada(requisicao)
            setIsModalComunicadosOpen(true)
        } catch (err) {
            console.log(err);
        } finally {
            setIsLoading(false)
        }
    }

    async function confirmarAssinatura(data: PdfSignData) {
        setIsLoading(true)
        try {
            const dadosAssinatura: ComunicadoAssinar = {
                id: requisicaoSelecionada!.id,
                anexo: anexoParaAssinatura!,
                pagina: data.page,
                posX: data.posX,
                posY: data.posY,
                largura: data.largura,
                altura: data.altura,
            };
            await updateElement(dadosAssinatura);
            handleSearchClick()
            toast.success("Pagamento assinado com sucesso!");
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsModalComunicadosOpen(false)
            setIsLoading(false)
        }
    }

    function handleImprimir() {
        if (!arquivoParaImpressao) return;
        let base64 = arquivoParaImpressao.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
    }

    async function handleAprovacoes(requisicao: Comunicado) {
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.aprovadores)
    }

    async function handleAnexos(requisicao: Comunicado) {
        setIsModalAnexosOpen(true)
        setRequisicaoSelecionada(requisicao)
        setSelectedAnexosResult(requisicao.anexos)
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

    async function handleInserirComunicado() {
        form.reset({
            id: 0,
            anexo: '',
            nome: '',
            aprovadores: [],
            itensFinanceiros: [{ setor: '', ccusto: '', codconta: '', valor: 0 }],
        })
        setUpdateComunicadoMode(false)
        setIsFormComunicadoOpen(true)
    }

    async function handleExcluirComunicado() {
        if (!deleteComunicadoId) return
        try {
            await deleteElement(deleteComunicadoId)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Pagamento excluído`)
            setDeleteComunicadoId(null)
            await handleSearchClick()
        }
    }

    async function submitComunicado(data: Comunicado) {
        setIsLoading(true)

        const proxId = results.length > 0 ? Math.max(...results.map(x => x.id)) + 1 : 1;
        const html = gerarTemplateHTML(data, logo, proxId, centrosDeCusto, contasFinanceiras);

        // Carrega html2pdf.js na página atual se ainda não estiver carregado
        await new Promise<void>((resolve, reject) => {
            if (typeof (window as unknown as Record<string, unknown>).html2pdf !== 'undefined') { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            s.onload = () => resolve();
            s.onerror = reject;
            document.head.appendChild(s);
        });

        // Abre um popup mínimo (não uma aba) — sem CSS do Tailwind, evita erro oklch no html2canvas
        const popup = window.open('', '', 'width=10,height=10,left=-200,top=-200,toolbar=no,menubar=no,scrollbars=no,resizable=no');

        if (!popup) {
            toast.error('Popup bloqueado pelo navegador. Permita popups para este site.');
            setIsLoading(false);
            return;
        }

        popup.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gerando PDF...</title></head><body style="margin:0;padding:0;background:#fff;">
${html}
<script>
(function () {
    function loadScript(src) {
        return new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = src; s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js').then(function () {
        var opt = {
            margin: 0,
            filename: 'doc.pdf',
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(document.body).output('blob').then(function (blob) {
            var reader = new FileReader();
            reader.onloadend = function () {
                var base64 = reader.result.split(',')[1];
                if (window.opener) {
                    window.opener.postMessage({ base64: base64 }, '*');
                    setTimeout(function () { window.close(); }, 200);
                }
            };
            reader.readAsDataURL(blob);
        });
    });
})();
<\/script>
</body></html>`);
        popup.document.close();

        const base64 = await new Promise<string>((resolve) => {
            function handler(event: MessageEvent) {
                if (event.data?.base64) {
                    window.removeEventListener('message', handler);
                    resolve(event.data.base64);
                }
            }
            window.addEventListener('message', handler);
        });

        data.anexo = base64;
        data.anexos = anexosSubmit;

        setError(null)
        try {
            await createElement(data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            form.reset()
            await handleSearchClick()
            setIsFormComunicadoOpen(false)
            setIsLoading(false)
        }
    }

    async function handleInserirAprovador() {
        formAprovadores.reset({
            id: 0,
            usuario: ''
        })
        setIsFormAprovadoresOpen(true)
    }

    async function handleExcluirAprovador() {
        if (!deleteAprovadorId) return
        try {
            await deleteElement(deleteAprovadorId)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Aprovador excluído`)
            setDeleteAprovadorId(null)
            await handleSearchClick()
        }
    }

    async function handleSubmitAnexos() {
        setIsLoading(true)
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: ComunicadoAnexo = {
            anexo: base64,
            nome: fileName
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setFile(null)
        setFileName("")
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function handleVisualizarAnexo(anexo: ComunicadoAnexo) {
        setIsLoading(true)
        try {
            const arquivo = await getAnexo(anexo.anexo);
            const pdfClean = arquivo.replace(/^data:.*;base64,/, '').trim();
            setAnexoParaImpressao(pdfClean);
            setAnexoSelecionado(anexo);
            setIsModalVisualizarAnexoOpen(true)
        } catch (err) {
            console.log(err);
            toast.error("Não foi possível carregar o anexo.");
        } finally {
            setIsLoading(false)
        }
    }

    function handleImprimirAnexo() {
        if (!anexoParaImpressao) return;
        let base64 = anexoParaImpressao.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
    }

    async function submitAprovador(data: ComunicadoAprovacao) {
        setError(null)
        try {
            await adicionarAprovador(requisicaoSelecionada!.id, data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            formAprovadores.reset()
            setIsFormAprovadoresOpen(false)
            setIsModalAprovacoesOpen(false)
            await handleSearchClick()
        }
    }

    const colunas = useMemo<ColumnDef<Comunicado>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'data_criacao', header: 'Data criação', accessorFn: (row) => safeDateLabel(row.data_criacao) },
            { accessorKey: 'usuario_nome', header: 'Solicitante' },
            { accessorKey: 'nome', header: 'Descrição' },
            { id: 'ccusto', header: 'Centro de custo', accessorFn: (row) => row.itensFinanceiros?.[0]?.ccusto ?? '' },
            { id: 'codconta', header: 'Conta', accessorFn: (row) => row.itensFinanceiros?.[0]?.codconta ?? '' },
            { accessorKey: 'situacao', header: 'Situação' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const usuarioAprovador = row.original.aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );

                    const usuarioCriador = row.original.usuario_criacao.toLowerCase().trim() === userCodusuario.toLowerCase().trim();

                    const usuarioAprovou = row.original.aprovadores.some(ap =>
                        stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    );

                    const todasPendentes = row.original.aprovadores.every(ap => ap.aprovacao === 'P');
                    const status_bloqueado = ['Reprovado'].includes(row.original.situacao);

                    const assinouOuSemAnexo = row.original.anexo !== "SIM" || row.original.documento_assinado === 1;
                    const podeAprovar = (usuarioAprovador || usuarioCriador) && !usuarioAprovou && !status_bloqueado && assinouOuSemAnexo;
                    const podeReprovar = (usuarioAprovador || usuarioCriador) && !usuarioAprovou && !status_bloqueado;
                    const podeExcluir = usuarioCriador && todasPendentes;

                    return (
                        <div className="flex gap-2">
                            {row.original.anexo == "SIM" && (
                                <Button size="sm" variant="outline" onClick={() => handleComunicado(row.original)}>
                                    Documento {row.original.documento_assinado == 1 && (
                                        <Check className="w-4 h-4 text-green-500" />
                                    )}
                                </Button>
                            )}

                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original.id, 1)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeReprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original.id, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}
                            {podeExcluir && (<Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setDeleteComunicadoId(row.original.id); }}
                            >
                                Excluir
                            </Button>)}
                        </div>
                    );
                }
            }
        ],
        [userName]
    )

    async function handleNotificarAprovador(usuario: string) {
        if (!requisicaoSelecionada) return
        try {
            const msg = await notificarAprovador(
                requisicaoSelecionada.id,
                0,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const colunasAprovacoes = useMemo<ColumnDef<ComunicadoAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario_nome', header: 'Usuário' },
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

    const colunasAnexos = useMemo<ColumnDef<ComunicadoAnexo>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Usuário' },
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
            <Card className="mb-6">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                    <div className="flex flex-wrap justify-end items-end gap-3">
                        {/* Data de */}
                        <div className="flex flex-col">
                            <Label htmlFor="comDateFrom">Data de</Label>
                            <Input
                                id="comDateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Data até */}
                        <div className="flex flex-col">
                            <Label htmlFor="comDateTo">Data até</Label>
                            <Input
                                id="comDateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Solicitante */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Filtrar por solicitante">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Solicitante</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Solicitante</DropdownMenuLabel>
                                {solicitantes.map((s) => (
                                    <DropdownMenuCheckboxItem
                                        key={s}
                                        checked={solicitanteFiltrado === s}
                                        onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado(s) }}
                                    >
                                        {s}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuCheckboxItem checked={solicitanteFiltrado === ""} onCheckedChange={(checked) => { if (checked) setSolicitanteFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                <DropdownMenuCheckboxItem key={"Aprovados"} checked={situacaoFiltrada == "Aprovados"} onCheckedChange={() => setSituacaoFiltrada("Aprovados")}>Aprovados</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Reprovados"} checked={situacaoFiltrada == "Reprovados"} onCheckedChange={() => setSituacaoFiltrada("Reprovados")}>Reprovados</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={() => setSituacaoFiltrada("")}>Todos</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 md:flex-row">
                    <div className="relative flex-1 w-full">
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

                    <Button onClick={handleInserirComunicado} className="flex items-center">
                        <SquarePlus className="mr-1 h-4 w-4" /> Novo
                    </Button>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={isLoading} />
                </CardContent>
            </Card>

            {/* Aprovações */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${requisicaoSelecionada.id}`}</DialogTitle>
                            <Button onClick={handleInserirAprovador} className="flex items-center">
                                <SquarePlus className="mr-1 h-4 w-4" /> Novo aprovador
                            </Button>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAprovacoes} data={requisicaoAprovacoesSelecionada} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Comunicado */}
            <PdfViewerDialog
                open={isModalComunicadosOpen}
                onOpenChange={setIsModalComunicadosOpen}
                title={requisicaoSelecionada ? `Pagamento movimentação n° ${requisicaoSelecionada.id}` : ''}
                pdfBase64={requisicaoComunicadoSelecionada || null}
                canSign={requisicaoSelecionada?.documento_assinado == 0}
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

            {/* FORM Comunicado */}
            <Dialog open={isFormComunicadoOpen} onOpenChange={setIsFormComunicadoOpen}>
                <DialogContent className="max-w-2xl overflow-y-auto max-h-[90dvh]">
                    <div className="overflow-y-auto pr-2">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">
                                {updateComunicadoMode ? `Editar: ${requisicaoSelecionada?.nome}` : `Novo Comunicado`}
                            </DialogTitle>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(submitComunicado)} className="grid gap-4">
                                {/**nome */}
                                {/* <FormField
                                    control={form.control}
                                    name="nome"
                                    rules={{ required: 'Descrição é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descrição</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                /> */}

                                {/**cidade */}
                                {/* <FormField
                                    control={form.control}
                                    name="cidade_origem"
                                    rules={{ required: 'Cidade de origem destinada é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade de origem</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                /> */}

                                {/**pessoa */}
                                {/* <FormField
                                    control={form.control}
                                    name="pessoa_destinada"
                                    rules={{ required: 'Pessoa destinada é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pessoa destinada</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                /> */}

                                {/**cargo */}
                                {/* <FormField
                                    control={form.control}
                                    name="cargo"
                                    rules={{ required: 'Cargo é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cargo da pessoa destinada</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                /> */}

                                {/**concessionaria */}
                                {/* <FormField
                                    control={form.control}
                                    name="concessionaria"
                                    rules={{ required: 'Concessionária é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Concessionária de origem</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                /> */}

                                <FormField
                                    control={form.control}
                                    name="anexo"
                                    rules={{ required: 'Anexo é obrigatório' }}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Corpo do documento</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    {...field}
                                                    className="w-full h-60 p-2 border rounded-md resize-none"
                                                    placeholder="Digite o conteúdo do documento aqui..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <AprovadoresComunicadosSection form={form} usuarios={usuarios} />

                                {/* Bloco financeiro: múltiplos itens */}
                                <ItensFinanceirosSection
                                    form={form}
                                    centrosDeCusto={centrosDeCusto}
                                    contasFinanceiras={contasFinanceiras}
                                    openCcustoIndex={openCcustoIndex}
                                    setOpenCcustoIndex={setOpenCcustoIndex}
                                    openCodcontaIndex={openCodcontaIndex}
                                    setOpenCodcontaIndex={setOpenCodcontaIndex}
                                />

                                {/** rodapé */}
                                <FormField
                                    control={form.control}
                                    name="rodape"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Rodapé do documento</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    {...field}
                                                    className="w-full h-32 p-2 border rounded-md resize-none"
                                                    placeholder="Digite o texto do rodapé..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Anexos */}
                                <Card className="mb-6">
                                    <CardHeader>
                                        <CardTitle>Anexos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-col gap-1">
                                            <Label>Arquivo</Label>
                                            <Input
                                                type="file"
                                                accept="application/pdf/*"
                                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <Label>Descrição do anexo</Label>
                                            <Input
                                                type="text"
                                                value={fileName}
                                                onChange={(e) => setFileName(e.target.value)}
                                                aria-label='Descrição do anexo'
                                                placeholder='Descrição do anexo'
                                            />
                                        </div>
                                        <Button
                                            onClick={handleSubmitAnexos}
                                            disabled={!file || isLoading || !fileName?.trim()}
                                            className="flex items-center"
                                        >
                                            {isLoading ? "Enviando..." : "Anexar documento"}
                                        </Button>

                                        {anexosSubmit.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                                                <span>{item.nome}</span>
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="destructive" size="icon" onClick={() => removerAnexo(i)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        onClick={() => handleVisualizarAnexo(item)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <Button type="submit" disabled={isLoading}>{isLoading ? 'Salvando…' : 'Salvar'}</Button>
                            </form>
                        </Form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal */}
            <Dialog open={isFormAprovadoresOpen} onOpenChange={setIsFormAprovadoresOpen}>
                <DialogContent className="max-w-2xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            Novo aprovador
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={formAprovadores.handleSubmit(submitAprovador)} className="grid gap-4">
                            <FormField
                                control={formAprovadores.control}
                                name="usuario"
                                rules={{ required: 'usuário é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usuário</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Visualizar anexo */}
            <PdfViewerDialog
                open={isModalVisualizarAnexoOpen}
                onOpenChange={setIsModalVisualizarAnexoOpen}
                title={anexoSelecionado ? `Anexo ${anexoSelecionado.nome}` : ''}
                pdfBase64={anexoParaImpressao}
                onPrint={handleImprimirAnexo}
                isLoading={isLoading}
            />

            {/* Anexos */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${requisicaoSelecionada.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={selectedAnexosResult} loading={isLoading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Confirmação de exclusão (simples) */}
            {deleteComunicadoId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir Comunicado
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o Comunicado #{deleteComunicadoId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteComunicadoId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluirComunicado}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de exclusão (simples) */}
            {deleteAprovadorId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir aprovador
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o aprovador #{deleteAprovadorId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteAprovadorId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluirAprovador}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
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

            {searched && results.length === 0 && !isLoading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum registro encontrado.
                </p>
            )}
        </div>
    )
}

function AprovadoresComunicadosSection({ form, usuarios }: { form: UseFormReturn<Comunicado>, usuarios: Usuario[] }) {
    const { control } = form;
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const { fields, append, remove } = useFieldArray({
        control,
        name: "aprovadores"
    });

    return (
        <div className="flex flex-col gap-2 border p-3 rounded-md">
            <label className="font-semibold">Aprovadores</label>

            {fields.map((field, index) => (
                <div
                    key={field.id}
                    className="flex items-end gap-2 border p-2 rounded"
                >
                    {/* Usuário (Select com busca) */}
                    <div className="flex flex-col flex-1 min-w-0">
                        <label>Usuário</label>

                        <FormField
                            control={form.control}
                            name={`aprovadores.${index}.usuario`}
                            rules={{ required: "Usuário obrigatório" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Popover
                                            open={openIndex === index}
                                            onOpenChange={(o) => setOpenIndex(o ? index : null)}
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full justify-between min-w-0"
                                                >
                                                    <span className="truncate">
                                                        {
                                                            usuarios.find(u => u.codusuario === field.value)?.nome ??
                                                            "Selecione o usuário"
                                                        }
                                                    </span>
                                                    <ChevronsUpDown className="opacity-50 size-4 shrink-0" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverPortal>
                                                <PopoverContent
                                                    className="p-0 w-[250px] pointer-events-auto overflow-visible z-[9999]"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Command>
                                                        <CommandInput placeholder="Buscar usuário..." />
                                                        <CommandList>
                                                            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>

                                                            <CommandGroup>
                                                                {usuarios.map((u) => (
                                                                    <CommandItem
                                                                        key={u.codusuario}
                                                                        value={`${u.codusuario} - ${u.nome}`}
                                                                        onSelect={() => {
                                                                            field.onChange(u.codusuario)
                                                                            form.setValue(`aprovadores.${index}.nome`, u.nome);
                                                                            setOpenIndex(null)
                                                                        }}
                                                                    >
                                                                        {`${u.codusuario} - ${u.nome}`}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </PopoverPortal>
                                        </Popover>
                                    </FormControl>

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    {/* Remover */}
                    <Button
                        type="button"
                        onClick={() => remove(index)}
                        variant="destructive"
                        size="icon"
                        className="shrink-0"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ))}

            <Button
                type="button"
                variant="secondary"
                onClick={() => append({ usuario: "" })}
            >
                + Adicionar aprovador
            </Button>
        </div>
    );
}

function ItensFinanceirosSection({
    form,
    centrosDeCusto,
    contasFinanceiras,
    openCcustoIndex,
    setOpenCcustoIndex,
    openCodcontaIndex,
    setOpenCodcontaIndex,
}: {
    form: UseFormReturn<Comunicado>,
    centrosDeCusto: CentroDeCusto[],
    contasFinanceiras: ContaFinanceira[],
    openCcustoIndex: number | null,
    setOpenCcustoIndex: (v: number | null) => void,
    openCodcontaIndex: number | null,
    setOpenCodcontaIndex: (v: number | null) => void,
}) {
    const { control } = form;
    const { fields, append, remove } = useFieldArray({ control, name: 'itensFinanceiros' });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Dados Financeiros</CardTitle>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ setor: '', ccusto: '', codconta: '', valor: 0 })}
                >
                    + Adicionar item
                </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-md p-3 flex flex-col gap-3 relative">
                        {fields.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7"
                                onClick={() => remove(index)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>

                        {/* Setor */}
                        <FormField
                            control={control}
                            name={`itensFinanceiros.${index}.setor`}
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Setor</FormLabel>
                                    <FormControl>
                                        <Input {...f} placeholder="Ex: Tecnologia da Informação" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Centro de Custo */}
                        <FormField
                            control={control}
                            name={`itensFinanceiros.${index}.ccusto`}
                            rules={{ required: 'Centro de custo obrigatório' }}
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Centro de Custo</FormLabel>
                                    <FormControl>
                                        <Popover open={openCcustoIndex === index} onOpenChange={open => setOpenCcustoIndex(open ? index : null)} modal={false}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCcustoIndex(index)}>
                                                    {centrosDeCusto.find(c => c.ccusto === f.value)?.custo ?? 'Selecione'}
                                                    <ChevronsUpDown className="opacity-50 size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[600px] pointer-events-auto">
                                                <Command filter={(value, search) => {
                                                    const label = centrosDeCusto.find(m => m.ccusto === value)?.custo || ''
                                                    return (label.toLowerCase().includes(search.toLowerCase()) || value.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
                                                }}>
                                                    <CommandInput placeholder="Buscar centro..." />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                        <CommandGroup>
                                                            {centrosDeCusto.map(c => (
                                                                <CommandItem key={c.ccusto} value={c.ccusto} onSelect={() => { f.onChange(c.ccusto); setOpenCcustoIndex(null) }}>
                                                                    {c.ccusto} - {c.custo}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Conta Contábil */}
                        <FormField
                            control={control}
                            name={`itensFinanceiros.${index}.codconta`}
                            rules={{ required: 'Conta contábil obrigatória' }}
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Conta Contábil</FormLabel>
                                    <FormControl>
                                        <Popover open={openCodcontaIndex === index} onOpenChange={open => setOpenCodcontaIndex(open ? index : null)} modal={false}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpenCodcontaIndex(index)}>
                                                    {contasFinanceiras.find(x => x.codconta === f.value)?.contabil ?? 'Selecione'}
                                                    <ChevronsUpDown className="opacity-50 size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[600px] pointer-events-auto">
                                                <Command filter={(value, search) => {
                                                    const label = contasFinanceiras.find(m => m.codconta === value)?.contabil || contasFinanceiras.find(m => m.codconta === value)?.codconta || ''
                                                    return (label.toLowerCase().includes(search.toLowerCase()) || value.toLowerCase().includes(search.toLowerCase())) ? 1 : 0
                                                }}>
                                                    <CommandInput placeholder="Buscar conta..." />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum encontrado</CommandEmpty>
                                                        <CommandGroup>
                                                            {contasFinanceiras.map(x => (
                                                                <CommandItem key={x.codconta} value={x.codconta} onSelect={() => { f.onChange(x.codconta); setOpenCodcontaIndex(null) }}>
                                                                    {x.codconta} - {x.contabil}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Valor */}
                        <FormField
                            control={control}
                            name={`itensFinanceiros.${index}.valor`}
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Valor (R$)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" min="0" {...f} onChange={e => f.onChange(parseFloat(e.target.value) || 0)} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export function gerarTemplateHTML(data: Comunicado, logo: string, proxId: number, centrosDeCusto: CentroDeCusto[] = [], contasFinanceiras: ContaFinanceira[] = []): string {

    const aprovadores = data.aprovadores ?? [];

    const primeiroAprovador = aprovadores.length > 0 ? aprovadores[0] : null;
    const demaisAprovadores = aprovadores.slice(1);

    const gerarColunasAssinaturas = (lista: typeof demaisAprovadores) => {

        let html = '<table class="table-sem-borda" style="margin-top:50px; text-align:center;"><tr>';

        lista.forEach((ap, index) => {

            html += `
            <td style="padding:30px 20px; width:33%;">
                <div style="border-top:1px solid #000; width:220px; margin:0 auto; padding-top:6px; font-size:12px;">
                    ${ap.nome}
                </div>
            </td>
            `;

            if ((index + 1) % 3 === 0 && index !== lista.length - 1) {
                html += "</tr><tr>";
            }

        });

        html += "</tr></table>";

        return html;
    };

    return `
    <style>
        .table-bordada {
            border-collapse: collapse;
            width: 100%;
        }

        .table-bordada td,
        .table-bordada th {
            border: 1px solid #000;
        }

        .table-sem-borda {
            border-collapse: collapse;
            width: 100%;
        }

        .table-sem-borda td,
        .table-sem-borda th {
            border: none !important;
        }
    </style>
    <div style="
        max-width:800px;
        margin:auto;
        padding:40px;
        font-family: Arial, Helvetica, sans-serif;
        font-size:14px;
        line-height:1.6;
        color:#000;
        background:#fff;
    ">

        <!-- CABEÇALHO -->

        <table class="table-bordada" style="margin-bottom:30px;">
            <tr>
                <!-- LOGO ESQUERDA -->
                <td rowspan="3" style="width:20%;  text-align:center;">
                    <img src="${logo}" style="width:110px"/>
                </td>
                <!-- TÍTULO -->
                <td colspan="2" style=" text-align:center; font-weight:bold; font-size:18px; padding:8px;">
                    SOLICITAÇÃO DE PAGAMENTO
                </td>
                <!-- LOGO DIREITA -->
                <td style="width:20%;  text-align:center;">
                    <img src="/sgi.jpg" style="width:110px"/>
                </td>
            </tr>
            <tr>
                <td style=" padding:6px;">
                    <b>Código RQ - </b> ${proxId}
                </td>
                <td style=" padding:6px;">
                    <b>Revisão - </b> 00
                </td>
                <td style=" padding:6px;">
                    <b>Data de revisão:</b> ${new Date().toLocaleDateString('pt-BR')}
                </td>
            </tr>
            <tr>
                <td style=" padding:6px;">
                    <b>Data de emissão:</b> ${new Date().toLocaleDateString('pt-BR')}
                </td>

                <td colspan="2" style=" padding:6px;">
                    Pág.: 1 de 1
                </td>
            </tr>
        </table>

        <!-- TEXTO -->

        <div style="margin-top: 10px; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
            ${data.anexo ?? ""}
        </div>

        <!-- ITENS FINANCEIROS -->

        ${(data.itensFinanceiros ?? []).length > 0 ? `
        <table class="table-bordada" style="margin-top:20px; font-size:13px;">
            <thead>
                <tr>
                    <th style="padding:6px 8px; text-align:center; background:#f0f0f0;">Seq.</th>
                    <th style="padding:6px 8px; text-align:left; background:#f0f0f0;">Setor</th>
                    <th style="padding:6px 8px; text-align:left; background:#f0f0f0;">Centro de Custo</th>
                    <th style="padding:6px 8px; text-align:left; background:#f0f0f0;">Conta Contábil</th>
                    <th style="padding:6px 8px; text-align:right; background:#f0f0f0;">Valor (R$)</th>
                </tr>
            </thead>
            <tbody>
                ${(data.itensFinanceiros ?? []).map((item, i) => `
                <tr>
                    <td style="padding:5px 8px; text-align:center;">${i + 1}</td>
                    <td style="padding:5px 8px;">${item.setor ?? ""}</td>
                    <td style="padding:5px 8px;">${item.ccusto ?? ""}${(() => { const desc = centrosDeCusto.find(c => c.ccusto === item.ccusto)?.custo; return desc ? ` - ${desc}` : ''; })()}</td>
                    <td style="padding:5px 8px;">${item.codconta ?? ""}${(() => { const desc = contasFinanceiras.find(c => c.codconta === item.codconta)?.contabil; return desc ? ` - ${desc}` : ''; })()}</td>
                    <td style="padding:5px 8px; text-align:right;">${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>`).join("")}
            </tbody>
        </table>` : ""}

        <div style="margin-top:40px; white-space:pre-wrap;">
            ${data.rodape ?? ""}
        </div>
        
        <!-- ATENCIOSAMENTE -->

        ${demaisAprovadores.length > 0 ? `
        <div style="margin-top:40px;">
            Atenciosamente,
        </div>`
            : ""}

        ${demaisAprovadores.length > 0 ? gerarColunasAssinaturas(demaisAprovadores) : ""}

        <!-- DE ACORDO -->

        ${primeiroAprovador ? `

        <table class="table-sem-borda" style="width:100%; margin-top:60px;">
            <tr>
                <td style="text-align:right;">
                    <div style="
                        border-top:1px solid #000;
                        width:250px;
                        display:inline-block;
                        padding-top:6px;
                        font-size:12px;
                        text-align:center;
                    ">
                    ${primeiroAprovador.nome}
                    </div>
                </td>
            </tr>
        </table>
        ` : ""}
    </div>
    `;
}
