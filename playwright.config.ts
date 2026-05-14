import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Smoke staging tem config dedicado (playwright.staging.config.ts) e
  // exige STAGING_BASE_URL — nao deve rodar junto com e2e local.
  testIgnore: ['**/smoke/**'],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})