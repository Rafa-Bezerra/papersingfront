import { Suspense } from "react"
import PagamentosPage from "../components/PagamentosPage";
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PagamentosPage
        titulo="Pagamento de Impostos"
        grupo="IMPOSTOS"
      />
    </Suspense>
  )
}