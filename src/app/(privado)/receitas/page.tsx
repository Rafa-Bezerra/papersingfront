import { Suspense } from "react"
import ReceitasPage from "./ReceitasPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReceitasPage />
    </Suspense>
  )
}
