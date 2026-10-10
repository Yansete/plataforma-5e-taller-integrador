/**
 * Modelos de datos del frontend.
 *
 * Son una PROPUESTA alineada con el backlog (EN-002, EN-003, EN-006, HU-002 a HU-021).
 * Los contratos 5E del backend y OpenAPI se documentan en docs/arquitectura.md.
 * Las ampliaciones de estos tipos deben acordarse con esos contratos.
 */

/** Etapas del modelo instruccional 5E (Bybee et al., 2006). */
export type Stage5E = 'engage' | 'explore' | 'explain' | 'elaborate' | 'evaluate';

export interface Course {
  id: string;
  code: string;
  name: string;
  term: string;
  /** Sumilla oficial del curso. La generación la usa como contexto. */
  sumilla?: string;
  /** Logro de aprendizaje del curso. */
  logro?: string;
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
  source?: 'backend';
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
  /** Fragmentos disponibles para recuperación. En modo servidor los calcula el backend al procesar el archivo. */
  fragmentCount: number;
  pageCount: number | null;
  errorMessage: string | null;
  /** true si pertenece al conjunto de demostración precargado. */
  isDemo: boolean;
  /** Material creado desde un tema: fuente abierta, enlace y licencia. */
  origin?: { fuente: string; url: string; licencia: string; tema: string };
}

/** Fragmento (chunk) recuperable del material: de demostración o extraído del material real. */
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

/**
 * Versión anterior de un recurso (HU-054). Al regenerar, la versión vigente se guarda aquí
 * para que el docente pueda compararla o restaurarla.
 */
export interface ResourceVersion {
  number: number;
  /** Ejemplo preparado del que salió esta versión (solo en la demostración). */
  exampleId: string;
  title: string;
  body: string;
  options: ItemOption[] | null;
  citations: Citation[];
  /** `generada`: la primera propuesta; `regenerada`: pedida con el botón Regenerar. */
  origin: 'generada' | 'regenerada';
  edited: boolean;
  createdAt: string;
  /** Origen del contenido de esa versión: ejemplos de la API, material real (rag) o ejemplo local. */
  source?: ResourceSource;
}

/** `api_demo`: ejemplo preparado del backend. `rag`: generado a partir del material real del docente. */
export type ResourceSource = 'api_demo' | 'rag';

export interface Resource {
  /** HU-053: origen explícito de las propuestas recibidas por HTTP. */
  source?: ResourceSource;
  /** Generador que redactó la propuesta (modelo de IA o reglas). Solo en `rag`. */
  generator?: string;
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
  /** Número de la versión vigente (1 = primera propuesta). HU-054. */
  version: number;
  /** Cómo se obtuvo la versión vigente. */
  versionOrigin: 'generada' | 'regenerada';
  /** Versiones anteriores, de la más reciente a la más antigua. */
  previousVersions: ResourceVersion[];
}

export type ReviewAction =
  | 'aprobar'
  | 'descartar'
  | 'editar'
  | 'revertir'
  | 'aceptar_distractor'
  | 'descartar_distractor'
  | 'editar_distractor'
  | 'revertir_distractor'
  | 'regenerar'
  | 'restaurar_version';

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
  | { kind: 'ok'; created: Resource[]; skipped: number; available: number; notice?: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'rechazado'; code: 'EVIDENCIA_INSUFICIENTE' | 'SIN_MATERIAL_PROCESADO'; message: string };

/**
 * Formatos de exportación según SP-003 y HU-054: Moodle importa Moodle XML y Chamilo importa QTI 2.1.
 * Sustituyen a QTI 3.0, SCORM, Common Cartridge y GIFT de la versión anterior del prototipo.
 */
export type ExportFormat = 'moodle_xml' | 'qti21';

/** Plataformas LMS objetivo definidas en SP-003. */
export type TargetLms = 'moodle' | 'chamilo';

export type ExportStepId = 'seleccion' | 'formato' | 'empaquetado' | 'validacion' | 'importacion';

export type ExportStepStatus = 'completado' | 'simulado' | 'pendiente';

export interface ExportJob {
  id: string;
  format: ExportFormat;
  resourceIds: string[];
  targetLms: string;
  createdAt: string;
  steps: Record<ExportStepId, ExportStepStatus>;
  /** Nombre del archivo generado (HU-054). */
  fileName?: string;
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
