"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
// Botão para trocar entre tema claro e escuro
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Evita erro de hidratação do Next.js
  useEffect(() => {
    setMounted(true);
  }, []);


  // Mostra loading enquanto carrega o tema
  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="w-9 px-0">
        <Sun className="h-4 w-4" />
        <span className="sr-only">Alternar tema</span>
      </Button>
    );
  }

  // Botão que troca o tema quando clica
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setTheme(theme === "light" ? "dark" : "light");
        console.log('Tema atual:', theme);
      }}
      className="w-9 px-0 hover:bg-muted"
    >
      {/* ========================================
           ÍCONES DINÂMICOS POR TEMA
          ======================================== */}
      {theme === "light" ? (
        <Moon className="h-4 w-4" /> // 🌙 Mostra lua quando tema claro (para ir ao escuro)
      ) : (
        <Sun className="h-4 w-4" /> // ☀️ Mostra sol quando tema escuro (para ir ao claro)
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
