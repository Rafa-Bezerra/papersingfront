export type WayOneShellTheme = 'light' | 'dark'

export function readWayOneShellTheme(): WayOneShellTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function postWayOneThemeToIframe(
  iframe: HTMLIFrameElement | null,
  baseUrl: string,
  theme: WayOneShellTheme,
): void {
  if (!iframe?.contentWindow) return
  try {
    const targetOrigin = new URL(baseUrl).origin
    iframe.contentWindow.postMessage({ type: 'wayone-theme', theme }, targetOrigin)
  } catch {
    // ignore
  }
}
