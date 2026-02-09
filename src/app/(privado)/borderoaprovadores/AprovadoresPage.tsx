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
import {
  BorderoAprovacao,
  getAllAprovadores,
  adicionarAprovador,
  toggleAprovador
} from '@/services/borderoService'
import { PopoverPortal } from '@radix-ui/react-popover'
import {
  Usuario,
  getAll as getAllUsuarios
} from '@/services/usuariosService'

export default function Page() {
  const titulo = 'Aprovadores de Borderô'
  const tituloInsert = 'Novo usuário'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<BorderoAprovacao[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const carregou = useRef(false)

  const form = useForm<BorderoAprovacao>({
    defaultValues: {
      id: 0,
      usuario: '',
      ativo: 1,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (carregou.current) return;
    buscaUsuarios();
  }, [])

  async function buscaUsuarios() {
    setError(null)
    try {
      const dados = await getAllUsuarios()
      setUsuarios(dados)
      carregou.current = true;
    } catch (err) {
      setError((err as Error).message)
      setUsuarios([])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function handleSearch(q: string) {
    setError(null)
    try {
      const dados = await getAllAprovadores(0)
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = qNorm
        ? dados.filter(
          p =>
          (
            stripDiacritics((p.nome ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.usuario ?? '').toLowerCase()).includes(qNorm) ||
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
      id: 0,
      usuario: '',
      ativo: 1,
    })
    setIsModalOpen(true)
  }

  async function handleToggle(id:number, ativo:number) {
    try {
      await toggleAprovador(id, ativo ? 0 : 1)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Usuário atualizado`)
      await handleSearchClick()
    }
  }

  async function onSubmit(data: BorderoAprovacao) {
    setError(null)
    try {
      await adicionarAprovador(data)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Registro enviado`)
      form.reset()
      await handleSearchClick()
      setIsModalOpen(false)
    }
  }

  const colunas = useMemo<ColumnDef<BorderoAprovacao>[]>(
    () => [
      { accessorKey: 'id', header: 'Id' },
      { accessorKey: 'usuario', header: 'Usuário' },
      // { accessorKey: 'nome', header: 'Nome' },
      {
        accessorKey: 'ativo', header: 'Ativo',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={row.original.ativo ? 'default' : 'destructive'}
              onClick={() => handleToggle(row.original.id!, row.original.ativo)}
            >
              {row.original.ativo ? 'Sim' : 'Não'}
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
          <div className="relative flex-1">
            <Input
              placeholder="Pesquise por nome ou ID"
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

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {tituloInsert}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name={`usuario`}
                rules={{ required: "Usuário obrigatório" }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between"
                          >
                            {
                              usuarios.find(u => u.codusuario === field.value)?.nome ??
                              "Selecione o usuário"
                            }
                            <ChevronsUpDown className="opacity-50 size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverPortal>
                          <PopoverContent
                            className="p-0 w-[250px] pointer-events-auto overflow-visible z-[9999]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Command>
                              <CommandInput placeholder="Buscar usuário..." />
                              <CommandList>
                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>

                                <CommandGroup>
                                  {usuarios.map((u) => (
                                    <CommandItem
                                      key={u.codusuario}
                                      value={u.codusuario}
                                      onSelect={() => {
                                        field.onChange(u.codusuario)
                                      }}
                                    >
                                      {u.nome}
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

      {searched && results.length === 0 && !loading && !error && (
        <p className="text-center text-sm text-muted-foreground">
          Nenhum registro encontrado.
        </p>
      )}
    </div>
  )
}
