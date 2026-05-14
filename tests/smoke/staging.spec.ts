import { test, expect, request } from '@playwright/test'

// Smoke test contra o ambiente de staging do Railway.
//
// Sao os 3 sinais MINIMOS que dizem "o app subiu, conecta no banco e o
// admin nao foi quebrado por uma migration". Mais do que isso vira QA;
// menos do que isso nao detecta nada.
//
// Sao 3 cenarios indepentes em paralelo NAO — workers=1 no config. Isso
// porque se a home falha por cold-start do Railway, nao quero culpar o
// health junto.

test.describe('staging smoke', () => {
  test('1. home retorna 200 e renderiza marca', async ({ page }) => {
    const response = await page.goto('/')
    expect(response, 'home GET /').not.toBeNull()
    expect(response!.status(), 'home status code').toBe(200)

    // A home pode demorar pra renderizar dynamic content; checamos so o
    // HTML estatico do layout (titulo da aba ja vem renderizado server-side
    // em next 16).
    const title = await page.title()
    expect(title, 'document.title').toMatch(/B&D|Forma 3D|Presentes/i)
  })

  test('2. /api/health responde 200 com status ok', async ({ playwright, baseURL }) => {
    const apiContext = await playwright.request.newContext({ baseURL })
    const response = await apiContext.get('/api/health')

    expect(response.status(), 'health status code').toBe(200)

    const body = await response.json()
    expect(body, 'health body').toMatchObject({
      status: 'ok',
      checks: {
        prisma: 'up',
        schema: 'ok',
        order_query: 'ok',
        migrations: 'ok',
      },
    })

    await apiContext.dispose()
  })

  test('3. /admin renderiza sem 5xx (gate de regressao admin)', async ({ page }) => {
    // O admin nao tem login dedicado — eh client-side. So validamos que
    // a rota nao explode com 5xx (sintoma classico de schema mismatch +
    // server component que tenta ler do banco). Status 200, 302, 401 ou
    // 403 sao todos aceitaveis aqui; o que NAO pode acontecer eh 500.
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    expect(response, '/admin response').not.toBeNull()
    const status = response!.status()
    expect(
      status,
      `/admin status deveria ser <500 (recebeu ${status})`,
    ).toBeLessThan(500)
  })
})
