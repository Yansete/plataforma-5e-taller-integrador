/** Revisión: reglas para aprobar, cambios del docente, guardado, regeneración y evidencia. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  approvalBlockers,
  citedCount,
  citedEvidence,
  countByStatus,
  decideOption,
  deleteResource,
  distractors,
  editContent,
  editOption,
  editProblem,
  highlight,
  listResources,
  optionProblem,
  optionSource,
  pendingDistractors,
  regenerate,
  reviewBody,
  saveResource,
  setStatus,
  withStatus,
} from './revision';
import { item, mockFetch, text } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('reglas para aprobar', () => {
  it('exige decidir los distractores, aceptar al menos dos y tener clave', () => {
    let r = item();
    expect(distractors(r)).toHaveLength(3);
    expect(pendingDistractors(r)).toBe(3);
    expect(approvalBlockers(r)).toEqual(['Decide los 3 distractores pendientes para poder aprobar.']);
    r = decideOption(decideOption(r, 'b', 'aceptado'), 'c', 'descartado', 'duplicado');
    expect(approvalBlockers(r)).toEqual(['Decide el distractor pendiente para poder aprobar.']);
    r = decideOption(r, 'd', 'descartado');
    expect(r.options![3]).toMatchObject({ decision: 'descartado', discardReason: 'otro' });
    expect(approvalBlockers(r)[0]).toMatch(/al menos 2 distractores/);
    r = decideOption(r, 'c', 'aceptado');
    expect(approvalBlockers(r)).toEqual([]);
    expect(approvalBlockers({ ...r, options: r.options!.map((o) => ({ ...o, isCorrect: false, decision: 'aceptado' as const })) })).toEqual(['La pregunta necesita una respuesta correcta.']);
    expect(approvalBlockers(text({ body: '  ' }))).toEqual(['El contenido no puede estar vacío.']);
    expect(approvalBlockers(text())).toEqual([]);
  });

  it('cuenta y ordena por estado', () => {
    const list = [item({ id: 'a', createdAt: '2026-01-01' }), item({ id: 'b', createdAt: '2026-02-01' }), text({ status: 'aprobado' })];
    expect(countByStatus(list)).toEqual({ pendiente: 2, aprobado: 1, descartado: 0 });
    expect(withStatus(list, 'pendiente').map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('cambios del docente', () => {
  it('editar un distractor lo acepta y marca la edición', () => {
    const r = editOption(item(), 'b', 'TCP con acuse', 'Retro b');
    expect(r.options![1]).toMatchObject({ text: 'TCP con acuse', edited: true, decision: 'aceptado' });
    const same = editOption(item(), 'b', 'TCP', 'Retro b');
    expect(same.options![1]).toMatchObject({ edited: false, decision: 'aceptado' });
    const key = editOption(item(), 'a', 'UDP', 'Nueva retro');
    expect(key.options![0]).toMatchObject({ decision: 'pendiente', edited: true });
  });

  it('editar el contenido y cambiar el estado', () => {
    expect(editContent(text(), 'Las capas del modelo', 'Primer párrafo.\n\nSegundo <párrafo>.').edited).toBe(false);
    expect(editContent(text(), 'Otro título', text().body).edited).toBe(true);
    expect(setStatus(item(), 'descartado')).toMatchObject({ status: 'descartado', discardReason: 'otro' });
    expect(setStatus(item({ status: 'descartado', discardReason: 'duplicado' }), 'pendiente')).toMatchObject({ status: 'pendiente', discardReason: null });
  });

  it('valida los textos editados', () => {
    expect(editProblem('', 'x')).toMatch(/título/);
    expect(editProblem('T', ' ')).toMatch(/vacío/);
    expect(editProblem('x'.repeat(161), 'x')).toMatch(/160/);
    expect(editProblem('T', 'x'.repeat(8001))).toMatch(/8000/);
    expect(editProblem('T', 'x')).toBeNull();
    expect(optionProblem(' ', '')).toMatch(/texto/);
    expect(optionProblem('x', 'y'.repeat(601))).toMatch(/600/);
    expect(optionProblem('x', '')).toBeNull();
  });
});

describe('servidor', () => {
  it('guarda solo lo editable de la revisión', () => {
    const body = reviewBody(decideOption(setStatus(item(), 'descartado', 'sin_sentido'), 'b', 'aceptado'));
    expect(body).toMatchObject({ status: 'descartado', discardReason: 'sin_sentido', edited: false });
    expect(body.options![1]).toEqual({ id: 'b', text: 'TCP', feedback: 'Retro b', decision: 'aceptado', discardReason: null, edited: false });
    expect(reviewBody(text()).options).toBeNull();
    expect(reviewBody(item()).discardReason).toBeNull();
  });

  it('lista, guarda y borra en la ruta de la unidad', async () => {
    const calls = mockFetch({ body: [item()] }, { body: item({ status: 'aprobado' }) }, { status: 204 });
    expect(await listResources('u1')).toHaveLength(1);
    expect((await saveResource(item())).status).toBe('aprobado');
    await deleteResource(item());
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET /api/v1/unidades/u1/recursos', 'PUT /api/v1/unidades/u1/recursos/r1', 'DELETE /api/v1/unidades/u1/recursos/r1']);
  });

  it('regenera con los mismos parámetros y descarta la versión anterior', async () => {
    const nuevo = item({ id: 'r9' });
    const calls = mockFetch({ body: { resources: [nuevo], generator: { fallback: false } } }, { body: item({ status: 'descartado', discardReason: 'regenerado' }) });
    const result = await regenerate(item());
    expect(result.created).toEqual([nuevo]);
    expect(result.replaced.discardReason).toBe('regenerado');
    expect(calls[0].body).toMatchObject({ tipo_recurso: 'item_opcion_multiple', cantidad: 1, dificultad: 'avanzada', resultado_aprendizaje_id: 'ra1', indicaciones: 'Usa videollamadas' });
    expect(calls[1].body).toMatchObject({ status: 'descartado', discardReason: 'regenerado' });
  });

  it('sin parámetros guardados regenera con los datos del recurso', async () => {
    const calls = mockFetch({ body: { resources: [] } }, { body: text({ status: 'descartado' }) });
    await regenerate(text({ params: undefined, outcomeId: '' }));
    expect(calls[0].body).toMatchObject({ tipo_recurso: 'explicacion', dificultad: 'intermedia', resultado_aprendizaje_id: null, alternativas: 4 });
    mockFetch({ body: { resources: [] } }, { body: item() });
    await regenerate(item({ params: undefined }));
  });
});

describe('evidencia', () => {
  it('relaciona cada afirmación con sus fragmentos guardados', () => {
    const r = item();
    expect(citedEvidence(r).map((c) => [c.claim, c.evidence.map((e) => e.id)])).toEqual([
      ['TCP garantiza una entrega confiable y retransmite lo que se pierde', ['f1']],
      ['UDP introduce menos retardo', ['f2']],
    ]);
    expect(citedEvidence(item({ citations: [{ claim: 'sin fuente', fragmentIds: ['x'] }] }))).toEqual([]);
    expect(optionSource(r, r.options![0])?.id).toBe('f2');
    expect(optionSource(r, r.options![3])).toBeNull();
    expect(citedCount(r)).toBe(2);
  });

  it('resalta la frase del fragmento que sostiene la afirmación', () => {
    const [before, match, after] = highlight('TCP numera los segmentos. TCP garantiza una entrega confiable porque confirma la recepción. Es más lento.', 'TCP garantiza una entrega confiable');
    expect(before).toBe('TCP numera los segmentos. ');
    expect(match).toBe('TCP garantiza una entrega confiable porque confirma la recepción.');
    expect(after).toBe(' Es más lento.');
    expect(highlight('Nada que ver aquí.', 'TCP garantiza entrega')).toEqual(['Nada que ver aquí.', '', '']);
  });
});
