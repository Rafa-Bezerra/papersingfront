import { Suspense } from "react"
import ComunicadosPage from "./ComunicadosPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ComunicadosPage />
    </Suspense>
  )
}