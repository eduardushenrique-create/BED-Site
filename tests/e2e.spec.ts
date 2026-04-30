import { test, expect } from '@playwright/test'

test.describe('Forma 3D E-commerce', () => {
  const BASE_URL = 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('1. Homepage loads correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Presentes feitos para durar')
    await expect(page.getByRole('link', { name: 'Ver produtos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Personalizar' })).toBeVisible()
  })

  test('2. Catalog shows products', async ({ page }) => {
    await page.getByRole('link', { name: 'Ver produtos' }).click()
    await expect(page.locator('h1')).toContainText('Nossos produtos')
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible()
  })

  test('3. Product detail page works', async ({ page }) => {
    await page.goto(`${BASE_URL}/produtos`)
    const productLink = page.locator('article').first()
    await productLink.click()
    await expect(page.locator('button', { name: /Adicionar ao carrinho/i })).toBeVisible()
  })

  test('4. Add to cart works', async ({ page }) => {
    await page.goto(`${BASE_URL}/produtos/porta-retratos-geometrico`)
    
    // Add personalization if required
    const personalizationInput = page.locator('input[placeholder*="Família"]').first()
    if (personalizationInput.isVisible()) {
      await personalizationInput.fill('Teste Silva')
    }
    
    await page.getByRole('button', { name: /Adicionar ao carrinho/i }).click()
    
    // Check drawer opens
    await expect(page.locator('text=Carrinho')).toBeVisible()
    await expect(page.locator('text=Porta-Retratos Geométrico')).toBeVisible()
  })

  test('5. Cart quantity works', async ({ page }) => {
    // Add product to cart first
    await page.goto(`${BASE_URL}/produtos/porta-retratos-geometrico`)
    await page.getByRole('button', { name: /Adicionar ao carrinho/i }).click()
    
    // Open cart
    await page.getByRole('button', { name: 'Carrinho' }).click()
    
    // Increase quantity
    const increaseBtn = page.locator('button').filter({ hasText: '+' }).first()
    await increaseBtn.click()
    
    // Verify quantity changed
    await expect(page.locator('text=2')).toBeVisible()
  })

  test('6. Checkout validates required fields', async ({ page }) => {
    // Add product to cart
    await page.goto(`${BASE_URL}/produtos/porta-retratos-geometrico`)
    await page.getByRole('button', { name: /Adicionar ao carrinho/i }).click()
    
    // Go to checkout
    await page.goto(`${BASE_URL}/checkout`)
    
    // Try to submit without filling
    await page.getByRole('button', { name: /Finalizar pedido/i }).click()
    
    // Check validation errors
    await expect(page.locator('text=Nome é obrigatório')).toBeVisible()
  })

  test('7. Order creation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/produtos/porta-retratos-geometrico`)
    await page.getByRole('button', { name: /Adicionar ao carrinho/i }).click()
    await page.goto(`${BASE_URL}/checkout`)
    
    // Fill form
    await page.getByLabel('Nome completo').fill('João Teste')
    await page.getByLabel('E-mail').fill('teste@email.com')
    await page.getByLabel('Telefone').fill('11999999999')
    await page.getByLabel('CPF').fill('12345678901')
    await page.getByLabel('CEP').fill('01001000')
    await page.getByLabel('Rua/Avenida').fill('Rua Teste')
    await page.getByLabel('Número').fill('100')
    await page.getByLabel('Bairro').fill('Centro')
    await page.getByLabel('Cidade').fill('São Paulo')
    await page.getByLabel('Estado').fill('SP')
    
    // Submit
    await page.getByRole('button', { name: /Finalizar pedido/i }).click()
    
    // Verify redirect to confirmation
    await expect(page.url()).toContain('/pedido-confirmado')
    await expect(page.locator('text=Pedido confirmado')).toBeVisible()
  })

  test('8. Admin pages work', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    await expect(page.url()).toContain('/admin/pedidos')
    
    await page.goto(`${BASE_URL}/admin/produtos`)
    await expect(page.locator('h1')).toContainText('Produtos')
    
    await page.goto(`${BASE_URL}/admin/categorias`)
    await expect(page.locator('h1')).toContainText('Categorias')
  })

  test('9. Static pages load', async ({ page }) => {
    const pages = [
      '/sobre',
      '/contato',
      '/faq',
      '/personalizados',
      '/presentes',
      '/politica-privacidade',
      '/termos-uso',
      '/trocas-devolucoes'
    ]
    
    for (const p of pages) {
      await page.goto(`${BASE_URL}${p}`)
      await expect(page.locator('main')).toBeVisible()
    }
  })

  test('10. 404 page works', async ({ page }) => {
    await page.goto(`${BASE_URL}/pagina-inexistente-xyz`)
    await expect(page.locator('text=404')).toBeVisible()
  })
})