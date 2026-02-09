import { Suspense } from "react"
import CarrinhoPage from "./CarrinhoPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CarrinhoPage />
    </Suspense>
  )
}

