import { expect, test } from '@playwright/test';

/**
 * TA-001 · Prueba de punta a punta del frontend de demostración.
 * Recorre las pantallas como un docente y comprueba las reglas de revisión y exportación.
 * Los datos son los de demostración (servicios simulados), así que cada prueba empieza
 * con el almacenamiento del navegador vacío.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
});

test('cada enlace del menú abre su pantalla', async ({ page }) => {
  const pantallas: [string, string][] = [
    ['Carga de material', 'Carga de material'],
    ['Configuración', 'Configuración de la generación'],
    ['Revisión docente', 'Revisión docente'],
    ['Exportación', 'Exportación'],
    ['Indicadores', 'Indicadores del proyecto'],
    ['Inicio', 'Resumen de tu trabajo'],
  ];
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  for (const [enlace, titulo] of pantallas) {
    await menu.getByRole('link', { name: enlace, exact: false }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  }
});

test('un recurso solo se aprueba tras decidir sus distractores y solo lo aprobado se exporta', async ({ page }) => {
  await page.goto('/revision');
  const recurso = page.getByRole('article', { name: 'Tope de la pila tras una secuencia de operaciones' });
  const aprobar = recurso.getByRole('button', { name: 'Aprobar recurso' });

  // 1. Sin decidir los distractores, aprobar está bloqueado y se explica por qué
  await expect(aprobar).toBeDisabled();
  await expect(recurso.getByText('Decide los 3 distractor(es) pendiente(s)')).toBeVisible();

  // 2. Exportación vacía mientras no haya nada aprobado
  await page.goto('/exportacion');
  await expect(page.getByRole('heading', { name: 'Aún no hay recursos aprobados' })).toBeVisible();

  // 3. El docente acepta los tres distractores y aprueba
  await page.goto('/revision');
  const alternativas = recurso.getByRole('list', { name: 'Alternativas' }).getByRole('listitem');
  for (const letra of ['B', 'C', 'D']) {
    await alternativas.filter({ hasText: `Alternativa ${letra}:` }).getByRole('button', { name: 'Aceptar' }).click();
  }
  await expect(aprobar).toBeEnabled();
  await aprobar.click();
  await expect(page.getByText('1 aprobado(s)')).toBeVisible();

  // 4. La decisión se conserva al recargar
  await page.reload();
  await expect(page.getByText('1 aprobado(s)')).toBeVisible();

  // 5. En exportación aparece el aprobado y no los que siguen en revisión
  await page.goto('/exportacion');
  const main = page.getByRole('main');
  await expect(main.getByText('Tope de la pila tras una secuencia de operaciones').first()).toBeVisible();
  await expect(main.getByText('Costo de desencolar en un arreglo simple')).toHaveCount(0);
});
