'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Copy, Loader2, Mail, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isAdminCscSession } from '@/utils/sessionUser'
import { mostrarErro } from '@/utils/avisoApi'
import {
  atualizarDestinatario,
  buscarUsuarios,
  criarDestinatario,
  desativarDestinatario,
  getAlvos,
  getDestinatarios,
  getErroSistema,
  getErrosSistema,
  getEventos,
  getPainel,
  testeDestinatario,
  verificarAgora,
  type ErroSistemaGrupo,
  type ErroSistemaItem,
  type MonitorDestinatario,
  type MonitorEvento,
  type MonitorPainel,
  type MonitorUsuarioBusca,
} from '@/services/monitoramentoService'

function fmtBr(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function minutosDesde(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
}

function bolinha(status: string) {
  const s = status.toLowerCase()
  const cor =
    s === 'noar' ? 'bg-emerald-500' : s === 'fora' ? 'bg-red-500' : 'bg-zinc-400'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cor}`} title={status} />
}

/** Título e o que a checagem faz, por tipo de alvo. */
function legendaTipo(tipo: string): { titulo: string; como: string } {
  const t = (tipo || '').trim().toLowerCase()
  if (t === 'rm') {
    return {
      titulo: 'RM (API SOAP)',
      como: 'TCP no host:porta + GET no WSDL do wsDataServer',
    }
  }
  if (t === 'banco') {
    return {
      titulo: 'Bancos SQL',
      como: 'Abre a connection string e executa SELECT 1',
    }
  }
  if (t === 'plugsign') {
    return {
      titulo: 'PlugSign',
      como: 'GET na BaseUrl da API',
    }
  }
  return { titulo: tipo || 'Outro', como: '' }
}

export default function MonitoramentoPage() {
  const [autorizado, setAutorizado] = useState(false)
  const [aba, setAba] = useState('painel')
  const [painel, setPainel] = useState<MonitorPainel | null>(null)
  const [eventos, setEventos] = useState<MonitorEvento[]>([])
  const [filtroAlvo, setFiltroAlvo] = useState<string>('todos')
  const [destinatarios, setDestinatarios] = useState<MonitorDestinatario[]>([])
  const [nomesAlvos, setNomesAlvos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [verificando, setVerificando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<MonitorDestinatario | null>(null)
  const [usuarioSel, setUsuarioSel] = useState<MonitorUsuarioBusca | null>(null)
  const [buscaUser, setBuscaUser] = useState('')
  const [sugestoes, setSugestoes] = useState<MonitorUsuarioBusca[]>([])
  const [buscandoUser, setBuscandoUser] = useState(false)
  const [recebeQueda, setRecebeQueda] = useState(true)
  const [recebeVolta, setRecebeVolta] = useState(true)
  const [recebeErroSistema, setRecebeErroSistema] = useState(true)
  const [ativo, setAtivo] = useState(true)
  const [alvosSel, setAlvosSel] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const buscaTimer = useRef<number | null>(null)

  const [errosLista, setErrosLista] = useState<ErroSistemaItem[]>([])
  const [errosGrupos, setErrosGrupos] = useState<ErroSistemaGrupo[]>([])
  const [errosAgrupado, setErrosAgrupado] = useState(true)
  const [erroDias, setErroDias] = useState('7')
  const [erroModulo, setErroModulo] = useState('')
  const [erroUnidade, setErroUnidade] = useState('')
  const [erroBusca, setErroBusca] = useState('')
  const [carregandoErros, setCarregandoErros] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState<ErroSistemaItem | null>(null)

  useEffect(() => {
    setAutorizado(isAdminCscSession())
  }, [])

  const carregarPainel = useCallback(async () => {
    const p = await getPainel()
    setPainel(p)
  }, [])

  const carregarEventos = useCallback(async () => {
    const lista = await getEventos(30, filtroAlvo === 'todos' ? undefined : filtroAlvo)
    setEventos(lista)
  }, [filtroAlvo])

  const carregarDest = useCallback(async () => {
    const [d, a] = await Promise.all([getDestinatarios(), getAlvos()])
    setDestinatarios(d)
    setNomesAlvos(a)
  }, [])

  const carregarErros = useCallback(async () => {
    setCarregandoErros(true)
    try {
      const data = await getErrosSistema({
        dias: Number(erroDias) || 7,
        modulo: erroModulo.trim() || undefined,
        unidade: erroUnidade.trim() || undefined,
        busca: erroBusca.trim() || undefined,
        agrupar: errosAgrupado,
      })
      if (errosAgrupado) {
        setErrosGrupos(data as ErroSistemaGrupo[])
        setErrosLista([])
      } else {
        setErrosLista(data as ErroSistemaItem[])
        setErrosGrupos([])
      }
    } catch (err) {
      mostrarErro(err)
    } finally {
      setCarregandoErros(false)
    }
  }, [erroDias, erroModulo, erroUnidade, erroBusca, errosAgrupado])

  const carregarTudo = useCallback(async () => {
    setCarregando(true)
    try {
      await Promise.all([carregarPainel(), carregarEventos(), carregarDest()])
    } catch (err) {
      mostrarErro(err)
    } finally {
      setCarregando(false)
    }
  }, [carregarPainel, carregarEventos, carregarDest])

  useEffect(() => {
    if (!autorizado) return
    void carregarTudo()
  }, [autorizado, carregarTudo])

  useEffect(() => {
    if (!autorizado || aba !== 'painel') return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void carregarPainel().catch(() => undefined)
      void carregarEventos().catch(() => undefined)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [autorizado, aba, carregarPainel, carregarEventos])

  useEffect(() => {
    if (!autorizado) return
    void carregarEventos().catch((err) => mostrarErro(err))
  }, [filtroAlvo, autorizado, carregarEventos])

  useEffect(() => {
    if (!autorizado || aba !== 'erros') return
    void carregarErros()
  }, [autorizado, aba, carregarErros])

  useEffect(() => {
    if (buscaTimer.current) window.clearTimeout(buscaTimer.current)
    const q = buscaUser.trim()
    if (q.length < 3 || editando) {
      setSugestoes([])
      return
    }
    buscaTimer.current = window.setTimeout(() => {
      setBuscandoUser(true)
      void buscarUsuarios(q)
        .then(setSugestoes)
        .catch((err) => mostrarErro(err))
        .finally(() => setBuscandoUser(false))
    }, 350)
    return () => {
      if (buscaTimer.current) window.clearTimeout(buscaTimer.current)
    }
  }, [buscaUser, editando])

  const resumo = useMemo(() => {
    const alvos = painel?.alvos ?? []
    return {
      total: alvos.length,
      noAr: alvos.filter((a) => a.status.toLowerCase() === 'noar').length,
      fora: alvos.filter((a) => a.status.toLowerCase() === 'fora').length,
    }
  }, [painel])

  const porTipo = useMemo(() => {
    const map = new Map<string, NonNullable<MonitorPainel['alvos']>>()
    for (const a of painel?.alvos ?? []) {
      const t = a.tipo || 'Outro'
      if (!map.has(t)) map.set(t, [])
      map.get(t)!.push(a)
    }
    return [...map.entries()]
  }, [painel])

  async function onVerificarAgora() {
    setVerificando(true)
    try {
      const p = await verificarAgora()
      setPainel(p)
      await carregarEventos()
      toast.success('Verificação concluída.')
    } catch (err) {
      mostrarErro(err)
    } finally {
      setVerificando(false)
    }
  }

  function abrirNovo() {
    setEditando(null)
    setUsuarioSel(null)
    setBuscaUser('')
    setSugestoes([])
    setRecebeQueda(true)
    setRecebeVolta(true)
    setRecebeErroSistema(true)
    setAtivo(true)
    setAlvosSel([])
    setModalAberto(true)
  }

  function abrirEditar(d: MonitorDestinatario) {
    setEditando(d)
    setUsuarioSel({
      unidade: d.unidade,
      codUsuario: d.codUsuario,
      nome: d.nome,
      email: d.email,
    })
    setBuscaUser('')
    setSugestoes([])
    setRecebeQueda(d.recebeQueda)
    setRecebeVolta(d.recebeVolta)
    setRecebeErroSistema(d.recebeErroSistema !== false)
    setAtivo(d.ativo)
    setAlvosSel(d.alvos ? d.alvos.split(';').map((x) => x.trim()).filter(Boolean) : [])
    setModalAberto(true)
  }

  async function abrirDetalheErro(id: number) {
    try {
      setErroDetalhe(await getErroSistema(id))
    } catch (err) {
      mostrarErro(err)
    }
  }

  async function salvarDest() {
    setSalvando(true)
    try {
      const alvos = alvosSel.length ? alvosSel.join(';') : null
      if (editando) {
        await atualizarDestinatario(editando.id, {
          recebeQueda,
          recebeVolta,
          recebeErroSistema,
          ativo,
          alvos,
        })
      } else {
        if (!usuarioSel) {
          toast.error('Selecione um usuário do PaperSign.')
          return
        }
        await criarDestinatario({
          unidade: usuarioSel.unidade,
          codUsuario: usuarioSel.codUsuario,
          recebeQueda,
          recebeVolta,
          recebeErroSistema,
          ativo: true,
          alvos,
        })
      }
      toast.success('Destinatário salvo.')
      setModalAberto(false)
      await carregarDest()
    } catch (err) {
      mostrarErro(err)
    } finally {
      setSalvando(false)
    }
  }

  async function onDesativar(d: MonitorDestinatario) {
    if (!window.confirm(`Desativar ${d.nome} (${d.email})?`)) return
    try {
      await desativarDestinatario(d.id)
      toast.success('Destinatário desativado.')
      await carregarDest()
    } catch (err) {
      mostrarErro(err)
    }
  }

  async function onTeste(d: MonitorDestinatario) {
    try {
      await testeDestinatario(d.id)
      toast.success(`Teste enviado para ${d.email}.`)
    } catch (err) {
      mostrarErro(err)
    }
  }

  if (!autorizado) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        Acesso restrito aos administradores do CSC.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Monitoramento</h1>
            <p className="text-sm text-muted-foreground">
              RM SOAP, bancos SQL e (se ligado) PlugSign
            </p>
          </div>
        </div>
        <Button onClick={onVerificarAgora} disabled={verificando || carregando}>
          {verificando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Verificar agora
        </Button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="erros">Erros do sistema</TabsTrigger>
          <TabsTrigger value="destinatarios">Quem recebe os alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">O que é verificado</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <span className="text-foreground">RM (API SOAP)</span> — porta do Totvs + WSDL do
                wsDataServer
              </li>
              <li>
                <span className="text-foreground">Bancos SQL</span> — PaperSign e Corpore de cada
                unidade (SELECT 1)
              </li>
              <li>
                <span className="text-foreground">PlugSign</span> — só se{' '}
                <code className="text-xs">VerificarPlugSign</code> estiver true no appsettings
              </li>
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResumoCard titulo="Alvos" valor={resumo.total} />
            <ResumoCard titulo="No ar" valor={resumo.noAr} destaque="ok" />
            <ResumoCard titulo="Fora" valor={resumo.fora} destaque={resumo.fora ? 'erro' : undefined} />
            <ResumoCard titulo="Última verificação" valor={fmtBr(painel?.ultimoCicloEm)} texto />
          </div>
          {!painel?.habilitado && (
            <p className="text-sm text-muted-foreground">
              Monitor desabilitado no appsettings (<code className="text-xs">Habilitado=false</code>).
            </p>
          )}

          {carregando && !painel ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            porTipo.map(([tipo, alvos]) => {
              const legenda = legendaTipo(tipo)
              return (
              <div key={tipo} className="space-y-2">
                <div>
                  <h2 className="text-sm font-medium text-foreground">{legenda.titulo}</h2>
                  {legenda.como ? (
                    <p className="text-xs text-muted-foreground">{legenda.como}</p>
                  ) : null}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {alvos.map((a) => {
                    const mins = minutosDesde(a.foraDesde)
                    return (
                      <div key={a.nome} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-medium">
                            {bolinha(a.status)}
                            {a.nome}
                          </div>
                          {a.tempoRespostaMs != null && (
                            <span className="text-xs text-muted-foreground">{a.tempoRespostaMs} ms</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{a.endereco}</p>
                        {a.status.toLowerCase() === 'fora' && (
                          <p className="mt-1 text-xs text-red-600">
                            fora desde {fmtBr(a.foraDesde)}
                            {mins != null ? ` (${mins} min)` : ''}
                          </p>
                        )}
                        {a.ultimoErro && (
                          <p className="mt-1 truncate text-xs text-muted-foreground" title={a.ultimoErro}>
                            {a.ultimoErro}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Histórico (30 dias)</h2>
              <Select value={filtroAlvo} onValueChange={setFiltroAlvo}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filtrar alvo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os alvos</SelectItem>
                  {(painel?.alvos ?? []).map((a) => (
                    <SelectItem key={a.nome} value={a.nome}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">Evento</th>
                    <th className="p-2">Alvo</th>
                    <th className="p-2">Fora (min)</th>
                    <th className="p-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        Sem eventos.
                      </td>
                    </tr>
                  ) : (
                    eventos.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{fmtBr(e.dataHora)}</td>
                        <td className="p-2">{e.evento}</td>
                        <td className="p-2">{e.alvo}</td>
                        <td className="p-2">{e.minutosFora ?? '—'}</td>
                        <td className="p-2 max-w-[280px] truncate" title={e.erro ?? ''}>
                          {e.erro ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="erros" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Dias</Label>
              <Select value={erroDias} onValueChange={setErroDias}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Módulo</Label>
              <Input className="w-36" value={erroModulo} onChange={(e) => setErroModulo(e.target.value)} placeholder="Rdv…" />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input className="w-36" value={erroUnidade} onChange={(e) => setErroUnidade(e.target.value)} placeholder="WAY CSC" />
            </div>
            <div>
              <Label>Busca</Label>
              <Input className="w-48" value={erroBusca} onChange={(e) => setErroBusca(e.target.value)} placeholder="rota ou mensagem" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={errosAgrupado} onCheckedChange={(v) => setErrosAgrupado(!!v)} />
              Agrupado
            </label>
            <Button onClick={() => void carregarErros()} disabled={carregandoErros}>
              {carregandoErros ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Filtrar'}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                {errosAgrupado ? (
                  <tr>
                    <th className="p-2">Módulo</th>
                    <th className="p-2">Rota</th>
                    <th className="p-2">Total</th>
                    <th className="p-2">Usuários</th>
                    <th className="p-2">Último</th>
                    <th className="p-2">Mensagem</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">Cód.</th>
                    <th className="p-2">Módulo</th>
                    <th className="p-2">Rota</th>
                    <th className="p-2">Usuário</th>
                    <th className="p-2">Mensagem</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {carregandoErros ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : errosAgrupado ? (
                  errosGrupos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        Nenhum erro no período.
                      </td>
                    </tr>
                  ) : (
                    errosGrupos.map((g) => (
                      <tr
                        key={g.assinatura}
                        className="cursor-pointer border-t hover:bg-muted/40"
                        onClick={() => void abrirDetalheErro(g.ultimoId)}
                      >
                        <td className="p-2">{g.modulo || '—'}</td>
                        <td className="p-2 max-w-[200px] truncate" title={g.rota ?? ''}>
                          {g.rota || '—'}
                        </td>
                        <td className="p-2">{g.total}</td>
                        <td className="p-2">{g.usuariosDistintos}</td>
                        <td className="p-2 whitespace-nowrap">{fmtBr(g.ultimo)}</td>
                        <td className="p-2 max-w-[240px] truncate" title={g.mensagemUsuario ?? ''}>
                          {g.mensagemUsuario || '—'}
                        </td>
                      </tr>
                    ))
                  )
                ) : errosLista.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      Nenhum erro no período.
                    </td>
                  </tr>
                ) : (
                  errosLista.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => void abrirDetalheErro(e.id)}
                    >
                      <td className="p-2 whitespace-nowrap">{fmtBr(e.dataHora)}</td>
                      <td className="p-2">{e.id}</td>
                      <td className="p-2">{e.modulo || '—'}</td>
                      <td className="p-2 max-w-[200px] truncate" title={`${e.metodo} ${e.rota}`}>
                        {e.metodo} {e.rota}
                      </td>
                      <td className="p-2">
                        {e.unidade || '—'} / {e.codUsuario || '—'}
                      </td>
                      <td className="p-2 max-w-[240px] truncate" title={e.mensagemUsuario ?? ''}>
                        {e.mensagemUsuario || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="destinatarios" className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Alertas desta lista: queda/volta de RM SOAP, bancos SQL e PlugSign (se ligado), e erros de
            sistema (se marcado). Queda do próprio PaperSign fica com o vigia externo — lista separada,
            fora desta tela.
          </div>
          <div className="flex justify-end">
            <Button onClick={abrirNovo}>
              <Mail className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Nome</th>
                  <th className="p-2">E-mail</th>
                  <th className="p-2">Unidade</th>
                  <th className="p-2">Queda</th>
                  <th className="p-2">Volta</th>
                  <th className="p-2">Erros</th>
                  <th className="p-2">Alvos</th>
                  <th className="p-2">Ativo</th>
                  <th className="p-2">Alterado</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {destinatarios.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{d.nome}</td>
                    <td className="p-2">{d.email}</td>
                    <td className="p-2">{d.unidade}</td>
                    <td className="p-2">{d.recebeQueda ? 'Sim' : 'Não'}</td>
                    <td className="p-2">{d.recebeVolta ? 'Sim' : 'Não'}</td>
                    <td className="p-2">{d.recebeErroSistema !== false ? 'Sim' : 'Não'}</td>
                    <td className="p-2 max-w-[180px] truncate" title={d.alvos ?? 'todos'}>
                      {d.alvos || 'todos'}
                    </td>
                    <td className="p-2">{d.ativo ? 'Sim' : 'Não'}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {d.recModifiedBy || d.recCreatedBy || '—'}
                      <br />
                      {fmtBr(d.recModifiedOn || d.recCreatedOn)}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(d)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void onTeste(d)}>
                        Teste
                      </Button>
                      {d.ativo && (
                        <Button variant="ghost" size="sm" onClick={() => void onDesativar(d)}>
                          Desativar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!erroDetalhe} onOpenChange={(o) => !o && setErroDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Erro #{erroDetalhe?.id}</DialogTitle>
          </DialogHeader>
          {erroDetalhe && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Quando:</span> {fmtBr(erroDetalhe.dataHora)}
              </p>
              <p>
                <span className="text-muted-foreground">Rota:</span> {erroDetalhe.metodo} {erroDetalhe.rota}
              </p>
              <p>
                <span className="text-muted-foreground">Usuário:</span> {erroDetalhe.unidade || '—'} /{' '}
                {erroDetalhe.codUsuario || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">HTTP:</span> {erroDetalhe.statusHttp}
              </p>
              <p>
                <span className="text-muted-foreground">Mensagem (usuário):</span> {erroDetalhe.mensagemUsuario || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span> {erroDetalhe.tipoExcecao || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Técnica:</span> {erroDetalhe.mensagemTecnica || '—'}
              </p>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Stack</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(erroDetalhe.stackTrace || '')
                      toast.success('Stack copiada.')
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copiar
                  </Button>
                </div>
                <pre className="max-h-64 overflow-auto rounded border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                  {erroDetalhe.stackTrace || '—'}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar destinatário' : 'Adicionar destinatário'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {editando ? (
              <div className="rounded border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{editando.nome}</p>
                <p className="text-muted-foreground">{editando.email}</p>
                <p className="text-xs text-muted-foreground">
                  {editando.unidade} · {editando.codUsuario}
                </p>
              </div>
            ) : (
              <div>
                <Label>Usuário PaperSign</Label>
                <Input
                  placeholder="Buscar por nome, login ou e-mail (mín. 3 letras)"
                  value={buscaUser}
                  onChange={(e) => {
                    setBuscaUser(e.target.value)
                    setUsuarioSel(null)
                  }}
                />
                {buscandoUser && <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>}
                {usuarioSel && (
                  <p className="mt-2 rounded border bg-emerald-50 p-2 text-sm">
                    {usuarioSel.nome} · {usuarioSel.unidade} · {usuarioSel.email}
                  </p>
                )}
                {!usuarioSel && sugestoes.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded border">
                    {sugestoes.map((u) => (
                      <li key={`${u.unidade}|${u.codUsuario}`}>
                        <button
                          type="button"
                          className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setUsuarioSel(u)
                            setBuscaUser(`${u.nome} (${u.unidade})`)
                            setSugestoes([])
                          }}
                        >
                          <span className="font-medium">{u.nome}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            · {u.unidade} · {u.email || 'sem e-mail'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={recebeQueda} onCheckedChange={(v) => setRecebeQueda(!!v)} />
                Recebe queda
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={recebeVolta} onCheckedChange={(v) => setRecebeVolta(!!v)} />
                Recebe volta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={recebeErroSistema} onCheckedChange={(v) => setRecebeErroSistema(!!v)} />
                Erros do sistema
              </label>
              {editando && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} />
                  Ativo
                </label>
              )}
            </div>
            <div>
              <Label>Alvos (vazio = todos)</Label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                {nomesAlvos.map((n) => {
                  const checked = alvosSel.includes(n)
                  return (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setAlvosSel((prev) => (v ? [...prev, n] : prev.filter((x) => x !== n)))
                        }
                      />
                      {n}
                    </label>
                  )
                })}
                {nomesAlvos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Rode &quot;Verificar agora&quot; uma vez para popular a lista de alvos.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarDest()} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResumoCard({
  titulo,
  valor,
  destaque,
  texto,
}: {
  titulo: string
  valor: string | number
  destaque?: 'ok' | 'erro'
  texto?: boolean
}) {
  const cor =
    destaque === 'ok'
      ? 'text-emerald-700'
      : destaque === 'erro'
        ? 'text-red-700'
        : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`mt-1 ${texto ? 'text-sm' : 'text-2xl font-semibold'} ${cor}`}>{valor}</p>
    </div>
  )
}
