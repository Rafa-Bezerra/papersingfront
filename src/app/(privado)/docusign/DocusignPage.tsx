'use client'

import MinhasSolicitacoesPanel from '@/components/MinhasSolicitacoesPanel'
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { BarChart3, Bell, Boxes, Check, ChevronsUpDown, ClipboardList, ExternalLink, Eye, FileSignature, Filter, FolderCheck, History, LayoutTemplate, Mail, Printer, SearchIcon, Settings, ShieldCheck, SquarePlus, Table2, Trash2, UserPlus, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { base64ParaImpressao, podeCancelarDocumentoCriador, podeExcluirDocumentoCriador, resolverAnexoDocumento } from '@/utils/documentoAnexo'
import { imprimirPdfBase64, safeDateLabel, safeDateLabelAprovacao, stripDiacritics, toBase64 } from '@/utils/functions'
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import {
    adicionarAprovador,
    aprovar,
    assinar,
    CertificadoA1Status,
    createElement,
    deleteElement,
    removerAprovador,
    Documento,
    DocumentoAprovacao,
    getAnexo,
    ItemWaySign,
    listarItensWaySign,
    getAnexosDocumento,
    resgatarDocumentoPlugSign,
    base64PdfEhValido,
    normalizarPdfDataUrl,
    getCertificadoStatus,
    postCertificado,
    deleteCertificado,
    vincularCertificadoPlugSign,
} from '@/services/docusignService';
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
import { DocumentoAnexo, DocumentoAnexoAssinar } from '@/types/Documento';
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog';
import SolicitacaoAssinaturaPanel from '@/components/SolicitacaoAssinaturaPanel'
import FornecedorParceiroPanel from '@/components/FornecedorParceiroPanel'
import WaySignPlugSignAcoes from '@/components/WaySignPlugSignAcoes'
import WaySignAdminPanel, { ClientesSecao } from '@/components/WaySignAdminPanel'
import { WaySignDocumentosInternosAcoesPanel } from '@/components/WaySignDocumentosInternosAcoesPanel'
import * as documentoService from '@/services/documentoService'
import { listarAlertas } from '@/services/waySignService'
import WaySignTemplatesPanel from '@/components/WaySignTemplatesPanel'
import WaySignLotesPanel from '@/components/WaySignLotesPanel'
import { WaySignAlertasBotao, WaySignMensagens, WaySignPainel, WaySignRelatorio } from '@/components/WaySignEspelhoPaineis'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { getPendenciaIdFromSearchParams, isPendentesFromUrl, usePendenciaDeepLink } from '@/utils/pendenciaDeepLink'
import { isAdminSession, USERDATA_UPDATED_EVENT } from '@/utils/sessionUser'

const TAMANHOS_PAGINA = [10, 20, 50, 100]
/** ID na lista: mesma numeração em DOCUSIGN_* e DOCUMENTOS_INTERNOS_* pode repetir (ex.: 58). */
function rotuloIdWaySign(row: ItemWaySign): string {
    if (row.origem === 'PLUGSIGN') return '—'
    if (row.origem === 'DOCINTERNO') return `D:${row.id}`
    if (row.origem === 'INTERNO') return `I:${row.id}`
    return String(row.id ?? '')
}

const ROTULO_ORIGEM: Record<string, string> = {
    DOCINTERNO: 'Doc. internos (motivo/hist.)',
    // INTERNO = fila legada DOCUSIGN_* — exclusão/cancelamento com histórico não se aplicam.
    INTERNO: 'Interno legado (DOCUSIGN)',
    PLUGSIGN: 'WaySign',
    INTERNOS: 'Internos (PaperSign)',
    EXTERNOS: 'Externos (WaySign)',
}
const VISOES: { valor: string; label: string }[] = [
    { valor: '', label: 'Todos' },
    { valor: 'enviados', label: 'Enviados por mim' },
    { valor: 'recebidos', label: 'Recebidos por mim' },
    { valor: 'aguardando', label: 'Aguardando minha ação' },
]


export default function Page() {
    const titulo = 'WaySign'
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState(false)
    const [userName, setUserName] = useState("");
    const [userCodusuario, setCodusuario] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<ItemWaySign[]>([])
    const [origemFiltrada, setOrigemFiltrada] = useState<string>("")
    const [visao, setVisao] = useState<string>("")
    const [pagina, setPagina] = useState(1)
    const [tamanhoPagina, setTamanhoPagina] = useState(20)
    const [totalItens, setTotalItens] = useState(0)
    const [ultimaPagina, setUltimaPagina] = useState(1)
    const [avisoLista, setAvisoLista] = useState<string | null>(null)
    const [isAdminUser, setIsAdminUser] = useState(() =>
        typeof window !== 'undefined' ? isAdminSession() : false
    )
    // Unificação Documentos × WaySign: quem tem só "Documentos" entra no módulo e vê só "Documentos internos".
    // null = ainda lendo a sessão (evita buscar a lista do WaySign sem saber se pode).
    const [temWaySign, setTemWaySign] = useState<boolean | null>(null)
    const [temDocumentos, setTemDocumentos] = useState(false)
    const [aba, setAba] = useState('documentos')
    // "Meus documentos": finalizados (internos e WaySign) sem limite de período. Usuário vê os dele; Admin, os da unidade (decisão 12/10).
    const emMeus = aba === 'meus'
    // Documentos = só pendentes; Meus documentos = finalizados (concluídos, recusados ou cancelados); Solicitações = filtro livre.
    const situacaoDaAba = emMeus ? 'FINALIZADO' : aba === 'documentos' ? 'PENDENTE' : null
    // Lista única: cada linha chama a API do próprio módulo (WaySign = api/Docusign, Documentos internos = api/Documentos).
    const origemAtual = useRef<string>('DOCINTERNO')
    const codigoOrigem = (origem?: string | null) => (origem ?? origemAtual.current ?? '').trim().toUpperCase()
    const ehDocInterno = () => codigoOrigem() === 'DOCINTERNO'
    const exclusaoDocInternoModulo = (origem?: string | null) => codigoOrigem(origem) === 'DOCINTERNO'
    const servico = () => (ehDocInterno()
        ? documentoService
        : { getAnexo, assinar, aprovar, deleteElement, createElement, adicionarAprovador })
    // Só assina quem está no fluxo de aprovação (vale também para Admin); os demais só visualizam.
    // eu_destinatario vem do servidor (login ou chapa com o mesmo e-mail); o servidor confere de novo ao assinar.
    const estaNoFluxo = (doc?: Documento | null) => {
        if (!doc) return false
        if ((doc as ItemWaySign).eu_destinatario) return true
        const eu = stripDiacritics(userCodusuario.toLowerCase().trim())
        return (doc.aprovadores ?? []).some((ap) => stripDiacritics((ap.usuario ?? '').toLowerCase().trim()) === eu)
    }
    const marcarOrigem = (doc?: Documento | null) => {
        const o = codigoOrigem((doc as ItemWaySign | undefined)?.origem)
        origemAtual.current = o === 'DOCINTERNO' || o === 'INTERNO' ? o : 'INTERNO'
    }
    const [assinarHabilitado, setAssinarHabilitado] = useState(false)
    const [recarga, setRecarga] = useState(0)
    const [historicoDocInternosTick, setHistoricoDocInternosTick] = useState(0)
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<Documento>()
    const [requisicaoAprovacoesSelecionada, setRequisicaoAprovacoesSelecionada] = useState<DocumentoAprovacao[]>([])
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [certStatus, setCertStatus] = useState<CertificadoA1Status | null>(null)
    const [isCertDialogOpen, setIsCertDialogOpen] = useState(false)
    // A1 é opcional: só quando a pessoa marca "Assinar com certificado" (decisão 13/10).
    const [assinarComCertificado, setAssinarComCertificado] = useState(false)
    const [certSenha, setCertSenha] = useState("")
    const [certVinculando, setCertVinculando] = useState(false)
    const certFileRef = useRef<HTMLInputElement>(null)
    const certStatusSeq = useRef(0)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovacoesOpen, setIsModalAprovacoesOpen] = useState(false)
    // Situação normalizada da lista única: 'PENDENTE' | 'CONCLUÍDO' | 'RECUSADO' | 'CANCELADO'
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const [isFormDocumentoOpen, setIsFormDocumentoOpen] = useState(false)
    const [isFormAprovadoresOpen, setIsFormAprovadoresOpen] = useState(false)
    const [updateDocumentoMode, setUpdateDocumentoMode] = useState(false)
    const [deleteDocumentoId, setDeleteDocumentoId] = useState<number | null>(null);
    const [deleteDocumentoOrigem, setDeleteDocumentoOrigem] = useState<string | null>(null);
    const [motivoExclusao, setMotivoExclusao] = useState('');
    const [cancelDocumentoId, setCancelDocumentoId] = useState<number | null>(null);
    const [cancelDocumentoOrigem, setCancelDocumentoOrigem] = useState<string | null>(null);
    const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null);
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [isModalAnexosOpen, setIsModalAnexosOpen] = useState(false)
    const [selectedAnexosResult, setSelectedAnexosResult] = useState<DocumentoAnexo[]>([])
    const [file, setFile] = useState<File | null>(null)
    const [fileName, setFileName] = useState<string>("")
    const [anexoSelecionado, setAnexoSelecionado] = useState<DocumentoAnexo | null>(null)
    const [isDocumentoPrincipal, setDocumentoPrincipal] = useState(false)
    const [anexoPdfBase64ParaAssinatura, setAnexoPdfBase64ParaAssinatura] = useState<string | null>(null)
    const [isModalVisualizarAnexoOpen, setIsModalVisualizarAnexoOpen] = useState(false)
    const [anexosSubmit, setAnexosSubmit] = useState<DocumentoAnexo[]>([])
    const [solicitanteFiltrado, setSolicitanteFiltrado] = useState<string>("")
    const [solicitantes, setSolicitantes] = useState<string[]>([])
    const [openUsuarioAprovadorSearch, setOpenUsuarioAprovadorSearch] = useState(false)

    const form = useForm<Documento>({
        defaultValues: {
            id: 0,
            nome: '',
            aprovadores: [],
            anexos: []
        }
    })

    const formAprovadores = useForm<DocumentoAprovacao>({
        defaultValues: {
            id: 0,
            usuario: '',
            data_aprovacao: '',
            aprovacao: '',
            ordem: 1,
        }
    })

    function clearQuery() { setQuery('') }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSearchClick()
        }
    }

    const carregou = useRef(false)
    useEffect(() => {
        if (carregou.current) return;
        buscaUsuarios();
        carregarCertificadoStatus();
    }, [])

    function aplicarStatusCertificado(status: CertificadoA1Status, seq: number) {
        if (seq !== certStatusSeq.current) return;
        setCertStatus(status);
    }

    async function carregarCertificadoStatus() {
        const seq = ++certStatusSeq.current;
        try {
            const status = await getCertificadoStatus();
            aplicarStatusCertificado(status, seq);
        } catch {
            if (seq === certStatusSeq.current) setCertStatus(null);
        }
    }

    async function sincronizarContaPlugSign() {
        const seq = ++certStatusSeq.current;
        setCertVinculando(true);
        try {
            const status = await vincularCertificadoPlugSign();
            aplicarStatusCertificado(status, seq);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            if (seq === certStatusSeq.current) setCertVinculando(false);
        }
    }

    useEffect(() => {
        if (!isCertDialogOpen) {
            setCertSenha("");
            if (certFileRef.current) certFileRef.current.value = "";
            return;
        }
        void (async () => {
            await carregarCertificadoStatus();
            await sincronizarContaPlugSign();
        })();
    }, [isCertDialogOpen]);

    async function handleEnviarCertificado() {
        const file = certFileRef.current?.files?.[0];
        if (!file) {
            toast.error("Selecione o arquivo .pfx do certificado A1.");
            return;
        }
        if (!certSenha.trim()) {
            toast.error("Informe a senha do certificado.");
            return;
        }
        setIsLoading(true);
        const seq = ++certStatusSeq.current;
        try {
            const base64 = await toBase64(file);
            const status = await postCertificado(base64, certSenha);
            aplicarStatusCertificado(status, seq);
            setCertSenha("");
            if (certFileRef.current) certFileRef.current.value = "";
            toast.success("Certificado A1 cadastrado na PlugSign.");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleRemoverCertificado() {
        if (!window.confirm("Remover o certificado A1 da PlugSign? Será necessário cadastrar novamente para assinar com ICP-Brasil.")) {
            return;
        }
        setIsLoading(true);
        const seq = ++certStatusSeq.current;
        try {
            const status = await deleteCertificado();
            aplicarStatusCertificado({
                ...status,
                temCertificadoA1: false,
                certificadoPersistido: false,
                cadastrado: false,
            }, seq);
            setCertSenha("");
            if (certFileRef.current) certFileRef.current.value = "";
            toast.success("Certificado A1 removido.");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }

    const temCertificado = certStatus?.temCertificadoA1 === true;

    const exibirFormularioCertificado = !temCertificado;

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

    useEffect(() => {
        setIsAdminUser(isAdminSession());
        const onUserUpdated = () => setIsAdminUser(isAdminSession());
        window.addEventListener(USERDATA_UPDATED_EVENT, onUserUpdated);
        return () => window.removeEventListener(USERDATA_UPDATED_EVENT, onUserUpdated);
    }, []);

    useEffect(() => {
        if (isPendentesFromUrl(searchParams)) {
            setSituacaoFiltrada("PENDENTE");
        }

        if (dateFrom === "" && dateTo === "") {
            setDateFrom(new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().substring(0, 10));
            setDateTo(new Date().toISOString().substring(0, 10));
        }
        const storedUser = sessionStorage.getItem("userData");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserName(String(user.nome ?? user.NOME ?? '').toUpperCase());
            setCodusuario(String(user.codusuario ?? user.CODUSUARIO ?? '').toUpperCase());
            const adminOuFinanceiro = isAdminSession() || Boolean(user.financeiro);
            const podeWaySign = adminOuFinanceiro || Boolean(user.docusign);
            setTemWaySign(podeWaySign);
            setTemDocumentos(adminOuFinanceiro || Boolean(user.documentos));
        } else {
            setTemWaySign(false);
        }

        if (temWaySign !== true && !temDocumentos) return
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
    }, [query, situacaoFiltrada, dateFrom, dateTo, solicitanteFiltrado, origemFiltrada, visao, pagina, tamanhoPagina, recarga, temWaySign, temDocumentos, emMeus, situacaoDaAba])

    // Filtro novo volta para a página 1 (o debounce acima junta as duas mudanças em uma busca).
    useEffect(() => {
        setPagina(1)
    }, [query, situacaoFiltrada, dateFrom, dateTo, solicitanteFiltrado, origemFiltrada, visao, tamanhoPagina, emMeus])


    async function handleSearch(q: string): Promise<ItemWaySign[]> {
        setIsLoading(true)
        setError(null)
        try {
            // Filtros, visibilidade e paginação no servidor (T-WS3a). Pendentes sempre aparecem, independente do período.
            const res = await listarItensWaySign({
                page: pagina,
                pageSize: tamanhoPagina,
                texto: q,
                situacao: situacaoDaAba ?? situacaoFiltrada,
                origem: origemFiltrada,
                solicitante: solicitanteFiltrado,
                dataIni: emMeus ? undefined : dateFrom,
                dataFim: emMeus ? undefined : dateTo,
                visao: emMeus ? '' : visao,
                foco: getPendenciaIdFromSearchParams(searchParams),
            })
            setSolicitantes(res.solicitantes)
            setTotalItens(res.total ?? 0)
            setUltimaPagina(res.lastPage ?? 1)
            setAvisoLista(res.aviso ?? null)
            setAssinarHabilitado(res.assinarHabilitado === true)
            setResults(res.data)
            return res.data
        } catch (err) {
            setError((err as Error).message)
            toast.error((err as Error).message)
            setResults([])
            return []
        } finally {
            setSearched(true)
            setIsLoading(false)
        }
    }

    function atualizarListaAnexosModal(doc: Documento) {
        setRequisicaoSelecionada(doc)
        setSelectedAnexosResult(doc.anexos ?? [])
    }

    function aplicarAnexosNoDocumento(doc: Documento, anexos: DocumentoAnexo[]): Documento {
        const atualizado = { ...doc, anexos };
        const origem = (doc as ItemWaySign).origem ?? 'INTERNO';
        setResults((prev) => prev.map((d) => (d.origem === origem && d.id === doc.id ? { ...d, anexos } : d)));
        if (requisicaoSelecionada?.id === doc.id) {
            setRequisicaoSelecionada(atualizado);
        }
        return atualizado;
    }

    async function refreshDocumentoAnexos(doc: Documento): Promise<Documento> {
        if ((doc.anexos?.length ?? 0) > 0 || (doc as ItemWaySign).origem === 'DOCINTERNO') return doc;
        let anexos = await getAnexosDocumento(doc.id);
        if (anexos.length === 0) {
            try {
                const resgatado = await resgatarDocumentoPlugSign(doc.id);
                if (resgatado) anexos = [resgatado];
            } catch (err) {
                console.warn("Resgate PlugSign:", err);
            }
        }
        return aplicarAnexosNoDocumento(doc, anexos);
    }

    async function handleResgatarPlugSign() {
        if (!requisicaoSelecionada) return;
        setIsLoading(true);
        try {
            const resgatado = await resgatarDocumentoPlugSign(requisicaoSelecionada.id);
            if (!resgatado) {
                toast.error("PDF assinado não encontrado na PlugSign para este documento.");
                return;
            }
            const anexos = [...(requisicaoSelecionada.anexos ?? []), resgatado];
            const atualizado = aplicarAnexosNoDocumento(requisicaoSelecionada, anexos);
            atualizarListaAnexosModal(atualizado);
            toast.success("Documento resgatado da PlugSign.");
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Não foi possível resgatar o documento na PlugSign.";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }

    async function resolverAnexoPrincipal(doc: Documento): Promise<DocumentoAnexo | null> {
        const atualizado = await refreshDocumentoAnexos(doc);
        return resolverAnexoDocumento(atualizado.anexos) ?? null;
    }

    async function abrirDocumentoPrincipal(doc: Documento) {
        marcarOrigem(doc);
        setRequisicaoSelecionada(doc);
        setIsLoading(true);
        try {
            const anexo = await resolverAnexoPrincipal(doc);
            if (!anexo) {
                toast.error("PDF não encontrado na PlugSign. Abra Anexos e use Resgatar PDF da PlugSign.");
                return;
            }
            await handleVisualizarAnexo(anexo);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Não foi possível abrir o documento.";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }

    async function imprimirDocumentoPrincipal(doc: Documento) {
        marcarOrigem(doc);
        setRequisicaoSelecionada(doc);
        setIsLoading(true);
        try {
            const anexo = await resolverAnexoPrincipal(doc);
            if (!anexo) {
                toast.error("Este documento não possui PDF anexado para impressão.");
                return;
            }
            await handleImprimirAnexoDireto(anexo);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : "Não foi possível imprimir o documento.";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSearchClick(): Promise<ItemWaySign[]> {
        startTransition(() => {
            const sp = new URLSearchParams(Array.from(searchParams.entries()))
            if (query) sp.set('q', query)
            else sp.delete('q')
            router.replace(`?${sp.toString()}`)
        })
        return await handleSearch(query)
    }

    async function handleAprovacoes(requisicao: Documento) {
        marcarOrigem(requisicao)
        setIsModalAprovacoesOpen(true)
        setRequisicaoSelecionada(requisicao)
        setRequisicaoAprovacoesSelecionada(requisicao.aprovadores)
    }

    async function handleAnexos(requisicao: Documento) {
        marcarOrigem(requisicao)
        setIsModalAnexosOpen(true)
        atualizarListaAnexosModal(requisicao)
        setIsLoading(true)
        try {
            const atualizado = await refreshDocumentoAnexos(requisicao)
            atualizarListaAnexosModal(atualizado)
        } catch (err) {
            console.error(err)
            const msg = err instanceof Error ? err.message : "Não foi possível carregar os anexos."
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    usePendenciaDeepLink(
        results,
        searched && !isLoading,
        searchParams,
        router,
        (d) => (d.origem === 'INTERNO' ? d.id : null),
        abrirDocumentoPrincipal
    );

    async function handleAprovar(doc: Documento, aprovado: number) {
        marcarOrigem(doc)
        setIsLoading(true)
        try {
            await servico().aprovar(doc.id, aprovado)
            handleSearchClick()
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleInserirDocumento() {
        // "Aprovação interna (em níveis)" = módulo Documentos (DOCUMENTOS_INTERNOS_* / origem DOCINTERNO).
        // INTERNO é fila legada DOCUSIGN_* — exclusão com motivo e histórico Admin não se aplicam.
        origemAtual.current = 'DOCINTERNO'
        form.reset({
            id: 0,
            nome: '',
            aprovadores: [],
            anexos: []
        })
        setUpdateDocumentoMode(false)
        setIsFormDocumentoOpen(true)
    }

    async function handleExcluirDocumento() {
        if (!deleteDocumentoId) return
        try {
            if (!exclusaoDocInternoModulo(deleteDocumentoOrigem)) {
                toast.error(
                    'Exclusão com motivo e histórico vale só para documentos internos (origem DOCINTERNO). ' +
                        'Este item é do fluxo WaySign interno (DOCUSIGN).'
                )
                return
            }
            const motivo = motivoExclusao.trim()
            if (motivo.length < 3) {
                toast.error('Informe o motivo da exclusão (mínimo 3 caracteres).')
                return
            }
            await documentoService.excluirDocumento(deleteDocumentoId, motivo)
            toast.success('Documento excluído. Motivo registrado em Motivos doc. internos.')
            setDeleteDocumentoId(null)
            setDeleteDocumentoOrigem(null)
            setMotivoExclusao('')
            setHistoricoDocInternosTick((t) => t + 1)
            await handleSearchClick()
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    async function handleCancelarSolicitacao() {
        if (!cancelDocumentoId) return
        if (!exclusaoDocInternoModulo(cancelDocumentoOrigem)) {
            toast.error('Cancelamento com histórico vale só para documentos internos (origem DOCINTERNO).')
            return
        }
        try {
            await documentoService.cancelarDocumento(cancelDocumentoId)
            toast.success('Solicitação cancelada. Registrado em Motivos doc. internos.')
            setCancelDocumentoId(null)
            setCancelDocumentoOrigem(null)
            setHistoricoDocInternosTick((t) => t + 1)
            await handleSearchClick()
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    async function submitDocumento(data: Documento) {
        setIsLoading(true)
        setError(null)
        try {
            if (!data.aprovadores.some(a => a.usuario === userCodusuario)) {
                data.aprovadores = [
                    { usuario: userCodusuario, ordem: 1 },
                    ...data.aprovadores
                ];
            }
            data.anexos = anexosSubmit;
            if (!updateDocumentoMode) {
                await documentoService.createElement(data)
            } else {
                await servico().createElement(data)
            }
            form.reset()
            setAnexosSubmit([])
            const nomeSalvo = data.nome?.trim()
            const lista = await handleSearchClick()
            if (!updateDocumentoMode && nomeSalvo) {
                const criado = lista
                    .filter((d) => (d.nome ?? '').trim() === nomeSalvo)
                    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
                const origemCriado = criado ? codigoOrigem(criado.origem) : ''
                if (origemCriado === 'DOCINTERNO') {
                    toast.success(
                        `Documento #${criado!.id} cadastrado. Origem: Documentos internos — ao excluir, informe o motivo (histórico Admin).`
                    )
                } else {
                    toast.warning(
                        criado
                            ? `Documento #${criado.id} apareceu com origem ${origemCriado || '?'}. ` +
                                  'Só origem DOCINTERNO grava motivo no histórico. Atualize o front (build-info) e cadastre de novo.'
                            : 'Documento salvo, mas não encontrado na lista. Confira filtros de data/aba.'
                    )
                }
            } else {
                toast.success(updateDocumentoMode ? 'Registro atualizado' : 'Registro enviado')
            }
            setIsFormDocumentoOpen(false)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleInserirAprovador() {
        formAprovadores.reset({
            id: 0,
            usuario: '',
            ordem: 1
        })
        setIsFormAprovadoresOpen(true)
    }

    async function handleExcluirAprovador() {
        if (!deleteAprovadorId) return
        try {
            if (ehDocInterno()) {
                await documentoService.removerAprovador(deleteAprovadorId)
            } else {
                await removerAprovador(deleteAprovadorId)
            }
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Aprovador excluído`)
            setDeleteAprovadorId(null)
            await handleSearchClick()
        }
    }

    async function submitAprovador(data: DocumentoAprovacao) {
        setError(null)
        try {
            await servico().adicionarAprovador(requisicaoSelecionada!.id, data)
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

    async function handleSubmitAnexos() {
        setIsLoading(true)
        if (!file) return toast.error("Selecione um arquivo primeiro!")
        const base64 = await toBase64(file)
        const anexo: DocumentoAnexo = {
            anexo: base64,
            nome: fileName,
            documento_principal: isDocumentoPrincipal
        }
        setAnexosSubmit(prev => [...prev, anexo])
        setFile(null)
        setFileName("")
        setDocumentoPrincipal(false)
        setIsLoading(false)
    }

    function removerAnexo(index: number) {
        setAnexosSubmit(prev => prev.filter((_, i) => i !== index))
    }

    async function carregarPdfAnexo(anexo: DocumentoAnexo): Promise<string> {
        let arquivo: string
        if (anexo.anexo.startsWith('data:') || anexo.anexo.startsWith('/anexos/') === false && anexo.anexo.length > 500) {
            arquivo = normalizarPdfDataUrl(anexo.anexo)
        } else if (anexo.anexo.startsWith('/anexos/')) {
            arquivo = await servico().getAnexo(anexo.anexo)
        } else {
            arquivo = normalizarPdfDataUrl(anexo.anexo)
        }
        if (!base64PdfEhValido(arquivo)) {
            throw new Error(
                'O arquivo não é um PDF válido. Se já tentou assinar antes, exclua o anexo e envie o PDF de novo.'
            )
        }
        return arquivo
    }

    async function handleVisualizarAnexo(anexo: DocumentoAnexo) {
        setIsLoading(true)
        try {
            const arquivo = await carregarPdfAnexo(anexo)
            setAnexoSelecionado(anexo)
            setAnexoPdfBase64ParaAssinatura(arquivo)
            setIsModalVisualizarAnexoOpen(true)
        } catch (err) {
            console.error(err)
            const msg = err instanceof Error ? err.message : 'Não foi possível carregar o anexo.'
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleImprimirAnexoDireto(anexo: DocumentoAnexo) {
        setIsLoading(true)
        try {
            const arquivo = await carregarPdfAnexo(anexo)
            imprimirPdfBase64(base64ParaImpressao(arquivo))
        } catch (err) {
            console.error(err)
            const msg = err instanceof Error ? err.message : 'Não foi possível imprimir o documento.'
            toast.error(msg)
        } finally {
            setIsLoading(false)
        }
    }

    function handleImprimirAnexo() {
        if (!anexoPdfBase64ParaAssinatura) return
        imprimirPdfBase64(base64ParaImpressao(anexoPdfBase64ParaAssinatura))
    }

    async function handleAssinarAnexo(data: DocumentoAnexoAssinar) {
        setIsLoading(true)
        setSearched(false)
        const toastId = toast.loading("Assinando documento e gerando comprovante PlugSign…")
        try {
            const msg = await servico().assinar(data)
            toast.dismiss(toastId)
            if (msg.includes("não foi gerado") || msg.includes("PaperSign em anexo (PlugSign")) {
                toast.warning(msg)
            } else {
                toast.success(msg)
            }
            const docId = requisicaoSelecionada?.id
            const filtrados = await handleSearch(query)
            if (docId != null) {
                const atualizado = filtrados.find((d) => d.origem === origemAtual.current && d.id === docId)
                if (atualizado) {
                    setRequisicaoSelecionada(atualizado)
                    if (isModalAnexosOpen) {
                        atualizarListaAnexosModal(atualizado)
                    }
                }
            }
        } catch (err) {
            toast.dismiss(toastId)
            toast.error((err as Error).message)
        } finally {
            setIsModalVisualizarAnexoOpen(false)
            setAnexoPdfBase64ParaAssinatura(null)
            setSearched(true)
            setIsLoading(false)
        }
    }

    async function confirmarAssinaturaAnexo({ page, posX, posY, largura, altura }: PdfSignData) {
        // Certificado A1 é opcional em todas as origens (internos inclusive): só quando a pessoa marca a opção.
        const comCertificado = assinarComCertificado
        if (comCertificado && !certStatus?.temCertificadoA1 && !certStatus?.certificadoPersistido) {
            const detalhe = certStatus?.motivoCertificado
                || (certStatus?.vinculadoPlugSign
                    ? "Conta PlugSign encontrada, mas sem certificado A1 ativo. Envie o .pfx."
                    : "Cadastre seu certificado A1 (.pfx) no DocuSign antes de assinar.");
            toast.error(detalhe);
            setIsCertDialogOpen(true);
            return;
        }
        const pdfBase64 = anexoPdfBase64ParaAssinatura;
        if (!pdfBase64 || !base64PdfEhValido(pdfBase64)) {
            toast.error("Documento não carregado ou PDF inválido. Feche e abra o anexo novamente antes de assinar.");
            return;
        }
        const dadosAssinatura: DocumentoAnexoAssinar = {
            id: anexoSelecionado!.id,
            anexo: pdfBase64,
            pagina: page,
            posX,
            posY,
            largura,
            altura,
            dataHoraAssinatura: new Date().toLocaleString('pt-BR'),
            comCertificado,
        };
        await handleAssinarAnexo(dadosAssinatura);
    }

    const colunas = useMemo<ColumnDef<ItemWaySign>[]>(
        () => [
            { id: 'id', header: 'ID', accessorFn: (row) => rotuloIdWaySign(row) },
            {
                id: 'data',
                header: 'Data',
                accessorFn: (row) => safeDateLabel((row.origem === 'INTERNO' ? row.data_criacao : row.data_utc) ?? undefined),
            },
            {
                id: 'origem',
                header: 'Origem',
                cell: ({ row }) => (
                    <Badge variant={row.original.origem === 'PLUGSIGN' ? 'secondary' : 'outline'}>
                        {ROTULO_ORIGEM[row.original.origem] ?? row.original.origem}
                    </Badge>
                ),
            },
            { accessorKey: 'usuario_nome', header: 'Solicitante' },
            { accessorKey: 'nome', header: 'Descrição' },
            {
                id: 'situacao',
                header: 'Situação',
                cell: ({ row }) => {
                    const s = row.original.situacao_waysign
                    return (
                        <Badge variant={s === 'CONCLUÍDO' ? 'default' : s === 'PENDENTE' ? 'secondary' : s === 'RECUSADO' || s === 'CANCELADO' ? 'destructive' : 'outline'}>
                            {s || '—'}
                        </Badge>
                    )
                },
            },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => {
                    if (row.original.origem === 'PLUGSIGN') {
                        return (
                            <WaySignPlugSignAcoes
                                item={row.original}
                                isAdmin={isAdminUser}
                                assinarHabilitado={assinarHabilitado}
                                onAssinado={() => setRecarga((r) => r + 1)}
                            />
                        )
                    }
                    const usuarioAprovador = row.original.aprovadores.some(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    );
                    const nivelUsuario = row.original.aprovadores.find(
                        ap => stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim())
                    )?.ordem ?? 1;
                    const todasInferioresAprovadas = nivelUsuario == 1 || (row.original.aprovadores.filter(ap => ap.ordem < (nivelUsuario)).every(ap => ap.aprovacao === 'A'));

                    const usuarioAprovou = row.original.aprovadores.some(ap =>
                        stripDiacritics(ap.usuario.toLowerCase().trim()) === stripDiacritics(userCodusuario.toLowerCase().trim()) && (ap.aprovacao === 'A' || ap.aprovacao === 'R')
                    );

                    const status_liberado = ['EM ANDAMENTO', 'PENDENTE'].includes(row.original.situacao)
                        && row.original.situacao !== 'CANCELADO';
                    const assinouOuSemAnexos = (row.original.anexos?.length ?? 0) === 0 || row.original.anexos?.some(a => a.documento_assinado === 1);
                    const podeAprovar = todasInferioresAprovadas && usuarioAprovador && !usuarioAprovou && status_liberado && assinouOuSemAnexos;
                    const origemItem = codigoOrigem((row.original as ItemWaySign).origem)
                    /* Excluir/cancelar com motivo e histórico só em DOCUMENTOS_INTERNOS_* (DOCINTERNO).
                       ORIGEM INTERNO = fila legada DOCUSIGN_* (sem motivo/histórico neste painel). */
                    const ehDocInternoLista = origemItem === 'DOCINTERNO'
                    const podeExcluir = ehDocInternoLista && podeExcluirDocumentoCriador({
                        usuario_criacao: row.original.usuario_criacao,
                        usuario_nome: row.original.usuario_nome,
                        userCodusuario,
                        userName,
                        cancelado: row.original.cancelado,
                        situacao: row.original.situacao,
                        isAdmin: isAdminUser,
                    });
                    const podeCancelar = ehDocInternoLista && podeCancelarDocumentoCriador({
                        usuario_criacao: row.original.usuario_criacao,
                        usuario_nome: row.original.usuario_nome,
                        userCodusuario,
                        userName,
                        cancelado: row.original.cancelado,
                        situacao: row.original.situacao,
                        isAdmin: isAdminUser,
                    });

                    const anexoDocumento = resolverAnexoDocumento(row.original.anexos)

                    return (
                        <div className="flex flex-wrap gap-2">
                            {row.original.minha_acao && !assinouOuSemAnexos && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    title="Abrir o documento para assinar"
                                    onClick={() => abrirDocumentoPrincipal(row.original)}
                                >
                                    <FileSignature className="w-4 h-4" />
                                    Assinar
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirDocumentoPrincipal(row.original)}
                            >
                                <Eye className="w-4 h-4" />
                                Documento
                                {anexoDocumento?.documento_assinado == 1 && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                title="Imprimir documento"
                                onClick={() => imprimirDocumentoPrincipal(row.original)}
                            >
                                <Printer className="w-4 h-4" />
                                Imprimir
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleAnexos(row.original)}>
                                Anexos {(row.original.anexos?.length ?? 0) > 0 ? `(${row.original.anexos.length})` : ''}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleAprovacoes(row.original)}>
                                Aprovações
                            </Button>

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                    onClick={() => handleAprovar(row.original, 1)}
                                >
                                    Aprovar
                                </Button>
                            )}

                            {podeAprovar && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAprovar(row.original, 0)}
                                >
                                    Reprovar
                                </Button>
                            )}

                            {podeCancelar && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        marcarOrigem(row.original)
                                        setCancelDocumentoOrigem(origemItem)
                                        setCancelDocumentoId(row.original.id)
                                    }}
                                >
                                    Cancelar solicitação
                                </Button>
                            )}

                            {podeExcluir && (<Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    marcarOrigem(row.original)
                                    setDeleteDocumentoOrigem(origemItem)
                                    setMotivoExclusao('')
                                    setDeleteDocumentoId(row.original.id)
                                }}
                            >
                                Excluir
                            </Button>)}
                        </div>
                    );
                }
            }
        ],
        [userName, userCodusuario, isAdminUser, assinarHabilitado]
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

    const colunasAprovacoes = useMemo<ColumnDef<DocumentoAprovacao>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'usuario_nome', header: 'Usuário' },
            { accessorKey: 'ordem', header: 'Ordem' },
            { accessorKey: 'aprovacao', header: 'Situação' },
            { accessorKey: 'data_aprovacao', header: 'Data aprovação', accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao != null ? String(row.data_aprovacao) : null) },
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

    const colunasAnexos = useMemo<ColumnDef<DocumentoAnexo>[]>(
        () => [
            { accessorKey: 'id', header: 'Id' },
            { accessorKey: 'nome', header: 'Nome / descrição' },
            {
                accessorKey: 'documento_principal',
                header: 'Tipo',
                cell: ({ row }) => {
                    const nome = row.original.nome ?? ''
                    if (row.original.documento_principal) return 'Documento principal'
                    if (nome.includes('Comprovante PlugSign')) return 'Comprovante PlugSign'
                    if (nome.includes('Comprovante')) return 'Comprovante'
                    return 'Anexo'
                },
            },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVisualizarAnexo(row.original)}
                        >
                            <Eye className="w-4 h-4" />
                            Visualizar
                            {row.original.documento_assinado == 1 && (
                                <Check className="w-4 h-4 text-green-500" />
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImprimirAnexoDireto(row.original)}
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir
                        </Button>
                    </div>
                )
            }
        ],
        []
    )

    // T-WS3a: Documentos (lista única) / Solicitações (Enviadas | Recebidas da mesma lista) / Clientes e parceiros.
    const [solicitarOpen, setSolicitarOpen] = useState(false)
    const [fornecedorPrefill, setFornecedorPrefill] = useState<{ nome?: string; email?: string } | null>(null)

    function trocarAba(valor: string) {
        if (valor === 'solicitacoes') {
            setVisao((v) => (v === 'enviados' || v === 'recebidos' ? v : 'enviados'))
        } else if (valor === 'documentos' && aba === 'solicitacoes') {
            setVisao('')
        }
        setAba(valor)
    }

    // Tour Raphaela: troca a aba controlada (Radix Tabs não muda só com .click()).
    // Aceita os valores antigos (solicitacao, minhas-solicitacoes, fornecedor) e os novos.
    useEffect(() => {
        const handler = (ev: Event) => {
            const detail = (ev as CustomEvent<string>).detail
            if (detail !== 'solicitacao' && detail !== 'solicitar') setSolicitarOpen(false)
            if (detail === 'documentos') {
                setAba('documentos')
            } else if (detail === 'meus') {
                setAba('meus')
            } else if (detail === 'solicitacao' || detail === 'solicitar') {
                setAba('documentos')
                setSolicitarOpen(true)
            } else if (detail === 'minhas-solicitacoes' || detail === 'solicitacoes') {
                setVisao((v) => (v === 'enviados' || v === 'recebidos' ? v : 'enviados'))
                setAba('solicitacoes')
            } else if (detail === 'fornecedor' || detail === 'clientes') {
                setAba('clientes')
            } else if (['templates', 'painel', 'relatorio', 'mensagens', 'lotes', 'admin', 'doc-acoes'].includes(detail)) {
                setAba(detail)
            }
        }
        window.addEventListener('tour-plugsign-aba', handler)
        return () => window.removeEventListener('tour-plugsign-aba', handler)
    }, [])

    const emSolicitacoes = aba === 'solicitacoes'
    // Solicitações > Histórico WaySign: o painel antigo das solicitações PlugSign (status, quem abriu, histórico).
    const [verHistoricoWaySign, setVerHistoricoWaySign] = useState(false)

    // Painel, Relatório e Mensagens só aparecem depois da cópia dos dados da PlugSign (senão ficariam em branco).
    const [espelhoDisponivel, setEspelhoDisponivel] = useState(false)
    useEffect(() => {
        if (temWaySign !== true) return
        listarAlertas()
            .then((r) => setEspelhoDisponivel(r.disponivel === true))
            .catch(() => setEspelhoDisponivel(false))
    }, [temWaySign])

    return (
        <div className="p-6">
            <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
                <TabsList id="tour-plugsign-guias" className="flex-wrap h-auto w-fit">
                    {(temWaySign || temDocumentos) && (
                        <TabsTrigger id="tour-plugsign-documentos" value="documentos">
                            <FileSignature className="w-4 h-4" /> Documentos
                        </TabsTrigger>
                    )}
                    {(temWaySign || temDocumentos) && (
                        <TabsTrigger id="tour-plugsign-meus" value="meus">
                            <FolderCheck className="w-4 h-4" /> Meus documentos
                        </TabsTrigger>
                    )}
                    {temWaySign && (
                    <>
                    <TabsTrigger id="tour-plugsign-minhas" value="solicitacoes">
                        <History className="w-4 h-4" /> Solicitações
                    </TabsTrigger>
                    <TabsTrigger id="tour-plugsign-fornecedor" value="clientes">
                        <UserPlus className="w-4 h-4" /> Clientes e parceiros
                    </TabsTrigger>
                    {espelhoDisponivel && (
                        <>
                            <TabsTrigger id="tour-plugsign-painel" value="painel">
                                <BarChart3 className="w-4 h-4" /> Painel
                            </TabsTrigger>
                            <TabsTrigger id="tour-plugsign-relatorio" value="relatorio">
                                <Table2 className="w-4 h-4" /> Relatório
                            </TabsTrigger>
                            <TabsTrigger id="tour-plugsign-mensagens" value="mensagens">
                                <Mail className="w-4 h-4" /> Mensagens
                            </TabsTrigger>
                        </>
                    )}
                    <TabsTrigger id="tour-plugsign-templates" value="templates">
                        <LayoutTemplate className="w-4 h-4" /> Templates
                    </TabsTrigger>
                    {isAdminUser && (
                        <TabsTrigger id="tour-plugsign-lotes" value="lotes">
                            <Boxes className="w-4 h-4" /> Lotes
                        </TabsTrigger>
                    )}
                    {isAdminUser && (
                        <TabsTrigger id="tour-plugsign-admin" value="admin">
                            <Settings className="w-4 h-4" /> Administração
                        </TabsTrigger>
                    )}
                    </>
                    )}
                    {isAdminUser && (
                        <TabsTrigger id="tour-plugsign-doc-acoes" value="doc-acoes">
                            <ClipboardList className="w-4 h-4" /> Motivos doc. internos
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="clientes" className="mt-0 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Fornecedores e parceiros são pessoas de fora da empresa que assinam documentos.
                        Cadastre aqui para que eles recebam o acesso e apareçam na hora de enviar para assinatura.
                    </p>
                    <FornecedorParceiroPanel prefill={fornecedorPrefill} />
                    {isAdminUser && <ClientesSecao />}
                </TabsContent>

                <TabsContent value="painel" className="mt-0">
                    <WaySignPainel />
                </TabsContent>

                <TabsContent value="relatorio" className="mt-0">
                    <WaySignRelatorio />
                </TabsContent>

                <TabsContent value="mensagens" className="mt-0">
                    <WaySignMensagens />
                </TabsContent>

                <TabsContent value="templates" className="mt-0">
                    <WaySignTemplatesPanel onEnviado={() => setRecarga((r) => r + 1)} />
                </TabsContent>

                {isAdminUser && (
                    <TabsContent value="lotes" className="mt-0">
                        <WaySignLotesPanel onNovoLote={() => setSolicitarOpen(true)} />
                    </TabsContent>
                )}

                {isAdminUser && (
                    <TabsContent value="admin" className="mt-0">
                        <WaySignAdminPanel />
                    </TabsContent>
                )}

                {isAdminUser && (
                    <TabsContent value="doc-acoes" className="mt-0">
                        <WaySignDocumentosInternosAcoesPanel refreshToken={historicoDocInternosTick} />
                    </TabsContent>
                )}

                {/* Solicitar assinatura: o painel de envio atual, agora em modal (sem mudar o envio). */}
                <Dialog
                    open={solicitarOpen}
                    onOpenChange={(open) => {
                        setSolicitarOpen(open)
                        if (!open) void handleSearchClick()
                    }}
                >
                    <DialogContent className="sm:max-w-[min(1100px,95vw)] max-h-[92dvh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Solicitar assinatura</DialogTitle>
                            <DialogDescription>Envie documentos para assinatura pela PlugSign.</DialogDescription>
                        </DialogHeader>
                        <SolicitacaoAssinaturaPanel
                            onCadastrarFornecedor={(draft) => {
                                setFornecedorPrefill(draft ?? null)
                                setSolicitarOpen(false)
                                setAba('clientes')
                            }}
                        />
                    </DialogContent>
                </Dialog>

                {(aba === 'documentos' || emSolicitacoes || emMeus) && (
                <div className="mt-0 space-y-0">
            {/* Header */}
            <Card id="tour-plugsign-doc-painel" className="mb-6">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <CardTitle id="tour-plugsign-doc-titulo" className="text-2xl font-bold">
                            {emSolicitacoes ? 'Solicitações' : emMeus ? 'Meus documentos' : titulo}
                        </CardTitle>
                        {emMeus && (
                            <Tabs value={origemFiltrada || 'todos'} onValueChange={(v) => setOrigemFiltrada(v === 'todos' ? '' : v)}>
                                <TabsList id="tour-plugsign-meus-origem">
                                    <TabsTrigger value="todos">Todos</TabsTrigger>
                                    <TabsTrigger value="INTERNOS">Internos (PaperSign)</TabsTrigger>
                                    {temWaySign && <TabsTrigger value="EXTERNOS">Externos (WaySign)</TabsTrigger>}
                                </TabsList>
                            </Tabs>
                        )}
                        {emSolicitacoes && (
                            <Tabs
                                value={verHistoricoWaySign ? 'historico' : visao === 'recebidos' ? 'recebidos' : 'enviados'}
                                onValueChange={(v) => {
                                    setVerHistoricoWaySign(v === 'historico')
                                    if (v !== 'historico') setVisao(v)
                                }}
                            >
                                <TabsList id="tour-plugsign-minhas-painel" className="flex-wrap h-auto">
                                    <TabsTrigger value="enviados">Enviadas</TabsTrigger>
                                    <TabsTrigger value="recebidos">Recebidas</TabsTrigger>
                                    <TabsTrigger value="historico">Histórico WaySign</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                        <a
                            id="tour-plugsign-waysign-link"
                            href="https://app.plugsign.com.br/signin/?secure=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                            title="Abrir WaySign"
                        >
                            <ExternalLink className="h-4 w-4" />
                            WaySign
                        </a>
                    </div>
                    <div id="tour-plugsign-doc-toolbar" className="flex flex-wrap justify-end items-end gap-3">
                        <WaySignAlertasBotao
                            id="tour-plugsign-alertas"
                            onAbrirDocumento={(key) => {
                                setOrigemFiltrada('')
                                setSituacaoFiltrada('')
                                setQuery(key)
                            }}
                        />
                        <Button
                            id="tour-plugsign-cert"
                            type="button"
                            variant={certStatus?.temCertificadoA1 ? "outline" : "default"}
                            onClick={() => setIsCertDialogOpen(true)}
                        >
                            {certStatus?.temCertificadoA1 ? "Certificado A1 OK" : "Certificado digital A1"}
                        </Button>
                        {situacaoDaAba == null && (
                        <div id="tour-plugsign-datas" className="flex flex-wrap items-end gap-3">
                        {/* Data de */}
                        <div className="flex flex-col">
                            <Label htmlFor="docDateFrom">Data de</Label>
                            <Input
                                id="docDateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        {/* Data até */}
                        <div className="flex flex-col">
                            <Label htmlFor="docDateTo">Data até</Label>
                            <Input
                                id="docDateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        </div>
                        )}
                        {/* Solicitante */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button id="tour-plugsign-solicitante" variant="outline" aria-label="Filtrar por solicitante">
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
                                <Button id="tour-plugsign-filtros" variant="outline" aria-label="Abrir filtros">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Filtros</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                {situacaoDaAba == null && (
                                <>
                                <DropdownMenuLabel>Status</DropdownMenuLabel>
                                {[
                                    { valor: "PENDENTE", label: "Pendentes" },
                                    { valor: "CONCLUÍDO", label: "Concluídos" },
                                    { valor: "RECUSADO", label: "Recusados" },
                                    { valor: "CANCELADO", label: "Cancelados" },
                                    { valor: "", label: "Todos" },
                                ].map((s) => (
                                    <DropdownMenuCheckboxItem
                                        key={s.valor || "Todos"}
                                        checked={situacaoFiltrada == s.valor}
                                        onCheckedChange={() => setSituacaoFiltrada(s.valor)}
                                    >
                                        {s.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                </>
                                )}
                                <DropdownMenuLabel>Origem</DropdownMenuLabel>
                                {[
                                    { valor: "INTERNOS", label: "Internos (PaperSign)" },
                                    ...(temWaySign ? [{ valor: "EXTERNOS", label: "Externos (WaySign)" }] : []),
                                    { valor: "", label: "Todas" },
                                ].map((o) => (
                                    <DropdownMenuCheckboxItem
                                        key={o.valor || "Todas"}
                                        checked={origemFiltrada == o.valor}
                                        onCheckedChange={() => setOrigemFiltrada(o.valor)}
                                    >
                                        {o.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuLabel>Visão</DropdownMenuLabel>
                                {VISOES.map((v) => (
                                    <DropdownMenuCheckboxItem
                                        key={v.valor || "Todos"}
                                        checked={visao == v.valor}
                                        onCheckedChange={() => setVisao(v.valor)}
                                    >
                                        {v.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 md:flex-row">
                    <div id="tour-plugsign-busca" className="relative flex-1 w-full">
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

                    {/* Um botão só: aprovação interna (fluxo em níveis do PaperSign) ou envio para assinatura pela PlugSign. */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button id="tour-plugsign-solicitacao" className="flex items-center">
                                <SquarePlus className="mr-1 h-4 w-4" /> Novo
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                            <DropdownMenuItem onSelect={() => handleInserirDocumento()} className="flex-col items-start gap-0.5">
                                <span className="font-medium">Aprovação interna (em níveis)</span>
                                <span className="text-xs text-muted-foreground">
                                    Aprovadores do PaperSign, em ordem, assinando aqui dentro (certificado A1 opcional).
                                </span>
                            </DropdownMenuItem>
                            {temWaySign && (
                            <DropdownMenuItem onSelect={() => setSolicitarOpen(true)} className="flex-col items-start gap-0.5">
                                <span className="font-medium">Enviar para assinatura (PlugSign)</span>
                                <span className="text-xs text-muted-foreground">
                                    Para fornecedores, parceiros e quem assina pelo link do e-mail.
                                </span>
                            </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardContent>
            </Card>

            {emSolicitacoes && verHistoricoWaySign && <MinhasSolicitacoesPanel />}

            {/* Main */}
            <Card id="tour-plugsign-lista" className={emSolicitacoes && verHistoricoWaySign ? "hidden" : "mb-6"}>
                <CardContent className="flex flex-col gap-3">
                    {avisoLista && (
                        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            {avisoLista}
                        </p>
                    )}
                    {(origemFiltrada || visao) && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            {origemFiltrada && (
                                <Badge variant="outline" className="gap-1">
                                    Origem: {ROTULO_ORIGEM[origemFiltrada] ?? origemFiltrada}
                                    <button type="button" aria-label="Remover filtro de origem" onClick={() => setOrigemFiltrada("")}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )}
                            {visao && (
                                <Badge variant="outline" className="gap-1">
                                    {VISOES.find((v) => v.valor === visao)?.label}
                                    <button type="button" aria-label="Remover filtro de visão" onClick={() => setVisao("")}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )}
                        </div>
                    )}
                    <DataTable
                        columns={colunas}
                        data={results}
                        loading={isLoading}
                        hidePagination
                        hideSearch
                        getRowDataId={(d) => (d.origem === 'INTERNO' ? d.id : null)}
                    />
                    <div id="tour-plugsign-paginacao" className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLoading || pagina <= 1}
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        >
                            Anterior
                        </Button>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Página {pagina} de {ultimaPagina || 1} · {totalItens} documento(s)</span>
                            <select
                                aria-label="Itens por página"
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                value={tamanhoPagina}
                                onChange={(e) => setTamanhoPagina(Number(e.target.value))}
                            >
                                {TAMANHOS_PAGINA.map((t) => (
                                    <option key={t} value={t}>{t} por página</option>
                                ))}
                            </select>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLoading || pagina >= ultimaPagina}
                            onClick={() => setPagina((p) => p + 1)}
                        >
                            Próxima
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Aprovações */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAprovacoesOpen} onOpenChange={setIsModalAprovacoesOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Aprovações documento n° ${requisicaoSelecionada.id}`}</DialogTitle>
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

            {/* Anexos */}
            {requisicaoSelecionada && (
                <Dialog open={isModalAnexosOpen} onOpenChange={setIsModalAnexosOpen}>
                    <DialogContent className="w-fit sm:max-w-[90vw] overflow-x-auto overflow-y-auto max-h-[90dvh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Anexos documento n° ${requisicaoSelecionada.id}`}</DialogTitle>
                        </DialogHeader>
                        <div className="w-full">
                            {selectedAnexosResult.length === 0 && !isLoading && !ehDocInterno() && (
                                <div className="mb-4 space-y-3 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        O PDF deste documento está na PlugSign. Clique abaixo para buscar o arquivo assinado.
                                    </p>
                                    <Button type="button" onClick={handleResgatarPlugSign}>
                                        Resgatar PDF da PlugSign
                                    </Button>
                                </div>
                            )}
                            <DataTable
                                columns={colunasAnexos}
                                data={selectedAnexosResult}
                                loading={isLoading}
                                globalFilterAccessorKey={["id", "nome"]}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

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

            {/* Form documento */}
            <Dialog open={isFormDocumentoOpen} onOpenChange={setIsFormDocumentoOpen}>
                <DialogContent className="max-w-2xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateDocumentoMode ? `Editar: ${requisicaoSelecionada?.nome}` : `Novo documento`}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Anexos */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Anexos</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-col gap-3">
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
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={isDocumentoPrincipal}
                                        onCheckedChange={(value) => setDocumentoPrincipal(!!value)}
                                    />
                                    <Label>Documento principal</Label>
                                </div>
                                <Button
                                    onClick={handleSubmitAnexos}
                                    disabled={!file || isLoading || !fileName?.trim()}
                                    className="flex items-center"
                                >
                                    {isLoading ? "Enviando..." : "Anexar documento"}
                                </Button>
                            </div>
                            {anexosSubmit.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                                    <span>{item.nome}{item.documento_principal ? ' - Documento principal' : ''}</span>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="destructive" size="icon" onClick={() => removerAnexo(i)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            title="Visualizar"
                                            onClick={() => handleVisualizarAnexo(item)}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            title="Imprimir"
                                            onClick={() => handleImprimirAnexoDireto(item)}
                                        >
                                            <Printer className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitDocumento)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="nome"
                                rules={{
                                    required: 'Descrição é obrigatório',
                                    maxLength: { value: 100, message: 'Descrição com no máximo 100 caracteres' },
                                }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição ({(field.value ?? '').length}/100)</FormLabel>
                                        <FormControl>
                                            <Input {...field} maxLength={100} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* --- Aprovadores (useFieldArray) --- */}
                            <AprovadoresSection form={form} usuarios={usuarios} />

                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>


                </DialogContent>
            </Dialog>

            {/* Form aprovadores */}
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
                                            <Popover open={openUsuarioAprovadorSearch} onOpenChange={setOpenUsuarioAprovadorSearch}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full justify-between"
                                                    >
                                                        {field.value
                                                            ? `${field.value} - ${usuarios.find(u => u.codusuario === field.value)?.nome ?? ''}`
                                                            : 'Selecione o usuário'}
                                                        <ChevronsUpDown className="opacity-50 size-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverPortal>
                                                    <PopoverContent
                                                        className="p-0 w-[400px] pointer-events-auto z-[9999]"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Command>
                                                            <CommandInput placeholder="Buscar usuário..." />
                                                            <CommandList>
                                                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {usuarios.map((u) => (
                                                                        <CommandItem
                                                                            key={`${u.codusuario}-${u.sequencial}`}
                                                                            value={`${u.codusuario} ${u.nome}`}
                                                                            onSelect={() => {
                                                                                field.onChange(u.codusuario)
                                                                                setOpenUsuarioAprovadorSearch(false)
                                                                            }}
                                                                        >
                                                                            {u.codusuario} - {u.nome}
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
                            <FormField
                                control={formAprovadores.control}
                                name="ordem"
                                rules={{ required: 'Ordem é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ordem</FormLabel>
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

            <Dialog
                open={deleteDocumentoId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteDocumentoId(null)
                        setDeleteDocumentoOrigem(null)
                        setMotivoExclusao('')
                    }
                }}
            >
                <DialogContent className="max-w-md sm:max-w-lg" showCloseButton>
                    <DialogHeader>
                        <DialogTitle>Excluir documento #{deleteDocumentoId ?? ''}</DialogTitle>
                        <DialogDescription>
                            {exclusaoDocInternoModulo(deleteDocumentoOrigem)
                                ? 'Informe o motivo (obrigatório). O registro aparece na aba Motivos doc. internos.'
                                : `Origem ${deleteDocumentoOrigem ?? '?'}. Só documentos com origem Documentos internos (DOCINTERNO) usam este fluxo.`}
                        </DialogDescription>
                    </DialogHeader>
                    {exclusaoDocInternoModulo(deleteDocumentoOrigem) && (
                        <div className="space-y-2">
                            <Label htmlFor="motivo-exclusao-ws">Motivo da exclusão</Label>
                            <textarea
                                id="motivo-exclusao-ws"
                                autoFocus
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={motivoExclusao}
                                onChange={(e) => setMotivoExclusao(e.target.value)}
                                maxLength={500}
                                placeholder="Ex.: documento enviado por engano, substituído por nova versão…"
                            />
                            <p className="text-xs text-muted-foreground">Mínimo 3 caracteres.</p>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setDeleteDocumentoId(null)
                                setDeleteDocumentoOrigem(null)
                                setMotivoExclusao('')
                            }}
                        >
                            Voltar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={!exclusaoDocInternoModulo(deleteDocumentoOrigem) || motivoExclusao.trim().length < 3}
                            onClick={() => void handleExcluirDocumento()}
                        >
                            Confirmar exclusão
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {cancelDocumentoId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">Cancelar solicitação</h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Ninguém poderá mais aprovar ou assinar o documento #{cancelDocumentoId}; ele permanece visível como cancelado.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setCancelDocumentoId(null)}>Voltar</Button>
                            <Button variant="destructive" onClick={handleCancelarSolicitacao}>Cancelar solicitação</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de exclusão aprovadores */}
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

            {/* Certificado A1 — vínculo automático PlugSign pelo e-mail do cadastro */}
            <Dialog open={isCertDialogOpen} onOpenChange={setIsCertDialogOpen}>
                <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div className="space-y-1 text-left">
                                <DialogTitle>Certificado digital A1</DialogTitle>
                                <DialogDescription className="text-sm">
                                    Assinatura ICP-Brasil integrada ao PaperSign. Você não precisa acessar outro portal.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="px-6 py-4 space-y-4">
                        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">Sua conta PaperSign</span>
                                {certVinculando ? (
                                    <Badge variant="secondary" className="gap-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Verificando…
                                    </Badge>
                                ) : certStatus?.vinculadoPlugSign ? (
                                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                                        Vinculada à assinatura digital
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Aguardando vínculo</Badge>
                                )}
                            </div>
                            {certStatus?.nome && (
                                <p className="text-sm text-foreground">{certStatus.nome}</p>
                            )}
                            {certStatus?.usuario && (
                                <p className="text-xs text-muted-foreground">
                                    Usuário: <span className="font-medium text-foreground">{certStatus.usuario}</span>
                                </p>
                            )}
                            {certStatus?.emailMascarado && (
                                <p className="text-xs text-muted-foreground">
                                    Identificação no cadastro: {certStatus.emailMascarado}
                                </p>
                            )}
                            {certStatus?.motivo && !certStatus.vinculadoPlugSign && (
                                <p className="text-xs text-amber-700 dark:text-amber-400">{certStatus.motivo}</p>
                            )}
                            {!certVinculando && certStatus?.vinculadoPlugSign && !certStatus.temCertificadoA1 && (
                                <p className="text-xs text-muted-foreground">
                                    Conta encontrada na PlugSign pelo e-mail do seu cadastro. Envie o arquivo <b>.pfx</b> abaixo para concluir.
                                </p>
                            )}
                        </div>

                        {!certStatus?.plugsignAtivo ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                                {certStatus?.motivo ?? "Integração PlugSign indisponível. Solicite ao administrador a configuração do token da empresa."}
                            </div>
                        ) : temCertificado ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                                Certificado A1 ativo. Suas assinaturas no WaySign usarão validade ICP-Brasil (PlugSign).
                            </div>
                        ) : exibirFormularioCertificado ? (
                            <div className="grid gap-3">
                                <div>
                                    <Label htmlFor="certFile">Arquivo do certificado (.pfx ou .p12)</Label>
                                    <Input
                                        id="certFile"
                                        type="file"
                                        accept=".pfx,.p12"
                                        ref={certFileRef}
                                        className="mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="certSenha">Senha do certificado</Label>
                                    <Input
                                        id="certSenha"
                                        type="password"
                                        value={certSenha}
                                        onChange={(e) => setCertSenha(e.target.value)}
                                        placeholder="Senha definida ao exportar o .pfx"
                                        className="mt-1.5"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-2 px-6 py-4 border-t bg-muted/20">
                        {temCertificado && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:justify-start">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleRemoverCertificado}
                                    disabled={isLoading || certVinculando}
                                >
                                    {isLoading ? "Excluindo…" : "Excluir certificado"}
                                </Button>
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsCertDialogOpen(false)}>
                            Fechar
                        </Button>
                        {exibirFormularioCertificado && certStatus?.plugsignAtivo && (
                            <Button type="button" onClick={handleEnviarCertificado} disabled={isLoading || certVinculando}>
                                {isLoading ? "Enviando…" : "Adicionar certificado"}
                            </Button>
                        )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Visualizar anexo */}
            {anexoSelecionado && (
                <PdfViewerDialog
                    open={isModalVisualizarAnexoOpen}
                    onOpenChange={(open) => { if (!open) setAnexoPdfBase64ParaAssinatura(null); setIsModalVisualizarAnexoOpen(open); }}
                    title={`Anexo ${anexoSelecionado.nome}`}
                    pdfBase64={anexoPdfBase64ParaAssinatura}
                    canSign={anexoSelecionado.documento_assinado == 0 && estaNoFluxo(requisicaoSelecionada)}
                    onSign={confirmarAssinaturaAnexo}
                    onPrint={handleImprimirAnexo}
                    isLoading={isLoading}
                    extraControls={anexoSelecionado.documento_assinado == 0 && estaNoFluxo(requisicaoSelecionada)
                        && certStatus?.plugsignAtivo ? (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={assinarComCertificado}
                                onCheckedChange={(v) => setAssinarComCertificado(v === true)}
                            />
                            Assinar com certificado (A1)
                        </label>
                    ) : undefined}
                />
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
                )}
            </Tabs>
        </div>
    )
}

function AprovadoresSection({ form, usuarios }: { form: UseFormReturn<Documento>, usuarios: Usuario[] }) {
    const { control, register } = form;
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const { fields, append, remove } = useFieldArray({
        control,
        name: "aprovadores"
    });

    return (
        <div className="flex flex-col gap-2 border p-3 rounded-md">
            <label className="font-semibold">Aprovadores</label>
            {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 border p-2 rounded">
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
                                                                        key={`${u.codusuario}-${u.sequencial}`}
                                                                        value={`${u.codusuario} ${u.nome}`}
                                                                        onSelect={() => {
                                                                            field.onChange(u.codusuario)
                                                                            setOpenIndex(null)
                                                                        }}
                                                                    >
                                                                        {`${u.codusuario} ${u.nome}`}
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


                    {/* Ordem */}
                    <div className="flex flex-col w-20 shrink-0">
                        <label>Ordem</label>
                        <Input
                            type="number"
                            {...register(`aprovadores.${index}.ordem`, {
                                required: "Ordem obrigatória",
                                valueAsNumber: true,
                            })}
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
                onClick={() => append({ usuario: "", ordem: fields.length + 1 })}
            >
                + Adicionar aprovador
            </Button>
        </div>
    );
}
