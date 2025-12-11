import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";

const titulo: string = 'Aquisição de serviços'
const tipos_movimento: string[] = [
  '1.2.31',
  '1.2.32',
  '1.2.33',
  '1.2.34',
  '1.2.35',
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