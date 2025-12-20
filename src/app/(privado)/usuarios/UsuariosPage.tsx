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
import { KeyIcon, SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'
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
  deleteElement as deleteUsuario,
  resetPassword
} from '@/services/usuariosService'
import { Checkbox } from '@/components/ui/checkbox'

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
  const [resetId, setResetId] = useState<number | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loading = isPending

  const form = useForm<Usuario>({
    defaultValues: {
      sequencial: 0,
      codusuario: '',
      nome: '',
      empresa: '',
      codperfil: '',
      diretoria: '',
      email: '',
      ativo: true,
      datacriacao: '',
      codsistema: '',
      admin: false,
      documentos: false,
      bordero: false,
      comunicados: false,
      rdv: false,
      externo: false,
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
      console.log('q:', q)
      console.log('qNorm:', stripDiacritics(q.toLowerCase().trim()))
      console.log('dados exemplo:', dados[0])
      const filtrados = qNorm
        ? dados.filter(
          p =>
          (
            stripDiacritics((p.nome ?? '').toLowerCase()).includes(qNorm) ||
            stripDiacritics((p.codusuario ?? '').toLowerCase()).includes(qNorm) ||
            String(p.sequencial ?? '').includes(qNorm)
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

  async function handleResetConfirmed() {
    if (!resetId) return
    try {
      await resetPassword(resetId)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      toast.success(`Senha resetada para '123456'`)
      setResetId(null)
      await handleSearchClick()
    }
  }

  const handleUpdate = useCallback(async (id: number) => {
    setError(null)
    setUpdateMode(true)
    try {
      const response = await getUsuarioById(id)
      console.log(response);

      setResultById(response)
      form.reset({
        sequencial: response.sequencial,
        codusuario: response.codusuario,
        nome: response.nome,
        empresa: response.empresa,
        codperfil: response.codperfil,
        diretoria: response.diretoria,
        email: response.email,
        ativo: response.ativo,
        datacriacao: response.datacriacao,
        codsistema: response.codsistema,
        admin: response.admin,
        documentos: response.documentos,
        bordero: response.bordero,
        comunicados: response.comunicados,
        rdv: response.rdv,
        externo: response.externo,
      })
      setIsModalOpen(true)
    } catch (err) {
      toast.error(`Erro ao carregar: ${(err as Error).message}`)
    }
  }, [form])

  function handleInsert() {
    form.reset({
      sequencial: 0,
      codusuario: '',
      nome: '',
      empresa: '',
      codperfil: '',
      diretoria: '',
      email: '',
      ativo: true,
      datacriacao: '',
      codsistema: '',
      admin: false,
      documentos: false,
      bordero: false,
      comunicados: false,
      rdv: false,
      externo: false,
    })
    setUpdateMode(false)
    setIsModalOpen(true)
  }

  async function onSubmit(data: Usuario) {
    setError(null)
    try {
      if (data.sequencial && data.sequencial !== 0) {
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
              onClick={() => handleUpdate(row.original.sequencial)}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setResetId(row.original.sequencial)}
            >
              <KeyIcon className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteId(row.original.sequencial)}
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
                ? `${tituloUpdate}: ${resultById?.sequencial}`
                : `${tituloInsert}`}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="codusuario"
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
                name="nome"
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
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMPRESA</FormLabel>
                    <FormControl>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background
                             focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value)}
                      >
                        <option value={0}>Selecione…</option>
                        <option key={'48.851.242'} value={'48.851.242'}>{'WAY 112'}</option>
                        <option key={'63.929.367'} value={'63.929.367'}>{'WAY 153'}</option>
                        <option key={'58.492.120'} value={'58.492.120'}>{'WAY 262'}</option>
                        <option key={'36.128.741'} value={'36.128.741'}>{'WAY 306'}</option>
                        <option key={'60.437.929'} value={'60.437.929'}>{'WAY 364'}</option>
                        <option key={'57.190.446'} value={'57.190.446'}>{'MIGRA BR'}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="diretoria"
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
                name="email"
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="admin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Documentos</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bordero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Borderô</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comunicados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comunicados</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rdv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RDV</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="externo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Externo</FormLabel>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

      {/* Confirmação de exclusão (simples) */}
      {resetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold">
              Resetar a senha do usuário
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Tem certeza que deseja resetar a senha do registro #{resetId}?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleResetConfirmed}>
                Resetar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
