"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Corrige URLs malformadas no cliente (middleware não funciona com output: export). */
export default function UrlSanitizer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.includes("http:") || pathname.includes("https:")) {
      window.location.replace(`${window.location.origin}/login/`);
    }
  }, [pathname]);

  return null;
}
