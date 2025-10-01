import { Suspense } from "react"
import OrdensPage from "./OrdensPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <OrdensPage />
    </Suspense>
  )
}