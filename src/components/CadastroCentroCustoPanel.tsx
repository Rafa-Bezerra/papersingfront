'use client'

import React, { useState, useTransition } from 'react'
import { SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  buscarCentroCustoRm,
  cadastrarCentroCusto,
  RmCentroCustoLookup,
} from '@/services/mgoFinanceiroService'

type Props = {
  onSuccess?: () => void
}

export default function CadastroCentroCustoPanel({ onSuccess }: Props) {
  const [codigo, setCodigo] = useState('')
  const [lookup, setLookup] = useState<RmCentroCustoLookup | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleBuscar() {
    const cc = codigo.trim()
    if (!cc) {
      toast.error('Informe o código do centro de custo.')
      return
    }

    startTransition(async () => {
      try {
        setLookup(null)
        const data = await buscarCentroCustoRm(cc)
        setLookup(data)
        if (data.papersign) {
          toast.message('Já existe no PaperSign.', {
            description: `${data.papersign.codigo} — ${data.papersign.nome} (ATIVO=${data.papersign.ativo})`,
          })
        } else {
          toast.success('Encontrado no RM. Pode salvar no PaperSign.')
        }
      } catch (e) {
        setLookup(null)
        toast.error(e instanceof Error ? e.message : 'Falha ao consultar o RM.')
      }
    })
  }

  function handleGravar() {
    const cc = codigo.trim()
    if (!cc) {
      toast.error('Informe o código do centro de custo.')
      return
    }
    if (!lookup?.rm?.length) {
      toast.error('Busque no RM antes de salvar.')
      return
    }

    startTransition(async () => {
      try {
        const result = await cadastrarCentroCusto(cc)
        toast.success(result.message, {
          description: `${result.codigo} — ${result.nome}`,
        })
        const refreshed = await buscarCentroCustoRm(cc)
        setLookup(refreshed)
        onSuccess?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
      }
    })
  }

  const rm = lookup?.rm?.[0]
  const podeGravar = Boolean(rm) && (!lookup?.papersign || lookup.papersign.ativo?.toUpperCase() !== 'Y')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centro de custo (do RM)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Só grava no PaperSign se o código existir no RM (Corpore) da sua unidade.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Ex.: 001.2.01.002.042"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBuscar()
            }}
            disabled={isPending}
            className="sm:max-w-md"
          />
          <Button type="button" variant="secondary" onClick={handleBuscar} disabled={isPending}>
            <SearchIcon className="h-4 w-4 mr-2" />
            Buscar no RM
          </Button>
          <Button type="button" onClick={handleGravar} disabled={isPending || !podeGravar}>
            Salvar
          </Button>
        </div>

        {lookup && (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium">RM ({lookup.unidade})</p>
              {rm ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Código:</span> {rm.codigo}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nome:</span> {rm.nome}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ativo:</span> {rm.ativo || '—'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Não encontrado.</p>
              )}
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium">PaperSign</p>
              {lookup.papersign ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Código:</span> {lookup.papersign.codigo}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nome:</span> {lookup.papersign.nome}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ativo:</span> {lookup.papersign.ativo}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Ainda não cadastrado.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
