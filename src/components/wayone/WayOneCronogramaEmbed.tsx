'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { getCronogramaSession } from '@/services/wayoneCronogramaService'
import {
  postWayOneThemeToIframe,
  readWayOneShellTheme,
} from '@/lib/wayone-embed-theme'
import {
  resolveCronogramaAppUrl,
  resolveCronogramaEmbedPath,
  withWayoneEmbedFlag,
} from '@/lib/wayone-modules'

type LoadState = 'loading' | 'ready' | 'offline' | 'sso_failed'

type PendingCronogramaAuth = {
  token: string
  user: Record<string, unknown>
  workspace: string
  next: string
}

export function WayOneCronogramaEmbed() {
  const params = useParams<{ slug?: string[] }>()
  const slug = params.slug
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [iframeSrc, setIframeSrc] = useState('')
  const [ssoError, setSsoError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pendingAuthRef = useRef<PendingCronogramaAuth | null>(null)
  const { resolvedTheme } = useTheme()

  const baseUrl = useMemo(() => resolveCronogramaAppUrl(), [])
  const embedPath = useMemo(
    () => withWayoneEmbedFlag(resolveCronogramaEmbedPath(slug)),
    [slug]
  )

  const postThemeToIframe = useCallback(() => {
    const theme =
      resolvedTheme === 'dark' || resolvedTheme === 'light'
        ? resolvedTheme
        : readWayOneShellTheme()
    postWayOneThemeToIframe(iframeRef.current, baseUrl, theme)
  }, [baseUrl, resolvedTheme])

  const postAuthToIframe = useCallback(() => {
    const auth = pendingAuthRef.current
    const frame = iframeRef.current
    if (!auth || !frame?.contentWindow) return

    const send = () => {
      try {
        const targetOrigin = new URL(baseUrl).origin
        frame.contentWindow?.postMessage(
          {
            type: 'wayone-cronograma-auth',
            token: auth.token,
            user: auth.user,
            workspace: auth.workspace,
            next: auth.next,
          },
          targetOrigin
        )
        postThemeToIframe()
      } catch {
        // ignore
      }
    }

    send()
    window.setTimeout(send, 150)
    window.setTimeout(send, 600)
  }, [baseUrl, postThemeToIframe])

  useEffect(() => {
    if (loadState !== 'ready') return
    postThemeToIframe()
  }, [loadState, postThemeToIframe])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setLoadState('loading')
      setSsoError('')
      pendingAuthRef.current = null

      try {
        await fetch(baseUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
      } catch {
        if (!cancelled) setLoadState('offline')
        return
      }

      try {
        const session = await getCronogramaSession()
        const next = encodeURIComponent(embedPath)
        const src = `${baseUrl}/wayone/session?next=${next}`
        if (!cancelled) {
          pendingAuthRef.current = {
            token: session.token,
            user: session.user,
            workspace: session.workspace,
            next: embedPath,
          }
          setIframeSrc(src)
          setLoadState('ready')
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Não foi possível abrir o Cronograma.'
          setSsoError(msg)
          setLoadState('sso_failed')
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [baseUrl, embedPath])

  if (loadState === 'offline') {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <p>
          Cronograma indisponível. Suba o front em <code className="text-xs">cronogramafront</code>{' '}
          (porta 5173).
        </p>
      </div>
    )
  }

  if (loadState === 'sso_failed') {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div className="max-w-md space-y-2">
          <p className="font-medium text-foreground">Não foi possível entrar no Cronograma</p>
          <p>{ssoError || 'Verifique se você tem cadastro no Cronograma e se a API está no ar.'}</p>
        </div>
      </div>
    )
  }

  if (loadState === 'loading' || !iframeSrc) {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando Cronograma…
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title="Cronograma WayOne"
      src={iframeSrc}
      onLoad={postAuthToIframe}
      className="block h-[calc(100dvh-4rem)] w-full border-0 bg-background"
      allow="clipboard-read; clipboard-write"
    />
  )
}
