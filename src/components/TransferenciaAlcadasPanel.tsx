'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import {
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  SearchIcon,
  SquarePlus,
  UserMinus,
  UserPlus,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  TransferenciaHistorico,
  TransferenciaLinha,
  TransferenciaPreview,
  TransferenciaTipo,
  aplicarTransferencia,
  buscarUsuariosTransferencia,
  listarHistoricoTransferencia,
  previewTransferencia,
  unidadesDoAprovador,
} from '@/services/transferenciaAlcadasService'
import { SubstituicaoUsuario } from '@/services/substituicaoAprovadoresService'

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
          <Button type="button" variant="outline" className="h-11 w-full justify-between font-normal">
            <span className="truncate text-left">
              {selected ? `${selected.nome} (${selected.codusuario})` : value || placeholder}
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
                <CommandEmpty>{loading ? 'Buscando…' : 'Nenhum usuário encontrado.'}</CommandEmpty>
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
                        className={`mr-2 h-4 w-4 ${value === u.codusuario ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {u.nome} ({u.codusuario})
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

function UnidadeMultiSelect({
  label,
  opcoes,
  selecionadas,
  onChange,
}: {
  label: string
  opcoes: { unidade: string; qtd: number }[]
  selecionadas: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(u: string, checked: boolean) {
    if (checked) onChange([...selecionadas, u])
    else onChange(selecionadas.filter((x) => x !== u))
  }

  if (opcoes.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">Nenhuma unidade com alçada para este usuário.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange(
              selecionadas.length === opcoes.length ? [] : opcoes.map((o) => o.unidade)
            )
          }
        >
          {selecionadas.length === opcoes.length ? 'Limpar' : 'Todas'}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-3 max-h-40 overflow-auto">
        {opcoes.map((o) => {
          const checked = selecionadas.includes(o.unidade)
          return (
            <label key={o.unidade} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggle(o.unidade, v === true)}
              />
              <span className="font-medium">{o.unidade}</span>
              <span className="text-muted-foreground">({o.qtd})</span>
            </label>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Vazio = todas as unidades listadas acima.
      </p>
    </div>
  )
}

export default function TransferenciaAlcadasPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TransferenciaHistorico[]>([])
  const [loading, setLoading] = useState(false)
  const [ehAdmin, setEhAdmin] = useState<boolean | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [tipo, setTipo] = useState<TransferenciaTipo>('TRANSFERENCIA')

  const [colaborador, setColaborador] = useState('')
  const [colaboradorSel, setColaboradorSel] = useState<SubstituicaoUsuario | null>(null)
  const [destino, setDestino] = useState('')
  const [destinoSel, setDestinoSel] = useState<SubstituicaoUsuario | null>(null)
  const [origem, setOrigem] = useState('')
  const [origemSel, setOrigemSel] = useState<SubstituicaoUsuario | null>(null)

  const [opcoesColab, setOpcoesColab] = useState<SubstituicaoUsuario[]>([])
  const [opcoesDestino, setOpcoesDestino] = useState<SubstituicaoUsuario[]>([])
  const [opcoesOrigem, setOpcoesOrigem] = useState<SubstituicaoUsuario[]>([])
  const [buscando, setBuscando] = useState(false)

  const [unidadesSaidaOpts, setUnidadesSaidaOpts] = useState<{ unidade: string; qtd: number }[]>([])
  const [unidadesEntradaOpts, setUnidadesEntradaOpts] = useState<{ unidade: string; qtd: number }[]>([])
  const [unidadesSaida, setUnidadesSaida] = useState<string[]>([])
  const [unidadesEntrada, setUnidadesEntrada] = useState<string[]>([])

  const [observacao, setObservacao] = useState('')
  const [preview, setPreview] = useState<TransferenciaPreview | null>(null)
  const [carregandoPreview, setCarregandoPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const precisaSaida = tipo === 'DEMISSAO' || tipo === 'TRANSFERENCIA'
  const precisaEntrada = tipo === 'ADMISSAO' || tipo === 'TRANSFERENCIA'

  async function carregar() {
    setLoading(true)
    try {
      setResults(await listarHistoricoTransferencia(query))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let admin = false
    try {
      const raw = sessionStorage.getItem('userData')
      if (raw) admin = Boolean(JSON.parse(raw).admin)
    } catch { /* ignore */ }
    setEhAdmin(admin)
    if (!admin) {
      toast.error('Somente administrador acessa Transferência definitiva.')
      return
    }
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscarUsuarios(q: string, alvo: 'colab' | 'destino' | 'origem') {
    setBuscando(true)
    try {
      const lista = await buscarUsuariosTransferencia(q, alvo === 'origem' || alvo === 'colab')
      const norm = stripDiacritics(q).toLowerCase()
      const filtrada = norm
        ? lista.filter(
            (u) =>
              stripDiacritics(u.codusuario).toLowerCase().includes(norm) ||
              stripDiacritics(u.nome).toLowerCase().includes(norm)
          )
        : lista
      if (alvo === 'colab') setOpcoesColab(filtrada)
      if (alvo === 'destino') setOpcoesDestino(filtrada)
      if (alvo === 'origem') setOpcoesOrigem(filtrada)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao buscar usuários.')
    } finally {
      setBuscando(false)
    }
  }

  async function carregarUnidadesColab(cod: string) {
    try {
      const u = await unidadesDoAprovador(cod)
      setUnidadesSaidaOpts(u)
      setUnidadesSaida(u.map((x) => x.unidade))
    } catch {
      setUnidadesSaidaOpts([])
      setUnidadesSaida([])
    }
  }

  async function carregarUnidadesOrigem(cod: string) {
    try {
      const u = await unidadesDoAprovador(cod)
      setUnidadesEntradaOpts(u)
      setUnidadesEntrada(u.map((x) => x.unidade))
    } catch {
      setUnidadesEntradaOpts([])
      setUnidadesEntrada([])
    }
  }

  function abrirNovo() {
    setTipo('TRANSFERENCIA')
    setColaborador('')
    setColaboradorSel(null)
    setDestino('')
    setDestinoSel(null)
    setOrigem('')
    setOrigemSel(null)
    setUnidadesSaidaOpts([])
    setUnidadesEntradaOpts([])
    setUnidadesSaida([])
    setUnidadesEntrada([])
    setObservacao('')
    setPreview(null)
    setFormOpen(true)
    void buscarUsuarios('', 'colab')
    void buscarUsuarios('', 'destino')
    void buscarUsuarios('', 'origem')
  }

  async function gerarPreview() {
    if (!colaborador) {
      toast.error('Selecione o colaborador.')
      return
    }
    if (precisaSaida && !destino) {
      toast.error('Selecione quem recebe as alçadas cedidas.')
      return
    }
    if (precisaEntrada && !origem) {
      toast.error('Selecione de quem herdar as alçadas.')
      return
    }

    setCarregandoPreview(true)
    try {
      const r = await previewTransferencia({
        colaborador: precisaSaida || precisaEntrada ? colaborador : undefined,
        destinoSaida: precisaSaida ? destino : undefined,
        origemHeranca: precisaEntrada ? origem : undefined,
        unidadesSaida: precisaSaida ? unidadesSaida : undefined,
        unidadesEntrada: precisaEntrada ? unidadesEntrada : undefined,
      })
      setPreview(r)
      toast.success(
        `Prévia: saída ${r.saida.total} · herança ${r.entrada.total}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na prévia.')
    } finally {
      setCarregandoPreview(false)
    }
  }

  async function salvar() {
    if (!colaborador) {
      toast.error('Selecione o colaborador.')
      return
    }
    setSalvando(true)
    try {
      const r = await aplicarTransferencia({
        tipo,
        colaborador,
        destino_saida: precisaSaida ? destino : undefined,
        origem_heranca: precisaEntrada ? origem : undefined,
        unidades_saida: precisaSaida && unidadesSaida.length ? unidadesSaida.join(',') : undefined,
        unidades_entrada:
          precisaEntrada && unidadesEntrada.length ? unidadesEntrada.join(',') : undefined,
        observacao: observacao.trim() || undefined,
      })
      toast.success(
        `Transferência #${r.id}: ${r.qtd_saida} cedida(s), ${r.qtd_entrada} herdada(s).`
      )
      setFormOpen(false)
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao aplicar.')
    } finally {
      setSalvando(false)
    }
  }

  const colunasHist = useMemo<ColumnDef<TransferenciaHistorico>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>
        ),
      },
      {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => <Badge variant="outline">{row.original.tipo}</Badge>,
      },
      {
        id: 'colab',
        header: 'Colaborador',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.nome_colaborador || row.original.colaborador}</div>
            <div className="text-xs text-muted-foreground">{row.original.colaborador}</div>
          </div>
        ),
      },
      {
        id: 'fluxo',
        header: 'Fluxo',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm space-y-1 min-w-[180px]">
              {r.qtd_saida > 0 && (
                <div>
                  Cedeu {r.qtd_saida} → {r.nome_destino || r.destino_saida}
                </div>
              )}
              {r.qtd_entrada > 0 && (
                <div>
                  Herdou {r.qtd_entrada} de {r.nome_origem || r.origem_heranca}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'data',
        header: 'Quando',
        cell: ({ row }) =>
          new Date(row.original.data_criacao).toLocaleString('pt-BR'),
      },
    ],
    []
  )

  const colunasLinha = useMemo<ColumnDef<TransferenciaLinha>[]>(
    () => [
      {
        accessorKey: 'unidade',
        header: 'Unidade',
        cell: ({ row }) => <Badge variant="outline">{row.original.unidade}</Badge>,
      },
      { accessorKey: 'id_alcada', header: 'ID alçada' },
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' },
      { accessorKey: 'nivel', header: 'Nível' },
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
                  <ArrowRightLeft className="h-6 w-6 text-primary" />
                  Transferência definitiva
                </CardTitle>
                <Badge variant="secondary">WAY CSC</Badge>
                <Badge variant="outline">Sem prazo / sem retorno auto</Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Para demissão, admissão ou promoção. Ex.: Constantino sai de 262/153
                (alçadas vão ao novo contratado) e assume as alçadas do aprovador em 306/112.
                As alçadas próprias de quem recebe/cede em outras linhas não são apagadas.
              </p>
            </div>
            <Button onClick={abrirNovo} className="shrink-0 h-11 px-5">
              <SquarePlus className="mr-2 h-4 w-4" />
              Nova transferência
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9 pr-10"
                placeholder="Buscar no histórico…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void carregar()}
              />
              {query && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                  onClick={() => setQuery('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" className="h-11" onClick={() => void carregar()} disabled={loading}>
              <SearchIcon className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {!loading && results.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <ArrowRightLeft className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-lg">Nenhuma transferência registrada</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Use para movimentações permanentes (demissão, admissão ou promoção entre unidades).
              </p>
              <Button className="mt-6 h-11" onClick={abrirNovo}>
                <SquarePlus className="mr-2 h-4 w-4" /> Nova transferência
              </Button>
            </div>
          ) : (
            <DataTable columns={colunasHist} data={results} loading={loading} hideSearch />
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
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Nova transferência definitiva
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      id: 'DEMISSAO' as const,
                      title: 'Demissão',
                      desc: 'Cede alçadas a outro usuário',
                      icon: UserMinus,
                    },
                    {
                      id: 'ADMISSAO' as const,
                      title: 'Admissão',
                      desc: 'Herda alçadas de um aprovador',
                      icon: UserPlus,
                    },
                    {
                      id: 'TRANSFERENCIA' as const,
                      title: 'Transferência',
                      desc: 'Cede as antigas + herda as novas',
                      icon: ArrowRightLeft,
                    },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon
                  const ativo = tipo === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTipo(opt.id)
                        setPreview(null)
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        ativo
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <Icon className="h-4 w-4" />
                        {opt.title}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>

              <UsuarioCombobox
                label={
                  tipo === 'ADMISSAO'
                    ? 'Colaborador admitido (quem recebe)'
                    : 'Colaborador (quem sai / é promovido)'
                }
                placeholder="Buscar por login ou nome…"
                value={colaborador}
                selected={colaboradorSel}
                options={opcoesColab}
                loading={buscando}
                onSearch={(q) => void buscarUsuarios(q, 'colab')}
                onSelect={(u) => {
                  setColaborador(u.codusuario)
                  setColaboradorSel(u)
                  setPreview(null)
                  void carregarUnidadesColab(u.codusuario)
                }}
              />

              {precisaSaida && (
                <div className="rounded-xl border p-4 space-y-4">
                  <p className="text-sm font-semibold">1) Alçadas que o colaborador cede</p>
                  <UsuarioCombobox
                    label="Quem recebe (ex.: novo contratado)"
                    placeholder="Buscar usuário…"
                    value={destino}
                    selected={destinoSel}
                    options={opcoesDestino}
                    loading={buscando}
                    onSearch={(q) => void buscarUsuarios(q, 'destino')}
                    onSelect={(u) => {
                      setDestino(u.codusuario)
                      setDestinoSel(u)
                      setPreview(null)
                    }}
                  />
                  <UnidadeMultiSelect
                    label="Unidades de origem (ex.: WAY 262, WAY 153)"
                    opcoes={unidadesSaidaOpts}
                    selecionadas={unidadesSaida}
                    onChange={(v) => {
                      setUnidadesSaida(v)
                      setPreview(null)
                    }}
                  />
                </div>
              )}

              {precisaEntrada && (
                <div className="rounded-xl border p-4 space-y-4">
                  <p className="text-sm font-semibold">
                    {tipo === 'TRANSFERENCIA'
                      ? '2) Alçadas que o colaborador herda na unidade nova'
                      : 'Alçadas que o colaborador herda'}
                  </p>
                  <UsuarioCombobox
                    label="De quem herdar (aprovador atual da unidade nova)"
                    placeholder="Buscar aprovador…"
                    value={origem}
                    selected={origemSel}
                    options={opcoesOrigem}
                    loading={buscando}
                    onSearch={(q) => void buscarUsuarios(q, 'origem')}
                    onSelect={(u) => {
                      setOrigem(u.codusuario)
                      setOrigemSel(u)
                      setPreview(null)
                      void carregarUnidadesOrigem(u.codusuario)
                    }}
                  />
                  <UnidadeMultiSelect
                    label="Unidades de destino (ex.: WAY 306, WAY 112)"
                    opcoes={unidadesEntradaOpts}
                    selecionadas={unidadesEntrada}
                    onChange={(v) => {
                      setUnidadesEntrada(v)
                      setPreview(null)
                    }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  rows={2}
                  className="resize-none"
                  placeholder="Ex.: promoção Constantino 262/153 → 306/112"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>

              {preview && (
                <div className="space-y-4">
                  {precisaSaida && (
                    <div className="rounded-xl border p-4 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Saída — {preview.saida.total} alçada(s) → {destinoSel?.nome || destino}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {preview.saida.por_unidade.map((p) => (
                            <Badge key={p.unidade} variant="secondary">
                              {p.unidade}: {p.qtd}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-auto rounded-lg border">
                        <DataTable
                          columns={colunasLinha}
                          data={preview.saida.linhas}
                          hideSearch
                          hidePagination
                        />
                      </div>
                    </div>
                  )}
                  {precisaEntrada && (
                    <div className="rounded-xl border p-4 space-y-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="text-sm font-semibold">
                          Herança — {preview.entrada.total} alçada(s) →{' '}
                          {colaboradorSel?.nome || colaborador}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {preview.entrada.por_unidade.map((p) => (
                            <Badge key={p.unidade} variant="outline">
                              {p.unidade}: {p.qtd}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-auto rounded-lg border">
                        <DataTable
                          columns={colunasLinha}
                          data={preview.entrada.linhas}
                          hideSearch
                          hidePagination
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t px-6 py-4 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={carregandoPreview}
                onClick={() => void gerarPreview()}
              >
                {carregandoPreview ? 'Carregando…' : 'Pré-visualizar'}
              </Button>
              <Button
                type="button"
                className="h-11 min-w-[180px]"
                disabled={salvando}
                onClick={() => void salvar()}
              >
                {salvando ? 'Aplicando…' : 'Aplicar transferência'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
