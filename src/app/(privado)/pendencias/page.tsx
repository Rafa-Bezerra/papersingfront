import { Suspense } from "react";
import PendenciasPage from "./PendenciasPage";
import LoadingFallback from "@/components/LoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PendenciasPage />
    </Suspense>
  );
}
