import { Suspense } from "react"
import DisparosPage from "./DisparosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DisparosPage />
    </Suspense>
  )
}
