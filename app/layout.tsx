import type { Metadata } from 'next'
import './globals.css'
import SiteShell from '@/components/SiteShell'

export const metadata: Metadata = {
  title: 'B&D Artes & Impressões - Presentes personalizados em 3D',
  description: 'Presentes únicos e personalizados em impressão 3D, com estética artesanal, personalização e produção sob demanda.',
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
