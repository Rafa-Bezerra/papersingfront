const ALLOWED_PARENT_ORIGINS = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]);

function isAllowedOrigin(origin: string): boolean {
  const o = String(origin || '').trim();
  if (!o) return false;
  if (ALLOWED_PARENT_ORIGINS.has(o)) return true;
  try {
    const host = new URL(o).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.grupowaybrasil.com.br');
  } catch {
    return false;
  }
}

export type WayoneThemeMode = 'light' | 'dark';

export function applyWayoneTheme(theme: WayoneThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // ignore
  }
}

export function isPapersignWayoneEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem('papersign-wayone-embed') === '1') return true;
    return new URLSearchParams(window.location.search).get('wayoneEmbed') === '1';
  } catch {
    return false;
  }
}

export function installWayoneThemeListener(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __papersignWayoneTheme?: boolean }).__papersignWayoneTheme) return;
  (window as unknown as { __papersignWayoneTheme?: boolean }).__papersignWayoneTheme = true;

  window.addEventListener('message', (event) => {
    if (!isAllowedOrigin(event.origin)) return;
    const data = event.data as { type?: string; theme?: string } | null;
    if (!data || data.type !== 'wayone-theme') return;
    applyWayoneTheme(data.theme === 'light' ? 'light' : 'dark');
  });
}

/** Tema escuro padrão no iframe — alinhado ao shell WayOne até o postMessage do pai. */
export function bootstrapWayoneEmbedTheme(): void {
  if (!isPapersignWayoneEmbed()) return;
  try {
    sessionStorage.setItem('papersign-wayone-embed', '1');
  } catch {
    // ignore
  }
  applyWayoneTheme('dark');
  installWayoneThemeListener();
}
