import { Suspense } from "react"
import RestritoAprovadoresPage from "./RestritoAprovadoresPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RestritoAprovadoresPage />
    </Suspense>
  )
}