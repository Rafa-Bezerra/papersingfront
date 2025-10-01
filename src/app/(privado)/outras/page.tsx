import { Suspense } from "react"
import OutrasPage from "./OutrasPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <OutrasPage />
    </Suspense>
  )
}