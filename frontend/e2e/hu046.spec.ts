import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = '../docs/evidencias/HU-046';
mkdirSync(evidence, { recursive: true });
async function login(page: import('@playwright/test').Page) {
  await page.goto('/chat');
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // Configuración persiste el estado inicial, que incluye una solicitud de demo.
  await page.goto('/configuracion');
  await expect(page.getByRole('heading', { name: 'Configuración de la generación', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('plataforma5e.demo.v1'))).not.toBeNull();
  await page.goto('/chat');
}
test('HU-046 interpreta, corrige y transfiere contexto sin generar desde chat', async ({ page }) => {
  await login(page);
  const confirm = page.getByRole('button', { name: 'Confirmar y continuar a configuración' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Tu solicitud o corrección').fill('Necesito dos actividades del curso ICSI-205 unidad 2 para estudiantes de tercer ciclo; con pensamiento crítico y modalidad textual');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByLabel('Cantidad interpretada')).toHaveValue('2');
  await expect(confirm).toBeEnabled();
  await page.screenshot({ path: `${evidence}/01-interpretacion.png`, fullPage: true });
  await page.getByLabel('Tu solicitud o corrección').fill('Cantidad: 6');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Tu solicitud o corrección').fill('Cantidad: 3; Modalidad: Multimedia');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByLabel('Multimedia', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Textual', { exact: true })).not.toBeChecked();
  await page.getByLabel('Competencia interpretada').fill('Resolución de problemas');
  await page.getByLabel('Etapa inicial 5E').selectOption('explore');
  await page.screenshot({ path: `${evidence}/02-correccion.png`, fullPage: true });
  const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('plataforma5e.demo.v1') ?? 'null')?.requests ?? []).length);
  await confirm.click();
  await expect(page).toHaveURL(/configuracion/);
  await expect(page.getByLabel('Público objetivo / Ciclo')).toHaveValue('estudiantes de tercer ciclo');
  await expect(page.getByLabel('Competencia a desarrollar')).toHaveValue('Resolución de problemas');
  await expect(page.getByLabel('Cantidad de recursos')).toHaveValue('3');
  await expect(page.getByLabel('Multimedia', { exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByLabel('Competencia a desarrollar')).toHaveValue('Resolución de problemas');
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('plataforma5e.demo.v1') ?? 'null')?.requests ?? []).length)).toBe(before);
  await page.screenshot({ path: `${evidence}/03-configuracion.png`, fullPage: true });
  await page.getByRole('button', { name: 'Generar propuestas (simulado)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'recurso(s)' })).toBeVisible({ timeout: 15000 });
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem('plataforma5e.demo.v1')!).requests[0]);
  expect(request).toMatchObject({ quantity: 3, competency: 'Resolución de problemas', modalities: ['Multimedia'], stage: 'explore' });
  await page.getByRole('link', { name: 'Ir a revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Revisión docente', exact: true })).toBeVisible();
});
test('HU-046 teclado, formulario incompleto y pantallas pequeñas', async ({ page }) => {
  await login(page);
  const input = page.getByLabel('Tu solicitud o corrección');
  await input.focus();
  await expect.poll(() => input.evaluate((el) => getComputedStyle(el).outlineColor)).toBe('rgb(22, 53, 44)');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Escribe una solicitud');
  await input.fill('hola');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByRole('log')).toContainText('Revisa o completa');
  for (const width of [1280, 820, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/04-chat-${width}.png`, fullPage: true });
  }
});
