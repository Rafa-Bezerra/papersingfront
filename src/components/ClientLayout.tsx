"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import TopNav from "./TopNav";
import { data } from "@/lib/data";
import { toast } from "sonner";

interface ClientLayoutProps {
  children: ReactNode;
}

// Componente que usa o sidebar do shadcn
function LayoutWithSidebar({ children }: ClientLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleMobileToggle = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleCollapseToggle = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex min-h-svh w-full bg-background">
      {/* Sidebar (handles mobile offcanvas internally) */}
      <AppSidebar 
        navMain={data.navMain} 
        isMobileOpen={isMobileOpen}
        onMobileToggle={handleMobileToggle}
        isCollapsed={isCollapsed}
        onCollapseToggle={handleCollapseToggle}
      />

      {/* Main content - se expande dinamicamente */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* TopNav triggers mobile menu */}
        <TopNav onMenuClick={handleMobileToggle} />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background p-2 sm:p-4 lg:p-6">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionExpiredNotifiedRef = useRef(false);

  // Verifica se o usuário fez login antes de deixar entrar nas páginas
  useEffect(() => {
    const checkAuthentication = () => {
      try {
        const token = sessionStorage.getItem("authToken");
        const userData = sessionStorage.getItem("userData");

        // Normaliza o pathname removendo barra final (exceto para raiz "/")
        const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
          ? pathname.slice(0, -1) 
          : pathname;

        if (token && userData) {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          try {
            const parsedUser = JSON.parse(userData);
            const isAdmin = Boolean(parsedUser?.admin);
            const canCentrosCustos = Boolean(parsedUser?.centros_custos);

            // Bloqueia acesso direto a centros de custos sem permissão.
            if (normalizedPath === "/centros-custos" && !isAdmin && !canCentrosCustos) {
              setIsAuthorized(false);
            }
          } catch (parseError) {
            console.error("Erro ao ler dados do usuário:", parseError);
          }
        } else {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          // Redireciona para login se não estiver autenticado
          if (normalizedPath !== "/login") {
            if (!sessionExpiredNotifiedRef.current) {
              sessionExpiredNotifiedRef.current = true;
              toast.info("Sua sessão expirou. Faça login novamente.");
            }
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        setIsAuthenticated(false);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();
  }, [pathname, router]);

  useEffect(() => {
    const handleLogout = () => {
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("userData");
      setIsAuthenticated(false);
      // Logout por inatividade: mensagem amigável antes do redirect.
      toast.info("Sua sessão expirou por inatividade. Faça login novamente.");
      router.push("/login");
    };

    const resetInactivityTimer = () => {
      lastActivityRef.current = Date.now();
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }
      // Reinicia o relógio de inatividade a cada interação do usuário.
      inactivityTimeoutRef.current = window.setTimeout(() => {
        handleLogout();
      }, 5 * 60 * 1000);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetInactivityTimer));
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [router]);

  // Mostra loading enquanto verifica se o usuário está logado
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Página de login não precisa de autenticação
  const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
    ? pathname.slice(0, -1) 
    : pathname;

  if (normalizedPath === "/login") {
    return <>{children}</>;
  }

  // Só deixa entrar se estiver logado
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground mb-4">
            Você precisa fazer login para acessar esta página.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground mb-4">
            Você não tem permissão para acessar esta página.
          </p>
          <button
            onClick={() => router.push("/home")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Ir para Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <LayoutWithSidebar>{children}</LayoutWithSidebar>
    </SidebarProvider>
  );
}
