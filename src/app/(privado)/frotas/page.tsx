import { Suspense } from "react";
import FrotasModulo from "./FrotasModulo";
import LoadingFallback from "@/components/LoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FrotasModulo />
    </Suspense>
  );
}
