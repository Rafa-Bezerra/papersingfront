'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, ListChecks, Loader2, Trash2, UserSearch, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  AlcadaLoteRemoverModo,
  AlcadaPorUsuarioLinha,
  getAlcadasPorUsuario,
  removerAprovadorEmLote,
} from '@/services/alcadasService'
import { getUsuariosAprovadores, Usuario } from '@/services/usuariosService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { stripDiacritics, toMoney } from '@/utils/functions'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
  podeTrocarUnidade: boolean
  podeEditar?: boolean
  onAbrirCentro?: (centroCusto: string) => void
}

function faixaValor(inicio: number, fim: number) {
  const ini = toMoney(inicio)
  if (fim <= 0) return `${ini} a sem limite`
  return `${ini} a ${toMoney(fim)}`
}

function escapeCsv(c: string) {
  if (/[;"\r\n]/.test(c)) return `"${c.replace(/"/g, '""')}"`
  return c
}

const REMOCAO_ALCADA_OPCOES: {
  modo: AlcadaLoteRemoverModo
  titulo: string
  descricao: string
  exemplo: string
  variant: 'outline' | 'destructive'
  buttonClass?: string
}[] = [
  {
    modo: 'usuario',
    titulo: 'Só o usuário consultado',
    descricao:
      'Remove unicamente o login que você pesquisou, nas linhas da lista (cada combinação CC + nível). Ninguém mais é afetado no mesmo nível.',
    exemplo: 'Ex.: tirar o akazuo do nível 1 nos CC filtrados; os outros aprovadores do nível 1 continuam.',
    variant: 'outline',
    buttonClass: 'border-destructive/40 text-destructive hover:bg-destructive/10',
  },
  {
    modo: 'todos_nivel',
    titulo: 'Todos aprovadores do nível',
    descricao:
      'Para cada linha listada, apaga todo mundo daquele nível de aprovação naquele centro de custo — não só o usuário consultado.',
    exemplo: 'Ex.: na linha “CC X · nível 2”, remove todos os aprovadores do nível 2 naquele CC.',
    variant: 'destructive',
  },
  {
    modo: 'todos_centro',
    titulo: 'Toda a alçada do CC',
    descricao:
      'Para cada centro de custo que aparece na lista, remove todos os aprovadores de todos os níveis. O CC fica sem alçada na unidade.',
    exemplo: 'Ex.: no CC X some nível 1, 2, 3… — use só quando quiser esvaziar a alçada do centro.',
    variant: 'destructive',
    buttonClass: 'bg-destructive/90',
  },
]

function tituloDialogRemocao(modo: AlcadaLoteRemoverModo) {
  return REMOCAO_ALCADA_OPCOES.find((o) => o.modo === modo)?.titulo ?? 'Confirmar remoção'
}

export default function AlcadasPorUsuario({ unidadeLogada, podeTrocarUnidade, podeEditar = false, onAbrirCentro }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuario, setUsuario] = useState('')
  const [unidadeConsulta, setUnidadeConsulta] = useState(unidadeLogada)
  const [comboAberto, setComboAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [dados, setDados] = useState<Awaited<ReturnType<typeof getAlcadasPorUsuario>> | null>(null)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [dialogRemover, setDialogRemover] = useState(false)
  const [modoRemocao, setModoRemocao] = useState<AlcadaLoteRemoverModo>('usuario')
  const [motivoRemocao, setMotivoRemocao] = useState('')
  const [removendo, setRemovendo] = useState(false)
  const carregouUsuarios = useRef(false)

  useEffect(() => {
    setUnidadeConsulta(unidadeLogada)
  }, [unidadeLogada])

  useEffect(() => {
    if (carregouUsuarios.current) return
    void (async () => {
      try {
        setUsuarios(await getUsuariosAprovadores())
        carregouUsuarios.current = true
      } catch {
        setUsuarios([])
      }
    })()
  }, [])

  const nomeUsuario = usuarios.find((u) => u.codusuario === usuario)?.nome

  async function consultar() {
    const login = usuario.trim()
    if (!login) {
      toast.error('Selecione um usuário.')
      return
    }
    setCarregando(true)
    setDados(null)
    setMarcados(new Set())
    try {
      const unidade = podeTrocarUnidade && unidadeConsulta.trim() ? unidadeConsulta.trim() : undefined
      setDados(await getAlcadasPorUsuario(login, unidade))
    } catch (e) {
      mostrarErro(e)
    } finally {
      setCarregando(false)
    }
  }

  const linhasFiltradas = useMemo(() => {
    if (!dados?.linhas) return []
    const q = stripDiacritics(filtro.toLowerCase().trim())
    if (!q) return dados.linhas
    return dados.linhas.filter((l) => {
      const blob = [l.centro_custo, l.centro_custo_nome].join(' ').toLowerCase()
      return stripDiacritics(blob).includes(q)
    })
  }, [dados, filtro])

  function alternarMarcado(id: number) {
    setMarcados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function marcarFiltrados() {
    setMarcados(new Set(linhasFiltradas.map((l) => l.id)))
  }

  function desmarcarFiltrados() {
    setMarcados((prev) => {
      const next = new Set(prev)
      for (const l of linhasFiltradas) next.delete(l.id)
      return next
    })
  }

  function linhasParaMarcados(ids: Set<number>) {
    return (dados?.linhas ?? []).filter((l) => ids.has(l.id))
  }

  function abrirRemover(modo: AlcadaLoteRemoverModo, ids?: Set<number>) {
    setModoRemocao(modo)
    if (ids) setMarcados(new Set(ids))
    else if (marcados.size === 0) setMarcados(new Set(linhasFiltradas.map((l) => l.id)))
    setDialogRemover(true)
  }

  function abrirRemoverTodasListadas(modo: AlcadaLoteRemoverModo) {
    abrirRemover(modo, new Set(linhasFiltradas.map((l) => l.id)))
  }

  const linhasMarcadas = useMemo(() => linhasParaMarcados(marcados), [dados, marcados])

  const resumoRemocao = useMemo(() => {
    const linhas = linhasMarcadas
    const centros = new Set(linhas.map((l) => l.id_alcada))
    if (modoRemocao === 'usuario') {
      return { linhas: linhas.length, centros: centros.size, aprovadores: linhas.length }
    }
    const porNivel = new Map<string, number>()
    for (const l of linhas) {
      const k = `${l.id_alcada}:${l.nivel}`
      if (!porNivel.has(k)) porNivel.set(k, l.qtd_no_nivel)
    }
    if (modoRemocao === 'todos_nivel') {
      const aprovadores = [...porNivel.values()].reduce((a, b) => a + b, 0)
      return { linhas: linhas.length, centros: centros.size, aprovadores, paresNivel: porNivel.size }
    }
    return { linhas: linhas.length, centros: centros.size, aprovadores: null as number | null }
  }, [linhasMarcadas, modoRemocao])

  const todosFiltradosMarcados =
    linhasFiltradas.length > 0 && linhasFiltradas.every((l) => marcados.has(l.id))

  async function confirmarRemocao() {
    if (!dados || marcados.size === 0) return
    setRemovendo(true)
    try {
      const unidade =
        podeTrocarUnidade && unidadeConsulta.trim() ? unidadeConsulta.trim() : dados.unidade
      const r = await removerAprovadorEmLote({
        modo: modoRemocao,
        usuario: dados.usuario,
        unidade,
        ids_aprovador: [...marcados],
        motivo: motivoRemocao.trim() || undefined,
      })
      const msgModo =
        r.modo === 'todos_centro'
          ? `Removidos ${r.removidos} aprovador(es) em ${r.centros_referencia} centro(s) de custo (todos os níveis).`
          : r.modo === 'todos_nivel'
            ? `Removidos ${r.removidos} aprovador(es) do nível da linha em ${r.centros_referencia} centro(s).`
            : `${dados.usuario} removido de ${r.removidos} alçada(s).`
      toast.success(`${msgModo} Registro no histórico (auditoria).`)
      setDialogRemover(false)
      setMotivoRemocao('')
      setMarcados(new Set())
      await consultar()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setRemovendo(false)
    }
  }

  const colunas = useMemo<ColumnDef<AlcadaPorUsuarioLinha>[]>(
    () => [
      ...(podeEditar
        ? [
            {
              id: 'marcar',
              header: () => (
                <Checkbox
                  checked={todosFiltradosMarcados}
                  onCheckedChange={(v) => (v === true ? marcarFiltrados() : desmarcarFiltrados())}
                  aria-label="Marcar ou desmarcar todas as linhas visíveis"
                />
              ),
              cell: ({ row }: { row: { original: AlcadaPorUsuarioLinha } }) => (
                <Checkbox
                  checked={marcados.has(row.original.id)}
                  onCheckedChange={() => alternarMarcado(row.original.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Selecionar ${row.original.centro_custo}`}
                />
              ),
              enableSorting: false,
            } satisfies ColumnDef<AlcadaPorUsuarioLinha>,
          ]
        : []),
      { accessorKey: 'centro_custo', header: 'Conta (centro de custo)' },
      { accessorKey: 'centro_custo_nome', header: 'Nome do centro de custo' },
      { accessorKey: 'nivel', header: 'Ordem (nível)' },
      {
        id: 'faixa',
        header: 'Faixa de valor',
        cell: ({ row }) => faixaValor(row.original.valor_inicial, row.original.valor_final),
      },
      { accessorKey: 'cargo', header: 'Cargo' },
      { accessorKey: 'situacao', header: 'Situação' },
      {
        id: 'outros',
        header: 'Outros do mesmo nível',
        cell: ({ row }) => (
          <span title="A regra exige que todos os aprovadores deste nível aprovem">
            {row.original.qtd_no_nivel}
          </span>
        ),
      },
      {
        id: 'visivel',
        header: 'Visível na lista',
        cell: ({ row }) =>
          row.original.visivel_na_lista ? (
            <Badge variant="secondary">Sim</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
              Não
            </Badge>
          ),
      },
    ],
    [podeEditar, marcados, todosFiltradosMarcados, filtro]
  )

  async function exportarCsv() {
    if (!dados?.linhas.length) {
      toast.info('Nada para exportar.')
      return
    }
    const cab = [
      'Conta',
      'Nome do centro de custo',
      'Ordem (nível)',
      'Valor inicial',
      'Valor final',
      'Faixa',
      'Cargo',
      'Situação',
      'Outros do mesmo nível',
      'Visível na lista',
      'Unidade',
    ]
    const linhas = linhasFiltradas.map((l) =>
      [
        l.centro_custo,
        l.centro_custo_nome,
        String(l.nivel),
        String(l.valor_inicial),
        String(l.valor_final),
        faixaValor(l.valor_inicial, l.valor_final),
        l.cargo,
        l.situacao,
        String(l.qtd_no_nivel),
        l.visivel_na_lista ? 'Sim' : 'Não',
        l.unidade,
      ]
        .map(escapeCsv)
        .join(';')
    )
    const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
    const slug = dados.usuario.replace(/[^\w.-]+/g, '_')
    await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `alcadas-por-usuario-${slug}.csv`)
    toast.success('CSV exportado.')
  }

  const resumoNiveis =
    dados?.resumo.por_nivel.map((n) => `Nível ${n.nivel}: ${n.quantidade}`).join(' · ') ?? ''

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alçadas por usuário</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulte o usuário e use <strong>remover como aprovador em lote</strong> — vários centros de custo de uma
            vez, sem abrir cada alçada na guia Centros de custo. A remoção fica no histórico (AUDIT_LOG). Inclui logins
            com o mesmo e-mail no GUSUARIO.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="grid min-w-[16rem] flex-1 gap-2">
            <Label>Usuário</Label>
            <Popover modal open={comboAberto} onOpenChange={setComboAberto}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">
                    {nomeUsuario ? `${usuario} — ${nomeUsuario}` : usuario || 'Selecione o usuário'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent className="z-[9999] w-[min(100vw-2rem,28rem)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por login ou nome..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {usuarios.map((u) => (
                          <CommandItem
                            key={u.codusuario}
                            value={`${u.codusuario} - ${u.nome}`}
                            onSelect={() => {
                              setUsuario(u.codusuario)
                              setComboAberto(false)
                            }}
                          >
                            {`${u.codusuario} - ${u.nome}`}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </PopoverPortal>
            </Popover>
          </div>

          {podeTrocarUnidade && (
            <div className="grid min-w-[12rem] gap-2">
              <Label htmlFor="unidade-por-usuario">Unidade</Label>
              <Input
                id="unidade-por-usuario"
                value={unidadeConsulta}
                onChange={(e) => setUnidadeConsulta(e.target.value)}
                placeholder="Ex.: WAY 306"
              />
            </div>
          )}

          <Button type="button" onClick={() => void consultar()} disabled={carregando} className="flex items-center">
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
            {carregando ? 'Consultando…' : 'Consultar'}
          </Button>
        </CardContent>
      </Card>

      {dados && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total de alçadas (linhas)</p>
                <p className="text-2xl font-bold tabular-nums">{dados.resumo.total_linhas}</p>
                <p className="truncate text-xs text-muted-foreground" title={dados.usuario}>
                  {dados.usuario}
                  {nomeUsuario ? ` · ${nomeUsuario}` : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Centros de custo distintos</p>
                <p className="text-2xl font-bold tabular-nums">{dados.resumo.total_centros_distintos}</p>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardContent className="pt-4">
                <p className="mb-1 text-xs text-muted-foreground">Por nível</p>
                <p className="text-sm">{resumoNiveis || '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Unidade: {dados.unidade}</p>
              </CardContent>
            </Card>
          </div>

          {podeEditar && dados.linhas.length > 0 && (
            <Card className="border-destructive/25 bg-destructive/[0.04]">
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <ListChecks className="h-4 w-4" /> Remoção em lote — alçadas (aprovadores)
                  </p>
                  <p className="text-xs text-muted-foreground max-w-3xl">
                    Ações sobre <strong>aprovadores da alçada</strong>, não sobre vínculo CC×usuário do RM (isso fica em{' '}
                    <strong>Centros de custos → Comparação</strong>). Use o filtro abaixo para limitar quais linhas entram
                    no lote.
                    {filtro.trim()
                      ? ` Agora: ${linhasFiltradas.length} linha(s) visível(is) de ${dados.linhas.length}.`
                      : ` ${dados.linhas.length} linha(s) na consulta de ${dados.usuario}.`}
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {REMOCAO_ALCADA_OPCOES.map((op) => (
                    <div
                      key={op.modo}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-background/80 p-3"
                    >
                      <p className="text-sm font-medium leading-snug">{op.titulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{op.descricao}</p>
                      <p className="text-xs text-muted-foreground/90 italic leading-relaxed">{op.exemplo}</p>
                      <Button
                        type="button"
                        variant={op.variant}
                        className={`mt-auto w-full justify-start text-left h-auto min-h-9 py-2 whitespace-normal ${op.buttonClass ?? ''}`}
                        disabled={linhasFiltradas.length === 0}
                        onClick={() => abrirRemoverTodasListadas(op.modo)}
                      >
                        <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                        Aplicar nas {linhasFiltradas.length} linha(s) listada(s)
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-md flex-1">
                  <Input
                    placeholder="Filtrar por conta ou nome do centro de custo…"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="pr-9"
                  />
                  {filtro && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                      onClick={() => setFiltro('')}
                      aria-label="Limpar filtro"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportarCsv()} disabled={!linhasFiltradas.length}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
                {podeEditar && linhasFiltradas.length > 0 && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={marcarFiltrados}>
                      Marcar filtrados ({linhasFiltradas.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={marcados.size === 0}
                      onClick={() => setMarcados(new Set())}
                    >
                      Limpar marcação
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive"
                      disabled={marcados.size === 0}
                      title="Remove só o usuário consultado nas linhas marcadas"
                      onClick={() => abrirRemover('usuario')}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Só o usuário · {marcados.size} linha(s)
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={marcados.size === 0}
                      title="Remove todos os aprovadores do nível de cada linha marcada"
                      onClick={() => abrirRemover('todos_nivel')}
                    >
                      Todos do nível · {marcados.size} linha(s)
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={marcados.size === 0}
                      title="Remove toda a alçada (todos os níveis) de cada CC das linhas marcadas"
                      onClick={() => abrirRemover('todos_centro')}
                    >
                      Toda a alçada do CC · {marcados.size} linha(s)
                    </Button>
                  </>
                )}
              </div>
              <DataTable
                columns={colunas}
                data={linhasFiltradas}
                loading={carregando}
                hideSearch
                onRowClick={
                  podeEditar
                    ? (linha) => alternarMarcado(linha.id)
                    : onAbrirCentro
                      ? (linha) => onAbrirCentro(linha.centro_custo)
                      : undefined
                }
              />
              {dados.resumo.total_linhas === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Este usuário não está em nenhuma alçada nesta unidade.
                </p>
              )}
              {podeEditar && linhasFiltradas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Clique na linha ou use o checkbox para incluir no lote de remoção.
                </p>
              )}
              {!podeEditar && onAbrirCentro && linhasFiltradas.length > 0 && (
                <p className="text-xs text-muted-foreground">Clique na linha para localizar o centro na guia Centros de custo.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!dados && !carregando && (
        <p className="text-center text-sm text-muted-foreground">Selecione um usuário e clique em Consultar.</p>
      )}

      <Dialog open={dialogRemover} onOpenChange={setDialogRemover}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tituloDialogRemocao(modoRemocao)}</DialogTitle>
            <DialogDescription asChild>
              {dados && (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Unidade <strong className="text-foreground">{dados.unidade}</strong> · usuário consultado{' '}
                    <strong className="text-foreground">{dados.usuario}</strong> ·{' '}
                    <strong className="text-foreground">{resumoRemocao.centros}</strong> centro(s) ·{' '}
                    <strong className="text-foreground">{marcados.size}</strong> linha(s) de referência
                  </p>
                  <p className="text-foreground font-medium">O que vai acontecer:</p>
                  <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed">
                    {modoRemocao === 'usuario' && (
                      <>
                        <li>
                          Serão apagadas cerca de{' '}
                          <strong className="text-foreground">{resumoRemocao.aprovadores}</strong> linha(s) em que só
                          participa <strong className="text-foreground">{dados.usuario}</strong>.
                        </li>
                        <li>Outros aprovadores no mesmo nível do mesmo CC não são removidos.</li>
                      </>
                    )}
                    {modoRemocao === 'todos_nivel' && (
                      <>
                        <li>
                          Em cada linha marcada, <strong className="text-foreground">todos</strong> os aprovadores
                          daquele <strong className="text-foreground">nível</strong> naquele CC são removidos (inclui
                          colegas além de {dados.usuario}).
                        </li>
                        <li>
                          Estimativa: <strong className="text-foreground">{resumoRemocao.aprovadores ?? '—'}</strong>{' '}
                          registro(s) no total.
                        </li>
                      </>
                    )}
                    {modoRemocao === 'todos_centro' && (
                      <>
                        <li className="text-destructive">
                          Em cada CC das linhas marcadas, <strong>todos os níveis</strong> da alçada são esvaziados — o
                          centro fica sem aprovadores na unidade.
                        </li>
                        <li>Confira o filtro da tabela antes de confirmar; esta é a opção mais abrangente.</li>
                      </>
                    )}
                  </ul>
                  <p className="text-xs">Troque o tipo de remoção antes de confirmar, se precisar:</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {REMOCAO_ALCADA_OPCOES.map((op) => (
                      <Button
                        key={op.modo}
                        type="button"
                        variant={modoRemocao === op.modo ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setModoRemocao(op.modo)}
                      >
                        {op.titulo}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="motivo-remocao-alcada">Motivo (opcional, recomendado)</Label>
            <Input
              id="motivo-remocao-alcada"
              value={motivoRemocao}
              onChange={(e) => setMotivoRemocao(e.target.value)}
              placeholder="Ex.: desligamento, troca de função…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogRemover(false)} disabled={removendo}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmarRemocao()} disabled={removendo}>
              {removendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
