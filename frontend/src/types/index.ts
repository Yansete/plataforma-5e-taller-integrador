/**
 * Modelos de datos del frontend.
 *
 * Son una PROPUESTA alineada con el backlog (EN-002, EN-003, EN-006, HU-002 a HU-021).
 * Los contratos oficiales (EN-003) aún no existen: cuando el backend los publique,
 * estos tipos deben ajustarse a ellos. Ver docs/integracion-backend.md.
 */

/** Etapas del modelo instruccional 5E (Bybee et al., 2006). */
export type Stage5E = 'engage' | 'explore' | 'explain' | 'elaborate' | 'evaluate';

export interface Course {
  id: string;
  code: string;
  name: string;
  term: string;
}

export interface LearningOutcome {
  id: string;
  code: string;
  text: string;
}

export interface Unit {
  id: string;
  courseId: string;
  number: number;
  title: string;
  outcomes: LearningOutcome[];
}

export type FileKind = 'pdf' | 'pptx' | 'txt';

/**
 * Estado de un documento en el flujo de ingesta.
 * - `seleccionado`: solo existe en el navegador (no se guarda).
 * - `registrado`: sus metadatos se guardaron; aún no se procesa.
 * - `procesando`: procesamiento SIMULADO en curso.
 * - `procesado`: procesamiento completado (simulado o, en los documentos de demostración, precargado).
 * - `error`: el procesamiento simulado falló.
 */
export type DocumentStatus = 'registrado' | 'procesando' | 'procesado' | 'error';

export type ProcessingStep = 'extraccion' | 'segmentacion' | 'vectorizacion';

/** Metadatos de un documento del docente. Nunca contiene el archivo en sí. */
export interface MaterialDocument {
  id: string;
  fileName: string;
  kind: FileKind;
  sizeBytes: number;
  unitId: string;
  outcomeIds: string[];
  documentType: string;
  suggestedStage: Stage5E | null;
  usePermission: boolean;
  status: DocumentStatus;
  currentStep: ProcessingStep | null;
  registeredAt: string;
  processedAt: string | null;
  /** Fragmentos disponibles para recuperación. En documentos del usuario es 0: la extracción real está pendiente. */
  fragmentCount: number;
  pageCount: number | null;
  errorMessage: string | null;
  /** true si pertenece al conjunto de demostración precargado. */
  isDemo: boolean;
}

/** Fragmento (chunk) recuperable del material. En esta etapa son textos de demostración. */
export interface Fragment {
  id: string;
  documentId: string;
  /** Página o diapositiva de origen (HU-002). */
  location: string;
  text: string;
  unitId: string;
  outcomeId: string;
}

export type ResourceType =
  | 'pregunta_detonante'
  | 'sondeo_diagnostico'
  | 'guia_exploracion'
  | 'caso_indagacion'
  | 'explicacion'
  | 'glosario'
  | 'ejercicio_aplicacion'
  | 'item_opcion_multiple';

/** Afirmación del recurso con los fragmentos que la sustentan (HU-006). */
export interface Citation {
  claim: string;
  fragmentIds: string[];
}

export type DistractorDecision = 'pendiente' | 'aceptado' | 'descartado';

export type DiscardReason =
  | 'sin_sentido'
  | 'tambien_correcto'
  | 'duplicado'
  | 'fuera_de_unidad'
  | 'otro';

export interface ItemOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
  /** Fragmento del que se originó la alternativa (HU-009). */
  sourceFragmentIds: string[];
  /** Solo aplica a distractores. La clave no se decide por separado. */
  decision: DistractorDecision;
  discardReason: DiscardReason | null;
  edited: boolean;
  /** Advertencia simulada del filtro de fiabilidad (HU-015). */
  reliabilityWarning: string | null;
}

export type ReviewStatus = 'pendiente' | 'aprobado' | 'descartado';

export interface Resource {
  /** HU-053: origen explícito de las propuestas recibidas por HTTP. */
  source?: "api_demo";
  id: string;
  /** Identificador del ejemplo preparado del que proviene (evita duplicados). */
  exampleId: string;
  requestId: string;
  unitId: string;
  outcomeId: string;
  stage: Stage5E;
  type: ResourceType;
  title: string;
  /** Contenido principal. En ítems es el enunciado. Párrafos separados por línea en blanco. */
  body: string;
  options: ItemOption[] | null;
  citations: Citation[];
  status: ReviewStatus;
  /** true si el docente modificó el contenido (afecta a I2: aceptación sin edición). */
  edited: boolean;
  discardReason: DiscardReason | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
}

export type ReviewAction =
  | 'aprobar'
  | 'descartar'
  | 'editar'
  | 'revertir'
  | 'aceptar_distractor'
  | 'descartar_distractor'
  | 'editar_distractor'
  | 'revertir_distractor';

/** Registro de decisiones de revisión (EN-006). */
export interface ReviewLogEntry {
  id: string;
  resourceId: string;
  optionId: string | null;
  action: ReviewAction;
  reason: DiscardReason | null;
  user: string;
  at: string;
}

export type Difficulty = 'basica' | 'intermedia' | 'avanzada';

export interface GenerationRequest {
  id: string;
  unitId: string;
  /** `null` = todos los resultados de aprendizaje de la unidad. */
  outcomeId: string | null;
  stage: Stage5E;
  resourceType: ResourceType;
  quantity: number;
  difficulty: Difficulty;
  optionCount: number;
  topK: number;
  evidenceThreshold: number;
  instructions: string;
  /** HU-046: contexto confirmado por el docente; efecto pedagógico pendiente de RAG. */
  audience?: string;
  competency?: string;
  modalities?: string[];
  createdAt: string;
}

export type GenerationOutcome =
  | { kind: 'ok'; created: Resource[]; skipped: number; available: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'rechazado'; code: 'EVIDENCIA_INSUFICIENTE' | 'SIN_MATERIAL_PROCESADO'; message: string };

export type ExportFormat = 'qti30' | 'scorm' | 'common_cartridge' | 'moodle_xml' | 'gift';

export type ExportStepId = 'seleccion' | 'formato' | 'empaquetado' | 'validacion' | 'importacion';

export type ExportStepStatus = 'completado' | 'simulado' | 'pendiente';

export interface ExportJob {
  id: string;
  format: ExportFormat;
  resourceIds: string[];
  targetLms: string;
  createdAt: string;
  steps: Record<ExportStepId, ExportStepStatus>;
}

/** Selecciones que se conservan entre pantallas y recargas. */
export interface UiPreferences {
  generationMode?: "local" | "api_demo";
  config: Partial<Omit<GenerationRequest, 'id' | 'createdAt'>>;
  reviewFilters: { unitId: string; stage: Stage5E | 'todas'; status: ReviewStatus | 'todos' };
  selectedResourceId: string | null;
  exportSelection: string[];
  exportFormat: ExportFormat;
  exportTargetLms: string;
  dashboardFilters: { unitId: string; period: DashboardPeriod; scope: 'tablero' | 'todos' };
  uploadDefaults: { unitId: string };
}

export type DashboardPeriod = 'todo' | '7dias' | 'hoy';

export interface AppState {
  apiFragments?: Fragment[];
  apiDocuments?: MaterialDocument[];
  version: number;
  courses: Course[];
  units: Unit[];
  documents: MaterialDocument[];
  resources: Resource[];
  reviewLog: ReviewLogEntry[];
  requests: GenerationRequest[];
  exports: ExportJob[];
  ui: UiPreferences;
}

/** Origen del valor de un indicador en el tablero. */
export type IndicatorSource = 'local' | 'demo' | 'pendiente';

export interface IndicatorDefinition {
  code: string;
  name: string;
  definition: string;
  goalText: string;
  instrument: string;
  moment: string;
  /** Meta marcada con (*) en S2: propuesta del equipo, se recalibra con la línea base. */
  provisionalGoal: boolean;
  /** Indicadores que HU-021 exige en el tablero. */
  inDashboard: boolean;
  unit: '%' | 'min' | 'ratio' | 'num' | 'escala';
  /** Comparación con la meta: >= (mayor es mejor), <= (menor es mejor) o rango. */
  goal: { op: '>=' | '<='; value: number } | { op: 'rango'; min: number; max: number } | null;
}

export interface IndicatorValue {
  code: string;
  source: IndicatorSource;
  value: number | null;
  /** Texto del valor listo para mostrar. */
  display: string;
  /** Detalle del cálculo (numerador / denominador) o explicación. */
  detail: string;
  meetsGoal: boolean | null;
}
