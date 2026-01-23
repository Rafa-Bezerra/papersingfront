import { Suspense } from "react"
import CentrosCustosPage from "./CentrosCustosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CentrosCustosPage />
    </Suspense>
  )
}
