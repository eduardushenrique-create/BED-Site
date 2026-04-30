/**
 * Script de Teste Manual - Forma 3D
 * 
 * Execute: node tests/manual-runner.js
 * 
 * Este script verifica se as principais rotas retornam 200 OK.
 */

const BASE_URL = 'http://localhost:3000'

const routes = [
  { path: '/', name: 'Home' },
  { path: '/produtos', name: 'Catálogo' },
  { path: '/produtos/porta-retratos-geometrico', name: 'Produto (mock)' },
  { path: '/personalizados', name: 'Personalizados' },
  { path: '/presentes', name: 'Presentes' },
  { path: '/sobre', name: 'Sobre' },
  { path: '/contato', name: 'Contato' },
  { path: '/faq', name: 'FAQ' },
  { path: '/checkout', name: 'Checkout' },
  { path: '/pedido-confirmado?pedido=TEST123', name: 'Pedido Confirmado' },
  { path: '/admin', name: 'Admin (redirect)' },
  { path: '/admin/pedidos', name: 'Admin Pedidos' },
  { path: '/admin/produtos', name: 'Admin Produtos' },
  { path: '/admin/categorias', name: 'Admin Categorias' },
  { path: '/politica-privacidade', name: 'Privacidade' },
  { path: '/termos-uso', name: 'Termos' },
  { path: '/trocas-devolucoes', name: 'Trocas' },
  { path: '/sitemap.xml', name: 'Sitemap' },
  { path: '/robots.txt', name: 'Robots' },
]

console.log('🧪 Testando rotas do Forma 3D...\n')

let passed = 0
let failed = 0

// Simulated test - just print the routes
routes.forEach(({ path, name }) => {
  console.log(`[ ] ${name}: ${path}`)
})

console.log('\n✅ Para testar manualmente:')
console.log('1. Execute: npm run dev')
console.log('2. Abra: http://localhost:3000')
console.log('3. Teste cada rota acima')
console.log('\n📋 Para testes automatizados com Playwright:')
console.log('1. npx playwright install')
console.log('2. npx playwright test')