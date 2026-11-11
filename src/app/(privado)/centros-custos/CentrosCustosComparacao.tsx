'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, GitCompare, Info, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  classesCabecalhoColunaMarcacao,
  classesCelulaColunaMarcacao,
  ComparacaoColunaMarcacaoCabecalho,
  ComparacaoLinhaMarcarCheckbox,
  estadoCheckboxListaVisivel,
} from '@/components/comparacao/ComparacaoMarcarCheckbox'
import {
  ColunaUsuarioHeader,
  nomeUsuarioPorLogin,
  UsuarioAncoraTriggerLabel,
  UsuarioSelecionadoChip,
} from '@/components/usuario/UsuarioSelecionadoChip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PopoverPortal } from '@radix-ui/react-popover'
import {
  CcUsuarioComparacaoResposta,
  getComparacaoUsuariosCentroCusto,
  incluirUsuariosCcEmLote,
  registrarExportacaoPlanilhaCentrosCustos,
  removerUsuariosCcEmLote,
} from '@/services/mgoFinanceiroService'
import { getAll as getAllUsuarios, Usuario } from '@/services/usuariosService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { exportarMatrizCcUsuariosExcel } from '@/lib/exportMatrizCcUsuarios'
import { stripDiacritics } from '@/utils/functions'
import { mostrarErro } from '@/utils/avisoApi'

export { exportarMatrizCcUsuariosExcel } from '@/lib/exportMatrizCcUsuarios'

type Props = {
  unidadeLogada: string
}

function escapeCsv(v: string) {
  const s = String(v ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function CentrosCustosComparacao({ unidadeLogada }: Props) {
  const unidade = unidadeLogada
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [ancora, setAncora] = useState('')
  const [comboAncora, setComboAncora] = useState(false)
  const [comboObrig, setComboObrig] = useState(false)
  const [obrigatorios, setObrigatorios] = useState<string[]>([])
  const [filtro, setFiltro] = useState('')
  const [soIncompletos, setSoIncompletos] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [exportandoMatriz, setExportandoMatriz] = useState(false)
  const [dados, setDados] = useState<CcUsuarioComparacaoResposta | null>(null)
  const [usuarioRemover, setUsuarioRemover] = useState('')
  const [comboRemover, setComboRemover] = useState(false)
  const [marcadosCc, setMarcadosCc] = useState<Set<string>>(new Set())
  const [dialogRemover, setDialogRemover] = useState(false)
  const [remocaoSeguraAncora, setRemocaoSeguraAncora] = useState(false)
  const [marcadosIncompletos, setMarcadosIncompletos] = useState<Set<string>>(new Set())
  const [motivoRemocao, setMotivoRemocao] = useState('')
  const [removendo, setRemovendo] = useState(false)
  const [dialogIncluir, setDialogIncluir] = useState(false)
  const [motivoIncluir, setMotivoIncluir] = useState('')
  const [incluindo, setIncluindo] = useState(false)

  useEffect(() => {
    getAllUsuarios()
      .then((lista) => setUsuarios(lista.filter((u) => u.ativo !== false)))
      .catch(() => setUsuarios([]))
  }, [])

  const nomeAncora = usuarios.find((u) => u.codusuario === ancora)?.nome ?? ''

  async function comparar() {
    if (!ancora.trim()) {
      toast.error('Selecione o usuário âncora.')
      return
    }
    if (obrigatorios.length === 0) {
      toast.error('Adicione pelo menos um usuário obrigatório.')
      return
    }
    setCarregando(true)
    try {
      const r = await getComparacaoUsuariosCentroCusto(ancora, obrigatorios)
      setDados(r)
      setMarcadosCc(new Set())
      setMarcadosIncompletos(new Set())
      setRemocaoSeguraAncora(false)
      setUsuarioRemover(ancora)
      if (r.linhas.length === 0) toast.info('Nenhum centro de custo com o usuário âncora nesta unidade.')
    } catch (e) {
      mostrarErro(e)
      setDados(null)
    } finally {
      setCarregando(false)
    }
  }

  function adicionarObrigatorio(login: string) {
    const t = login.trim()
    if (!t || obrigatorios.some((o) => o.toLowerCase() === t.toLowerCase())) return
    if (t.toLowerCase() === ancora.toLowerCase()) {
      toast.info('O âncora não precisa constar como obrigatório.')
      return
    }
    setObrigatorios((prev) => [...prev, t])
    setComboObrig(false)
  }

  const linhasFiltradas = useMemo(() => {
    if (!dados) return []
    const q = stripDiacritics(filtro.trim().toLowerCase())
    return dados.linhas.filter((l) => {
      if (soIncompletos && l.completo) return false
      if (!q) return true
      const blob = [l.ccusto, l.custo, l.diretoria].join(' ').toLowerCase()
      return stripDiacritics(blob).includes(q)
    })
  }, [dados, filtro, soIncompletos])

  const incompletosFiltrados = useMemo(
    () => linhasFiltradas.filter((l) => !l.completo),
    [linhasFiltradas]
  )

  function alternarMarcadoLinha(ccusto: string) {
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      if (next.has(ccusto)) next.delete(ccusto)
      else next.add(ccusto)
      return next
    })
  }

  function marcarTodosVisiveis() {
    if (linhasFiltradas.length === 0) {
      toast.info('Nenhuma linha na lista filtrada.')
      return
    }
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      for (const l of linhasFiltradas) next.add(l.ccusto)
      return next
    })
  }

  function desmarcarTodosVisiveis() {
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      for (const l of linhasFiltradas) next.delete(l.ccusto)
      return next
    })
  }

  function marcarIncompletosVisiveis() {
    if (incompletosFiltrados.length === 0) {
      toast.info('Nenhum centro incompleto na lista filtrada.')
      return
    }
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      for (const l of incompletosFiltrados) next.add(l.ccusto)
      return next
    })
  }

  const qtdMarcadosVisiveis = useMemo(
    () => linhasFiltradas.filter((l) => marcadosIncompletos.has(l.ccusto)).length,
    [linhasFiltradas, marcadosIncompletos]
  )

  function colaboradorPresenteNoCc(
    linha: CcUsuarioComparacaoResposta['linhas'][0],
    login: string
  ) {
    const t = login.trim().toLowerCase()
    if (!t) return false
    if (t === ancora.trim().toLowerCase()) return true
    const hit = linha.obrigatorios.find((x) => x.usuario.toLowerCase() === t)
    return Boolean(hit?.presente)
  }

  function alternarMarcado(ccusto: string) {
    setMarcadosCc((prev) => {
      const next = new Set(prev)
      if (next.has(ccusto)) next.delete(ccusto)
      else next.add(ccusto)
      return next
    })
  }

  function marcarOndeColaboradorEsta() {
    if (!usuarioRemover.trim()) {
      toast.error('Selecione o colaborador.')
      return
    }
    setRemocaoSeguraAncora(false)
    const ids = linhasFiltradas.filter((l) => colaboradorPresenteNoCc(l, usuarioRemover)).map((l) => l.ccusto)
    setMarcadosCc(new Set(ids))
    if (ids.length === 0) toast.info('Este colaborador não está vinculado a nenhum CC da lista filtrada.')
  }

  function marcarOndeColaboradorFalta() {
    if (!usuarioRemover.trim()) {
      toast.error('Selecione o colaborador.')
      return
    }
    setRemocaoSeguraAncora(false)
    const ids = linhasFiltradas
      .filter((l) => !colaboradorPresenteNoCc(l, usuarioRemover))
      .map((l) => l.ccusto)
    setMarcadosCc(new Set(ids))
    if (ids.length === 0) toast.info('Este colaborador já está vinculado a todos os CCs da lista filtrada.')
  }

  async function confirmarInclusao() {
    const login = usuarioRemover.trim()
    const ccs = [...marcadosCc]
    if (!login || ccs.length === 0 || !dados) return
    const centros = ccs.map((cc) => {
      const linha = dados.linhas.find((l) => l.ccusto === cc)
      return {
        ccusto: cc,
        custo: linha?.custo,
        diretoria: linha?.diretoria,
      }
    })
    setIncluindo(true)
    try {
      const r = await incluirUsuariosCcEmLote({
        usuario: login,
        centros,
        motivo: motivoIncluir.trim() || undefined,
      })
      toast.success(
        `${login}: ${r.inseridos} vínculo(s) criado(s) em ${ccs.length} centro(s) marcado(s). Histórico gravado.`
      )
      if (r.centros_ja_existiam?.length) {
        toast.info(`${r.centros_ja_existiam.length} CC(s) já tinham vínculo com este login.`)
      }
      setDialogIncluir(false)
      setMotivoIncluir('')
      setMarcadosCc(new Set())
      await comparar()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setIncluindo(false)
    }
  }

  const ccsCompletosAncora = useMemo(() => {
    if (!dados) return [] as string[]
    return dados.linhas.filter((l) => l.completo).map((l) => l.ccusto)
  }, [dados])

  function abrirRemocaoSeguraAncora() {
    if (!dados || !ancora.trim()) return
    if (ccsCompletosAncora.length === 0) {
      toast.info('Nenhum CC com situação OK. Corrija os incompletos antes de tirar o âncora.')
      return
    }
    setUsuarioRemover(ancora)
    setMarcadosCc(new Set(ccsCompletosAncora))
    setRemocaoSeguraAncora(true)
    setDialogRemover(true)
  }

  async function confirmarRemocao() {
    const login = usuarioRemover.trim()
    const ccs = [...marcadosCc]
    if (!login || ccs.length === 0) return
    if (remocaoSeguraAncora && dados) {
      const bloqueados = ccs.filter((cc) => {
        const linha = dados.linhas.find((l) => l.ccusto === cc)
        return !linha?.completo
      })
      if (bloqueados.length > 0) {
        toast.error(
          'Remoção segura do âncora só permite CCs em que todos os obrigatórios estão vinculados (OK).'
        )
        return
      }
      if (login.toLowerCase() !== ancora.trim().toLowerCase()) {
        toast.error('Na remoção segura, o colaborador deve ser o mesmo usuário âncora da comparação.')
        return
      }
    }
    setRemovendo(true)
    try {
      const r = await removerUsuariosCcEmLote({
        usuario: login,
        ccustos: ccs,
        motivo: motivoRemocao.trim() || undefined,
      })
      toast.success(
        `${login}: ${r.removidos} vínculo(s) removido(s) em ${ccs.length} centro(s) marcado(s). Histórico gravado.`
      )
      if (r.centros_sem_vinculo?.length) {
        toast.info(`${r.centros_sem_vinculo.length} CC(s) não tinham vínculo com este login.`)
      }
      setDialogRemover(false)
      setRemocaoSeguraAncora(false)
      setMotivoRemocao('')
      setMarcadosCc(new Set())
      await comparar()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setRemovendo(false)
    }
  }

  const nomeRemover = usuarios.find((u) => u.codusuario === usuarioRemover)?.nome ?? ''

  const colunas = useMemo<ColumnDef<CcUsuarioComparacaoResposta['linhas'][0]>[]>(() => {
    const cols: ColumnDef<CcUsuarioComparacaoResposta['linhas'][0]>[] = []
    if (dados) {
      cols.push({
        id: 'marcar-incompleto',
        meta: {
          headerClassName: classesCabecalhoColunaMarcacao('planilha'),
          cellClassName: classesCelulaColunaMarcacao('planilha'),
        },
        header: () => (
          <ComparacaoColunaMarcacaoCabecalho
            tipo="planilha"
            titulo="Planilha"
            checkbox={
              <Checkbox
                checked={estadoCheckboxListaVisivel(qtdMarcadosVisiveis, linhasFiltradas.length)}
                disabled={linhasFiltradas.length === 0}
                onCheckedChange={(v) => {
                  if (v === true) marcarTodosVisiveis()
                  else desmarcarTodosVisiveis()
                }}
                aria-label="Marcar todos para exportação"
              />
            }
          />
        ),
        cell: ({ row }) => {
          const cc = row.original.ccusto
          return (
            <ComparacaoLinhaMarcarCheckbox
              checked={marcadosIncompletos.has(cc)}
              onToggle={() => alternarMarcadoLinha(cc)}
              aria-label={`Marcar ${cc} para exportar`}
              alinhamento="center"
            />
          )
        },
      })
    }
    if (usuarioRemover.trim()) {
      cols.push({
        id: 'marcar',
        meta: {
          headerClassName: classesCabecalhoColunaMarcacao('vinculo'),
          cellClassName: classesCelulaColunaMarcacao('vinculo'),
        },
        header: () => (
          <ComparacaoColunaMarcacaoCabecalho
            tipo="vinculo"
            titulo="Vínculo"
            checkbox={
              <Checkbox
                checked={
                  linhasFiltradas.length > 0 && linhasFiltradas.every((l) => marcadosCc.has(l.ccusto))
                }
                onCheckedChange={(v) => {
                  if (v) setMarcadosCc(new Set(linhasFiltradas.map((l) => l.ccusto)))
                  else setMarcadosCc(new Set())
                }}
                aria-label="Marcar todos para incluir ou remover"
              />
            }
          />
        ),
        cell: ({ row }) => {
          const cc = row.original.ccusto
          return (
            <ComparacaoLinhaMarcarCheckbox
              checked={marcadosCc.has(cc)}
              onToggle={() => alternarMarcado(cc)}
              aria-label={`Marcar ${cc} para incluir ou remover`}
              alinhamento="center"
            />
          )
        },
      })
    }
    cols.push(
      { accessorKey: 'ccusto', header: 'Centro de custo' },
      { accessorKey: 'custo', header: 'Descrição' },
      { accessorKey: 'diretoria', header: 'Diretoria' }
    )
    for (const o of dados?.obrigatorios ?? obrigatorios) {
      cols.push({
        id: `obr-${o}`,
        header: () => <ColunaUsuarioHeader login={o} nome={nomeUsuarioPorLogin(usuarios, o)} />,
        cell: ({ row }) => {
          const hit = row.original.obrigatorios.find((x) => x.usuario.toLowerCase() === o.toLowerCase())
          return hit?.presente ? (
            <Badge variant="secondary">Sim</Badge>
          ) : (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              Não
            </Badge>
          )
        },
      })
    }
    cols.push({
      id: 'situacao',
      header: 'Situação',
      cell: ({ row }) =>
        row.original.completo ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge>
        ) : (
          <Badge variant="destructive">Incompleto</Badge>
        ),
    })
    return cols
  }, [
    dados,
    dados?.obrigatorios,
    obrigatorios,
    usuarioRemover,
    marcadosCc,
    linhasFiltradas,
    incompletosFiltrados,
    marcadosIncompletos,
    qtdMarcadosVisiveis,
    ancora,
    usuarios,
  ])

  async function exportarComparacao(somenteMarcadosIncompletos = false) {
    if (!dados?.linhas.length) {
      toast.info('Nada para exportar. Rode a comparação primeiro.')
      return
    }
    let base = linhasFiltradas
    if (somenteMarcadosIncompletos) {
      base = base.filter((l) => marcadosIncompletos.has(l.ccusto))
      if (base.length === 0) {
        toast.info('Marque pelo menos um centro para exportar.')
        return
      }
    }
    const cab = ['Centro de custo', 'Descrição', 'Diretoria', ...dados.obrigatorios.map((o) => `Tem ${o}`), 'Situação']
    const linhas = base.map((l) => {
      const cols = [
        l.ccusto,
        l.custo,
        l.diretoria,
        ...l.obrigatorios.map((o) => (o.presente ? 'Sim' : 'Não')),
        l.completo ? 'OK' : 'Incompleto',
      ]
      return cols.map(escapeCsv).join(';')
    })
    const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
    await downloadBlobFile(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `cc-comparacao-${dados.ancora}.csv`
    )
    toast.success(
      somenteMarcadosIncompletos
        ? `Exportados ${base.length} centro(s) marcado(s).`
        : 'Planilha da comparação exportada.'
    )
    const ancoraRotulo =
      nomeAncora.trim() && nomeAncora.trim().toLowerCase() !== dados.ancora.toLowerCase()
        ? `${nomeAncora.trim()} (${dados.ancora})`
        : dados.ancora
    const escopo = somenteMarcadosIncompletos
      ? `${base.length} centro(s) marcado(s) na comparação`
      : `${base.length} centro(s) na grade da comparação`
    void registrarExportacaoPlanilhaCentrosCustos(
      somenteMarcadosIncompletos ? 'cc_usuarios_comparacao_marcados' : 'cc_usuarios_comparacao',
      `Âncora ${ancoraRotulo}: ${escopo}`
    )
  }

  async function exportarMatriz() {
    setExportandoMatriz(true)
    try {
      await exportarMatrizCcUsuariosExcel()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setExportandoMatriz(false)
    }
  }

  const resumo = dados?.resumo
  const pctOk = resumo && resumo.total_com_ancora > 0 ? Math.round((resumo.total_ok / resumo.total_com_ancora) * 100) : 0

  return (
    <div id="tour-cc-comparacao" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5" /> Comparação usuários
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Quem <strong>usa</strong> cada centro de custo (vínculo na USUARIOCCUSTO): liste CCs com o login âncora e
            confira se os demais colaboradores também estão no mesmo CC. Depois da comparação, você pode{' '}
            <strong>incluir ou remover colaboradores</strong> nos CCs marcados.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Unidade: <strong className="text-foreground">{unidade || '—'}</strong>
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Usuário âncora</Label>
              <Popover modal open={comboAncora} onOpenChange={setComboAncora}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between py-2 font-normal">
                    <UsuarioAncoraTriggerLabel login={ancora} nome={nomeAncora} />
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent className="w-[min(24rem,90vw)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar login ou nome…" />
                      <CommandList>
                        <CommandEmpty>Nenhum usuário.</CommandEmpty>
                        <CommandGroup>
                          {usuarios.map((u) => (
                            <CommandItem
                              key={u.codusuario}
                              value={`${u.codusuario} ${u.nome}`}
                              onSelect={() => {
                                setAncora(u.codusuario)
                                setComboAncora(false)
                              }}
                            >
                              {u.codusuario} — {u.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </PopoverPortal>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Usuários obrigatórios</Label>
              <div className="flex flex-wrap gap-2">
                {obrigatorios.map((o) => (
                  <UsuarioSelecionadoChip
                    key={o}
                    login={o}
                    nome={nomeUsuarioPorLogin(usuarios, o)}
                    onRemove={() => setObrigatorios((prev) => prev.filter((x) => x !== o))}
                  />
                ))}
                <Popover modal open={comboObrig} onOpenChange={setComboObrig}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-1 h-3 w-3" /> Adicionar
                    </Button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent className="w-[min(24rem,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar login…" />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário.</CommandEmpty>
                          <CommandGroup>
                            {usuarios.map((u) => (
                              <CommandItem
                                key={u.codusuario}
                                value={`${u.codusuario} ${u.nome}`}
                                onSelect={() => adicionarObrigatorio(u.codusuario)}
                              >
                                {u.codusuario} — {u.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void comparar()} disabled={carregando}>
              {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompare className="mr-2 h-4 w-4" />}
              Comparar
            </Button>
            <Button type="button" variant="outline" onClick={() => void exportarMatriz()} disabled={exportandoMatriz}>
              {exportandoMatriz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar planilha (Excel) — todos CC e usuários
            </Button>
          </div>
        </CardContent>
      </Card>

      {dados ? (
        <Accordion type="single" collapsible className="rounded-lg border border-border bg-muted/20">
          <AccordionItem value="guia-colunas" className="border-0 px-3">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2 text-left">
                <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                Dúvida sobre as duas colunas de marcação?
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Na tabela abaixo, a coluna{' '}
                <span className="font-medium text-sky-700 dark:text-sky-400">azul (1)</span> é planilha; a{' '}
                <span className="font-medium text-amber-800 dark:text-amber-400">âmbar (2)</span> é incluir ou remover
                vínculo.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-md border border-border bg-background p-3 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      Col. 1
                    </Badge>
                    <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <h4 className="text-sm font-semibold text-foreground">Baixar planilha</h4>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground leading-relaxed">
                    <li>Marque as linhas e use os botões de exportação na tabela.</li>
                    <li>
                      <strong className="font-medium text-foreground">Não altera</strong> quem está cadastrado no centro
                      de custo.
                    </li>
                  </ul>
                </article>
                <article className="rounded-md border border-border bg-background p-3 shadow-sm space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      Col. 2
                    </Badge>
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Trash2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <h4 className="text-sm font-semibold text-foreground">Incluir ou remover</h4>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground leading-relaxed">
                    <li>Escolha o colaborador no bloco da tabela (a coluna 2 só aparece depois disso).</li>
                    <li className="flex flex-wrap items-center gap-1">
                      Para <strong className="font-medium text-foreground">incluir</strong>: marque linhas com{' '}
                      <Badge variant="outline" className="h-5 border-destructive/50 px-1.5 text-[10px] text-destructive">
                        Não
                      </Badge>{' '}
                      na coluna dele — ou use <em>Marcar CCs onde falta</em>.
                    </li>
                    <li className="flex flex-wrap items-center gap-1">
                      Para <strong className="font-medium text-foreground">remover</strong>: marque linhas com{' '}
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        Sim
                      </Badge>{' '}
                      — ou use <em>Marcar CCs onde está vinculado</em>.
                    </li>
                  </ul>
                </article>
              </div>
              <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
                Dica: clique na linha para marcar a coluna 2 (com colaborador escolhido) ou a coluna 1 (sem colaborador).
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      {resumo && resumo.total_com_ancora > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">CC com âncora</p>
                <p className="text-2xl font-bold tabular-nums">{resumo.total_com_ancora}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Completos</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">{resumo.total_ok}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Incompletos</p>
                <p className="text-2xl font-bold tabular-nums text-destructive">{resumo.total_incompletos}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cobertura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pctOk}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {pctOk}% dos centros com o âncora têm todos os obrigatórios ({resumo.total_ok} de{' '}
                {resumo.total_com_ancora}).
              </p>
              <ul className="space-y-1 text-sm">
                {Object.entries(resumo.faltando_por_obrigatorio).map(([login, qtd]) => {
                  const nome = nomeUsuarioPorLogin(usuarios, login)
                  return (
                    <li key={login}>
                      Falta <strong>{nome ? `${nome} (${login})` : login}</strong> em{' '}
                      <strong>{qtd}</strong> centro(s).
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
          {resumo.total_ok > 0 && (
            <Card className="border-emerald-600/35 bg-emerald-500/[0.06]">
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Remover o âncora com segurança
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                  Use quando a comparação mostrar que <strong>{obrigatorios.join(', ')}</strong> já estão nos mesmos
                  centros que <strong>{ancora}</strong>. O PaperSign desvincula <strong>só o âncora</strong> nos{' '}
                  <strong>{resumo.total_ok}</strong> CC(s) com situação <strong>OK</strong>. Os{' '}
                  {resumo.total_incompletos} incompleto(s) ficam de fora automaticamente.
                </p>
                <Button type="button" variant="destructive" onClick={abrirRemocaoSeguraAncora}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover {ancora} dos {resumo.total_ok} CC(s) completos
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {dados && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">Incluir ou remover colaborador de centros de custo (manual)</p>
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <div className="grid min-w-[14rem] gap-2 flex-1">
                  <Label>Colaborador</Label>
                  <Popover modal open={comboRemover} onOpenChange={setComboRemover}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between py-2 font-normal">
                        <UsuarioAncoraTriggerLabel login={usuarioRemover} nome={nomeRemover} />
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverPortal>
                      <PopoverContent className="w-[min(24rem,90vw)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar login…" />
                          <CommandList>
                            <CommandEmpty>Nenhum usuário.</CommandEmpty>
                            <CommandGroup>
                              {usuarios.map((u) => (
                                <CommandItem
                                  key={u.codusuario}
                                  value={`${u.codusuario} ${u.nome}`}
                                  onSelect={() => {
                                    setUsuarioRemover(u.codusuario)
                                    setMarcadosCc(new Set())
                                    setComboRemover(false)
                                  }}
                                >
                                  {u.codusuario} — {u.nome}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </PopoverPortal>
                  </Popover>
                </div>
                <Button type="button" variant="outline" onClick={marcarOndeColaboradorFalta} disabled={!usuarioRemover}>
                  Marcar CCs onde falta
                </Button>
                <Button type="button" variant="outline" onClick={marcarOndeColaboradorEsta} disabled={!usuarioRemover}>
                  Marcar CCs onde está vinculado
                </Button>
                <Button
                  type="button"
                  disabled={!usuarioRemover || marcadosCc.size === 0}
                  onClick={() => {
                    setRemocaoSeguraAncora(false)
                    setDialogIncluir(true)
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Incluir nos {marcadosCc.size} CC marcado(s)
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!usuarioRemover || marcadosCc.size === 0}
                  onClick={() => {
                    setRemocaoSeguraAncora(false)
                    setDialogRemover(true)
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remover dos {marcadosCc.size} CC marcado(s)
                </Button>
              </div>
              {usuarioRemover.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Na tabela, <strong className="text-foreground">{marcadosCc.size}</strong> centro(s) de custo marcados
                  para ação com <strong className="text-foreground">{usuarioRemover}</strong>.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selecione um colaborador para liberar a 2ª coluna da tabela (incluir ou remover vínculos).
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Input
                  placeholder="Filtrar por centro de custo…"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="max-w-md"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={soIncompletos} onChange={(e) => setSoIncompletos(e.target.checked)} />
                  Só incompletos
                </label>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/15 p-3">
                <p className="text-xs font-medium text-foreground">
                  Coluna 1 — exportação · {qtdMarcadosVisiveis} linha(s) marcada(s)
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={linhasFiltradas.length === 0}
                    onClick={marcarTodosVisiveis}
                  >
                    Marcar todos visíveis ({linhasFiltradas.length})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={incompletosFiltrados.length === 0}
                    onClick={marcarIncompletosVisiveis}
                  >
                    Marcar incompletos ({incompletosFiltrados.length})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={marcadosIncompletos.size === 0}
                    onClick={() => setMarcadosIncompletos(new Set())}
                  >
                    Limpar exportação ({marcadosIncompletos.size})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:ml-auto"
                    onClick={() => void exportarComparacao()}
                    disabled={!linhasFiltradas.length}
                  >
                    <Download className="mr-1 h-4 w-4" /> Exportar comparação
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={marcadosIncompletos.size === 0}
                    onClick={() => void exportarComparacao(true)}
                  >
                    <Download className="mr-1 h-4 w-4" /> Exportar marcados
                  </Button>
                </div>
              </div>
            </div>
            <DataTable
              columns={colunas}
              data={linhasFiltradas}
              loading={carregando}
              hideSearch
              onRowClick={(linha) =>
                usuarioRemover.trim()
                  ? alternarMarcado(linha.ccusto)
                  : alternarMarcadoLinha(linha.ccusto)
              }
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogIncluir} onOpenChange={setDialogIncluir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incluir colaborador em centros de custo</DialogTitle>
            <DialogDescription asChild>
              <p className="text-sm text-muted-foreground">
                O login <strong>{usuarioRemover}</strong> será vinculado a{' '}
                <strong>{marcadosCc.size}</strong> centro(s) de custo na unidade {unidade || 'logada'}. CCs que já
                tiverem vínculo serão ignorados.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-cc-incluir">Motivo (opcional, auditoria)</Label>
            <Input
              id="motivo-cc-incluir"
              value={motivoIncluir}
              onChange={(e) => setMotivoIncluir(e.target.value)}
              placeholder="Ex.: cobertura de férias"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogIncluir(false)} disabled={incluindo}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmarInclusao()} disabled={incluindo}>
              {incluindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Confirmar inclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogRemover}
        onOpenChange={(open) => {
          setDialogRemover(open)
          if (!open) setRemocaoSeguraAncora(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {remocaoSeguraAncora ? 'Remover âncora — apenas CCs completos' : 'Remover vínculos de centro de custo'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {remocaoSeguraAncora ? (
                  <>
                    <p>
                      O âncora <strong className="text-foreground">{usuarioRemover}</strong> será desvinculado de{' '}
                      <strong className="text-foreground">{marcadosCc.size}</strong> centro(s) em que a comparação está{' '}
                      <strong className="text-foreground">OK</strong> (todos os obrigatórios:{' '}
                      {obrigatorios.join(', ')}).
                    </p>
                    <p>
                      Unidade <strong className="text-foreground">{unidade || 'logada'}</strong>. CCs incompletos não
                      entram neste lote.
                    </p>
                  </>
                ) : (
                  <p>
                    O login <strong>{usuarioRemover}</strong> será desvinculado de{' '}
                    <strong>{marcadosCc.size}</strong> centro(s) de custo na unidade {unidade || 'logada'}. Esta ação não
                    pode ser desfeita pelo PaperSign.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-cc-remover">Motivo (opcional, auditoria)</Label>
            <Input
              id="motivo-cc-remover"
              value={motivoRemocao}
              onChange={(e) => setMotivoRemocao(e.target.value)}
              placeholder="Ex.: troca de função"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogRemover(false)} disabled={removendo}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmarRemocao()} disabled={removendo}>
              {removendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Confirmar remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
