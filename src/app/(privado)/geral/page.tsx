import { Suspense } from "react"
import GeralPage from "./GeralPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeralPage />
    </Suspense>
  )
}