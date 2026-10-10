/**
 * Punto único de acceso a los servicios.
 * Para conectar el backend, sustituir la implementación de cada servicio
 * manteniendo sus firmas (ver docs/integracion-backend.md).
 */
export { catalogService, unitLabel, unitShortLabel } from './catalogService';
export { materialService, validateFile, validateRegistration, fileKindFromName, STEP_LABELS } from './materialService';
export type { FieldErrors, LocalFileInfo, RegisterInput } from './materialService';
export { generationService, availableExamples, unitHasUsableMaterial, PHASE_LABELS } from './generationService';
export type { GenerationPhase } from './generationService';
export { reviewService, approvalBlockers, ACTION_LABELS, DEMO_USER, MIN_DISTRACTORS } from './reviewService';
export type { ResourceEdits } from './reviewService';
export { regenerationService, regenerationBlocker } from './regenerationService';
export { exportService, exportableResources, formatIssues, formatForLms, EXPORT_STEPS } from './exportService';
export { buildMoodleXml, buildQti21Item, buildQti21Manifest, buildQti21Package, createZip, crc32 } from './exportFormats';
export { computeIndicators, resourcesInScope, inPeriod } from './indicatorService';
export { preferencesService } from './preferencesService';
export { ServiceError } from './simulation';

export { sessionService, useDemoSession, DEMO_EMAIL, DEMO_PASSWORD } from './sessionService';
export { courseService } from './courseService';
export type { CourseInput } from './courseService';
