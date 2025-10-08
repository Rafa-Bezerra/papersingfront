import { Suspense } from "react"
import AlcadasPage from "./AlcadasPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AlcadasPage />
    </Suspense>
  )
}