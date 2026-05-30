import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Porra Mundial 2026',
  description: 'La porra definitiva del Mundial de la FIFA 2026 con tus amigos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  )
}
