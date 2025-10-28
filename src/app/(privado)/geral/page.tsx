import { Suspense } from "react"
import GeralPage from "./GeralPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <GeralPage />
    </Suspense>
  )
}