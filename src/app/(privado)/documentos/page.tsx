import { Suspense } from "react"
import DocumentosPage from "./DocumentosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DocumentosPage />
    </Suspense>
  )
}