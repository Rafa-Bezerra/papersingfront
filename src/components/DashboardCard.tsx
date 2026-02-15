"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Card do dashboard que mostra estatísticas
// Pode clicar para navegar, tem cores diferentes e ícones
interface DashboardCardProps {
  title: string; // Nome do card
  count: number; // Número que aparece
  icon: LucideIcon; // Ícone que fica do lado
  color: "blue" | "green" | "yellow" | "red" | "purple"; // Cor do card
  description: string; // Texto explicativo
  href: string; // Para onde vai quando clica
  className?: string; // Classes extras se precisar
}

const colorVariants = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    icon: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    hover: "hover:bg-blue-100 dark:hover:bg-blue-950/30",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950/20",
    icon: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    hover: "hover:bg-green-100 dark:hover:bg-green-950/30",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    icon: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
    hover: "hover:bg-yellow-100 dark:hover:bg-yellow-950/30",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/20",
    icon: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    hover: "hover:bg-red-100 dark:hover:bg-red-950/30",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/20",
    icon: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    hover: "hover:bg-purple-100 dark:hover:bg-purple-950/30",
  },
};


export function DashboardCard({
  title,
  count,
  icon: Icon,
  color,
  description,
  href,
  className,
}: DashboardCardProps) {
  const colors = colorVariants[color];
  const [path, query] = href.split("?");
  const basePath = path.endsWith("/") ? path : `${path}/`;
  const hrefWithSlash = query ? `${basePath}?${query}` : basePath;

  return (
    <Link href={hrefWithSlash}>
      <Card
        className={cn(
          "cursor-pointer w-full transition-all duration-200",
          "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          colors.bg,
          colors.border,
          colors.hover,
          className
        )}
        tabIndex={0}
      >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
        <CardTitle className="text-xs font-medium text-foreground/70 leading-tight">
          {title}
        </CardTitle>
        <Icon className={cn("h-3.5 w-3.5", colors.icon)} />
      </CardHeader>

      <CardContent className="px-3 pb-2 pt-0">
        <div className="text-lg font-semibold leading-none text-foreground">
          {count}
        </div>
        <p className="mt-0.5 text-[11px] leading-tight text-foreground/60">
          {description}
        </p>
      </CardContent>
    </Card>
    </Link>
  );
}