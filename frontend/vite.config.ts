/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Variables de entorno de Node al compilar (sin agregar @types/node al proyecto). */
const nodeEnv = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

export default defineConfig({
  plugins: [react()],
  // En local, /api va al backend (puerto 8000). Las pruebas de punta a punta usan otro puerto (BACKEND_URL).
  server: { port: 5173, proxy: { '/api': { target: nodeEnv.BACKEND_URL ?? 'http://127.0.0.1:8000', changeOrigin: true } } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // TA-008 · Cobertura (caja blanca) de la lógica del cliente: servicios y utilidades.
    // `npm run test:cobertura` falla si baja de los umbrales. El reporte HTML queda en coverage/.
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/utils/**'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
