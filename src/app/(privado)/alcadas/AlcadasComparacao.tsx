'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, GitCompare, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  AlcadaComparacaoResposta,
  getAlcadasPorUsuario,
  getComparacaoAlcadas,
  getMatrizAlcadas,
  removerAprovadorEmLote,
} from '@/services/alcadasService'
import { getUsuariosAprovadores, Usuario } from '@/services/usuariosService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { stripDiacritics } from '@/utils/functions'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
  podeEditar?: boolean
  onAbrirCentro?: (centroCusto: string) => void
}

function escapeCsv(v: string) {
  const s = String(v ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function AlcadasComparacao({ unidadeLogada, podeEditar = false }: Props) {
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
  const [dados, setDados] = useState<AlcadaComparacaoResposta | null>(null)
  const [dialogRemoverAncora, setDialogRemoverAncora] = useState(false)
  const [idsRemoverAncora, setIdsRemoverAncora] = useState<number[]>([])
  const [centrosRemoverAncora, setCentrosRemoverAncora] = useState(0)
  const [motivoRemocao, setMotivoRemocao] = useState('')
  const [preparandoRemocao, setPreparandoRemocao] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [marcadosIncompletos, setMarcadosIncompletos] = useState<Set<string>>(new Set())

  useEffect(() => {
    getUsuariosAprovadores()
      .then(setUsuarios)
      .catch(() => setUsuarios([]))
  }, [])

  const nomeAncora = usuarios.find((u) => u.codusuario === ancora)?.nome ?? ''

  async function comparar() {
    if (!ancora.trim()) {
      toast.error('Selecione o aprovador âncora.')
      return
    }
    if (obrigatorios.length === 0) {
      toast.error('Adicione pelo menos um aprovador obrigatório.')
      return
    }
    setCarregando(true)
    try {
      const r = await getComparacaoAlcadas(ancora, obrigatorios)
      setDados(r)
      setMarcadosIncompletos(new Set())
      if (r.linhas.length === 0) toast.info('Nenhum centro de custo com o aprovador âncora nesta unidade.')
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
      const blob = [l.centro_custo, l.centro_custo_nome].join(' ').toLowerCase()
      return stripDiacritics(blob).includes(q)
    })
  }, [dados, filtro, soIncompletos])

  const incompletosFiltrados = useMemo(
    () => linhasFiltradas.filter((l) => !l.completo),
    [linhasFiltradas]
  )

  function alternarMarcadoLinha(centroCusto: string) {
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      if (next.has(centroCusto)) next.delete(centroCusto)
      else next.add(centroCusto)
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
      for (const l of linhasFiltradas) next.add(l.centro_custo)
      return next
    })
  }

  function desmarcarTodosVisiveis() {
    setMarcadosIncompletos((prev) => {
      const next = new Set(prev)
      for (const l of linhasFiltradas) next.delete(l.centro_custo)
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
      for (const l of incompletosFiltrados) next.add(l.centro_custo)
      return next
    })
  }

  const qtdMarcadosVisiveis = useMemo(
    () => linhasFiltradas.filter((l) => marcadosIncompletos.has(l.centro_custo)).length,
    [linhasFiltradas, marcadosIncompletos]
  )

  async function abrirRemocaoSeguraAncora() {
    if (!dados || !ancora.trim() || !podeEditar) return
    const ccsOk = new Set(dados.linhas.filter((l) => l.completo).map((l) => l.centro_custo))
    if (ccsOk.size === 0) {
      toast.info('Nenhum CC com situação OK. Corrija os incompletos antes de tirar o âncora.')
      return
    }
    setPreparandoRemocao(true)
    try {
      const porUsuario = await getAlcadasPorUsuario(ancora, unidade)
      const linhasAlvo = porUsuario.linhas.filter((l) => ccsOk.has(l.centro_custo))
      const ids = linhasAlvo.map((l) => l.id)
      if (ids.length === 0) {
        toast.warning('Não encontramos alçadas do âncora nos CCs completos.')
        return
      }
      setIdsRemoverAncora(ids)
      setCentrosRemoverAncora(new Set(linhasAlvo.map((l) => l.centro_custo)).size)
      setDialogRemoverAncora(true)
    } catch (e) {
      mostrarErro(e)
    } finally {
      setPreparandoRemocao(false)
    }
  }

  async function confirmarRemocaoSeguraAncora() {
    if (!dados || idsRemoverAncora.length === 0) return
    setRemovendo(true)
    try {
      const r = await removerAprovadorEmLote({
        modo: 'usuario',
        usuario: ancora,
        unidade,
        ids_aprovador: idsRemoverAncora,
        motivo: motivoRemocao.trim() || undefined,
      })
      toast.success(
        `${ancora} removido de ${r.removidos} linha(s) de alçada em ${r.centros_referencia} CC(s) completos. Histórico gravado.`
      )
      setDialogRemoverAncora(false)
      setMotivoRemocao('')
      setIdsRemoverAncora([])
      await comparar()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setRemovendo(false)
    }
  }

  const colunas = useMemo<ColumnDef<AlcadaComparacaoResposta['linhas'][0]>[]>(() => {
    const cols: ColumnDef<AlcadaComparacaoResposta['linhas'][0]>[] = []
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
          const cc = row.original.centro_custo
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
    cols.push(
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' }
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
    linhasFiltradas,
    incompletosFiltrados,
    marcadosIncompletos,
    qtdMarcadosVisiveis,
    usuarios,
  ])

  async function exportarComparacao(somenteMarcadosIncompletos = false) {
    if (!dados?.linhas.length) {
      toast.info('Nada para exportar. Rode a comparação primeiro.')
      return
    }
    let base = linhasFiltradas
    if (somenteMarcadosIncompletos) {
      base = base.filter((l) => marcadosIncompletos.has(l.centro_custo))
      if (base.length === 0) {
        toast.info('Marque pelo menos um centro para exportar.')
        return
      }
    }
    const cab = ['Centro de custo', 'Descrição', ...dados.obrigatorios.map((o) => `Tem ${o}`), 'Situação']
    const linhas = base.map((l) => {
      const cols = [
        l.centro_custo,
        l.centro_custo_nome,
        ...l.obrigatorios.map((o) => (o.presente ? 'Sim' : 'Não')),
        l.completo ? 'OK' : 'Incompleto',
      ]
      return cols.map(escapeCsv).join(';')
    })
    const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
    await downloadBlobFile(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `alcadas-comparacao-${dados.ancora}.csv`
    )
    toast.success(
      somenteMarcadosIncompletos
        ? `Exportados ${base.length} centro(s) marcado(s).`
        : 'Planilha da comparação exportada.'
    )
  }

  async function exportarMatrizCompleta() {
    setExportandoMatriz(true)
    try {
      const m = await getMatrizAlcadas()
      if (!m.linhas.length) {
        toast.info('Nenhuma linha na matriz desta unidade.')
        return
      }
      const cab = ['Centro de custo', 'Descrição', 'Nível', 'Aprovador', 'Cargo', 'Valor inicial', 'Valor final']
      const linhas = m.linhas.map((l) =>
        [
          l.centro_custo,
          l.centro_custo_nome,
          String(l.nivel),
          l.usuario,
          l.cargo,
          String(l.valor_inicial),
          String(l.valor_final),
        ]
          .map(escapeCsv)
          .join(';')
      )
      const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
      const slug = m.unidade.replace(/\s+/g, '_')
      await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `alcadas-matriz-${slug}.csv`)
      toast.success(`Matriz exportada (${m.total_centros} CC, ${m.total_linhas} linhas).`)
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
            <GitCompare className="h-5 w-5" /> Comparação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Liste os centros de custo em que o <strong>âncora</strong> é aprovador (qualquer nível) e verifique se os
            demais logins também estão no mesmo CC (qualquer nível).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Unidade: <strong className="text-foreground">{unidade || '—'}</strong> — consulta limitada à unidade
            logada.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Aprovador âncora</Label>
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
              <Label>Aprovadores obrigatórios</Label>
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
            <Button type="button" variant="outline" onClick={() => void exportarMatrizCompleta()} disabled={exportandoMatriz}>
              {exportandoMatriz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar todos os CC (matriz)
            </Button>
          </div>
        </CardContent>
      </Card>

      {resumo && resumo.total_com_ancora > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">CC com âncora</p>
              <p className="text-2xl font-bold tabular-nums">{resumo.total_com_ancora}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Completos (todos obrigatórios)</p>
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
      )}

      {resumo && resumo.total_com_ancora > 0 && (
        <>
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
              <ul className="text-sm space-y-1">
                {Object.entries(resumo.faltando_por_obrigatorio).map(([login, qtd]) => {
                const nome = nomeUsuarioPorLogin(usuarios, login)
                return (
                  <li key={login}>
                    Falta{' '}
                    <strong>
                      {nome ? `${nome} (${login})` : login}
                    </strong>{' '}
                    em <strong>{qtd}</strong> centro(s).
                  </li>
                )
              })}
              </ul>
            </CardContent>
          </Card>
          {podeEditar && resumo.total_ok > 0 && dados && (
            <Card className="border-emerald-600/35 bg-emerald-500/[0.06]">
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Remover o âncora com segurança (alçada)
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                  Ex.: âncora <strong>{ancora}</strong> e obrigatórios <strong>{obrigatorios.join(', ')}</strong>. Remove{' '}
                  <strong>só {ancora}</strong> como aprovador nos <strong>{resumo.total_ok}</strong> CC(s) com situação{' '}
                  <strong>OK</strong> — os obrigatórios permanecem. Isso é <strong>alçada</strong>, não vínculo CC×usuário
                  do RM (use <strong>Centros de custos → Comparação</strong> para o vínculo).
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={preparandoRemocao}
                  onClick={() => void abrirRemocaoSeguraAncora()}
                >
                  {preparandoRemocao ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Filtrar por centro de custo…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="max-w-md"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soIncompletos}
                  onChange={(e) => setSoIncompletos(e.target.checked)}
                />
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
              onRowClick={(linha) => alternarMarcadoLinha(linha.centro_custo)}
            />
            <p className="text-xs text-muted-foreground">
              Use <strong>Marcar todos</strong> e desmarque na coluna ou clicando de novo na linha o que não quiser levar
              para o export. <strong>{qtdMarcadosVisiveis}</strong> marcado(s) na lista atual.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogRemoverAncora} onOpenChange={setDialogRemoverAncora}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover âncora — apenas CCs completos</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Remove <strong className="text-foreground">{ancora}</strong> como aprovador em{' '}
                  <strong className="text-foreground">{centrosRemoverAncora}</strong> centro(s) em que todos os
                  obrigatórios ({obrigatorios.join(', ')}) já estão na alçada ({idsRemoverAncora.length} linha(s) de
                  aprovador).
                </p>
                <p>
                  Unidade <strong className="text-foreground">{unidade || 'logada'}</strong>. CCs incompletos não entram
                  neste lote.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-alcada-comp-remover">Motivo (opcional, auditoria)</Label>
            <Input
              id="motivo-alcada-comp-remover"
              value={motivoRemocao}
              onChange={(e) => setMotivoRemocao(e.target.value)}
              placeholder="Ex.: cobertura confirmada pelos obrigatórios"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogRemoverAncora(false)}
              disabled={removendo}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmarRemocaoSeguraAncora()} disabled={removendo}>
              {removendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Confirmar remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
