'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { FileText, History, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAll as getAllUsuarios } from '@/services/usuariosService'
import {
  listarHistoricoAtividadesUsuario,
  type HistoricoUsuarioEvento,
} from '@/services/historicoUsuarioService'
import {
  buscarColaboradoresAgrupados,
  labelMesReferencia,
  limitesMesReferencia,
  mesReferenciaAtual,
  type UsuarioAgrupadoPorLogin,
} from '@/lib/usuarioPermissoesRelatorio'
import { gerarPdfHistoricoUsuario, salvarPdf, slugArquivo } from '@/lib/usuarioPermissoesRelatorioPdf'

const LABEL_CATEGORIA: Record<string, string> = {
  permissoes: 'Permissões',
  configuracao: 'Configuração',
  aprovacao: 'Aprovações',
  assinatura: 'Assinaturas',
  rdv: 'RDV',
  receitas: 'Receitas',
}

function formatDataHora(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('pt-BR')
}

export default function HistoricoUsuarioPanel() {
  const [mesRef, setMesRef] = useState(mesReferenciaAtual)
  const [busca, setBusca] = useState('')
  const [colab, setColab] = useState<UsuarioAgrupadoPorLogin | null>(null)
  const [catalogo, setCatalogo] = useState<Awaited<ReturnType<typeof getAllUsuarios>>>([])
  const [loadingBusca, setLoadingBusca] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [eventos, setEventos] = useState<HistoricoUsuarioEvento[]>([])
  const [resumo, setResumo] = useState<{ login: string; nome: string; contagem: Record<string, number> } | null>(
    null
  )
  const [listaAberta, setListaAberta] = useState(false)
  const refBusca = useRef<HTMLDivElement>(null)

  const limites = useMemo(() => limitesMesReferencia(mesRef), [mesRef])

  const sugestoes = useMemo(() => buscarColaboradoresAgrupados(catalogo, busca), [catalogo, busca])

  const carregarCatalogo = useCallback(async () => {
    if (catalogo.length > 0) return catalogo
    setLoadingBusca(true)
    try {
      const users = await getAllUsuarios(undefined)
      setCatalogo(users)
      return users
    } catch (err) {
      toast.error((err as Error).message)
      return []
    } finally {
      setLoadingBusca(false)
    }
  }, [catalogo.length])

  useEffect(() => {
    void carregarCatalogo()
  }, [carregarCatalogo])

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (refBusca.current && !refBusca.current.contains(e.target as Node)) setListaAberta(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  function selecionar(g: UsuarioAgrupadoPorLogin) {
    setColab(g)
    setBusca(g.codusuario)
    setListaAberta(false)
  }

  async function executarBusca() {
    const termo = busca.trim()
    if (termo.length < 2) {
      toast.error('Digite pelo menos 2 caracteres.')
      return
    }
    const users = await carregarCatalogo()
    const lista = buscarColaboradoresAgrupados(users, termo)
    setListaAberta(true)
    if (lista.length === 1) selecionar(lista[0])
    else if (lista.length === 0) {
      setColab(null)
      toast.error('Nenhum colaborador encontrado.')
    } else {
      setColab(null)
      toast.message(`${lista.length} resultado(s). Selecione na lista.`)
    }
  }

  async function carregarHistorico() {
    const login = colab?.codusuario ?? busca.trim()
    if (!login) {
      toast.error('Selecione o colaborador.')
      return
    }
    if (!limites) {
      toast.error('Mês inválido.')
      return
    }

    setLoading(true)
    try {
      const data = await listarHistoricoAtividadesUsuario({
        codusuario: login,
        de: limites.de,
        ate: limites.ate,
        top: 5000,
      })
      setEventos(data.eventos)
      setResumo({ login: data.login, nome: data.nome, contagem: data.contagemPorCategoria })
      toast.success(`${data.eventos.length} atividade(s) em ${labelMesReferencia(mesRef)}.`)
    } catch (err) {
      toast.error((err as Error).message)
      setEventos([])
      setResumo(null)
    } finally {
      setLoading(false)
    }
  }

  async function baixarPdf() {
    if (!resumo || !limites) {
      toast.error('Carregue o histórico antes de gerar o PDF.')
      return
    }
    setLoadingPdf(true)
    try {
      const filtrados =
        categoriaFiltro === 'todas' ? eventos : eventos.filter(e => e.categoria === categoriaFiltro)
      const doc = gerarPdfHistoricoUsuario({
        login: resumo.login,
        nome: resumo.nome,
        periodoDe: limites.de,
        periodoAte: limites.ate,
        eventos: filtrados,
        contagemPorCategoria: resumo.contagem,
      })
      const modo = await salvarPdf(doc, `papersign-historico-${slugArquivo(resumo.login)}-${mesRef}.pdf`)
      if (modo === 'opened') {
        toast.message('PDF aberto — use Compartilhar ou Salvar em Arquivos no celular.')
      } else if (modo === 'shared') {
        toast.success('Escolha onde salvar o PDF.')
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingPdf(false)
    }
  }

  const eventosTabela = useMemo(() => {
    if (categoriaFiltro === 'todas') return eventos
    return eventos.filter(e => e.categoria === categoriaFiltro)
  }, [eventos, categoriaFiltro])

  const colunas: ColumnDef<HistoricoUsuarioEvento>[] = [
    {
      accessorKey: 'dataHora',
      header: 'Data/hora',
      cell: ({ row }) => formatDataHora(row.original.dataHora),
    },
    {
      accessorKey: 'categoria',
      header: 'Tipo',
      cell: ({ row }) => LABEL_CATEGORIA[row.original.categoria] ?? row.original.categoria,
    },
    { accessorKey: 'modulo', header: 'Módulo' },
    { accessorKey: 'unidade', header: 'Base' },
    { accessorKey: 'titulo', header: 'Resumo' },
    {
      accessorKey: 'detalhe',
      header: 'Detalhe',
      cell: ({ row }) => (
        <span className="text-xs whitespace-pre-wrap line-clamp-3">{row.original.detalhe || '—'}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico do usuário
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Relatório de <strong>tudo que o colaborador fez</strong> no período: permissões,
            configurações (alçadas, CC, aprovadores), aprovações e assinaturas com descrição do documento ou
            movimento, RDV, receitas e demais módulos Way.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label>Mês de referência</Label>
              <Input
                type="month"
                value={mesRef}
                onChange={e => setMesRef(e.target.value.slice(0, 7))}
              />
            </div>
            <div className="relative flex flex-col gap-1 min-w-[260px] flex-1" ref={refBusca}>
              <Label>Colaborador (login ou nome)</Label>
              <div className="flex gap-2">
                <Input
                  value={busca}
                  autoComplete="off"
                  placeholder="Ex.: eubertson, 1-10008"
                  onChange={e => {
                    setBusca(e.target.value)
                    setColab(null)
                    setListaAberta(e.target.value.trim().length >= 2)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (colab) void carregarHistorico()
                      else void executarBusca()
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => void executarBusca()} disabled={loadingBusca}>
                  <SearchIcon className="h-4 w-4" />
                </Button>
              </div>
              {listaAberta && busca.trim().length >= 2 && (
                <ul className="absolute z-50 top-full mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                  {sugestoes.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</li>
                  ) : (
                    sugestoes.map(g => (
                      <li key={g.codusuario}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => selecionar(g)}
                        >
                          <span className="font-medium">{g.nome}</span>
                          <span className="text-muted-foreground text-xs block">{g.codusuario}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <Button onClick={() => void carregarHistorico()} disabled={loading}>
              {loading ? 'Buscando…' : 'Carregar histórico'}
            </Button>
            <Button variant="default" onClick={() => void baixarPdf()} disabled={loadingPdf || !resumo}>
              <FileText className="mr-2 h-4 w-4" />
              {loadingPdf ? 'PDF…' : 'Baixar PDF'}
            </Button>
          </div>
          {colab && (
            <p className="text-sm text-muted-foreground border rounded-md bg-muted/40 px-3 py-2">
              <strong>{colab.nome}</strong> ({colab.codusuario})
            </p>
          )}
        </CardContent>
      </Card>

      {resumo && (
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(resumo.contagem).map(([k, n]) => (
            <span key={k} className="rounded-md border bg-muted/50 px-2 py-1">
              {LABEL_CATEGORIA[k] ?? k}: <strong>{n}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 max-w-xs">
        <Label>Filtrar tipo</Label>
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos</SelectItem>
            <SelectItem value="permissoes">Permissões</SelectItem>
            <SelectItem value="configuracao">Configuração</SelectItem>
            <SelectItem value="aprovacao">Aprovações</SelectItem>
            <SelectItem value="assinatura">Assinaturas</SelectItem>
            <SelectItem value="rdv">RDV</SelectItem>
            <SelectItem value="receitas">Receitas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={colunas} data={eventosTabela} hideSearch />
    </div>
  )
}
