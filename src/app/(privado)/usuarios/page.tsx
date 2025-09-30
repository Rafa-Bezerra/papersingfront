import { Suspense } from "react"
import UsuariosPage from "./UsuariosPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <UsuariosPage />
    </Suspense>
  )
}