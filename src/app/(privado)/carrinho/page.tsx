import { Suspense } from "react"
import CarrinhoPage from "./CarrinhoPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <CarrinhoPage />
    </Suspense>
  )
}

