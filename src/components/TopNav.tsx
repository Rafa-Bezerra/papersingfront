// components/TopNav.tsx
"use client";

import { ChevronDown, CircleHelp, Headset, Menu, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import Image from "next/image";
import { GLPI_SUPPORT_URL } from "@/utils/constants";
import { getUnidadesDisponiveis, trocarUnidade } from "@/services/auth";

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const [userName, setUserName] = useState("");
  const [logo, setLogo] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<string[]>([]);
  const [isTrocandoUnidade, setIsTrocandoUnidade] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userData");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserName(user.nome);
      switch (user.unidade) {
        case "WAY 112":
          setLogo("/logos/way112.png");
          break;
        case "WAY 153":
          setLogo("/logos/way153.png");
          break;
        case "WAY 262":
          setLogo("/logos/way262.png");
          break;
        case "WAY 306":
          setLogo("/logos/way306.png");
          break;
        case "WAY 364":
          setLogo("/logos/way364.png");
          break;
        case "WAY CSC":
          setLogo("/logos/wayCSC.png");
          break;
        default:
          setLogo("/logos/wayCSC.png");
          break;
      }
    }
    getUnidadesDisponiveis()
      .then((u) => setUnidadesDisponiveis([...u].sort((a, b) => a.localeCompare(b))))
      .catch(() => { });
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("userData");
    router.push("/login");
  };

  const handleTrocarUnidade = async (unidade: string) => {
    setIsTrocandoUnidade(true);
    try {
      const novoUsuario = await trocarUnidade(unidade);
      sessionStorage.setItem("authToken", novoUsuario.token);
      sessionStorage.setItem("userData", JSON.stringify(novoUsuario));
      window.location.href = "/home";
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao trocar unidade");
    } finally {
      setIsTrocandoUnidade(false);
    }
  };

  const handleMenuClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 300) { // 300ms de debounce
      return;
    }
    setLastClickTime(now);
    onMenuClick();
  };

  return (
    <header className="h-16 bg-background border-b flex items-center px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Botão de menu mobile */}
        <button
          className="lg:hidden p-2 rounded hover:bg-muted"
          onClick={handleMenuClick}
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>

        {/* Logo */}
        <div className="hidden sm:flex items-center h-full">
          {logo && (
            unidadesDisponiveis.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity focus:outline-none"
                    disabled={isTrocandoUnidade}
                    title="Trocar unidade"
                  >
                    <Image
                      src={logo}
                      alt="Logo PaperSign"
                      width={120}
                      height={40}
                      className="h-10 w-auto object-contain"
                      priority
                      unoptimized
                    />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {unidadesDisponiveis.map((u) => (
                    <DropdownMenuItem
                      key={u}
                      onClick={() => handleTrocarUnidade(u)}
                      className="cursor-pointer"
                    >
                      {u}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Image
                src={logo}
                alt="Logo PaperSign"
                width={120}
                height={40}
                className="h-10 w-auto object-contain"
                priority
                unoptimized
              />
            )
          )}
        </div>
      </div>

      {/* Área de controles - sempre à direita */}
      <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
        {/* Suporte */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="hover:bg-muted"
          aria-label="Suporte"
          title="Suporte"
        >
          <a href={GLPI_SUPPORT_URL} target="_blank" rel="noreferrer">
            <Headset className="h-5 w-5 text-muted-foreground" />
          </a>
        </Button>

        {/* Help */}
        <Button asChild variant="ghost" size="icon" className="hover:bg-muted" aria-label="Ajuda e treinamentos">
          <Link href="/help">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
          </Link>
        </Button>

        {/* Toggle de tema */}
        <ThemeToggle />

        {/* Área do usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 px-2 py-1 hover:bg-muted"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline text-sm text-foreground">
                Olá, {userName?.toUpperCase()}
              </span>
              <span className="sm:hidden text-sm text-foreground">
                {userName?.charAt(0)?.toUpperCase()}
              </span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/alterar-senha" className="w-full">
                Alterar senha
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/alterar-email" className="w-full">
                Alterar e-mail
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/assinatura" className="w-full">
                Assinatura
              </Link>
            </DropdownMenuItem>

            {unidadesDisponiveis.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {unidadesDisponiveis.map((u) => (
                  <DropdownMenuItem
                    key={u}
                    onClick={() => handleTrocarUnidade(u)}
                    className="cursor-pointer sm:hidden"
                    disabled={isTrocandoUnidade}
                  >
                    {u}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive cursor-pointer"
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
