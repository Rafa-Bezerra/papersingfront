import { Suspense } from "react"
import FiscalAprovadoresPage from "./fiscalAprovadoresPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FiscalAprovadoresPage />
    </Suspense>
  )
}