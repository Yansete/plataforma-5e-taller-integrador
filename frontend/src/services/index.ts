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
export { exportService, exportableResources, formatIssues, EXPORT_STEPS } from './exportService';
export { computeIndicators, resourcesInScope, inPeriod } from './indicatorService';
export { preferencesService } from './preferencesService';
export { ServiceError } from './simulation';
