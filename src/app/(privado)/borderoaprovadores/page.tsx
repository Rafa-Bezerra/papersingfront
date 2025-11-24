import { Suspense } from "react"
import AprovadoresPage from "./AprovadoresPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AprovadoresPage />
    </Suspense>
  )
}