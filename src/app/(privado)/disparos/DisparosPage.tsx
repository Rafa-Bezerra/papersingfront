'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { SquarePlus } from 'lucide-react'

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
    Disparo,
    getAll as getDisparos,
    createElement as createDisparo,
    deleteElement as deleteDisparo
} from '@/services/disparosService'
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

export default function DisparosPage() {
    const titulo = 'Disparos — Emails de Notificação de Contrato'
    const router = useRouter()

    const [results, setResults] = useState<Disparo[]>([])
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<number | null>(null)
    const [acessoNegado, setAcessoNegado] = useState(false)

    const form = useForm<{ email: string }>({
        defaultValues: { email: '' }
    })

    const loading = isPending

    useEffect(() => {
        const storedUser = sessionStorage.getItem('userData')
        const user = storedUser ? JSON.parse(storedUser) : null
        if (!user?.admin) {
            setAcessoNegado(true)
            toast.error('Acesso restrito a administradores.')
            router.replace('/home')
            return
        }
        handleSearch()
    }, [])

    async function handleSearch() {
        setError(null)
        try {
            const dados = await getDisparos()
            setResults(dados)
        } catch (err) {
            setError((err as Error).message)
            setResults([])
        } finally {
            setSearched(true)
        }
    }

    function handleInserir() {
        form.reset({ email: '' })
        setIsFormOpen(true)
    }

    async function handleExcluir() {
        if (!deleteId) return
        try {
            await deleteDisparo(deleteId)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success('Email excluído')
            setDeleteId(null)
            startTransition(() => { handleSearch() })
        }
    }

    async function submitDisparo(data: { email: string }) {
        setError(null)
        try {
            await createDisparo(data.email)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success('Registro enviado')
            form.reset()
            startTransition(() => { handleSearch() })
            setIsFormOpen(false)
        }
    }

    const colunas: ColumnDef<Disparo>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'email', header: 'Email' },
        {
            id: 'actions',
            header: 'Ações',
            cell: ({ row }) => (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteId(row.original.id)}
                    >
                        Excluir
                    </Button>
                </div>
            )
        }
    ]

    if (acessoNegado) return null

    return (
        <div className="p-6">
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-2 md:flex-row">
                    <p className="flex-1 w-full text-sm text-muted-foreground">
                        Sempre que um contrato for criado pela rotina &quot;Criar Contrato&quot;, os emails
                        cadastrados abaixo serão notificados. Se a lista estiver vazia, nenhuma notificação é enviada.
                    </p>

                    <Button onClick={handleInserir} className="flex items-center">
                        <SquarePlus className="mr-1 h-4 w-4" /> Novo
                    </Button>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} />
                </CardContent>
            </Card>

            {/* Confirmação de exclusão (simples) */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir email
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o email #{deleteId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluir}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            Novo email de notificação
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitDisparo)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                rules={{
                                    required: 'Email é obrigatório',
                                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' }
                                }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                    <Input type="email" {...field} />
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
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                    ))}
                </div>
            )}

            {searched && results.length === 0 && !loading && !error && (
                <p className="text-center text-sm text-muted-foreground">
                    Nenhum email cadastrado.
                </p>
            )}
        </div>
    )
}
