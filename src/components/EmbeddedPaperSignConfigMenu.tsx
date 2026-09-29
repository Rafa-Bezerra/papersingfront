'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Settings } from 'lucide-react'
import { buildPapersignConfigNav } from '@/lib/papersign-config-nav'
import { USERDATA_UPDATED_EVENT } from '@/utils/sessionUser'

/** Menu só do PaperSign — usado dentro do iframe WayOne (sem trocar de sistema). */
export function EmbeddedPaperSignConfigMenu() {
  const path = usePathname()
  const [admin, setAdmin] = useState(false)
  const [unidade, setUnidade] = useState('')

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem('userData')
        if (!raw) return
        const user = JSON.parse(raw)
        setAdmin(Boolean(user?.admin))
        setUnidade(String(user?.unidade ?? ''))
      } catch {
        setAdmin(false)
      }
    }
    read()
    window.addEventListener(USERDATA_UPDATED_EVENT, read)
    return () => window.removeEventListener(USERDATA_UPDATED_EVENT, read)
  }, [])

  const items = useMemo(() => buildPapersignConfigNav(unidade), [unidade])

  if (!admin) return null

  const normalized = path.replace(/\/$/, '') || '/'
  const onConfigPage = items.some(
    (item) => normalized === item.url || normalized.startsWith(`${item.url}/`),
  )

  return (
    <div className="mb-4 rounded-lg border border-border bg-card">
      <details className="group" open={onConfigPage}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          Configurações PaperSign
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">abrir</span>
        </summary>
        <nav className="border-t border-border px-2 py-2">
          <ul className="flex flex-wrap gap-1">
            {items.map((item) => {
              const active = normalized === item.url || normalized.startsWith(`${item.url}/`)
              const href = item.url.endsWith('/') ? item.url : `${item.url}/`
              return (
                <li key={item.url}>
                  <Link
                    href={href}
                    className={`inline-block rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </details>
    </div>
  )
}
