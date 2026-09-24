import { Suspense } from "react"
import FinanceiroAprovadoresPage from "./FinanceiroAprovadoresPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FinanceiroAprovadoresPage />
    </Suspense>
  )
}
