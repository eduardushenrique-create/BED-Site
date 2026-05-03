import { Suspense } from 'react'
import DescadastrarClient from './DescadastrarClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Descadastrar — BED Design',
  description: 'Pare de receber e-mails promocionais da BED Design.',
  robots: { index: false, follow: false },
}

export default function DescadastrarPage() {
  return (
    <Suspense fallback={<div style={{ padding: '120px 24px', textAlign: 'center', color: '#6B7494' }}>Carregando...</div>}>
      <DescadastrarClient />
    </Suspense>
  )
}
