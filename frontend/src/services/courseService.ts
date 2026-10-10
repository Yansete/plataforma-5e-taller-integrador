/** HU-045 y EP-002: cursos con sumilla, logro y unidades con sus resultados de aprendizaje (local o en el servidor). */
import { configurationFetch, refreshBackendCatalog, type ServerCourse } from './configurationApiService';
import { sessionService } from './sessionService';
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { Course, LearningOutcome, Unit } from '../types';

export interface OutcomeInput { id?: string; code?: string; text: string }
export interface UnitInput { id?: string; title: string; outcomes?: OutcomeInput[] }
export interface CourseInput { code: string; name: string; term: string; sumilla?: string; logro?: string; units: UnitInput[] }

const CODE_PREFIX = /^([A-Za-z]{1,4}[ -]?\d+(?:\.\d+)*)\s*[:.)-]\s+(.+)$/;

/** Una línea por resultado. «RA1.2: Compara modelos» conserva el código; sin código se numera solo. */
export function parseOutcomeLines(text: string, previous: LearningOutcome[] = []): OutcomeInput[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(CODE_PREFIX);
    const old = previous[index];
    return { ...(old ? { id: old.id } : {}), ...(match ? { code: match[1].toUpperCase() } : old ? { code: old.code } : {}), text: match ? match[2].trim() : line };
  });
}

/** Texto editable de los resultados de una unidad: «código: texto», uno por línea. */
export function outcomeLines(outcomes: LearningOutcome[]): string {
  return outcomes.map((o) => `${o.code}: ${o.text}`).join('\n');
}

function localOutcomes(input: OutcomeInput[] | undefined, previous: LearningOutcome[], unitNumber: number): LearningOutcome[] {
  if (!input) return previous;
  const used = new Set<string>();
  return input.filter((o) => o.text.trim()).map((o, index) => {
    const keep = o.id && previous.some((p) => p.id === o.id) && !used.has(o.id);
    const id = keep ? o.id! : newId('ra');
    used.add(id);
    return { id, code: o.code?.trim() || `RA${unitNumber}.${index + 1}`, text: o.text.trim().replace(/\s+/g, ' ') };
  });
}

export const courseService = {
  async saveConnected(input: CourseInput, id?: string): Promise<Course> {
    if (!sessionService.isBackend()) return this.save(input, id);
    const response = await configurationFetch(id ? `/cursos/${encodeURIComponent(id)}` : '/cursos', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const course: ServerCourse = await response.json();
    await refreshBackendCatalog();
    return course;
  },
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
    const course: Course = {
      id: id ?? newId('curso'), code, name, term,
      sumilla: input.sumilla?.trim() ?? existing?.sumilla ?? '',
      logro: input.logro?.trim() ?? existing?.logro ?? '',
    };
    let nextNumber = Math.max(0, ...previous.map((u) => u.number));
    const units: Unit[] = input.units.map((u) => {
      const old = previous.find((p) => p.id === u.id);
      const number = old?.number ?? ++nextNumber;
      return { id: u.id ?? newId('unidad'), courseId: course.id, number, title: u.title.trim(), outcomes: localOutcomes(u.outcomes, old?.outcomes ?? [], number) };
    });
    setState((s) => ({ ...s, courses: existing ? s.courses.map((c) => c.id === id ? course : c) : [...s.courses, course], units: [...s.units.filter((u) => u.courseId !== course.id), ...units] }));
    return course;
  },
};
