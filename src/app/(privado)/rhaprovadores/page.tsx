import { Suspense } from "react"
import RhAprovadoresPage from "./RhAprovadoresPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RhAprovadoresPage />
    </Suspense>
  )
}