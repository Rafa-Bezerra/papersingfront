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
import { SearchIcon, SquarePlus, X } from 'lucide-react'

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
import { stripDiacritics } from '@/utils/functions'
import { 
    Alcada, 
    getAll as getAlcadas,
    createElement as createAlcada,
    updateElement as updateAlcada,
    deleteElement as deleteAlcada
} from '@/services/alcadasService'
import { 
    Aprovadores, 
    getAll as getAprovadores,
    createElement as createAprovador,
    updateElement as updateAprovador,
    deleteElement as deleteAprovador
} from '@/services/aprovadoresService'
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

export default function Page() {
    const titulo = 'Alçadas de Aprovação'
    const tituloUpdate = 'Editar alçada'
    const tituloInsert = 'Nova alçada'
    const tituloUpdateAprovador = 'Editar aprovador'
    const tituloInsertAprovador = 'Novo aprovador'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<Alcada[]>([])
    const [alcadaSelecionada, setAlcadaSelecionada] = useState<Alcada>()
    const [resultsAprovadores, setResultsAprovadores] = useState<Aprovadores[]>([])
    const [aprovadorSelecionado, setAprovadorSelecionado] = useState<Aprovadores>()
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalAprovadoresOpen, setIsModalAprovadoresOpen] = useState(false)
    const [updateAlcadaMode, setUpdateAlcadaMode] = useState(false)
    const [isFormAlcadaOpen, setIsFormAlcadaOpen] = useState(false)
    const [deleteAlcadaId, setDeleteAlcadaId] = useState<number | null>(null)
    const [updateAprovadoresMode, setUpdateAprovadoresMode] = useState(false)
    const [isFormAprovadoresOpen, setIsFormAprovadoresOpen] = useState(false)
    const [deleteAprovadorId, setDeleteAprovadorId] = useState<number | null>(null)

    const form = useForm<Alcada>({
        defaultValues: { 
            id: 0,
            centro_custo: '',
            centro_custo_nome: ''
        }
    })

    const formAprovadores = useForm<Aprovadores>({
        defaultValues: {
            id: 0,
            id_alcada: 0,
            usuario: '',
            cargo: '',
            valor_inicial: 0,
            valor_final: 0
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
            const dados = await getAlcadas()
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const centro_custo = stripDiacritics((d.centro_custo ?? '').toLowerCase())
                const centro_custo_nome = stripDiacritics((d.centro_custo_nome ?? '').toLowerCase())
                const matchQuery = qNorm === "" || centro_custo.includes(qNorm) || centro_custo_nome.includes(qNorm) || String(d.id ?? '').includes(qNorm)
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

    async function handleInserir () {
        form.reset({ 
            id: 0,
            centro_custo: '',
            centro_custo_nome: ''
        })
        setUpdateAlcadaMode(false)
        setIsFormAlcadaOpen(true)
    }

    async function handleAprovadores (alcada: Alcada) {
        setError(null)
        setResultsAprovadores([])
        try {
            const dados = await getAprovadores(alcada.id)
            setResultsAprovadores(dados)
            setAlcadaSelecionada(alcada)
        } catch (err) {
            setError((err as Error).message)
            setResultsAprovadores([])
        } finally {
            setIsModalAprovadoresOpen(true)
        }
    }

    async function handleEditar (alcada: Alcada) {
        form.reset({ 
            id: alcada.id,
            centro_custo: alcada.centro_custo_nome,
            centro_custo_nome: alcada.centro_custo_nome
        })
        setUpdateAlcadaMode(true)
        setIsFormAlcadaOpen(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }

    async function handleExcluir () {
        if (!deleteAlcadaId) return            
        try {
            await deleteAlcada(deleteAlcadaId)        
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Alçada excluída`)
            setDeleteAlcadaId(null)
            await handleSearchClick()
        }
    }

    async function submitAlcada (data: Alcada) {
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
            toast.success(`Registro enviado`)
            form.reset()
            await handleSearchClick()
            setIsFormAlcadaOpen(false)
        }
    }

    async function handleInserirAprovador () {
        formAprovadores.reset({
            id: 0,
            id_alcada: alcadaSelecionada?.id ?? 0,
            usuario: '',
            cargo: '',
            valor_inicial: 0,
            valor_final: 0
        })
        setUpdateAprovadoresMode(false)
        setIsFormAprovadoresOpen(true)
    }

    async function handleEditarAprovador (aprovador: Aprovadores) {
        formAprovadores.reset({
            id: aprovador.id,
            id_alcada: aprovador.id_alcada,
            usuario: aprovador.usuario,
            cargo: aprovador.cargo,
            valor_inicial: aprovador.valor_inicial,
            valor_final: aprovador.valor_final
        })
        setAprovadorSelecionado(aprovador)
        setUpdateAprovadoresMode(false)
        setIsFormAprovadoresOpen(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }

    async function handleExcluirAprovador () {
        if (!deleteAprovadorId) return            
        try {
            await deleteAprovador(deleteAprovadorId)        
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            await handleSearchClick()
            toast.success(`Aprovador excluído`)
            setDeleteAprovadorId(null)
            setIsModalAprovadoresOpen(false)
        }
    }

    async function submitAprovador (data: Aprovadores) {
        setError(null)
        try {
            if (data.id && data.id !== 0) {
                await updateAprovador(data)        
            } else {
                await createAprovador(data)
            }
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            toast.success(`Registro enviado`)
            formAprovadores.reset()
            setIsFormAprovadoresOpen(false)
            setIsModalAprovadoresOpen(false)
            await handleSearchClick()
        }
    }
    
    const colunas = useMemo<ColumnDef<Alcada>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'centro_custo', header: 'Centro de custo' },
            { accessorKey: 'centro_custo_nome', header: 'Descrição' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAprovadores(row.original)}
                        >
                            Aprovadores
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditar(row.original)}
                        >
                            Editar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteAlcadaId(row.original.id)}
                        >
                            Excluir
                        </Button>
                    </div>
                )
            }
        ],
        [handleEditar]
    )
    
    const colunasAprovadores = useMemo<ColumnDef<Aprovadores>[]>(
        () => [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'usuario', header: 'Usuário' },
            { accessorKey: 'cargo', header: 'Cargo' },
            { accessorKey: 'valor_inicial', header: 'Valor inicial' },
            { accessorKey: 'valor_final', header: 'Valor final' },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditarAprovador(row.original)}
                        >
                            Editar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {setDeleteAprovadorId(row.original.id); setIsModalAprovadoresOpen(false)}}
                        >
                            Excluir
                        </Button>
                    </div>
                )
            }
        ],
        [handleEditarAprovador]
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
                        <SearchIcon className="mr-1 h-4 w-4" /> Buscar
                    </Button>

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

            {/* Modal */}
            {alcadaSelecionada && (
                <Dialog open={isModalAprovadoresOpen} onOpenChange={setIsModalAprovadoresOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-center">{`Centro de custo - ${alcadaSelecionada.centro_custo}`}</DialogTitle>

                            <Button onClick={handleInserirAprovador} className="flex items-center">
                                <SquarePlus className="mr-1 h-4 w-4" /> Novo aprovador
                            </Button>
                        </DialogHeader> 
                        <div className="w-full">
                            <DataTable columns={colunasAprovadores} data={resultsAprovadores} loading={loading} />         
                        </div>  
                    </DialogContent>
                </Dialog>
            )}
            
            {/* Confirmação de exclusão (simples) */}
            {deleteAlcadaId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir alçada
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir a alçada #{deleteAlcadaId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteAlcadaId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluir}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmação de exclusão (simples) */}
            {deleteAprovadorId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
                        <h3 className="mb-2 text-base font-semibold">
                            Excluir alçada
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Tem certeza que deseja excluir o aprovador #{deleteAprovadorId}?
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteAprovadorId(null)}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleExcluirAprovador}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            <Dialog open={isFormAlcadaOpen} onOpenChange={setIsFormAlcadaOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateAlcadaMode ? `${tituloUpdate}: ${alcadaSelecionada?.centro_custo}` : `${tituloInsert}`}
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(submitAlcada)} className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="centro_custo"
                                rules={{ required: 'Centro de custo é obrigatório' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Centro de custo</FormLabel>
                                    <FormControl>
                                    <Input {...field} />
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
                            
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal */}
            <Dialog open={isFormAprovadoresOpen} onOpenChange={setIsFormAprovadoresOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateAprovadoresMode ? `${tituloUpdateAprovador}: ${aprovadorSelecionado?.usuario}` : `${tituloInsertAprovador}`}
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={formAprovadores.handleSubmit(submitAprovador)} className="grid gap-4">
                            <FormField
                                control={formAprovadores.control}
                                name="usuario"
                                rules={{ required: 'usuário é obrigatório' }}
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
                                control={formAprovadores.control}
                                name="cargo"
                                rules={{ required: 'Cargo é obrigatório' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cargo</FormLabel>
                                    <FormControl>
                                    <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={formAprovadores.control}
                                name="valor_inicial"
                                rules={{ required: 'Valor inicial é obrigatório' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor inicial</FormLabel>
                                    <FormControl>
                                    <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={formAprovadores.control}
                                name="valor_final"
                                rules={{ required: 'Valor final é obrigatório' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor final</FormLabel>
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

            
        </div>
    )
}
