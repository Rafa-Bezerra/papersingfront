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

function withWayoneEmbed(path: string): string {
  const raw = path.startsWith('/') ? path : `/${path}`;
  const [pathname, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  params.set('wayoneEmbed', '1');
  const qs = params.toString();
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return qs ? `${base}?${qs}` : `${base}?wayoneEmbed=1`;
}

export function installWayoneShellNavListener(): void {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __papersignWayoneShellNav?: boolean }).__papersignWayoneShellNav) return;
  (window as unknown as { __papersignWayoneShellNav?: boolean }).__papersignWayoneShellNav = true;

  window.addEventListener('message', (event) => {
    if (!isAllowedOrigin(event.origin)) return;
    const data = event.data as { type?: string; path?: string } | null;
    if (!data || data.type !== 'wayone-papersign-navigate') return;
    const raw = String(data.path || '/home').trim() || '/home';
    const target = withWayoneEmbed(raw.startsWith('/') ? raw : '/home');
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== target) {
      window.location.assign(target);
    }
  });
}
