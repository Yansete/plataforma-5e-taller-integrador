import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
// Recorrido real contra el backend (playwright.api.config.ts levanta Vite y uvicorn con el generador por reglas):
// curso con sumilla y resultados → material procesado → generación citada → revisión → descarga.
const evidence = 'test-results/material-real';
mkdirSync(evidence, { recursive: true });

const MATERIAL = [
  'Unidad 1: Protocolos de transporte',
  '',
  'El protocolo TCP es orientado a la conexión: establece la conexión con un saludo de tres vías y garantiza una entrega confiable de los datos.',
  'El protocolo UDP no establece conexión ni confirma la entrega; por eso es más rápido y se usa en videollamadas y juegos en línea.',
  '',
  'El protocolo IP se encarga del direccionamiento y del enrutamiento de los paquetes en la red.',
  'El enrutador es el dispositivo que decide por qué camino viaja cada paquete hasta llegar a su destino.',
  'La encapsulación es el proceso por el cual cada capa agrega su propio encabezado a los datos que recibe.',
].join('\n');

test('material real: curso, carga procesada, generación citada, revisión y descarga', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Modo de acceso').selectOption('backend');
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Cursos y unidades', exact: true })).toBeVisible();

  // 1. Curso con sumilla, logro y resultados de aprendizaje
  await page.getByLabel('Código del curso').fill('RED-REAL');
  await page.getByLabel('Nombre del curso').fill('Redes de Computadoras');
  await page.getByLabel('Periodo académico').fill('2026-II');
  await page.getByLabel('Sumilla (opcional)').fill('Curso teórico-práctico sobre modelos de referencia y protocolos de red.');
  await page.getByLabel('Logro del curso (opcional)').fill('Explica cómo se comunican los equipos en una red.');
  await page.getByLabel('Unidad 1', { exact: true }).fill('Protocolos de transporte');
  await page.getByLabel('Resultados de aprendizaje de la unidad 1 (opcional)').fill('Distingue los protocolos TCP y UDP');
  await page.getByRole('button', { name: 'Crear curso', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Curso RED-REAL creado');
  await expect(page.getByText('1 resultado(s) de aprendizaje')).toBeVisible();
  const unidad = await page.evaluate(() => JSON.parse(localStorage.getItem('plataforma5e.backend.docente@5e.demo')!).units
    .find((u: { title: string }) => u.title === 'Protocolos de transporte').id);

  // 2. Carga: el servidor extrae el texto y crea los fragmentos
  await page.goto('/carga');
  await page.getByLabel('Unidad', { exact: true }).selectOption(unidad);
  await page.getByLabel('Distingue los protocolos TCP y UDP', { exact: false }).check();
  await page.locator('input[type=file]').setInputFiles({ name: 'protocolos.txt', mimeType: 'text/plain', buffer: Buffer.from(MATERIAL) });
  await page.getByLabel('Tipo de documento', { exact: true }).selectOption('Separata o apuntes de clase');
  await page.getByLabel('Confirmo que tengo permiso', { exact: false }).check();
  await page.getByRole('button', { name: 'Guardar archivo en el servidor' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'guardado en el servidor y procesado' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('listitem').filter({ hasText: 'protocolos.txt' }).getByRole('button', { name: 'Ver fragmentos' }).click();
  await expect(page.getByRole('list', { name: 'Fragmentos de protocolos.txt' })).toContainText('protocolo TCP');
  await page.screenshot({ path: `${evidence}/01-material-procesado.png`, fullPage: true });

  // 3. Generación con el material (generador por reglas en las pruebas)
  await page.goto('/configuracion');
  await page.getByLabel('Unidad', { exact: true }).selectOption(unidad);
  await page.getByLabel('Evaluar (Evaluate)', { exact: false }).check();
  await page.getByLabel('Cantidad de recursos').selectOption('1');
  await expect(page.getByText('Se generará con tu material')).toBeVisible();
  await page.getByRole('button', { name: 'Generar propuestas con mi material' }).click();
  await page.getByRole('button', { name: 'Confirmar y solicitar' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 recurso(s) enviados a revisión' })).toContainText('Generador por reglas', { timeout: 30_000 });
  await page.screenshot({ path: `${evidence}/02-generado.png`, fullPage: true });

  // 4. Revisión: evidencia del material del docente, decisión de distractores y aprobación
  await page.getByRole('link', { name: 'Ir a revisión' }).click();
  await expect(page.getByText('Propuesta generada a partir de tu material')).toBeVisible();
  await expect(page.getByText('Material del docente')).toBeVisible();
  const recurso = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Aprobar recurso' }) }).first();
  await page.screenshot({ path: `${evidence}/03-revision-propuesta.png`, fullPage: true });
  const aceptar = recurso.getByRole('button', { name: 'Aceptar' });
  while (await aceptar.count()) await aceptar.first().click();
  await recurso.getByRole('button', { name: 'Aprobar recurso' }).click();
  await expect(page.getByText('1 aprobado(s)')).toBeVisible();
  await page.screenshot({ path: `${evidence}/04-revision-aprobado.png`, fullPage: true });

  // 5. Descarga: Moodle XML del ítem y la secuencia completa como documento
  await page.goto('/exportacion');
  await page.getByRole('button', { name: 'Seleccionar todos' }).click();
  await page.getByRole('radio', { name: /Moodle · Moodle XML/ }).check();
  await page.getByRole('button', { name: 'Exportar para Moodle' }).click();
  await expect(page.getByText('Archivo listo para descargar')).toBeVisible({ timeout: 10_000 });
  const [moodle] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar Moodle XML (.xml)' }).click()]);
  expect(readFileSync((await moodle.path())!, 'utf-8')).toContain('<question type="multichoice">');
  const [secuencia] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar secuencia (.html)' }).click()]);
  const html = readFileSync((await secuencia.path())!, 'utf-8');
  expect(html).toContain('Secuencia didáctica 5E');
  expect(html).toContain('Redes de Computadoras');
  expect(html).toContain('(clave)');
  await secuencia.saveAs(`${evidence}/secuencia-5e.html`);
  await page.screenshot({ path: `${evidence}/05-exportacion.png`, fullPage: true });
});
