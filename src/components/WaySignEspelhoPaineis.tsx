'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Database, Download, Loader2, Play, RefreshCw, SearchIcon, Square } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Alerta,
  baixarRelatorioCsv,
  cancelarCarga,
  dataLocal,
  EstadoCarga,
  estadoCarga,
  iniciarCarga,
  Indisponivel,
  listarAlertas,
  listarMensagensEnviadas,
  listarRelatorio,
  MensagemEnviada,
  obterPainel,
  Painel,
  RelatorioLinha,
  sincronizarStatusPlugSign,
} from '@/services/waySignService'

function AvisoIndisponivel({ motivo }: { motivo: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        <Database className="h-5 w-5 shrink-0" />
        {motivo}
      </CardContent>
    </Card>
  )
}

function Paginacao({ page, lastPage, total, rotulo, carregando, onPage }: {
  page: number; lastPage: number; total: number; rotulo: string; carregando: boolean; onPage: (p: number) => void
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <Button size="sm" variant="outline" disabled={carregando || page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
      <span>Página {page} de {lastPage} · {total} {rotulo}</span>
      <Button size="sm" variant="outline" disabled={carregando || page >= lastPage} onClick={() => onPage(page + 1)}>Próxima</Button>
    </div>
  )
}

// ---------------------------------------------------------------- Painel

function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: React.ReactNode; detalhe?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-2xl font-bold">{valor}</p>
        {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
      </CardContent>
    </Card>
  )
}

export function WaySignPainel() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState<Painel | Indisponivel | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function carregar(d = dias) {
    setCarregando(true)
    try {
      setDados(await obterPainel(d))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar o painel.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar(30)
  }, [])

  if (dados && !dados.disponivel) return <AvisoIndisponivel motivo={dados.motivo} />
  if (!dados) return <Loader2 className="h-5 w-5 animate-spin" />

  const max = Math.max(1, ...dados.porDia.map((d) => d.documentos))
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Resumo dos documentos e assinaturas da PlugSign que você pode ver.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cartao titulo="Documentos deste mês" valor={dados.documentos.mes} />
        <Cartao titulo="Total de documentos" valor={dados.documentos.total} detalhe={`${dados.documentos.pastas} pasta(s)`} />
        <Cartao titulo="Parcialmente assinados" valor={dados.documentos.parciais} />
        <Cartao titulo="Não enviados" valor={dados.documentos.naoEnviados} />
        <Cartao titulo="Solicitações concluídas" valor={dados.solicitacoes.concluidas} detalhe={`${dados.solicitacoes.assinadasMes} assinatura(s) este mês`} />
        <Cartao titulo="Solicitações pendentes" valor={dados.solicitacoes.pendentes} />
        <Cartao titulo="Recusadas / canceladas" valor={dados.solicitacoes.recusadasCanceladas} />
        <Cartao titulo="% pendente" valor={`${dados.percentualPendente.toLocaleString('pt-BR')}%`} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Documentos enviados por dia</CardTitle>
          <div className="flex gap-1">
            {[7, 15, 30].map((d) => (
              <Button key={d} size="sm" variant={dias === d ? 'default' : 'outline'} disabled={carregando}
                onClick={() => { setDias(d); void carregar(d) }}>
                {d} dias
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {dados.porDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento no período.</p>
          ) : (
            <div className="flex h-40 items-end gap-1" role="img" aria-label="Documentos enviados por dia">
              {dados.porDia.map((d) => (
                <div key={d.dia} className="flex flex-1 flex-col items-center justify-end" title={`${d.dia}: ${d.documentos}`}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(d.documentos / max) * 100}%`, minHeight: 2 }} />
                  <span className="mt-1 text-[9px] text-muted-foreground">{d.dia.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Relatório

const STATUS_RELATORIO = ['Não enviado', 'Pendente', 'Parcialmente assinado', 'Assinado', 'Recusado', 'Cancelado']

export function WaySignRelatorio() {
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState('')
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<{ data: RelatorioLinha[]; total: number; lastPage: number } | Indisponivel | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const filtro = { texto, status, dataIni, dataFim }

  async function carregar(p = 1) {
    setCarregando(true)
    try {
      const r = await listarRelatorio({ ...filtro, page: p, pageSize: 20 })
      setRes(r.disponivel ? { data: r.data, total: r.total, lastPage: r.lastPage } : r)
      setPage(p)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar o relatório.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar(1)
  }, [])

  async function exportar() {
    setExportando(true)
    try {
      const blob = await baixarRelatorioCsv(filtro)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-waysign-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar.')
    } finally {
      setExportando(false)
    }
  }

  if (res && 'disponivel' in res && !res.disponivel) return <AvisoIndisponivel motivo={res.motivo} />

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Relatório de documentos</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada documento da PlugSign com quantas assinaturas já foram feitas e quantas faltam. Dá para exportar para o Excel.
            </p>
          </div>
          <Button variant="outline" onClick={exportar} disabled={exportando}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar (Excel)
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-56" placeholder="Documento ou chave" value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void carregar(1)} />
          <select aria-label="Status" className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUS_RELATORIO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Input className="w-40" type="date" aria-label="Enviado de" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          <Input className="w-40" type="date" aria-label="Enviado até" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          <Button onClick={() => void carregar(1)} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />} Buscar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Enviado em</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3">Pasta</th>
                <th className="py-2 pr-3">Enviado por</th>
                <th className="py-2 pr-3 text-right">Concluídas</th>
                <th className="py-2 pr-3 text-right">Pendentes</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {res && 'data' in res && res.data.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum documento.</td></tr>
              )}
              {res && 'data' in res && res.data.map((l) => (
                <tr key={l.documentKey} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataLocal(l.enviadoEm)}</td>
                  <td className="py-2 pr-3">
                    <span className="block">{l.nome || l.documentKey}</span>
                    {l.remetente ? <span className="block text-xs text-muted-foreground">{l.remetente}</span> : null}
                  </td>
                  <td className="py-2 pr-3">{l.pasta ? <Badge variant="outline">{l.pasta}</Badge> : '—'}</td>
                  <td className="py-2 pr-3">{l.enviadoPor || '—'}</td>
                  <td className="py-2 pr-3 text-right">{l.concluidas}</td>
                  <td className="py-2 pr-3 text-right">{l.pendentes}</td>
                  <td className="py-2">
                    <Badge variant={l.status === 'Assinado' ? 'default' : l.status === 'Recusado' || l.status === 'Cancelado' ? 'destructive' : 'secondary'}>
                      {l.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {res && 'data' in res && (
          <Paginacao page={page} lastPage={res.lastPage} total={res.total} rotulo="documento(s)" carregando={carregando} onPage={(p) => void carregar(p)} />
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- Mensagens enviadas

export function WaySignMensagens() {
  const [canal, setCanal] = useState<'email' | 'whatsapp'>('email')
  const [texto, setTexto] = useState('')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<{ data: MensagemEnviada[]; total: number; lastPage: number } | Indisponivel | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function carregar(p = 1, c = canal) {
    setCarregando(true)
    try {
      const r = await listarMensagensEnviadas({ canal: c, page: p, pageSize: 20, texto })
      setRes(r.disponivel ? { data: r.data, total: r.total, lastPage: r.lastPage } : r)
      setPage(p)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar as mensagens.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar(1, 'email')
  }, [])

  if (res && 'disponivel' in res && !res.disponivel) return <AvisoIndisponivel motivo={res.motivo} />

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="text-lg">Mensagens enviadas</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada e-mail ou WhatsApp que a PlugSign mandou pedindo assinatura, e se a pessoa recebeu, abriu ou clicou.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['email', 'whatsapp'] as const).map((c) => (
            <Button key={c} size="sm" variant={canal === c ? 'default' : 'outline'}
              onClick={() => { setCanal(c); void carregar(1, c) }}>
              {c === 'email' ? 'E-mail' : 'WhatsApp'}
            </Button>
          ))}
          <Input className="w-56" placeholder="Documento ou destinatário" value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void carregar(1)} />
          <Button size="sm" variant="outline" onClick={() => void carregar(1)} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Data do envio</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3">{canal === 'email' ? 'E-mail' : 'Telefone'}</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Última atualização</th>
              </tr>
            </thead>
            <tbody>
              {res && 'data' in res && res.data.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma mensagem.</td></tr>
              )}
              {res && 'data' in res && res.data.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{dataLocal(m.enviadaEm)}</td>
                  <td className="py-2 pr-3">{m.documento || m.documentKey || '—'}</td>
                  <td className="py-2 pr-3">{m.destino || '—'}</td>
                  <td className="py-2 pr-3"><Badge variant="outline">{m.status || '—'}</Badge></td>
                  <td className="py-2 whitespace-nowrap">{dataLocal(m.atualizadaEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {res && 'data' in res && (
          <Paginacao page={page} lastPage={res.lastPage} total={res.total} rotulo="mensagem(ns)" carregando={carregando} onPage={(p) => void carregar(p)} />
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- Alertas (sininho)

export function WaySignAlertasBotao({ onAbrirDocumento }: { onAbrirDocumento?: (documentKey: string) => void }) {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    listarAlertas()
      .then((r) => {
        if (r.disponivel) setAlertas(r.data)
        else setIndisponivel(true)
      })
      .catch(() => setIndisponivel(true))
  }, [])

  if (indisponivel) return null
  const importantes = (alertas ?? []).filter((a) => a.importante).length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative" aria-label="Alertas do WaySign">
          <Bell className="h-4 w-4" />
          {importantes > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
              {importantes}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-h-[60vh] overflow-y-auto p-0">
        <p className="border-b px-3 py-2 text-sm font-semibold">Alertas</p>
        {alertas == null ? (
          <Loader2 className="m-3 h-4 w-4 animate-spin" />
        ) : alertas.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum alerta.</p>
        ) : (
          <ul className="divide-y">
            {alertas.map((a, i) => (
              <li key={`${a.documentKey}-${a.tipo}-${i}`}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted"
                  onClick={() => onAbrirDocumento?.(a.documentKey)}>
                  <p className="text-sm">
                    {a.importante && <Badge className="mr-1 bg-amber-500 text-white">Importante!</Badge>}
                    {a.texto}
                  </p>
                  <p className="text-xs text-muted-foreground">{dataLocal(a.quando)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------- Carga (Admin)

export function WaySignCargaSecao() {
  const [estado, setEstado] = useState<EstadoCarga | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function atualizar() {
    try {
      setEstado(await estadoCarga())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao ler a carga.')
    }
  }

  useEffect(() => {
    void atualizar()
  }, [])

  useEffect(() => {
    if (estado?.situacao !== 'RODANDO') return
    const t = setInterval(() => void atualizar(), 5000)
    return () => clearInterval(t)
  }, [estado?.situacao])

  async function iniciar(modo: 'dry-run' | 'gravar') {
    const agora = new Date().getHours()
    const foraJanela = agora >= 6 && agora < 20
    if (foraJanela && !window.confirm('Fora do horário da carga (20h às 6h). Rodar agora mesmo assim? Os usuários continuam com prioridade.')) return
    setOcupado(true)
    try {
      setEstado(await iniciarCarga(modo, foraJanela))
      toast.success(modo === 'gravar' ? 'Cópia iniciada.' : 'Contagem iniciada.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao iniciar.')
    } finally {
      setOcupado(false)
    }
  }

  async function parar() {
    try {
      setEstado(await cancelarCarga())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao cancelar.')
    }
  }

  const rodando = estado?.situacao === 'RODANDO'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Cópia dos dados da PlugSign</CardTitle>
        <Button size="sm" variant="outline" onClick={() => void atualizar()}><RefreshCw className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Alimenta Relatório, Painel, Mensagens e Alertas. &quot;Só contar&quot; não grava nada; &quot;Copiar&quot; grava
          (precisa do 01-ddl-espelho.sql). Pode rodar de novo quando quiser: só atualiza.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={ocupado || rodando} onClick={() => iniciar('dry-run')}>
            <Play className="h-4 w-4" /> Só contar
          </Button>
          <Button disabled={ocupado || rodando} onClick={() => iniciar('gravar')}>
            <Database className="h-4 w-4" /> Copiar agora
          </Button>
          {rodando && (
            <Button variant="destructive" onClick={parar}><Square className="h-4 w-4" /> Parar</Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                toast.success((await sincronizarStatusPlugSign()).message)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Falha ao atualizar.')
              }
            }}
          >
            <RefreshCw className="h-4 w-4" /> Atualizar status da PlugSign
          </Button>
        </div>
        {estado && (
          <div className="space-y-1 rounded-md border p-3 text-xs">
            <p>
              <strong>{estado.situacao}</strong> {estado.modo ? `(${estado.modo})` : ''} {estado.iniciadoPor ? `· ${estado.iniciadoPor}` : ''}
            </p>
            {estado.recurso && <p>Etapa: {estado.recurso} · página {estado.pagina} de {estado.ultimaPagina || '?'}</p>}
            {estado.inicioUtc && <p>Início: {dataLocal(estado.inicioUtc)} {estado.fimUtc ? `· Fim: ${dataLocal(estado.fimUtc)}` : ''}</p>}
            {estado.solicitacoes && <p>Solicitações: {estado.solicitacoes.total} · por unidade: {JSON.stringify(estado.solicitacoes.porUnidade)}</p>}
            {estado.documentos && <p>Documentos: {estado.documentos.total} · por unidade: {JSON.stringify(estado.documentos.porUnidade)}</p>}
            {estado.erro && <p className="text-destructive">{estado.erro}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
