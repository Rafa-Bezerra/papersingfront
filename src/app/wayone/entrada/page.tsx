'use client'

import { useEffect, useState } from 'react'
import { applyWayoneTheme } from '@/lib/wayoneThemeSync'

type EntradaPayload = {
  user?: { token?: string }
  next?: string
}

export default function WayoneEntradaPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    applyWayoneTheme('dark')
    const raw = window.location.hash.replace(/^#/, '')
    if (!raw) {
      setError('Abra o PaperSign pelo menu do WayOne.')
      return
    }

    try {
      const data = JSON.parse(decodeURIComponent(raw)) as EntradaPayload
      const token = String(data.user?.token || '').trim()
      if (!token || !data.user) {
        setError('Sessão do PaperSign não encontrada. Saia e entre de novo no WayOne.')
        return
      }

      sessionStorage.setItem('authToken', token)
      sessionStorage.setItem('userData', JSON.stringify(data.user))
      localStorage.setItem('papersign-auth-cutover', 'ms-sso-v1')
      sessionStorage.setItem('papersign-wayone-embed', '1')
      const next = String(data.next || '/home/?wayoneEmbed=1')
      window.location.replace(next.startsWith('/') ? next : '/home/?wayoneEmbed=1')
    } catch {
      setError('Não foi possível abrir o PaperSign.')
    }
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
      <p>{error || 'Abrindo PaperSign…'}</p>
    </div>
  )
}
