import { Suspense } from "react"
import MovimentosPage from "../components/MovimentosPage";
import LoadingFallback from "@/components/LoadingFallback";

const titulo = 'Ordens de compra'
const tipos_movimento: string[] = [
  "1.1.20",
  "1.1.21",
  "1.1.22",
  "1.1.30",
  "1.1.31",
  "1.1.32",
  "1.1.33",
  "1.1.34",
  "1.1.35",
  "1.1.36",
  "1.1.37",
  "1.1.40",
  "1.1.50",
  "1.1.51",
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