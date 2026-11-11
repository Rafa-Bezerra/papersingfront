'use client'

import React from 'react'
import type { CheckedState } from '@radix-ui/react-checkbox'

import { Checkbox } from '@/components/ui/checkbox'

type LinhaMarcacaoProps = {
  checked: boolean
  onToggle: () => void
  'aria-label': string
  disabled?: boolean
}

/** Evita duplo toggle quando a linha da tabela também é clicável. */
export function ComparacaoLinhaMarcarCheckbox({ checked, onToggle, 'aria-label': ariaLabel, disabled }: LinhaMarcacaoProps) {
  return (
    <div
      className="flex items-center"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={ariaLabel} />
    </div>
  )
}

export function estadoCheckboxListaVisivel(qtdMarcados: number, totalVisivel: number): CheckedState {
  if (totalVisivel <= 0 || qtdMarcados <= 0) return false
  if (qtdMarcados >= totalVisivel) return true
  return 'indeterminate'
}
