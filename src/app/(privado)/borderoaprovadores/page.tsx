import { Suspense } from "react"
import AprovadoresPage from "./AprovadoresPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AprovadoresPage />
    </Suspense>
  )
}