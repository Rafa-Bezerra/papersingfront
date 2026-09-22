import { Suspense } from "react";
import ControleMedicaoPage from "./ControleMedicaoPage";
import LoadingFallback from "@/components/LoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ControleMedicaoPage />
    </Suspense>
  );
}
