'use client'

import { useState } from 'react'

const faqs = [
  {
    question: 'Qual o prazo de produção?',
    answer: 'O prazo de produção varia de 2 a 5 dias úteis, dependendo do produto e complexidade da personalização. O prazo de entrega é informado no checkout após o cálculo do frete.',
  },
  {
    question: 'Como funciona a personalização?',
    answer: 'Na página de cada produto, você encontrará campos para inserir o texto ou informações que deseja personalizar. Cada produto tem suas próprias opções de personalização descritas na página.',
  },
  {
    question: 'Posso cancelar ou trocar um pedido?',
    answer: 'Produtos personalizados não podem ser cancelados após a confirmação do pedido, pois são produzidos especialmente para você. Para produtos não personalizados, aceitamos trocas em até 7 dias após o recebimento.',
  },
  {
    question: 'Quais são as formas de pagamento?',
    answer: 'Aceitamos Pix e cartão de crédito em até 12 vezes. Em breve adicionaremos mais opções de pagamento.',
  },
  {
    question: 'Como acompanho meu pedido?',
    answer: 'Você receberá e-mails com atualizações do status do seu pedido. Após o envio, receberá o código de rastreamento para acompanhar a entrega.',
  },
  {
    question: 'Vocês fazem entregas internacionais?',
    answer: 'No momento, atendemos apenas clientes no Brasil. Estamos trabalhando para expandir para outros países em breve.',
  },
]

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <main className="container" style={{ paddingTop: '96px', paddingBottom: '64px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
        Perguntas frequentes
      </h1>
      
      <p style={{ color: '#78716C', textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px' }}>
        Tire suas dúvidas sobre nossos produtos e processos.
      </p>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {faqs.map((faq, idx) => (
          <div key={idx} style={{ borderBottom: '1px solid #E8E2DA' }}>
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 500, color: '#1C1917' }}>
                {faq.question}
              </span>
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#78716C" 
                strokeWidth="1.5"
                style={{ 
                  transform: openIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform var(--transition-fast)',
                }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            
            {openIndex === idx && (
              <div style={{ paddingBottom: '20px', color: '#78716C', lineHeight: 1.6 }}>
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '48px', padding: '24px', backgroundColor: '#F5F2EE', borderRadius: '12px' }}>
        <p style={{ marginBottom: '16px', fontWeight: 500 }}>
          Não encontrou a resposta que procurava?
        </p>
        <a href="/contato" style={{ color: '#C8552A', fontWeight: 500 }}>
          Fale conosco →
        </a>
      </div>
    </main>
  )
}