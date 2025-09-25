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
import { SearchIcon, SquarePlus, Trash2, X } from 'lucide-react'

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

import { safeDateLabel, stripDiacritics } from '@/utils/functions'
import {
    RequisicaoDto,
    getAll as getAllRequisicoes
} from '@/services/requisicoesService'

export default function PageUsuarios() {
    const titulo = 'Requisições'
    const router = useRouter()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')
    const [results, setResults] = useState<RequisicaoDto[]>([])
    const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoDto>()
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isModalItensOpen, setIsModalItensOpen] = useState(false)
    const [situacaoFiltrada, setSituacaoFiltrada] = useState<string>("")
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
            const dados = await getAllRequisicoes()
            const qNorm = stripDiacritics(q.toLowerCase().trim())
            const filtrados = dados.filter(d => {
                const movimento = stripDiacritics((d.requisicao.movimento ?? '').toLowerCase())
                const base = stripDiacritics((d.requisicao.base_de_dado ?? '').toLowerCase())
                const matchQuery = qNorm === '' || movimento.includes(qNorm)|| base.includes(qNorm) || String(d.requisicao.id ?? '').includes(qNorm)
                const matchSituacao = situacaoFiltrada == '' || d.requisicao.situacao == situacaoFiltrada
                return matchQuery && matchSituacao
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

    async function handleDocumento (id: number) {
        console.log(id);        
    }

    async function handleItens (id: number) {
        console.log(id);
    }

    async function handleAprovar (id: number) {
        console.log(id);
    }

    async function handleReprovar (id: number) {
        console.log(id);
    }
    
    const colunas = useMemo<ColumnDef<RequisicaoDto>[]>(
        () => [
            { accessorKey: 'requisicao.id', header: 'ID' },
            { accessorKey: 'requisicao.base_de_dado', header: 'Base' },
            { accessorKey: 'requisicao.movimento', header: 'Movimento' },
            { accessorKey: 'requisicao.tipo_movimento', header: 'Tipo movimento' },
            { accessorKey: 'requisicao.data_emissao', header: 'Data emissão', accessorFn: (row) => safeDateLabel(row.requisicao.data_emissao) },
            { 
                accessorKey: 'requisicao.valor_bruto', 
                header: 'Valor bruto', 
                accessorFn: (row) => `R$ ${row.requisicao.valor_bruto.toFixed(2)}`
            },
            { 
                accessorKey: 'requisicao.situacao', 
                header: 'Situação', 
                accessorFn: (row) => {
                    switch (row.requisicao.situacao) {
                        case 'P': return "Pendente";
                        case 'A': return "Aprovada";
                        case 'R': return "Reprovada";
                    }
                }
            },
            {
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDocumento(row.original.requisicao.id)}
                        >
                            Documento
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleItens(row.original.requisicao.id)}
                        >
                            Itens
                        </Button>
                        {row.original.requisicao.situacao == "P" && (<Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleAprovar(row.original.requisicao.id)}
                        >
                            Aprovar
                        </Button>)}
                        {row.original.requisicao.situacao == "P" && (<Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReprovar(row.original.requisicao.id)}
                        >
                            Reprovar
                        </Button>)}
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
        </CardContent>
      </Card>

        <Card className="mb-6">
            <CardContent className="flex flex-col">
                <DataTable columns={colunas} data={results} loading={loading} />
            </CardContent>
        </Card>

        {/* Modal */}
        {requisicaoSelecionada && (
            <Dialog open={isModalItensOpen} onOpenChange={setIsModalItensOpen}>
                <DialogContent className="max-w-md overflow-x-auto overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-center">{`Itens requisição n° ${requisicaoSelecionada.requisicao.id}`}</DialogTitle>
                    </DialogHeader>            
                </DialogContent>
            </Dialog>
        )}

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
