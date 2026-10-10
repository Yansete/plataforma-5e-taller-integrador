/**
 * Catálogo académico (curso, unidades, resultados de aprendizaje) y fragmentos.
 * SIMULADO: lee datos de demostración. Futuro: GET /cursos/{id}/unidades y GET /fragmentos?ids=…
 */
import { DEMO_FRAGMENTS } from '../data/demoContent';
import { getState } from '../store/store';
import type { Course, Fragment, LearningOutcome, Unit } from '../types';

export const catalogService = {
  getCourse(): Course {
    return getState().courses[0];
  },
  listCourses(): Course[] {
    return getState().courses;
  },
  listUnits(): Unit[] {
    return getState().units;
  },
  getUnit(unitId: string): Unit | undefined {
    return getState().units.find((u) => u.id === unitId);
  },
  getOutcome(outcomeId: string): LearningOutcome | undefined {
    for (const u of getState().units) {
      const found = u.outcomes.find((o) => o.id === outcomeId);
      if (found) return found;
    }
    return undefined;
  },
  getFragments(ids: string[]): Fragment[] {
    return ids
      .map((id) => [...(getState().apiFragments ?? []), ...DEMO_FRAGMENTS].find((f) => f.id === id))
      .filter((f): f is Fragment => Boolean(f));
  },
  documentName(documentId: string): string {
    return [...getState().documents, ...(getState().apiDocuments ?? [])].find((d) => d.id === documentId)?.fileName ?? documentId;
  },
  countFragmentsForUnit(unitId: string): number {
    return DEMO_FRAGMENTS.filter((f) => f.unitId === unitId).length;
  },
};

export function unitLabel(unitId: string): string {
  const u = catalogService.getUnit(unitId);
  return u ? `Unidad ${u.number}: ${u.title}` : 'Unidad desconocida';
}

export function unitShortLabel(unitId: string): string {
  const u = catalogService.getUnit(unitId);
  return u ? `Unidad ${u.number}` : '—';
}
