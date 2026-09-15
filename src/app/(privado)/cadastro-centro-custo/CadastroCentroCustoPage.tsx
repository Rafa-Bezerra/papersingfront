'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Cadastro RM ficou na aba "Cadastro" de /centros-custos */
export default function CadastroCentroCustoPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/centros-custos/')
  }, [router])
  return null
}
