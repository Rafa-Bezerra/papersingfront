"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import TopNav from "./TopNav";
import { data } from "@/lib/data";

interface ClientLayoutProps {
  children: ReactNode;
}

// Component inside the provider to consume the shadcn UI sidebar context
function LayoutWithSidebar({ children }: ClientLayoutProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen w-screen">
      {/* Sidebar (handles mobile offcanvas internally) */}
      <AppSidebar navMain={data.navMain} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* TopNav triggers toggleSidebar on mobile menu click */}
        <TopNav onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-auto bg-[#f8f7f7]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();

  // Public route (login) without sidebar
  if (pathname === "/login/") {
    return <>{children}</>;
  }

  // Authenticated routes with sidebar
  return (
    <SidebarProvider>
      <LayoutWithSidebar>{children}</LayoutWithSidebar>
    </SidebarProvider>
  );
}