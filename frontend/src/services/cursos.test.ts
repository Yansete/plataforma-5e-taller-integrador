/** Cursos: formulario, resultados de aprendizaje por línea y llamadas al servidor. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  courseFormProblem,
  courseRequest,
  courseToForm,
  createCourse,
  deleteCourse,
  emptyCourseForm,
  findUnit,
  listCourses,
  listSummary,
  outcomeLines,
  parseOutcomeLines,
  updateCourse,
} from './cursos';
import { course, mockFetch, unit } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('resultados de aprendizaje', () => {
  it('lee un resultado por línea y conserva el código escrito', () => {
    expect(parseOutcomeLines('RA1.2: Compara modelos\n\n  Explica capas  \nra 3) Calcula subredes')).toEqual([
      { code: 'RA1.2', text: 'Compara modelos' },
      { text: 'Explica capas' },
      { code: 'RA 3', text: 'Calcula subredes' },
    ]);
  });

  it('al editar conserva el id y el código de cada línea', () => {
    const previous = unit().outcomes;
    expect(parseOutcomeLines('Nuevo texto\nRA9.9: Otro', previous)).toEqual([
      { id: 'ra1', code: 'RA1.1', text: 'Nuevo texto' },
      { id: 'ra2', code: 'RA9.9', text: 'Otro' },
    ]);
    expect(outcomeLines(previous)).toBe(`RA1.1: ${previous[0].text}\nRA1.2: ${previous[1].text}`);
  });
});

describe('formulario del curso', () => {
  it('empieza con una unidad vacía y avisa lo que falta', () => {
    const form = emptyCourseForm();
    expect(form.units).toHaveLength(1);
    expect(courseFormProblem(form)).toMatch(/código/);
    expect(courseFormProblem({ ...form, code: 'A', name: 'B', term: 'C' })).toMatch(/título de cada unidad/);
    expect(courseFormProblem({ ...form, code: 'A', name: 'B', term: 'C', units: [] })).toMatch(/al menos una unidad/);
    expect(courseFormProblem({ ...form, code: 'A', name: 'B', term: 'C', units: [{ title: 'U1', outcomes: '' }] })).toBeNull();
  });

  it('convierte un curso en formulario y de vuelta en la petición', () => {
    const c = course({ sumilla: undefined, logro: undefined });
    const form = courseToForm(c);
    expect(form).toMatchObject({ code: 'RED-301', sumilla: '', logro: '', units: [{ id: 'u1', title: c.units[0].title }] });
    const request = courseRequest({ ...form, name: '  Redes  ', units: [...form.units, { title: ' Nueva ', outcomes: 'Calcula subredes' }] }, c);
    expect(request.name).toBe('Redes');
    expect(request.units[0]).toMatchObject({ id: 'u1', outcomes: [{ id: 'ra1', code: 'RA1.1' }, { id: 'ra2', code: 'RA1.2' }] });
    expect(request.units[1]).toEqual({ title: 'Nueva', outcomes: [{ text: 'Calcula subredes' }] });
  });

  it('busca una unidad entre los cursos', () => {
    expect(findUnit([course()], 'u1')?.unit.number).toBe(1);
    expect(findUnit([course()], 'otra')).toBeNull();
  });
});

describe('servidor', () => {
  it('lista, crea, edita y borra cursos', async () => {
    const c = course();
    const calls = mockFetch({ body: [c] }, { status: 201, body: c }, { body: c }, { status: 204 }, { body: [{ courseId: 'c1', unitId: 'u1', approved: 1, pending: 2 }] });
    expect(await listCourses()).toHaveLength(1);
    await createCourse(courseToForm(c));
    await updateCourse(c, courseToForm(c));
    await deleteCourse('c 1');
    expect((await listSummary())[0].pending).toBe(2);
    expect(calls.map((x) => `${x.method} ${x.url}`)).toEqual([
      'GET /api/v1/cursos',
      'POST /api/v1/cursos',
      'PUT /api/v1/cursos/c1',
      'DELETE /api/v1/cursos/c%201',
      'GET /api/v1/resumen',
    ]);
  });
});
