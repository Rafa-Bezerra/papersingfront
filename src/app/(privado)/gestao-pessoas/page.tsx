import { Suspense } from "react"
import GestaoPessoasPage from "./GestaoPessoasPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GestaoPessoasPage />
    </Suspense>
  )
}
