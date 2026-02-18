import { ReactNode } from "react";
import ClientLayout from "@/components/ClientLayout";
import { Toaster } from "@/components/ui/sonner";

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <ClientLayout>
      {children}
      <Toaster richColors position="top-right" />
    </ClientLayout>
  );
}
