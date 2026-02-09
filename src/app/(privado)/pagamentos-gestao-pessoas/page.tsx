import { Suspense } from "react"
import PagamentosGestaoPessoasPage from "./PagamentosGestaoPessoasPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PagamentosGestaoPessoasPage />
    </Suspense>
  )
}
