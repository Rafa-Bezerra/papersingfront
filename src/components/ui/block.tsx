'use client'

import * as React from 'react'

type BlockProps = {
  label: string
  children: React.ReactNode
  className?: string
  /** Texto pequeno sob o label (opcional) */
  description?: React.ReactNode
  /** Ações alinhadas à direita do cabeçalho: botões, etc (opcional) */
  actions?: React.ReactNode
}

export function Block({
  label,
  children,
  className,
  description,
  actions
}: BlockProps) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium leading-none">{label}</div>
          {description ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div className="text-sm text-foreground">{children}</div>
    </section>
  )
}
