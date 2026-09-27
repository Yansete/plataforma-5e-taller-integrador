/**
 * Catálogos fijos: etapas 5E, tipos de recurso, formatos y motivos.
 * Las descripciones de etapas y recursos provienen del Anexo A del Project Charter.
 */
import type { DiscardReason, ExportFormat, ResourceType, Stage5E } from '../types';

export interface StageInfo {
  id: Stage5E;
  name: string;
  english: string;
  intent: string;
  owner: string;
}

export const STAGES: StageInfo[] = [
  {
    id: 'engage',
    name: 'Enganchar',
    english: 'Engage',
    intent: 'Activar ideas previas y generar disconformidad cognitiva que motive la indagación.',
    owner: 'Juan Alegria',
  },
  {
    id: 'explore',
    name: 'Explorar',
    english: 'Explore',
    intent: 'Permitir la manipulación de casos, datos y ejemplos antes de la formalización conceptual.',
    owner: 'Yan Liu Dai',
  },
  {
    id: 'explain',
    name: 'Explicar',
    english: 'Explain',
    intent: 'Formalizar el concepto con lenguaje disciplinar preciso y trazable a la fuente.',
    owner: 'Juan Alegria',
  },
  {
    id: 'elaborate',
    name: 'Elaborar',
    english: 'Elaborate',
    intent: 'Transferir el concepto a situaciones nuevas y contextos de aplicación.',
    owner: 'Sergio Celi',
  },
  {
    id: 'evaluate',
    name: 'Evaluar',
    english: 'Evaluate',
    intent: 'Verificar el logro del resultado de aprendizaje con evidencia psicométrica.',
    owner: 'Silvana Diaz',
  },
];

export const stageName = (id: Stage5E): string => STAGES.find((s) => s.id === id)?.name ?? id;

export interface ResourceTypeInfo {
  id: ResourceType;
  name: string;
  stage: Stage5E;
  story: string;
}

export const RESOURCE_TYPES: ResourceTypeInfo[] = [
  { id: 'pregunta_detonante', name: 'Pregunta detonante', stage: 'engage', story: 'HU-012' },
  { id: 'sondeo_diagnostico', name: 'Sondeo diagnóstico de ideas previas', stage: 'engage', story: 'HU-012' },
  { id: 'guia_exploracion', name: 'Guía de exploración', stage: 'explore', story: 'HU-013' },
  { id: 'caso_indagacion', name: 'Caso con preguntas de indagación', stage: 'explore', story: 'HU-013' },
  { id: 'explicacion', name: 'Explicación citada', stage: 'explain', story: 'HU-011' },
  { id: 'glosario', name: 'Glosario de la unidad', stage: 'explain', story: 'HU-011' },
  { id: 'ejercicio_aplicacion', name: 'Ejercicio de aplicación', stage: 'elaborate', story: 'HU-017' },
  { id: 'item_opcion_multiple', name: 'Ítem de opción múltiple', stage: 'evaluate', story: 'HU-008' },
];

export const resourceTypeName = (id: ResourceType): string =>
  RESOURCE_TYPES.find((t) => t.id === id)?.name ?? id;

export const DISCARD_REASONS: { id: DiscardReason; label: string }[] = [
  { id: 'sin_sentido', label: 'Sin sentido o implausible' },
  { id: 'tambien_correcto', label: 'También es correcto' },
  { id: 'duplicado', label: 'Duplicado o casi idéntico' },
  { id: 'fuera_de_unidad', label: 'Fuera del alcance de la unidad' },
  { id: 'otro', label: 'Otro motivo' },
];

export const discardReasonLabel = (id: DiscardReason | null): string =>
  DISCARD_REASONS.find((r) => r.id === id)?.label ?? 'Sin motivo';

export interface ExportFormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  /** true si el formato solo admite ítems de opción múltiple. */
  itemsOnly: boolean;
  role: 'principal' | 'respaldo';
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'qti30',
    name: 'QTI 3.0',
    description: 'Intercambio de ítems de evaluación (HU-018). Solo admite ítems de opción múltiple.',
    itemsOnly: true,
    role: 'principal',
  },
  {
    id: 'scorm',
    name: 'SCORM',
    description: 'Paquete con material y evaluación de la secuencia (HU-019).',
    itemsOnly: false,
    role: 'principal',
  },
  {
    id: 'common_cartridge',
    name: 'IMS Common Cartridge',
    description: 'Paquete con material y evaluación de la secuencia (HU-019).',
    itemsOnly: false,
    role: 'principal',
  },
  {
    id: 'moodle_xml',
    name: 'Moodle XML',
    description: 'Exportador nativo de respaldo previsto en el Project Charter. Solo ítems.',
    itemsOnly: true,
    role: 'respaldo',
  },
  {
    id: 'gift',
    name: 'GIFT',
    description: 'Exportador nativo de respaldo previsto en el Project Charter. Solo ítems.',
    itemsOnly: true,
    role: 'respaldo',
  },
];

export const exportFormatName = (id: ExportFormat): string =>
  EXPORT_FORMATS.find((f) => f.id === id)?.name ?? id;

/**
 * Los LMS objetivo NO están definidos: dependen del spike SP-001 (matriz de compatibilidad).
 * Por eso la lista solo ofrece una opción genérica.
 */
export const TARGET_LMS_OPTIONS = [
  { id: 'por_definir', label: 'LMS objetivo por definir (pendiente de SP-001)' },
];

export const DOCUMENT_TYPES = [
  'Separata o apuntes de clase',
  'Diapositivas de clase',
  'Guía de práctica',
  'Sílabo de la unidad',
  'Transcripción de clase',
];

export const ACCEPTED_EXTENSIONS: Record<string, 'pdf' | 'pptx' | 'txt'> = {
  pdf: 'pdf',
  pptx: 'pptx',
  txt: 'txt',
};

/** Límite de tamaño PROPUESTO para la demostración; los documentos no lo fijan. */
export const MAX_FILE_SIZE_MB = 25;
