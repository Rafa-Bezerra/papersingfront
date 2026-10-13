'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil, RefreshCw, SearchIcon, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  adminAtualizarCliente,
  adminExcluirCliente,
  adminExcluirLembrete,
  adminListarClientes,
  adminListarLembretes,
  adminReenviarWebhooks,
  adminSalvarLembrete,
  adminWebhooks,
  ClientePlugSign,
  LembreteAutomatico,
  NotificacaoWebhook,
  WebhookPlugSign,
} from '@/services/docusignService'
import { WaySignCargaSecao } from '@/components/WaySignEspelhoPaineis'

const AVISO_SO_LEITURA =
  'Somente leitura: alterações na conta PlugSign só pelos logins configurados em PlugSign:WaySignAdminsConta.'

/** Clientes e parceiros (lista da PlugSign). Editar/excluir mexe na conta PlugSign inteira. */
export function ClientesSecao() {
  const [q, setQ] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [alterar, setAlterar] = useState(false)
  const [clientes, setClientes] = useState<ClientePlugSign[]>([])
  const [editando, setEditando] = useState<ClientePlugSign | null>(null)
  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [excluindo, setExcluindo] = useState<ClientePlugSign | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setCarregando(true)
    try {
      const res = await adminListarClientes(q)
      setAlterar(res.alterar)
      setClientes(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar clientes.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    // carga inicial apenas
  }, [])

  async function salvar() {
    if (!editando) return
    setSalvando(true)
    try {
      const r = await adminAtualizarCliente(editando.email, { name: nome.trim(), last_name: sobrenome.trim() })
      toast.success(r.message)
      setEditando(null)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!excluindo) return
    setSalvando(true)
    try {
      const r = await adminExcluirCliente(excluindo.email)
      toast.success(r.message)
      setExcluindo(null)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Clientes e parceiros já cadastrados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!alterar && <p className="text-xs text-muted-foreground">{AVISO_SO_LEITURA}</p>}
        <div className="flex gap-2">
          <Input
            placeholder="Nome ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void carregar()}
          />
          <Button onClick={() => void carregar()} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />} Buscar
          </Button>
        </div>
        {clientes.length === 0 && !carregando ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {clientes.map((c) => (
              <li key={`${c.id}-${c.email}`} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{`${c.nome} ${c.sobrenome}`.trim() || '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  {alterar && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditando(c)
                          setNome(c.nome)
                          setSobrenome(c.sobrenome)
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setExcluindo(c)}>
                        <Trash2 className="h-4 w-4" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
                {editando?.email === c.email && (
                  <div className="grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
                    <div>
                      <Label>Nome</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>
                    <div>
                      <Label>Sobrenome</Label>
                      <Input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-2">O e-mail não pode ser alterado na PlugSign.</p>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                      <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                      <Button size="sm" onClick={salvar} disabled={salvando || !nome.trim()}>Salvar</Button>
                    </div>
                  </div>
                )}
                {excluindo?.email === c.email && (
                  <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                    <p className="text-sm">
                      Excluir <strong>{c.email}</strong> da conta PlugSign? Ele perde o acesso aos documentos compartilhados.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setExcluindo(null)}>Voltar</Button>
                      <Button size="sm" variant="destructive" onClick={excluir} disabled={salvando}>Confirmar exclusão</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Lembretes automáticos da conta (assunto, dias após o envio, mensagem). */
function LembretesSecao() {
  const [carregando, setCarregando] = useState(false)
  const [alterar, setAlterar] = useState(false)
  const [itens, setItens] = useState<LembreteAutomatico[]>([])
  const [form, setForm] = useState<{ id?: number | null; assunto: string; mensagem: string; dias: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setCarregando(true)
    try {
      const res = await adminListarLembretes()
      setAlterar(res.alterar)
      setItens(res.data ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar lembretes.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function salvar() {
    if (!form) return
    setSalvando(true)
    try {
      const r = await adminSalvarLembrete({
        id: form.id,
        assunto: form.assunto.trim(),
        mensagem: form.mensagem.trim(),
        dias: Number(form.dias) || 0,
      })
      toast.success(r.message)
      setForm(null)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: number) {
    if (!window.confirm('Excluir este lembrete automático?')) return
    try {
      const r = await adminExcluirLembrete(id)
      toast.success(r.message)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Lembretes automáticos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            E-mails que a PlugSign manda sozinha para quem ainda não assinou, X dias depois do envio.
          </p>
        </div>
        {alterar && !form && (
          <Button size="sm" onClick={() => setForm({ assunto: '', mensagem: '', dias: '3' })}>Novo lembrete</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!alterar && <p className="text-xs text-muted-foreground">{AVISO_SO_LEITURA}</p>}
        {form && (
          <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
            <Label>Assunto do e-mail</Label>
            <Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} />
            <Label>Dias após o envio</Label>
            <Input type="number" min={1} value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} />
            <Label>Mensagem</Label>
            <Textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={salvar}
                disabled={salvando || !form.assunto.trim() || !form.mensagem.trim() || !(Number(form.dias) > 0)}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
        {carregando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lembrete automático.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {itens.map((l) => (
              <li key={l.id ?? l.assunto} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.assunto || '—'}</p>
                  <p className="text-xs text-muted-foreground">{l.dias ?? '?'} dia(s) após o envio</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs">{l.mensagem}</p>
                </div>
                {alterar && l.id != null && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({ id: l.id, assunto: l.assunto ?? '', mensagem: l.mensagem ?? '', dias: String(l.dias ?? 1) })
                      }
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => excluir(l.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Webhooks cadastrados na PlugSign e as últimas notificações enviadas (status HTTP do receptor). */
function WebhooksSecao() {
  const [carregando, setCarregando] = useState(false)
  const [alterar, setAlterar] = useState(false)
  const [hooks, setHooks] = useState<WebhookPlugSign[]>([])
  const [notif, setNotif] = useState<NotificacaoWebhook[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [chave, setChave] = useState('')

  async function carregar(p = page) {
    setCarregando(true)
    try {
      const res = await adminWebhooks(p)
      setAlterar(res.alterar)
      setHooks(res.webhooks ?? [])
      setNotif(res.notificacoes ?? [])
      setPage(res.page ?? p)
      setLastPage(res.lastPage ?? 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar webhooks.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar(1)
    // carga inicial apenas
  }, [])

  async function reenviar() {
    try {
      const r = await adminReenviarWebhooks(chave.trim())
      toast.success(r.message)
      setChave('')
      await carregar(1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao reenviar.')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Webhooks (avisos automáticos da PlugSign)</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Uso técnico: mostra se a PlugSign está conseguindo avisar o PaperSign quando algo muda.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void carregar(page)} disabled={carregando}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {hooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum webhook cadastrado na conta.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {hooks.map((h) => (
              <li key={h.id ?? h.url} className="flex flex-wrap items-center justify-between gap-2 p-2">
                <span className="font-mono text-xs">{h.tipo}</span>
                <span className="min-w-0 truncate text-xs">{h.url}</span>
                <Badge variant={h.ativo ? 'default' : 'outline'}>{h.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </li>
            ))}
          </ul>
        )}
        <h4 className="text-sm font-semibold">Últimas notificações</h4>
        {notif.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma notificação.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Quando</th>
                <th className="py-1 pr-2">Tipo</th>
                <th className="py-1">HTTP</th>
              </tr>
            </thead>
            <tbody>
              {notif.map((n, i) => (
                <tr key={`${n.id}-${i}`} className="border-t">
                  <td className="py-1 pr-2">{n.dataHora || '—'}</td>
                  <td className="py-1 pr-2">{n.tipo || '—'}</td>
                  <td className="py-1">
                    <Badge variant={n.httpStatus && n.httpStatus >= 200 && n.httpStatus < 300 ? 'default' : 'destructive'}>
                      {n.httpStatus ?? '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between text-xs">
          <Button size="sm" variant="outline" disabled={carregando || page <= 1} onClick={() => void carregar(page - 1)}>Anterior</Button>
          <span>Página {page} de {lastPage}</span>
          <Button size="sm" variant="outline" disabled={carregando || page >= lastPage} onClick={() => void carregar(page + 1)}>Próxima</Button>
        </div>
        {alterar && (
          <div className="flex gap-2">
            <Input placeholder="document_key com falha" value={chave} onChange={(e) => setChave(e.target.value)} />
            <Button size="sm" onClick={reenviar} disabled={!chave.trim()}>Reenviar falhas</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** WaySign · Administração (só Admin). */
export default function WaySignAdminPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configurações da conta PlugSign, que vale para todas as unidades. Só Admin vê esta aba.
      </p>
      <WaySignCargaSecao />
      <LembretesSecao />
      <WebhooksSecao />
    </div>
  )
}
