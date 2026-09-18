"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardCardColor =
  | "orange"
  | "rose"
  | "pink"
  | "lime"
  | "slate"
  | "amber"
  | "violet"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "teal";

interface DashboardCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  color: DashboardCardColor;
  description: string;
  href: string;
  className?: string;
}

const colorVariants: Record<
  DashboardCardColor,
  { bg: string; icon: string; iconBg: string; border: string; hover: string; active: string }
> = {
  orange: {
    bg: "bg-orange-500/[0.07] dark:bg-orange-500/10",
    icon: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/15",
    border: "border-orange-500/20 dark:border-orange-500/25",
    hover: "hover:bg-orange-500/[0.12] dark:hover:bg-orange-500/15",
    active: "ring-orange-500/30",
  },
  rose: {
    bg: "bg-rose-500/[0.07] dark:bg-rose-500/10",
    icon: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/15",
    border: "border-rose-500/20 dark:border-rose-500/25",
    hover: "hover:bg-rose-500/[0.12] dark:hover:bg-rose-500/15",
    active: "ring-rose-500/30",
  },
  pink: {
    bg: "bg-pink-500/[0.07] dark:bg-pink-500/10",
    icon: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-500/15",
    border: "border-pink-500/20 dark:border-pink-500/25",
    hover: "hover:bg-pink-500/[0.12] dark:hover:bg-pink-500/15",
    active: "ring-pink-500/30",
  },
  lime: {
    bg: "bg-lime-500/[0.07] dark:bg-lime-500/10",
    icon: "text-lime-700 dark:text-lime-400",
    iconBg: "bg-lime-500/15",
    border: "border-lime-500/20 dark:border-lime-500/25",
    hover: "hover:bg-lime-500/[0.12] dark:hover:bg-lime-500/15",
    active: "ring-lime-500/30",
  },
  slate: {
    bg: "bg-slate-500/[0.07] dark:bg-slate-500/10",
    icon: "text-slate-600 dark:text-slate-400",
    iconBg: "bg-slate-500/15",
    border: "border-slate-500/20 dark:border-slate-500/25",
    hover: "hover:bg-slate-500/[0.12] dark:hover:bg-slate-500/15",
    active: "ring-slate-500/30",
  },
  amber: {
    bg: "bg-amber-500/[0.07] dark:bg-amber-500/10",
    icon: "text-amber-700 dark:text-amber-400",
    iconBg: "bg-amber-500/15",
    border: "border-amber-500/20 dark:border-amber-500/25",
    hover: "hover:bg-amber-500/[0.12] dark:hover:bg-amber-500/15",
    active: "ring-amber-500/30",
  },
  violet: {
    bg: "bg-violet-500/[0.07] dark:bg-violet-500/10",
    icon: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/15",
    border: "border-violet-500/20 dark:border-violet-500/25",
    hover: "hover:bg-violet-500/[0.12] dark:hover:bg-violet-500/15",
    active: "ring-violet-500/30",
  },
  cyan: {
    bg: "bg-cyan-500/[0.07] dark:bg-cyan-500/10",
    icon: "text-cyan-600 dark:text-cyan-400",
    iconBg: "bg-cyan-500/15",
    border: "border-cyan-500/20 dark:border-cyan-500/25",
    hover: "hover:bg-cyan-500/[0.12] dark:hover:bg-cyan-500/15",
    active: "ring-cyan-500/30",
  },
  sky: {
    bg: "bg-sky-500/[0.07] dark:bg-sky-500/10",
    icon: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/15",
    border: "border-sky-500/20 dark:border-sky-500/25",
    hover: "hover:bg-sky-500/[0.12] dark:hover:bg-sky-500/15",
    active: "ring-sky-500/30",
  },
  blue: {
    bg: "bg-blue-500/[0.07] dark:bg-blue-500/10",
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/15",
    border: "border-blue-500/20 dark:border-blue-500/25",
    hover: "hover:bg-blue-500/[0.12] dark:hover:bg-blue-500/15",
    active: "ring-blue-500/30",
  },
  indigo: {
    bg: "bg-indigo-500/[0.07] dark:bg-indigo-500/10",
    icon: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/15",
    border: "border-indigo-500/20 dark:border-indigo-500/25",
    hover: "hover:bg-indigo-500/[0.12] dark:hover:bg-indigo-500/15",
    active: "ring-indigo-500/30",
  },
  teal: {
    bg: "bg-teal-500/[0.07] dark:bg-teal-500/10",
    icon: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-500/15",
    border: "border-teal-500/20 dark:border-teal-500/25",
    hover: "hover:bg-teal-500/[0.12] dark:hover:bg-teal-500/15",
    active: "ring-teal-500/30",
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

  const temPendencia = count > 0;

  return (
    <Link href={hrefWithSlash} className="block h-full">
      <Card
        className={cn(
          "group relative h-full cursor-pointer w-full overflow-hidden border transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          colors.bg,
          colors.border,
          colors.hover,
          temPendencia && cn("ring-1 ring-inset", colors.active),
          !temPendencia && "opacity-90",
          className
        )}
        tabIndex={0}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2.5">
          <CardTitle className="text-xs font-semibold text-foreground/80 leading-tight pr-2">
            {title}
          </CardTitle>
          <div className={cn("rounded-lg p-1.5", colors.iconBg)}>
            <Icon className={cn("h-4 w-4", colors.icon)} />
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3 pt-0">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div
                className={cn(
                  "font-bold leading-none tabular-nums",
                  temPendencia ? cn("text-2xl", colors.icon) : "text-lg text-foreground/50"
                )}
              >
                {count}
              </div>
              <p className="mt-1 text-[11px] leading-tight text-foreground/55 line-clamp-2">
                {description}
              </p>
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-all",
                temPendencia ? colors.icon : "text-muted-foreground/30",
                "group-hover:translate-x-0.5 group-hover:opacity-100"
              )}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
