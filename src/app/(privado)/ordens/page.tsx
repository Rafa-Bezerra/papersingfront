import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";
import LoadingFallback from "@/components/LoadingFallback";
import { codTmvListaOrdensCompraApi } from "@/constants/ordensCompraTipos";

const titulo = 'Ordens de compra'
const tipos_movimento: string[] = codTmvListaOrdensCompraApi()

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MovimentosPage
        titulo={titulo}
        tipos_movimento={tipos_movimento}
      />
    </Suspense>
  )
}