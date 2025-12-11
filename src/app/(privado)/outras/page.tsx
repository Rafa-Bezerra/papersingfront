import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";

const titulo = 'Outras movimentações'
const tipos_movimento: string[] = [
  '1.2.43',
  '1.2.60',
  '1.2.61',
  '1.2.62',
  '1.2.64',
  '1.2.65',
  '1.2.90',
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