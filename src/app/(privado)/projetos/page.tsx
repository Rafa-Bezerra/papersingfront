import { Suspense } from "react"
import ProjetosPage from "./ProjetosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProjetosPage />
    </Suspense>
  )
}