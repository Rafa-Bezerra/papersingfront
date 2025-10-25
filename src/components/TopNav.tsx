// components/TopNav.tsx
"use client";

import { User, Menu } from "lucide-react";
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

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const [userName, setUserName] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("userData");    
    if (storedUser) {
      const user = JSON.parse(storedUser);  
      setUserName(user.nome);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userData");
    router.push("/login");
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
      {/* Botão de menu mobile - só aparece no mobile */}
      <button
        className="lg:hidden p-2 rounded hover:bg-muted mr-auto"
        onClick={handleMenuClick}
      >
        <Menu className="w-6 h-6 text-foreground" />
      </button>

      {/* Área de controles - sempre à direita */}
      <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
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
              <Link href="/assinatura" className="w-full">
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
