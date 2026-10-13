'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Ban, Bell, Copy, Loader2, Mail, MessageCircle, ShieldCheck, UserRoundPen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActivityText } from '@/components/MinhasSolicitacoesPanel'
import {
  acaoSolicitacaoPlugSign,
  AcaoSolicitacaoPlugSign,
  HistoricoSolicitacaoItem,
  listarMensagensSignatario,
  listarSignatariosPlugSign,
  MensagemSignatario,
  obterHistoricoSolicitacao,
  SignatarioPlugSign,
} from '@/services/docusignService'

function statusLabel(status?: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return 'Pendente'
  if (s === 'signed') return 'Assinado'
  if (s === 'declined') return 'Recusado'
  if (s === 'cancelled' || s === 'canceled') return 'Cancelado'
  return status || '—'
}

function statusVariant(status?: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase()
  if (s === 'signed') return 'default'
  if (s === 'pending') return 'secondary'
  if (s === 'declined' || s === 'cancelled' || s === 'canceled') return 'destructive'
  return 'outline'
}

type Pedido =
  | { tipo: 'whatsapp'; sig: SignatarioPlugSign }
  | { tipo: 'trocar'; sig: SignatarioPlugSign }
  | { tipo: 'cancelar'; sig: SignatarioPlugSign }

/**
 * Detalhes de um envio PlugSign: signatários (status, 2FA, validade), histórico e ações por signatário.
 * As ações só aparecem para quem enviou ou Admin da unidade; o servidor confere de novo.
 */
export default function WaySignDetalhesDialog({
  open,
  onOpenChange,
  documentKey,
  titulo,
  onAlterado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentKey: string
  titulo?: string | null
  onAlterado?: () => void
}) {
  const [carregando, setCarregando] = useState(false)
  const [gerenciar, setGerenciar] = useState(false)
  const [signatarios, setSignatarios] = useState<SignatarioPlugSign[]>([])
  const [historico, setHistorico] = useState<HistoricoSolicitacaoItem[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [campo, setCampo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mensagensDe, setMensagensDe] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<MensagemSignatario[]>([])
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)

  async function verMensagens(sig: SignatarioPlugSign) {
    if (!sig.signingKey) return
    if (mensagensDe === sig.signingKey) {
      setMensagensDe(null)
      return
    }
    setMensagensDe(sig.signingKey)
    setMensagens([])
    setCarregandoMensagens(true)
    try {
      setMensagens(await listarMensagensSignatario(documentKey, sig.signingKey))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar mensagens.')
    } finally {
      setCarregandoMensagens(false)
    }
  }

  async function carregar() {
    setCarregando(true)
    try {
      const [sigs, hist] = await Promise.all([
        listarSignatariosPlugSign(documentKey),
        obterHistoricoSolicitacao(documentKey).catch(() => ({ data: [] as HistoricoSolicitacaoItem[] })),
      ])
      setGerenciar(sigs.gerenciar)
      setSignatarios(sigs.data ?? [])
      setHistorico(hist.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar os detalhes.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (open && documentKey) void carregar()
    if (!open) {
      setPedido(null)
      setSignatarios([])
      setHistorico([])
    }
  }, [open, documentKey])

  async function executar(dados: AcaoSolicitacaoPlugSign) {
    setOcupado(`${dados.acao}:${dados.signingKey}`)
    try {
      const msg = await acaoSolicitacaoPlugSign(documentKey, dados)
      toast.success(msg)
      setPedido(null)
      setCampo('')
      setMensagem('')
      await carregar()
      onAlterado?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao executar a ação.')
    } finally {
      setOcupado(null)
    }
  }

  async function copiarLink(sig: SignatarioPlugSign) {
    if (!sig.link) return
    try {
      await navigator.clipboard.writeText(sig.link)
      toast.success('Link de assinatura copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  function abrirPedido(p: Pedido) {
    setPedido(p)
    setCampo('')
    setMensagem('')
  }

  const ocupadoCom = (acao: string, sig: SignatarioPlugSign) => ocupado === `${acao}:${sig.signingKey}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da solicitação</DialogTitle>
          <DialogDescription className="space-y-0.5">
            {titulo ? <span className="block text-sm font-medium text-foreground">{titulo}</span> : null}
            <span className="block font-mono text-[11px] break-all">{documentKey}</span>
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Signatários</h3>
              {signatarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum signatário encontrado na PlugSign.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {signatarios.map((sig, i) => {
                    const pendente = (sig.status || '').toLowerCase() === 'pending'
                    return (
                      <li key={`${sig.signingKey ?? sig.email}-${i}`} className="space-y-2 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {sig.email || '—'} {sig.eu ? <span className="text-xs text-muted-foreground">(você)</span> : null}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sig.enviadaEm ? `Enviada: ${sig.enviadaEm}` : ''}
                              {sig.atualizadaEm ? ` · Atualizada: ${sig.atualizadaEm}` : ''}
                              {sig.expiraEm ? ` · Vence: ${sig.expiraEm}` : ''}
                              {sig.doubleAuth ? ' · 2FA ligado' : ''}
                            </p>
                          </div>
                          <Badge variant={statusVariant(sig.status)}>{statusLabel(sig.status)}</Badge>
                        </div>

                        {(gerenciar || sig.eu) && sig.signingKey && (
                          <div className="flex flex-wrap gap-2">
                            {sig.link && (
                              <Button size="sm" variant="outline" onClick={() => copiarLink(sig)}>
                                <Copy className="h-4 w-4" /> Copiar link
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => verMensagens(sig)}>
                              <Mail className="h-4 w-4" /> Mensagens
                            </Button>
                            {gerenciar && pendente && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ocupado != null}
                                  onClick={() => executar({ acao: 'lembrete-email', signingKey: sig.signingKey! })}
                                >
                                  {ocupadoCom('lembrete-email', sig) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                                  Lembrete e-mail
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => abrirPedido({ tipo: 'whatsapp', sig })}>
                                  <MessageCircle className="h-4 w-4" /> Lembrete WhatsApp
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => abrirPedido({ tipo: 'trocar', sig })}>
                                  <UserRoundPen className="h-4 w-4" /> Trocar signatário
                                </Button>
                              </>
                            )}
                            {gerenciar && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ocupado != null}
                                onClick={() =>
                                  executar({ acao: '2fa', signingKey: sig.signingKey!, exigir2fa: !sig.doubleAuth })
                                }
                              >
                                {ocupadoCom('2fa', sig) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                {sig.doubleAuth ? 'Desligar 2FA' : 'Ligar 2FA'}
                              </Button>
                            )}
                            {gerenciar && pendente && (
                              <Button size="sm" variant="destructive" onClick={() => abrirPedido({ tipo: 'cancelar', sig })}>
                                <Ban className="h-4 w-4" /> Cancelar
                              </Button>
                            )}
                          </div>
                        )}

                        {mensagensDe != null && mensagensDe === sig.signingKey && (
                          <div className="rounded-md border p-2 text-xs">
                            {carregandoMensagens ? (
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Carregando mensagens…
                              </span>
                            ) : mensagens.length === 0 ? (
                              <span className="text-muted-foreground">Nenhuma mensagem enviada.</span>
                            ) : (
                              <table className="w-full">
                                <thead className="text-left text-muted-foreground">
                                  <tr>
                                    <th className="py-1 pr-2">Canal</th>
                                    <th className="py-1 pr-2">Quando</th>
                                    <th className="py-1 pr-2">Assunto</th>
                                    <th className="py-1">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mensagens.map((m, k) => (
                                    <tr key={k} className="border-t">
                                      <td className="py-1 pr-2">{m.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</td>
                                      <td className="py-1 pr-2">{m.momento || '—'}</td>
                                      <td className="py-1 pr-2">{m.assunto || m.origem || '—'}</td>
                                      <td className="py-1">{m.status || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {pedido && pedido.sig.signingKey === sig.signingKey && (
                          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                            {pedido.tipo === 'whatsapp' && (
                              <>
                                <Label>Telefone com DDD</Label>
                                <Input value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="67999999999" />
                                <Label>Mensagem (opcional)</Label>
                                <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                              </>
                            )}
                            {pedido.tipo === 'trocar' && (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  O link atual deixa de valer e o novo contato recebe um convite para assinar.
                                </p>
                                <Label>Novo signatário (e-mail ou telefone)</Label>
                                <Input value={campo} onChange={(e) => setCampo(e.target.value)} />
                                <Label>Mensagem (opcional)</Label>
                                <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                              </>
                            )}
                            {pedido.tipo === 'cancelar' && (
                              <p className="text-sm">
                                Cancelar a assinatura de <strong>{sig.email}</strong>? O link dele deixa de valer e isso não pode ser desfeito.
                              </p>
                            )}
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => setPedido(null)}>
                                Voltar
                              </Button>
                              <Button
                                size="sm"
                                variant={pedido.tipo === 'cancelar' ? 'destructive' : 'default'}
                                disabled={ocupado != null || (pedido.tipo !== 'cancelar' && !campo.trim())}
                                onClick={() =>
                                  executar(
                                    pedido.tipo === 'whatsapp'
                                      ? { acao: 'lembrete-whatsapp', signingKey: sig.signingKey!, telefone: campo, mensagem }
                                      : pedido.tipo === 'trocar'
                                        ? { acao: 'trocar-signatario', signingKey: sig.signingKey!, contato: campo, mensagem }
                                        : { acao: 'cancelar', signingKey: sig.signingKey! }
                                  )
                                }
                              >
                                {ocupado != null ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {pedido.tipo === 'cancelar' ? 'Confirmar cancelamento' : pedido.tipo === 'trocar' ? 'Trocar' : 'Enviar'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Histórico</h3>
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento no histórico.</p>
              ) : (
                <ol className="relative ml-3 space-y-4 border-l border-muted-foreground/30 pb-2">
                  {historico.map((h, i) => (
                    <li key={`${h.id}-${h.time}-${i}`} className="relative pl-5">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                      <p className="text-[11px] italic text-muted-foreground">{h.time || '—'}</p>
                      <p className="mt-0.5 text-sm leading-snug">
                        <ActivityText text={h.activity || '—'} />
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
