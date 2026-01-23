import { Suspense } from "react"
import AprovacaoRdvPage from "./AprovacaoRdvPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AprovacaoRdvPage />
    </Suspense>
  )
}