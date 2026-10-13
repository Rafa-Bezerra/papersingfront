'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Loader2, Plus, SearchIcon, Send, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toBase64 } from '@/utils/functions'
import {
  enviarTemplateWaySign,
  excluirTemplateWaySign,
  listarTemplatesWaySign,
  tagsTemplateWaySign,
  TemplateWaySign,
  usarTemplateWaySign,
} from '@/services/docusignService'

/** Usar um template: Word pede o valor de cada ${tag}; os dois pedem os destinatários. */
function UsarTemplateDialog({
  template,
  onClose,
  onEnviado,
}: {
  template: TemplateWaySign | null
  onClose: () => void
  onEnviado: () => void
}) {
  const [tags, setTags] = useState<string[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(false)
  const [nomeDocumento, setNomeDocumento] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [emCadeia, setEmCadeia] = useState(false)
  const [doubleAuth, setDoubleAuth] = useState(false)
  const [dest, setDest] = useState<{ email: string; nome: string }[]>([{ email: '', nome: '' }])
  const [enviando, setEnviando] = useState(false)
  const ehWord = (template?.extensao ?? '').startsWith('doc')

  useEffect(() => {
    if (!template?.documentKey) return
    setNomeDocumento(template.nome ?? '')
    setValores({})
    setTags([])
    setDest([{ email: '', nome: '' }])
    if (!ehWord) return
    setCarregando(true)
    tagsTemplateWaySign(template.documentKey)
      .then((r) => setTags(r.data ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Falha ao ler os campos.'))
      .finally(() => setCarregando(false))
  }, [template, ehWord])

  async function enviar() {
    if (!template?.documentKey) return
    const destinatarios = dest.filter((d) => d.email.trim()).map((d) => ({ email: d.email.trim(), nome: d.nome.trim() }))
    if (destinatarios.length === 0) {
      toast.error('Informe ao menos um destinatário.')
      return
    }
    if (ehWord && tags.some((t) => !(valores[t] ?? '').trim())) {
      toast.error('Preencha todos os campos do template.')
      return
    }
    setEnviando(true)
    try {
      const r = await usarTemplateWaySign(template.documentKey, {
        nomeDocumento: nomeDocumento.trim() || undefined,
        mensagem: mensagem.trim() || undefined,
        emCadeia,
        doubleAuth,
        tags: ehWord ? valores : undefined,
        destinatarios,
      })
      toast.success(r.naLista ? r.message : `${r.message} O documento aparece na lista após a próxima sincronização.`)
      onEnviado()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={template != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usar template</DialogTitle>
          <DialogDescription>{template?.nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do documento</Label>
            <Input value={nomeDocumento} onChange={(e) => setNomeDocumento(e.target.value)} />
          </div>

          {ehWord && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-semibold">Campos do template</p>
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">Este template não tem campos ${'{...}'}.</p>
              ) : (
                tags.map((t) => (
                  <div key={t}>
                    <Label className="font-mono text-xs">{t}</Label>
                    <Input value={valores[t] ?? ''} onChange={(e) => setValores({ ...valores, [t]: e.target.value })} />
                  </div>
                ))
              )}
            </div>
          )}

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-semibold">Destinatários</p>
            {dest.map((d, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="E-mail"
                  value={d.email}
                  onChange={(e) => setDest(dest.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))}
                />
                <Input
                  placeholder="Nome (opcional)"
                  value={d.nome}
                  onChange={(e) => setDest(dest.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))}
                />
                {dest.length > 1 && (
                  <Button size="icon" variant="outline" onClick={() => setDest(dest.filter((_, k) => k !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setDest([...dest, { email: '', nome: '' }])}>
              <Plus className="h-4 w-4" /> Destinatário
            </Button>
          </div>

          <div>
            <Label>Mensagem (opcional)</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {ehWord && (
              <label className="flex items-center gap-2">
                <Checkbox checked={emCadeia} onCheckedChange={(v) => setEmCadeia(!!v)} /> Assinatura em cadeia (na ordem)
              </label>
            )}
            <label className="flex items-center gap-2">
              <Checkbox checked={doubleAuth} onCheckedChange={(v) => setDoubleAuth(!!v)} /> Exigir 2FA
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar para assinatura
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** WaySign · Templates PDF e Word (com campos ${...}). */
export default function WaySignTemplatesPanel({ onEnviado }: { onEnviado?: () => void }) {
  const [nome, setNome] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [itens, setItens] = useState<TemplateWaySign[]>([])
  const [podeExcluir, setPodeExcluir] = useState(false)
  const [usando, setUsando] = useState<TemplateWaySign | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const r = await listarTemplatesWaySign(nome)
      setItens(r.data ?? [])
      setPodeExcluir(r.excluir)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar templates.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function enviarTemplate() {
    if (!arquivo) return
    if (arquivo.size > 20 * 1024 * 1024) {
      toast.error('O template precisa ter até 20 MB.')
      return
    }
    setEnviando(true)
    try {
      const base64 = await toBase64(arquivo)
      const r = await enviarTemplateWaySign({ nome: novoNome.trim() || undefined, arquivoNome: arquivo.name, base64 })
      toast.success(r.message)
      setArquivo(null)
      setNovoNome('')
      if (inputRef.current) inputRef.current.value = ''
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar o template.')
    } finally {
      setEnviando(false)
    }
  }

  async function excluir(t: TemplateWaySign) {
    if (t.id == null || !window.confirm(`Excluir o template "${t.nome}" da conta PlugSign?`)) return
    try {
      const r = await excluirTemplateWaySign(t.id)
      toast.success(r.message)
      await carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label>Arquivo (PDF ou Word .docx, até 20 MB)</Label>
            <Input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Nome (opcional)</Label>
            <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Contrato de prestação de serviços" />
          </div>
          <Button onClick={enviarTemplate} disabled={!arquivo || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enviar
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            No Word, use campos no formato ${'{nome_do_campo}'}: eles são pedidos na hora de enviar para assinatura.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">Templates</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar pelo nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void carregar()}
            />
            <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {itens.length === 0 && !carregando ? (
            <p className="text-sm text-muted-foreground">Nenhum template.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {itens.map((t) => (
                <li key={t.documentKey ?? t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.nome || t.arquivo || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.enviadoEm || ''} {t.enviadoPor ? `· ${t.enviadoPor}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{(t.extensao || '').toUpperCase().startsWith('DOC') ? 'Word' : 'PDF'}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setUsando(t)} disabled={!t.documentKey}>
                      <Send className="h-4 w-4" /> Usar para assinatura
                    </Button>
                    {podeExcluir && (
                      <Button size="sm" variant="destructive" onClick={() => excluir(t)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <UsarTemplateDialog template={usando} onClose={() => setUsando(null)} onEnviado={() => onEnviado?.()} />
    </div>
  )
}
