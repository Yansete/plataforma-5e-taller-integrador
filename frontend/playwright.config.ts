import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta del frontend (TA-001).
 * Levantan el servidor de Vite y recorren la interfaz en Chromium como lo haría un docente.
 *
 *   npm run test:e2e
 */
const PUERTO = 5174;

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/hu053-api.spec.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
