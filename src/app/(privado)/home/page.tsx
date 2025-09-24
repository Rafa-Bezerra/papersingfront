'use client'

import Link from 'next/link'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Shortcut = {
  id: string | number
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

type Section = {
  id: string
  title: string
  items: Shortcut[]
}

function CardLink({ item }: { item: Shortcut }) {
  return (
    <Link href={item.href} className="group block focus:outline-none">
      <Card
        tabIndex={0}
        className={cn(
          'h-full cursor-pointer transition-all',
          'hover:shadow-lg hover:scale-[1.02]',
          'focus-visible:ring-2 focus-visible:ring-teal-500'
        )}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{item.icon}</div>
            <div>
              <CardTitle className="mb-1 leading-tight group-hover:text-teal-700">
                {item.title}
              </CardTitle>
              <CardDescription className="text-sm">
                {item.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}

export default function HomePage() {
  // Seções organizadas por contexto
  return (
    <div className="p-6 space-y-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Painel Principal</h1>
        <p className="text-sm text-muted-foreground">
          Acesso rápido aos módulos e às últimas melhorias do sistema.
        </p>
      </header>
    </div>
  )
}
