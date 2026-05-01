import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px' }}>
      <section style={{ maxWidth: '640px', backgroundColor: 'white', borderRadius: '16px', padding: '32px' }}>
        <p style={{ color: '#D4849A', fontWeight: 700, marginBottom: '8px' }}>403</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: '#1D2235', marginBottom: '12px' }}>
          Acesso restrito
        </h1>
        <p style={{ color: '#5F6678', marginBottom: '24px' }}>
          Sua conta nao tem permissao para acessar esta area.
        </p>
        <Link href="/" style={{ color: '#1D2235', fontWeight: 700 }}>
          Voltar para a loja
        </Link>
      </section>
    </main>
  )
}
