import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'
import SiteShell from '@/components/SiteShell'
import GoogleAnalytics from '@/components/GoogleAnalytics'

// Self-host fonts via next/font instead of @import url() — eliminates a
// render-blocking CSS request and gives us font-display: swap automatically.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL
const siteTitle = 'B&D Artes & Impressões — Presentes personalizados em 3D'
const siteDescription = 'Presentes únicos e personalizados em impressão 3D, com estética artesanal, personalização e produção sob demanda.'

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: '%s | B&D Artes & Impressões',
  },
  description: siteDescription,
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  openGraph: {
    type: 'website',
    title: siteTitle,
    description: siteDescription,
    url: appUrl,
    siteName: 'B&D Artes & Impressões',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#F0F5FB',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
        <GoogleAnalytics />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
