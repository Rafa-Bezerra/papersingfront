import { Suspense } from "react"
import CadastroPage from "./CadastroPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CadastroPage />
    </Suspense>
  )
}