import { Suspense } from "react"
import AprovacaoRdvPage from "./AprovacaoRdvPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AprovacaoRdvPage />
    </Suspense>
  )
}