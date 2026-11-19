import { Suspense } from "react"
import GeralPage from "../geral/GeralPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Igual a /geral, filtrando itens do centro de custo "<unidade>.1" (ex.: 262.1).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeralPage sufixoCentroCustoUnidade=".1" />
    </Suspense>
  )
}
