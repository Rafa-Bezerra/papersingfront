import { Suspense } from "react"
import RdvPage from "./RdvPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RdvPage />
    </Suspense>
  )
}