'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, CircleDollarSign, Loader2, Play, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatMoney,
  cancelarPendentes,
  getConsultaCsc,
  getPendentes,
  getUnidadesReceitas,
  getHistoricoReceitas,
  getConferenciaReceitas,
  getResumoPorPracaReceitas,
  labelProblemaConferencia,
  processarLote,
  uploadPlanilha,
  type ReceitasConferenciaProblema,
  type ReceitasConferenciaResultado,
  type ReceitasLoteResultado,
  type ReceitasResumoPracaDiaItem,
  type ReceitasPendentesGrupo,
  type ReceitasPendentesResumo,
  type ReceitasUnidadeInfo,
  type ReceitasUnidadesResponse,
  type ReceitasHistoricoItem,
} from '@/services/receitasService'

function isoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function periodoConferenciaPadrao(): { ini: string; fim: string } {
  const hoje = new Date()
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return { ini: isoDateLocal(ini), fim: isoDateLocal(hoje) }
}

function resumoProblemasConferencia(problemas: ReceitasConferenciaProblema[]) {
  const pracas = new Set(problemas.map((p) => p.praca))
  const dias = new Set(problemas.map((p) => String(p.dia).slice(0, 10)))
  const porTipo = {
    diaNaoRecebido: problemas.filter((p) => p.problema === 'DIA_NAO_RECEBIDO').length,
    diaIncompleto: problemas.filter((p) => p.problema === 'DIA_INCOMPLETO').length,
    linhaDuplicada: problemas.filter((p) => p.problema === 'LINHA_DUPLICADA').length,
    semDePara: problemas.filter((p) => p.problema === 'SEM_DEPARA').length,
  }
  const criticos = problemas.filter(
    (p) => p.problema === 'DIA_NAO_RECEBIDO' || p.problema === 'DIA_INCOMPLETO'
  )
  const vistos = new Set<string>()
  const destaques: ReceitasConferenciaProblema[] = []
  for (const p of criticos) {
    const chave = `${p.praca}|${String(p.dia).slice(0, 10)}|${p.problema}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    destaques.push(p)
    if (destaques.length >= 8) break
  }
  return {
    qtdPracas: pracas.size,
    qtdDias: dias.size,
    total: problemas.length,
    porTipo,
    destaques,
    restantes: Math.max(0, criticos.length - destaques.length),
  }
}

function formatDataCurta(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
  return d.toLocaleDateString('pt-BR')
}

function ResumoCards({ data }: { data: ReceitasPendentesResumo }) {
  if (data.erro) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {data.erro}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Pendentes</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{data.totalPendente}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Com valor</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{data.totalComValor}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Valor zero</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{data.totalValorZero}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">Valor pendente</CardTitle>
        </CardHeader>
        <CardContent className="text-xl font-semibold text-emerald-800">
          {formatMoney(data.valorTotalPendente)}
        </CardContent>
      </Card>
    </div>
  )
}

function TabelaGrupos({ data }: { data: ReceitasPendentesResumo }) {
  const colunas = useMemo<ColumnDef<ReceitasPendentesGrupo>[]>(
    () => [
      { accessorKey: 'numPraca', header: 'Praça' },
      { accessorKey: 'tipoArrecadacao', header: 'Tipo' },
      { accessorKey: 'quantidade', header: 'Qtd' },
      {
        accessorKey: 'valorTotal',
        header: 'Valor',
        cell: ({ row }) => formatMoney(row.original.valorTotal),
      },
      {
        id: 'periodo',
        header: 'Período',
        accessorFn: (row) =>
          `${formatDataCurta(row.primeiraData)} → ${formatDataCurta(row.ultimaData)}`,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{String(getValue() ?? '')}</span>
        ),
      },
    ],
    []
  )

  if (data.erro || !data.porPracaTipo?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.erro ? null : 'Nenhum pendente.'}
      </p>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <DataTable
          columns={colunas}
          data={data.porPracaTipo}
          globalFilterAccessorKey={['numPraca', 'tipoArrecadacao']}
          searchPlaceholder="Buscar praça ou tipo…"
        />
      </CardContent>
    </Card>
  )
}

function formatDataHora(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR')
}

function labelTipoHistorico(tipo: ReceitasHistoricoItem['tipo']): string {
  return tipo === 'UPLOAD' ? 'Upload planilha' : 'Processamento lote'
}

function PainelCscBase({ unidade }: { unidade: ReceitasUnidadeInfo }) {
  const [loading, setLoading] = useState(false)
  const [historico, setHistorico] = useState<ReceitasHistoricoItem[]>([])

  async function carregar() {
    setLoading(true)
    try {
      setHistorico(await getHistoricoReceitas(unidade.codigo))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!unidade.emStandby) void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade.codigo, unidade.emStandby])

  if (unidade.emStandby) {
    return (
      <p className="text-sm text-amber-700 font-medium">Em breve disponível</p>
    )
  }

  const vazioMsg = unidade.permiteUpload
    ? 'Nenhum upload ou processamento registrado nesta base.'
    : 'Nenhum processamento de lote registrado nesta base.'

  return (
    <div className="space-y-4">
      <div id="tour-receitas-acoes" className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {!unidade.permiteUpload && (
        <p className="text-sm text-muted-foreground">
          Nesta base não há upload de planilha — o histórico mostra quem processou cada lote e o valor.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Usuário</th>
              <th className="px-3 py-2 font-medium text-right">Qtd</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium">Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {historico.length === 0 ? (
              <tr className="border-t">
                <td colSpan={6} className="px-3 py-3 text-muted-foreground">
                  {vazioMsg}
                </td>
              </tr>
            ) : (
              historico.map((h) => (
                <tr key={`${h.tipo}-${h.id}`} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDataHora(h.dataHora)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        h.tipo === 'UPLOAD'
                          ? 'rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800'
                          : 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800'
                      }
                    >
                      {labelTipoHistorico(h.tipo)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{h.usuario || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{h.qtdeLinhas}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatMoney(h.valorTotal)}
                    {h.tipo === 'PROCESSAMENTO' && h.valorFlan != null && h.valorFlan !== h.valorTotal && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        FLAN: {formatMoney(h.valorFlan)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                    {h.nomeArquivo || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PainelUnidade({
  unidade,
  meta,
}: {
  unidade: ReceitasUnidadeInfo
  meta: ReceitasUnidadesResponse
}) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [data, setData] = useState<ReceitasPendentesResumo | null>(null)
  const [lote, setLote] = useState<ReceitasLoteResultado | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [confirmProblemasOpen, setConfirmProblemasOpen] = useState(false)
  const conferenciaIntegrador =
    unidade.conferenciaCompletude ??
    (unidade.codigo === '112' || unidade.codigo === '306')
  const padraoPeriodo = periodoConferenciaPadrao()
  const [dataIniConferencia, setDataIniConferencia] = useState(padraoPeriodo.ini)
  const [dataFimConferencia, setDataFimConferencia] = useState(padraoPeriodo.fim)
  const [conferencia, setConferencia] = useState<ReceitasConferenciaResultado | null>(null)
  const [resumoPraca, setResumoPraca] = useState<ReceitasResumoPracaDiaItem[]>([])
  const [conferenciaModalOpen, setConferenciaModalOpen] = useState(false)
  const [abaConferencia, setAbaConferencia] = useState<'problemas' | 'totais'>('problemas')

  async function carregarConferencia() {
    if (!conferenciaIntegrador) return
    try {
      const [conf, resumo] = await Promise.all([
        getConferenciaReceitas(unidade.codigo, dataIniConferencia, dataFimConferencia),
        getResumoPorPracaReceitas(unidade.codigo, dataIniConferencia, dataFimConferencia),
      ])
      setConferencia(conf)
      setResumoPraca(resumo.linhas ?? [])
    } catch (e) {
      toast.error((e as Error).message)
      setConferencia(null)
      setResumoPraca([])
    }
  }

  async function carregar() {
    setLoading(true)
    try {
      const res = await getPendentes(unidade.codigo)
      setData(res)
      if (conferenciaIntegrador) await carregarConferencia()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (meta.csc) return
    if (unidade.podeConsultar && !unidade.emStandby) void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade.codigo, unidade.emStandby, meta.csc])

  async function onFile(file: File | null) {
    if (!file) return
    setUploading(true)
    const toastId = toast.loading('Enviando… Aguarde um momento.')
    try {
      const r = await uploadPlanilha(unidade.codigo, file)
      toast.success(
        `Envio concluído. ${r.inseridos} itens · ${formatMoney(r.valorInserido)}.`,
        { id: toastId }
      )
      await carregar()
    } catch (e) {
      toast.error((e as Error).message, { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const optsConferenciaLote = conferenciaIntegrador
    ? { dataIniConferencia, dataFimConferencia }
    : undefined

  async function simularLote() {
    setProcessando(true)
    try {
      const r = await processarLote(unidade.codigo, false, optsConferenciaLote)
      setLote(r)
      if (r.conferencia) setConferencia(r.conferencia)
      setDialogOpen(true)
      if (r.conferenciaBloqueou) toast.error('Lote bloqueado por problemas na conferência de completude.')
      else if (!r.validacaoOk) toast.error('Validação do lote falhou. Veja o detalhe.')
      else if ((r.conferencia?.resumo?.qtdProblemas ?? 0) > 0)
        toast.warning('Há dias ou praças incompletos — confira antes de gravar.')
      else toast.message('Conferência OK — revise os números e confirme para gravar.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  async function confirmarLote() {
    const qtdProb = lote?.conferencia?.resumo?.qtdProblemas ?? conferencia?.resumo?.qtdProblemas ?? 0
    if (conferenciaIntegrador && qtdProb > 0 && !confirmProblemasOpen) {
      setConfirmProblemasOpen(true)
      return
    }
    setConfirmProblemasOpen(false)
    setProcessando(true)
    try {
      const r = await processarLote(unidade.codigo, true, optsConferenciaLote)
      setLote(r)
      if (r.conferencia) setConferencia(r.conferencia)
      if (r.commitEfetuado) {
        toast.success('Lote gravado com sucesso.')
        setDialogOpen(false)
        await carregar()
      } else {
        toast.error(r.mensagens?.join(' ') || 'Não foi possível gravar o lote.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  async function confirmarCancelamento() {
    setCancelando(true)
    try {
      const r = await cancelarPendentes(unidade.codigo)
      setCancelDialogOpen(false)
      if (r.excluidos === 0) {
        toast.message('Não havia pendentes para excluir.')
      } else {
        toast.success(
          `Envio cancelado. ${r.excluidos} itens removidos · ${formatMoney(r.valorExcluido)}.`
        )
      }
      await carregar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCancelando(false)
    }
  }

  if (meta.csc) {
    return <PainelCscBase unidade={unidade} />
  }

  if (unidade.emStandby) {
    return (
      <p className="text-sm text-amber-700 font-medium">Em breve disponível</p>
    )
  }

  return (
    <div className="relative space-y-4">
      {(uploading || processando || cancelando) && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 text-sm shadow-md">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
            <span>
              {uploading
                ? 'Enviando… Isso pode levar um minuto.'
                : processando
                  ? 'Processando… Aguarde.'
                  : 'Cancelando envio… Aguarde.'}
            </span>
          </div>
        </div>
      )}

      {conferenciaIntegrador && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Conferência — de</span>
            <input
              type="date"
              className="h-9 rounded-md border px-2"
              value={dataIniConferencia}
              onChange={(e) => setDataIniConferencia(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">até</span>
            <input
              type="date"
              className="h-9 rounded-md border px-2"
              value={dataFimConferencia}
              onChange={(e) => setDataFimConferencia(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void carregarConferencia()}
          >
            Atualizar conferência
          </Button>
        </div>
      )}

      {conferenciaIntegrador && (conferencia?.resumo?.qtdProblemas ?? 0) > 0 && (() => {
        const r = resumoProblemasConferencia(conferencia!.problemas)
        return (
          <div
            role="alert"
            className="rounded-lg border border-amber-500/45 bg-amber-500/[0.08] px-4 py-3 shadow-sm dark:border-amber-400/35 dark:bg-amber-950/50"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 dark:bg-amber-400/10">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold leading-tight text-amber-950 dark:text-amber-50">
                      Carga incompleta no integrador
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Período {formatDataCurta(dataIniConferencia)} a {formatDataCurta(dataFimConferencia)}
                      · {r.qtdPracas} praça(s) · {r.qtdDias} dia(s) com problema
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-foreground/90">
                  A Tecsidel pode não ter enviado todos os dias ou tipos de arrecadação (8 por praça/dia).
                  O valor processado pode divergir do{' '}
                  <span className="font-medium">Relatório de Arrecadação 2030</span>.
                </p>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {r.porTipo.diaNaoRecebido > 0 && (
                    <span className="rounded-md border border-amber-500/30 bg-background/60 px-2 py-0.5 tabular-nums">
                      {r.porTipo.diaNaoRecebido} dia(s) sem carga
                    </span>
                  )}
                  {r.porTipo.diaIncompleto > 0 && (
                    <span className="rounded-md border border-amber-500/30 bg-background/60 px-2 py-0.5 tabular-nums">
                      {r.porTipo.diaIncompleto} dia(s) incompletos
                    </span>
                  )}
                  {r.porTipo.linhaDuplicada > 0 && (
                    <span className="rounded-md border border-amber-500/30 bg-background/60 px-2 py-0.5 tabular-nums">
                      {r.porTipo.linhaDuplicada} duplicidade(s)
                    </span>
                  )}
                  {r.porTipo.semDePara > 0 && (
                    <span className="rounded-md border border-amber-500/30 bg-background/60 px-2 py-0.5 tabular-nums">
                      {r.porTipo.semDePara} sem de-para RM
                    </span>
                  )}
                </div>

                {r.destaques.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.destaques.map((p) => (
                      <span
                        key={`${p.praca}-${p.dia}-${p.problema}`}
                        className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-xs font-medium ring-1 ring-amber-500/25"
                      >
                        <span className="text-amber-800 dark:text-amber-200">{p.praca}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="tabular-nums">{formatDataCurta(p.dia)}</span>
                        <span className="text-muted-foreground font-normal">
                          — {labelProblemaConferencia(p.problema)}
                        </span>
                      </span>
                    ))}
                    {r.restantes > 0 && (
                      <button
                        type="button"
                        className="text-xs text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
                        onClick={() => setConferenciaModalOpen(true)}
                      >
                        + {r.restantes} outro(s)
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 border-amber-500/30 bg-background/80 hover:bg-background"
                onClick={() => setConferenciaModalOpen(true)}
              >
                Ver detalhes ({r.total})
              </Button>
            </div>
          </div>
        )
      })()}

      <div id="tour-receitas-acoes" className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading || uploading || processando || cancelando}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar pendentes
        </Button>

        {unidade.podeUpload && (
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              disabled={uploading || processando || cancelando}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                void onFile(f)
              }}
            />
            <Button asChild size="sm" disabled={uploading || processando || cancelando}>
              <span>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Enviando…' : 'Upload planilha'}
              </span>
            </Button>
          </label>
        )}

        {unidade.podeProcessar && (
          <Button size="sm" onClick={simularLote} disabled={processando || loading || cancelando || uploading}>
            {processando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {processando ? 'Processando…' : 'Processar lote'}
          </Button>
        )}

        {unidade.podeUpload && (data?.totalPendente ?? 0) > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
            disabled={cancelando || uploading || processando}
          >
            {cancelando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Cancelar envio
          </Button>
        )}
      </div>

      {data && (
        <>
          <ResumoCards data={data} />
          <TabelaGrupos data={data} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Fluxo — {unidade.label}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          {unidade.permiteUpload ? (
            <>
              <p>1. Conferir o valor pendente.</p>
              <p>2. Enviar a planilha, se ainda não tiver enviado.</p>
              <p>3. Processar o lote, validar e confirmar.</p>
            </>
          ) : (
            <>
              <p>1. Conferir o valor pendente.</p>
              <p>2. Processar o lote, validar e confirmar.</p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Validação do lote — {unidade.label}</DialogTitle>
            <DialogDescription>
              Esta é só a conferência. Nada é gravado até você confirmar.
            </DialogDescription>
          </DialogHeader>

          {lote && (
            <div className="space-y-2 text-sm">
              <div className={lote.validacaoOk ? 'text-emerald-700' : 'text-red-700'}>
                {lote.validacaoOk ? 'Validação OK' : 'Validação com divergência'}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                <li>Processados: {lote.totalProcessados}</li>
                <li>Com valor: {lote.totalComValor}</li>
                <li>Valor zero: {lote.totalValorZero}</li>
                <li>Valor lote: {formatMoney(lote.valorTotalProcessado)}</li>
                <li>FLAN: {lote.totalFlanGerados}</li>
                <li>Valor FLAN: {formatMoney(lote.valorTotalFlan)}</li>
                <li>Rateios: {lote.totalRateios}</li>
                <li>Complementos: {lote.totalComplementos}</li>
                <li>Sem FLAN: {lote.semFlan}</li>
                <li>IDLAN dup.: {lote.idlanDuplicados}</li>
                <li>Zero inconsistente: {lote.valorZeroInconsistente}</li>
              </ul>
              {lote.mensagens?.length > 0 && (
                <div className="rounded-md bg-muted px-3 py-2 text-xs">
                  {lote.mensagens.map((m, i) => (
                    <div key={i}>{m}</div>
                  ))}
                </div>
              )}
              {(lote.conferencia?.resumo?.qtdProblemas ?? 0) > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Conferência: {lote.conferencia!.resumo.qtdProblemas} problema(s) no período{' '}
                  {formatDataCurta(dataIniConferencia)} – {formatDataCurta(dataFimConferencia)}.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processando}>
              Fechar
            </Button>
            <Button
              onClick={confirmarLote}
              disabled={processando || !lote?.validacaoOk || lote?.conferenciaBloqueou}
            >
              {processando ? 'Gravando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conferenciaModalOpen} onOpenChange={setConferenciaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferência de completude — {unidade.label}</DialogTitle>
            <DialogDescription>
              Período {formatDataCurta(dataIniConferencia)} a {formatDataCurta(dataFimConferencia)}.
              Compare os totais com o Relatório de Arrecadação 2030 (8 tipos por praça/dia).
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b pb-2">
            <Button
              type="button"
              size="sm"
              variant={abaConferencia === 'problemas' ? 'default' : 'outline'}
              onClick={() => setAbaConferencia('problemas')}
            >
              Problemas ({conferencia?.problemas?.length ?? 0})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={abaConferencia === 'totais' ? 'default' : 'outline'}
              onClick={() => setAbaConferencia('totais')}
            >
              Total por praça e dia
            </Button>
          </div>

          {abaConferencia === 'problemas' ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-2 py-2">Praça</th>
                    <th className="px-2 py-2">Dia</th>
                    <th className="px-2 py-2">Problema</th>
                    <th className="px-2 py-2">Tipos recebidos</th>
                    <th className="px-2 py-2 text-right">Linhas</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(conferencia?.problemas?.length ?? 0) === 0 ? (
                    <tr className="border-t">
                      <td colSpan={6} className="px-2 py-3 text-muted-foreground">
                        Nenhum problema no período.
                      </td>
                    </tr>
                  ) : (
                    conferencia!.problemas.map((p, i) => (
                      <tr key={`${p.praca}-${p.dia}-${p.problema}-${i}`} className="border-t">
                        <td className="px-2 py-1.5 font-medium">{p.praca}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{formatDataCurta(p.dia)}</td>
                        <td className="px-2 py-1.5">
                          {labelProblemaConferencia(p.problema)}
                          {p.tipoArrecadacao ? ` (${p.tipoArrecadacao})` : ''}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.tiposRecebidos || '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{p.linhas}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(p.valor)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-2 py-2">Praça</th>
                    <th className="px-2 py-2">Dia</th>
                    <th className="px-2 py-2 text-right">10</th>
                    <th className="px-2 py-2 text-right">13</th>
                    <th className="px-2 py-2 text-right">8</th>
                    <th className="px-2 py-2 text-right">2</th>
                    <th className="px-2 py-2 text-right">6</th>
                    <th className="px-2 py-2 text-right">7</th>
                    <th className="px-2 py-2 text-right">14</th>
                    <th className="px-2 py-2 text-right">15</th>
                    <th className="px-2 py-2 text-right font-semibold">TOTAL</th>
                    <th className="px-2 py-2 text-right">Tipos</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoPraca.length === 0 ? (
                    <tr className="border-t">
                      <td colSpan={12} className="px-2 py-3 text-muted-foreground">
                        Sem linhas no período.
                      </td>
                    </tr>
                  ) : (
                    resumoPraca.map((r) => (
                      <tr key={`${r.praca}-${r.dia}`} className="border-t">
                        <td className="px-2 py-1 font-medium">{r.praca}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{formatDataCurta(r.dia)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo10)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo13)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo8)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo2)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo6)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo7)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo14)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatMoney(r.tipo15)}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold">
                          {formatMoney(r.total)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.qtdTiposDistintos}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {conferencia?.resumo && (
            <p className="text-xs text-muted-foreground">
              Período: {formatMoney(conferencia.resumo.totalPeriodo)} · Pendente:{' '}
              {formatMoney(conferencia.resumo.totalPendente)} · Integrado:{' '}
              {formatMoney(conferencia.resumo.totalIntegrado)}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmProblemasOpen} onOpenChange={setConfirmProblemasOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conferência incompleta</DialogTitle>
            <DialogDescription>
              Ainda há praças ou dias faltando no integrador. Gravar o lote assim pode divergir do
              Relatório 2030.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 overflow-y-auto text-sm list-disc pl-5 space-y-1">
            {(lote?.conferencia?.problemas ?? conferencia?.problemas ?? [])
              .filter((p) => p.problema === 'DIA_NAO_RECEBIDO' || p.problema === 'DIA_INCOMPLETO')
              .slice(0, 20)
              .map((p, i) => (
                <li key={`${p.praca}-${p.dia}-${i}`}>
                  {p.praca} · {formatDataCurta(p.dia)} · {labelProblemaConferencia(p.problema)}
                </li>
              ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmProblemasOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => void confirmarLote()}>
              Gravar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar envio — {unidade.label}</DialogTitle>
            <DialogDescription>
              Isso apaga o que ainda não foi processado nesta base
              {data ? ` (${data.totalPendente} itens · ${formatMoney(data.valorTotalPendente)})` : ''}
              . Use se o envio foi só um teste.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelando}
            >
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmarCancelamento} disabled={cancelando}>
              {cancelando ? 'Cancelando…' : 'Excluir pendentes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PainelConsulta({
  csc,
  unidades,
}: {
  csc: boolean
  unidades: ReceitasUnidadeInfo[]
}) {
  const [loading, setLoading] = useState(false)
  const [lista, setLista] = useState<ReceitasPendentesResumo[]>([])

  async function carregar() {
    setLoading(true)
    try {
      if (csc) {
        setLista(await getConsultaCsc())
      } else {
        const rows = await Promise.all(unidades.map((u) => getPendentes(u.codigo)))
        setLista(rows)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csc, unidades.map((u) => u.codigo).join(',')])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar consulta
        </Button>
        <span className="text-xs text-muted-foreground">
          {csc
            ? 'Visão consolidada: pendências de todas as unidades.'
            : 'Consulta da sua unidade: pendências e valores.'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Unidade</th>
              <th className="px-3 py-2 font-medium">Pendentes</th>
              <th className="px-3 py-2 font-medium">Com valor</th>
              <th className="px-3 py-2 font-medium">Valor pendente</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.codigo} className="border-t">
                <td className="px-3 py-2 font-medium">{u.label}</td>
                <td className="px-3 py-2">{u.erro ? '—' : u.totalPendente}</td>
                <td className="px-3 py-2">{u.erro ? '—' : u.totalComValor}</td>
                <td className="px-3 py-2">
                  {u.erro ? '—' : formatMoney(u.valorTotalPendente)}
                </td>
                <td className="px-3 py-2">
                  {u.emStandby ? (
                    <span className="text-amber-700">Em breve disponível</span>
                  ) : u.erro ? (
                    <span className="text-red-600">Erro: {u.erro}</span>
                  ) : u.totalPendente > 0 ? (
                    <span className="text-amber-700">Há pendências</span>
                  ) : (
                    <span className="text-emerald-700">Sem pendente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReceitasPage() {
  const [meta, setMeta] = useState<ReceitasUnidadesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('consulta')

  useEffect(() => {
    ;(async () => {
      try {
        const m = await getUnidadesReceitas()
        setMeta(m)
        setTab('consulta')
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const unidadesVisiveis = useMemo(() => {
    const lista = (meta?.unidades ?? []).filter((u) => u.podeConsultar)
    // Só CSC vê todas. Unidade (mesmo admin) só a própria base.
    if (!meta || meta.csc) return lista
    const login = (meta.unidadeLogin || '').toUpperCase()
    return lista.filter(
      (u) =>
        login.includes(String(u.codigo).toUpperCase()) ||
        login === String(u.label || '').toUpperCase()
    )
  }, [meta])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando Receitas…</div>
  }

  if (!meta) {
    return <div className="text-sm text-red-600">Não foi possível carregar o módulo.</div>
  }

  return (
    <div className="space-y-4">
      <div id="tour-receitas-titulo" className="flex items-center gap-3">
        <CircleDollarSign className="h-7 w-7 text-emerald-700" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receitas</h1>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList id="tour-receitas-abas" className="flex h-auto flex-wrap">
          <TabsTrigger id="tour-receitas-consulta" value="consulta">
            Consulta
          </TabsTrigger>
          {unidadesVisiveis.map((u, idx) => (
            <TabsTrigger
              key={u.codigo}
              id={idx === 0 ? 'tour-receitas-unidade' : undefined}
              value={u.codigo}
            >
              {u.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="consulta" className="mt-4">
          <PainelConsulta csc={meta.csc} unidades={unidadesVisiveis} />
        </TabsContent>

        {unidadesVisiveis.map((u) => (
          <TabsContent key={u.codigo} value={u.codigo} className="mt-4">
            <PainelUnidade unidade={u} meta={meta} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
