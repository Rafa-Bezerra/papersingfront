'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ColumnDef } from '@tanstack/react-table'
import { CircleDollarSign, Loader2, Play, RefreshCw, Trash2, Upload } from 'lucide-react'
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
  getUploadsReceitas,
  processarLote,
  uploadPlanilha,
  type ReceitasLoteResultado,
  type ReceitasPendentesGrupo,
  type ReceitasPendentesResumo,
  type ReceitasUnidadeInfo,
  type ReceitasUnidadesResponse,
  type ReceitasUploadLogItem,
} from '@/services/receitasService'

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

function PainelCscBase({ unidade }: { unidade: ReceitasUnidadeInfo }) {
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<ReceitasUploadLogItem[]>([])

  async function carregar() {
    setLoading(true)
    try {
      setUploads(await getUploadsReceitas(unidade.codigo))
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
          Nesta base o envio de planilha não é usado.
        </p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Usuário</th>
            </tr>
          </thead>
          <tbody>
            {uploads.length === 0 ? (
              <tr className="border-t">
                <td colSpan={2} className="px-3 py-3 text-muted-foreground">
                  Nenhum upload registrado nesta base.
                </td>
              </tr>
            ) : (
              uploads.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{formatDataHora(u.dataUpload)}</td>
                  <td className="px-3 py-2 font-medium">{u.usuario}</td>
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

  async function carregar() {
    setLoading(true)
    try {
      const res = await getPendentes(unidade.codigo)
      setData(res)
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

  async function simularLote() {
    setProcessando(true)
    try {
      const r = await processarLote(unidade.codigo, false)
      setLote(r)
      setDialogOpen(true)
      if (!r.validacaoOk) toast.error('Validação do lote falhou. Veja o detalhe.')
      else toast.message('Conferência OK — revise os números e confirme para gravar.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setProcessando(false)
    }
  }

  async function confirmarLote() {
    setProcessando(true)
    try {
      const r = await processarLote(unidade.codigo, true)
      setLote(r)
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
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processando}>
              Fechar
            </Button>
            <Button
              onClick={confirmarLote}
              disabled={processando || !lote?.validacaoOk}
            >
              {processando ? 'Gravando…' : 'Confirmar'}
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
