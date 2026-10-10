/** HU-045: catálogo editable local. Sustituir por API de cursos cuando exista. */
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { Course, Unit } from '../types';
export interface CourseInput { code: string; name: string; term: string; units: { id?: string; title: string }[] }
export const courseService = {
  save(input: CourseInput, id?: string): Course {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const term = input.term.trim();
    if (!code || !name || !term) throw new Error('Completa el código, nombre y periodo del curso.');
    if (!input.units.length || input.units.some((u) => !u.title.trim())) throw new Error('El curso necesita al menos una unidad y todas deben tener título.');
    const state = getState();
    const existing = id ? state.courses.find((c) => c.id === id) : undefined;
    if (id && !existing) throw new Error('El curso ya no está disponible.');
    if (state.courses.some((c) => c.id !== id && c.code.toUpperCase() === code)) throw new Error('Ya existe un curso con ese código.');
    const previous = state.units.filter((u) => u.courseId === id);
    const ids = input.units.flatMap((u) => u.id ? [u.id] : []);
    if (new Set(ids).size !== ids.length || ids.some((unitId) => !previous.some((u) => u.id === unitId))) throw new Error('Las unidades no corresponden al curso.');
    // No eliminar unidades con referencias a documentos o recursos del recorrido existente.
    if (previous.some((u) => !ids.includes(u.id))) throw new Error('Conserva las unidades existentes para mantener sus referencias.');
    const course: Course = { id: id ?? newId('curso'), code, name, term };
    let nextNumber = Math.max(0, ...previous.map((u) => u.number));
    const units: Unit[] = input.units.map((u) => ({
      id: u.id ?? newId('unidad'), courseId: course.id, number: previous.find((old) => old.id === u.id)?.number ?? ++nextNumber, title: u.title.trim(),
      outcomes: previous.find((old) => old.id === u.id)?.outcomes ?? [],
    }));
    setState((s) => ({ ...s, courses: existing ? s.courses.map((c) => c.id === id ? course : c) : [...s.courses, course], units: [...s.units.filter((u) => u.courseId !== course.id), ...units] }));
    return course;
  },
};
