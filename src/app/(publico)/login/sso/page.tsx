'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { exchangeSamlCode } from '@/services/auth'
import { Suspense } from 'react'

function SsoCallbackInner() {
  const router = useRouter()
  const search = useSearchParams()
  const [msg, setMsg] = useState('Concluindo login Microsoft...')

  useEffect(() => {
    const code = search.get('code')
    if (!code) {
      setMsg('Código SSO ausente.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const usuario = await exchangeSamlCode(code)
        if (cancelled) return
        sessionStorage.setItem('authToken', usuario.token)
        sessionStorage.setItem('userData', JSON.stringify(usuario))
        router.replace('/home/')
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Falha no SSO'
        setMsg(message)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [search, router])

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
      <p className="text-slate-700 dark:text-slate-200 text-center max-w-md">{msg}</p>
    </main>
  )
}

export default function LoginSsoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <p>Carregando...</p>
        </main>
      }
    >
      <SsoCallbackInner />
    </Suspense>
  )
}
