'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { ChevronsUpDown, Download, List, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
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
import { UsuarioAncoraTriggerLabel } from '@/components/usuario/UsuarioSelecionadoChip'
import {
  CentroDeCusto,
  getAllCentrosDeCusto,
  getContasVinculadasAoCentro,
} from '@/services/mgoFinanceiroService'
import { exportarContasDoCentroExcel, exportarMatrizCcContaExcel } from '@/lib/exportMatrizCcConta'
import type { MgoFinanceiro } from '@/types/MgoFinanceiro'
import { mostrarErro } from '@/utils/avisoApi'

type Props = {
  unidadeLogada: string
}

export default function CentrosCustosComparacaoConta({ unidadeLogada }: Props) {
  const unidade = unidadeLogada
  const [centros, setCentros] = useState<CentroDeCusto[]>([])
  const [ccConsulta, setCcConsulta] = useState('')
  const [comboCcConsulta, setComboCcConsulta] = useState(false)
  const [vinculosCc, setVinculosCc] = useState<MgoFinanceiro[]>([])
  const [carregandoConsulta, setCarregandoConsulta] = useState(false)
  const [exportandoConsulta, setExportandoConsulta] = useState(false)
  const [exportandoMatriz, setExportandoMatriz] = useState(false)

  useEffect(() => {
    getAllCentrosDeCusto()
      .then(setCentros)
      .catch(() => setCentros([]))
  }, [])

  const nomeCcConsulta = centros.find((c) => c.ccusto === ccConsulta)?.custo ?? ''

  async function listarContasDoCc() {
    if (!ccConsulta.trim()) {
      toast.error('Selecione o centro de custo.')
      return
    }
    setCarregandoConsulta(true)
    try {
      const linhas = await getContasVinculadasAoCentro(ccConsulta)
      setVinculosCc(linhas)
      if (!linhas.length) toast.info('Nenhuma conta vinculada a este centro de custo.')
      else toast.success(`${linhas.length} conta(s) vinculada(s).`)
    } catch (e) {
      mostrarErro(e)
      setVinculosCc([])
    } finally {
      setCarregandoConsulta(false)
    }
  }

  async function exportarExcelCc() {
    if (!vinculosCc.length) {
      toast.info('Clique em «Listar contas» antes de exportar.')
      return
    }
    setExportandoConsulta(true)
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
      setExportandoConsulta(false)
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

  const colunasConsulta = useMemo<ColumnDef<MgoFinanceiro>[]>(
    () => [
      { accessorKey: 'conta_contabil', header: 'Conta contábil' },
      { accessorKey: 'conta_contabil_nome', header: 'Nome da conta' },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <List className="h-5 w-5" /> Contas vinculadas ao centro de custo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha um centro de custo para ver todas as contas contábeis vinculadas em{' '}
            <strong>MGO_CONTAFINANCEIRA</strong> e baixar a lista em Excel.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Unidade: <strong className="text-foreground">{unidade || '—'}</strong>
          </p>
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
            <Button type="button" onClick={() => void listarContasDoCc()} disabled={carregandoConsulta || !ccConsulta}>
              {carregandoConsulta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
              Listar contas
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportarExcelCc()}
              disabled={exportandoConsulta || vinculosCc.length === 0}
            >
              {exportandoConsulta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar Excel (este CC)
            </Button>
            <Button type="button" variant="outline" onClick={() => void exportarMatriz()} disabled={exportandoMatriz}>
              {exportandoMatriz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar planilha (todos os CC)
            </Button>
          </div>
          {vinculosCc.length > 0 && (
            <DataTable columns={colunasConsulta} data={vinculosCc} loading={carregandoConsulta} hideSearch />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
