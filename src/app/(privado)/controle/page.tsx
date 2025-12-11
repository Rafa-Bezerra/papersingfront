import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";

const titulo = 'Controle imobilizado'
const tipos_movimento: string[] = [
  '1.2.42',
  '1.2.44',
  '1.2.47',
  '1.2.48',
];

export default function Page() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <MovimentosPage
        titulo={titulo}
        tipos_movimento={tipos_movimento}
      />
    </Suspense>
  )
}