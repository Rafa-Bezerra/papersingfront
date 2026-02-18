"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import ExternoTopNav from "@/components/ExternoTopNav";
import { toast } from "sonner";

interface ExternoLayoutProps {
  children: ReactNode;
}

function LayoutShell({ children }: ExternoLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh w-full bg-background">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ExternoTopNav onMenuClick={() => setIsMobileOpen(!isMobileOpen)} />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background p-2 sm:p-4 lg:p-6">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function ExternoClientLayout({ children }: ExternoLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const inactivityTimeoutRef = useRef<number | null>(null);
  const sessionExpiredNotifiedRef = useRef(false);

  const LOGIN_ROUTE = "/login-externo";

  // Verifica autenticação
  useEffect(() => {
    const checkAuth = () => {
      const token = sessionStorage.getItem("authTokenExterno");
      const userData = sessionStorage.getItem("userDataExterno");
      const normalizedPath =
        pathname.endsWith("/") && pathname !== "/"
          ? pathname.slice(0, -1)
          : pathname;

      // Se estiver na tela de login externo
      if (normalizedPath === LOGIN_ROUTE) {
        setIsLoading(false);
        return;
      }

      if (token && userData) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);

        if (!sessionExpiredNotifiedRef.current) {
          sessionExpiredNotifiedRef.current = true;
          toast.info("Sua sessão expirou. Faça login novamente.");
        }

        router.replace(LOGIN_ROUTE);
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Controle de inatividade
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleLogout = () => {
      sessionStorage.removeItem("authTokenExterno");
      sessionStorage.removeItem("userDataExterno");
      toast.info("Sessão encerrada por inatividade.");
      router.replace(LOGIN_ROUTE);
    };

    const resetTimer = () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }

      inactivityTimeoutRef.current = window.setTimeout(() => {
        handleLogout();
      }, 5 * 60 * 1000); // 5 minutos
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true })
    );

    resetTimer();

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Se estiver na página de login externo
  if (pathname === LOGIN_ROUTE) {
    return <>{children}</>;
  }

  if (!isAuthenticated) return null;

  return <LayoutShell>{children}</LayoutShell>;
}
