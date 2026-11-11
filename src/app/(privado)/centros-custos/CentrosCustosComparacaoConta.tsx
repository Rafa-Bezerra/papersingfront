'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, List, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { UsuarioAncoraTriggerLabel } from '@/components/usuario/UsuarioSelecionadoChip'
import {
  CentroDeCusto,
  ContaFinanceira,
  getAllCentrosDeCusto,
  getAllContasFinanceiras,
  getCentrosVinculadosAConta,
  getContasVinculadasAoCentro,
} from '@/services/mgoFinanceiroService'
import {
  exportarCentrosDaContaExcel,
  exportarContasDoCentroExcel,
  exportarMatrizCcContaExcel,
} from '@/lib/exportMatrizCcConta'
import type { MgoFinanceiro } from '@/types/MgoFinanceiro'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
}

export default function CentrosCustosComparacaoConta({ unidadeLogada }: Props) {
  const unidade = unidadeLogada
  const [centros, setCentros] = useState<CentroDeCusto[]>([])
  const [contas, setContas] = useState<ContaFinanceira[]>([])
  const [modo, setModo] = useState<'cc' | 'conta'>('cc')

  const [ccConsulta, setCcConsulta] = useState('')
  const [comboCcConsulta, setComboCcConsulta] = useState(false)
  const [vinculosCc, setVinculosCc] = useState<MgoFinanceiro[]>([])
  const [carregandoCc, setCarregandoCc] = useState(false)
  const [exportandoCc, setExportandoCc] = useState(false)

  const [contaConsulta, setContaConsulta] = useState('')
  const [comboConta, setComboConta] = useState(false)
  const [vinculosConta, setVinculosConta] = useState<MgoFinanceiro[]>([])
  const [carregandoConta, setCarregandoConta] = useState(false)
  const [exportandoConta, setExportandoConta] = useState(false)

  const [exportandoMatriz, setExportandoMatriz] = useState(false)

  useEffect(() => {
    Promise.all([getAllCentrosDeCusto(), getAllContasFinanceiras()])
      .then(([ccs, cts]) => {
        setCentros(ccs)
        setContas(cts)
      })
      .catch(() => {
        setCentros([])
        setContas([])
      })
  }, [])

  const nomeCcConsulta = centros.find((c) => c.ccusto === ccConsulta)?.custo ?? ''
  const nomeContaConsulta =
    contas.find((c) => c.codconta.toLowerCase() === contaConsulta.trim().toLowerCase())?.contabil?.trim() ?? ''

  async function listarContasDoCc() {
    if (!ccConsulta.trim()) {
      toast.error('Selecione o centro de custo.')
      return
    }
    setCarregandoCc(true)
    try {
      const linhas = await getContasVinculadasAoCentro(ccConsulta)
      setVinculosCc(linhas)
      if (!linhas.length) toast.info('Nenhuma conta vinculada a este centro de custo.')
      else toast.success(`${linhas.length} conta(s) vinculada(s).`)
    } catch (e) {
      mostrarErro(e)
      setVinculosCc([])
    } finally {
      setCarregandoCc(false)
    }
  }

  async function exportarExcelCc() {
    if (!vinculosCc.length) {
      toast.info('Clique em «Listar contas» antes de exportar.')
      return
    }
    setExportandoCc(true)
    try {
      await exportarContasDoCentroExcel(
        ccConsulta,
        nomeCcConsulta,
        vinculosCc.map((l) => ({
          conta_contabil: l.conta_contabil,
          conta_contabil_nome: l.conta_contabil_nome ?? '',
        }))
      )
    } catch (e) {
      mostrarErro(e)
    } finally {
      setExportandoCc(false)
    }
  }

  async function listarCentrosDaConta() {
    if (!contaConsulta.trim()) {
      toast.error('Selecione a conta contábil.')
      return
    }
    setCarregandoConta(true)
    try {
      const linhas = await getCentrosVinculadosAConta(contaConsulta)
      setVinculosConta(linhas)
      if (!linhas.length) toast.info('Nenhum centro de custo com esta conta vinculada.')
      else toast.success(`${linhas.length} centro(s) de custo.`)
    } catch (e) {
      mostrarErro(e)
      setVinculosConta([])
    } finally {
      setCarregandoConta(false)
    }
  }

  async function exportarExcelConta() {
    if (!vinculosConta.length) {
      toast.info('Clique em «Listar centros de custo» antes de exportar.')
      return
    }
    setExportandoConta(true)
    try {
      await exportarCentrosDaContaExcel(
        contaConsulta,
        nomeContaConsulta,
        vinculosConta.map((l) => ({
          centro_custo: l.centro_custo,
          centro_custo_nome: l.centro_custo_nome ?? '',
        }))
      )
    } catch (e) {
      mostrarErro(e)
    } finally {
      setExportandoConta(false)
    }
  }

  async function exportarMatriz() {
    setExportandoMatriz(true)
    try {
      await exportarMatrizCcContaExcel()
    } catch (e) {
      mostrarErro(e)
    } finally {
      setExportandoMatriz(false)
    }
  }

  const colunasPorCc = useMemo<ColumnDef<MgoFinanceiro>[]>(
    () => [
      { accessorKey: 'conta_contabil', header: 'Conta contábil' },
      { accessorKey: 'conta_contabil_nome', header: 'Nome da conta' },
    ],
    []
  )

  const colunasPorConta = useMemo<ColumnDef<MgoFinanceiro>[]>(
    () => [
      { accessorKey: 'centro_custo', header: 'Centro de custo' },
      { accessorKey: 'centro_custo_nome', header: 'Descrição' },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Unidade: <strong className="text-foreground">{unidade || '—'}</strong>
      </p>

      <Tabs value={modo} onValueChange={(v) => setModo(v as 'cc' | 'conta')}>
        <TabsList>
          <TabsTrigger value="cc">Por centro de custo</TabsTrigger>
          <TabsTrigger value="conta">Por conta contábil</TabsTrigger>
        </TabsList>

        <TabsContent value="cc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <List className="h-5 w-5" /> Contas do centro de custo
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Escolha um CC e veja as contas contábeis em <strong>MGO_CONTAFINANCEIRA</strong>.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid max-w-xl gap-2">
                <Label>Centro de custo</Label>
                <Popover modal open={comboCcConsulta} onOpenChange={setComboCcConsulta}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between py-2 font-normal">
                      <UsuarioAncoraTriggerLabel login={ccConsulta} nome={nomeCcConsulta} vazio="Selecione o centro de custo" />
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar CC…" />
                        <CommandList>
                          <CommandEmpty>Nenhum registro.</CommandEmpty>
                          <CommandGroup>
                            {centros.map((c) => (
                              <CommandItem
                                key={c.ccusto}
                                value={`${c.ccusto} ${c.custo}`}
                                onSelect={() => {
                                  setCcConsulta(c.ccusto)
                                  setComboCcConsulta(false)
                                  setVinculosCc([])
                                }}
                              >
                                {c.ccusto} — {c.custo}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void listarContasDoCc()} disabled={carregandoCc || !ccConsulta}>
                  {carregandoCc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                  Listar contas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void exportarExcelCc()}
                  disabled={exportandoCc || vinculosCc.length === 0}
                >
                  {exportandoCc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar Excel (este CC)
                </Button>
              </div>
              {vinculosCc.length > 0 && (
                <DataTable columns={colunasPorCc} data={vinculosCc} loading={carregandoCc} hideSearch />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conta" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <List className="h-5 w-5" /> Centros de custo da conta contábil
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Escolha uma conta e veja em quais centros de custo ela está vinculada.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid max-w-xl gap-2">
                <Label>Conta contábil</Label>
                <Popover modal open={comboConta} onOpenChange={setComboConta}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between py-2 font-normal">
                      <UsuarioAncoraTriggerLabel login={contaConsulta} nome={nomeContaConsulta} vazio="Selecione a conta" />
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar conta…" />
                        <CommandList>
                          <CommandEmpty>Nenhuma conta.</CommandEmpty>
                          <CommandGroup>
                            {contas.map((c) => (
                              <CommandItem
                                key={c.codconta}
                                value={`${c.codconta} ${c.contabil}`}
                                onSelect={() => {
                                  setContaConsulta(c.codconta)
                                  setComboConta(false)
                                  setVinculosConta([])
                                }}
                              >
                                {c.codconta} — {c.contabil}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </PopoverPortal>
                </Popover>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void listarCentrosDaConta()} disabled={carregandoConta || !contaConsulta}>
                  {carregandoConta ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <List className="mr-2 h-4 w-4" />
                  )}
                  Listar centros de custo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void exportarExcelConta()}
                  disabled={exportandoConta || vinculosConta.length === 0}
                >
                  {exportandoConta ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Baixar Excel (esta conta)
                </Button>
              </div>
              {vinculosConta.length > 0 && (
                <DataTable columns={colunasPorConta} data={vinculosConta} loading={carregandoConta} hideSearch />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void exportarMatriz()} disabled={exportandoMatriz}>
          {exportandoMatriz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Baixar planilha (todos os vínculos CC × conta)
        </Button>
      </div>
    </div>
  )
}
