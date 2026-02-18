"use client";

import { User, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

interface TopNavProps {
  onMenuClick: () => void;
}

export default function ExternoTopNav({ onMenuClick }: TopNavProps) {
  const [userName, setUserName] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedUser = sessionStorage.getItem("userDataExterno");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserName(user?.nome ?? "");
      } catch {
        setUserName("");
      }
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("userDataExterno");
    sessionStorage.removeItem("authTokenExterno");
    router.replace("/login-externo");
  };

  const handleMenuClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 300) return; // debounce 300ms
    setLastClickTime(now);
    onMenuClick();
  };

  return (
    <header className="h-16 bg-background border-b flex items-center px-4 sm:px-6">
      {/* Botão mobile */}
      <div className="flex items-center gap-2">
        <button
          className="lg:hidden p-2 rounded hover:bg-muted"
          onClick={handleMenuClick}
        >
          <Menu className="w-6 h-6 text-foreground" />
        </button>

        <div className="hidden lg:flex items-center ml-4">
          <Button
            variant={pathname === "/documentos" ? "default" : "ghost"}
            size="sm"
            onClick={() => router.push("/documentos-externo")}
          >
            Documentos
          </Button>
        </div>
      </div>

      {/* Controles direita */}
      <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
        <ThemeToggle />

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
              <Link href="/alterar-senha-externo" className="w-full">
                Alterar senha
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/assinatura-externo" className="w-full">
                Assinatura
              </Link>
            </DropdownMenuItem>

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