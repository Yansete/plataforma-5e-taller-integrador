/**
 * Catálogo académico (curso, unidades, resultados de aprendizaje) y fragmentos.
 * SIMULADO: lee datos de demostración. Futuro: GET /cursos/{id}/unidades y GET /fragmentos?ids=…
 */
import { DEMO_COURSE, DEMO_DOCUMENTS, DEMO_FRAGMENTS, DEMO_UNITS } from '../data/demoContent';
import type { Course, Fragment, LearningOutcome, Unit } from '../types';

export const catalogService = {
  getCourse(): Course {
    return DEMO_COURSE;
  },
  listUnits(): Unit[] {
    return DEMO_UNITS;
  },
  getUnit(unitId: string): Unit | undefined {
    return DEMO_UNITS.find((u) => u.id === unitId);
  },
  getOutcome(outcomeId: string): LearningOutcome | undefined {
    for (const u of DEMO_UNITS) {
      const found = u.outcomes.find((o) => o.id === outcomeId);
      if (found) return found;
    }
    return undefined;
  },
  getFragments(ids: string[]): Fragment[] {
    return ids
      .map((id) => DEMO_FRAGMENTS.find((f) => f.id === id))
      .filter((f): f is Fragment => Boolean(f));
  },
  documentName(documentId: string): string {
    return DEMO_DOCUMENTS.find((d) => d.id === documentId)?.fileName ?? documentId;
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
