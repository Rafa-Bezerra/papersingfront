'use client';

import { useEffect } from 'react';
import { bootstrapWayoneEmbedTheme, isPapersignWayoneEmbed } from '@/lib/wayoneThemeSync';
import { installWayoneShellNavListener } from '@/lib/wayoneShellNav';

/** Tema + navegação via postMessage quando o PaperSign roda em iframe WayOne. */
export function WayoneEmbedBoot() {
  useEffect(() => {
    bootstrapWayoneEmbedTheme();
    installWayoneShellNavListener();
    if (isPapersignWayoneEmbed()) {
      document.body.dataset.papersignWayoneEmbed = '1';
    }
    return () => {
      delete document.body.dataset.papersignWayoneEmbed;
    };
  }, []);
  return null;
}
