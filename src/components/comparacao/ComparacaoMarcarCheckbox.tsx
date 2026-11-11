'use client'

import React from 'react'
import type { CheckedState } from '@radix-ui/react-checkbox'
import { Download, Link2 } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

type LinhaMarcacaoProps = {
  checked: boolean
  onToggle: () => void
  'aria-label': string
  disabled?: boolean
}

/** Evita duplo toggle quando a linha da tabela também é clicável. */
export function ComparacaoLinhaMarcarCheckbox({
  checked,
  onToggle,
  'aria-label': ariaLabel,
  disabled,
  alinhamento = 'start',
}: LinhaMarcacaoProps & { alinhamento?: 'start' | 'center' }) {
  return (
    <div
      className={cn('flex items-center', alinhamento === 'center' && 'justify-center')}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={ariaLabel} />
    </div>
  )
}

export type ComparacaoColunaMarcacaoTipo = 'planilha' | 'vinculo'

const colunaMarcacaoEstilo: Record<ComparacaoColunaMarcacaoTipo, { header: string; cell: string; Icon: typeof Download }> =
  {
    planilha: {
      header: 'bg-sky-500/12 border-sky-500/30',
      cell: 'bg-sky-500/[0.06]',
      Icon: Download,
    },
    vinculo: {
      header: 'bg-amber-500/12 border-amber-500/30',
      cell: 'bg-amber-500/[0.06]',
      Icon: Link2,
    },
  }

export function classesCelulaColunaMarcacao(tipo: ComparacaoColunaMarcacaoTipo) {
  return cn('w-[3.75rem] max-w-[3.75rem] px-1 text-center', colunaMarcacaoEstilo[tipo].cell)
}

export function classesCabecalhoColunaMarcacao(tipo: ComparacaoColunaMarcacaoTipo) {
  return cn('w-[3.75rem] max-w-[3.75rem] px-1 py-2 align-top', colunaMarcacaoEstilo[tipo].header)
}

type ColunaMarcacaoCabecalhoProps = {
  tipo: ComparacaoColunaMarcacaoTipo
  titulo: string
  checkbox: React.ReactNode
}

/** Cabeçalho compacto das colunas 1 (planilha) e 2 (vínculo) na comparação de CC. */
export function ComparacaoColunaMarcacaoCabecalho({ tipo, titulo, checkbox }: ColunaMarcacaoCabecalhoProps) {
  const { header, Icon } = colunaMarcacaoEstilo[tipo]
  const numero = tipo === 'planilha' ? 1 : 2
  return (
    <div
      className={cn(
        'mx-auto flex w-[3.25rem] flex-col items-center gap-1 rounded-md border px-0.5 py-1.5',
        header
      )}
      title={tipo === 'planilha' ? 'Marcação para exportar planilha — não altera cadastro' : 'Marcação para incluir ou remover vínculo'}
    >
      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/90">
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        {numero}
      </span>
      <span className="text-center text-[10px] font-semibold leading-tight text-foreground">{titulo}</span>
      {checkbox}
    </div>
  )
}

export function estadoCheckboxListaVisivel(qtdMarcados: number, totalVisivel: number): CheckedState {
  if (totalVisivel <= 0 || qtdMarcados <= 0) return false
  if (qtdMarcados >= totalVisivel) return true
  return 'indeterminate'
}
