'use client'

import React from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export type UsuarioLoginNome = {
  codusuario: string
  nome?: string | null
}

export function nomeUsuarioPorLogin(usuarios: UsuarioLoginNome[], login: string): string {
  const t = login.trim()
  if (!t) return ''
  return usuarios.find((u) => u.codusuario.toLowerCase() === t.toLowerCase())?.nome?.trim() ?? ''
}

type ChipProps = {
  login: string
  nome?: string
  onRemove?: () => void
}

/** Chip de usuário selecionado: nome em destaque e chapa/login abaixo. */
export function UsuarioSelecionadoChip({ login, nome, onRemove }: ChipProps) {
  const titulo = (nome ?? '').trim()
  const exibeChapa = Boolean(titulo && titulo.toLowerCase() !== login.toLowerCase())

  return (
    <Badge
      variant="secondary"
      className="h-auto min-h-9 gap-1.5 rounded-lg border border-border/70 bg-secondary/80 py-1.5 pl-2.5 pr-1.5 font-normal shadow-sm"
    >
      <span className="flex max-w-[min(22rem,100%)] flex-col items-start gap-0.5 text-left leading-snug">
        <span className="text-sm font-medium text-foreground line-clamp-2" title={titulo || login}>
          {titulo || login}
        </span>
        {exibeChapa ? (
          <span className="font-mono text-[11px] text-muted-foreground" title="Chapa / login RM">
            {login}
          </span>
        ) : null}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="ml-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Remover ${titulo || login}`}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </Badge>
  )
}

type AncoraTriggerLabelProps = {
  login: string
  nome?: string
  vazio?: string
}

export function UsuarioAncoraTriggerLabel({ login, nome, vazio = 'Selecione' }: AncoraTriggerLabelProps) {
  if (!login.trim()) {
    return <span className="text-muted-foreground">{vazio}</span>
  }
  const titulo = (nome ?? '').trim()
  return (
    <span className="flex min-w-0 flex-col items-start text-left leading-snug">
      <span className="w-full truncate text-sm font-medium">{titulo || login}</span>
      {titulo ? <span className="font-mono text-xs text-muted-foreground">{login}</span> : null}
    </span>
  )
}

type ColunaUsuarioHeaderProps = {
  login: string
  nome?: string
}

export function ColunaUsuarioHeader({ login, nome }: ColunaUsuarioHeaderProps) {
  const titulo = (nome ?? '').trim()
  return (
    <div className="flex max-w-[9rem] flex-col items-start gap-0.5 leading-tight" title={`${login}${titulo ? ` — ${titulo}` : ''}`}>
      <span className="line-clamp-2 text-xs font-medium">{titulo || login}</span>
      {titulo ? <span className="font-mono text-[10px] text-muted-foreground">{login}</span> : null}
    </div>
  )
}
