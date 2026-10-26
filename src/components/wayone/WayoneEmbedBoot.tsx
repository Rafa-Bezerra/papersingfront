'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { bootstrapWayoneEmbedTheme } from '@/lib/wayoneThemeSync';
import { installWayoneShellNavListener } from '@/lib/wayoneShellNav';

/** Tema, listener de navegação do shell WayOne e sessão embed. */
export function WayoneEmbedBoot() {
  const router = useRouter();

  useEffect(() => {
    bootstrapWayoneEmbedTheme();
    installWayoneShellNavListener();
  }, []);

  useEffect(() => {
    const onSpaNav = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      const path = String(detail?.path || '').trim();
      if (!path) return;
      router.push(path);
    };
    window.addEventListener('papersign-wayone-spa-navigate', onSpaNav);
    return () => window.removeEventListener('papersign-wayone-spa-navigate', onSpaNav);
  }, [router]);

  return null;
}
