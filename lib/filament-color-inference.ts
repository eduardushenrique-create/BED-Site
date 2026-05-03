/**
 * Inferência de cor de filamento a partir do nome cadastrado.
 *
 * Stakeholder cadastrou todos os filamentos com a cor no nome (ex.:
 * "PLA Azul", "PETG Verde Transparente"). Esse mapa converte essas
 * descrições textuais em hex aproximados — admin pode ajustar a cor
 * exata depois pelo color picker.
 *
 * Estratégia:
 *   - Palavra-chave de uma palavra (case-insensitive, sem acento) →
 *     hex
 *   - Procura priorizando o ÚLTIMO match no nome (cor é geralmente a
 *     última palavra: "PLA Azul Metalico Silk" → match "azul")
 *   - Casos especiais (rainbow, transparente, fosforescente) com
 *     hex próprios
 *   - Sem match: retorna null (não atribui cor)
 */

const COLOR_KEYWORDS: Array<{ keywords: string[]; hex: string }> = [
  // Neutras
  { keywords: ['branco', 'white'], hex: '#FFFFFF' },
  { keywords: ['preto', 'black'], hex: '#000000' },
  { keywords: ['cinza', 'grey', 'gray'], hex: '#6B7280' },
  // Primárias
  { keywords: ['vermelho', 'red'], hex: '#DC2626' },
  { keywords: ['azul', 'blue'], hex: '#2563EB' },
  { keywords: ['amarelo', 'yellow'], hex: '#FACC15' },
  // Secundárias
  { keywords: ['verde', 'green'], hex: '#16A34A' },
  { keywords: ['laranja', 'orange'], hex: '#F97316' },
  { keywords: ['roxo', 'lilas', 'violeta', 'purple', 'violet'], hex: '#7C3AED' },
  { keywords: ['rosa', 'pink'], hex: '#EC4899' },
  // Terciárias / metálicas / madeira
  { keywords: ['marrom', 'cafe', 'capuccino', 'cappuccino', 'brown', 'chocolate'], hex: '#78350F' },
  { keywords: ['bege', 'beige', 'caucasiano'], hex: '#D6B98C' },
  { keywords: ['dourado', 'gold'], hex: '#D4AF37' },
  { keywords: ['prata', 'aluminio', 'silver'], hex: '#C0C0C0' },
  { keywords: ['bronze', 'cobre', 'copper'], hex: '#CD7F32' },
  // Especiais
  { keywords: ['turquesa', 'turquoise', 'teal'], hex: '#14B8A6' },
  { keywords: ['ciano', 'cyan'], hex: '#06B6D4' },
  { keywords: ['fosforescente', 'glow', 'phosphorescent'], hex: '#ADFF2F' },
  { keywords: ['ice', 'gelo'], hex: '#B0E0E6' },
  { keywords: ['vinho', 'bordo', 'burgundy'], hex: '#7F1D1D' },
  { keywords: ['mostarda', 'mustard'], hex: '#CA8A04' },
]

// Casos onde o nome descreve um efeito/multi-cor — não atribui hex
// (admin pode escolher manualmente):
const SKIP_KEYWORDS = ['rainbow', 'arco-iris', 'arco iris', 'multicor', 'multicolor', 'transparente', 'translucido', 'translucent', 'transparent']

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inferFilamentColor(name: string): string | null {
  if (!name) return null
  const normalized = normalize(name)

  // Skip explícito (rainbow, transparente, etc.)
  for (const skip of SKIP_KEYWORDS) {
    if (normalized.includes(skip)) return null
  }

  // Procura todas as ocorrências e pega a do MAIOR ÍNDICE (cor geralmente
  // está depois do tipo PLA/PETG no nome).
  let bestMatchIndex = -1
  let bestHex: string | null = null

  for (const entry of COLOR_KEYWORDS) {
    for (const keyword of entry.keywords) {
      // Match palavra inteira (com word boundary aproximado via espaço/início/fim)
      const idx = normalized.search(new RegExp(`(^|\\s|-)${keyword}(\\s|-|$)`))
      if (idx >= 0 && idx > bestMatchIndex) {
        bestMatchIndex = idx
        bestHex = entry.hex
      }
    }
  }

  return bestHex
}
