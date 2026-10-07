'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

type Props = {
  disabled?: boolean
  busy?: boolean
  onClick: () => void
  className?: string
  /** Botão principal (fundo escuro) ou secundário (estilo Microsoft oficial). */
  variant?: 'primary' | 'microsoft'
  children: ReactNode
}

export function MicrosoftSignInButton({
  disabled,
  busy,
  onClick,
  className,
  variant = 'microsoft',
  children,
}: Props) {
  const isMicrosoft = variant === 'microsoft'

  return (
    <Button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={cn(
        'w-full h-12 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        isMicrosoft
          ? 'bg-white text-[#5e5e5e] border border-[#8c8c8c] hover:bg-[#f3f3f3] shadow-sm dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
          : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl',
        className
      )}
    >
      <span className="flex items-center justify-center gap-3">
        <MicrosoftLogo className="h-5 w-5 shrink-0" />
        <span>{children}</span>
      </span>
    </Button>
  )
}
