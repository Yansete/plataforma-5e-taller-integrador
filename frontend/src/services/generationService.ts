/**
 * Generación de recursos (HU-005 a HU-009, HU-011 a HU-014).
 *
 * SIMULADA: no hay recuperación ni modelo de lenguaje. Se entregan EJEMPLOS PREPARADOS
 * que coinciden con la unidad, la etapa, el tipo de recurso y el resultado de aprendizaje.
 * Todo recurso entra a la cola de revisión en estado «pendiente».
 *
 * Futuro: POST /generaciones con el contrato de EN-003; respuesta con recursos o código de rechazo.
 */
import { EXAMPLES } from '../data/demoContent';
import { getState, setState } from '../store/store';
import { instantiateExample, newId } from '../store/initialState';
import type { GenerationOutcome, GenerationRequest, ResourceType, Stage5E } from '../types';
import { wait } from './simulation';

export type GenerationPhase = 'recuperacion' | 'generacion' | 'verificacion';

export const PHASE_LABELS: Record<GenerationPhase, string> = {
  recuperacion: 'Recuperando evidencia del material',
  generacion: 'Redactando propuestas',
  verificacion: 'Verificando anclaje a la evidencia',
};

export function availableExamples(unitId: string, stage: Stage5E, type: ResourceType, outcomeId: string | null) {
  return EXAMPLES.filter(
    (e) => e.unitId === unitId && e.stage === stage && e.type === type && (outcomeId === null || e.outcomeId === outcomeId),
  );
}

/** Documentos con fragmentos utilizables en la unidad (solo los de demostración los tienen). */
export function unitHasUsableMaterial(unitId: string): boolean {
  return getState().documents.some((d) => d.unitId === unitId && d.status === 'procesado' && d.fragmentCount > 0);
}

export const generationService = {
  async generate(
    input: Omit<GenerationRequest, 'id' | 'createdAt'>,
    onPhase?: (phase: GenerationPhase) => void,
  ): Promise<GenerationOutcome> {
    const request: GenerationRequest = { ...input, id: newId('sol'), createdAt: new Date().toISOString() };

    onPhase?.('recuperacion');
    await wait(900);
    if (!unitHasUsableMaterial(input.unitId)) {
      return {
        kind: 'rechazado',
        code: 'SIN_MATERIAL_PROCESADO',
        message:
          'La unidad no tiene material con fragmentos disponibles. El material que registres se procesa de forma simulada y no produce fragmentos: la extracción real está pendiente (HU-002).',
      };
    }

    const candidates = availableExamples(input.unitId, input.stage, input.resourceType, input.outcomeId);
    onPhase?.('generacion');
    await wait(1100);
    if (candidates.length === 0) {
      return {
        kind: 'rechazado',
        code: 'EVIDENCIA_INSUFICIENTE',
        message:
          'La demostración no tiene ejemplos preparados para esta combinación. En el sistema real, el motor rechazaría la generación si la evidencia recuperada no alcanza el umbral (HU-007).',
      };
    }

    onPhase?.('verificacion');
    await wait(700);

    const existing = new Set(getState().resources.map((r) => r.exampleId));
    const fresh = candidates.filter((e) => !existing.has(e.exampleId));
    const chosen = fresh.slice(0, Math.max(0, input.quantity));
    const now = new Date().toISOString();
    const created = chosen.map((e) => instantiateExample(e, request.id, now));

    setState((s) => ({
      ...s,
      requests: [request, ...s.requests],
      resources: [...created, ...s.resources],
      ui: { ...s.ui, selectedResourceId: created[0]?.id ?? s.ui.selectedResourceId },
    }));

    return { kind: 'ok', created, skipped: candidates.length - fresh.length, available: candidates.length };
  },
};
