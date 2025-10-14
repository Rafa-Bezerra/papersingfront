import './globals.css'
// app/layout.tsx
import { ReactNode } from 'react'
import ClientLayout from '@/components/ClientLayout'
import { Toaster } from '@/components/ui/sonner'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <title>PaperSign</title>
      </head>
      <body>
        <ClientLayout>
          {children}
          <Toaster richColors position="top-right" />
        </ClientLayout>
      </body>
    </html>
  )
}
