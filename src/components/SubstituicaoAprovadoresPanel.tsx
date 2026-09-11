'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import {
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  RefreshCw,
  SearchIcon,
  SquarePlus,
  UserCog,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { PopoverPortal } from '@radix-ui/react-popover'
import { stripDiacritics } from '@/utils/functions'
import {
  SubstituicaoLinha,
  SubstituicaoPeriodo,
  SubstituicaoUsuario,
  aplicarSubstituicao,
  buscarUsuariosSubstituicao,
  encerrarSubstituicao,
  listarPeriodos,
  previewTitular,
} from '@/services/substituicaoAprovadoresService'

function formatarDataBr(iso: string) {
  if (!iso) return ''
  const parte = iso.slice(0, 10)
  const [y, m, d] = parte.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function hojeIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function somarDiasIso(baseIso: string, dias: number) {
  const d = new Date(`${baseIso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Diferença em dias entre duas datas ISO (yyyy-MM-dd). Mínimo 1. */
function diffDiasIso(inicioIso: string, fimIso: string) {
  const a = new Date(`${inicioIso}T12:00:00`)
  const b = new Date(`${fimIso}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return Math.max(1, dias)
}

function UsuarioCombobox({
  label,
  placeholder,
  value,
  selected,
  options,
  loading,
  onSearch,
  onSelect,
}: {
  label: string
  placeholder: string
  value: string
  selected: SubstituicaoUsuario | null
  options: SubstituicaoUsuario[]
  loading: boolean
  onSearch: (q: string) => void
  onSelect: (u: SubstituicaoUsuario) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {selected
                ? `${selected.nome} (${selected.codusuario})`
                : value
                  ? value
                  : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50 size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[320px] pointer-events-auto z-[9999]"
            onClick={(e) => e.stopPropagation()}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Digite login ou nome…"
                onValueChange={(v) => onSearch(v)}
              />
              <CommandList>
                <CommandEmpty>
                  {loading ? 'Buscando…' : 'Nenhum usuário encontrado.'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((u) => (
                    <CommandItem
                      key={u.codusuario}
                      value={`${u.codusuario} ${u.nome}`}
                      onSelect={() => {
                        onSelect(u)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          value === u.codusuario ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span>
                        {u.nome} ({u.codusuario})
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </div>
  )
}

export default function SubstituicaoAprovadoresPanel() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [results, setResults] = useState<SubstituicaoPeriodo[]>([])
  const [loading, setLoading] = useState(false)
  const [ehAdmin, setEhAdmin] = useState<boolean | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [titular, setTitular] = useState('')
  const [titularSel, setTitularSel] = useState<SubstituicaoUsuario | null>(null)
  const [substituto, setSubstituto] = useState('')
  const [substitutoSel, setSubstitutoSel] = useState<SubstituicaoUsuario | null>(null)
  const [opcoesTitular, setOpcoesTitular] = useState<SubstituicaoUsuario[]>([])
  const [opcoesSubstituto, setOpcoesSubstituto] = useState<SubstituicaoUsuario[]>([])
  const [buscandoTitular, setBuscandoTitular] = useState(false)
  const [buscandoSubstituto, setBuscandoSubstituto] = useState(false)
  const [dataInicio, setDataInicio] = useState(hojeIso())
  const [dataFim, setDataFim] = useState(somarDiasIso(hojeIso(), 15))
  const [dias, setDias] = useState(15)
  const [observacao, setObservacao] = useState('')
  const [preview, setPreview] = useState<SubstituicaoLinha[]>([])
  const [previewResumo, setPreviewResumo] = useState<
    { unidade: string; qtd: number }[]
  >([])
  const [carregandoPreview, setCarregandoPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [encerrandoId, setEncerrandoId] = useState<number | null>(null)

  const resumo = useMemo(() => {
    const ativas = results.filter((r) => r.status === 'ATIVA').length
    const encerradas = results.filter((r) => r.status === 'ENCERRADA').length
    const alcadasAtivas = results
      .filter((r) => r.status === 'ATIVA')
      .reduce((acc, r) => acc + (r.qtd_linhas || 0), 0)
    return { ativas, encerradas, alcadasAtivas, total: results.length }
  }, [results])

  async function carregar() {
    setLoading(true)
    try {
      const lista = await listarPeriodos(query, status)
      setResults(lista)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar substituições.')
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
      } catch {
        /* ignore */
      }
    }
    setEhAdmin(admin)
    if (!admin) {
      toast.error('Somente administrador acessa Substituição de Aprovadores.')
      return
    }
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarTitulares(q: string) {
    setBuscandoTitular(true)
    try {
      const lista = await buscarUsuariosSubstituicao(q, true)
      const norm = stripDiacritics(q).toLowerCase()
      const filtrada = norm
        ? lista.filter(
            (u) =>
              stripDiacritics(u.codusuario).toLowerCase().includes(norm) ||
              stripDiacritics(u.nome).toLowerCase().includes(norm)
          )
        : lista
      setOpcoesTitular(filtrada)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao buscar titular.')
    } finally {
      setBuscandoTitular(false)
    }
  }

  async function buscarSubstitutos(q: string) {
    setBuscandoSubstituto(true)
    try {
      const lista = await buscarUsuariosSubstituicao(q, false)
      const norm = stripDiacritics(q).toLowerCase()
      const filtrada = norm
        ? lista.filter(
            (u) =>
              stripDiacritics(u.codusuario).toLowerCase().includes(norm) ||
              stripDiacritics(u.nome).toLowerCase().includes(norm)
          )
        : lista
      setOpcoesSubstituto(filtrada)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao buscar substituto.')
    } finally {
      setBuscandoSubstituto(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void carregar()
  }

  function abrirNovo() {
    const inicio = hojeIso()
    const qtd = 15
    setTitular('')
    setTitularSel(null)
    setSubstituto('')
    setSubstitutoSel(null)
    setOpcoesTitular([])
    setOpcoesSubstituto([])
    setDataInicio(inicio)
    setDias(qtd)
    setDataFim(somarDiasIso(inicio, qtd))
    setObservacao('')
    setPreview([])
    setPreviewResumo([])
    setFormOpen(true)
    void buscarTitulares('')
    void buscarSubstitutos('')
  }

  function onDiasChange(valor: number) {
    const n = Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1
    setDias(n)
    // quantidade → atualiza data fim no calendário
    setDataFim(somarDiasIso(dataInicio || hojeIso(), n))
  }

  function onInicioChange(valor: string) {
    const inicio = valor || hojeIso()
    setDataInicio(inicio)
    // mantém a quantidade e recalcula o término
    setDataFim(somarDiasIso(inicio, dias))
  }

  function onFimChange(valor: string) {
    const inicio = dataInicio || hojeIso()
    let fim = valor || inicio
    // se o fim ficar antes do início, iguala e usa 1 dia
    if (fim < inicio) fim = inicio
    setDataFim(fim)
    // calendário → atualiza quantidade de dias
    setDias(diffDiasIso(inicio, fim))
  }

  async function carregarPreview() {
    if (!titular.trim()) {
      toast.error('Selecione o titular (quem sai de férias).')
      return
    }
    setCarregandoPreview(true)
    try {
      const r = await previewTitular(titular.trim())
      setPreview(r.linhas)
      setPreviewResumo(r.por_unidade)
      if (r.total === 0) {
        toast.message('Nenhuma alçada encontrada para este titular (todas as unidades).')
      } else {
        const detalhe = r.por_unidade
          .map((p) => `${p.unidade}: ${p.qtd}`)
          .join(' · ')
        toast.success(
          `${r.total} alçada(s) em todas as unidades${detalhe ? ` (${detalhe})` : ''}.`
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao pré-visualizar.')
    } finally {
      setCarregandoPreview(false)
    }
  }

  async function salvar() {
    if (!titular.trim() || !substituto.trim()) {
      toast.error('Informe titular e substituto.')
      return
    }
    if (titular.trim().toLowerCase() === substituto.trim().toLowerCase()) {
      toast.error('Titular e substituto devem ser diferentes.')
      return
    }
    if (!dataInicio || !dataFim) {
      toast.error('Informe o período.')
      return
    }
    if (dataFim < dataInicio) {
      toast.error('Data fim deve ser maior ou igual à data início.')
      return
    }

    setSalvando(true)
    try {
      const r = await aplicarSubstituicao({
        titular: titular.trim(),
        substituto: substituto.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacao: observacao.trim() || undefined,
      })
      toast.success(
        `Substituição #${r.id} aplicada: ${r.afetados} alçada(s) em todas as unidades.`
      )
      setFormOpen(false)
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aplicar.')
    } finally {
      setSalvando(false)
    }
  }

  async function encerrar(id: number) {
    if (!confirm('Encerrar agora e devolver as alçadas ao titular?')) return
    setEncerrandoId(id)
    try {
      const r = await encerrarSubstituicao(id)
      toast.success(`Encerrada. ${r.afetados} alçada(s) voltaram ao titular.`)
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao encerrar.')
    } finally {
      setEncerrandoId(null)
    }
  }

  const colunas = useMemo<ColumnDef<SubstituicaoPeriodo>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            #{row.original.id}
          </span>
        ),
      },
      {
        id: 'titular',
        header: 'Titular',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="min-w-[140px]">
              <div className="font-medium leading-tight">
                {r.nome_titular || r.titular}
              </div>
              {r.nome_titular ? (
                <div className="text-xs text-muted-foreground">{r.titular}</div>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'substituto',
        header: 'Substituto',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="min-w-[140px]">
              <div className="font-medium leading-tight">
                {r.nome_substituto || r.substituto}
              </div>
              {r.nome_substituto ? (
                <div className="text-xs text-muted-foreground">{r.substituto}</div>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'periodo',
        header: 'Período',
        cell: ({ row }) => (
          <div className="text-sm whitespace-nowrap">
            <div>{formatarDataBr(row.original.data_inicio)}</div>
            <div className="text-xs text-muted-foreground">
              até {formatarDataBr(row.original.data_fim)}
            </div>
          </div>
        ),
      },
      {
        id: 'dias',
        header: 'Dias',
        cell: ({ row }) => {
          const s = row.original
          if (s.status !== 'ATIVA') {
            return <span className="text-muted-foreground">—</span>
          }
          const d = s.dias_restantes
          if (d == null) return '—'
          if (d < 0) {
            return <Badge variant="destructive">Expirada</Badge>
          }
          return (
            <Badge variant={d <= 3 ? 'destructive' : 'secondary'}>
              {d} dia{d === 1 ? '' : 's'}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'qtd_linhas',
        header: 'Alçadas',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {row.original.qtd_linhas}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'ATIVA' ? (
            <Badge className="bg-emerald-600/90 hover:bg-emerald-600 text-white border-0">
              Ativa
            </Badge>
          ) : (
            <Badge variant="outline">Encerrada</Badge>
          ),
      },
      {
        id: 'acoes',
        header: 'Ações',
        cell: ({ row }) => {
          const s = row.original
          if (s.status !== 'ATIVA') return null
          return (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              disabled={encerrandoId === s.id}
              onClick={() => void encerrar(s.id)}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {encerrandoId === s.id ? 'Encerrando…' : 'Devolver'}
            </Button>
          )
        },
      },
    ],
    [encerrandoId]
  )

  const colunasPreview = useMemo<ColumnDef<SubstituicaoLinha>[]>(
    () => [
      {
        accessorKey: 'unidade',
        header: 'Unidade',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.unidade}</Badge>
        ),
      },
      { accessorKey: 'id_alcada', header: 'ID alçada' },
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' },
      {
        id: 'aprovador',
        header: 'Aprovador atual',
        accessorFn: (r) =>
          r.nome_aprovador_atual
            ? `${r.nome_aprovador_atual} (${r.aprovador_atual})`
            : r.aprovador_atual,
      },
      { accessorKey: 'nivel', header: 'Nível' },
      { accessorKey: 'cargo', header: 'Cargo' },
    ],
    []
  )

  if (ehAdmin === false) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Acesso restrito a administradores.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <UserCog className="h-6 w-6 text-primary" />
                  Substituição de Aprovadores
                </CardTitle>
                <Badge variant="secondary">WAY CSC</Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Transfere temporariamente as alçadas do titular para um substituto
                em <span className="font-medium text-foreground">todas as unidades</span>.
                Ao fim do período, voltam automaticamente.
              </p>
            </div>
            <Button onClick={abrirNovo} className="shrink-0 h-11 px-5">
              <SquarePlus className="mr-2 h-4 w-4" />
              Nova substituição
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Ativas
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {resumo.ativas}
              </div>
              <div className="text-xs text-muted-foreground">
                {resumo.alcadasAtivas} alçada(s) cobertas
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Encerradas
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {resumo.encerradas}
              </div>
              <div className="text-xs text-muted-foreground">histórico nesta lista</div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total listado
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{resumo.total}</div>
              <div className="text-xs text-muted-foreground">com o filtro atual</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por titular, substituto ou login…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11 pl-9 pr-10"
                aria-label="Campo de busca"
              />
              {query && (
                <button
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  onClick={() => setQuery('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                // recarrega com o novo filtro após o state atualizar
                setTimeout(() => {
                  setLoading(true)
                  listarPeriodos(query, v)
                    .then(setResults)
                    .catch((err) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Falha ao carregar.'
                      )
                    )
                    .finally(() => setLoading(false))
                }, 0)
              }}
            >
              <SelectTrigger className="h-11 w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ATIVA">Somente ativas</SelectItem>
                <SelectItem value="ENCERRADA">Somente encerradas</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-11"
              onClick={() => void carregar()}
              disabled={loading}
            >
              <SearchIcon className="mr-2 h-4 w-4" />
              {loading ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {!loading && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ArrowRightLeft className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Nenhuma substituição encontrada</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Crie uma nova para cobrir férias ou ausência. O substituto assume
                as alçadas do titular em todas as unidades até o fim do período.
              </p>
              <Button className="mt-6 h-11 px-5" onClick={abrirNovo}>
                <SquarePlus className="mr-2 h-4 w-4" />
                Nova substituição
              </Button>
            </div>
          ) : (
            <DataTable
              columns={colunas}
              data={results}
              loading={loading}
              hideSearch
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          scrollBody={false}
          className="sm:max-w-5xl w-[min(96vw,1100px)] max-h-[92dvh] gap-0 p-0"
        >
          <div className="flex max-h-[92dvh] flex-col">
            <div className="shrink-0 border-b px-6 py-4 pr-12">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Nova substituição
                </DialogTitle>
                <p className="text-sm text-muted-foreground text-left">
                  Cobre todas as unidades do titular. A UNIDADE de cada alçada não muda.
                </p>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <UsuarioCombobox
                  label="Titular (quem sai)"
                  placeholder="Buscar aprovador por login ou nome…"
                  value={titular}
                  selected={titularSel}
                  options={opcoesTitular}
                  loading={buscandoTitular}
                  onSearch={(q) => void buscarTitulares(q)}
                  onSelect={(u) => {
                    setTitular(u.codusuario)
                    setTitularSel(u)
                    setPreview([])
                    setPreviewResumo([])
                  }}
                />

                <UsuarioCombobox
                  label="Substituto (quem assume)"
                  placeholder="Buscar usuário por login ou nome…"
                  value={substituto}
                  selected={substitutoSel}
                  options={opcoesSubstituto}
                  loading={buscandoSubstituto}
                  onSearch={(q) => void buscarSubstitutos(q)}
                  onSelect={(u) => {
                    setSubstituto(u.codusuario)
                    setSubstitutoSel(u)
                  }}
                />
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">Período</Label>
                  <Badge variant="secondary" className="font-normal">
                    {formatarDataBr(dataInicio)} → {formatarDataBr(dataFim)} · {dias} dia
                    {dias === 1 ? '' : 's'}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Data início</Label>
                    <Input
                      type="date"
                      className="h-11"
                      value={dataInicio}
                      onChange={(e) => onInicioChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de dias</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-11"
                      value={dias}
                      onChange={(e) => onDiasChange(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data fim</Label>
                    <Input
                      type="date"
                      className="h-11"
                      value={dataFim}
                      min={dataInicio}
                      onChange={(e) => onFimChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: férias 15 dias"
                  rows={2}
                  className="resize-none"
                />
              </div>

              {preview.length > 0 && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        Prévia — {preview.length} alçada(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Estas linhas serão transferidas ao substituto
                      </p>
                    </div>
                    {previewResumo.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {previewResumo.map((p) => (
                          <Badge key={p.unidade} variant="outline">
                            {p.unidade}: {p.qtd}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="max-h-[280px] overflow-auto rounded-lg border">
                    <DataTable
                      columns={colunasPreview}
                      data={preview}
                      loading={carregandoPreview}
                      hideSearch
                      hidePagination
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t bg-background px-6 py-4 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={carregandoPreview || !titular}
                onClick={() => void carregarPreview()}
              >
                {carregandoPreview ? 'Carregando…' : 'Pré-visualizar alçadas'}
              </Button>
              <Button
                type="button"
                className="h-11 min-w-[180px]"
                disabled={salvando || !titular || !substituto}
                onClick={() => void salvar()}
              >
                {salvando ? 'Aplicando…' : 'Aplicar substituição'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
