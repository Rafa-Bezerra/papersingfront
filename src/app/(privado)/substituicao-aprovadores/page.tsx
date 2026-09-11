'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Rota antiga: redireciona para a aba dentro de Alçadas. */
export default function Page() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/alcadas?tab=substituicao')
  }, [router])
  return null
}
