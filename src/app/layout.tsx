import './globals.css'
import { ReactNode } from 'react'
import ClientLayout from '@/components/ClientLayout'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>PaperSign</title>
      </head>
      <body>
        {/* Configuração do sistema de temas */}
        <ThemeProvider
          attribute="class"              // Usa classes CSS para temas (dark: classes)
          defaultTheme="light"          // Tema padrão: claro
          enableSystem                  // Permite usar tema do sistema operacional
          disableTransitionOnChange     // Desabilita transições para evitar flash
        >
          <ClientLayout>
            {children}
            <Toaster richColors position="top-right" />
          </ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
