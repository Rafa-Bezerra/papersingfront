'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Ban, Bell, Download, FolderOpen, Loader2, Plus, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  acaoLoteWaySign,
  baixarZipLoteWaySign,
  detalheLoteWaySign,
  listarLotesWaySign,
  LoteDetalhe,
  LoteResumo,
} from '@/services/docusignService'

function statusLabel(s?: string | null) {
  const v = (s || '').toLowerCase()
  if (v === 'pending') return 'Pendente'
  if (v === 'signed') return 'Assinado'
  if (v === 'declined') return 'Recusado'
  if (v === 'cancelled' || v === 'canceled') return 'Cancelado'
  return s || '—'
}

/** WaySign · Lotes (conta PlugSign inteira; só Admin até existir o espelho por unidade). */
export default function WaySignLotesPanel({ onNovoLote }: { onNovoLote?: () => void }) {
  const [carregando, setCarregando] = useState(false)
  const [lotes, setLotes] = useState<LoteResumo[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [aberto, setAberto] = useState<LoteDetalhe | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function carregar(p = page) {
    setCarregando(true)
    try {
      const r = await listarLotesWaySign(p)
      setLotes(r.data ?? [])
      setPage(r.page ?? p)
      setLastPage(r.lastPage ?? 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar lotes.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar(1)
  }, []) // carga inicial

  async function abrir(id?: number | null) {
    if (id == null) return
    setOcupado(`abrir:${id}`)
    try {
      setAberto(await detalheLoteWaySign(id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir o lote.')
    } finally {
      setOcupado(null)
    }
  }

  async function baixar(id?: number | null, nome?: string | null) {
    if (id == null) return
    setOcupado(`zip:${id}`)
    try {
      const blob = await baixarZipLoteWaySign(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(nome || `lote-${id}`).replace(/[\\/:*?"<>|]+/g, '_')}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao baixar o lote.')
    } finally {
      setOcupado(null)
    }
  }

  async function agir(acao: 'lembrete' | 'cancelar', signingKey?: string | null, email?: string | null) {
    if (!aberto?.id || !signingKey) return
    if (acao === 'cancelar' && !window.confirm(`Cancelar a assinatura de ${email}? Não pode ser desfeito.`)) return
    setOcupado(`${acao}:${signingKey}`)
    try {
      const r = await acaoLoteWaySign(aberto.id, acao, signingKey)
      toast.success(r.message)
      setAberto(await detalheLoteWaySign(aberto.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao executar.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Lotes</CardTitle>
        <div className="flex gap-2">
          {onNovoLote && (
            <Button size="sm" onClick={onNovoLote}>
              <Plus className="h-4 w-4" /> Novo lote
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void carregar(page)} disabled={carregando}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Lote = vários PDFs (2 a 50) para as mesmas pessoas assinarem de uma vez, com um e-mail só.
          Em &quot;Novo lote&quot;, escolha 2 ou mais PDFs. Os lotes vêm da conta PlugSign inteira (todas as unidades),
          por isso só Admin vê esta aba por enquanto.
        </p>
        {carregando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : lotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lote.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {lotes.map((l) => (
              <li key={l.id ?? l.nome} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.nome || `Lote ${l.id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.criadoEm || ''} · {l.arquivos} arquivo(s) · {l.solicitacoes} assinatura(s)
                    {l.pendentes > 0 ? ` · ${l.pendentes} pendente(s)` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrir(l.id)} disabled={ocupado != null}>
                    {ocupado === `abrir:${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} Abrir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => baixar(l.id, l.nome)} disabled={ocupado != null}>
                    {ocupado === `zip:${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} ZIP
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between text-xs">
          <Button size="sm" variant="outline" disabled={carregando || page <= 1} onClick={() => void carregar(page - 1)}>Anterior</Button>
          <span>Página {page} de {lastPage}</span>
          <Button size="sm" variant="outline" disabled={carregando || page >= lastPage} onClick={() => void carregar(page + 1)}>Próxima</Button>
        </div>
      </CardContent>

      <Dialog open={aberto != null} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aberto?.nome || `Lote ${aberto?.id}`}</DialogTitle>
            <DialogDescription>{aberto?.criadoEm}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <section>
              <h3 className="mb-1 text-sm font-semibold">Arquivos</h3>
              <ul className="divide-y rounded-md border text-sm">
                {(aberto?.arquivos ?? []).map((a, i) => (
                  <li key={`${a.documentKey}-${i}`} className="flex justify-between gap-2 p-2">
                    <span className="truncate">{a.nome || a.documentKey}</span>
                    <span className="text-xs text-muted-foreground">{a.status}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1 text-sm font-semibold">Assinaturas</h3>
              <ul className="divide-y rounded-md border">
                {(aberto?.solicitacoes ?? []).map((s, i) => {
                  const pendente = (s.status || '').toLowerCase() === 'pending'
                  return (
                    <li key={`${s.signingKey}-${i}`} className="flex flex-wrap items-center justify-between gap-2 p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{s.email}</p>
                        <p className="text-xs text-muted-foreground">{s.enviadaEm}{s.atualizadaEm ? ` · ${s.atualizadaEm}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pendente ? 'secondary' : 'outline'}>{statusLabel(s.status)}</Badge>
                        {pendente && (
                          <>
                            <Button size="sm" variant="outline" disabled={ocupado != null} onClick={() => agir('lembrete', s.signingKey, s.email)}>
                              <Bell className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={ocupado != null} onClick={() => agir('cancelar', s.signingKey, s.email)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
