import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'hu053-api-'));
const database = join(directory, 'api.db').replaceAll('\\', '/');
export default defineConfig({
  testDir: './e2e', testMatch: ['hu053-api.spec.ts', 'ep002-api.spec.ts', 'material-real-api.spec.ts'], workers: 1, reporter: 'list',
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'api-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false },
    { command: `"${process.env.HU053_PYTHON ?? 'python'}" -m uvicorn plataforma5e.bootstrap.app:crear_aplicacion --factory --app-dir ../backend --port 8000`, url: 'http://127.0.0.1:8000/salud', reuseExistingServer: false, env: { DATABASE_URL: `sqlite:///${database}`, IA_PROVEEDOR: 'reglas', BUSQUEDA_POR_TEMA: 'false' } },
  ],
});
