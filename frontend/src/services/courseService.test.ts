import { beforeEach, describe, expect, it } from 'vitest';
import { courseService, outcomeLines, parseOutcomeLines } from './courseService';
import { getState, resetState } from '../store/store';
describe('HU-045 integridad del catálogo', () => {
  beforeEach(resetState);
  it('rechaza código duplicado y unidad vacía sin alterar el catálogo', () => {
    const initial = getState();
    const input = { code: initial.courses[0].code, name: 'Duplicado', term: '2026-II', units: [{ title: 'Unidad' }] };
    expect(() => courseService.save(input)).toThrow('Ya existe');
    expect(() => courseService.save({ ...input, code: 'NUEVO', units: [{ title: ' ' }] })).toThrow('título');
    expect(getState()).toBe(initial);
  });
  it('la edición conserva los ids y resultados de aprendizaje de las unidades existentes', () => {
    const state = getState();
    const course = state.courses[0];
    const units = state.units.filter((u) => u.courseId === course.id);
    courseService.save({ ...course, name: 'Actualizado', units: units.map((u) => ({ id: u.id, title: u.title + ' actualizado' })) }, course.id);
    expect(getState().units.map((u) => u.id)).toEqual(units.map((u) => u.id));
    expect(getState().units[0].outcomes).toEqual(units[0].outcomes);
  });
});

describe('Sumilla, logro y resultados de aprendizaje (asesoría del 10/10)', () => {
  beforeEach(resetState);
  it('lee una línea por resultado y conserva códigos e ids existentes', () => {
    const previos = [{ id: 'ra-a', code: 'RA1.1', text: 'Antes' }];
    expect(parseOutcomeLines('RA2.3: Compara OSI y TCP/IP\n\n  Distingue TCP y UDP  ', previos)).toEqual([
      { id: 'ra-a', code: 'RA2.3', text: 'Compara OSI y TCP/IP' },
      { text: 'Distingue TCP y UDP' },
    ]);
    expect(parseOutcomeLines('Texto sin código', previos)).toEqual([{ id: 'ra-a', code: 'RA1.1', text: 'Texto sin código' }]);
    expect(outcomeLines(previos)).toBe('RA1.1: Antes');
  });
  it('un curso nuevo guarda sumilla, logro y numera los resultados', () => {
    const course = courseService.save({ code: 'red-101', name: 'Redes', term: '2026-II', sumilla: ' Curso de redes ', logro: 'Explica redes',
      units: [{ title: 'Protocolos', outcomes: [{ text: 'Distingue TCP y UDP' }, { code: 'RA-X', text: 'Compara OSI' }, { text: ' ' }] }] });
    expect(course).toMatchObject({ code: 'RED-101', sumilla: 'Curso de redes', logro: 'Explica redes' });
    const unit = getState().units.find((u) => u.courseId === course.id)!;
    expect(unit.outcomes.map((o) => [o.code, o.text])).toEqual([['RA1.1', 'Distingue TCP y UDP'], ['RA-X', 'Compara OSI']]);
  });
});
