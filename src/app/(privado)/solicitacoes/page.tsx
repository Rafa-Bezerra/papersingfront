import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";

const titulo = 'Solicitações de compra'
const tipos_movimento: string[] = [
  '1.1.01',
  '1.1.02',
  '1.1.04',
  '1.1.05',
  '1.1.10',
  '1.1.11',
  '1.1.12',
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