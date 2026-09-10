import { Suspense } from "react"
import CadastroCentroCustoPage from "./CadastroCentroCustoPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CadastroCentroCustoPage />
    </Suspense>
  )
}
