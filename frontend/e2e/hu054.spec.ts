import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

/**
 * HU-054 · Recorrido completo del prototipo: regeneración, exportación a Moodle y Chamilo
 * y todas las pantallas enlazadas. Las capturas se guardan en test-results/HU-054 (no se suben al repositorio;
 * se adjuntan al informe en Notion).
 */
const evidence = 'test-results/HU-054';
mkdirSync(evidence, { recursive: true });

async function login(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cursos y unidades' })).toBeVisible();
}

async function approveCurrent(page: Page) {
  const article = page.locator('article').first();
  const accept = article.getByRole('list', { name: 'Alternativas' }).getByRole('button', { name: 'Aceptar' });
  while ((await accept.count()) > 0) await accept.first().click();
  await article.getByRole('button', { name: 'Aprobar recurso' }).click();
  await expect(page.getByText('Recurso aprobado.')).toBeVisible();
}

test('C03 · el recorrido enlaza sesión, curso, carga, solicitud, secuencia, revisión, exportación e indicadores', async ({ page }) => {
  await login(page);
  // Cursos → Carga → Configuración → Secuencia → Revisión → Exportación → Indicadores, con los botones de cada pantalla.
  const pasos: [string, string][] = [
    ['Continuar a carga de material', 'Carga de material'],
    ['Continuar a configuración', 'Configuración de la generación'],
    ['Ver secuencia 5E', 'Secuencia 5E'],
    ['Ir a revisión', 'Revisión docente'],
    ['Continuar a exportación', 'Exportación'],
    ['Ver indicadores', 'Indicadores del proyecto'],
  ];
  for (const [boton, titulo] of pasos) {
    await page.getByRole('main').getByRole('link', { name: boton }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  }
  // El menú también llega a las pantallas nuevas.
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  for (const [enlace, titulo] of [
    ['Solicitud por chat', 'Solicitud por chat'],
    ['Secuencia 5E', 'Secuencia 5E'],
  ]) {
    await menu.getByRole('link', { name: enlace }).click();
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  }
  await expect(page.getByRole('list', { name: 'Etapas de la secuencia 5E' }).getByRole('listitem').filter({ has: page.getByRole('heading', { level: 2 }) })).toHaveCount(5);
  await page.screenshot({ path: `${evidence}/01-secuencia-5e.png`, fullPage: true });
});

test('C01 · Regenerar propone otra versión y conserva la anterior', async ({ page }) => {
  await login(page);
  await page.goto('/revision');
  const article = page.locator('article').first();
  const original = await article.locator('#recurso-titulo').innerText();
  await expect(article.getByText('Versión 1', { exact: true })).toBeVisible();
  await article.getByRole('button', { name: 'Regenerar' }).click();
  await expect(article.getByText('Versión 2 · regenerada')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Se propuso la versión 2' })).toBeVisible();
  const history = article.getByRole('list', { name: 'Versiones anteriores' });
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history).toContainText('Versión 1 · primera propuesta');
  await history.getByRole('button', { name: 'Ver' }).click();
  await page.screenshot({ path: `${evidence}/03-regenerar-version-2.png`, fullPage: true });

  // La versión anterior se puede restaurar y la regenerada pasa al historial.
  await history.getByRole('button', { name: 'Restaurar' }).click();
  await expect(article.getByText('Versión 1', { exact: true })).toBeVisible();
  await expect(article.locator('#recurso-titulo')).toHaveText(original);
  await expect(article.getByRole('list', { name: 'Versiones anteriores' })).toContainText('Versión 2 · regenerada');

  // Un recurso aprobado no se regenera sin devolverlo a revisión.
  await approveCurrent(page);
  await expect(article.getByRole('button', { name: 'Regenerar' })).toHaveCount(0);
  await expect(article.getByText(/Devuelve el recurso a revisión antes de pedir otra versión/)).toBeVisible();
  await page.reload();
  await expect(page.locator('article').first().getByRole('list', { name: 'Versiones anteriores' })).toContainText('Versión 2');
});

test('C02 · exporta lo aprobado en Moodle XML (Moodle) y QTI 2.1 (Chamilo)', async ({ page }) => {
  await login(page);
  await page.goto('/revision');
  await approveCurrent(page);

  await page.goto('/exportacion');
  await expect(page.getByText('QTI 3.0')).toHaveCount(0);
  await expect(page.getByText('SCORM')).toHaveCount(0);
  await page.getByRole('button', { name: 'Seleccionar todos' }).click();

  // Moodle
  await page.getByRole('radio', { name: /Moodle · Moodle XML/ }).check();
  await page.getByRole('button', { name: 'Exportar para Moodle' }).click();
  await expect(page.getByText('Archivo listo para descargar')).toBeVisible({ timeout: 10_000 });
  const [moodle] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar Moodle XML (.xml)' }).click()]);
  const xml = readFileSync((await moodle.path())!, 'utf8');
  expect(xml).toContain('<quiz>');
  expect(xml).toContain('<question type="multichoice">');
  expect(xml.match(/fraction="100"/g)).toHaveLength(1);
  await moodle.saveAs(`${evidence}/exportacion-moodle.xml`);
  await page.screenshot({ path: `${evidence}/04-exportacion-moodle.png`, fullPage: true });

  // Chamilo
  await page.getByRole('radio', { name: /Chamilo · QTI 2.1/ }).check();
  await page.getByRole('button', { name: 'Exportar para Chamilo' }).click();
  await expect(page.getByText('Archivo listo para descargar')).toBeVisible({ timeout: 10_000 });
  const [chamilo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar paquete QTI 2.1 (.zip)' }).click()]);
  const zip = readFileSync((await chamilo.path())!);
  expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  expect(zip.toString('latin1')).toContain('imsmanifest.xml');
  await chamilo.saveAs(`${evidence}/exportacion-chamilo-qti21.zip`);

  const historial = page.getByRole('table');
  await expect(historial.getByRole('row')).toHaveCount(3); // encabezado + 2 exportaciones
  await page.screenshot({ path: `${evidence}/05-exportacion-chamilo-historial.png`, fullPage: true });

  for (const width of [1280, 820, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => {
      const w = innerWidth;
      return [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > w + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${el.className} → ${Math.round(el.getBoundingClientRect().right)}px: ${(el.textContent ?? '').slice(0, 40)}`);
    });
    expect(overflow, `desbordamiento horizontal a ${width}px`).toEqual([]);
  }
});
