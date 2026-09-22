'use client'



import React, { useEffect, useMemo, useState } from 'react'

import { ColumnDef } from '@tanstack/react-table'

import { Check, ChevronsUpDown, ClipboardList, Download, Eye, FileText, Layers, Loader2, Paperclip, Search, Users } from 'lucide-react'

import { toast } from 'sonner'



import PdfViewerDialog from '@/components/PdfViewerDialog'

import { Button } from '@/components/ui/button'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {

  Command,

  CommandEmpty,

  CommandGroup,

  CommandInput,

  CommandItem,

  CommandList,

} from '@/components/ui/command'

import { DataTable } from '@/components/ui/data-table'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { Input } from '@/components/ui/input'

import { Label } from '@/components/ui/label'

import {

  Popover,

  PopoverContent,

  PopoverTrigger,

} from '@/components/ui/popover'

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from '@/components/ui/select'

import {

  consultarExtratoGestor,

  ExtratoGestorAprovacao,

  ExtratoGestorAprovador,

  ExtratoGestorCentroCusto,

  ExtratoGestorItem,

  listarAprovacoesExtratoGestor,

  listarAprovadoresExtratoGestor,

  listarCentrosCustoExtratoGestor,

  listarTiposMovimentoExtratoGestor,

  UNIDADES_EXTRATO_GESTOR,

} from '@/services/extratoGestorService'
import { baixarAnexo, getAll as getAllAnexos } from '@/services/anexoService'
import { formatMoney } from '@/services/receitasService'
import type { Anexo } from '@/types/Anexo'
import { rotinaTipoMovimento, safeDateLabelAprovacao } from '@/utils/functions'
import { mensagemDownloadSucesso } from '@/utils/downloadFile'

function labelTipoMovimento(codigo: string): string {
  const nome = rotinaTipoMovimento(codigo)
  return nome && nome !== 'Desconhecida' ? `${codigo} — ${nome}` : codigo
}

function labelSituacao(situacao: string): string {
  switch (situacao?.trim().toUpperCase()) {
    case 'A':
      return 'Aprovado'
    case 'R':
      return 'Reprovado'
    case 'P':
    default:
      return 'Pendente'
  }
}

export default function ExtratoGestorPage() {

  const [ehCsc, setEhCsc] = useState(false)

  const [unidadeUsuario, setUnidadeUsuario] = useState('')

  const [unidade, setUnidade] = useState('')

  const [buscaAprovador, setBuscaAprovador] = useState('')

  const [aprovadores, setAprovadores] = useState<ExtratoGestorAprovador[]>([])

  const [carregandoAprovadores, setCarregandoAprovadores] = useState(false)

  const [aprovadorSelecionado, setAprovadorSelecionado] = useState<ExtratoGestorAprovador | null>(null)

  const [comboAberto, setComboAberto] = useState(false)

  const [resultados, setResultados] = useState<ExtratoGestorItem[]>([])

  const [total, setTotal] = useState(0)

  const [carregando, setCarregando] = useState(false)

  const [buscou, setBuscou] = useState(false)

  const [tiposMovimento, setTiposMovimento] = useState<string[]>([])

  const [carregandoTipos, setCarregandoTipos] = useState(false)

  const [tipoMovimento, setTipoMovimento] = useState('')

  const [dataInicio, setDataInicio] = useState('')

  const [dataFim, setDataFim] = useState('')

  const [modalCentrosAberto, setModalCentrosAberto] = useState(false)

  const [idmovSelecionado, setIdmovSelecionado] = useState<number | null>(null)

  const [centrosCusto, setCentrosCusto] = useState<ExtratoGestorCentroCusto[]>([])

  const [carregandoCentros, setCarregandoCentros] = useState(false)

  const [modalAprovacoesAberto, setModalAprovacoesAberto] = useState(false)

  const [aprovacoes, setAprovacoes] = useState<ExtratoGestorAprovacao[]>([])

  const [carregandoAprovacoes, setCarregandoAprovacoes] = useState(false)

  const [modalAnexosAberto, setModalAnexosAberto] = useState(false)

  const [anexos, setAnexos] = useState<Anexo[]>([])

  const [carregandoAnexos, setCarregandoAnexos] = useState(false)

  const [pdfAberto, setPdfAberto] = useState(false)

  const [pdfBase64, setPdfBase64] = useState<string | null>(null)

  const [pdfTitulo, setPdfTitulo] = useState('')



  useEffect(() => {

    try {

      const raw = sessionStorage.getItem('userData')

      if (!raw) return

      const u = JSON.parse(raw)

      const un = String(u.unidade ?? '').trim()

      setEhCsc(un.toUpperCase() === 'WAY CSC')

      setUnidadeUsuario(un)

      setUnidade(un || UNIDADES_EXTRATO_GESTOR[0])

    } catch {

      setUnidade(UNIDADES_EXTRATO_GESTOR[0])

    }

  }, [])



  useEffect(() => {

    const termo = buscaAprovador.trim()

    if (termo.length < 2) {

      setAprovadores([])

      return

    }



    const timer = window.setTimeout(async () => {

      setCarregandoAprovadores(true)

      try {

        const lista = await listarAprovadoresExtratoGestor(termo, unidade)

        setAprovadores(lista)

      } catch (err) {

        setAprovadores([])

        toast.error(err instanceof Error ? err.message : 'Falha ao buscar aprovadores.')

      } finally {

        setCarregandoAprovadores(false)

      }

    }, 300)



    return () => window.clearTimeout(timer)

  }, [buscaAprovador, unidade])



  useEffect(() => {

    if (!aprovadorSelecionado || !unidade) {

      setTiposMovimento([])

      setTipoMovimento('')

      return

    }



    let ativo = true

    setCarregandoTipos(true)

    setTiposMovimento([])

    setTipoMovimento('')



    listarTiposMovimentoExtratoGestor(aprovadorSelecionado.codusuario, unidade)

      .then((tipos) => {

        if (!ativo) return

        setTiposMovimento(tipos)

      })

      .catch((err) => {

        if (!ativo) return

        setTiposMovimento([])

        toast.error(err instanceof Error ? err.message : 'Falha ao carregar tipos de movimento.')

      })

      .finally(() => {

        if (ativo) setCarregandoTipos(false)

      })



    return () => {

      ativo = false

    }

  }, [aprovadorSelecionado, unidade])



  async function abrirAprovacoes(item: ExtratoGestorItem) {

    setIdmovSelecionado(item.idmov)

    setModalAprovacoesAberto(true)

    setCarregandoAprovacoes(true)

    setAprovacoes([])

    try {

      const dados = await listarAprovacoesExtratoGestor(item.idmov, unidade)

      setAprovacoes(dados)

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Falha ao carregar aprovações.')

    } finally {

      setCarregandoAprovacoes(false)

    }

  }



  async function abrirAnexos(item: ExtratoGestorItem) {

    setIdmovSelecionado(item.idmov)

    setModalAnexosAberto(true)

    setCarregandoAnexos(true)

    setAnexos([])

    try {

      const dados = await getAllAnexos(item.idmov)

      setAnexos(dados)

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Falha ao carregar anexos.')

    } finally {

      setCarregandoAnexos(false)

    }

  }



  function visualizarAnexo(anexo: Anexo) {

    if (!anexo.anexo) return

    setPdfBase64(anexo.anexo)

    setPdfTitulo(anexo.nome || 'Anexo')

    setPdfAberto(true)

  }



  async function downloadAnexo(anexo: Anexo) {

    try {

      const result = await baixarAnexo(anexo)

      toast.success(mensagemDownloadSucesso(result, anexo.nome || 'anexo'))

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Falha ao baixar anexo.')

    }

  }



  async function abrirCentrosCusto(item: ExtratoGestorItem) {

    setIdmovSelecionado(item.idmov)

    setModalCentrosAberto(true)

    setCarregandoCentros(true)

    setCentrosCusto([])

    try {

      const dados = await listarCentrosCustoExtratoGestor(item.idmov, unidade)

      setCentrosCusto(dados)

    } catch (err) {

      toast.error(err instanceof Error ? err.message : 'Falha ao carregar centros de custo.')

    } finally {

      setCarregandoCentros(false)

    }

  }



  const colunas = useMemo<ColumnDef<ExtratoGestorItem>[]>(() => [

    { accessorKey: 'idmov', header: 'IDMOV' },

    {

      accessorKey: 'tipo_movimento',

      header: 'Tipo de movimento',

      cell: ({ row }) => {

        const codigo = row.original.tipo_movimento?.trim() ?? ''

        const nome = rotinaTipoMovimento(codigo)

        return nome && nome !== 'Desconhecida' ? `${codigo} — ${nome}` : codigo

      },

    },

    { accessorKey: 'numero_movimento', header: 'Número do movimento (RM)' },

    {

      accessorKey: 'valor_total',

      header: 'Valor',

      cell: ({ row }) => formatMoney(row.original.valor_total),

    },

    {

      accessorKey: 'data_aprovacao',

      header: 'Data da aprovação',

      cell: ({ row }) => safeDateLabelAprovacao(row.original.data_aprovacao),

    },

    {

      id: 'acoes',

      header: 'Ações',

      cell: ({ row }) => (

        <div className="flex flex-wrap gap-2">

          <Button

            type="button"

            size="sm"

            variant="outline"

            onClick={() => abrirAprovacoes(row.original)}

          >

            <Users className="mr-1 h-4 w-4" />

            Aprovações

          </Button>

          <Button

            type="button"

            size="sm"

            variant="outline"

            onClick={() => abrirCentrosCusto(row.original)}

          >

            <Layers className="mr-1 h-4 w-4" />

            Centros ({row.original.quantidade_centros_custo ?? 0})

          </Button>

          <Button

            type="button"

            size="sm"

            variant="outline"

            onClick={() => abrirAnexos(row.original)}

          >

            <Paperclip className="mr-1 h-4 w-4" />

            Anexos ({row.original.quantidade_anexos ?? 0})

          </Button>

        </div>

      ),

    },

  ], [unidade])



  const colunasAprovacoes = useMemo<ColumnDef<ExtratoGestorAprovacao>[]>(() => [

    { accessorKey: 'nivel', header: 'Nível' },

    { accessorKey: 'cargo', header: 'Cargo' },

    { accessorKey: 'nome', header: 'Usuário' },

    {

      accessorKey: 'situacao',

      header: 'Situação',

      accessorFn: (row) => labelSituacao(row.situacao),

    },

    {

      accessorKey: 'data_aprovacao',

      header: 'Data',

      accessorFn: (row) => safeDateLabelAprovacao(row.data_aprovacao),

    },

  ], [])



  async function handleBuscar() {

    if (!aprovadorSelecionado) {

      toast.error('Selecione um gestor/aprovador das alçadas.')

      return

    }



    if (dataInicio && dataFim && dataInicio > dataFim) {

      toast.error('Data início não pode ser maior que data fim.')

      return

    }



    setCarregando(true)

    setBuscou(true)

    try {

      const resposta = await consultarExtratoGestor(aprovadorSelecionado.codusuario, unidade, {

        tipo_movimento: tipoMovimento || undefined,

        data_inicio: dataInicio || undefined,

        data_fim: dataFim || undefined,

      })

      setResultados(resposta.itens)

      setTotal(resposta.total)

      if (resposta.total === 0) {

        toast.message('Nenhum movimento aprovado encontrado para esse gestor.')

      }

    } catch (err) {

      setResultados([])

      setTotal(0)

      toast.error(err instanceof Error ? err.message : 'Falha na consulta.')

    } finally {

      setCarregando(false)

    }

  }



  const unidadesSelect = ehCsc

    ? [...UNIDADES_EXTRATO_GESTOR]

    : unidadeUsuario

      ? [unidadeUsuario]

      : [...UNIDADES_EXTRATO_GESTOR]



  return (

    <div className="space-y-6">

      <div>

        <h1 className="flex items-center gap-2 text-2xl font-semibold">

          <ClipboardList className="h-6 w-6" />

          Extrato do gestor

        </h1>

        <p className="mt-1 text-sm text-muted-foreground">

          Selecione um aprovador cadastrado nas alçadas e liste os movimentos em que ele aprovou (situação aprovada).

        </p>

      </div>



      <Card>

        <CardHeader className="pb-3">

          <CardTitle className="text-base">Consulta</CardTitle>

        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <div className="space-y-1">
              <Label htmlFor="extrato-unidade">Unidade</Label>
              <Select
                value={unidade}
                onValueChange={(value) => {
                  setUnidade(value)
                  setAprovadorSelecionado(null)
                  setBuscaAprovador('')
                  setAprovadores([])
                  setTipoMovimento('')
                  setTiposMovimento([])
                  setBuscou(false)
                  setResultados([])
                  setTotal(0)
                }}
                disabled={!ehCsc && Boolean(unidadeUsuario)}
              >
                <SelectTrigger id="extrato-unidade" className="h-11 w-full">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidadesSelect.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Gestor / aprovador (alçadas)</Label>
              <Popover open={comboAberto} onOpenChange={setComboAberto}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-between font-normal"
                  >
                    <span className="truncate text-left">
                      {aprovadorSelecionado
                        ? `${aprovadorSelecionado.nome} (${aprovadorSelecionado.codusuario})`
                        : 'Busque pelo nome ou login…'}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="pointer-events-auto z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Ex.: Guilherme Baldassari"
                      onValueChange={setBuscaAprovador}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {carregandoAprovadores
                          ? 'Buscando…'
                          : buscaAprovador.trim().length < 2
                            ? 'Digite pelo menos 2 caracteres.'
                            : 'Nenhum aprovador encontrado nas alçadas.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {aprovadores.map((u) => (
                          <CommandItem
                            key={u.codusuario}
                            value={`${u.codusuario} ${u.nome}`}
                            onSelect={() => {
                              setAprovadorSelecionado(u)
                              setComboAberto(false)
                              setTipoMovimento('')
                              setTiposMovimento([])
                              setBuscou(false)
                              setResultados([])
                              setTotal(0)
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                aprovadorSelecionado?.codusuario === u.codusuario
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              }`}
                            />
                            <span>{u.nome} ({u.codusuario})</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button type="button" onClick={handleBuscar} disabled={carregando} className="h-11 w-full lg:w-auto">
                {carregando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {carregando ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="extrato-tipo">Tipo de movimento</Label>
              <Select
                value={tipoMovimento || '__todos__'}
                onValueChange={(v) => setTipoMovimento(v === '__todos__' ? '' : v)}
                disabled={!aprovadorSelecionado || carregandoTipos}
              >
                <SelectTrigger id="extrato-tipo" className="h-11 w-full">
                  <SelectValue
                    placeholder={
                      carregandoTipos
                        ? 'Carregando tipos…'
                        : !aprovadorSelecionado
                          ? 'Selecione o gestor'
                          : 'Todos os tipos'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os tipos</SelectItem>
                  {tiposMovimento.map((t) => (
                    <SelectItem key={t} value={t}>{labelTipoMovimento(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {carregandoTipos && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando tipos de movimento…
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="extrato-data-inicio">Aprovação de</Label>
              <Input
                id="extrato-data-inicio"
                type="date"
                className="h-11"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="extrato-data-fim">Aprovação até</Label>
              <Input
                id="extrato-data-fim"
                type="date"
                className="h-11"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>
        </CardContent>

      </Card>



      {buscou && (

        <Card>

          <CardHeader className="pb-3">

            <CardTitle className="text-base">

              Resultados {total > 0 ? `(${total})` : ''}

            </CardTitle>

          </CardHeader>

          <CardContent>

            <DataTable

              columns={colunas}

              data={resultados}

              loading={carregando}

              pageSize={10}

              globalFilterAccessorKey={['idmov', 'tipo_movimento', 'numero_movimento', 'data_aprovacao']}

              searchPlaceholder="Filtrar nesta lista…"

              emptyMessage="Nenhum movimento aprovado encontrado para esse gestor."

            />

          </CardContent>

        </Card>

      )}



      <Dialog open={modalAprovacoesAberto} onOpenChange={setModalAprovacoesAberto}>

        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">

          <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-center sm:text-center">

            <DialogTitle className="text-lg font-semibold">Aprovações</DialogTitle>

            <p className="text-sm text-muted-foreground">Movimento IDMOV {idmovSelecionado}</p>

          </DialogHeader>

          <div className="px-6 py-4">

            <DataTable

              columns={colunasAprovacoes}

              data={aprovacoes}

              loading={carregandoAprovacoes}

              hidePagination

              searchPlaceholder="Filtrar aprovações…"

            />

          </div>

        </DialogContent>

      </Dialog>



      <Dialog open={modalAnexosAberto} onOpenChange={setModalAnexosAberto}>

        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">

          <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-center sm:text-center">

            <DialogTitle className="text-lg font-semibold">Anexos</DialogTitle>

            <p className="text-sm text-muted-foreground">

              Movimento IDMOV {idmovSelecionado}

              {!carregandoAnexos && anexos.length > 0 ? ` · ${anexos.length} arquivo${anexos.length === 1 ? '' : 's'}` : ''}

            </p>

          </DialogHeader>

          <div className="px-6 py-4">

            {carregandoAnexos ? (

              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">

                <Loader2 className="h-4 w-4 animate-spin" />

                Carregando anexos…

              </div>

            ) : anexos.length === 0 ? (

              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum anexo encontrado.</p>

            ) : (

              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">

                {anexos.map((anexo) => (

                  <li

                    key={anexo.id}

                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"

                  >

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">

                      <FileText className="h-4 w-4 text-muted-foreground" />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-medium">{anexo.nome || 'Sem nome'}</p>

                      <p className="text-xs text-muted-foreground">ID {anexo.id}</p>

                    </div>

                    {anexo.anexo ? (

                      <div className="flex shrink-0 gap-2">

                        <Button

                          type="button"

                          size="sm"

                          variant="outline"

                          onClick={() => visualizarAnexo(anexo)}

                        >

                          <Eye className="mr-1.5 h-4 w-4" />

                          Visualizar

                        </Button>

                        <Button

                          type="button"

                          size="sm"

                          variant="outline"

                          onClick={() => downloadAnexo(anexo)}

                        >

                          <Download className="mr-1.5 h-4 w-4" />

                          Baixar

                        </Button>

                      </div>

                    ) : (

                      <span className="shrink-0 text-xs text-muted-foreground">Indisponível</span>

                    )}

                  </li>

                ))}

              </ul>

            )}

          </div>

        </DialogContent>

      </Dialog>



      <Dialog open={modalCentrosAberto} onOpenChange={setModalCentrosAberto}>

        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-xl">

          <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-center sm:text-center">

            <DialogTitle className="text-lg font-semibold">Centros de custo</DialogTitle>

            <p className="text-sm text-muted-foreground">

              Movimento IDMOV {idmovSelecionado}

              {!carregandoCentros && centrosCusto.length > 0

                ? ` · ${centrosCusto.length} centro${centrosCusto.length === 1 ? '' : 's'}`

                : ''}

            </p>

          </DialogHeader>

          <div className="px-6 py-4">

            {carregandoCentros ? (

              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">

                <Loader2 className="h-4 w-4 animate-spin" />

                Carregando centros de custo…

              </div>

            ) : centrosCusto.length === 0 ? (

              <p className="py-12 text-center text-sm text-muted-foreground">

                Nenhum centro de custo encontrado para este movimento.

              </p>

            ) : (

              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">

                {centrosCusto.map((centro) => (

                  <li

                    key={centro.centro_custo}

                    className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40"

                  >

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">

                      <Layers className="h-4 w-4 text-muted-foreground" />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-medium">{centro.centro_custo}</p>

                      <p className="truncate text-xs text-muted-foreground">

                        {centro.centro_custo_nome || 'Sem descrição'}

                      </p>

                    </div>

                  </li>

                ))}

              </ul>

            )}

          </div>

        </DialogContent>

      </Dialog>



      <PdfViewerDialog

        open={pdfAberto}

        onOpenChange={setPdfAberto}

        title={pdfTitulo}

        pdfBase64={pdfBase64}

      />

    </div>

  )

}


