'use client'

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { History, Loader2, RefreshCw, Eye, Download, Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PdfViewerDialog from '@/components/PdfViewerDialog'
import {
  baixarDocumentoAssinadoSolicitacao,
  HistoricoSolicitacaoItem,
  listarMinhasSolicitacoes,
  MinhaSolicitacaoItem,
  obterHistoricoSolicitacao,
  enviarLembreteSolicitacao,
} from '@/services/docusignService'

function statusLabel(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return 'Pendente'
  if (s === 'signed') return 'Assinado'
  if (s === 'declined') return 'Recusado'
  if (s === 'cancelled') return 'Cancelado'
  return status || '—'
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase()
  if (s === 'signed') return 'default'
  if (s === 'pending') return 'secondary'
  if (s === 'declined' || s === 'cancelled') return 'destructive'
  return 'outline'
}

function shortKey(key: string) {
  if (!key) return '—'
  if (key.length <= 16) return key
  return `${key.slice(0, 8)}…${key.slice(-6)}`
}

/** Nome legível; ignora se veio só a document_key. */
function nomeExibicao(nome: string | null | undefined, documentKey: string) {
  const n = (nome || '').trim()
  const key = (documentKey || '').trim()
  if (!n) return null
  if (key && (n === key || n.toLowerCase() === `${key.toLowerCase()}.pdf`)) return null
  if (
    n.length >= 20 &&
    !/[_\-\.\s]/.test(n) &&
    /^[a-zA-Z0-9]+$/.test(n)
  ) {
    return null
  }
  return n
}

/** Destaca e-mails e textos entre colchetes (IP) no activity da PlugSign. */
function ActivityText({ text }: { text: string }) {
  const parts = text.split(/(\S+@\S+\.\S+|\[[^\]]+\])/g)
  return (
    <span>
      {parts.map((p, i) => {
        if (/^\S+@\S+\.\S+$/.test(p)) {
          return (
            <a
              key={i}
              href={`mailto:${p}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {p}
            </a>
          )
        }
        if (/^\[[^\]]+\]$/.test(p)) {
          return (
            <span key={i} className="text-muted-foreground">
              {p}
            </span>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}

export default function MinhasSolicitacoesPanel() {
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<string>('all')
  const [items, setItems] = useState<MinhaSolicitacaoItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [histOpen, setHistOpen] = useState(false)
  const [histLoading, setHistLoading] = useState(false)
  const [histKey, setHistKey] = useState('')
  const [histNome, setHistNome] = useState('')
  const [histEmail, setHistEmail] = useState('')
  const [historico, setHistorico] = useState<HistoricoSolicitacaoItem[]>([])

  const [baixandoKey, setBaixandoKey] = useState<string | null>(null)
  const [acaoPdf, setAcaoPdf] = useState<'ver' | 'baixar' | null>(null)
  const [lembreteKey, setLembreteKey] = useState<string | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfTitle, setPdfTitle] = useState('Documento assinado')

  const carregar = useCallback((p = page, st = status) => {
    startTransition(async () => {
      try {
        const res = await listarMinhasSolicitacoes(p, st === 'all' ? undefined : st)
        setItems(res.data ?? [])
        setPage(res.page ?? p)
        setLastPage(res.lastPage ?? 1)
        setTotal(res.total ?? 0)
      } catch (e) {
        const raw = e instanceof Error ? e.message : 'Falha ao listar solicitações.'
        toast.error(
          /Token not found/i.test(raw)
            ? 'Token PlugSign inválido. Confira PlugSign:Token no appsettings e reinicie a API.'
            : /1015|429|rate.?limit|limitou/i.test(raw)
              ? 'A PlugSign limitou as consultas (1015). Aguarde 15–30 min e clique em Atualizar.'
              : raw
        )
      }
    })
  }, [page, status])

  useEffect(() => {
    carregar(1, status)
  }, [status])

  const documentosAgrupados = useMemo(() => {
    const map = new Map<
      string,
      {
        documentKey: string
        sendTime?: string | null
        status: string
        emails: string[]
        senderName?: string | null
        nomeDocumento?: string | null
        pdfNoPaperSign?: boolean
      }
    >()
    for (const it of items) {
      const key = it.documentKey || String(it.id)
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          documentKey: it.documentKey,
          sendTime: it.sendTime,
          status: it.status,
          emails: it.email ? [it.email] : [],
          senderName: it.senderName,
          nomeDocumento: it.nomeDocumento,
          pdfNoPaperSign: it.pdfNoPaperSign === true,
        })
      } else {
        if (it.email && !cur.emails.includes(it.email)) cur.emails.push(it.email)
        if (it.nomeDocumento && !cur.nomeDocumento) cur.nomeDocumento = it.nomeDocumento
        if (it.pdfNoPaperSign) cur.pdfNoPaperSign = true
        if ((it.status || '').toLowerCase() === 'signed') cur.status = it.status
        else if ((cur.status || '').toLowerCase() === 'pending' && it.status) cur.status = it.status
      }
    }
    return Array.from(map.values())
  }, [items])

  async function abrirHistorico(doc: {
    documentKey: string
    emails: string[]
    nomeDocumento?: string | null
  }) {
    if (!doc.documentKey) {
      toast.error('Documento sem document_key.')
      return
    }
    setHistKey(doc.documentKey)
    setHistNome(nomeExibicao(doc.nomeDocumento, doc.documentKey) || '')
    setHistEmail(doc.emails.join(', '))
    setHistOpen(true)
    setHistLoading(true)
    setHistorico([])
    try {
      const res = await obterHistoricoSolicitacao(doc.documentKey)
      setHistorico(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar histórico.')
    } finally {
      setHistLoading(false)
    }
  }

  async function enviarLembrete(doc: {
    documentKey: string
    status: string
    nomeDocumento?: string | null
  }) {
    if (!doc.documentKey) return
    if ((doc.status || '').toLowerCase() !== 'pending') {
      toast.error('Lembrete só para solicitações pendentes.')
      return
    }
    setLembreteKey(doc.documentKey)
    try {
      const titulo = nomeExibicao(doc.nomeDocumento, doc.documentKey)
      const res = await enviarLembreteSolicitacao(doc.documentKey, {
        assunto: titulo
          ? `Lembrete de assinatura: ${titulo}`
          : 'Lembrete de assinatura pendente',
        mensagem:
          'Lembrete: há uma solicitação de assinatura pendente. Acesse o link do e-mail original na PlugSign para assinar o documento.',
      })
      toast.success(res.message || 'Lembrete enviado.')
      if (res.erros && res.erros.length > 0) {
        toast.warning(res.erros.slice(0, 2).join(' | '))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar lembrete.')
    } finally {
      setLembreteKey(null)
    }
  }

  async function obterPdfAssinado(doc: { documentKey: string; nomeDocumento?: string | null }) {
    return baixarDocumentoAssinadoSolicitacao(
      doc.documentKey,
      doc.nomeDocumento || 'documento-assinado.pdf'
    )
  }

  async function visualizarPdf(doc: { documentKey: string; nomeDocumento?: string | null }) {
    if (!doc.documentKey) return
    setBaixandoKey(doc.documentKey)
    setAcaoPdf('ver')
    try {
      const res = await obterPdfAssinado(doc)
      setPdfTitle(res.nome || doc.nomeDocumento || 'Documento assinado')
      setPdfBase64(res.base64)
      setPdfOpen(true)
      carregar(page, status)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir o PDF assinado.')
    } finally {
      setBaixandoKey(null)
      setAcaoPdf(null)
    }
  }

  async function baixarPdf(doc: { documentKey: string; nomeDocumento?: string | null }) {
    if (!doc.documentKey) return
    setBaixandoKey(doc.documentKey)
    setAcaoPdf('baixar')
    try {
      const res = await obterPdfAssinado(doc)
      toast.success(res.message || 'PDF salvo no PaperSign.')
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${res.base64}`
      link.download = res.nome || 'assinado.pdf'
      link.click()
      carregar(page, status)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao baixar PDF assinado.')
    } finally {
      setBaixandoKey(null)
      setAcaoPdf(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4">
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold">Minhas solicitações</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              E-mail e assinatura na PlugSign. O andamento e o PDF assinado voltam ao PaperSign.
              Admin vê todas; demais só as suas.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pending">Pendente</SelectItem>
                  <SelectItem value="Signed">Assinado</SelectItem>
                  <SelectItem value="Declined">Recusado</SelectItem>
                  <SelectItem value="Cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={isPending}
              onClick={() => carregar(page, status)}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5">Atualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="rounded-md border overflow-x-auto">
            <div className="min-w-[820px]">
            <div className="grid grid-cols-[minmax(150px,1.3fr)_100px_minmax(110px,1fr)_80px_72px_72px_140px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Documento</span>
              <span>Envio</span>
              <span>Destinatários</span>
              <span>Status</span>
              <span>Histórico</span>
              <span>Lembrete</span>
              <span>PDF</span>
            </div>
            {isPending && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : documentosAgrupados.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma solicitação encontrada.
              </p>
            ) : (
              <ul>
                {documentosAgrupados.map((doc) => {
                  const podePdf =
                    (doc.status || '').toLowerCase() === 'signed' || doc.pdfNoPaperSign === true
                  const pendente = (doc.status || '').toLowerCase() === 'pending'
                  const busy = baixandoKey === doc.documentKey
                  const lembreteBusy = lembreteKey === doc.documentKey
                  const titulo = nomeExibicao(doc.nomeDocumento, doc.documentKey)
                  return (
                    <li
                      key={doc.documentKey}
                      className="grid grid-cols-[minmax(150px,1.3fr)_100px_minmax(110px,1fr)_80px_72px_72px_140px] gap-2 border-b px-3 py-2.5 text-sm items-center"
                    >
                      <button
                        type="button"
                        className="min-w-0 text-left hover:underline"
                        onClick={() => abrirHistorico(doc)}
                        title={titulo || doc.documentKey || 'Ver histórico / andamento'}
                      >
                        <span className="block truncate text-sm font-medium">
                          {titulo || shortKey(doc.documentKey)}
                        </span>
                        {titulo ? (
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">
                            {shortKey(doc.documentKey)}
                          </span>
                        ) : null}
                      </button>
                      <span className="text-xs text-muted-foreground truncate">
                        {doc.sendTime || '—'}
                      </span>
                      <span className="truncate text-xs" title={doc.emails.join(', ')}>
                        {doc.emails.join(', ') || '—'}
                      </span>
                      <span>
                        <Badge variant={statusVariant(doc.status)} className="text-[10px]">
                          {statusLabel(doc.status)}
                        </Badge>
                      </span>
                      <span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => abrirHistorico(doc)}
                          title="Ver histórico / andamento"
                        >
                          <History className="h-3 w-3" />
                          <span className="ml-1">Ver</span>
                        </Button>
                      </span>
                      <span>
                        {pendente ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            disabled={lembreteBusy}
                            onClick={() => enviarLembrete(doc)}
                            title="Enviar lembrete por e-mail aos pendentes"
                          >
                            {lembreteBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Bell className="h-3 w-3" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        {podePdf ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={busy}
                              onClick={() => visualizarPdf(doc)}
                              title="Visualizar PDF assinado"
                            >
                              {busy && acaoPdf === 'ver' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                              <span className="ml-1">Ver</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2 text-[10px]"
                              disabled={busy}
                              onClick={() => baixarPdf(doc)}
                              title="Baixar PDF assinado"
                            >
                              {busy && acaoPdf === 'baixar' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              <span className="ml-1">Baixar</span>
                            </Button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || page <= 1}
              onClick={() => {
                const p = page - 1
                setPage(p)
                carregar(p, status)
              }}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {lastPage || 1} · {total} solicitação(ões)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || page >= lastPage}
              onClick={() => {
                const p = page + 1
                setPage(p)
                carregar(p, status)
              }}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico</DialogTitle>
            <DialogDescription className="space-y-0.5">
              {histNome ? (
                <span className="block text-sm font-medium text-foreground">{histNome}</span>
              ) : null}
              <span className="block font-mono text-[11px] break-all">{histKey}</span>
              {histEmail ? <span className="block text-xs">{histEmail}</span> : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 pt-2">
            {histLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando histórico…
              </div>
            ) : historico.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum evento no histórico.
              </p>
            ) : (
              <ol className="relative ml-3 border-l border-muted-foreground/30 space-y-5 pb-4">
                {historico.map((h, i) => (
                  <li key={`${h.id}-${h.time}-${i}`} className="relative pl-5">
                    <span
                      className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${
                        i === 0 || i === historico.length - 1
                          ? 'bg-blue-600 ring-2 ring-blue-600/30'
                          : 'bg-muted-foreground/50'
                      }`}
                    />
                    <p className="text-[11px] italic text-muted-foreground">{h.time || '—'}</p>
                    <p className="text-sm leading-snug mt-0.5">
                      <ActivityText text={h.activity || '—'} />
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PdfViewerDialog
        open={pdfOpen}
        onOpenChange={(open) => {
          setPdfOpen(open)
          if (!open) setPdfBase64(null)
        }}
        title={pdfTitle}
        pdfBase64={pdfBase64}
        canSign={false}
        isLoading={baixandoKey != null && pdfOpen}
      />
    </div>
  )
}
