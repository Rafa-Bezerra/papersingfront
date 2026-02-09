import { Suspense } from "react"
import BorderoPage from "./BorderoPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BorderoPage />
    </Suspense>
  )
}