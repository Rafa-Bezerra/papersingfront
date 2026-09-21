'use client'

import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  consultarStatusPedido,
  concluirStatusPedido,
  UNIDADES_STATUS_PEDIDO,
  StatusPedidoConsulta,
} from '@/services/statusPedidoService'

function badgeStatus(codstatus: string | null | undefined) {
  const cod = (codstatus ?? '').trim().toUpperCase()
  if (cod === 'F') return <Badge className="bg-emerald-600 hover:bg-emerald-600">Concluído (F)</Badge>
  if (cod === 'A') return <Badge variant="secondary">Aberto (A)</Badge>
  if (cod === 'C') return <Badge variant="destructive">Cancelado (C)</Badge>
  if (!cod) return <Badge variant="outline">Sem status</Badge>
  return <Badge variant="outline">{cod}</Badge>
}

export default function StatusPedidoPage() {
  const titulo = 'Status do pedido'
  const [ehCsc, setEhCsc] = useState(false)
  const [unidade, setUnidade] = useState('WAY 262')
  const [idmov, setIdmov] = useState('')
  const [consulta, setConsulta] = useState<StatusPedidoConsulta | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('userData')
      if (!raw) return
      const u = JSON.parse(raw)
      setEhCsc(String(u.unidade ?? '').trim().toUpperCase() === 'WAY CSC')
    } catch {
      setEhCsc(false)
    }
  }, [])

  function idMovValido() {
    const id = Number(idmov.trim())
    return id > 0 ? id : null
  }

  async function handleConsultar() {
    const id = idMovValido()
    if (!id) {
      toast.error('Informe o IDMOV do movimento.')
      return
    }
    setCarregando(true)
    setConsulta(null)
    try {
      const resultado = await consultarStatusPedido(unidade, id)
      setConsulta(resultado)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na consulta.')
    } finally {
      setCarregando(false)
    }
  }

  async function handleConcluir() {
    const id = idMovValido()
    if (!id) {
      toast.error('Informe o IDMOV do movimento.')
      return
    }

    setConcluindo(true)
    try {
      const resultado = await concluirStatusPedido(unidade, id)
      toast.success(resultado.mensagem)
      setConsulta({
        unidade: resultado.unidade,
        idmov: resultado.idmov,
        codatendimento: resultado.codatendimento,
        codstatus: resultado.codstatus_atual,
        status_descricao: 'Concluído / Finalizado',
      })
      setConfirmOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao concluir.')
    } finally {
      setConcluindo(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConsultar()
    }
  }

  if (!ehCsc) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-900 dark:text-amber-100">
              <ShieldAlert className="h-5 w-5" />
              Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
              Esta ferramenta está disponível apenas para administradores logados na base{' '}
              <strong>WAY CSC</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const jaConcluido = (consulta?.codstatus ?? '').trim().toUpperCase() === 'F'

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <PackageCheck className="h-6 w-6" />
              {titulo}
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Atualiza manualmente o status do pedido no RM (TOTVS) para{' '}
              <strong>concluído</strong>, quando o fluxo normal não finalizou o atendimento.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">WAY CSC</Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-md border p-4 space-y-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Consulta e conclusão</p>
              <p className="text-xs text-muted-foreground mt-1">
                Informe a unidade e o IDMOV. O sistema localiza o{' '}
                <code className="text-xs">CODATENDIMENTO</code> em{' '}
                <code className="text-xs">TMOVATEND</code> e atualiza{' '}
                <code className="text-xs">HATENDIMENTOBASE</code> com{' '}
                <code className="text-xs">CODSTATUS = F</code>.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label>Unidade (Corpore)</Label>
                <Select value={unidade} onValueChange={(v) => { setUnidade(v); setConsulta(null) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_STATUS_PEDIDO.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idmov">IDMOV</Label>
                <Input
                  id="idmov"
                  type="number"
                  min={1}
                  value={idmov}
                  onChange={(e) => { setIdmov(e.target.value); setConsulta(null) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex.: 33762"
                />
              </div>

              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleConsultar}
                  disabled={carregando || !idmov.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {carregando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Consultar
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={concluindo || !idmov.trim() || jaConcluido}
                  className="flex-1 sm:flex-none"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Concluir
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {consulta && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5" />
              Resultado da consulta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Unidade</p>
                <p className="font-medium">{consulta.unidade}</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">IDMOV</p>
                <p className="font-medium">{consulta.idmov}</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CODATENDIMENTO</p>
                <p className="font-medium">{consulta.codatendimento ?? '—'}</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                <div className="pt-0.5">{badgeStatus(consulta.codstatus)}</div>
                {consulta.status_descricao && consulta.codstatus?.toUpperCase() !== 'F' && (
                  <p className="text-xs text-muted-foreground">{consulta.status_descricao}</p>
                )}
              </div>
            </div>

            {jaConcluido && (
              <p className="mt-4 text-sm text-muted-foreground">
                Este pedido já está concluído. Não é necessário atualizar novamente.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar conclusão do pedido</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-sm text-muted-foreground">
                <p>
                  O movimento <strong>{idmov}</strong> da unidade <strong>{unidade}</strong> será
                  marcado como concluído no RM.
                </p>
                <p>
                  Ação: <code className="text-xs">UPDATE HATENDIMENTOBASE SET CODSTATUS = &apos;F&apos;</code>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={concluindo}>
              Cancelar
            </Button>
            <Button onClick={handleConcluir} disabled={concluindo}>
              {concluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Concluindo…
                </>
              ) : (
                'Confirmar conclusão'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
