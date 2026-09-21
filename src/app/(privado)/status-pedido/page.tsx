import { Suspense } from "react"
import StatusPedidoPage from "./StatusPedidoPage"
import LoadingFallback from "@/components/LoadingFallback"

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatusPedidoPage />
    </Suspense>
  )
}
