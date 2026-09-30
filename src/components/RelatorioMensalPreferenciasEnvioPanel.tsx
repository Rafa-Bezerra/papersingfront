'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Download, FileText, Mail, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  enviarReferenciaRelatorioMensal,
  excluirReferenciaRelatorioMensal,
  listarReferenciasRelatorioMensal,
  type RelatorioMensalRef,
} from '@/services/relatorioMensalSetorService'
import { labelMesReferencia, mesReferenciaAtual } from '@/lib/usuarioPermissoesRelatorio'
import { montarPdfRelatorioMensalDeReferencia } from '@/lib/relatorioMensalSetorPdfFromRef'
import { pdfParaBase64, salvarPdf } from '@/lib/usuarioPermissoesRelatorioPdf'

export default function RelatorioMensalPreferenciasEnvioPanel() {
  const router = useRouter()
  const [mesCalendario, setMesCalendario] = useState(() => mesReferenciaAtual())
  const [usarOutroMes, setUsarOutroMes] = useState(false)
  const [mesManual, setMesManual] = useState(mesReferenciaAtual)
  const [referencias, setReferencias] = useState<RelatorioMensalRef[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [apiIndisponivel, setApiIndisponivel] = useState(false)
  const [loadingAcaoId, setLoadingAcaoId] = useState<number | null>(null)
  const [loadingTipo, setLoadingTipo] = useState<'email' | 'pdf' | null>(null)

  const mesAcao = usarOutroMes ? mesManual : mesCalendario
  const labelMesAcao = useMemo(() => labelMesReferencia(mesAcao), [mesAcao])

  useEffect(() => {
    const atualizar = () => setMesCalendario(mesReferenciaAtual())
    atualizar()
    const timer = window.setInterval(atualizar, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') atualizar()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const carregarReferencias = useCallback(async () => {
    setLoadingRefs(true)
    setApiIndisponivel(false)
    try {
      setReferencias(await listarReferenciasRelatorioMensal())
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('404')) {
        setApiIndisponivel(true)
        setReferencias([])
      } else {
        toast.error(msg)
        setReferencias([])
      }
    } finally {
      setLoadingRefs(false)
    }
  }, [])

  useEffect(() => {
    void carregarReferencias()
  }, [carregarReferencias])

  function abrirNoRelatorio(ref: RelatorioMensalRef) {
    router.replace(`?tab=relatorio-mensal&pref=${ref.id}`, { scroll: false })
    toast.message(`Abrindo “${ref.titulo}” no relatório mensal.`)
  }

  async function enviarReferenciaSalva(ref: RelatorioMensalRef) {
    setLoadingAcaoId(ref.id)
    setLoadingTipo('email')
    try {
      const built = await montarPdfRelatorioMensalDeReferencia(ref, mesAcao)
      const pdfBase64 = pdfParaBase64(built.doc)
      const para = await enviarReferenciaRelatorioMensal(ref.id, built.mesRef, pdfBase64)
      toast.success(`Enviado (${labelMesReferencia(built.mesRef)}) para ${para.join(', ')}`)
      await carregarReferencias()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingAcaoId(null)
      setLoadingTipo(null)
    }
  }

  async function baixarReferencia(ref: RelatorioMensalRef) {
    setLoadingAcaoId(ref.id)
    setLoadingTipo('pdf')
    try {
      const built = await montarPdfRelatorioMensalDeReferencia(ref, mesAcao)
      salvarPdf(built.doc, built.nomeArquivo)
      toast.success(`PDF baixado (${labelMesReferencia(built.mesRef)}).`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingAcaoId(null)
      setLoadingTipo(null)
    }
  }

  async function removerReferencia(id: number) {
    try {
      await excluirReferenciaRelatorioMensal(id)
      toast.success('Preferência removida.')
      await carregarReferencias()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const ocupado = loadingAcaoId !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bookmark className="h-5 w-5 text-primary" />
          Modelos salvos
        </CardTitle>
        <CardDescription>
          Baixar e enviar agora usam o <strong>mês calendário atual</strong> ({labelMesReferencia(mesCalendario)}), no
          mesmo layout dos relatórios do PaperSign (cabeçalho, cards por base e assinatura). Use &quot;Abrir no
          relatório&quot; para ajustar colaboradores antes de salvar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-2">
          <p>
            <span className="text-muted-foreground">Mês vigente para ações:</span>{' '}
            <strong>{labelMesAcao}</strong>
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="usarOutroMes"
              checked={usarOutroMes}
              onCheckedChange={v => setUsarOutroMes(v === true)}
            />
            <Label htmlFor="usarOutroMes" className="font-normal text-xs">
              Usar outro mês (somente baixar / enviar agora)
            </Label>
          </div>
          {usarOutroMes && (
            <div className="flex flex-col gap-1 max-w-xs pt-1">
              <Label htmlFor="prefMesRef">Mês de referência</Label>
              <Input
                id="prefMesRef"
                type="month"
                value={mesManual}
                onChange={e => setMesManual(e.target.value)}
              />
            </div>
          )}
        </div>

        {apiIndisponivel && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            A API ainda não expõe as preferências (404). Atualize e reinicie a API local ou faça deploy no servidor.
          </div>
        )}

        {loadingRefs && <p className="text-sm text-muted-foreground">Carregando modelos…</p>}

        {!loadingRefs && !apiIndisponivel && referencias.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Nenhum modelo salvo.</p>
            <p className="mt-1">
              Monte o relatório na aba <strong>Relatório mensal</strong> e use &quot;Salvar referência&quot;.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => router.replace('?tab=relatorio-mensal', { scroll: false })}
            >
              Ir para relatório mensal
            </Button>
          </div>
        )}

        {referencias.length > 0 && (
          <ul className="divide-y rounded-md border bg-background text-sm">
            {referencias.map(ref => (
              <li key={ref.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium truncate">{ref.titulo}</p>
                  <p className="text-muted-foreground text-xs">
                    {ref.nomeSetor} · {ref.logins.length} colaborador(es)
                  </p>
                  <p className="text-muted-foreground text-xs truncate">
                    Para: {ref.emailDestino}
                    {ref.emailCopia ? ` · Cópia: ${ref.emailCopia}` : ''}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Gestor: {ref.assinanteNome}
                    {ref.envioAutomatico
                      ? ` · envio automático dia ${ref.diaEnvio} (mês corrente)`
                      : ''}
                    {ref.ultimoEnvioMesRef ? ` · último envio ${ref.ultimoEnvioMesRef}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button type="button" size="sm" variant="outline" onClick={() => abrirNoRelatorio(ref)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Abrir no relatório
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() => void baixarReferencia(ref)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {loadingAcaoId === ref.id && loadingTipo === 'pdf' ? 'Baixando…' : 'Baixar PDF'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={ocupado}
                    onClick={() => void enviarReferenciaSalva(ref)}
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {loadingAcaoId === ref.id && loadingTipo === 'email' ? 'Enviando…' : 'Enviar agora'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removerReferencia(ref.id)}
                    aria-label="Excluir modelo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {referencias.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void carregarReferencias()}>
            Atualizar lista
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
