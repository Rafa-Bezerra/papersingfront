import { Suspense } from "react"
import ControlesPage from "./ControlesPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ControlesPage />
    </Suspense>
  )
}