import { Suspense } from "react"
import DocumentosPage from "./DocumentosPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <DocumentosPage />
    </Suspense>
  )
}