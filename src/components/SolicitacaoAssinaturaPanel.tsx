'use client'

import React, { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Eye,
  FileUp,
  MapPin,
  MessageSquare,
  PenLine,
  Trash2,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PopoverPortal } from '@radix-ui/react-popover'
import PdfViewerDialog, { PdfSignData } from '@/components/PdfViewerDialog'
import { toBase64 } from '@/utils/functions'
import {
  baixarDocumentoAssinadoSolicitacao,
  criarSolicitacaoAssinatura,
  EquipePlugSignMembro,
  listarEquipePlugSign,
  SolicitacaoAssinaturaPayload,
  SolicitacaoAssinaturaResult,
  SolicitacaoCampo,
  SolicitacaoDestinatario,
} from '@/services/docusignService'

type ToggleKey =
  | 'exigirCertificadoDigital'
  | 'adicionarObservadores'
  | 'monitorarValidade'
  | 'autodestruir'
  | 'autenticacaoDoisFatores'
  | 'solicitarCpf'
  | 'solicitarDataNascimento'
  | 'solicitarSelfieDocumento'

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'exigirCertificadoDigital', label: 'Exigir assinatura com certificado digital.' },
  { key: 'adicionarObservadores', label: 'Adicionar observadores?' },
  { key: 'monitorarValidade', label: 'Monitorar validade?' },
  { key: 'autodestruir', label: 'Autodestruir solicitação?' },
  { key: 'autenticacaoDoisFatores', label: 'Autenticação de dois fatores?' },
  { key: 'solicitarCpf', label: 'Solicitar CPF' },
  { key: 'solicitarDataNascimento', label: 'Solicitar Data de Nascimento' },
  { key: 'solicitarSelfieDocumento', label: 'Deseja solicitar selfie e documento dos signatários?' },
]

const MODOS: { value: string; label: string }[] = [
  { value: 'all', label: 'De qualquer forma (podem escolher)' },
  { value: 'draw', label: 'Desenhar assinatura' },
  { value: 'text', label: 'Digitar nome' },
  { value: 'upload', label: 'Enviar imagem da assinatura' },
]

const TIPOS_CAMPO: { value: string; label: string; apiType: string; text?: string; w: number; h: number }[] = [
  { value: 'signature', label: 'Assinatura', apiType: 'signature', w: 200, h: 75 },
  { value: 'rubric', label: 'Rúbrica', apiType: 'rubric', w: 100, h: 50 },
  { value: 'nome', label: 'Nome completo', apiType: 'text', text: 'Nome completo', w: 220, h: 28 },
  { value: 'email', label: 'E-mail', apiType: 'text', text: 'E-mail', w: 220, h: 28 },
  { value: 'telefone', label: 'Telefone', apiType: 'text', text: 'Telefone', w: 160, h: 28 },
  { value: 'nascimento', label: 'Nascimento', apiType: 'text', text: 'Nascimento', w: 140, h: 28 },
  { value: 'endereco', label: 'Endereço', apiType: 'text', text: 'Endereço', w: 260, h: 28 },
  { value: 'empresa', label: 'Empresa', apiType: 'text', text: 'Empresa', w: 200, h: 28 },
  { value: 'cpf', label: 'C.P.F', apiType: 'text', text: 'CPF', w: 160, h: 28 },
  { value: 'cnpj', label: 'C.N.P.J', apiType: 'text', text: 'CNPJ', w: 180, h: 28 },
  { value: 'data', label: 'Data', apiType: 'text', text: 'Data', w: 120, h: 28 },
  { value: 'checkbox', label: 'Caixa de seleção', apiType: 'text', text: '☐', w: 28, h: 28 },
]

const CARD_COLORS = [
  'border-l-sky-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-violet-500',
  'border-l-rose-500',
]

type CampoUi = SolicitacaoCampo & { id: string; label: string }

type DestinatarioCard = SolicitacaoDestinatario & {
  id: string
  /** true = escolhido na equipe PlugSign; false = não encontrado (precisa cadastrar); null = ainda não validado */
  daEquipe: boolean | null
  expandPersonalizar: boolean
  expandMensagem: boolean
  expandModo: boolean
  expandCampos: boolean
  camposUi: CampoUi[]
}

function novoDestinatario(): DestinatarioCard {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    email: '',
    mensagemPrivada: '',
    modoAssinatura: 'all',
    daEquipe: null,
    expandPersonalizar: false,
    expandMensagem: false,
    expandModo: false,
    expandCampos: true,
    camposUi: [],
  }
}

function filtrarEquipe(equipe: EquipePlugSignMembro[], termo: string) {
  const t = termo.trim().toLowerCase()
  if (!t) return equipe.slice(0, 30)
  return equipe
    .filter(
      (m) =>
        m.nome.toLowerCase().includes(t) ||
        m.email.toLowerCase().includes(t) ||
        (m.primeiroNome ?? '').toLowerCase().includes(t) ||
        (m.ultimoNome ?? '').toLowerCase().includes(t)
    )
    .slice(0, 30)
}

function membroNaEquipe(equipe: EquipePlugSignMembro[], nome: string, email: string) {
  const n = nome.trim().toLowerCase()
  const e = email.trim().toLowerCase()
  if (e) {
    return equipe.find((m) => m.email.toLowerCase() === e) ?? null
  }
  if (!n) return null
  return (
    equipe.find((m) => m.nome.toLowerCase() === n) ??
    equipe.find((m) => m.nome.toLowerCase().includes(n)) ??
    null
  )
}

function labelCampo(c: CampoUi) {
  const tipo =
    c.type === 'rubric' ? 'Rubrica' : c.type === 'signature' ? 'Assinatura' : c.label
  const pos = c.paginaExtra
    ? 'página extra'
    : `pág. ${c.page}${c.posX != null ? ` @ ${Math.round((c.posX ?? 0) * 100)}%,${Math.round((c.posY ?? 0) * 100)}%` : ''}`
  return `${tipo}${c.label && c.label !== tipo ? ` (${c.label})` : ''} — ${pos}`
}

export default function SolicitacaoAssinaturaPanel({
  onCadastrarFornecedor,
}: {
  onCadastrarFornecedor?: (draft?: { nome?: string; email?: string }) => void
}) {
  const formId = useId()
  const [mensagem, setMensagem] = useState('')
  const [definirOrdem, setDefinirOrdem] = useState(true)
  const [destinatarios, setDestinatarios] = useState<DestinatarioCard[]>([novoDestinatario()])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [observadores, setObservadores] = useState('')
  const [validadeMeses, setValidadeMeses] = useState('12')
  const [dataExpiracao, setDataExpiracao] = useState('')
  const [nomeDocumento, setNomeDocumento] = useState('')
  const [resultado, setResultado] = useState<SolicitacaoAssinaturaResult | null>(null)
  const [baixandoKey, setBaixandoKey] = useState<string | null>(null)
  const [equipe, setEquipe] = useState<EquipePlugSignMembro[]>([])
  const [equipeLoading, setEquipeLoading] = useState(true)
  const [equipeErro, setEquipeErro] = useState<string | null>(null)
  const [openNomeId, setOpenNomeId] = useState<string | null>(null)
  const equipeRef = useRef<EquipePlugSignMembro[]>([])
  const [flags, setFlags] = useState<Record<ToggleKey, boolean>>({
    exigirCertificadoDigital: false,
    adicionarObservadores: false,
    monitorarValidade: false,
    autodestruir: false,
    autenticacaoDoisFatores: false,
    solicitarCpf: true,
    solicitarDataNascimento: true,
    solicitarSelfieDocumento: false,
  })
  const [isPending, startTransition] = useTransition()

  const [placeOpen, setPlaceOpen] = useState(false)
  const [placeDestId, setPlaceDestId] = useState<string | null>(null)
  const [placeTipo, setPlaceTipo] = useState(TIPOS_CAMPO[0])
  const [placePdfIndex, setPlacePdfIndex] = useState(0)
  const [viewOnlyOpen, setViewOnlyOpen] = useState(false)
  const [pdfPreviewB64, setPdfPreviewB64] = useState<string | null>(null)
  const [assinadoOpen, setAssinadoOpen] = useState(false)
  const [assinadoB64, setAssinadoB64] = useState<string | null>(null)
  const [assinadoTitulo, setAssinadoTitulo] = useState('Documento assinado')

  const pdfParaPosicionar = useMemo(
    () => arquivos[Math.min(placePdfIndex, Math.max(0, arquivos.length - 1))] ?? null,
    [arquivos, placePdfIndex]
  )

  const placeDest = useMemo(
    () => destinatarios.find((d) => d.id === placeDestId) ?? null,
    [destinatarios, placeDestId]
  )

  const placeOwnerLabel = useMemo(() => {
    if (!placeDest) return undefined
    return placeDest.email?.trim() || placeDest.nome?.trim() || undefined
  }, [placeDest])

  /** Todas as marcas posicionadas (todos os destinatários) — usadas no Ver e no Posicionar. */
  const allPdfMarkers = useMemo(() => {
    const list: {
      page: number
      posX: number
      posY: number
      largura?: number
      altura?: number
      label?: string
      displayText?: string
      owner?: string
      kind?: string
    }[] = []
    for (const d of destinatarios) {
      const owner = d.email?.trim() || d.nome?.trim() || undefined
      for (const c of d.camposUi) {
        if (c.paginaExtra || c.posX == null || c.posY == null) continue
        const kind = (c.type || '').toLowerCase()
        const displayText =
          kind === 'rubric'
            ? 'Rubrica'
            : kind === 'signature'
              ? 'Assinatura'
              : c.label.replace(/\s+\d+$/, '') || c.label
        list.push({
          page: c.page || 1,
          posX: c.posX,
          posY: c.posY,
          largura: c.largura ?? c.width,
          altura: c.altura ?? c.height,
          label: c.label,
          displayText,
          owner,
          kind: c.type,
        })
      }
    }
    return list
  }, [destinatarios])

  const placeMarkers = allPdfMarkers

  useEffect(() => {
    equipeRef.current = equipe
  }, [equipe])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setEquipeLoading(true)
      setEquipeErro(null)
      try {
        const list = await listarEquipePlugSign()
        if (!cancel) setEquipe(list)
      } catch (e) {
        if (!cancel) {
          setEquipe([])
          setEquipeErro(e instanceof Error ? e.message : 'Falha ao carregar equipe PlugSign.')
        }
      } finally {
        if (!cancel) setEquipeLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  function mesclarEquipe(list: EquipePlugSignMembro[]) {
    setEquipe((prev) => {
      const map = new Map(prev.map((m) => [m.email.toLowerCase(), m]))
      for (const m of list) map.set(m.email.toLowerCase(), m)
      return Array.from(map.values())
    })
  }

  function setFlag(key: ToggleKey, value: boolean) {
    setFlags((prev) => ({ ...prev, [key]: value }))
  }

  function atualizarDest(id: string, patch: Partial<DestinatarioCard>) {
    setDestinatarios((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function selecionarDaEquipe(id: string, m: EquipePlugSignMembro) {
    atualizarDest(id, {
      nome: m.nome,
      email: m.email,
      daEquipe: true,
    })
    setOpenNomeId(null)
  }

  async function validarDestPorId(id: string) {
    const dest = destinatarios.find((d) => d.id === id)
    if (!dest) return
    const t = dest.nome.trim()
    const e = dest.email.trim()
    if (!t && !e) {
      atualizarDest(id, { daEquipe: null })
      return
    }

    const base = equipeRef.current
    let hit = membroNaEquipe(base, dest.nome, dest.email)
    if (!hit && (t.length >= 2 || e.includes('@'))) {
      try {
        const list = await listarEquipePlugSign(e.includes('@') ? e : t)
        mesclarEquipe(list)
        hit = membroNaEquipe([...base, ...list], dest.nome, dest.email)
      } catch {
        /* mantém validação local */
      }
    }

    if (hit) {
      atualizarDest(id, { nome: hit.nome, email: hit.email, daEquipe: true })
    } else {
      atualizarDest(id, { daEquipe: t || e ? false : null })
    }
  }

  function removerDest(id: string) {
    setDestinatarios((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)))
  }

  function moverDest(id: string, dir: -1 | 1) {
    setDestinatarios((prev) => {
      const idx = prev.findIndex((d) => d.id === id)
      if (idx < 0) return prev
      const novo = idx + dir
      if (novo < 0 || novo >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(novo, 0, item)
      return copy
    })
  }

  function adicionarArquivos(fileList: FileList | null) {
    if (!fileList?.length) return
    const novos = Array.from(fileList)
    const invalidos = novos.filter((f) => {
      const n = f.name.toLowerCase()
      return !n.endsWith('.pdf') && f.type !== 'application/pdf'
    })
    if (invalidos.length > 0) {
      toast.error('A PlugSign aceita PDF nesta integração. Remova arquivos que não sejam PDF.', {
        description: invalidos.map((f) => f.name).join(', '),
      })
    }
    const pdfs = novos.filter((f) => {
      const n = f.name.toLowerCase()
      return n.endsWith('.pdf') || f.type === 'application/pdf'
    })
    if (pdfs.length === 0) return
    setArquivos((prev) => {
      const nomes = new Set(prev.map((p) => `${p.name}-${p.size}`))
      const extras = pdfs.filter((p) => !nomes.has(`${p.name}-${p.size}`))
      return [...prev, ...extras]
    })
  }

  function removerArquivo(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index))
  }

  function adicionarCampoExtra(destId: string, tipoValue: string) {
    const tipo = TIPOS_CAMPO.find((t) => t.value === tipoValue) ?? TIPOS_CAMPO[0]
    const campo: CampoUi = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: tipo.label,
      type: tipo.apiType,
      page: 1,
      paginaExtra: true,
      width: tipo.w,
      height: tipo.h,
      text: tipo.text,
    }
    setDestinatarios((prev) =>
      prev.map((d) => (d.id === destId ? { ...d, camposUi: [...d.camposUi, campo], expandCampos: true } : d))
    )
  }

  async function carregarPdfBase64(file: File) {
    const b64 = await toBase64(file)
    setPdfPreviewB64(b64)
    return b64
  }

  async function visualizarPdf(index: number) {
    const file = arquivos[index]
    if (!file) return
    try {
      setPlacePdfIndex(index)
      await carregarPdfBase64(file)
      setViewOnlyOpen(true)
    } catch {
      toast.error('Não foi possível abrir o PDF.')
    }
  }

  async function abrirPosicionar(destId: string, tipoValue: string, pdfIndex = placePdfIndex) {
    const file = arquivos[pdfIndex] ?? arquivos[0]
    if (!file) {
      toast.error('Adicione um PDF antes de posicionar assinatura ou rúbrica.')
      return
    }
    const tipo = TIPOS_CAMPO.find((t) => t.value === tipoValue) ?? TIPOS_CAMPO[0]
    setPlaceDestId(destId)
    setPlaceTipo(tipo)
    setPlacePdfIndex(pdfIndex)
    setViewOnlyOpen(false)
    try {
      await carregarPdfBase64(file)
      setPlaceOpen(true)
      setDestinatarios((prev) =>
        prev.map((d) => (d.id === destId ? { ...d, expandCampos: true } : d))
      )
    } catch {
      toast.error('Não foi possível ler o PDF para posicionar.')
    }
  }

  function confirmarPosicao(data: PdfSignData) {
    if (!placeDestId) return
    const w = Math.round(data.largura || placeTipo.w)
    const h = Math.round(data.altura || placeTipo.h)
    const nAssin = (placeDest?.camposUi.filter((c) => c.type === 'signature' && !c.paginaExtra).length ?? 0) + 1
    const nRub = (placeDest?.camposUi.filter((c) => c.type === 'rubric' && !c.paginaExtra).length ?? 0) + 1
    const label =
      placeTipo.apiType === 'signature'
        ? `Assinatura ${nAssin}`
        : placeTipo.apiType === 'rubric'
          ? `Rúbrica ${nRub}`
          : placeTipo.label

    const campo: CampoUi = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      type: placeTipo.apiType,
      page: data.page,
      paginaExtra: false,
      posX: data.posX,
      posY: data.posY,
      largura: w,
      altura: h,
      width: w,
      height: h,
      text: placeTipo.text,
    }
    setDestinatarios((prev) =>
      prev.map((d) =>
        d.id === placeDestId
          ? {
              ...d,
              expandCampos: true,
              camposUi: [...d.camposUi, campo],
            }
          : d
      )
    )
    // mantém o diálogo aberto (placeMode) para N assinaturas / N rúbricas
    toast.success(`${label} na página ${data.page}. Pode posicionar outra.`)
  }

  function removerCampo(destId: string, campoId: string) {
    setDestinatarios((prev) =>
      prev.map((d) =>
        d.id === destId
          ? { ...d, camposUi: d.camposUi.filter((c) => c.id !== campoId) }
          : d
      )
    )
  }

  function resumoCampos(d: DestinatarioCard) {
    const assin = d.camposUi.filter((c) => c.type === 'signature').length
    const rub = d.camposUi.filter((c) => c.type === 'rubric').length
    const outros = d.camposUi.length - assin - rub
    const parts: string[] = []
    if (assin) parts.push(`${assin} assinatura(s)`)
    if (rub) parts.push(`${rub} rúbrica(s)`)
    if (outros > 0) parts.push(`${outros} outro(s)`)
    if (parts.length === 0) return 'nenhum campo no PDF'
    return parts.join(' · ')
  }

  function handleEnviar() {
    if (arquivos.length === 0) {
      toast.error('Adicione ao menos um PDF.')
      return
    }

    const lista = destinatarios.map((d, i) => ({
      nome: d.nome.trim(),
      email: d.email.trim(),
      mensagemPrivada: d.mensagemPrivada?.trim() || undefined,
      modoAssinatura: d.modoAssinatura || 'all',
      ordem: i + 1,
      campos: d.camposUi.map((c) => {
        const { id, label, ...rest } = c
        void id
        void label
        return rest
      }),
    }))

    if (lista.some((d) => !d.email)) {
      toast.error('Preencha o e-mail de todos os destinatários.')
      return
    }
    if (lista.some((d) => !d.nome)) {
      toast.error('Preencha o nome de todos os destinatários.')
      return
    }

    const pendentes: string[] = []
    for (const d of destinatarios) {
      if (d.daEquipe === true) continue
      const hit = membroNaEquipe(equipe, d.nome, d.email)
      if (!hit) pendentes.push(d.nome.trim() || d.email.trim() || 'Destinatário')
    }
    if (pendentes.length > 0) {
      toast.error('Destinatário fora da equipe PlugSign', {
        description: `${pendentes.join(', ')}. Cadastre em Fornecedor / parceiro antes de enviar.`,
        action: onCadastrarFornecedor
          ? {
              label: 'Cadastrar fornecedor',
              onClick: () =>
                onCadastrarFornecedor({
                  nome: destinatarios.find((x) => x.daEquipe !== true)?.nome,
                  email: destinatarios.find((x) => x.daEquipe !== true)?.email,
                }),
            }
          : undefined,
      })
      setDestinatarios((prev) =>
        prev.map((d) => {
          if (d.daEquipe === true) return d
          const hit = membroNaEquipe(equipe, d.nome, d.email)
          return hit
            ? { ...d, nome: hit.nome, email: hit.email, daEquipe: true }
            : { ...d, daEquipe: false }
        })
      )
      return
    }

    startTransition(async () => {
      try {
        const documentos = await Promise.all(
          arquivos.map(async (f) => ({
            base64: await toBase64(f),
            nome: f.name,
          }))
        )

        const payload: SolicitacaoAssinaturaPayload = {
          documentos,
          nomeDocumento: nomeDocumento.trim() || undefined,
          mensagem: mensagem.trim() || undefined,
          destinatariosLista: lista,
          exigirCertificadoDigital: flags.exigirCertificadoDigital,
          tipoCertificado: 1,
          adicionarObservadores: flags.adicionarObservadores,
          observadores: flags.adicionarObservadores ? observadores.trim() || undefined : undefined,
          monitorarValidade: flags.monitorarValidade,
          validadeMeses: flags.monitorarValidade ? Number(validadeMeses) || 12 : undefined,
          autodestruir: flags.autodestruir,
          dataExpiracao: flags.autodestruir ? dataExpiracao || undefined : undefined,
          autenticacaoDoisFatores: flags.autenticacaoDoisFatores,
          solicitarCpf: flags.solicitarCpf,
          solicitarDataNascimento: flags.solicitarDataNascimento,
          solicitarSelfieDocumento: flags.solicitarSelfieDocumento,
          emCadeia: definirOrdem,
          modoAssinatura: 'all',
        }

        const res = await criarSolicitacaoAssinatura(payload)
        setResultado(res)
        toast.success(res.message || 'Solicitação enviada.')
        if (res.erros?.length) {
          toast.message('Alguns documentos falharam', {
            description: res.erros.join(' | '),
          })
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao enviar solicitação.')
      }
    })
  }

  async function handleVisualizarAssinado(documentKey: string, nome: string) {
    setBaixandoKey(documentKey)
    try {
      const res = await baixarDocumentoAssinadoSolicitacao(documentKey, nome)
      setAssinadoTitulo(res.nome || nome || 'Documento assinado')
      setAssinadoB64(res.base64)
      setAssinadoOpen(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir PDF assinado.')
    } finally {
      setBaixandoKey(null)
    }
  }

  async function handleBaixarAssinado(documentKey: string, nome: string) {
    setBaixandoKey(documentKey)
    try {
      const res = await baixarDocumentoAssinadoSolicitacao(documentKey, nome)
      toast.success(res.message || 'PDF salvo no PaperSign.')
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${res.base64}`
      link.download = res.nome || `${nome || 'assinado'}.pdf`
      link.click()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao baixar PDF assinado.')
    } finally {
      setBaixandoKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold">Solicitação de assinatura</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              A PlugSign envia o e-mail; o destinatário assina na PlugSign. Andamento e PDF assinado
              voltam automaticamente ao PaperSign (Minhas solicitações).
            </p>
          </div>
          <Button type="button" onClick={handleEnviar} disabled={isPending} className="shrink-0">
            {isPending ? 'Enviando…' : 'Enviar solicitação'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Documento — grade compacta */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Documento</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`${formId}-nomeDoc`} className="text-xs">
                  Nome do documento (opcional)
                </Label>
                <Input
                  id={`${formId}-nomeDoc`}
                  value={nomeDocumento}
                  onChange={(e) => setNomeDocumento(e.target.value)}
                  placeholder="Ex.: Contrato de prestação de serviços"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-pdf`} className="text-xs">
                  PDFs — após subir, use Ver / Posicionar assinatura e rúbrica
                </Label>
                <Input
                  id={`${formId}-pdf`}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  disabled={isPending}
                  onChange={(e) => {
                    adicionarArquivos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
            {arquivos.length > 0 && (
              <ul className="space-y-1.5">
                {arquivos.map((f, i) => (
                  <li
                    key={`${f.name}-${f.size}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                  >
                    <FileUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={isPending}
                      onClick={() => visualizarPdf(i)}
                      title="Visualizar PDF"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={isPending || destinatarios.length === 0}
                      onClick={() => abrirPosicionar(destinatarios[0].id, 'signature', i)}
                      title="Posicionar assinatura/rúbrica neste PDF"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Posicionar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      disabled={isPending}
                      onClick={() => removerArquivo(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {arquivos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                As marcas no PDF ficam visíveis para o destinatário ao abrir o link: ele vê onde
                assinar/rubricar e, depois de assinar, a marca some e entra a assinatura real.
                Use <strong>Campos / posição no PDF</strong> no card ou Posicionar.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor={`${formId}-msg`} className="text-xs">
                Mensagem geral
              </Label>
              <Textarea
                id={`${formId}-msg`}
                rows={2}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={isPending}
                placeholder="Ex: Segue o contrato para assinatura."
              />
            </div>
          </div>

          {/* Destinatários */}
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Destinatários</p>
                <p className="text-xs text-muted-foreground">
                  Cadeia 1→2→3… Digite o nome para buscar na equipe PlugSign. Se não achar, cadastre em
                  Fornecedor / parceiro.
                  {equipeLoading
                    ? ' Carregando equipe…'
                    : !equipeErro
                      ? ` ${equipe.length} na equipe.`
                      : null}
                </p>
                {equipeErro && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 break-words">
                    {equipeErro}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={definirOrdem}
                    onCheckedChange={(v) => setDefinirOrdem(v === true)}
                    disabled={isPending}
                  />
                  Ordem de assinatura
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    onCadastrarFornecedor?.({
                      nome: destinatarios[0]?.nome,
                      email: destinatarios[0]?.email,
                    })
                  }
                  title="Abrir cadastro de fornecedor/parceiro na PlugSign"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Criar fornecedor
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setDestinatarios((prev) => [...prev, novoDestinatario()])}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {destinatarios.map((d, index) => {
                const modoLabel =
                  MODOS.find((m) => m.value === d.modoAssinatura)?.label ?? 'Assinatura necessária'
                const sugestoesNome = filtrarEquipe(equipe, d.nome)
                const termoNome = d.nome.trim()
                const mostrarCadastroFornecedor = termoNome.length >= 2 && !equipeLoading
                const irParaFornecedor = () => {
                  atualizarDest(d.id, { daEquipe: false })
                  setOpenNomeId(null)
                  onCadastrarFornecedor?.({ nome: d.nome, email: d.email })
                  toast.message('Cadastre o fornecedor/parceiro', {
                    description:
                      'Depois volte em Solicitação de assinatura e selecione o nome na equipe.',
                  })
                }
                return (
                  <div
                    key={d.id}
                    className={`rounded-md border border-l-4 bg-card px-3 py-2 ${CARD_COLORS[index % CARD_COLORS.length]}`}
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      {definirOrdem && (
                        <div className="flex items-center gap-0.5 pb-0.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex flex-col">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-6"
                              disabled={isPending || index === 0}
                              onClick={() => moverDest(d.id, -1)}
                              title="Subir"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-6"
                              disabled={isPending || index === destinatarios.length - 1}
                              onClick={() => moverDest(d.id, 1)}
                              title="Descer"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-w-[160px] space-y-0.5">
                        <Label className="text-xs">
                          Nome <span className="text-destructive">*</span>
                        </Label>
                        <Popover
                          open={openNomeId === d.id}
                          onOpenChange={(open) => setOpenNomeId(open ? d.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <div className="relative">
                              <Input
                                value={d.nome}
                                onChange={(e) => {
                                  const nome = e.target.value
                                  atualizarDest(d.id, { nome, daEquipe: null })
                                  setOpenNomeId(d.id)
                                }}
                                onFocus={() => setOpenNomeId(d.id)}
                                onBlur={() => {
                                  window.setTimeout(() => {
                                    setOpenNomeId((cur) => (cur === d.id ? null : cur))
                                    void validarDestPorId(d.id)
                                  }, 180)
                                }}
                                placeholder="Buscar na equipe PlugSign…"
                                disabled={isPending}
                                className="h-8 pr-8"
                              />
                              {d.daEquipe === true && (
                                <CheckCircle2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500" />
                              )}
                              {d.daEquipe === false && (
                                <AlertTriangle className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-500" />
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverPortal>
                            <PopoverContent
                              className="w-[min(100vw-2rem,360px)] p-0"
                              align="start"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <Command shouldFilter={false}>
                                <CommandList>
                                  <CommandEmpty>
                                    {equipeLoading
                                      ? 'Carregando equipe PlugSign…'
                                      : equipeErro
                                        ? 'Não foi possível carregar a equipe. Veja o aviso acima.'
                                        : termoNome.length < 2
                                          ? 'Digite ao menos 2 letras para buscar.'
                                          : 'Nenhum na equipe. Cadastre em Fornecedor / parceiro.'}
                                  </CommandEmpty>
                                  <CommandGroup heading="Equipe PlugSign">
                                    {sugestoesNome.map((m) => (
                                      <CommandItem
                                        key={`${m.id}-${m.email}`}
                                        value={`${m.nome} ${m.email}`}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onSelect={() => selecionarDaEquipe(d.id, m)}
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium">{m.nome}</p>
                                          <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                              {mostrarCadastroFornecedor && (
                                <div className="border-t p-2 space-y-1">
                                  {sugestoesNome.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground px-0.5">
                                      Nenhum na equipe. Cadastre como fornecedor/parceiro.
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-muted-foreground px-0.5">
                                      Não é quem procura? Cadastre um novo fornecedor/parceiro.
                                    </p>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="w-full h-8 text-xs"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={irParaFornecedor}
                                  >
                                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                    Criar fornecedor / parceiro
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </PopoverPortal>
                        </Popover>
                      </div>
                      <div className="flex-1 min-w-[160px] space-y-0.5">
                        <Label className="text-xs">
                          E-mail <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="email"
                          value={d.email}
                          onChange={(e) => {
                            const email = e.target.value
                            atualizarDest(d.id, { email, daEquipe: null })
                          }}
                          onBlur={() => {
                            void validarDestPorId(d.id)
                          }}
                          placeholder="email@empresa.com"
                          disabled={isPending}
                          className="h-8"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-8" disabled={isPending}>
                              Personalizar
                              <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-72">
                            <DropdownMenuLabel>Personalizar</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                atualizarDest(d.id, { expandModo: !d.expandModo, expandMensagem: false })
                              }}
                            >
                              <PenLine className="h-4 w-4 mr-2" />
                              Tipo de assinatura
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                atualizarDest(d.id, { expandMensagem: !d.expandMensagem, expandModo: false })
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Mensagem privada
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                atualizarDest(d.id, { expandCampos: !d.expandCampos })
                              }}
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              Campos / posição no PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={isPending || destinatarios.length <= 1}
                          onClick={() => removerDest(d.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <PenLine className="h-3 w-3" />
                      {definirOrdem ? `Ordem ${index + 1}` : 'Sem ordem'} · {modoLabel} ·{' '}
                      {resumoCampos(d)}
                    </p>

                    {d.daEquipe === true && (
                      <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Encontrado na equipe PlugSign
                      </p>
                    )}
                    {d.daEquipe === false && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">
                          Não está na equipe PlugSign. Cadastre em Fornecedor / parceiro e selecione de novo.
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={irParaFornecedor}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Criar fornecedor
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={async () => {
                            try {
                              const list = await listarEquipePlugSign()
                              setEquipe(list)
                              const hit = membroNaEquipe(list, d.nome, d.email)
                              if (hit) {
                                selecionarDaEquipe(d.id, hit)
                                toast.success('Encontrado na equipe após atualizar.')
                              } else {
                                toast.message('Ainda não aparece na equipe.', {
                                  description: 'Confira se o cadastro na PlugSign concluiu e tente de novo.',
                                })
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Falha ao atualizar equipe.')
                            }
                          }}
                        >
                          Já cadastrei
                        </Button>
                      </div>
                    )}

                    {d.expandModo && (
                      <div className="mt-2 max-w-sm">
                        <Select
                          value={d.modoAssinatura || 'all'}
                          onValueChange={(v) => atualizarDest(d.id, { modoAssinatura: v })}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Tipo de assinatura" />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            {MODOS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {d.expandMensagem && (
                      <Textarea
                        className="mt-2"
                        rows={2}
                        value={d.mensagemPrivada || ''}
                        onChange={(e) => atualizarDest(d.id, { mensagemPrivada: e.target.value })}
                        disabled={isPending}
                        placeholder="Mensagem privada"
                      />
                    )}

                    {d.expandCampos && (
                      <div className="mt-2 rounded-md border bg-muted/20 p-2 space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                          Marcas temporárias no PDF: o destinatário vê ao abrir o documento e assina
                          nesses pontos. Pode colocar várias assinaturas e rúbricas.
                        </p>
                        {d.camposUi.length === 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Nenhum campo ainda. Clique em Assinatura ou Rúbrica para marcar no PDF.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {d.camposUi.map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs"
                              >
                                <span className="flex-1 truncate">{labelCampo(c)}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  disabled={isPending}
                                  onClick={() => removerCampo(d.id, c.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            disabled={isPending || arquivos.length === 0}
                            onClick={() => abrirPosicionar(d.id, 'signature')}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Assinatura no PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            disabled={isPending || arquivos.length === 0}
                            onClick={() => abrirPosicionar(d.id, 'rubric')}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Rúbrica no PDF
                          </Button>
                          <Select onValueChange={(v) => abrirPosicionar(d.id, v)} disabled={isPending || arquivos.length === 0}>
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue placeholder="Outro campo…" />
                            </SelectTrigger>
                            <SelectContent className="z-[200]">
                              {TIPOS_CAMPO.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select onValueChange={(v) => adicionarCampoExtra(d.id, v)} disabled={isPending}>
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue placeholder="Página extra…" />
                            </SelectTrigger>
                            <SelectContent className="z-[200]">
                              {TIPOS_CAMPO.map((t) => (
                                <SelectItem key={`extra-${t.value}`} value={t.value}>
                                  {t.label} (extra)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Opções */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Opções</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TOGGLES.map((t) => (
                <label key={t.key} className="flex items-start gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={flags[t.key]}
                    onCheckedChange={(v) => setFlag(t.key, v === true)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <span className="leading-snug text-xs sm:text-sm">{t.label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {flags.adicionarObservadores && (
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs">Observadores</Label>
                  <Input
                    value={observadores}
                    onChange={(e) => setObservadores(e.target.value)}
                    disabled={isPending}
                    placeholder="obs1@empresa.com,obs2@empresa.com"
                    className="h-8"
                  />
                </div>
              )}
              {flags.monitorarValidade && (
                <div className="space-y-1">
                  <Label className="text-xs">Validade (meses)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={validadeMeses}
                    onChange={(e) => setValidadeMeses(e.target.value)}
                    disabled={isPending}
                    className="h-8 w-[100px]"
                  />
                </div>
              )}
              {flags.autodestruir && (
                <div className="space-y-1">
                  <Label className="text-xs">Expiração</Label>
                  <Input
                    type="date"
                    value={dataExpiracao}
                    onChange={(e) => setDataExpiracao(e.target.value)}
                    disabled={isPending}
                    className="h-8 w-[160px]"
                  />
                </div>
              )}
              <Button type="button" onClick={handleEnviar} disabled={isPending} className="ml-auto">
                {isPending ? 'Enviando…' : 'Enviar solicitação'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pt-0">
            <p>{resultado.message}</p>
            {(resultado.documentos?.length
              ? resultado.documentos
              : [
                  {
                    nome: 'Documento',
                    documentKey: resultado.documentKey,
                    destinatarios: resultado.destinatarios ?? [],
                  },
                ]
            ).map((doc, di) => (
              <div key={`${doc.documentKey}-${di}`} className="rounded-md border p-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="font-medium">{doc.nome}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={baixandoKey === doc.documentKey}
                      onClick={() => handleVisualizarAssinado(doc.documentKey, doc.nome)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      {baixandoKey === doc.documentKey ? 'Abrindo…' : 'Visualizar'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      disabled={baixandoKey === doc.documentKey}
                      onClick={() => handleBaixarAssinado(doc.documentKey, doc.nome)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Baixar
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  document_key: {doc.documentKey}
                </p>
                {(doc.destinatarios ?? []).map((dest, i) => (
                  <div key={`${dest.email}-${i}`} className="rounded border px-2 py-1.5 text-xs space-y-0.5">
                    <p>{dest.email || `Destinatário ${i + 1}`}</p>
                    {dest.signingUrl ? (
                      <a
                        href={dest.signingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline break-all"
                      >
                        {dest.signingUrl}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Link enviado pela PlugSign.</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {resultado.erros?.length ? (
              <p className="text-destructive text-xs">{resultado.erros.join(' | ')}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <PdfViewerDialog
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        title={`Posicionar ${placeTipo.label}${placeDest?.nome ? ` — ${placeDest.nome}` : ''}`}
        pdfBase64={pdfPreviewB64}
        canSign
        placeMode
        confirmLabel="Confirmar posição"
        placeHint="Clique no PDF para marcar. Pode adicionar várias assinaturas e rúbricas."
        placeFieldLabel={
          placeTipo.apiType === 'rubric'
            ? 'Rubrica'
            : placeTipo.apiType === 'signature'
              ? 'Assinatura'
              : placeTipo.label
        }
        placeOwnerLabel={placeOwnerLabel}
        initialBoxW={placeTipo.w}
        initialBoxH={placeTipo.h}
        markers={placeMarkers}
        onSign={confirmarPosicao}
        extraControls={
          <div className="flex flex-wrap items-center gap-1.5">
            {destinatarios.length > 1 && (
              <Select
                value={placeDestId ?? undefined}
                onValueChange={(v) => setPlaceDestId(v)}
              >
                <SelectTrigger className="h-7 w-[160px] text-[10px]">
                  <SelectValue placeholder="Destinatário" />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  {destinatarios.map((d, i) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome?.trim() || d.email?.trim() || `Destinatário ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              size="sm"
              variant={placeTipo.value === 'signature' ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() => setPlaceTipo(TIPOS_CAMPO[0])}
            >
              Assinatura
            </Button>
            <Button
              type="button"
              size="sm"
              variant={placeTipo.value === 'rubric' ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() => setPlaceTipo(TIPOS_CAMPO[1])}
            >
              Rúbrica
            </Button>
          </div>
        }
      />

      <PdfViewerDialog
        open={viewOnlyOpen}
        onOpenChange={(open) => {
          setViewOnlyOpen(open)
          if (!open && !placeOpen) setPdfPreviewB64(null)
        }}
        title={pdfParaPosicionar?.name || 'Documento'}
        pdfBase64={pdfPreviewB64}
        canSign={false}
        markers={allPdfMarkers}
        placeHint={
          allPdfMarkers.length
            ? `${allPdfMarkers.length} marca(s) posicionada(s) neste envio`
            : undefined
        }
      />

      <PdfViewerDialog
        open={assinadoOpen}
        onOpenChange={(open) => {
          setAssinadoOpen(open)
          if (!open) setAssinadoB64(null)
        }}
        title={assinadoTitulo}
        pdfBase64={assinadoB64}
        canSign={false}
      />
    </div>
  )
}
