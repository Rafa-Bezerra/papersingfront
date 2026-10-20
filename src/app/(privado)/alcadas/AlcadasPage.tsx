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
import { ChevronsUpDown, ListChecks, SearchIcon, SquarePlus, UserCog, Users, ArrowRightLeft, X } from 'lucide-react'
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

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import SubstituicaoAprovadoresPanel from '@/components/SubstituicaoAprovadoresPanel'
import TransferenciaAlcadasPanel from '@/components/TransferenciaAlcadasPanel'
import { stripDiacritics } from '@/utils/functions'
import { 
    Alcada, 
    getAll as getAlcadas,
    createElement as createAlcada,
    updateElement as updateAlcada,
    deleteElement as deleteAlcada,
    AlcadaLotePrevia,
    AlcadaLoteResultado,
    getPreviaLote,
    incluirAprovadorEmLote
} from '@/services/alcadasService'
import {
    Aprovadores,
    getAll as getAprovadores,
    createElement as createAprovador,
    updateElement as updateAprovador,
    deleteElement as deleteAprovador
} from '@/services/aprovadoresService'
import {
    Usuario,
    getUsuariosAprovadores
} from '@/services/usuariosService'
import { getAllCentrosDeCusto } from '@/services/mgoFinanceiroService'
import { CentroDeCusto } from '@/types/Carrinho'
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
import { mostrarErro } from '@/utils/avisoApi'

export default function Page() {
    const titulo = 'Alçadas de Aprovação'
    const tituloUpdate = 'Editar alçada'
    const tituloInsert = 'Nova alçada'
    const tituloUpdateAprovador = 'Editar aprovador'
    const tituloInsertAprovador = 'Novo aprovador'
    const router = useRouter()
    const searchParams = useSearchParams()
    const tabParam = searchParams.get('tab')
    const [aba, setAba] = useState(
      tabParam === 'substituicao'
        ? 'substituicao'
        : tabParam === 'transferencia'
          ? 'transferencia'
          : 'alcadas'
    )
    const [ehCsc, setEhCsc] = useState(false)
    const [unidadeLogada, setUnidadeLogada] = useState('')

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
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [comboUsuarioAberto, setComboUsuarioAberto] = useState(false)
    const carregouUsuarios = useRef(false)
    const [centrosCusto, setCentrosCusto] = useState<CentroDeCusto[]>([])
    const [comboCcAberto, setComboCcAberto] = useState(false)
    const loteInicial = { usuario: '', cargo: '', nivel: '0', valor_inicial: '0', valor_final: '99999999', busca: '' }
    const [isFormLoteOpen, setIsFormLoteOpen] = useState(false)
    const [lote, setLote] = useState(loteInicial)
    const [comboUsuarioLoteAberto, setComboUsuarioLoteAberto] = useState(false)
    const [centrosLote, setCentrosLote] = useState<AlcadaLotePrevia[]>([])
    const [marcadosLote, setMarcadosLote] = useState<Set<number>>(new Set())
    const [loteLimitado, setLoteLimitado] = useState(false)
    const [buscandoLote, setBuscandoLote] = useState(false)
    const [salvandoLote, setSalvandoLote] = useState(false)
    const [resumoLote, setResumoLote] = useState<AlcadaLoteResultado | null>(null)

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
            valor_final: 0,
            nivel: 1
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
        if (carregouUsuarios.current) return
        buscaUsuarios()
    }, [])

    useEffect(() => {
        let csc = false
        let unidade = ''
        try {
            const raw = sessionStorage.getItem('userData')
            if (raw) {
                const u = JSON.parse(raw)
                unidade = String(u.unidade ?? u.UNIDADE ?? '').trim()
                csc = unidade.toUpperCase() === 'WAY CSC'
            }
        } catch { /* ignore */ }
        setEhCsc(csc)
        setUnidadeLogada(unidade)
        if (!csc && (aba === 'substituicao' || aba === 'transferencia')) {
            setAba('alcadas')
            const params = new URLSearchParams(searchParams.toString())
            params.delete('tab')
            const qs = params.toString()
            router.replace(qs ? `/alcadas?${qs}` : '/alcadas', { scroll: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function buscaUsuarios() {
        try {
            setUsuarios(await getUsuariosAprovadores())
            carregouUsuarios.current = true
        } catch {
            setUsuarios([])
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

    // Centros de custo ativos da unidade (GCCUSTO): a alçada só pode ser cadastrada para um deles.
    async function buscaCentrosCusto() {
        if (centrosCusto.length) return
        try {
            const dados = await getAllCentrosDeCusto()
            // O GCCUSTO da unidade pode ter o mesmo código ativo em mais de uma linha (SEQUENCIAL diferente).
            const porCodigo = new Map<string, CentroDeCusto>()
            for (const c of dados) {
                const ccusto = (c.ccusto ?? '').trim()
                if (ccusto && !porCodigo.has(ccusto)) porCodigo.set(ccusto, { ...c, ccusto, custo: (c.custo ?? '').trim() })
            }
            setCentrosCusto([...porCodigo.values()].sort((a, b) => a.ccusto.localeCompare(b.ccusto)))
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    async function handleInserir () {
        form.reset({
            id: 0,
            centro_custo: '',
            centro_custo_nome: ''
        })
        setUpdateAlcadaMode(false)
        setComboCcAberto(false)
        setIsFormAlcadaOpen(true)
        await buscaCentrosCusto()
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
            centro_custo: alcada.centro_custo,
            centro_custo_nome: alcada.centro_custo_nome
        })
        setAlcadaSelecionada(alcada)
        setUpdateAlcadaMode(true)
        setComboCcAberto(false)
        setIsFormAlcadaOpen(true)
        await buscaCentrosCusto()
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
            toast.success(`Registro enviado`)
            form.reset()
            setIsFormAlcadaOpen(false)
            await handleSearchClick()
        } catch (err) {
            // Mantém o modal aberto para corrigir (ex.: CC inexistente ou alçada duplicada).
            mostrarErro(err)
        }
    }

    async function handleInserirAprovador () {
        await buscaUsuarios()
        formAprovadores.reset({
            id: 0,
            id_alcada: alcadaSelecionada?.id ?? 0,
            usuario: '',
            cargo: '',
            valor_inicial: 0,
            valor_final: 0,
            nivel: 1
        })
        setUpdateAprovadoresMode(false)
        setComboUsuarioAberto(false)
        setIsFormAprovadoresOpen(true)
    }

    async function handleEditarAprovador (aprovador: Aprovadores) {
        await buscaUsuarios()
        formAprovadores.reset({
            id: aprovador.id,
            id_alcada: aprovador.id_alcada,
            usuario: aprovador.usuario,
            cargo: aprovador.cargo,
            valor_inicial: aprovador.valor_inicial,
            valor_final: aprovador.valor_final,
            nivel: aprovador.nivel
        })
        setAprovadorSelecionado(aprovador)
        setUpdateAprovadoresMode(true)
        setComboUsuarioAberto(false)
        setIsFormAprovadoresOpen(true)
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
        const codigo = String(data.usuario ?? '').trim()
        if (!codigo || !usuarios.some((u) => u.codusuario === codigo)) {
            toast.error('Selecione um usuário cadastrado no PaperSign (GUSUARIO).')
            return
        }
        try {
            if (data.id && data.id !== 0) {
                await updateAprovador({ ...data, usuario: codigo })
            } else {
                await createAprovador({ ...data, usuario: codigo })
            }
            toast.success('Aprovador salvo.')
            formAprovadores.reset()
            setIsFormAprovadoresOpen(false)
            setIsModalAprovadoresOpen(false)
            await handleSearchClick()
        } catch (err) {
            mostrarErro(err)
        }
    }

    async function handleAbrirLote () {
        await buscaUsuarios()
        setLote(loteInicial)
        setCentrosLote([])
        setMarcadosLote(new Set())
        setLoteLimitado(false)
        setResumoLote(null)
        setComboUsuarioLoteAberto(false)
        setIsFormLoteOpen(true)
    }

    function alterarLote (campo: keyof typeof loteInicial, valor: string) {
        setLote(l => ({ ...l, [campo]: valor }))
        // Os aprovadores listados são do nível buscado: trocar o nível exige buscar de novo.
        if (campo === 'nivel') {
            setCentrosLote([])
            setMarcadosLote(new Set())
            setResumoLote(null)
        }
    }

    async function buscarCentrosLote () {
        const busca = lote.busca.trim()
        if (busca.length < 2) {
            toast.error('Digite pelo menos 2 caracteres do nome ou do código do centro de custo.')
            return
        }
        setBuscandoLote(true)
        setResumoLote(null)
        try {
            const r = await getPreviaLote(busca, Number(lote.nivel) || 0)
            setCentrosLote(r.centros)
            setMarcadosLote(new Set(r.centros.map(c => c.id)))
            setLoteLimitado(r.limitado)
            if (!r.centros.length) toast.info('Nenhum centro de custo encontrado para essa busca.')
        } catch (err) {
            mostrarErro(err)
            setCentrosLote([])
            setMarcadosLote(new Set())
        } finally {
            setBuscandoLote(false)
        }
    }

    function marcarCentroLote (id: number, marcado: boolean) {
        setMarcadosLote(atual => {
            const novo = new Set(atual)
            if (marcado) novo.add(id)
            else novo.delete(id)
            return novo
        })
    }

    function usuarioJaNoNivel (c: AlcadaLotePrevia) {
        const codigo = lote.usuario.trim().toLowerCase()
        return codigo !== '' && c.aprovadores_nivel.some(a => a.toLowerCase() === codigo)
    }

    async function submitLote () {
        const codigo = lote.usuario.trim()
        if (!codigo || !usuarios.some((u) => u.codusuario === codigo)) {
            toast.error('Selecione um usuário cadastrado no PaperSign (GUSUARIO).')
            return
        }
        const nivel = Number(lote.nivel)
        if (!Number.isInteger(nivel) || nivel < 0) {
            toast.error('Nível tem que ser um número inteiro, 0 ou maior.')
            return
        }
        const inicio = Number(lote.valor_inicial)
        const fim = Number(lote.valor_final)
        // Mesma regra da API (AprovadorCadastroRegras.ValidarFaixa).
        if (Number.isNaN(inicio) || Number.isNaN(fim)) {
            toast.error('Valores inicial e final têm que ser números.')
            return
        }
        if (inicio < 0) {
            toast.error('Valor inicial não pode ser negativo.')
            return
        }
        if (fim === 1) {
            toast.error('Valor final não pode ser 1. Sem limite: use um valor alto (ex.: 99999999).')
            return
        }
        if (fim <= inicio) {
            toast.error('Valor final tem que ser maior que o valor inicial.')
            return
        }
        if (marcadosLote.size === 0) {
            toast.error('Marque pelo menos um centro de custo.')
            return
        }
        setSalvandoLote(true)
        try {
            const r = await incluirAprovadorEmLote({
                usuario: codigo,
                cargo: lote.cargo.trim(),
                nivel,
                valor_inicial: inicio,
                valor_final: fim,
                ids_alcada: [...marcadosLote]
            })
            setResumoLote(r)
            toast.success(`Aprovador incluído em ${r.incluidos} centro(s) de custo. ${r.ja_existiam} já tinham esse aprovador no nível.`)
            const p = await getPreviaLote(lote.busca.trim(), nivel)
            setCentrosLote(p.centros)
        } catch (err) {
            mostrarErro(err)
        } finally {
            setSalvandoLote(false)
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
            {
                accessorKey: 'usuario', header: 'Usuário',
                accessorFn: (row) => usuarios.find(u => u.codusuario === row.usuario)?.nome ?? row.usuario
            },
            { accessorKey: 'cargo', header: 'Cargo' },
            { accessorKey: 'valor_inicial', header: 'Valor inicial' },
            { accessorKey: 'valor_final', header: 'Valor final' },
            { accessorKey: 'nivel', header: 'Nível' },
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
        [handleEditarAprovador, usuarios]
    )

    function trocarAba(value: string) {
        if ((value === 'substituicao' || value === 'transferencia') && !ehCsc) return
        setAba(value)
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'substituicao' || value === 'transferencia') params.set('tab', value)
        else params.delete('tab')
        const qs = params.toString()
        router.replace(qs ? `/alcadas?${qs}` : '/alcadas', { scroll: false })
    }

    return (
        <div className="p-6">
            <Tabs value={aba} onValueChange={trocarAba} className="space-y-4">
                <TabsList className="flex-wrap h-auto w-fit">
                    <TabsTrigger value="alcadas">
                        <Users className="w-4 h-4" /> Alçadas
                    </TabsTrigger>
                    {ehCsc && (
                        <TabsTrigger value="substituicao">
                            <UserCog className="w-4 h-4" /> Substituição de Aprovadores
                        </TabsTrigger>
                    )}
                    {ehCsc && (
                        <TabsTrigger value="transferencia">
                            <ArrowRightLeft className="w-4 h-4" /> Transferência definitiva
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="alcadas" className="mt-0 space-y-4">
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-2xl font-bold">{titulo}</CardTitle>
                </CardHeader>

                <CardContent className="flex flex-col gap-2 md:flex-row">
                    <div className="relative flex-1 w-full">
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

                    <Button onClick={handleAbrirLote} variant="outline" className="flex items-center">
                        <ListChecks className="mr-1 h-4 w-4" /> Incluir aprovador em vários CCs
                    </Button>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardContent className="flex flex-col">
                    <DataTable columns={colunas} data={results} loading={loading} hideSearch />
                </CardContent>
            </Card>

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
                </TabsContent>

                {ehCsc && (
                    <TabsContent value="substituicao" className="mt-0">
                        <SubstituicaoAprovadoresPanel />
                    </TabsContent>
                )}
                {ehCsc && (
                    <TabsContent value="transferencia" className="mt-0">
                        <TransferenciaAlcadasPanel />
                    </TabsContent>
                )}
            </Tabs>

            {/* Modal */}
            {alcadaSelecionada && (
                <Dialog open={isModalAprovadoresOpen} onOpenChange={setIsModalAprovadoresOpen}>
                    <DialogContent className="w-full overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90dvh]">
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
                                rules={{
                                    required: 'Centro de custo é obrigatório',
                                    validate: (v) =>
                                        centrosCusto.some((c) => c.ccusto === String(v ?? '').trim()) ||
                                        (updateAlcadaMode && v === alcadaSelecionada?.centro_custo)
                                            ? true
                                            : 'Escolha um centro de custo da lista.',
                                }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Centro de custo</FormLabel>
                                    <FormControl>
                                    <Popover modal open={comboCcAberto} onOpenChange={setComboCcAberto}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full justify-between font-normal"
                                            >
                                                <span className="truncate">
                                                    {field.value
                                                        ? `${field.value} — ${form.getValues('centro_custo_nome') ?? ''}`
                                                        : centrosCusto.length ? 'Selecione o centro de custo' : 'Carregando centros de custo…'}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverPortal>
                                            <PopoverContent
                                                className="p-0 w-[min(100vw-2rem,28rem)] pointer-events-auto z-[9999]"
                                                align="start"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Command>
                                                    <CommandInput placeholder="Buscar por código ou nome..." />
                                                    <CommandList>
                                                        <CommandEmpty>Nenhum centro de custo encontrado.</CommandEmpty>
                                                        <CommandGroup>
                                                            {centrosCusto.map((c) => (
                                                                <CommandItem
                                                                    key={c.ccusto}
                                                                    value={`${c.ccusto} - ${c.custo}`}
                                                                    onSelect={() => {
                                                                        field.onChange(c.ccusto)
                                                                        form.setValue('centro_custo_nome', c.custo, { shouldValidate: true })
                                                                        setComboCcAberto(false)
                                                                    }}
                                                                >
                                                                    {`${c.ccusto} - ${c.custo}`}
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
                            <FormField
                                control={form.control}
                                name="centro_custo_nome"
                                rules={{ required: 'Descrição é obrigatória' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                    <Input {...field} readOnly className="bg-muted" placeholder="Preenchida pelo centro de custo" />
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
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            {updateAprovadoresMode ? `${tituloUpdateAprovador}: ${aprovadorSelecionado?.usuario}` : `${tituloInsertAprovador}`}
                        </DialogTitle>
                    </DialogHeader>

                    <Form {...formAprovadores}>
                        <form onSubmit={formAprovadores.handleSubmit(submitAprovador)} className="grid gap-4">
                            <FormField
                                control={formAprovadores.control}
                                name="usuario"
                                rules={{
                                    required: 'Usuário é obrigatório',
                                    validate: (v) =>
                                        usuarios.some((u) => u.codusuario === String(v ?? '').trim())
                                            ? true
                                            : 'Escolha um usuário da lista (GUSUARIO).',
                                }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Usuário</FormLabel>
                                    <FormControl>
                                    <Popover modal open={comboUsuarioAberto} onOpenChange={setComboUsuarioAberto}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full justify-between font-normal"
                                            >
                                                {usuarios.find(u => u.codusuario === field.value)?.nome
                                                    ? `${field.value} — ${usuarios.find(u => u.codusuario === field.value)?.nome}`
                                                    : field.value || 'Selecione o usuário'}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverPortal>
                                            <PopoverContent
                                                className="p-0 w-[min(100vw-2rem,28rem)] pointer-events-auto z-[9999]"
                                                align="start"
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
                                                                    value={`${u.codusuario} - ${u.nome}`}
                                                                    onSelect={() => {
                                                                        field.onChange(u.codusuario)
                                                                        setComboUsuarioAberto(false)
                                                                    }}
                                                                >
                                                                    {`${u.codusuario} - ${u.nome}`}
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
                                rules={{
                    required: 'Valor final é obrigatório',
                    // Mesma regra da API (AprovadorCadastroRegras.ValidarFaixa).
                    validate: (v, valores) => {
                        const fim = Number(v)
                        if (fim === 1) return 'Valor final não pode ser 1. Sem limite: use um valor alto (ex.: 9999999).'
                        if (fim <= Number(valores.valor_inicial)) return 'Valor final tem que ser maior que o valor inicial.'
                        return true
                    },
                }}
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
                            <FormField
                                control={formAprovadores.control}
                                name="nivel"
                                rules={{ required: 'Nível é obrigatório' }}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nível</FormLabel>
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

            {/* Modal: incluir aprovador em vários centros de custo */}
            <Dialog open={isFormLoteOpen} onOpenChange={setIsFormLoteOpen}>
                <DialogContent className="sm:max-w-3xl overflow-x-auto overflow-y-auto max-h-[90dvh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">
                            Incluir aprovador em vários centros de custo
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Unidade: <strong>{unidadeLogada || '—'}</strong> — só centros de custo visíveis para esta base
                            {unidadeLogada.toUpperCase() === 'WAY CSC'
                                ? ' (filtro Centralizer; códigos costumam ser 001.*).'
                                : (() => {
                                    const n = unidadeLogada.replace(/\D/g, '')
                                    return n ? ` (busque pelo prefixo ${n}., ex.: "${n}.3.08").` : '.'
                                })()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Usuário</Label>
                                <Popover modal open={comboUsuarioLoteAberto} onOpenChange={setComboUsuarioLoteAberto}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-between font-normal"
                                        >
                                            <span className="truncate">
                                                {usuarios.find(u => u.codusuario === lote.usuario)?.nome
                                                    ? `${lote.usuario} — ${usuarios.find(u => u.codusuario === lote.usuario)?.nome}`
                                                    : lote.usuario || 'Selecione o usuário'}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverPortal>
                                        <PopoverContent
                                            className="p-0 w-[min(100vw-2rem,28rem)] pointer-events-auto z-[9999]"
                                            align="start"
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
                                                                value={`${u.codusuario} - ${u.nome}`}
                                                                onSelect={() => {
                                                                    alterarLote('usuario', u.codusuario)
                                                                    setResumoLote(null)
                                                                    setComboUsuarioLoteAberto(false)
                                                                }}
                                                            >
                                                                {`${u.codusuario} - ${u.nome}`}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </PopoverPortal>
                                </Popover>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lote-cargo">Cargo</Label>
                                <Input
                                    id="lote-cargo"
                                    maxLength={50}
                                    value={lote.cargo}
                                    onChange={e => alterarLote('cargo', e.target.value)}
                                    placeholder="Ex.: Gerente de TI"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="lote-nivel">Nível</Label>
                                <Input
                                    id="lote-nivel"
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={lote.nivel}
                                    onChange={e => alterarLote('nivel', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lote-inicial">Valor inicial</Label>
                                <Input
                                    id="lote-inicial"
                                    type="number"
                                    min={0}
                                    value={lote.valor_inicial}
                                    onChange={e => alterarLote('valor_inicial', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lote-final">Valor final</Label>
                                <Input
                                    id="lote-final"
                                    type="number"
                                    min={0}
                                    value={lote.valor_final}
                                    onChange={e => alterarLote('valor_final', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="lote-busca">Centros de custo</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="lote-busca"
                                    value={lote.busca}
                                    onChange={e => alterarLote('busca', e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            buscarCentrosLote()
                                        }
                                    }}
                                    placeholder={
                                        unidadeLogada.toUpperCase() === 'WAY CSC'
                                            ? 'Nome ou código, ex.: "Tecnologia" ou "001.2.01"'
                                            : (() => {
                                                const n = unidadeLogada.replace(/\D/g, '')
                                                return n
                                                    ? `Nome ou código, ex.: "${n}.3.08" (evite só "TI")`
                                                    : 'Nome ou código do centro de custo'
                                            })()
                                    }
                                />
                                <Button type="button" onClick={buscarCentrosLote} disabled={buscandoLote} className="flex items-center">
                                    <SearchIcon className="mr-1 h-4 w-4" /> {buscandoLote ? 'Buscando…' : 'Buscar CCs'}
                                </Button>
                            </div>
                        </div>

                        {centrosLote.length > 0 && (
                            <div className="grid gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <span className="text-muted-foreground">
                                        {marcadosLote.size} de {centrosLote.length} marcado(s). Desmarque o que não for do setor.
                                    </span>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={() => setMarcadosLote(new Set(centrosLote.map(c => c.id)))}>
                                            Marcar todos
                                        </Button>
                                        <Button type="button" size="sm" variant="outline" onClick={() => setMarcadosLote(new Set())}>
                                            Desmarcar todos
                                        </Button>
                                    </div>
                                </div>
                                {loteLimitado && (
                                    <p className="text-sm text-amber-700">
                                        A busca trouxe muitos resultados e a lista foi cortada. Refine o texto para ver todos.
                                    </p>
                                )}
                                <div className="max-h-[40dvh] overflow-y-auto rounded-md border divide-y">
                                    {centrosLote.map((c) => (
                                        <label key={c.id} className="flex cursor-pointer items-start gap-3 p-2 hover:bg-muted/50">
                                            <Checkbox
                                                className="mt-0.5"
                                                checked={marcadosLote.has(c.id)}
                                                onCheckedChange={(v) => marcarCentroLote(c.id, v === true)}
                                            />
                                            <div className="min-w-0 flex-1 text-sm">
                                                <div className="font-medium">{`${c.centro_custo} - ${c.centro_custo_nome}`}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {c.aprovadores_nivel.length
                                                        ? `Nível ${lote.nivel}: ${c.aprovadores_nivel.map(a => usuarios.find(u => u.codusuario.toLowerCase() === a.toLowerCase())?.nome ?? a).join(', ')}`
                                                        : `Nenhum aprovador no nível ${lote.nivel}`}
                                                </div>
                                                {usuarioJaNoNivel(c) && (
                                                    <div className="text-xs font-medium text-amber-700">
                                                        Já é aprovador neste nível (não será incluído de novo)
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {resumoLote && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                                {`Incluído em ${resumoLote.incluidos} centro(s) de custo. ${resumoLote.ja_existiam} já tinham ${resumoLote.usuario} no nível ${lote.nivel}. Ninguém foi removido ou alterado.`}
                            </div>
                        )}

                        <Button type="button" onClick={submitLote} disabled={salvandoLote || marcadosLote.size === 0}>
                            {salvandoLote ? 'Incluindo…' : `Incluir em ${marcadosLote.size} centro(s) de custo`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
