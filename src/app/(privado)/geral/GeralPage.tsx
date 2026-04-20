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
import { Bell, Check, Filter, RefreshCw, SearchIcon, X } from 'lucide-react'

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
import { imprimirPdfBase64, rotinaTipoMovimento, safeDateLabel, stripDiacritics, toBase64 } from '@/utils/functions'
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog'
import {
    RequisicaoDto,
    Requisicao_aprovacao,
    Requisicao_item,
    aprovar,
    reprovar,
    getAll as getAllRequisicoes,
    getAnexoByIdmov,
    Requisicao_avaliacoes,
    getAllAvaliacoes,
    createAvaliacao,
    notificarAprovador
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
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useForm } from 'react-hook-form';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form'

export default function Page() {
    const titulo = 'Movimentações para aprovação'
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [userAdmin, setUserAdmin] = useState(false);
    const [userAdministrativo, setUserAdministrativo] = useState(false);
    const [filtroDashboard, setFiltroDashboard] = useState("");
    const [userCodusuario, setCodusuario] = useState("");
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
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("Em Andamento")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending
    const [anexos, setAnexos] = useState<Anexo[]>([])
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [deleteAnexoId, setDeleteAnexoId] = useState<number | null>(null)
    const [anexoSelecionado, setAnexoSelecionado] = useState<Anexo | null>(null)
    const [podeAssinar, setPodeAssinar] = useState(false)

    const [avaliacoes, setAvaliacoes] = useState<Requisicao_avaliacoes[]>([])
    const [isModalAvaliacoesOpen, setIsModalAvaliacoesOpen] = useState(false)
    const [avaliarRequisicao, setAvaliarRequisicao] = useState<RequisicaoDto | null>()
    const [tipoMovimentoFiltrado, setTipoMovimentoFiltrado] = useState<string>("")
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [solicitantes, setSolicitantes] = useState<string[]>([])
    const [fornecedorFiltrado, setFornecedorFiltrado] = useState<string>("")
    const [fornecedores, setFornecedores] = useState<string[]>([])
    const [tiposDeMovimento, setTiposDeMovimento] = useState<string[]>([])
    const [entregaFiltrada, setEntregaFiltrada] = useState<string>("")
    const normalizeUserCode = (value: string) =>
        stripDiacritics(String(value ?? "").toLowerCase().trim()).replace(/[^a-z0-9]/g, "");
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
        const today = new Date();
        const status = searchParams.get("status") ?? "";

        if (status === "pendentes") {
            const broadFrom = new Date();
            broadFrom.setFullYear(broadFrom.getFullYear() - 2);
            setDateFrom(prev => prev || broadFrom.toISOString().substring(0, 10));
        } else {
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(today.getDate() - 5);
            setDateFrom(prev => prev || fiveDaysAgo.toISOString().substring(0, 10));
        }
        setDateTo(prev => prev || today.toISOString().substring(0, 10));

        const storedUser = sessionStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserAdmin(user.admin);
            setUserAdministrativo(user.administrativo);
            setUserName(user.nome?.toUpperCase() ?? "");
            setCodusuario(user.codusuario?.toUpperCase() ?? "");
        }

        switch (status) {
            case "em_andamento":
                setSituacaoFiltrada("Em Andamento")
                setFiltroDashboard(status);
                break;
            case "concluido_a_responder":
                setSituacaoFiltrada("Concluído a responder")
                setFiltroDashboard(status);
                break;
            case "concluido_respondido":
                setSituacaoFiltrada("Concluído respondido")
                setFiltroDashboard(status);
                break;
            case "concluido_confirmado":
                setSituacaoFiltrada("Concluído confirmado")
                setFiltroDashboard(status);
                break;
            case "concluido_automatico":
                setSituacaoFiltrada("Concluído automático(pelo sistema)")
                setFiltroDashboard(status);
                break;
            case "avaliado":
                setSituacaoFiltrada("Avaliado")
                setFiltroDashboard(status);
                break;
            case "agendado_a_responder":
                setSituacaoFiltrada("Agendado a responder")
                setFiltroDashboard(status);
                break;
            case "agendado_respondido":
                setSituacaoFiltrada("Agendado respondido")
                setFiltroDashboard(status);
                break;
            case "aguardando_terceiros":
                setSituacaoFiltrada("Aguardando terceiros")
                setFiltroDashboard(status);
                break;
            case "cancelado":
                setSituacaoFiltrada("Cancelado")
                setFiltroDashboard(status);
                break;
            case "despertado":
                setSituacaoFiltrada("Despertado")
                setFiltroDashboard(status);
                break;
            case "pendentes":
                setSituacaoFiltrada("Em Andamento");
                setFiltroDashboard("Pendentes");
                break;
            default:
                setSituacaoFiltrada("");
                setFiltroDashboard(status);
                break;
        }
    }, []);

    useEffect(() => {
        if (!dateFrom || !dateTo) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            handleSearch(searchParams.get("q") ?? "");
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [
        dateFrom,
        dateTo,
        situacaoFiltrada,
        filtroDashboard,
        userAdmin,
        userCodusuario,
        solicitanteFiltrado,
        fornecedorFiltrado,
        tipoMovimentoFiltrado,
        entregaFiltrada
    ]);

    useEffect(() => {
        if (!searched || !dateFrom || !dateTo) return;
        const interval = 60000; // 60 segundos
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") {
                handleSearch(query);
            }
        }, interval);
        return () => clearInterval(timer);
    }, [searched, query, dateFrom, dateTo, situacaoFiltrada, filtroDashboard, solicitanteFiltrado, fornecedorFiltrado, tipoMovimentoFiltrado, entregaFiltrada]);

    async function handleSearch(q: string) {
        setIsLoading(true);
        setError(null);

        try {
            const today = new Date();
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(today.getDate() - 5);
            const from = dateFrom && dateFrom !== "" ? dateFrom : fiveDaysAgo.toISOString().substring(0, 10);
            const to = dateTo && dateTo !== "" ? dateTo : today.toISOString().substring(0, 10);
            // Regra global: pendências não limitam por período (inclusive no dashboard "Pendentes").
            const isPendenteStatus = stripDiacritics((situacaoFiltrada ?? "").toUpperCase().trim()) === "EM ANDAMENTO"
            const isPendenteDashboard = filtroDashboard === "Pendentes"
            const fromApi = (isPendenteStatus || isPendenteDashboard) ? "1900-01-01" : from
            const dados = await getAllRequisicoes(fromApi, to, [], situacaoFiltrada, "", entregaFiltrada);

            const solicitantesUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.requisicao?.nome_solicitante)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setSolicitantes(solicitantesUnicos)

            const fornecedoresUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.requisicao?.nome_fornecedor)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setFornecedores(fornecedoresUnicos)

            const tiposDeMovimentoUnicos = Array.from(
                new Set(
                    dados
                        .map(d => d.requisicao?.tipo_movimento)
                        .filter((s): s is string => !!s && s.trim() !== "")
                )
            ).sort((a, b) => a.localeCompare(b))
            setTiposDeMovimento(tiposDeMovimentoUnicos)

            const qNorm = stripDiacritics(q.toLowerCase().trim());
            const usuarioLogado = normalizeUserCode(userCodusuario ?? "");

            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.requisicao.movimento ?? "").toLowerCase());
                const matchQuery = qNorm === "" || movimento.includes(qNorm) || String(d.requisicao.idmov ?? "").includes(qNorm);
                const statusNorm = stripDiacritics(String(d.requisicao.status_movimento ?? "").toUpperCase().trim())
                const filtroStatusNorm = stripDiacritics(String(situacaoFiltrada ?? "").toUpperCase().trim())
                const matchSituacao = !situacaoFiltrada || statusNorm === filtroStatusNorm;
                const usuarioAprovador = userAdmin || userAdministrativo || d.requisicao_aprovacoes.some(ap => normalizeUserCode(ap.usuario) === usuarioLogado);
                const matchTipoMovimento = tipoMovimentoFiltrado === "" || d.requisicao.tipo_movimento == tipoMovimentoFiltrado
                const matchSolicitante = solicitanteFiltrado === "" || d.requisicao.nome_solicitante == solicitanteFiltrado
                const matchFornecedor = fornecedorFiltrado === "" || d.requisicao.nome_fornecedor == fornecedorFiltrado
                let usuarioAprovou = situacaoFiltrada === "" ? false : d.requisicao_aprovacoes.some(ap =>
                    normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario) && (ap.situacao === 'A' || ap.situacao === 'R')
                );
                if (userAdmin || userAdministrativo) {
                    usuarioAprovou = false;
                }
                return matchQuery && matchSituacao && usuarioAprovador && matchSolicitante && matchFornecedor && matchTipoMovimento && !usuarioAprovou;
            });

            const fitradosStatus = filtrados.filter(d => {
                if (userAdmin == false) {
                    const nivelUsuario = d.requisicao_aprovacoes.find(
                        ap => normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario)
                    )?.nivel ?? 1;
                    const todasInferioresAprovadas = nivelUsuario == 1 || (d.requisicao_aprovacoes.filter(ap => ap.nivel < (nivelUsuario)).every(ap => ap.situacao === 'A'));
                    const status_liberado = ['Em Andamento'].includes(d.requisicao.status_movimento);
                    const usuarioAprovador = userAdmin || d.requisicao_aprovacoes.some(ap => normalizeUserCode(ap.usuario) === usuarioLogado);
                    const podeAprovar = todasInferioresAprovadas && usuarioAprovador && status_liberado;

                    switch (filtroDashboard) {
                        case "Aprovados":
                            return d.requisicao_aprovacoes.some(a =>
                                normalizeUserCode(a.usuario) === usuarioLogado &&
                                a.situacao === "A"
                            );

                        case "Pendentes":
                            return d.requisicao_aprovacoes.some(a => normalizeUserCode(a.usuario) === usuarioLogado && a.situacao === "P" && podeAprovar);
                        default:
                            return true;
                    };
                } else {
                    return true
                }
            });
            setResults(fitradosStatus);
        } catch (err) {
            const msg = (err as Error).message;
            const mensagemAmigavel = msg === 'Failed to fetch'
                ? 'Não foi possível conectar ao servidor. Verifique se a API está rodando e se a URL está correta (ex: http://localhost:5170 em desenvolvimento).'
                : msg;
            setError(mensagemAmigavel);
            setResults([]);
        } finally {
            setSearched(true);
            setIsLoading(false);
        }
    }

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

    async function handleDocumento(requisicao: RequisicaoDto) {
        setIsLoading(true)
        setPodeAssinar(false);
        const usuarioAprovador = requisicao.requisicao_aprovacoes.some(
            ap => normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario)
        );
        const nivelUsuario = requisicao.requisicao_aprovacoes.find(
            ap => normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario)
        )?.nivel ?? 1;

        const todasInferioresAprovadas = nivelUsuario == 1 || (requisicao.requisicao_aprovacoes.filter(ap => ap.nivel < (nivelUsuario)).every(ap => ap.situacao === 'A'));
        const status_liberado = ['Em Andamento'].includes(requisicao.requisicao.status_movimento);
        const podeAssinar = todasInferioresAprovadas && usuarioAprovador && status_liberado;
        setPodeAssinar(podeAssinar);
        setRequisicaoSelecionada(requisicao)
        try {
            const data = await getAnexoByIdmov(requisicao.requisicao.idmov, requisicao.requisicao.codigo_atendimento);
            setRequisicaoDocumentoSelecionada(data.arquivo);
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
            setIsModalDocumentosOpen(true)
        }
    }

    async function handleAssinar(data: Assinar) {
        setIsLoading(true)
        setSearched(false)
        try {
            data.arquivo = requisicaoDocumentoSelecionada;
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

    async function confirmarAssinatura(signData: PdfSignData) {
        const dadosAssinatura: Assinar = {
            idmov: requisicaoSelecionada!.requisicao.idmov,
            atendimento: requisicaoSelecionada!.requisicao.codigo_atendimento,
            arquivo: requisicaoSelecionada!.requisicao.arquivo,
            pagina: signData.page,
            posX: signData.posX,
            posY: signData.posY,
            largura: signData.largura,
            altura: signData.altura,
        };
        await handleAssinar(dadosAssinatura);
    }

    function handleImprimir() {
        if (!requisicaoDocumentoSelecionada) return;
        let base64 = requisicaoDocumentoSelecionada.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
    }

    async function handleItens(requisicao: RequisicaoDto) {
        setIsLoading(true)
        setIsModalItensOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoItensSelecionada(requisicao.requisicao_itens)
        setIsLoading(false)
    }

    async function handleAprovacoes(requisicao: RequisicaoDto) {
        setIsLoading(true)
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.requisicao_aprovacoes)
        setIsLoading(false)
    }

    async function handleAprovar(id: number, atendimento: number) {
        setIsLoading(true)
        try {
            const resultado = await aprovar(id, atendimento)
            // Atualização otimista: remove o item da lista imediatamente (fica mais dinâmico).
            setResults(prev => prev.filter(r => r.requisicao.idmov !== id))
            toast.success(resultado.message || "Aprovado! Lista atualizada.")
            // Backend pode retornar 200 com aviso se SMTP/M365 falhou (ex.: caixa cheia); aprovação já foi salva.
            if (resultado.avisoNotificacao) {
                toast.warning(resultado.avisoNotificacao, { duration: 12_000 })
            }
            // Refetch em background para manter dados sincronizados.
            handleSearch(query)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleNotificarAprovador(usuario: string) {
        if (!requisicaoSelecionada) return
        try {
            const msg = await notificarAprovador(
                requisicaoSelecionada.requisicao.idmov,
                requisicaoSelecionada.requisicao.codigo_atendimento,
                usuario
            )
            toast.success(msg)
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    async function handleReprovar(requisicao: RequisicaoDto) {
        form.reset({
            avaliacao: '',
            idmov: requisicao.requisicao.idmov,
            codigo_atendimento: requisicao.requisicao.codigo_atendimento
        })
        setAvaliarRequisicao(requisicao)
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
            setFileName("")
            const dados = await getAllAnexos(requisicaoSelecionada.requisicao.idmov)
            setAnexos(dados)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleVisualizarAnexo(anexo: Anexo) {
        setIsLoading(true)
        setAnexoSelecionado(anexo);
        setIsModalVisualizarAnexoOpen(true)
        setIsLoading(false)
    }

    async function handleExcluirAnexo() {
        setIsLoading(true)
        if (!deleteAnexoId) return
        try {
            await deleteAnexo(deleteAnexoId)
            handleAnexos(requisicaoSelecionada!)
            setDeleteAnexoId(null)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Anexo excluído`)
            setIsLoading(false)
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

    async function confirmarAssinaturaAnexo(signData: PdfSignData) {
        const dadosAssinatura: AnexoAssinar = {
            id: anexoSelecionado!.id,
            anexo: anexoSelecionado!.anexo,
            pagina: signData.page,
            posX: signData.posX,
            posY: signData.posY,
            largura: signData.largura,
            altura: signData.altura,
        };
        await handleAssinarAnexo(dadosAssinatura);
    }

    function handleImprimirAnexo() {
        if (!anexoSelecionado?.anexo) return;
        let base64 = anexoSelecionado.anexo.trim();
        if (base64.startsWith("data:")) base64 = base64.split(",")[1];
        imprimirPdfBase64(base64);
    }

    const handleDownloadAll = async () => {
        if (!anexos?.length) return;
        const zip = new JSZip();
        const folder = zip.folder("anexos");
        for (const anexo of anexos) {
            try {
                const byteCharacters = atob(anexo.anexo);
                const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/pdf" });
                const nomeArquivo = `${anexo.nome}.pdf`;
                folder!.file(nomeArquivo, blob);
            } catch (err) {
                console.error("Erro ao baixar anexo:", anexo, err);
            }
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `anexos_mov_${requisicaoSelecionada!.requisicao.idmov}.zip`);
    };

    const colunas = useMemo<ColumnDef<RequisicaoDto>[]>(
        () => [
            { accessorKey: 'requisicao.idmov', header: 'ID' },
            { accessorKey: 'requisicao.data_emissao', header: 'Emissão', accessorFn: (row) => safeDateLabel(row.requisicao.data_emissao) },
            { accessorKey: 'rotina', header: 'Rotina', accessorFn: (row) => rotinaTipoMovimento(row.requisicao.tipo_movimento) },
            { accessorKey: 'requisicao.movimento', header: 'Movimento' },
            { accessorKey: 'requisicao.tipo_movimento', header: 'Tipo movimento' },
            { accessorKey: 'requisicao.nome_solicitante', header: 'Solicitante', accessorFn: (row) => row.requisicao?.nome_solicitante?.trim() || "—" },
            { accessorKey: 'requisicao.status_movimento', header: 'Situação' },
            {
                accessorKey: 'requisicao.situacao_entrega',
                header: 'Entrega',
                cell: ({ row }) => {
                    const val = row.original.requisicao.situacao_entrega
                    return (
                        <span className="flex items-center gap-1">
                            {val ?? '—'}
                            {val === 'Recebido' && <Check className="w-4 h-4 text-green-500" />}
                        </span>
                    )
                }
            },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    const { requisicao, requisicao_aprovacoes } = row.original;
                    const usuarioAprovador = requisicao_aprovacoes.some(ap => normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario));

                    const nivelUsuario = row.original.requisicao_aprovacoes.find(
                        ap => normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario)
                    )?.nivel ?? 1;

                    const todasInferioresAprovadas = nivelUsuario == 1 || (requisicao_aprovacoes.filter(ap => ap.nivel < (nivelUsuario)).every(ap => ap.situacao === 'A'));

                    const usuarioAprovou = requisicao_aprovacoes.some(ap =>
                        normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario) && (ap.situacao === 'A')
                    );
                    const usuarioReprovou = requisicao_aprovacoes.some(ap =>
                        normalizeUserCode(ap.usuario) === normalizeUserCode(userCodusuario) && (ap.situacao === 'R')
                    );

                    // const status_bloqueado = ['Cancelado', 'Concluído confirmado'].includes(requisicao.status_movimento);
                    const status_liberado = ['Em Andamento'].includes(requisicao.status_movimento);

                    // const podeAprovar = todasInferioresAprovadas && usuarioAprovador && !usuarioAprovou && status_liberado;
                    // const podeReprovar = todasInferioresAprovadas && usuarioAprovador && !usuarioAprovou && status_liberado;
                    const podeAprovar = todasInferioresAprovadas && usuarioAprovador && status_liberado && !usuarioAprovou;
                    const podeReprovar = todasInferioresAprovadas && usuarioAprovador && status_liberado && !usuarioReprovou;

                    return (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDocumento(row.original)}>
                                Documento {requisicao.documento_assinado == 1 && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>
                            {requisicao && (
                                <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                    Anexos {row.original.requisicao.quantidade_anexos > 0 ? `(${row.original.requisicao.quantidade_anexos})` : ''}
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleItens(row.original)}>
                                Itens
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && requisicao.documento_assinado == 1 && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(requisicao.idmov, requisicao.codigo_atendimento)}
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

                            {requisicao.possui_avaliacoes == 1 && (
                                <Button
                                    size="sm"
                                    className="bg-orange-500 hover:bg-orange-600 text-white"
                                    onClick={() => handleAvaliacoes(row.original)}
                                >
                                    Avaliações
                                </Button>
                            )}
                        </div>
                    );
                }
            }
        ],
        [userName]
    )

    const colunasItens = useMemo<ColumnDef<Requisicao_item>[]>(
        () => [
            { accessorKey: 'centro_custo', header: 'Centro de custo', accessorFn: (row) => row.centro_custo + ' - ' + (row.nome_centro_custo ?? '-') },
            { accessorKey: 'codigo_item_movimento', header: 'Cod. Item' },
            { accessorKey: 'item_preco_unitario', header: 'Preço unitário' },
            { accessorKey: 'item_quantidade', header: 'Quantidade' },
            { accessorKey: 'item_total', header: 'Total' },
            { accessorKey: 'historico_item', header: 'Histórico' }
        ],
        []
    )

    const colunasAprovacoes = useMemo<ColumnDef<Requisicao_aprovacao>[]>(
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
                            Visualizar {row.original.documento_assinado == 1 && (
                                <Check className="w-4 h-4 text-green-500" />
                            )}
                        </Button>)}
                        {row.original.anexo && row.original.usuario_criacao == userCodusuario && (<Button
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
        [userCodusuario]
    )

    async function handleAvaliacoes(requisicao: RequisicaoDto) {
        setRequisicaoSelecionada(requisicao)
        setIsLoading(true)
        setError(null)
        try {
            const dados = await getAllAvaliacoes(requisicao.requisicao.idmov, requisicao.requisicao.codigo_atendimento)
            setAvaliacoes(dados)
        } catch (err) {
            setError((err as Error).message)
            setAvaliacoes([])
        } finally {
            setSearched(true)
            setIsLoading(false)
            setIsModalAvaliacoesOpen(true)
        }
    }

    const colunasAvaliacoes = useMemo<ColumnDef<Requisicao_avaliacoes>[]>(
        () => [
            { accessorKey: 'data_avaliacao', header: 'Data' },
            { accessorKey: 'nome', header: 'Usuário' },
            { accessorKey: 'avaliacao', header: 'Avaliação' },
        ],
        []
    )

    const form = useForm<Requisicao_avaliacoes>({
        defaultValues: {
            avaliacao: '',
            idmov: requisicaoSelecionada?.requisicao.idmov,
            codigo_atendimento: requisicaoSelecionada?.requisicao.codigo_atendimento
        }
    })

    async function handleAvaliar(data: Requisicao_avaliacoes) {
        if (!avaliarRequisicao) return
        const idmov = avaliarRequisicao.requisicao.idmov
        const codigoAtendimento = Number(avaliarRequisicao.requisicao.codigo_atendimento)
        try {
            await createAvaliacao({
                ...data,
                idmov,
                codigo_atendimento: codigoAtendimento,
            })
            await reprovar(idmov, codigoAtendimento)
            setResults(prev => prev.filter(r => r.requisicao.idmov !== idmov))
            toast.success(`Avaliação enviada e requisição reprovada.`)
            handleSearch(query)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            form.reset()
            if (requisicaoSelecionada?.requisicao.idmov === idmov) {
                handleAvaliacoes(requisicaoSelecionada).catch(() => { })
            }
            setAvaliarRequisicao(null)
        }
    }

    return (
        <div className="p-6">
            {/* Cabeçalho */}
            <Card className="mb-6">
                {/* Filtros */}
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
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
                                {tiposDeMovimento.map((tipo_movimento) => (
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

                        {/* Entrega */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Filtrar por entrega">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Entrega</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Entrega</DropdownMenuLabel>
                                <DropdownMenuCheckboxItem checked={entregaFiltrada === "Pendente"} onCheckedChange={(checked) => { if (checked) setEntregaFiltrada("Pendente") }}>Pendente</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={entregaFiltrada === "Parc. Recebido"} onCheckedChange={(checked) => { if (checked) setEntregaFiltrada("Parc. Recebido") }}>Parc. Recebido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={entregaFiltrada === "Recebido"} onCheckedChange={(checked) => { if (checked) setEntregaFiltrada("Recebido") }}>Recebido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={entregaFiltrada === ""} onCheckedChange={(checked) => { if (checked) setEntregaFiltrada("") }}>Todos</DropdownMenuCheckboxItem>
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

                        {/* Fornecedores */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" aria-label="Filtrar por fornecedor">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Fornecedores</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Fornecedores</DropdownMenuLabel>
                                {fornecedores.map((fornecedor) => (
                                    <DropdownMenuCheckboxItem
                                        key={fornecedor}
                                        checked={fornecedorFiltrado === fornecedor}
                                        onCheckedChange={(checked) => { if (checked) setFornecedorFiltrado(fornecedor) }}
                                    >
                                        {fornecedor}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuCheckboxItem key={"Todos"} checked={fornecedorFiltrado == ""} onCheckedChange={(checked) => { if (checked) setFornecedorFiltrado("") }}>Todos</DropdownMenuCheckboxItem>
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
                                <DropdownMenuCheckboxItem key={"Em Andamento"} checked={situacaoFiltrada == "Em Andamento"} onCheckedChange={() => { setSituacaoFiltrada("Em Andamento"); setFiltroDashboard("em_andamento"); }}>Em Andamento</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído a responder"} checked={situacaoFiltrada == "Concluído a responder"} onCheckedChange={() => { setSituacaoFiltrada("Concluído a responder"); setFiltroDashboard("concluido_a_responder"); }}>Concluído a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído respondido"} checked={situacaoFiltrada == "Concluído respondido"} onCheckedChange={() => { setSituacaoFiltrada("Concluído respondido"); setFiltroDashboard("concluido_respondido"); }}>Concluído respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído confirmado"} checked={situacaoFiltrada == "Concluído confirmado"} onCheckedChange={() => { setSituacaoFiltrada("Concluído confirmado"); setFiltroDashboard("concluido_confirmado"); }}>Concluído confirmado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Concluído automático(pelo sistema)"} checked={situacaoFiltrada == "Concluído automático(pelo sistema)"} onCheckedChange={() => { setSituacaoFiltrada("Concluído automático(pelo sistema)"); setFiltroDashboard("concluido_automatico"); }}>Concluído automático(pelo sistema)</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Avaliado"} checked={situacaoFiltrada == "Avaliado"} onCheckedChange={() => { setSituacaoFiltrada("Avaliado"); setFiltroDashboard("avaliado"); }}>Avaliado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado a responder"} checked={situacaoFiltrada == "Agendado a responder"} onCheckedChange={() => { setSituacaoFiltrada("Agendado a responder"); setFiltroDashboard("agendado_a_responder"); }}>Agendado a responder</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Agendado respondido"} checked={situacaoFiltrada == "Agendado respondido"} onCheckedChange={() => { setSituacaoFiltrada("Agendado respondido"); setFiltroDashboard("agendado_respondido"); }}>Agendado respondido</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Aguardando terceiros"} checked={situacaoFiltrada == "Aguardando terceiros"} onCheckedChange={() => { setSituacaoFiltrada("Aguardando terceiros"); setFiltroDashboard("aguardando_terceiros"); }}>Aguardando terceiros</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Cancelado"} checked={situacaoFiltrada == "Cancelado"} onCheckedChange={() => { setSituacaoFiltrada("Cancelado"); setFiltroDashboard("cancelado"); }}>Cancelado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Despertado"} checked={situacaoFiltrada == "Despertado"} onCheckedChange={() => { setSituacaoFiltrada("Despertado"); setFiltroDashboard("despertado"); }}>Despertado</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem key={"Todos"} checked={situacaoFiltrada == ""} onCheckedChange={() => { setSituacaoFiltrada(""); setFiltroDashboard("todos"); }}>Todos</DropdownMenuCheckboxItem>
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
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Itens */}
            {requisicaoSelecionada && (
                <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                                    <span>{requisicaoItensSelecionada[0]?.codigo_natureza_orcamentaria} - {requisicaoItensSelecionada[0]?.nome_natureza_orcamentaria ?? "-"}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="font-semibold text-muted-foreground">Etapa:</span>
                                    <span>{requisicaoSelecionada.requisicao.nome_etapa ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Fornecedor:</span>
                                    <span>{requisicaoSelecionada.requisicao.nome_fornecedor ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Data emissão:</span>
                                    <span>{safeDateLabel(requisicaoSelecionada.requisicao.data_emissao) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Valor bruto:</span>
                                    <span>{requisicaoSelecionada.requisicao.valor_total.toFixed(2) ?? "-"}</span>
                                </div>

                                <div className="flex justify-between border-b border-muted pb-1">
                                    <span className="font-semibold text-muted-foreground">Histórico:</span>
                                    <span>{safeDateLabel(requisicaoSelecionada.requisicao.historico_movimento) ?? "-"}</span>
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
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
            <PdfViewerDialog
                open={isModalDocumentosOpen}
                onOpenChange={setIsModalDocumentosOpen}
                title={`Documento movimentação n° ${requisicaoSelecionada?.requisicao.idmov ?? ''}`}
                pdfBase64={requisicaoDocumentoSelecionada || null}
                canSign={requisicaoSelecionada?.requisicao.documento_assinado == 0 && podeAssinar}
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

            {/* Anexos */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAnexos} data={anexos} loading={loading} />
                        </div>
                        {/* Ações */}
                        <div className="flex justify-center mt-2 mb-4 gap-4 shrink-0 sticky bottom-0 p-4 border-t">
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
                                disabled={!file || isLoading || !fileName?.trim()}
                                className="flex items-center"
                            >
                                {isLoading ? "Enviando..." : "Anexar documento"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDownloadAll}
                                disabled={!anexos?.length}
                                className="flex items-center gap-2"
                            >
                                Baixar todos
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Assinatura de anexo */}
            <PdfViewerDialog
                open={isModalVisualizarAnexoOpen}
                onOpenChange={setIsModalVisualizarAnexoOpen}
                title={anexoSelecionado ? `Anexo n° ${anexoSelecionado.id} - ${anexoSelecionado.nome}` : ''}
                pdfBase64={anexoSelecionado?.anexo || null}
                canSign={anexoSelecionado?.documento_assinado == 0}
                onSign={confirmarAssinaturaAnexo}
                onPrint={handleImprimirAnexo}
                isLoading={isLoading}
            />

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

            {/* Avaliações */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAvaliacoesOpen} onOpenChange={setIsModalAvaliacoesOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações movimentação n° ${requisicaoSelecionada.requisicao.idmov}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            <DataTable columns={colunasAvaliacoes} data={avaliacoes} loading={loading} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Confirmação de exclusão usando Dialog */}
            {avaliarRequisicao && (<Dialog open={avaliarRequisicao !== null} onOpenChange={() => setAvaliarRequisicao(null)}>
                <DialogHeader>
                    <DialogTitle>Avaliar requisição #{avaliarRequisicao.requisicao.idmov}</DialogTitle>
                </DialogHeader>
                <DialogContent
                    className="max-w-sm rounded-xl bg-background p-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()} // evita propagação
                >
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleAvaliar)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="avaliacao"
                                rules={{ required: 'Centro de custo é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Avaliação</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setAvaliarRequisicao(null)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? 'Salvando…' : 'Avaliar'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>)}


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
