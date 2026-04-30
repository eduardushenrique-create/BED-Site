import Link from 'next/link'
import Button from '@/components/Button'

export default function PersonalizedPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
        Presentes personalizados
      </h1>
      
      <p style={{ color: '#78716C', textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.6 }}>
        Crie presentes únicos com sua mensagem, nome ou design especial. Cada peça é impressa sob demanda especialmente para você.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '48px' }}>
        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFF5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8552A" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Texto gravado</h3>
          <p style={{ color: '#78716C', fontSize: '14px' }}>
            Mensagens, nomes, datas ou qualquer texto que você quiser incluir no seu presente.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFF5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8552A" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Design exclusivo</h3>
          <p style={{ color: '#78716C', fontSize: '14px' }}>
            Envie seu próprio design ou deixe nossa equipe criar algo especial para você.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFF5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C8552A" strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Para汽oadade</h3>
          <p style={{ color: '#78716C', fontSize: '14px' }}>
            Aniversários, casamentos, dia dos namorados ou qualquer data especial.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/produtos?personalizavel=true">
          <Button>Ver produtos personalizáveis</Button>
        </Link>
      </div>
    </main>
  )
}