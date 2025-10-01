import { Suspense } from "react"
import AquisicoesPage from "./AquisicoesPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AquisicoesPage />
    </Suspense>
  )
}