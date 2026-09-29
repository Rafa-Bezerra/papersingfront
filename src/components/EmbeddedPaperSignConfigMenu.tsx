'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Settings } from 'lucide-react'
import {
  type ConfigMenuSession,
  filterConfigNavItems,
  hasAnyConfigMenuAccess,
  mapConfigMenuFromApi,
} from '@/lib/configuracoes-permissoes'
import { buildPapersignConfigNav } from '@/lib/papersign-config-nav'
import { USERDATA_UPDATED_EVENT } from '@/utils/sessionUser'

/** Menu só do PaperSign — usado dentro do iframe WayOne (sem trocar de sistema). */
export function EmbeddedPaperSignConfigMenu() {
  const path = usePathname()
  const [configSession, setConfigSession] = useState<ConfigMenuSession>({ admin: false })
  const [unidade, setUnidade] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem('userData')
        if (!raw) return
        const user = JSON.parse(raw) as Record<string, unknown>
        setUnidade(String(user?.unidade ?? ''))
        setConfigSession({
          admin: Boolean(user?.admin),
          unidade: String(user?.unidade ?? ''),
          ...mapConfigMenuFromApi(user),
        })
      } catch {
        setConfigSession({ admin: false })
      }
    }
    read()
    window.addEventListener(USERDATA_UPDATED_EVENT, read)
    return () => window.removeEventListener(USERDATA_UPDATED_EVENT, read)
  }, [])

  const items = useMemo(
    () => filterConfigNavItems(buildPapersignConfigNav(unidade), configSession),
    [unidade, configSession]
  )

  const normalized = path.replace(/\/$/, '') || '/'
  const onConfigPage = useMemo(
    () =>
      items.some(
        (item) => normalized === item.url || normalized.startsWith(`${item.url}/`)
      ),
    [items, normalized]
  )

  useEffect(() => {
    if (onConfigPage) setOpen(true)
  }, [onConfigPage])

  if (!hasAnyConfigMenuAccess(configSession) || items.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-border bg-card">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden />
        Configurações PaperSign
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {open ? 'fechar' : 'abrir'}
        </span>
      </button>
      {open && (
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
      )}
    </div>
  )
}
