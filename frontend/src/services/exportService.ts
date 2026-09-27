/**
 * Exportación (HU-018, HU-019, TA-002).
 *
 * SIMULADA: no se genera ningún paquete QTI, SCORM ni Common Cartridge.
 * El flujo registra la solicitud y muestra qué pasos quedan pendientes.
 * Solo se aceptan recursos en estado «aprobado».
 *
 * Futuro: POST /exportaciones → paquete + resultado del validador de 1EdTech.
 */
import { EXPORT_FORMATS } from '../data/catalog';
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { AppState, ExportFormat, ExportJob, ExportStepId, Resource } from '../types';
import { ServiceError, wait } from './simulation';

export const EXPORT_STEPS: { id: ExportStepId; label: string; pendingNote: string }[] = [
  { id: 'seleccion', label: 'Selección de recursos aprobados', pendingNote: '' },
  { id: 'formato', label: 'Formato de destino', pendingNote: '' },
  { id: 'empaquetado', label: 'Construcción del paquete', pendingNote: 'Simulado: no se genera ningún archivo de paquete (HU-018, HU-019).' },
  { id: 'validacion', label: 'Validación de conformidad', pendingNote: 'Pendiente: requiere el validador QTI de 1EdTech y el exportador real (I16).' },
  { id: 'importacion', label: 'Importación en el LMS', pendingNote: 'Pendiente: los LMS objetivo dependen de SP-001; pruebas en TA-002 (I17, I18).' },
];

/** Única regla de exportabilidad: solo recursos aprobados explícitamente. */
export function exportableResources(resources: Resource[]): Resource[] {
  return resources.filter((r) => r.status === 'aprobado');
}

/** Problemas de compatibilidad entre la selección y el formato. */
export function formatIssues(format: ExportFormat, resources: Resource[]): string | null {
  const info = EXPORT_FORMATS.find((f) => f.id === format);
  if (!info) return 'Formato desconocido.';
  if (info.itemsOnly) {
    const nonItems = resources.filter((r) => r.type !== 'item_opcion_multiple');
    if (nonItems.length > 0)
      return `${info.name} solo admite ítems de opción múltiple. Quita ${nonItems.length} recurso(s) de otro tipo o elige SCORM o Common Cartridge.`;
  }
  return null;
}

export const exportService = {
  async runExport(
    input: { format: ExportFormat; resourceIds: string[]; targetLms: string },
    onStep?: (step: ExportStepId) => void,
  ): Promise<ExportJob> {
    const state = getState();
    if (input.resourceIds.length === 0) throw new ServiceError('Selecciona al menos un recurso aprobado.');
    const selected = input.resourceIds.map((id) => state.resources.find((r) => r.id === id));
    const exportable = new Set(exportableResources(state.resources).map((r) => r.id));
    if (selected.some((r) => !r || !exportable.has(r.id)))
      throw new ServiceError('La selección incluye recursos que no están aprobados. Solo se exporta lo aprobado.');
    const issue = formatIssues(input.format, selected as Resource[]);
    if (issue) throw new ServiceError(issue);

    onStep?.('seleccion');
    await wait(400);
    onStep?.('formato');
    await wait(400);
    onStep?.('empaquetado');
    await wait(1000);

    const job: ExportJob = {
      id: newId('exp'),
      format: input.format,
      resourceIds: [...input.resourceIds],
      targetLms: input.targetLms,
      createdAt: new Date().toISOString(),
      steps: { seleccion: 'completado', formato: 'completado', empaquetado: 'simulado', validacion: 'pendiente', importacion: 'pendiente' },
    };
    setState((s) => ({ ...s, exports: [job, ...s.exports] }));
    return job;
  },

  /** Resumen legible de la solicitud. NO es un paquete importable. */
  buildSummary(job: ExportJob, state: AppState): string {
    const resources = job.resourceIds
      .map((id) => state.resources.find((r) => r.id === id))
      .filter((r): r is Resource => Boolean(r));
    const summary = {
      advertencia:
        'RESUMEN DE DEMOSTRACIÓN. No es un paquete QTI, SCORM ni IMS Common Cartridge y no debe importarse en un LMS. La exportación y validación reales están pendientes.',
      solicitud: job.id,
      formato_solicitado: job.format,
      lms_objetivo: job.targetLms,
      fecha: job.createdAt,
      pasos: job.steps,
      recursos: resources.map((r) => ({
        id: r.id,
        unidad: r.unitId,
        resultado_aprendizaje: r.outcomeId,
        etapa_5e: r.stage,
        tipo: r.type,
        titulo: r.title,
        contenido: r.body,
        alternativas: r.options?.filter((o) => o.isCorrect || o.decision === 'aceptado').map((o) => ({
          texto: o.text,
          correcta: o.isCorrect,
          retroalimentacion: o.feedback,
        })),
        evidencia: r.citations,
        editado_por_docente: r.edited,
      })),
    };
    return JSON.stringify(summary, null, 2);
  },
};
