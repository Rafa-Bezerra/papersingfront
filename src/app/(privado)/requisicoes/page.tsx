import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";
import LoadingFallback from "@/components/LoadingFallback"

const titulo = 'Recebimento de materiais'
const tipos_movimento: string[] = [
  '1.2.40',
  '1.2.41',
  '1.2.45',
  '1.2.46',
  '1.2.49',
  '1.2.70',
];

export default function Page() {
  // Loading padrão (spinner + texto).
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MovimentosPage
        titulo={titulo}
        tipos_movimento={tipos_movimento}
      />
    </Suspense>
  )
}