import { Suspense } from "react"
import FiscalPage from "./FiscalPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FiscalPage />
    </Suspense>
  )
}