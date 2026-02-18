import { ReactNode } from "react";
import ExternoLayout from "@/components/ExternoLayout";
import { Toaster } from "@/components/ui/sonner";

export default function ExternoRootLayout({ children }: { children: ReactNode }) {
  return (
    <ExternoLayout>
      {children}
      <Toaster richColors position="top-right" />
    </ExternoLayout>
  );
}
