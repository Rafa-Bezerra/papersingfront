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
    Externo,
    getAll as getAllUsuarios,
    createElement as createUsuario,
    updateElement as updateUsuario,
    deleteElement as deleteUsuario,
    resetPassword
} from '@/services/externosService'

export default function PageUsuarios() {
    const titulo = 'Usuários'
    const tituloUpdate = 'Editar usuários'
    const tituloInsert = 'Novo usuários'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Externo[]>([])
    const [resultById, setResultById] = useState<Externo>()
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [updateMode, setUpdateMode] = useState(false)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [resetId, setResetId] = useState<number | null>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const loading = isPending

    const form = useForm<Externo>({
        defaultValues: {
            id: 0,
            usuario: '',
            nome: '',
            senha: '',
            email: '',
            contato: '',
            documento: ''
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

    const handleUpdate = useCallback(async (data: Externo) => {
        setError(null)
        setUpdateMode(true)
        try {
            setResultById(data)
            form.reset({
                id: data.id,
                usuario: data.usuario,
                nome: data.nome ?? '',
                senha: data.senha ?? '',
                email: data.email ?? '',
                contato: data.contato ?? '',
                documento: data.documento ?? ''
            })
            setIsModalOpen(true)
        } catch (err) {
            toast.error(`Erro ao carregar: ${(err as Error).message}`)
        }
    }, [form])

    function handleInsert() {
        form.reset({
            id: 0,
            usuario: '',
            nome: '',
            senha: '',
            email: '',
            contato: '',
            documento: ''
        })
        setUpdateMode(false)
        setIsModalOpen(true)
    }

    async function onSubmit(data: Externo) {
        setError(null)
        try {
            if (data.id && data.id !== 0) {
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

    const colunas = useMemo<ColumnDef<Externo>[]>(
        () => [
            { accessorKey: 'id', header: '#' },
            { accessorKey: 'usuario', header: 'Usuário' },
            { accessorKey: 'nome', header: 'Nome' },
            { accessorKey: 'email', header: 'Email' },
            { accessorKey: 'contato', header: 'Contato' },
            { accessorKey: 'documento', header: 'Documento' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdate(row.original)}
                        >
                            Editar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setResetId(row.original.id!)}
                        >
                            <KeyIcon className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteId(row.original.id!)}
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
            {/**Filtros */}
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

            {/** Datatable */}
            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Form */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateMode
                                ? `${tituloUpdate}: ${resultById?.id}`
                                : `${tituloInsert}`}
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="usuario"
                                rules={{ required: 'Usuário é obrigatório' }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Usuário</FormLabel>
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
                                        <FormLabel>Nome</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="documento"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Documento</FormLabel>
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
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="contato"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contato</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="senha"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Senha</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='password'
                                                {...field}
                                            />
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
