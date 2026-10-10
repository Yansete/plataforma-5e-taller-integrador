/**
 * Descargas de la unidad: arma el archivo de cada formato con los recursos aprobados que el docente
 * eligió y lleva el historial en el servidor (se puede borrar).
 */
import { apiFetch } from './api';
import { buildMoodleXml, buildQti21Package } from './exportFormats';
import { buildUnitDocument } from './documento';
import type { Course, Download, DownloadFormat, Resource, Unit } from '../types';

export interface FormatInfo {
  id: DownloadFormat;
  title: string;
  description: string;
  extension: 'xml' | 'zip' | 'html';
  mimeType: string;
  /** Moodle y Chamilo solo importan preguntas de opción múltiple. */
  onlyQuestions: boolean;
  /** Cómo usar el archivo. */
  howTo: string;
}

export const FORMATS: FormatInfo[] = [
  {
    id: 'moodle_xml',
    title: 'Moodle',
    description: 'Banco de preguntas en formato Moodle XML.',
    extension: 'xml',
    mimeType: 'application/xml',
    onlyQuestions: true,
    howTo: 'En Moodle: Banco de preguntas › Importar › Formato Moodle XML.',
  },
  {
    id: 'qti21',
    title: 'Chamilo',
    description: 'Paquete QTI 2.1 comprimido, el formato que pide Chamilo.',
    extension: 'zip',
    mimeType: 'application/zip',
    onlyQuestions: true,
    howTo: 'En Chamilo: Ejercicios › Importar QTI2.',
  },
  {
    id: 'documento',
    title: 'Documento de la unidad',
    description: 'Todos los recursos aprobados, en el orden de la clase y con su evidencia. Para imprimir o compartir.',
    extension: 'html',
    mimeType: 'text/html',
    onlyQuestions: false,
    howTo: 'Se abre en cualquier navegador y se puede guardar como PDF.',
  },
];

const SUFFIX: Record<DownloadFormat, string> = { moodle_xml: 'moodle', qti21: 'chamilo', documento: 'documento' };

export function formatInfo(id: DownloadFormat): FormatInfo {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

/** Texto apto para nombre de archivo: minúsculas, sin tildes ni espacios. */
export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** «red-301-unidad-1-moodle.xml»: el curso y la unidad de donde salen los recursos. */
export function fileNameFor(course: Pick<Course, 'code'>, unit: Pick<Unit, 'number'>, format: DownloadFormat): string {
  return `${slug(course.code) || 'curso'}-unidad-${unit.number}-${SUFFIX[format]}.${formatInfo(format).extension}`;
}

export function isQuestion(resource: Resource): boolean {
  return Boolean(resource.options?.length);
}

/** Recursos que entran en el archivo del formato elegido. */
export function resourcesFor(format: DownloadFormat, selected: Resource[]): Resource[] {
  const approved = selected.filter((r) => r.status === 'aprobado');
  return formatInfo(format).onlyQuestions ? approved.filter(isQuestion) : approved;
}

export interface BuiltFile {
  fileName: string;
  mimeType: string;
  data: string | Uint8Array;
  resourceCount: number;
}

export function buildFile(format: DownloadFormat, selected: Resource[], course: Course, unit: Unit, date = new Date()): BuiltFile {
  const resources = resourcesFor(format, selected);
  const info = formatInfo(format);
  const fileName = fileNameFor(course, unit, format);
  const label = `${course.code} · Unidad ${unit.number}`;
  let data: string | Uint8Array;
  if (format === 'moodle_xml') data = buildMoodleXml(resources, label);
  else if (format === 'qti21') data = buildQti21Package(resources, `${slug(course.code)}-unidad-${unit.number}`);
  else data = buildUnitDocument(resources, course, unit, date);
  return { fileName, mimeType: info.mimeType, data, resourceCount: resources.length };
}

/* ——— Historial en el servidor ——— */

const base = (unitId: string) => `/api/v1/unidades/${encodeURIComponent(unitId)}/descargas`;

export const listDownloads = (unitId: string) => apiFetch<Download[]>(base(unitId));

export const registerDownload = (unitId: string, file: Pick<BuiltFile, 'fileName' | 'resourceCount'>, format: DownloadFormat) =>
  apiFetch<Download>(base(unitId), { method: 'POST', json: { format, fileName: file.fileName, resourceCount: file.resourceCount } });

export const clearDownloads = (unitId: string) => apiFetch<void>(base(unitId), { method: 'DELETE' });
