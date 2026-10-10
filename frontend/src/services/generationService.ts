/**
 * HU-053, EN-006 y HU-018: generación local (ejemplos preparados) o por HTTP.
 * En el servidor, si la unidad tiene material procesado, el backend recupera sus fragmentos y
 * redacta con IA o con reglas citándolos (RAG); si no, devuelve ejemplos de demostración.
 * La respuesta y sus fragmentos se validan antes de incorporarlos al store.
 * Los recursos siempre quedan pendientes de revisión docente.
 */
import { EXAMPLES } from '../data/demoContent';
import { getState, setState } from '../store/store';
import { instantiateExample, newId } from '../store/initialState';
import type { GenerationOutcome, GenerationRequest, Resource, ResourceType, Stage5E } from '../types';
import { GenerationApiError, requestGeneration } from './generationApiService';
import { wait } from './simulation';
import { SOLO_LOCAL } from '../config/despliegue';

export type GenerationPhase = 'recuperacion' | 'generacion' | 'verificacion' | 'solicitud_api';

export const PHASE_LABELS: Record<GenerationPhase, string> = {
  solicitud_api: 'Generando en el servidor (con IA puede tardar hasta un minuto)',
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

/** Completa los campos de versión de un recurso que llega sin ellos (API o estado guardado antes de HU-054). */
export function withVersionFields(r: Resource): Resource {
  return {
    ...r,
    version: r.version ?? 1,
    versionOrigin: r.versionOrigin ?? 'generada',
    previousVersions: Array.isArray(r.previousVersions) ? r.previousVersions : [],
  };
}

export const generationService = {
  async generate(
    input: Omit<GenerationRequest, 'id' | 'createdAt'>,
    onPhase?: (phase: GenerationPhase) => void,
  ): Promise<GenerationOutcome> {
    if (getState().ui.generationMode === 'api_demo' && !SOLO_LOCAL) {
      onPhase?.('solicitud_api');
      try {
        const data = await requestGeneration(input);
        // La API no maneja versiones: cada propuesta recibida es la versión 1 (HU-054).
        const received = data.resources.map(withVersionFields);
        // Se valida la respuesta completa antes de modificar el estado.
        setState((s) => ({ ...s,
          requests: [data.request, ...s.requests], resources: [...received, ...s.resources],
          apiFragments: [...data.fragments, ...(s.apiFragments ?? []).filter((f) => !data.fragments.some((n) => n.id === f.id))],
          apiDocuments: [...data.documents, ...(s.apiDocuments ?? []).filter((d) => !data.documents.some((n) => n.id === d.id))],
          ui: { ...s.ui, selectedResourceId: received[0].id, reviewFilters: { unitId: input.unitId, stage: input.stage, status: 'pendiente' } },
        }));
        return { kind: 'ok', created: received, skipped: 0, available: data.available, notice: data.mode === 'rag' ? data.notice : undefined };
      } catch (error) {
        return { kind: 'error', code: error instanceof GenerationApiError ? error.code : 'ERROR_GENERACION', message: error instanceof Error ? error.message : 'No se pudo completar la solicitud.' };
      }
    }
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

    // Incluye los ejemplos de versiones anteriores (HU-054) para no volver a proponerlos.
    const existing = new Set(getState().resources.flatMap((r) => [r.exampleId, ...r.previousVersions.map((v) => v.exampleId)]));
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
