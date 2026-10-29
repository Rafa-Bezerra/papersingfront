function resolveModuleBaseUrl(envKey: string, devPort: number): string {
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://localhost:${devPort}`
    }
  }
  return `http://localhost:${devPort}`
}

function joinSlug(base: string, slug?: string[]): string {
  if (!slug?.length) return base
  const tail = slug.map((s) => encodeURIComponent(s)).join('/')
  return `${base.replace(/\/$/, '')}/${tail}`
}

export function resolveCronogramaAppUrl(): string {
  return resolveModuleBaseUrl('NEXT_PUBLIC_CRONOGRAMA_URL', 5173)
}

export function resolveCronogramaEmbedPath(slug?: string[]): string {
  return joinSlug('/cronograma', slug)
}

export function resolveRq08AppUrl(): string {
  return resolveModuleBaseUrl('NEXT_PUBLIC_RQ08_URL', 5174)
}

export function resolveRq08EmbedPath(slug?: string[]): string {
  return joinSlug('/rq08', slug)
}

export function resolveIndicadoresAppUrl(): string {
  return resolveModuleBaseUrl('NEXT_PUBLIC_INDICADORES_URL', 5175)
}

export function resolveIndicadoresEmbedPath(slug?: string[]): string {
  return joinSlug('/indicadores', slug)
}

export function withWayoneEmbedFlag(path: string): string {
  if (!path) return '?wayoneEmbed=1'
  return path.includes('?') ? `${path}&wayoneEmbed=1` : `${path}?wayoneEmbed=1`
}
