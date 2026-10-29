'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  resolveIndicadoresAppUrl,
  resolveIndicadoresEmbedPath,
  resolveRq08AppUrl,
  resolveRq08EmbedPath,
  withWayoneEmbedFlag,
} from '@/lib/wayone-modules'

type WayOneSimpleModuleEmbedProps = {
  moduleId: 'rq08' | 'indicadores'
  devPort: number
  label: string
}

export function WayOneSimpleModuleEmbed({
  moduleId,
  devPort,
  label,
}: WayOneSimpleModuleEmbedProps) {
  const params = useParams<{ slug?: string[] }>()
  const slug = params.slug
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'offline'>('loading')
  const [iframeSrc, setIframeSrc] = useState('')

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

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setLoadState('loading')
      try {
        await fetch(baseUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
      } catch {
        if (!cancelled) setLoadState('offline')
        return
      }
      if (!cancelled) {
        setIframeSrc(`${baseUrl}${embedPath}`)
        setLoadState('ready')
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
          {label} indisponível. Suba o front na porta <code className="text-xs">{devPort}</code>.
        </p>
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
      title={label}
      src={iframeSrc}
      className="block h-[calc(100dvh-4rem)] w-full border-0 bg-background"
      allow="clipboard-read; clipboard-write"
    />
  )
}
