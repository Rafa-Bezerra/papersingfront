import { ReactNode } from "react";
import ClientLayout from "@/components/ClientLayout";
import { WayoneEmbedBoot } from "@/components/WayoneEmbedBoot";
import { Toaster } from "@/components/ui/sonner";

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <ClientLayout>
      <WayoneEmbedBoot />
      {children}
      <Toaster richColors position="top-right" />
    </ClientLayout>
  );
}
