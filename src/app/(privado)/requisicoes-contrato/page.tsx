'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import LoadingFallback from "@/components/LoadingFallback";

/** Virou aba da Ordem de compra; o endereço antigo continua valendo para links salvos. */
export default function Page() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ordens?aba=contrato')
  }, [router])
  return <LoadingFallback />
}
