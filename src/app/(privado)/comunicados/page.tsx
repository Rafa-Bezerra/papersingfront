import { Suspense } from "react"
import ComunicadosPage from "./ComunicadosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ComunicadosPage />
    </Suspense>
  )
}