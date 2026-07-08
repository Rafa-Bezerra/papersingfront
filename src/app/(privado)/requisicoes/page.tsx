import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";
import LoadingFallback from "@/components/LoadingFallback"

const titulo = 'Recebimento de materiais'
// Mesmos tipos filtrados pela view VW_MOVIMENTACOES_MATERIAIS_<unidade>.
const tipos_movimento: string[] = [
  '1.2.41',
  '1.2.42',
];

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MovimentosPage
        titulo={titulo}
        tipos_movimento={tipos_movimento}
        materiais
      />
    </Suspense>
  )
}