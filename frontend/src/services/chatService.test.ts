import { beforeEach, describe, expect, it } from 'vitest';
import { resetState, getState } from '../store/store';
import { courseService } from './courseService';
import { chatService, EMPTY_CHAT_DRAFT, interpretChat, validateChatDraft } from './chatService';
const full = 'Curso: ICSI-205; Unidad: 2; Público: estudiantes de tercer ciclo; Competencia: pensamiento crítico; Modalidad: Textual; Cantidad: 2; Etapa: Evaluate';
beforeEach(resetState);
describe('HU-046 interpretación y confirmación', () => {
  it('interpreta campos y confirma solo contexto; no genera ni aprueba recursos', () => {
    const { draft } = interpretChat(full, EMPTY_CHAT_DRAFT);
    expect(validateChatDraft(draft)).toEqual([]);
    expect(draft.stage).toBe('evaluate');
    expect(getState().ui.config.audience).toBeUndefined();
    const before = getState();
    chatService.confirm(draft);
    expect(getState().ui.config).toMatchObject({ unitId: 'u2', audience: 'estudiantes de tercer ciclo', quantity: 2, modalities: ['Textual'], resourceType: 'item_opcion_multiple' });
    expect(getState().resources).toBe(before.resources);
    expect(getState().requests).toBe(before.requests);
  });
  it('captura expresiones naturales sin inventar campos ausentes', () => {
    const { draft } = interpretChat('Necesito tres actividades del curso ICSI-205 unidad 2 para estudiantes de tercer ciclo; con pensamiento crítico y modalidad gamificado', EMPTY_CHAT_DRAFT);
    expect(draft).toMatchObject({ unitId: 'u2', quantity: '3', audience: 'estudiantes de tercer ciclo', competency: 'Pensamiento crítico', modalities: ['Gamificado'] });
    expect(validateChatDraft(interpretChat('hola', EMPTY_CHAT_DRAFT).draft)).toHaveLength(6);
  });
  it('corrige cantidad y reemplaza modalidad conservando los otros parámetros', () => {
    const first = interpretChat(full, EMPTY_CHAT_DRAFT).draft;
    const next = interpretChat('Cantidad: 3; Modalidad: Multimedia', first).draft;
    expect(next).toMatchObject({ courseId: first.courseId, unitId: first.unitId, quantity: '3', modalities: ['Multimedia'] });
  });
  it.each(['0', '6', '2.5', 'abc'])('bloquea cantidad inválida %s', (quantity) => {
    const draft = interpretChat(`${full}; Cantidad: ${quantity}`, EMPTY_CHAT_DRAFT).draft;
    // La corrección se envía por un mensaje separado como en el recorrido real.
    const corrected = interpretChat(`Cantidad: ${quantity}`, draft).draft;
    expect(validateChatDraft(corrected)).toContain('cantidad entera de 1 a 5');
    expect(() => chatService.confirm(corrected)).toThrow('Completa');
  });
  it('cambio de curso invalida la unidad previa y no acepta unidad de otro curso', () => {
    const course = courseService.save({ code: 'BIO101', name: 'Biología', term: '2026-II', units: [{ title: 'La célula' }] });
    const first = interpretChat(full, EMPTY_CHAT_DRAFT).draft;
    const next = interpretChat('Curso: BIO101', first).draft;
    expect(next.courseId).toBe(course.id);
    expect(next.unitId).toBe('');
    expect(validateChatDraft({ ...next, unitId: 'u2' })).toContain('unidad');
  });
  it('no selecciona un curso desconocido ni una modalidad desconocida', () => {
    const first = interpretChat(full, EMPTY_CHAT_DRAFT).draft;
    expect(interpretChat('Curso: XX999; Modalidad: desconocida', first).draft).toMatchObject({ courseId: '', unitId: '', modalities: [] });
  });
  it('solicita aclaración ante cursos ambiguos', () => {
    courseService.save({ code: 'ICSI-206', name: 'Algoritmos y Estructuras de Datos', term: '2026-II', units: [{ title: 'Grafos' }] });
    const result = interpretChat('Curso: Algoritmos y Estructuras de Datos; Unidad: 2', EMPTY_CHAT_DRAFT);
    expect(result.draft.courseId).toBe('');
    expect(result.reply).toContain('único curso');
  });
});
