import { Suspense } from "react"
import OrdensCompraPage from "./OrdensCompraPage";
import LoadingFallback from "@/components/LoadingFallback";
import { codTmvListaOrdensCompraApi } from "@/constants/ordensCompraTipos";

const tipos_movimento: string[] = codTmvListaOrdensCompraApi()

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrdensCompraPage tipos_movimento={tipos_movimento} />
    </Suspense>
  )
}
