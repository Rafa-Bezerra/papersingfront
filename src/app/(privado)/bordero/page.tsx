import { Suspense } from "react"
import BorderoPage from "./BorderoPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <BorderoPage />
    </Suspense>
  )
}