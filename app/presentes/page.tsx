import Link from 'next/link'
import Button from '@/components/Button'

const occasions = [
  { name: 'Aniversário', slug: 'aniversario', description: 'Presentes personalizados paracelebrar mais um ano de vida' },
  { name: 'Casamento', slug: 'casamento', description: 'Presentes românticos e exclusivos parao casal' },
  { name: 'Dia dos Namorados', slug: 'dia-dos-namorados', description: 'Presentes com detalhe especialpara quem você ama' },
  { name: 'Dia das Mães', slug: 'dia-das-maes', description: 'Presentes com amor e carinhopara as mamães' },
  { name: 'Dia dos Pais', slug: 'dia-dos-pais', description: 'Presentes marcantes paraospapais' },
  { name: 'Natal', slug: 'natal', description: 'Presentes únicos parapresentear na época mais mágica do ano' },
]

export default function PresentsPage() {
  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
        Presentes por ocasião
      </h1>
      
      <p style={{ color: '#78716C', textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.6 }}>
        Encontre o presente perfeito para cada momento especial. Todos os produtos podem ser personalizados.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        {occasions.map(occasion => (
          <Link 
            key={occasion.slug}
            href={`/produtos?ocasiao=${occasion.slug}`}
            style={{ 
              display: 'block',
              backgroundColor: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)',
              transition: 'transform var(--transition-fast)',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#1C1917' }}>
              {occasion.name}
            </h3>
            <p style={{ color: '#78716C', fontSize: '14px', marginBottom: '16px' }}>
              {occasion.description}
            </p>
            <span style={{ color: '#C8552A', fontSize: '14px', fontWeight: 500 }}>
              Ver produtos →
            </span>
          </Link>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/personalizados">
          <Button variant="outline">Criar presente personalizado</Button>
        </Link>
      </div>
    </main>
  )
}