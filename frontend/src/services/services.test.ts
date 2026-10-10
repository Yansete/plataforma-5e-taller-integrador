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
    await expect(app.exportService.runExport({ format: 'moodle_xml', resourceIds: [item.id], targetLms: 'moodle' })).rejects.toThrow(/aprobad/);
    expect(app.getState().exports).toHaveLength(0);
  });

  it('HU-054 exporta lo aprobado a Moodle XML con la clave y solo los distractores aceptados', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    const distractors = item.options!.filter((o) => !o.isCorrect);
    for (const o of distractors.slice(0, -1)) app.reviewService.acceptDistractor(item.id, o.id);
    const dropped = distractors[distractors.length - 1];
    app.reviewService.discardDistractor(item.id, dropped.id, 'duplicado');
    app.reviewService.approveResource(item.id);
    const job = await app.exportService.runExport({ format: 'moodle_xml', resourceIds: [item.id], targetLms: 'moodle' });
    expect(job.steps.empaquetado).toBe('completado');
    expect(job.steps.validacion).toBe('pendiente');
    expect(job.steps.importacion).toBe('pendiente');
    expect(job.fileName).toMatch(/moodle-\d{12}\.xml$/);
    const file = app.exportService.buildFile(job, app.getState());
    const xml = file.data as string;
    expect(file.mimeType).toBe('application/xml');
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<question type="multichoice">');
    expect(xml.match(/fraction="100"/g)).toHaveLength(1);
    expect(xml.match(/<answer /g)).toHaveLength(distractors.length);
    // El texto del distractor descartado puede aparecer en el enunciado (p. ej. «7»): se comprueba solo entre las alternativas.
    const answers = [...xml.matchAll(/<answer [^>]*>\s*<text><!\[CDATA\[(.*?)\]\]><\/text>/g)].map((m) => m[1]);
    expect(answers).toHaveLength(distractors.length);
    expect(answers).not.toContain(`<p>${dropped.text}</p>`);
  });

  it('HU-054 exporta a Chamilo como paquete QTI 2.1 (ZIP con manifiesto)', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    const job = await app.exportService.runExport({ format: 'qti21', resourceIds: [item.id], targetLms: 'chamilo' });
    const file = app.exportService.buildFile(job, app.getState());
    const zip = file.data as Uint8Array;
    expect(file.fileName.endsWith('.zip')).toBe(true);
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('imsmanifest.xml');
    expect(text).toContain('imsqti_item_xmlv2p1');
    expect(text).toContain('<choiceInteraction responseIdentifier="RESPONSE"');
  });

  it('cada plataforma usa su formato y ya no se ofrecen QTI 3.0 ni SCORM', async () => {
    const app = await loadApp();
    expect(app.formatForLms('moodle')).toBe('moodle_xml');
    expect(app.formatForLms('chamilo')).toBe('qti21');
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    await expect(app.exportService.runExport({ format: 'moodle_xml', resourceIds: [item.id], targetLms: 'chamilo' })).rejects.toThrow(/QTI 2.1/);
    const catalog = await import('../data/catalog');
    expect(catalog.EXPORT_FORMATS.map((f) => f.id)).toEqual(['moodle_xml', 'qti21']);
  });

  it('un recurso devuelto a revisión deja de ser exportable', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    const job = await app.exportService.runExport({ format: 'moodle_xml', resourceIds: [item.id], targetLms: 'moodle' });
    app.reviewService.revertResource(item.id);
    expect(app.exportableResources(app.getState().resources)).toHaveLength(0);
    expect(() => app.exportService.buildFile(job, app.getState())).toThrow(/volvió a revisión/);
  });

  it('Moodle XML y QTI no admiten recursos que no son ítems', async () => {
    const app = await loadApp();
    const outcome = await app.generationService.generate({
      unitId: 'u2', outcomeId: null, stage: 'explain', resourceType: 'glosario', quantity: 1,
      difficulty: 'intermedia', optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '',
    });
    expect(outcome.kind).toBe('ok');
    const glossary = outcome.kind === 'ok' ? outcome.created[0] : null;
    app.reviewService.approveResource(glossary!.id);
    expect(app.formatIssues('moodle_xml', [app.getState().resources.find((r) => r.id === glossary!.id)!])).toMatch(/solo admite/);
    await expect(app.exportService.runExport({ format: 'qti21', resourceIds: [glossary!.id], targetLms: 'chamilo' })).rejects.toThrow();
  });
});

describe('regeneración (HU-054)', () => {
  beforeEach(() => storage.clear());

  it('propone otra versión, la deja pendiente y conserva la anterior', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    app.reviewService.acceptDistractor(item.id, item.options!.find((o) => !o.isCorrect)!.id);
    const updated = await app.regenerationService.regenerate(item.id);
    expect(updated.version).toBe(2);
    expect(updated.versionOrigin).toBe('regenerada');
    expect(updated.status).toBe('pendiente');
    expect(updated.previousVersions).toHaveLength(1);
    expect(updated.previousVersions[0].number).toBe(1);
    expect(updated.previousVersions[0].body).toBe(item.body);
    expect(updated.body).not.toBe(item.body);
    expect(updated.options!.every((o) => o.decision === 'pendiente')).toBe(true);
    expect(app.getState().reviewLog[0].action).toBe('regenerar');
  });

  it('no regenera un recurso aprobado', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    decideAllDistractors(app, item.id);
    app.reviewService.approveResource(item.id);
    await expect(app.regenerationService.regenerate(item.id)).rejects.toThrow(/aprobado/);
  });

  it('permite regenerar un recurso descartado y lo devuelve a revisión', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    app.reviewService.discardResource(item.id, 'sin_sentido');
    const updated = await app.regenerationService.regenerate(item.id);
    expect(updated.status).toBe('pendiente');
    expect(updated.discardReason).toBeNull();
  });

  it('restaura una versión anterior sin perder la vigente y sin repetir números', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    await app.regenerationService.regenerate(item.id);
    const restored = app.regenerationService.restoreVersion(item.id, 1);
    expect(restored.version).toBe(1);
    expect(restored.body).toBe(item.body);
    expect(restored.previousVersions.map((v) => v.number)).toEqual([2]);
    const third = await app.regenerationService.regenerate(item.id);
    expect(third.version).toBe(3);
    expect(third.previousVersions.map((v) => v.number)).toEqual([2, 1]);
  });

  it('una variante regenerada sigue citando la misma evidencia', async () => {
    const app = await loadApp();
    const item = firstItem(app);
    const updated = await app.regenerationService.regenerate(item.id);
    if (updated.exampleId === item.exampleId) expect(updated.citations).toEqual(item.citations);
    expect(updated.citations.length).toBeGreaterThan(0);
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

  it('una unidad nueva sin resultados de aprendizaje no bloquea la carga (error visto el 10/10)', async () => {
    const app = await loadApp();
    const course = app.courseService.save({ code: 'NUEVO-1', name: 'Curso nuevo', term: '2026-II', units: [{ title: 'Unidad sin RA' }] });
    const unit = app.getState().units.find((u) => u.courseId === course.id)!;
    const errors = app.validateRegistration({ file: { name: 'a.pdf', size: 10 }, unitId: unit.id, outcomeIds: [], documentType: 'Guía de práctica', usePermission: true });
    expect(errors).toEqual({});
  });

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
