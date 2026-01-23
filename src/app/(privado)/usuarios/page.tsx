import { Suspense } from "react"
import UsuariosPage from "./UsuariosPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <UsuariosPage />
    </Suspense>
  )
}