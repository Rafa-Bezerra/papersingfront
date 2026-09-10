import { Suspense } from "react"
import CadastroContaContabilPage from "./CadastroContaContabilPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CadastroContaContabilPage />
    </Suspense>
  )
}
