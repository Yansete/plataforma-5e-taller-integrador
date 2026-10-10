import { expect, test } from '@playwright/test';

test('EP-002 sesión, curso, archivo y solicitud se recuperan desde el backend', async ({ page }) => {
  const login = async () => {
    await page.goto('/login');
    await page.getByLabel('Modo de acceso').selectOption('backend');
    await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
    await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Cursos y unidades', exact: true })).toBeVisible();
  };
  await login();
  await page.getByLabel('Código del curso').fill('E2E-EP002');
  await page.getByLabel('Nombre del curso').fill('Curso conectado de prueba');
  await page.getByLabel('Periodo académico').fill('2026-II');
  await page.getByLabel('Unidad 1', { exact: true }).fill('Material docente');
  await page.getByRole('button', { name: 'Crear curso', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Curso E2E-EP002 creado');
  const unidad = await page.evaluate(() => JSON.parse(localStorage.getItem('plataforma5e.backend.docente@5e.demo')!).units.find((u: { title: string }) => u.title === 'Material docente').id);
  await page.goto('/carga');
  await expect(page.getByRole('button', { name: 'Guardar archivo en el servidor' })).toBeVisible();
  await page.getByLabel('Unidad', { exact: true }).selectOption(unidad);
  await page.locator('input[type=file]').setInputFiles({ name: 'material-ep002.txt', mimeType: 'text/plain', buffer: Buffer.from('Archivo docente persistido en el backend.') });
  await page.getByLabel('Tipo de documento', { exact: true }).selectOption('Guía de práctica');
  await page.getByLabel('Confirmo que tengo permiso', { exact: false }).check();
  await page.getByRole('button', { name: 'Guardar archivo en el servidor' }).click();
  await expect(page.getByRole('status')).toContainText('guardado en el servidor');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar archivo' }).click();
  expect((await download).suggestedFilename()).toBe('material-ep002.txt');
  await page.goto('/chat');
  await page.getByLabel('Tu solicitud o corrección').fill('Necesito una actividad del curso ICSI-205 unidad 2; Público: Tercer ciclo EP002; Competencia: Pensamiento crítico EP002; Modalidad: Textual; Cantidad: 1; Etapa: Explore');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByLabel('Unidad interpretada')).toHaveValue('u2');
  await page.getByRole('button', { name: 'Confirmar y continuar a configuración' }).click();
  await expect(page.getByLabel('Público objetivo / Ciclo')).toHaveValue('Tercer ciclo EP002');
  const send = page.waitForResponse((r) => r.url().endsWith('/api/v1/generaciones') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Solicitar propuestas a la API' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmar solicitud' })).toContainText('Tercer ciclo EP002');
  await page.getByRole('button', { name: 'Confirmar y solicitar' }).click();
  expect((await send).status()).toBe(200);
  await expect(page.getByRole('status').filter({ hasText: '1 recurso(s)' })).toBeVisible();
  // Borrar caché local prueba que los datos visibles se recuperan del servidor.
  await page.evaluate(() => localStorage.removeItem('plataforma5e.backend.docente@5e.demo'));
  await page.reload();
  await expect(page.getByRole('table')).toContainText('Tercer ciclo EP002');
  await page.goto('/cursos');
  await expect(page.getByRole('heading', { name: 'Curso conectado de prueba' })).toBeVisible();
  await page.goto('/carga');
  await expect(page.getByText('material-ep002.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login();
  await expect(page.getByRole('heading', { name: 'Curso conectado de prueba' })).toBeVisible();
  await page.goto('/configuracion');
  await expect(page.getByRole('table')).toContainText('Pensamiento crítico EP002');
});

test('EP-002 fallo de conexión no crea cursos locales', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Modo de acceso').selectOption('backend');
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('Código del curso')).toBeVisible();
  await page.getByLabel('Código del curso').fill('FALLO');
  await page.getByLabel('Nombre del curso').fill('No debe crearse');
  await page.getByLabel('Periodo académico').fill('2026-II');
  await page.getByLabel('Unidad 1', { exact: true }).fill('Unidad fallida');
  await page.route('**/api/v1/cursos', (route) => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Crear curso', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
  await expect(page.getByRole('heading', { name: 'No debe crearse', exact: true })).toHaveCount(0);
});


test('EP-002 conserva los cursos locales al entrar y salir del modo conectado', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Código del curso').fill('LOCAL-045');
  await page.getByLabel('Nombre del curso').fill('Curso previo de HU-045');
  await page.getByLabel('Periodo académico').fill('2026-II');
  await page.getByLabel('Unidad 1', { exact: true }).fill('Unidad local');
  await page.getByRole('button', { name: 'Crear curso', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Modo de acceso').selectOption('backend');
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('Código del curso')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Curso previo de HU-045' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByLabel('Correo electrónico').fill('docente@5e.demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('Demo5E!2026');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Curso previo de HU-045' })).toBeVisible();
});
