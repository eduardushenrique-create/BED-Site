import { defineConfig, devices } from '@playwright/test'

// Config Playwright para smoke contra Railway staging.
//
// NAO confundir com `playwright.config.ts` (e2e local com webServer dev).
// Aqui o servidor ja esta rodando no Railway — so disparamos requests.
//
// Variavel obrigatoria: STAGING_BASE_URL (definida via secret do GHA).
// PR-staging-B da Onda 1 (HANDOFF-SPEC-007.md §4).

const baseURL = process.env.STAGING_BASE_URL

if (!baseURL) {
  throw new Error(
    'STAGING_BASE_URL nao definida. Esperado: secret do GitHub apontando ' +
      'para https://bed-site-staging.up.railway.app (ou equivalente).',
  )
}

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 120_000, // 2min por teste (handoff §4 PR-staging-B)
  expect: {
    timeout: 15_000,
  },
  // Sem retries: smoke flaky vira incidente, nao mascarar.
  retries: 0,
  // Um worker so — smoke serializa pra nao mascarar problema de concorrencia.
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-staging' }],
  ],
  use: {
    baseURL,
    headless: true,
    // Coleta evidencia em caso de falha — ajuda diagnostico no Actions log.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Staging pode ter cold start (Railway free tier dorme). Margem generosa.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
