import type { Metadata } from 'next'
import './globals.css'
import SiteShell from '@/components/SiteShell'

export const metadata: Metadata = {
  title: 'Forma 3D - Presentes Personalizados em 3D',
  description: 'Presentes únicos e personalizados impressos em 3D. Decorações, objetos para cozinha, escritório e muito mais.',
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
