import { beforeEach, describe, expect, it } from 'vitest';
import { courseService } from './courseService';
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
