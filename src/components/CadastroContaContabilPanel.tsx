'use client'

import React, { useState, useTransition } from 'react'
import { SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  buscarContaContabilRm,
  cadastrarContaContabil,
  RmContaLookup,
} from '@/services/mgoFinanceiroService'

type Props = {
  onSuccess?: () => void
}

export default function CadastroContaContabilPanel({ onSuccess }: Props) {
  const [codigo, setCodigo] = useState('')
  const [codcoligada, setCodcoligada] = useState('1')
  const [centroCusto, setCentroCusto] = useState('')
  const [lookup, setLookup] = useState<RmContaLookup | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [isPending, startTransition] = useTransition()

  function handleBuscar() {
    const conta = codigo.trim()
    if (!conta) {
      toast.error('Informe o código da conta contábil.')
      return
    }

    const coligadaNum = Number(codcoligada)
    startTransition(async () => {
      try {
        setLookup(null)
        setSelectedIdx(0)
        const data = await buscarContaContabilRm(
          conta,
          Number.isFinite(coligadaNum) && codcoligada.trim() !== '' ? coligadaNum : undefined
        )
        setLookup(data)
        if (data.papersign) {
          toast.message('Já existe no PaperSign.', {
            description: `${data.papersign.codigo} — ${data.papersign.descricao}`,
          })
        } else {
          toast.success('Encontrada no RM. Pode salvar no PaperSign.')
        }
      } catch (e) {
        setLookup(null)
        toast.error(e instanceof Error ? e.message : 'Falha ao consultar o RM.')
      }
    })
  }

  function handleGravar() {
    const conta = codigo.trim()
    if (!conta) {
      toast.error('Informe o código da conta contábil.')
      return
    }
    if (!lookup?.rm?.length) {
      toast.error('Busque no RM antes de salvar.')
      return
    }

    const selecionada = lookup.rm[selectedIdx] ?? lookup.rm[0]
    startTransition(async () => {
      try {
        const result = await cadastrarContaContabil({
          codigo: selecionada.codigo || conta,
          codcoligada: selecionada.codcoligada,
          centro_custo: centroCusto.trim() || undefined,
        })
        toast.success(result.message, {
          description: `${result.codigo} — ${result.descricao}`,
        })
        const refreshed = await buscarContaContabilRm(conta, selecionada.codcoligada)
        setLookup(refreshed)
        onSuccess?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
      }
    })
  }

  const rm = lookup?.rm?.[selectedIdx] ?? lookup?.rm?.[0]
  const podeGravar = Boolean(rm)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conta contábil (do RM)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Só grava no PaperSign se existir no RM. Opcionalmente vincula a um centro de custo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Código da conta"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBuscar()
            }}
            disabled={isPending}
          />
          <Input
            placeholder="Coligada (ex.: 1)"
            value={codcoligada}
            onChange={(e) => setCodcoligada(e.target.value)}
            disabled={isPending}
          />
          <Input
            placeholder="CC para vincular (opcional)"
            value={centroCusto}
            onChange={(e) => setCentroCusto(e.target.value)}
            disabled={isPending}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleBuscar} disabled={isPending} className="flex-1">
              <SearchIcon className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button type="button" onClick={handleGravar} disabled={isPending || !podeGravar} className="flex-1">
              Salvar
            </Button>
          </div>
        </div>

        {lookup && (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-md border p-3 space-y-2">
              <p className="font-medium">RM ({lookup.unidade})</p>
              {lookup.rm.length > 1 && (
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={selectedIdx}
                  onChange={(e) => setSelectedIdx(Number(e.target.value))}
                >
                  {lookup.rm.map((item, idx) => (
                    <option key={`${item.codcoligada}-${item.codigo}`} value={idx}>
                      Coligada {item.codcoligada} — {item.codigo} — {item.descricao}
                    </option>
                  ))}
                </select>
              )}
              {rm ? (
                <>
                  <p>
                    <span className="text-muted-foreground">Coligada:</span> {rm.codcoligada}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Código:</span> {rm.codigo}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Descrição:</span> {rm.descricao}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Inativa:</span> {rm.inativa || '—'}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Não encontrada.</p>
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
                    <span className="text-muted-foreground">Descrição:</span> {lookup.papersign.descricao}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Ainda não cadastrada.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
