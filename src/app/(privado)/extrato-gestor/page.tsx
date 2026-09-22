import { Suspense } from "react"
import ExtratoGestorPage from "./ExtratoGestorPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ExtratoGestorPage />
    </Suspense>
  )
}
