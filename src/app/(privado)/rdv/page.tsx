import { Suspense } from "react"
import RdvPage from "./RdvPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RdvPage />
    </Suspense>
  )
}