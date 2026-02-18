import { Suspense } from "react"
import DocumentosExternosPage from "./DocumentosExternosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DocumentosExternosPage />
    </Suspense>
  )
}