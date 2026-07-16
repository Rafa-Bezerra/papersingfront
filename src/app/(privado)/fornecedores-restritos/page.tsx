import { Suspense } from "react"
import FornecedoresRestritosPage from "./FornecedoresRestritosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FornecedoresRestritosPage />
    </Suspense>
  )
}
