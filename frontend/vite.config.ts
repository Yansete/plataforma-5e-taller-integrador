/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // TA-008 · Cobertura (caja blanca) de la lógica del cliente: servicios, almacén y utilidades.
    // `npm run test:cobertura` falla si baja de los umbrales. El reporte HTML queda en coverage/.
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/store/**', 'src/utils/**'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
