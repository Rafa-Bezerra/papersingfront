import { Suspense } from "react"
import DocusignPage from "./DocusignPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DocusignPage />
    </Suspense>
  )
}