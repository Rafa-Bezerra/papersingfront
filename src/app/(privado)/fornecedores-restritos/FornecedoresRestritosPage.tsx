'use client'

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, SearchIcon, SquarePlus, X } from 'lucide-react'
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from '@/components/ui/form'

import { stripDiacritics } from '@/utils/functions'
import { PopoverPortal } from '@radix-ui/react-popover'
import { Fornecedor } from '@/types/Rdv'
import { FornecedoresRestritos, getAllFornecedores, createElement, deleteElement, getAll } from '@/services/fornecedoresRestritosService'

export default function Page() {
  const titulo = 'Fornecedores Restritos'
  const tituloInsert = 'Novo fornecedor restrito'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<FornecedoresRestritos[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const carregou = useRef(false)
  const [deleteFornecedorId, setDeleteFornecedorId] = useState<number | null>(null)
  const [comboAberto, setComboAberto] = useState(false)
  // codcfo já restritos, para ocultar do combobox
  const restritosRef = useRef<Set<string>>(new Set())

  const form = useForm<Omit<FornecedoresRestritos, 'id'>>({
    defaultValues: {
      codcfo: '',
      nome: '',
    }
  })

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
    // on mount: run an initial search
    handleSearch(searchParams.get('q') ?? '')
    if (carregou.current) return;
    buscaFornecedores();
  }, [])

  async function buscaFornecedores() {
    setError(null)
    try {
      const dados = await getAllFornecedores()
      setFornecedores(dados)
      carregou.current = true;
    } catch (err) {
      setError((err as Error).message)
      setFornecedores([])
    } finally {
      setSearched(true)
    }
  }

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
  }, [query])

  async function handleSearch(q: string) {
    setError(null)
    try {
      const dados = await getAll()
      restritosRef.current = new Set(dados.map(d => d.codcfo))
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = qNorm
        ? dados.filter(
          p =>
          (
            stripDiacritics((p.codcfo ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.nome ?? '').toLowerCase()).includes(qNorm) ||
            String(p.id ?? '').includes(qNorm)
          )
        )
        : dados;
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

  function handleInsert() {
    form.reset({
      codcfo: '',
      nome: '',
    })
    setIsModalOpen(true)
  }

  async function onSubmit(data: Omit<FornecedoresRestritos, 'id'>) {
    setError(null)
    try {
      await createElement(data);
      toast.success(`Registro enviado`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      form.reset()
      await handleSearchClick()
      setIsModalOpen(false)
    }
  }

  async function handleExcluir() {
    if (!deleteFornecedorId) return
    try {
      await deleteElement(deleteFornecedorId)
      toast.success(`Fornecedor restrito excluído`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeleteFornecedorId(null)
      await handleSearchClick()
    }
  }

  const colunas = useMemo<ColumnDef<FornecedoresRestritos>[]>(
    () => [
      { accessorKey: 'codcfo', header: 'Código' },
      { accessorKey: 'nome', header: 'Nome' },
      {
        accessorKey: 'acoes', header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { setDeleteFornecedorId(row.original.id); setIsModalOpen(false) }}
            >
              Excluir
            </Button>
          </div>
        )
      }
    ],
    []
  )

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1 w-full">
            <Input
              placeholder="Pesquise por nome ou código"
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

          <Button onClick={handleInsert} className="flex items-center">
            <SquarePlus className="mr-1 h-4 w-4" />
            Novo
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="flex flex-col">
          <DataTable columns={colunas} data={results} loading={loading} />
        </CardContent>
      </Card>

      {/* Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {tituloInsert}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name={`codcfo`}
                rules={{ required: "Fornecedor obrigatório" }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Popover modal={true} open={comboAberto} onOpenChange={setComboAberto}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {
                              fornecedores.find(f => f.codcfo === field.value)?.nome ??
                              "Selecione o fornecedor"
                            }
                            <ChevronsUpDown className="opacity-50 size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverPortal>
                          <PopoverContent
                            className="p-0 w-(--radix-popover-trigger-width) pointer-events-auto overflow-visible z-[9999]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Command>
                              <CommandInput placeholder="Buscar fornecedor..." />
                              <CommandList>
                                <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>

                                <CommandGroup>
                                  {fornecedores
                                    .filter(f => !restritosRef.current.has(f.codcfo))
                                    .map((f) => (
                                      <CommandItem
                                        key={f.codcfo}
                                        value={`${f.codcfo} - ${f.nome}`}
                                        onSelect={() => {
                                          field.onChange(f.codcfo)
                                          form.setValue('nome', f.nome)
                                          setComboAberto(false)
                                        }}
                                      >
                                        {`${f.codcfo} - ${f.nome}`}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </PopoverPortal>
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

      {error && (
        <p className="mb-4 text-center text-sm text-destructive">
          Erro: {error}
        </p>
      )}

      {!searched && (
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {/* Confirmação de exclusão (simples) */}
      {deleteFornecedorId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold">
              Excluir fornecedor restrito
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja excluir o fornecedor restrito #{deleteFornecedorId}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteFornecedorId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleExcluir}>
                Excluir
              </Button>
            </div>
          </div>
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
