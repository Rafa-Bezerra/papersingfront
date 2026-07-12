import './globals.css'
import { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import UrlSanitizer from '@/components/UrlSanitizer'

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
