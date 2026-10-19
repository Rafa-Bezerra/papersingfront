import { Suspense } from "react";
import ContratosPage from "./ContratosPage";
import LoadingFallback from "@/components/LoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ContratosPage />
    </Suspense>
  );
}
