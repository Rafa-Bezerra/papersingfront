import { Suspense } from "react"
import RequisicoesPage from "./RequisicoesPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RequisicoesPage />
    </Suspense>
  )
}