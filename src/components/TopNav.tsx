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
import Link from "next/link";

interface TopNavProps {
  onMenuClick: () => void;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const [userName, setUserName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    if (storedUser) {
      const user = JSON.parse(storedUser);      
      setUserName(user);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userData");
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      {/* Botão de menu, só visível em mobile (md:hidden) */}
      <button
        className="md:hidden p-2 rounded hover:bg-gray-100"
        onClick={onMenuClick}
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Espaço flexível para empurrar o resto para a direita */}
      <div className="flex-1" />

      {/* Área do usuário */}
      <div className="flex items-center space-x-4">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center space-x-2 px-2 py-1"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  Olá, {userName.toUpperCase()}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/alterar-senha" className="w-full">
                  Alterar senha
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
