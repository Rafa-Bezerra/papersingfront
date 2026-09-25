import './globals.css'
import { ReactNode } from 'react'
import type { Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import UrlSanitizer from '@/components/UrlSanitizer'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <UrlSanitizer />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
