'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, Loader2, UserSearch, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PopoverPortal } from '@radix-ui/react-popover'
import {
  AlcadaPorUsuarioLinha,
  getAlcadasPorUsuario,
} from '@/services/alcadasService'
import { getUsuariosAprovadores, Usuario } from '@/services/usuariosService'
import { downloadBlobFile } from '@/lib/downloadFile'
import { stripDiacritics, toMoney } from '@/utils/functions'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
  podeTrocarUnidade: boolean
  onAbrirCentro?: (centroCusto: string) => void
}

function faixaValor(inicio: number, fim: number) {
  const ini = toMoney(inicio)
  if (fim <= 0) return `${ini} a sem limite`
  return `${ini} a ${toMoney(fim)}`
}

function escapeCsv(c: string) {
  if (/[;"\r\n]/.test(c)) return `"${c.replace(/"/g, '""')}"`
  return c
}

export default function AlcadasPorUsuario({ unidadeLogada, podeTrocarUnidade, onAbrirCentro }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuario, setUsuario] = useState('')
  const [unidadeConsulta, setUnidadeConsulta] = useState(unidadeLogada)
  const [comboAberto, setComboAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [dados, setDados] = useState<Awaited<ReturnType<typeof getAlcadasPorUsuario>> | null>(null)
  const carregouUsuarios = useRef(false)

  useEffect(() => {
    setUnidadeConsulta(unidadeLogada)
  }, [unidadeLogada])

  useEffect(() => {
    if (carregouUsuarios.current) return
    void (async () => {
      try {
        setUsuarios(await getUsuariosAprovadores())
        carregouUsuarios.current = true
      } catch {
        setUsuarios([])
      }
    })()
  }, [])

  const nomeUsuario = usuarios.find((u) => u.codusuario === usuario)?.nome

  async function consultar() {
    const login = usuario.trim()
    if (!login) {
      toast.error('Selecione um usuário.')
      return
    }
    setCarregando(true)
    setDados(null)
    try {
      const unidade = podeTrocarUnidade && unidadeConsulta.trim() ? unidadeConsulta.trim() : undefined
      setDados(await getAlcadasPorUsuario(login, unidade))
    } catch (e) {
      mostrarErro(e)
    } finally {
      setCarregando(false)
    }
  }

  const linhasFiltradas = useMemo(() => {
    if (!dados?.linhas) return []
    const q = stripDiacritics(filtro.toLowerCase().trim())
    if (!q) return dados.linhas
    return dados.linhas.filter((l) => {
      const blob = [l.centro_custo, l.centro_custo_nome].join(' ').toLowerCase()
      return stripDiacritics(blob).includes(q)
    })
  }, [dados, filtro])

  const colunas = useMemo<ColumnDef<AlcadaPorUsuarioLinha>[]>(
    () => [
      { accessorKey: 'centro_custo', header: 'Conta (centro de custo)' },
      { accessorKey: 'centro_custo_nome', header: 'Nome do centro de custo' },
      { accessorKey: 'nivel', header: 'Ordem (nível)' },
      {
        id: 'faixa',
        header: 'Faixa de valor',
        cell: ({ row }) => faixaValor(row.original.valor_inicial, row.original.valor_final),
      },
      { accessorKey: 'cargo', header: 'Cargo' },
      { accessorKey: 'situacao', header: 'Situação' },
      {
        id: 'outros',
        header: 'Outros do mesmo nível',
        cell: ({ row }) => (
          <span title="A regra exige que todos os aprovadores deste nível aprovem">
            {row.original.qtd_no_nivel}
          </span>
        ),
      },
      {
        id: 'visivel',
        header: 'Visível na lista',
        cell: ({ row }) =>
          row.original.visivel_na_lista ? (
            <Badge variant="secondary">Sim</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
              Não
            </Badge>
          ),
      },
    ],
    []
  )

  async function exportarCsv() {
    if (!dados?.linhas.length) {
      toast.info('Nada para exportar.')
      return
    }
    const cab = [
      'Conta',
      'Nome do centro de custo',
      'Ordem (nível)',
      'Valor inicial',
      'Valor final',
      'Faixa',
      'Cargo',
      'Situação',
      'Outros do mesmo nível',
      'Visível na lista',
      'Unidade',
    ]
    const linhas = linhasFiltradas.map((l) =>
      [
        l.centro_custo,
        l.centro_custo_nome,
        String(l.nivel),
        String(l.valor_inicial),
        String(l.valor_final),
        faixaValor(l.valor_inicial, l.valor_final),
        l.cargo,
        l.situacao,
        String(l.qtd_no_nivel),
        l.visivel_na_lista ? 'Sim' : 'Não',
        l.unidade,
      ]
        .map(escapeCsv)
        .join(';')
    )
    const csv = `\uFEFF${cab.join(';')}\r\n${linhas.join('\r\n')}\r\n`
    const slug = dados.usuario.replace(/[^\w.-]+/g, '_')
    await downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `alcadas-por-usuario-${slug}.csv`)
    toast.success('CSV exportado.')
  }

  const resumoNiveis =
    dados?.resumo.por_nivel.map((n) => `Nível ${n.nivel}: ${n.quantidade}`).join(' · ') ?? ''

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alçadas por usuário</CardTitle>
          <p className="text-sm text-muted-foreground">
            Somente leitura: todas as alçadas em que o usuário aparece como aprovador na unidade (inclui logins com o
            mesmo e-mail no GUSUARIO). &quot;Visível na lista&quot; usa a tabela de filtro da unidade (ex. USUARIOCCUSTO_EXPLICIT
            na WAY 306), como a guia Centros de custo.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="grid min-w-[16rem] flex-1 gap-2">
            <Label>Usuário</Label>
            <Popover modal open={comboAberto} onOpenChange={setComboAberto}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">
                    {nomeUsuario ? `${usuario} — ${nomeUsuario}` : usuario || 'Selecione o usuário'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent className="z-[9999] w-[min(100vw-2rem,28rem)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por login ou nome..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {usuarios.map((u) => (
                          <CommandItem
                            key={u.codusuario}
                            value={`${u.codusuario} - ${u.nome}`}
                            onSelect={() => {
                              setUsuario(u.codusuario)
                              setComboAberto(false)
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

          {podeTrocarUnidade && (
            <div className="grid min-w-[12rem] gap-2">
              <Label htmlFor="unidade-por-usuario">Unidade</Label>
              <Input
                id="unidade-por-usuario"
                value={unidadeConsulta}
                onChange={(e) => setUnidadeConsulta(e.target.value)}
                placeholder="Ex.: WAY 306"
              />
            </div>
          )}

          <Button type="button" onClick={() => void consultar()} disabled={carregando} className="flex items-center">
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
            {carregando ? 'Consultando…' : 'Consultar'}
          </Button>
        </CardContent>
      </Card>

      {dados && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total de alçadas (linhas)</p>
                <p className="text-2xl font-bold tabular-nums">{dados.resumo.total_linhas}</p>
                <p className="truncate text-xs text-muted-foreground" title={dados.usuario}>
                  {dados.usuario}
                  {nomeUsuario ? ` · ${nomeUsuario}` : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Centros de custo distintos</p>
                <p className="text-2xl font-bold tabular-nums">{dados.resumo.total_centros_distintos}</p>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardContent className="pt-4">
                <p className="mb-1 text-xs text-muted-foreground">Por nível</p>
                <p className="text-sm">{resumoNiveis || '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Unidade: {dados.unidade}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-md flex-1">
                  <Input
                    placeholder="Filtrar por conta ou nome do centro de custo…"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="pr-9"
                  />
                  {filtro && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                      onClick={() => setFiltro('')}
                      aria-label="Limpar filtro"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void exportarCsv()} disabled={!linhasFiltradas.length}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
              </div>
              <DataTable
                columns={colunas}
                data={linhasFiltradas}
                loading={carregando}
                hideSearch
                onRowClick={onAbrirCentro ? (linha) => onAbrirCentro(linha.centro_custo) : undefined}
              />
              {dados.resumo.total_linhas === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Este usuário não está em nenhuma alçada nesta unidade.
                </p>
              )}
              {onAbrirCentro && linhasFiltradas.length > 0 && (
                <p className="text-xs text-muted-foreground">Clique na linha para localizar o centro na guia Centros de custo.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!dados && !carregando && (
        <p className="text-center text-sm text-muted-foreground">Selecione um usuário e clique em Consultar.</p>
      )}
    </div>
  )
}
