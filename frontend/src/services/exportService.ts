/**
 * Exportación (HU-054, ADR-005; antes HU-018 y HU-019).
 *
 * Formatos de SP-003: Moodle XML para Moodle y QTI 2.1 (ZIP) para Chamilo.
 * En el prototipo el archivo se arma en el navegador con plantillas fijas (exportFormats.ts);
 * la validación con el LMS y la importación real quedan pendientes (TA-006).
 * Solo se aceptan recursos en estado «aprobado».
 *
 * Futuro (EN-022): POST /api/v1/exportaciones → el backend genera el mismo archivo.
 */
import { EXPORT_FORMATS, TARGET_LMS_OPTIONS } from '../data/catalog';
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { AppState, ExportFormat, ExportJob, ExportStepId, Resource, TargetLms } from '../types';
import { buildMoodleXml, buildQti21Package } from './exportFormats';
import { ServiceError, wait } from './simulation';

export const EXPORT_STEPS: { id: ExportStepId; label: string; pendingNote: string }[] = [
  { id: 'seleccion', label: 'Selección de recursos aprobados', pendingNote: '' },
  { id: 'formato', label: 'Formato de destino', pendingNote: '' },
  { id: 'empaquetado', label: 'Construcción del archivo', pendingNote: 'Generado en el navegador con plantillas fijas (ADR-005). En la integración lo generará el backend (EN-022).' },
  { id: 'validacion', label: 'Validación de conformidad', pendingNote: 'Pendiente: validar con el validador de Moodle XML del backend y con Chamilo (TA-006).' },
  { id: 'importacion', label: 'Importación en el LMS', pendingNote: 'Pendiente: importar en instancias reales de Moodle y Chamilo (TA-006, I17).' },
];

/** Única regla de exportabilidad: solo recursos aprobados explícitamente. */
export function exportableResources(resources: Resource[]): Resource[] {
  return resources.filter((r) => r.status === 'aprobado');
}

/** Formato que importa cada plataforma (SP-003). */
export function formatForLms(lms: TargetLms): ExportFormat {
  return TARGET_LMS_OPTIONS.find((o) => o.id === lms)?.format ?? 'moodle_xml';
}

/** Problemas de compatibilidad entre la selección y el formato. */
export function formatIssues(format: ExportFormat, resources: Resource[]): string | null {
  const info = EXPORT_FORMATS.find((f) => f.id === format);
  if (!info) return 'Formato desconocido. Elige Moodle XML (Moodle) o QTI 2.1 (Chamilo).';
  if (info.itemsOnly) {
    const nonItems = resources.filter((r) => r.type !== 'item_opcion_multiple');
    if (nonItems.length > 0)
      return `${info.name} solo admite ítems de opción múltiple. Quita ${nonItems.length} recurso(s) de otro tipo o descárgalos con «Descargar secuencia (.html)».`;
  }
  return null;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function exportFileName(format: ExportFormat, date: Date, courseCode = 'curso'): string {
  const info = EXPORT_FORMATS.find((f) => f.id === format)!;
  const stamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `plataforma5e-${slug(courseCode)}-${info.lms}-${stamp}.${info.extension}`;
}

export interface ExportFile {
  fileName: string;
  mimeType: string;
  data: string | Uint8Array;
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
    const expectedLms = EXPORT_FORMATS.find((f) => f.id === input.format)!.lms;
    if (input.targetLms !== expectedLms)
      throw new ServiceError(`${input.targetLms === 'chamilo' ? 'Chamilo' : 'Moodle'} no importa este formato. Usa ${input.targetLms === 'chamilo' ? 'QTI 2.1' : 'Moodle XML'}.`);

    onStep?.('seleccion');
    await wait(400);
    onStep?.('formato');
    await wait(400);
    onStep?.('empaquetado');
    await wait(800);

    const now = new Date();
    const job: ExportJob = {
      id: newId('exp'),
      format: input.format,
      resourceIds: [...input.resourceIds],
      targetLms: input.targetLms,
      createdAt: now.toISOString(),
      steps: { seleccion: 'completado', formato: 'completado', empaquetado: 'completado', validacion: 'pendiente', importacion: 'pendiente' },
      fileName: exportFileName(input.format, now, state.courses[0]?.code),
    };
    setState((s) => ({ ...s, exports: [job, ...s.exports] }));
    return job;
  },

  /**
   * Archivo del trabajo de exportación, con el contenido VIGENTE de los recursos.
   * Los trabajos de versiones anteriores del prototipo (QTI 3.0, SCORM…) no tienen archivo.
   */
  buildFile(job: ExportJob, state: AppState): ExportFile {
    const resources = job.resourceIds
      .map((id) => state.resources.find((r) => r.id === id))
      .filter((r): r is Resource => Boolean(r));
    if (resources.length === 0) throw new ServiceError('Los recursos de esta exportación ya no existen.');
    if (resources.some((r) => r.status !== 'aprobado'))
      throw new ServiceError('Algún recurso de esta exportación volvió a revisión. Apruébalo de nuevo y repite la exportación.');
    const fileName = job.fileName ?? exportFileName(job.format, new Date(job.createdAt), state.courses[0]?.code);
    if (job.format === 'moodle_xml') {
      return { fileName, mimeType: 'application/xml', data: buildMoodleXml(resources, state.courses[0]?.name ?? 'Plataforma 5E') };
    }
    if (job.format === 'qti21') {
      return { fileName, mimeType: 'application/zip', data: buildQti21Package(resources) };
    }
    throw new ServiceError('Este registro es de un formato que ya no se usa (QTI 3.0, SCORM o Common Cartridge) y no tiene archivo.');
  },
};
