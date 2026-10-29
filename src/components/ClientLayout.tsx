"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import TopNav from "./TopNav";
import RafaelaTour from "./RafaelaTour";
import PendenciasLoginModal from "./PendenciasLoginModal";
import GestorUnidadeBanner from "./GestorUnidadeBanner";
import { canAccessConfigRoute, isConfigMenuRoute } from "@/lib/configuracoes-permissoes";
import { data } from "@/lib/data";
import { isPapersignWayoneEmbed, WAYONE_EMBED_SESSION_EVENT } from "@/lib/wayoneThemeSync";
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
        <GestorUnidadeBanner />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background p-2 sm:p-4 lg:p-6">
          <div className="w-full">{children}</div>
        </main>
      </div>
      <RafaelaTour />
      <PendenciasLoginModal />
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

  const isWayoneEmbed =
    isPapersignWayoneEmbed() ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("wayoneEmbed") === "1");

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isWayoneEmbed) {
      document.documentElement.dataset.papersignWayoneEmbed = "1";
      document.body.dataset.papersignWayoneEmbed = "1";
    } else {
      delete document.documentElement.dataset.papersignWayoneEmbed;
      delete document.body.dataset.papersignWayoneEmbed;
    }
    return () => {
      delete document.documentElement.dataset.papersignWayoneEmbed;
      delete document.body.dataset.papersignWayoneEmbed;
    };
  }, [isWayoneEmbed]);

  // Verifica se o usuário fez login antes de deixar entrar nas páginas
  useEffect(() => {
    const checkAuthentication = () => {
      try {
        // Cutover login único Microsoft: força novo login uma vez após o deploy.
        const cutoverKey = "papersign-auth-cutover";
        const cutoverValue = "ms-sso-v1";
        if (localStorage.getItem(cutoverKey) !== cutoverValue) {
          sessionStorage.removeItem("authToken");
          sessionStorage.removeItem("userData");
          localStorage.setItem(cutoverKey, cutoverValue);
        }

        const token = sessionStorage.getItem("authToken");
        const userData = sessionStorage.getItem("userData");

        // Normaliza o pathname removendo barra final (exceto para raiz "/")
        const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
          ? pathname.slice(0, -1) 
          : pathname;

        const isLoginRoute = normalizedPath === "/login" || normalizedPath === "/login-externo";

        if (token && userData) {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          try {
            const parsedUser = JSON.parse(userData);
            const isAdmin = Boolean(parsedUser?.admin);
            const isFinanceiro = Boolean(parsedUser?.financeiro);
            const canDocusign = Boolean(parsedUser?.docusign);
            const canProjetos = Boolean(parsedUser?.projetos);
            const unidadeProjetos =
              String(parsedUser?.unidade ?? "").trim().toUpperCase() === "WAY CSC";
            const canReceitas = Boolean(parsedUser?.receitas);
            const canExtratoGestor = Boolean(parsedUser?.extrato_gestor);
            const canControleMedicao = Boolean(parsedUser?.controle_medicao);

            if (
              isConfigMenuRoute(normalizedPath) &&
              !canAccessConfigRoute(normalizedPath, parsedUser)
            ) {
              setIsAuthorized(false);
            }

            if (normalizedPath === "/extrato-gestor" && !isAdmin && !canExtratoGestor) {
              setIsAuthorized(false);
            }

            if (normalizedPath === "/controle-medicao" && !isAdmin && !canControleMedicao) {
              setIsAuthorized(false);
            }

            if (normalizedPath === "/contratos" && !isAdmin && !Boolean(parsedUser?.modulo_contratos)) {
              setIsAuthorized(false);
            }

            if (normalizedPath === "/frotas" && !isAdmin && !Boolean(parsedUser?.frotas)) {
              setIsAuthorized(false);
            }

            // Bloqueia acesso direto ao WaySign sem permissão (admin/financeiro/docusign; quem tem só "Documentos" entra e vê só os documentos internos).
            if (normalizedPath === "/docusign" && !isAdmin && !isFinanceiro && !canDocusign && !Boolean(parsedUser?.documentos)) {
              setIsAuthorized(false);
            }

            // Projetos: somente base WAY CSC.
            if (normalizedPath === "/projetos" && !unidadeProjetos) {
              setIsAuthorized(false);
            } else if (normalizedPath === "/projetos" && !isAdmin && !isFinanceiro && !canProjetos) {
              setIsAuthorized(false);
            }

            // Receitas: só quem tem a flag (ou admin).
            if (normalizedPath === "/receitas" && !isAdmin && !canReceitas) {
              setIsAuthorized(false);
            }
          } catch (parseError) {
            console.error("Erro ao ler dados do usuário:", parseError);
          }
        } else {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          const embed =
            isPapersignWayoneEmbed() ||
            new URLSearchParams(window.location.search).get("wayoneEmbed") === "1";
          // No iframe WayOne o token vem do boot/postMessage — não mandar para /login (tela branca).
          if (!isLoginRoute && !embed) {
            if (!sessionExpiredNotifiedRef.current) {
              sessionExpiredNotifiedRef.current = true;
              toast.info("Sua sessão expirou. Faça login novamente.");
            }
            router.replace("/login/");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        setIsAuthenticated(false);
        const normalizedPath = pathname.endsWith('/') && pathname !== '/'
          ? pathname.slice(0, -1)
          : pathname;
        const isLoginRoute = normalizedPath === "/login" || normalizedPath === "/login-externo";
        const embed =
          isPapersignWayoneEmbed() ||
          new URLSearchParams(window.location.search).get("wayoneEmbed") === "1";
        if (!isLoginRoute && !embed) {
          router.replace("/login/");
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();
    window.addEventListener(WAYONE_EMBED_SESSION_EVENT, checkAuthentication);
    return () => window.removeEventListener(WAYONE_EMBED_SESSION_EVENT, checkAuthentication);
  }, [pathname, router]);

  useEffect(() => {
    const handleLogout = () => {
      if (isPapersignWayoneEmbed()) return;
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("userData");
      setIsAuthenticated(false);
      // Logout por inatividade: mensagem amigável antes do redirect.
      toast.info("Sua sessão expirou por inatividade. Faça login novamente.");
      router.replace("/login/");
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

  if (normalizedPath === "/login" || normalizedPath === "/login-externo") {
    return <>{children}</>;
  }

  if (!isAuthenticated && isWayoneEmbed) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm">Abrindo PaperSign…</p>
        </div>
      </div>
    );
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
            onClick={() => router.replace("/login/")}
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

  if (isWayoneEmbed) {
    return (
      <div className="papersign-wayone-embed-shell flex h-full min-h-0 w-full max-h-full flex-col bg-background">
        <main className="papersign-wayone-embed-main min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-4 lg:p-6">
          <div className="w-full">{children}</div>
        </main>
        <RafaelaTour />
        <PendenciasLoginModal />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <LayoutWithSidebar>{children}</LayoutWithSidebar>
    </SidebarProvider>
  );
}
