'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  getIndicadoresSession,
  getRq08Session,
  type WayOneModuleSsoSession,
} from '@/services/wayoneModuleSessionService'
import {
  resolveIndicadoresAppUrl,
  resolveIndicadoresEmbedPath,
  resolveRq08AppUrl,
  resolveRq08EmbedPath,
  withWayoneEmbedFlag,
} from '@/lib/wayone-modules'

type ModuleId = 'rq08' | 'indicadores'

type WayOneModuleSsoEmbedProps = {
  moduleId: ModuleId
  devPort: number
  label: string
}

type PendingAuth = WayOneModuleSsoSession & { next: string }

const MESSAGE_TYPE: Record<ModuleId, string> = {
  rq08: 'wayone-rq08-auth',
  indicadores: 'wayone-indicadores-auth',
}

export function WayOneModuleSsoEmbed({ moduleId, devPort, label }: WayOneModuleSsoEmbedProps) {
  const params = useParams<{ slug?: string[] }>()
  const slug = params.slug
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'offline' | 'sso_failed'>(
    'loading',
  )
  const [iframeSrc, setIframeSrc] = useState('')
  const [ssoError, setSsoError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pendingAuthRef = useRef<PendingAuth | null>(null)

  const baseUrl = useMemo(() => {
    if (moduleId === 'rq08') return resolveRq08AppUrl()
    return resolveIndicadoresAppUrl()
  }, [moduleId])

  const embedPath = useMemo(() => {
    const raw =
      moduleId === 'rq08'
        ? resolveRq08EmbedPath(slug)
        : resolveIndicadoresEmbedPath(slug)
    return withWayoneEmbedFlag(raw)
  }, [moduleId, slug])

  const postAuthToIframe = useCallback(() => {
    const auth = pendingAuthRef.current
    const frame = iframeRef.current
    if (!auth || !frame?.contentWindow) return

    const send = () => {
      try {
        const targetOrigin = new URL(baseUrl).origin
        frame.contentWindow?.postMessage(
          {
            type: MESSAGE_TYPE[moduleId],
            tokens: auth.tokens,
            user: auth.user,
            usuario: auth.user,
            next: auth.next,
          },
          targetOrigin,
        )
      } catch {
        // ignore
      }
    }

    send()
    window.setTimeout(send, 150)
    window.setTimeout(send, 600)
  }, [baseUrl, moduleId])

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
        const session =
          moduleId === 'rq08' ? await getRq08Session() : await getIndicadoresSession()
        const next = encodeURIComponent(embedPath)
        const src = `${baseUrl}/wayone/session?next=${next}`
        if (!cancelled) {
          pendingAuthRef.current = { ...session, next: embedPath }
          setIframeSrc(src)
          setLoadState('ready')
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : `Não foi possível abrir ${label}.`
          setSsoError(msg)
          setLoadState('sso_failed')
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [baseUrl, embedPath, label, moduleId])

  if (loadState === 'offline') {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <p>
          {label} indisponível. Suba o front na porta <code className="text-xs">{devPort}</code>.
        </p>
      </div>
    )
  }

  if (loadState === 'sso_failed') {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        <div className="max-w-md space-y-2">
          <p className="font-medium text-foreground">Não foi possível entrar em {label}</p>
          <p>{ssoError || 'Verifique cadastro no módulo e se a API está no ar.'}</p>
        </div>
      </div>
    )
  }

  if (loadState === 'loading' || !iframeSrc) {
    return (
      <div className="flex h-full min-h-[calc(100dvh-4rem)] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando {label}…
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title={`${label} WayOne`}
      src={iframeSrc}
      onLoad={postAuthToIframe}
      className="block h-[calc(100dvh-4rem)] w-full border-0 bg-background"
      allow="clipboard-read; clipboard-write"
    />
  )
}
