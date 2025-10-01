import { Suspense } from "react"
import RequisicoesPage from "./SolicitacoesPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RequisicoesPage />
    </Suspense>
  )
}