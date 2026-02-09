import { Suspense } from "react"
import PagamentosImpostosPage from "./PagamentosImpostosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PagamentosImpostosPage />
    </Suspense>
  )
}
