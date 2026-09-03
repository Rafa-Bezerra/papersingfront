'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { FolderLock, Mail, RefreshCw, SearchIcon, Send, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/ui/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DisparoDestinatario,
  DisparoEmail,
  EmailPainelConfig,
  MODULOS_EMAIL,
  PERFIS_DISPARO,
  enviarDisparoPerfil,
  enviarEmailTeste,
  getConfigDisparos,
  getDestinatariosDisparo,
  getDisparos,
  reenviarDisparo,
  salvarConfigDisparos
} from '@/services/disparosService'
import {
  PlugSignFolderInfo,
  PlugSignPastasResponse,
  PlugSignPrivatizarResultado,
  atualizarPastaPlugSign,
  getPlugSignPastas,
  privatizarPlugSign
} from '@/services/docusignService'

function formatarData(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR')
}

export default function DisparosPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [results, setResults] = useState<DisparoEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [reenviando, setReenviando] = useState<number | null>(null)

  const [perfis, setPerfis] = useState<string[]>([])
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [destinatarios, setDestinatarios] = useState<DisparoDestinatario[]>([])
  const [carregandoDest, setCarregandoDest] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ehAdmin, setEhAdmin] = useState<boolean | null>(null)
  const [config, setConfig] = useState<EmailPainelConfig | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [emailTeste, setEmailTeste] = useState('')
  const [enviandoTeste, setEnviandoTeste] = useState(false)

  const [plugPastas, setPlugPastas] = useState<PlugSignPastasResponse | null>(null)
  const [plugPastaSel, setPlugPastaSel] = useState('')
  const [plugCarregandoPastas, setPlugCarregandoPastas] = useState(false)
  const [plugPreview, setPlugPreview] = useState<PlugSignPrivatizarResultado | null>(null)
  const [plugProcessando, setPlugProcessando] = useState(false)
  const [plugTrancando, setPlugTrancando] = useState(false)

  function togglePerfil(id: string, checked: boolean) {
    setPerfis((atual) => {
      const next = checked ? [...atual, id] : atual.filter((p) => p !== id)
      setDestinatarios([])
      return next
    })
  }

  async function carregar() {
    setLoading(true)
    try {
      const filtro = status === 'todos' ? '' : status
      const lista = await getDisparos(query, filtro)
      setResults(lista)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível carregar os disparos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let admin = false
    const stored = sessionStorage.getItem('userData')
    if (stored) {
      try {
        admin = Boolean(JSON.parse(stored).admin)
      } catch { /* ignore */ }
    }
    setEhAdmin(admin)
    if (!admin) {
      toast.error('Somente administrador acessa o painel de disparos.')
      return
    }
    carregar()
    getConfigDisparos()
      .then((cfg) => {
        setConfig(cfg)
        let emailUsuario = ''
        if (stored) {
          try { emailUsuario = JSON.parse(stored).email || '' } catch { /* ignore */ }
        }
        setEmailTeste(emailUsuario || cfg.email_teste || '')
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Não foi possível carregar a configuração.')
      })
    carregarPastasPlugSign()
  }, [])

  async function carregarPastasPlugSign() {
    setPlugCarregandoPastas(true)
    try {
      const dados = await getPlugSignPastas()
      setPlugPastas(dados)
      if (!plugPastaSel && dados.folderIdPadrao > 0) {
        setPlugPastaSel(String(dados.folderIdPadrao))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível listar pastas PlugSign.')
    } finally {
      setPlugCarregandoPastas(false)
    }
  }

  function pastaSelecionada(): PlugSignFolderInfo | undefined {
    const id = Number(plugPastaSel)
    if (!id) return undefined
    return plugPastas?.pastas.find((p) => p.id === id)
  }

  async function handlePlugPreview() {
    setPlugProcessando(true)
    try {
      const pasta = pastaSelecionada()
      const resultado = await privatizarPlugSign({
        dryRun: true,
        folderId: pasta?.id,
        maxArquivos: 150
      })
      setPlugPreview(resultado)
      toast.message(
        `${resultado.pendentesEveryone} documento(s) ainda visíveis para todos (de ${resultado.totalListados} listados).`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao listar documentos PlugSign.')
    } finally {
      setPlugProcessando(false)
    }
  }

  async function handlePlugPrivatizar() {
    const pasta = pastaSelecionada()
    const destino = pasta ? ` e mover para a pasta "${pasta.name}"` : ''
    if (!window.confirm(
      `Marcar até 150 documentos públicos como OnlyMe${destino}?\n\n` +
      'Pode repetir o botão até zerar os pendentes. Novos envios da API já saem privados.'
    )) return

    setPlugProcessando(true)
    try {
      const resultado = await privatizarPlugSign({
        dryRun: false,
        folderId: pasta?.id,
        maxArquivos: 150
      })
      setPlugPreview(resultado)
      if (resultado.erros.length > 0) {
        toast.error(`Atualizados: ${resultado.atualizados}. Falhas: ${resultado.erros.length}.`)
      } else {
        toast.success(
          `${resultado.atualizados} documento(s) marcados como OnlyMe. ` +
          `Ainda pendentes nesta leva: ${Math.max(0, resultado.pendentesEveryone - resultado.atualizados)}.`
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao privatizar documentos PlugSign.')
    } finally {
      setPlugProcessando(false)
    }
  }

  async function handlePlugTrancarPasta() {
    const pasta = pastaSelecionada()
    if (!pasta) {
      toast.error('Escolha uma pasta na lista. A tela /documents/ da PlugSign é a raiz, não uma pasta.')
      return
    }
    if (!window.confirm(`Trancar a pasta "${pasta.name}" (ID ${pasta.id}) como OnlyMe?`)) return

    setPlugTrancando(true)
    try {
      await atualizarPastaPlugSign({ folderId: pasta.id, name: pasta.name, accessibility: 'OnlyMe' })
      toast.success(`Pasta "${pasta.name}" atualizada para OnlyMe.`)
      await carregarPastasPlugSign()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar a pasta PlugSign.')
    } finally {
      setPlugTrancando(false)
    }
  }

  async function handlePreview() {
    if (perfis.length === 0) {
      toast.error('Escolha pelo menos um perfil de acesso.')
      return
    }
    setCarregandoDest(true)
    try {
      const lista = await getDestinatariosDisparo(perfis)
      setDestinatarios(lista)
      if (lista.length === 0) {
        toast.message('Nenhum usuário ativo com e-mail nesses perfis nesta unidade.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível listar destinatários.')
    } finally {
      setCarregandoDest(false)
    }
  }

  async function handleDisparar() {
    if (perfis.length === 0) {
      toast.error('Escolha pelo menos um perfil de acesso.')
      return
    }
    if (!assunto.trim() || !corpo.trim()) {
      toast.error('Informe assunto e mensagem.')
      return
    }
    if (destinatarios.length === 0) {
      toast.error('Veja os destinatários antes de disparar.')
      return
    }
    if (!window.confirm(`Enviar este e-mail para ${destinatarios.length} usuário(s) da unidade?`)) {
      return
    }

    setEnviando(true)
    try {
      const resultado = await enviarDisparoPerfil(perfis, assunto.trim(), corpo.trim())
      if (resultado.falhas > 0) {
        toast.error(`Enviados: ${resultado.enviados}. Falhas: ${resultado.falhas}.`)
      } else {
        toast.success(`E-mail enviado para ${resultado.enviados} destinatário(s).`)
      }
      setAssunto('')
      setCorpo('')
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao disparar e-mail.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleSalvarConfig() {
    if (!config) return
    setSalvandoConfig(true)
    try {
      const salvo = await salvarConfigDisparos(config)
      setConfig(salvo)
      toast.success('Configuração de e-mail salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar configuração.')
    } finally {
      setSalvandoConfig(false)
    }
  }

  async function handleTeste() {
    if (!emailTeste.trim()) {
      toast.error('Informe o e-mail para o teste.')
      return
    }
    setEnviandoTeste(true)
    try {
      await enviarEmailTeste(emailTeste.trim())
      toast.success(`E-mail de teste enviado para ${emailTeste.trim()}.`)
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar teste.')
    } finally {
      setEnviandoTeste(false)
    }
  }

  async function handleReenviar(item: DisparoEmail) {
    setReenviando(item.id)
    try {
      await reenviarDisparo(item.id)
      toast.success('E-mail reenviado.')
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao reenviar.')
    } finally {
      setReenviando(null)
    }
  }

  const columns = useMemo<ColumnDef<DisparoEmail>[]>(() => [
    {
      accessorKey: 'data_envio',
      header: 'Data',
      cell: ({ row }) => formatarData(row.original.data_envio)
    },
    { accessorKey: 'unidade', header: 'Unidade' },
    { accessorKey: 'destinatarios', header: 'Destinatários' },
    { accessorKey: 'assunto', header: 'Assunto' },
    {
      accessorKey: 'status',
      header: 'Situação',
      cell: ({ row }) => (
        <span className={row.original.status === 'Enviado' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
          {row.original.status}
        </span>
      )
    },
    {
      accessorKey: 'erro',
      header: 'Erro',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground line-clamp-2" title={row.original.erro}>
          {row.original.erro}
        </span>
      )
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={reenviando === row.original.id}
          onClick={() => handleReenviar(row.original)}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          {reenviando === row.original.id ? 'Enviando…' : 'Reenviar'}
        </Button>
      )
    }
  ], [reenviando])

  if (ehAdmin === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Somente administrador pode ver e disparar e-mails neste painel.
      </p>
    )
  }

  if (ehAdmin !== true) return null

  return (
    <Tabs defaultValue="config" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="config"><Settings className="w-4 h-4" /> Configuração</TabsTrigger>
        <TabsTrigger value="disparar"><Send className="w-4 h-4" /> Disparar por perfil</TabsTrigger>
        <TabsTrigger value="historico"><Mail className="w-4 h-4" /> Histórico</TabsTrigger>
        <TabsTrigger value="plugsign"><FolderLock className="w-4 h-4" /> PlugSign</TabsTrigger>
      </TabsList>

      <TabsContent value="config">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl">Configuração de envio</CardTitle>
            <p className="text-sm text-muted-foreground">
              O que antes ficava só no código (módulos, lembrete, modo teste e cópia para o Financeiro).
              SMTP continua no servidor. Salve antes de testar as mudanças.
            </p>
          </CardHeader>
          <CardContent className="px-0 space-y-6">
            <div className="rounded-md border p-4 space-y-3">
              <Label className="text-base">Testar envio</Label>
              <p className="text-sm text-muted-foreground">Manda um e-mail simples para conferir se o SMTP está ok.</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-sm"
                  type="email"
                  value={emailTeste}
                  onChange={(e) => setEmailTeste(e.target.value)}
                  placeholder="seu.email@grupowaybrasil.com.br"
                />
                <Button type="button" onClick={handleTeste} disabled={enviandoTeste}>
                  {enviandoTeste ? 'Enviando…' : 'Enviar teste'}
                </Button>
              </div>
            </div>

            {config && (
              <>
                <div className="rounded-md border p-4 space-y-3">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={config.financeiro_recebe_alertas}
                      onCheckedChange={(v) => setConfig({ ...config, financeiro_recebe_alertas: v === true })}
                    />
                    <span>
                      <span className="font-medium">Financeiro recebe todos os alertas de aprovação</span>
                      <span className="block text-muted-foreground">
                        Quem tem o perfil Financeiro nesta unidade recebe cópia de pendente, aprovado, reprovado e lembrete.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={config.senha_novo_usuario}
                      onCheckedChange={(v) => setConfig({ ...config, senha_novo_usuario: v === true })}
                    />
                    <span>Enviar e-mail com login e senha ao cadastrar usuário</span>
                  </label>
                </div>

                <div className="rounded-md border p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={config.modo_teste}
                      onCheckedChange={(v) => setConfig({ ...config, modo_teste: v === true })}
                    />
                    Modo teste (todos os e-mails vão só para o endereço abaixo)
                  </label>
                  <div>
                    <Label htmlFor="email-teste-cfg">E-mail de teste</Label>
                    <Input
                      id="email-teste-cfg"
                      className="mt-1 max-w-sm"
                      value={config.email_teste}
                      onChange={(e) => setConfig({ ...config, email_teste: e.target.value })}
                      placeholder="email.teste@..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <Label htmlFor="lembrete-horas">Lembrete a cada (horas)</Label>
                      <Input
                        id="lembrete-horas"
                        className="mt-1 w-28"
                        type="number"
                        min={1}
                        max={72}
                        value={config.lembrete_horas}
                        onChange={(e) => setConfig({ ...config, lembrete_horas: Number(e.target.value) || 6 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-ciclo">Máx. e-mails por pessoa no ciclo</Label>
                      <Input
                        id="max-ciclo"
                        className="mt-1 w-28"
                        type="number"
                        min={1}
                        max={50}
                        value={config.max_emails_ciclo}
                        onChange={(e) => setConfig({ ...config, max_emails_ciclo: Number(e.target.value) || 10 })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Alertas automáticos por módulo</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Desligado = o PaperSign não dispara e-mail daquele fluxo (aprovação, criação, lembrete).
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MODULOS_EMAIL.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={config.modulos?.[m.id] === true}
                          onCheckedChange={(v) => setConfig({
                            ...config,
                            modulos: { ...config.modulos, [m.id]: v === true }
                          })}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Servidor SMTP: {config.smtp || '—'} · Remetente: {config.remetente || '—'}
                </p>

                <Button type="button" onClick={handleSalvarConfig} disabled={salvandoConfig}>
                  {salvandoConfig ? 'Salvando…' : 'Salvar configuração'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="disparar">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Send className="w-5 h-5" />
            Disparar e-mail por perfil
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Envia um e-mail para os usuários ativos desta unidade que têm o perfil marcado em Usuários.
            Exemplo: quem tem acesso ao Financeiro recebe o e-mail.
          </p>
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          <div>
            <Label className="mb-2 block">Perfis de acesso</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {PERFIS_DISPARO.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={perfis.includes(p.id)}
                    onCheckedChange={(v) => togglePerfil(p.id, v === true)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <Label htmlFor="assunto-disparo">Assunto</Label>
              <Input
                id="assunto-disparo"
                className="mt-1"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Assunto do e-mail"
              />
            </div>
            <div>
              <Label htmlFor="corpo-disparo">Mensagem</Label>
              <Textarea
                id="corpo-disparo"
                className="mt-1 min-h-32"
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                placeholder="Texto do e-mail"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={carregandoDest}>
              {carregandoDest ? 'Buscando…' : 'Ver destinatários'}
            </Button>
            <Button
              type="button"
              onClick={handleDisparar}
              disabled={enviando || destinatarios.length === 0}
            >
              <Mail className="w-4 h-4 mr-1" />
              {enviando ? 'Disparando…' : `Disparar (${destinatarios.length})`}
            </Button>
          </div>

          {destinatarios.length > 0 && (
            <div className="rounded-md border p-3 max-h-56 overflow-auto text-sm">
              <p className="font-medium mb-2">
                {destinatarios.length} usuário(s) ativo(s) nesta unidade
              </p>
              <ul className="space-y-1">
                {destinatarios.map((d) => (
                  <li key={`${d.usuario}-${d.email}`}>
                    {d.nome} <span className="text-muted-foreground">({d.email})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="historico">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="w-5 h-5" />
            Histórico de disparos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Movimentos, aprovação, criação de senha e os envios feitos neste painel.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar destinatário, assunto ou unidade"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') carregar() }}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Enviado">Enviado</SelectItem>
                <SelectItem value="Erro">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={carregar} disabled={loading}>
              {loading ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={results}
            loading={loading}
            globalFilterAccessorKey={['destinatarios', 'assunto', 'unidade', 'status']}
            searchPlaceholder="Filtrar nesta página…"
          />
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="plugsign">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl">Visibilidade dos documentos na PlugSign</CardTitle>
            <p className="text-sm text-muted-foreground">
              Envios pela API ficaram como Everyone (todos da empresa veem). Novos PDFs já saem como OnlyMe.
              A tela <span className="font-medium">app.plugsign.com.br/documents/</span> é a listagem raiz, não uma pasta trancada.
            </p>
          </CardHeader>
          <CardContent className="px-0 space-y-6">
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm">
                Envio padrão da API:{' '}
                <span className="font-medium">{plugPastas?.accessibilityPadrao || 'OnlyMe'}</span>
                {plugPastas && plugPastas.folderIdPadrao > 0
                  ? ` · pasta ${plugPastas.folderIdPadrao}`
                  : ' · raiz (FolderId 0)'}
              </p>
              <div className="max-w-md space-y-1">
                <Label>Pasta de destino (opcional)</Label>
                <Select value={plugPastaSel || 'nenhuma'} onValueChange={(v) => setPlugPastaSel(v === 'nenhuma' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={plugCarregandoPastas ? 'Carregando pastas…' : 'Não mover (só alterar visibilidade)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Não mover (só alterar visibilidade)</SelectItem>
                    {(plugPastas?.pastas ?? []).map((pasta) => (
                      <SelectItem key={pasta.id} value={String(pasta.id)}>
                        {pasta.name} · ID {pasta.id} · {pasta.accessibility || '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={carregarPastasPlugSign} disabled={plugCarregandoPastas}>
                  {plugCarregandoPastas ? 'Atualizando…' : 'Atualizar pastas'}
                </Button>
                <Button type="button" variant="outline" onClick={handlePlugPreview} disabled={plugProcessando}>
                  {plugProcessando ? 'Consultando…' : '1. Ver documentos públicos'}
                </Button>
                <Button type="button" onClick={handlePlugPrivatizar} disabled={plugProcessando}>
                  {plugProcessando ? 'Aplicando…' : '2. Privatizar lote (OnlyMe)'}
                </Button>
                <Button type="button" variant="secondary" onClick={handlePlugTrancarPasta} disabled={plugTrancando}>
                  {plugTrancando ? 'Trancando…' : '3. Trancar pasta escolhida'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cada clique em privatizar trata até 150 arquivos. Repita até os pendentes zerarem.
                Trancar pasta só funciona com uma pasta criada no portal (ID numérico), depois de mover os arquivos.
              </p>
            </div>

            {plugPreview && (
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <p>
                  Listados: <span className="font-medium">{plugPreview.totalListados}</span>
                  {' · '}Públicos nesta leva: <span className="font-medium">{plugPreview.pendentesEveryone}</span>
                  {' · '}Atualizados: <span className="font-medium">{plugPreview.atualizados}</span>
                  {plugPreview.dryRun ? ' · simulação' : ''}
                </p>
                {plugPreview.erros.length > 0 && (
                  <ul className="list-disc pl-5 text-red-700 space-y-1">
                    {plugPreview.erros.slice(0, 8).map((erro) => (
                      <li key={erro}>{erro}</li>
                    ))}
                  </ul>
                )}
                {plugPreview.amostra.length > 0 && (
                  <ul className="space-y-1 text-muted-foreground max-h-64 overflow-auto">
                    {plugPreview.amostra.map((arq) => (
                      <li key={arq.documentKey}>
                        {arq.name || arq.documentKey} · {arq.accessibility}
                        {arq.folderName ? ` · pasta ${arq.folderName}` : ' · raiz'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
