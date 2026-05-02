'use client'

import { useState } from 'react'
import Input from '@/components/Input'
import Button from '@/components/Button'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Mensagem enviada! Em breve retornaremos o seu contato.')
  }

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <div
        style={{
          background: 'white',
          borderRadius: '18px',
          padding: 'clamp(24px, 4vw, 40px)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 46px)', fontWeight: 700, marginBottom: '20px', color: '#1D2235' }}>
          Fale conosco
        </h1>

        <div style={{ maxWidth: '640px' }}>
          <p style={{ color: '#6B7494', marginBottom: '32px', lineHeight: 1.7 }}>
            Tem alguma dúvida sobre um produto, personalização ou pedido? Estamos por aqui para ajudar com carinho e clareza.
          </p>

          <div style={{ display: 'grid', gap: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#F0F5FB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: '#1D2235' }}>WhatsApp</p>
                <p style={{ color: '#6B7494', fontSize: '14px', margin: 0 }}>
                  Em breve. Por enquanto, fale com a gente pelo formulário ao lado ou pelo e-mail acima.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#F0F5FB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.5">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: '#1D2235' }}>E-mail</p>
                <a href="mailto:contato@bdeartes.com.br" style={{ color: '#4A7AB5' }}>
                  contato@bdeartes.com.br
                </a>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <Input
              label="Seu nome"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="E-mail"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              label="Telefone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(11) 99999-9999"
            />
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>
                Mensagem
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #D8DCE8',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  minHeight: '120px',
                  resize: 'vertical',
                  color: '#1D2235',
                }}
              />
            </div>
            <Button type="submit">Enviar mensagem</Button>
          </form>
        </div>
      </div>
    </main>
  )
}
