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
import { ChevronsUpDown, SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'

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
import { CentroDeCusto, ContaFinanceira, createElement, deleteElement, getAll, getAllCentrosDeCusto, getAllContasFinanceiras, MgoFinanceiro } from '@/services/mgoFinanceiroService'

// Popover sem portal para evitar o overlay do Dialog bloquear clique/scroll.
const PopoverContentNoPortal = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Content
    ref={ref}
    side="bottom"
    align={align}
    sideOffset={sideOffset}
    avoidCollisions={false}
    className={cn(
      "bg-popover text-popover-foreground z-50 w-72 rounded-md border p-4 shadow-md outline-hidden",
      className
    )}
    {...props}
  />
))
PopoverContentNoPortal.displayName = 'PopoverContentNoPortal'

export default function Page() {
  const titulo = 'Centros de custos'
  const tituloInsert = 'Novo centro de custo'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<MgoFinanceiro[]>([])
  const [centrosDeCusto, setCentrosDeCusto] = useState<CentroDeCusto[]>([])
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [openCentroSearch, setOpenCentroSearch] = useState(false)
  const [openContaSearch, setOpenContaSearch] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [itemParaExcluir, setItemParaExcluir] = useState<MgoFinanceiro | null>(null)

  const form = useForm<MgoFinanceiro>({
    defaultValues: {
      centro_custo: '',
      conta_contabil: '',
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
    buscaContasFinanceiras()
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

  async function buscaCentrosDeCusto() {
    setError(null)
    try {
      const dados = await getAllCentrosDeCusto()
      setCentrosDeCusto(dados)
    } catch (err) {
      setError((err as Error).message)
      setCentrosDeCusto([])
    }
  }
  
  async function buscaContasFinanceiras() {
    setError(null)
    try {
      const dados = await getAllContasFinanceiras()
      setContasFinanceiras(dados)
    } catch (err) {
      setError((err as Error).message)
      setContasFinanceiras([])
    }
  }

  async function handleSearch(q: string) {
    setError(null)
    try {
      const dados = await getAll()
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = dados.filter(d => {
        const centro_custo = stripDiacritics((d.centro_custo ?? '').toLowerCase())
        const centro_custo_nome = stripDiacritics((d.centro_custo_nome ?? '').toLowerCase())
        const conta_contabil = stripDiacritics((d.conta_contabil ?? '').toLowerCase())
        const conta_contabil_nome = stripDiacritics((d.conta_contabil_nome ?? '').toLowerCase())
        const matchQuery =
          qNorm === '' ||
          conta_contabil_nome.includes(qNorm) ||
          centro_custo_nome.includes(qNorm) ||
          centro_custo.includes(qNorm) ||
          conta_contabil.includes(qNorm)
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

  async function handleInserir() {
    form.reset({
      centro_custo: '',
      conta_contabil: '',
    })
    setIsFormOpen(true)
  }

  async function submit(data: MgoFinanceiro) {
    setError(null)
    try {
      await createElement(data)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success('Centro de custo criado')
      form.reset()
      await handleSearchClick()
      setIsFormOpen(false)
    }
  }

  async function handleExcluir(data: MgoFinanceiro) {
    setError(null)
    try {
      await deleteElement(data)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success('Centro de custo excluído')
      await handleSearchClick()
    }
  }

  const colunas = useMemo<ColumnDef<MgoFinanceiro>[]>(
    () => [
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' },
      { accessorKey: 'conta_contabil', header: 'Conta contábil' },
      { accessorKey: 'conta_contabil_nome', header: 'Descrição conta contábil', },
      {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="icon"
              onClick={() => {
                setItemParaExcluir(row.original)
                setConfirmOpen(true)
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )
      }
    ],
    [handleExcluir]
  )

  return (
    <div className="p-6">
      {/* Filtros */}
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

      {/* Tabela */}
      <Card className="mb-6">
        <CardContent className="flex flex-col">
          <DataTable
            columns={colunas}
            data={results}
            loading={loading}
            searchPlaceholder="Pesquisar..."
            globalFilterAccessorKey={[
              'centro_custo',
              'centro_custo_nome',
              'conta_contabil',
              'conta_contabil_nome'
            ]}
          />
        </CardContent>
      </Card>

      {/* Formulário */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent
          className="
            max-w-md
            min-w-[800px]
            max-h-[90vh]
            overflow-y-auto
          "
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {tituloInsert}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
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
                            <CommandList className="max-h-[280px] overflow-y-auto">
                              <CommandEmpty>Nenhum encontrado</CommandEmpty>
                              <CommandGroup>
                                {centrosDeCusto.map(c => (
                                  <CommandItem
                                    key={c.ccusto}
                                    value={c.ccusto}
                                    onSelect={() => {
                                      field.onChange(c.ccusto)
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

              {/* Conta contábil com busca e lista rolável */}
              <FormField
                control={form.control}
                name="conta_contabil"
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
                            <CommandList className="max-h-[280px] overflow-y-auto">
                              <CommandEmpty>Nenhum encontrado</CommandEmpty>
                              <CommandGroup>
                                {contasFinanceiras.map((x, index) => (
                                  <CommandItem
                                    key={`${x.codconta}-${x.contabil ?? ''}-${index}`}
                                    value={x.codconta}
                                    onSelect={() => {
                                      field.onChange(x.codconta)
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

              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir este vínculo de centro de custo?
            </p>

            {itemParaExcluir && (
              <div className="rounded-md border p-3 text-sm bg-muted/50">
                <p>
                  <strong>Centro:</strong> {itemParaExcluir.centro_custo} – {itemParaExcluir.centro_custo_nome}
                </p>
                <p>
                  <strong>Conta:</strong> {itemParaExcluir.conta_contabil} – {itemParaExcluir.conta_contabil_nome}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>

            <Button
              variant="destructive"
              onClick={async () => {
                if (!itemParaExcluir) return
                await handleExcluir(itemParaExcluir)
                setConfirmOpen(false)
                setItemParaExcluir(null)
              }}
            >
              Excluir
            </Button>
          </div>
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
