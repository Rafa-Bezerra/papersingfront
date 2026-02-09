import { Suspense } from "react"
import AlcadasPage from "./AlcadasPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AlcadasPage />
    </Suspense>
  )
}