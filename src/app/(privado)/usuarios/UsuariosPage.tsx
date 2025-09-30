'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { ColumnDef } from '@tanstack/react-table'
import { SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner';

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
  FormLabel,
  FormMessage
} from '@/components/ui/form'

import { stripDiacritics } from '@/utils/functions'
import {
  Usuario,
  getAll as getAllUsuarios,
  getElementById as getUsuarioById,
  createElement as createUsuario,
  updateElement as updateUsuario,
  deleteElement as deleteUsuario
} from '@/services/usuariosService'

export default function PageUsuarios() {
  const titulo = 'Usuários'
  const tituloUpdate = 'Editar usuários'
  const tituloInsert = 'Novo usuários'
  const router = useRouter()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
  const [results, setResults] = useState<Usuario[]>([])
  const [resultById, setResultById] = useState<Usuario>()
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [updateMode, setUpdateMode] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending

  const form = useForm<Usuario>({
    defaultValues: { 
      SEQUENCIAL: 0,
      CODUSUARIO: '',
      NOME: '',
      EMPRESA: '',
      CODPERFIL: '',
      DIRETORIA: '',
      EMAIL: '',
      ATIVO: true,
      DATACRIACAO: '',
      CODSISTEMA: '',
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

  async function handleSearch(q: string) {
    setError(null)
    try {      
      const dados = await getAllUsuarios()
      const qNorm = stripDiacritics(q.toLowerCase().trim())
      const filtrados = qNorm
        ? dados.filter(
            p =>
              (
                stripDiacritics((p.NOME ?? '').toLowerCase()).includes(qNorm) ||
                stripDiacritics((p.CODUSUARIO ?? '').toLowerCase()).includes(qNorm) ||
                String(p.SEQUENCIAL ?? '').includes(qNorm)
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

  async function handleDeleteConfirmed() {
    if (!deleteId) return
    
    try {
      await deleteUsuario(deleteId)        
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Registro excluído`)
      setDeleteId(null)
      await handleSearchClick()
    }
  }

  const handleUpdate = useCallback(async (id: number) => {
    setError(null)
    setUpdateMode(true)
    try {
      const response = await getUsuarioById(id)
      setResultById(response)
      form.reset({
        SEQUENCIAL: response.SEQUENCIAL,
        CODUSUARIO: response.CODUSUARIO,
        NOME: response.NOME,
        EMPRESA: response.EMPRESA,
        CODPERFIL: response.CODPERFIL,
        DIRETORIA: response.DIRETORIA,
        EMAIL: response.EMAIL,
        ATIVO: response.ATIVO,
        DATACRIACAO: response.DATACRIACAO,
        CODSISTEMA: response.CODSISTEMA,
      })
      setIsModalOpen(true)
    } catch (err) {
      toast.error(`Erro ao carregar: ${(err as Error).message}`)
    }
  }, [form])

  function handleInsert() {
    form.reset({ 
      SEQUENCIAL: 0,
      CODUSUARIO: '',
      NOME: '',
      EMPRESA: '',
      CODPERFIL: '',
      DIRETORIA: '',
      EMAIL: '',
      ATIVO: true,
      DATACRIACAO: '',
      CODSISTEMA: '',
    })
    setUpdateMode(false)
    setIsModalOpen(true)
  }

  async function onSubmit(data: Usuario) {
    setError(null)
    try {
      if (data.SEQUENCIAL && data.SEQUENCIAL !== 0) {
        await updateUsuario(data)        
      } else {
        await createUsuario(data)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Registro enviado`)
      form.reset()
      await handleSearchClick()
      setIsModalOpen(false)
    }
  }

  const colunas = useMemo<ColumnDef<Usuario>[]>(
    () => [
      { accessorKey: 'sequencial', header: 'SEQUENCIAL' },
      { accessorKey: 'codusuario', header: 'CODUSUARIO' },
      { accessorKey: 'nome', header: 'NOME' },
      { accessorKey: 'empresa', header: 'EMPRESA' },
      {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUpdate(row.original.SEQUENCIAL)}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteId(row.original.SEQUENCIAL)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )
      }
    ],
    [handleUpdate, setDeleteId]
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
              {updateMode
                ? `${tituloUpdate}: ${resultById?.SEQUENCIAL}`
                : `${tituloInsert}`}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="CODUSUARIO"
                rules={{ required: 'Usuário é obrigatório' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>COD. USUÁRIO</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="NOME"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NOME</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="EMPRESA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMPRESA</FormLabel>
                    <FormControl>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background
                             focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={field.value ?? ''}
                        onChange={e =>
                          field.onChange(
                            e.target.value ? Number(e.target.value) : 0
                          )
                        }
                      >
                        <option value={0}>Selecione…</option>
                        <option key={'48.851.242'} value={'48.851.242'}>{'WAY 112'}</option>
                        <option key={'58.492.120'} value={'58.492.120'}>{'WAY 262'}</option>
                        <option key={'36.128.741'} value={'36.128.741'}>{'WAY 306'}</option>
                        <option key={'57.190.446'} value={'57.190.446'}>{'MIGRA BR'}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="DIRETORIA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DIRETORIA</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="EMAIL"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMAIL</FormLabel>
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

      {/* Confirmação de exclusão (simples) */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold">
              Excluir usuário
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja excluir o registro #{deleteId}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirmed}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
