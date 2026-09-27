/**
 * Pruebas de las reglas críticas de la capa de servicios simulados.
 * Se ejecutan con `npm test`. Usan un localStorage en memoria.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

async function loadApp() {
  vi.resetModules();
  const store = await import('../store/store');
  const services = await import('./index');
  const simulation = await import('./simulation');
  simulation.setLatencyFactor(0);
  return { ...store, ...services };
}

function firstItem(app: Awaited<ReturnType<typeof loadApp>>) {
  return app.getState().resources.find((r) => r.type === 'item_opcion_multiple')!;
}

function decideAllDistractors(app: Awaited<ReturnType<typeof loadApp>>, resourceId: string) {
  const r = app.getState().resources.find((x) => x.id === resourceId)!;
  for (const o of r.options!.filter((o) => !o.isCorrect)) app.reviewService.acceptDistractor(resourceId, o.id);
}

describe('revisión docente', () => {
  beforeEach(() => storage.clear());

  it('ningún recurso inicial está aprobado ni es exportable', async () => {
    const app = await loadApp();
    const state = app.getState();
    expect(state.resources.length).toBeGreaterThan(0);
    expect(state.resources.every((r) => r.status === 'pendiente')).toBe(true);
    expect(app.exportableResources(state.resources)).toHaveLength(0);
  });

  it('no permite aprobar un ítem con distractores sin decidir', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    expect(app.approvalBlockers(item).length).toBeGreaterThan(0);
    expect(() => app.reviewService.approveResource(item.id)).toThrow();
    expect(app.getState().resources.find((r) => r.id === item.id)!.status).toBe('pendiente');
  });

  it('aprueba solo con acción explícita y registra la decisión', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    expect(app.getState().resources.find((r) => r.id === item.id)!.status).toBe('pendiente');
    app.reviewService.approveResource(item.id);
    expect(app.getState().resources.find((r) => r.id === item.id)!.status).toBe('aprobado');
    expect(app.getState().reviewLog[0].action).toBe('aprobar');
  });

  it('editar no aprueba y marca el recurso como editado', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    app.reviewService.saveEdits(item.id, { title: item.title + ' (rev.)', body: item.body });
    const after = app.getState().resources.find((r) => r.id === item.id)!;
    expect(after.status).toBe('pendiente');
    expect(after.edited).toBe(true);
  });

  it('exige al menos dos distractores aceptados', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    const distractors = item.options!.filter((o) => !o.isCorrect);
    app.reviewService.discardDistractor(item.id, distractors[0].id, 'sin_sentido');
    app.reviewService.discardDistractor(item.id, distractors[1].id, 'duplicado');
    app.reviewService.acceptDistractor(item.id, distractors[2].id);
    expect(() => app.reviewService.approveResource(item.id)).toThrow(/al menos 2/);
  });

  it('las decisiones persisten tras recargar', async () => {
    let app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);

    app = await loadApp(); // simula recarga: el módulo vuelve a leer localStorage
    const reloaded = app.getState().resources.find((r) => r.id === item.id)!;
    expect(reloaded.status).toBe('aprobado');
    expect(app.getState().reviewLog.length).toBeGreaterThan(0);
  });

  it('restablecer la demo borra las decisiones', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    app.preferencesService.resetDemo();
    expect(app.getState().resources.every((r) => r.status === 'pendiente')).toBe(true);
    expect(app.getState().reviewLog).toHaveLength(0);
  });
});

describe('exportación', () => {
  beforeEach(() => storage.clear());

  it('rechaza recursos no aprobados', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    await expect(app.exportService.runExport({ format: 'qti30', resourceIds: [item.id], targetLms: 'por_definir' })).rejects.toThrow(/aprobad/);
    expect(app.getState().exports).toHaveLength(0);
  });

  it('exporta lo aprobado y deja validación e importación pendientes', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    const job = await app.exportService.runExport({ format: 'qti30', resourceIds: [item.id], targetLms: 'por_definir' });
    expect(job.steps.validacion).toBe('pendiente');
    expect(job.steps.importacion).toBe('pendiente');
    expect(job.steps.empaquetado).toBe('simulado');
    const summary = JSON.parse(app.exportService.buildSummary(job, app.getState()));
    expect(summary.advertencia).toMatch(/No es un paquete/);
  });

  it('un recurso devuelto a revisión deja de ser exportable', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    app.reviewService.revertResource(item.id);
    expect(app.exportableResources(app.getState().resources)).toHaveLength(0);
  });

  it('QTI no admite recursos que no son ítems', async () => {
    const app = await loadApp();
    const outcome = await app.generationService.generate({
      unitId: 'u2', outcomeId: null, stage: 'explain', resourceType: 'glosario', quantity: 1,
      difficulty: 'intermedia', optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '',
    });
    expect(outcome.kind).toBe('ok');
    const glossary = outcome.kind === 'ok' ? outcome.created[0] : null;
    app.reviewService.approveResource(glossary!.id);
    expect(app.formatIssues('qti30', [app.getState().resources.find((r) => r.id === glossary!.id)!])).toMatch(/solo admite/);
    await expect(app.exportService.runExport({ format: 'qti30', resourceIds: [glossary!.id], targetLms: 'por_definir' })).rejects.toThrow();
  });
});

describe('generación simulada', () => {
  beforeEach(() => storage.clear());

  const base = { outcomeId: null, quantity: 5, difficulty: 'intermedia' as const, optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '' };

  it('crea recursos pendientes sin duplicar ejemplos', async () => {
    const app = await loadApp();
    const first = await app.generationService.generate({ ...base, unitId: 'u2', stage: 'engage', resourceType: 'pregunta_detonante' });
    expect(first.kind).toBe('ok');
    if (first.kind === 'ok') expect(first.created.every((r) => r.status === 'pendiente')).toBe(true);
    const second = await app.generationService.generate({ ...base, unitId: 'u2', stage: 'engage', resourceType: 'pregunta_detonante' });
    expect(second.kind === 'ok' && second.created.length).toBe(0);
  });

  it('rechaza combinaciones sin ejemplos preparados', async () => {
    const app = await loadApp();
    const out = await app.generationService.generate({ ...base, unitId: 'u3', stage: 'engage', resourceType: 'pregunta_detonante' });
    expect(out.kind).toBe('rechazado');
  });
});

describe('indicadores', () => {
  beforeEach(() => storage.clear());

  it('I2 se calcula con las decisiones locales', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    const values = app.computeIndicators(app.getState().resources, { unitId: 'todas', period: 'todo' });
    const i2 = values.find((v) => v.code === 'I2')!;
    expect(i2.source).toBe('local');
    expect(i2.value).toBe(25); // 1 de 4 propuestos
    expect(values.find((v) => v.code === 'I16')!.source).toBe('pendiente');
  });
});

describe('carga de material', () => {
  beforeEach(() => storage.clear());

  it('valida formato, tamaño y permiso, y no guarda contenido', async () => {
    const app = await loadApp();
    expect(app.validateFile({ name: 'foto.png', size: 10 })).toMatch(/Formato/);
    expect(app.validateFile({ name: 'a.pdf', size: 0 })).toMatch(/vacío/);
    const errors = app.validateRegistration({ file: { name: 'a.pdf', size: 10 }, unitId: 'u2', outcomeIds: [], documentType: '', usePermission: false });
    expect(Object.keys(errors).sort()).toEqual(['documentType', 'outcomeIds', 'usePermission']);

    const doc = await app.materialService.registerDocument({
      file: { name: 'Nuevo.pdf', size: 2048 }, unitId: 'u2', outcomeIds: ['ra-2-1'], documentType: 'Guía de práctica', suggestedStage: null, usePermission: true,
    });
    await app.materialService.processDocument(doc.id);
    const saved = app.getState().documents.find((d) => d.id === doc.id)!;
    expect(saved.status).toBe('procesado');
    expect(saved.fragmentCount).toBe(0);
    expect(Object.keys(saved)).not.toContain('content');
  });
});
