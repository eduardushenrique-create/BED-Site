export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i)
  }
  let digit1 = (sum * 10) % 11
  if (digit1 === 10) digit1 = 0

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i)
  }
  let digit2 = (sum * 10) % 11
  if (digit2 === 10) digit2 = 0

  return digit1 === parseInt(cleaned[9]) && digit2 === parseInt(cleaned[10])
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0,3)}.${cleaned.slice(3)}`
  if (cleaned.length <= 9) return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6)}`
  return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6,9)}-${cleaned.slice(9,11)}`
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length <= 2) return `(${cleaned}`
  if (cleaned.length <= 7) return `(${cleaned.slice(0,2)}) ${cleaned.slice(2)}`
  return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7,11)}`
}

export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length <= 5) return cleaned
  return `${cleaned.slice(0,5)}-${cleaned.slice(5,8)}`
}

export function validateCEP(cep: string): boolean {
  const cleaned = cep.replace(/\D/g, '')
  return cleaned.length === 8
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',')
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}