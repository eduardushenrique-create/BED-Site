import type { Metadata } from 'next'
import './globals.css'
import SiteShell from '@/components/SiteShell'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
