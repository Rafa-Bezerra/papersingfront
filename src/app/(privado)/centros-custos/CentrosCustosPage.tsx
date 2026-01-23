'use client'

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, SearchIcon, SquarePlus, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { stripDiacritics } from '@/utils/functions'
import { cn } from '@/lib/utils'
import {
  Alcada,
  getAll as getAlcadas,
  createElement as createAlcada,
  updateElement as updateAlcada
} from '@/services/alcadasService'
import {
  CentroDeCusto,
  ContaFinanceira,
  getAllCentrosDeCusto,
  getAllContasFinanceiras
} from '@/services/carrinhoService'
import { useForm } from 'react-hook-form'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { toast } from 'sonner'

// Popover sem portal para evitar o overlay do Dialog bloquear clique/scroll.
const PopoverContentNoPortal = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
      className
    )}
    {...props}
  />
))
PopoverContentNoPortal.displayName = 'PopoverContentNoPortal'

export default function Page() {
  const titulo = 'Centros de custos'
  const tituloUpdate = 'Editar centro de custo'
  const tituloInsert = 'Novo centro de custo'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<Alcada[]>([])
  const [alcadaSelecionada, setAlcadaSelecionada] = useState<Alcada>()
  const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [updateAlcadaMode, setUpdateAlcadaMode] = useState(false)
  const [isFormAlcadaOpen, setIsFormAlcadaOpen] = useState(false)
  const [openCentroSearch, setOpenCentroSearch] = useState(false)
  const [openContaSearch, setOpenContaSearch] = useState(false)

  const form = useForm<Alcada>({
    defaultValues: {
      id: 0,
      centro_custo: '',
      centro_custo_nome: '',
      conta_contabel: '',
      conta_contabel_nome: ''
    }
  })

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending

  function clearQuery() {
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchClick()
    }
  }

  useEffect(() => {
    handleSearch(searchParams.get('q') ?? '')
    buscaCentrosDeCusto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const sp = new URLSearchParams(Array.from(searchParams.entries()))
        if (query) sp.set('q', query)
        else sp.delete('q')
        router.replace(`?${sp.toString()}`)
      })
      handleSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Busca todos os centros disponíveis para preencher o dropdown.
  async function buscaCentrosDeCusto() {
    setError(null)
    try {
      const dados = await getAllCentrosDeCusto()
      // Log para confirmar retorno por base/ambiente.
      console.log('[Centros de custos] Centros recebidos:', dados?.length ?? 0, dados)
      setCentrosDeCusto(dados)
      setContasFinanceiras([])
    } catch (err) {
      setError((err as Error).message)
      setCentrosDeCusto([])
    }
  }

  // Busca contas contábeis vinculadas ao centro selecionado.
  async function loadContasFinanceiras(centro: string) {
    setError(null)
    try {
      const dados = await getAllContasFinanceiras(centro)
      // Log para confirmar retorno por centro.
      console.log('[Centros de custos] Contas contabeis para centro:', centro, '->', dados?.length ?? 0, dados)
      setContasFinanceiras(dados)
    } catch (err) {
      setError((err as Error).message)
      setContasFinanceiras([])
    }
  }

  async function handleSearch(q: string) {
    setError(null)
    try {
      const dados = await getAlcadas()
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = dados.filter(d => {
        const centro_custo = stripDiacritics((d.centro_custo ?? '').toLowerCase())
        const centro_custo_nome = stripDiacritics((d.centro_custo_nome ?? '').toLowerCase())
        const matchQuery =
          qNorm === '' ||
          centro_custo.includes(qNorm) ||
          centro_custo_nome.includes(qNorm) ||
          String(d.id ?? '').includes(qNorm)
        return matchQuery
      })

      setResults(filtrados)
    } catch (err) {
      setError((err as Error).message)
      setResults([])
    } finally {
      setSearched(true)
    }
  }

  async function handleSearchClick() {
    startTransition(() => {
      const sp = new URLSearchParams(Array.from(searchParams.entries()))
      if (query) sp.set('q', query)
      else sp.delete('q')
      router.replace(`?${sp.toString()}`)
    })
    await handleSearch(query)
  }

  // Abre o modal já com os dados do registro.
  async function handleEditar(alcada: Alcada) {
    const contaContabel = alcada.conta_contabel ?? ''
    const contaContabelNome = alcada.conta_contabel_nome ?? ''
    form.reset({
      id: alcada.id,
      centro_custo: alcada.centro_custo,
      centro_custo_nome: alcada.centro_custo_nome,
      conta_contabel: contaContabel,
      conta_contabel_nome: contaContabelNome
    })
    if (alcada.centro_custo) {
      await loadContasFinanceiras(alcada.centro_custo)
    }
    setUpdateAlcadaMode(true)
    setIsFormAlcadaOpen(true)
  }

  // Abre o modal de criação zerando os campos.
  async function handleInserir() {
    form.reset({
      id: 0,
      centro_custo: '',
      centro_custo_nome: '',
      conta_contabel: '',
      conta_contabel_nome: ''
    })
    setContasFinanceiras([])
    setUpdateAlcadaMode(false)
    setIsFormAlcadaOpen(true)
  }

  // Salva o registro (criar/editar).
  async function submitAlcada(data: Alcada) {
    setError(null)
    try {
      if (data.id && data.id !== 0) {
        await updateAlcada(data)
      } else {
        await createAlcada(data)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(data.id && data.id !== 0 ? 'Centro de custo atualizado' : 'Centro de custo criado')
      form.reset()
      await handleSearchClick()
      setIsFormAlcadaOpen(false)
    }
  }

  const colunas = useMemo<ColumnDef<Alcada>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' },
      {
        accessorKey: 'conta_contabel',
        header: 'Conta contábil',
        accessorFn: row => row.conta_contabel ?? '-'
      },
      {
        accessorKey: 'conta_contabel_nome',
        header: 'Descrição conta contábil',
        accessorFn: row => row.conta_contabel_nome ?? '-'
      },
      {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleEditar(row.original)}>
              Editar
            </Button>
          </div>
        )
      }
    ],
    [handleEditar]
  )

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Input
              placeholder="Pesquise por Centro de custo ou ID"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-10"
              aria-label="Campo de busca"
            />
            {query && (
              <button
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                onClick={clearQuery}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button onClick={handleSearchClick} className="flex items-center">
            <SearchIcon className="mr-1 h-4 w-4" />
            Buscar
          </Button>

          <Button onClick={handleInserir} className="flex items-center">
            <SquarePlus className="mr-1 h-4 w-4" />
            Novo
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="flex flex-col">
          <DataTable
            columns={colunas}
            data={results}
            loading={loading}
            searchPlaceholder="Pesquisar..."
            globalFilterAccessorKey={[
              'id',
              'centro_custo',
              'centro_custo_nome',
              'conta_contabel',
              'conta_contabel_nome'
            ]}
          />
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isFormAlcadaOpen} onOpenChange={setIsFormAlcadaOpen}>
        <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh] min-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {updateAlcadaMode
                ? `Editar centro de custo${alcadaSelecionada?.centro_custo ? `: ${alcadaSelecionada.centro_custo}` : ''}`
                : 'Novo centro de custo'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitAlcada)} className="grid gap-4">
              {/* Centro de custo com busca igual ao carrinho */}
              <FormField
                control={form.control}
                name="centro_custo"
                rules={{ required: 'Centro de custo é obrigatório' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de custo</FormLabel>
                    <FormControl>
                      <Popover open={openCentroSearch} onOpenChange={setOpenCentroSearch}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between"
                            onClick={() => setOpenCentroSearch(true)}
                          >
                            {centrosDeCusto.find(c => c.ccusto === field.value)
                              ? `${centrosDeCusto.find(c => c.ccusto === field.value)?.ccusto} - ${centrosDeCusto.find(c => c.ccusto === field.value)?.custo}`
                              : 'Selecione'}
                            <ChevronsUpDown className="opacity-50 size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContentNoPortal className="p-0 w-[600px] z-[60] pointer-events-auto">
                          <Command
                            className="max-h-[320px] overflow-hidden"
                            filter={(value, search) => {
                              const label = centrosDeCusto.find(m => m.ccusto === value)?.custo || ''
                              const searchLower = search.toLowerCase()
                              return (
                                label.toLowerCase().includes(searchLower) ||
                                value.toLowerCase().includes(searchLower)
                              )
                                ? 1
                                : 0
                            }}
                          >
                            <CommandInput placeholder="Buscar centro..." />
                            {/* Scroll do dropdown: fallback prático, essa merda não rola */}
                            <CommandList
                              className="max-h-[280px] overflow-y-auto"
                              style={{ maxHeight: 280, overflowY: "auto" }}
                            >
                              <CommandEmpty>Nenhum encontrado</CommandEmpty>
                              <CommandGroup>
                                {centrosDeCusto.map(c => (
                                  <CommandItem
                                    key={c.ccusto}
                                    value={c.ccusto}
                                    onSelect={() => {
                                      field.onChange(c.ccusto)
                                      form.setValue('centro_custo_nome', c.custo)
                                      form.setValue('conta_contabel', '')
                                      form.setValue('conta_contabel_nome', '')
                                      loadContasFinanceiras(c.ccusto)
                                      setOpenCentroSearch(false)
                                    }}
                                  >
                                    {c.ccusto} - {c.custo}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContentNoPortal>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="centro_custo_nome"
                rules={{ required: 'Descrição é obrigatória' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Conta contábil com busca e lista rolável */}
              <FormField
                control={form.control}
                name="conta_contabel"
                rules={{ required: 'Conta contábil é obrigatória' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta contábil</FormLabel>
                    <FormControl>
                      <Popover open={openContaSearch} onOpenChange={setOpenContaSearch}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between"
                            onClick={() => setOpenContaSearch(true)}
                            disabled={contasFinanceiras.length === 0}
                          >
                            {contasFinanceiras.find(x => x.codconta === field.value)
                              ? `${contasFinanceiras.find(x => x.codconta === field.value)?.codconta} - ${contasFinanceiras.find(x => x.codconta === field.value)?.contabil}`
                              : 'Selecione'}
                            <ChevronsUpDown className="opacity-50 size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContentNoPortal className="p-0 w-[600px] z-[60] pointer-events-auto">
                          <Command
                            className="max-h-[320px] overflow-hidden"
                            filter={(value, search) => {
                              const label = contasFinanceiras.find(m => m.codconta === value)?.contabil || ''
                              const searchLower = search.toLowerCase()
                              return (
                                label.toLowerCase().includes(searchLower) ||
                                value.toLowerCase().includes(searchLower)
                              )
                                ? 1
                                : 0
                            }}
                          >
                            <CommandInput placeholder="Buscar conta..." />
                            {/* Scroll do dropdown: fallback prático, essa merda não rola */}
                            <CommandList
                              className="max-h-[280px] overflow-y-auto"
                              style={{ maxHeight: 280, overflowY: "auto" }}
                            >
                              <CommandEmpty>Nenhum encontrado</CommandEmpty>
                              <CommandGroup>
                                {contasFinanceiras.map((x, index) => (
                                  <CommandItem
                                    key={`${x.codconta}-${x.contabil ?? ''}-${index}`}
                                    value={x.codconta}
                                    onSelect={() => {
                                      field.onChange(x.codconta)
                                      form.setValue('conta_contabel_nome', x.contabil)
                                      setOpenContaSearch(false)
                                    }}
                                  >
                                    {x.codconta} - {x.contabil}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContentNoPortal>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="conta_contabel_nome"
                rules={{ required: 'Descrição da conta contábil é obrigatória' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição da conta contábil</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive break-words overflow-hidden">
          <p className="font-semibold">Não foi possível carregar os dados.</p>
          <p className="text-destructive/80">
            Tente novamente em instantes ou contate o suporte.
          </p>
          <p className="mt-2 text-xs text-destructive/70">
            Detalhe técnico: {error}
          </p>
        </div>
      )}

      {!searched && (
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && !error && (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum registro encontrado.
        </p>
      )}
    </div>
  )
}
