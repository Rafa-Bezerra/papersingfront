'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, GitCompare, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
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
      toast.error('Selecione o colaborador a remover.')
      return
    }
    setRemocaoSeguraAncora(false)
    const ids = linhasFiltradas.filter((l) => colaboradorPresenteNoCc(l, usuarioRemover)).map((l) => l.ccusto)
    setMarcadosCc(new Set(ids))
    if (ids.length === 0) toast.info('Este colaborador não está vinculado a nenhum CC da lista filtrada.')
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
        header: () => (
          <Checkbox
            checked={estadoCheckboxListaVisivel(qtdMarcadosVisiveis, linhasFiltradas.length)}
            disabled={linhasFiltradas.length === 0}
            onCheckedChange={(v) => {
              if (v === true) marcarTodosVisiveis()
              else desmarcarTodosVisiveis()
            }}
            aria-label="Marcar ou desmarcar todos os visíveis"
            title="Marca todos os visíveis; se já estiverem marcados, desmarca só os visíveis"
          />
        ),
        cell: ({ row }) => {
          const cc = row.original.ccusto
          return (
            <ComparacaoLinhaMarcarCheckbox
              checked={marcadosIncompletos.has(cc)}
              onToggle={() => alternarMarcadoLinha(cc)}
              aria-label={`Marcar ${cc}`}
            />
          )
        },
      })
    }
    if (usuarioRemover.trim()) {
      cols.push({
        id: 'marcar',
        header: () => (
          <Checkbox
            checked={
              linhasFiltradas.length > 0 && linhasFiltradas.every((l) => marcadosCc.has(l.ccusto))
            }
            onCheckedChange={(v) => {
              if (v) setMarcadosCc(new Set(linhasFiltradas.map((l) => l.ccusto)))
              else setMarcadosCc(new Set())
            }}
            aria-label="Marcar todos filtrados"
          />
        ),
        cell: ({ row }) => {
          const cc = row.original.ccusto
          const presente = colaboradorPresenteNoCc(row.original, usuarioRemover)
          return (
            <ComparacaoLinhaMarcarCheckbox
              checked={marcadosCc.has(cc)}
              disabled={!presente}
              onToggle={() => alternarMarcado(cc)}
              aria-label={`Marcar ${cc} para remoção`}
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
    void registrarExportacaoPlanilhaCentrosCustos(
      somenteMarcadosIncompletos ? 'cc_usuarios_comparacao_marcados' : 'cc_usuarios_comparacao',
      `Âncora ${dados.ancora}: ${base.length} centro(s)`
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5" /> Comparação usuários
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Quem <strong>usa</strong> cada centro de custo (vínculo na USUARIOCCUSTO): liste CCs com o login âncora e
            confira se os demais colaboradores também estão no mesmo CC. Depois da comparação, você pode{' '}
            <strong>remover um colaborador</strong> dos CCs marcados.
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
              <p className="text-sm font-medium">Remover colaborador de centros de custo (manual)</p>
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
                <div className="grid min-w-[14rem] gap-2 flex-1">
                  <Label>Colaborador a remover</Label>
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
                <Button type="button" variant="outline" onClick={marcarOndeColaboradorEsta} disabled={!usuarioRemover}>
                  Marcar CCs onde está vinculado
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!usuarioRemover || marcadosCc.size === 0}
                  onClick={() => setDialogRemover(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remover dos {marcadosCc.size} CC marcado(s)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Para o caso “já conferi os obrigatórios e quero só tirar o âncora”, use o bloco{' '}
                <strong>Remover o âncora com segurança</strong> acima. Aqui você escolhe outro login ou CCs à mão. A
                remoção grava no histórico (Admin).
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={linhasFiltradas.length === 0}
                onClick={marcarTodosVisiveis}
              >
                Marcar todos ({linhasFiltradas.length})
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
                Limpar marcação ({marcadosIncompletos.size})
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
            <DataTable
              columns={colunas}
              data={linhasFiltradas}
              loading={carregando}
              hideSearch
              onRowClick={(linha) => alternarMarcadoLinha(linha.ccusto)}
            />
            <p className="text-xs text-muted-foreground">
              <strong>Marcar todos</strong> e desmarque na coluna ou na linha o que não quiser exportar.{' '}
              <strong>{qtdMarcadosVisiveis}</strong> marcado(s) na lista. Remoção de vínculo: coluna extra com
              colaborador selecionado.
            </p>
          </CardContent>
        </Card>
      )}

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
