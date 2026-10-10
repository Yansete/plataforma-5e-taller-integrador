import { configurationFetch } from './configurationApiService';
import { sessionService } from './sessionService';
/**
 * Carga de material (HU-002, HU-003).
 *
 * Distinción importante:
 * 1. SELECCIÓN LOCAL: el navegador conoce el nombre, tipo y tamaño del archivo. No se lee su contenido.
 * 2. REGISTRO: se guardan solo esos metadatos y el contexto (unidad, RA, tipo, etapa sugerida).
 * 3. PROCESAMIENTO SIMULADO: se recorren los pasos de extracción, segmentación y vectorización
 *    sin procesar nada. Por eso los documentos del usuario quedan con 0 fragmentos.
 *
 * Futuro: POST /documentos (multipart) y GET /documentos/{id}/estado.
 */
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_MB } from '../data/catalog';
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { FileKind, MaterialDocument, ProcessingStep, Stage5E } from '../types';
import { ServiceError, wait } from './simulation';

export interface LocalFileInfo {
  blob?: File;
  name: string;
  size: number;
}

export interface RegisterInput {
  file: LocalFileInfo;
  unitId: string;
  outcomeIds: string[];
  documentType: string;
  suggestedStage: Stage5E | null;
  usePermission: boolean;
}

export type FieldErrors = Partial<Record<'file' | 'unitId' | 'outcomeIds' | 'documentType' | 'usePermission', string>>;

export function fileKindFromName(name: string): FileKind | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS[ext] ?? null;
}

export function validateFile(file: LocalFileInfo | null): string | null {
  if (!file) return 'Selecciona un archivo.';
  if (!fileKindFromName(file.name)) return 'Formato no admitido. Usa PDF, PPTX o TXT.';
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`;
  return null;
}

export function validateRegistration(input: Omit<Partial<RegisterInput>, 'file'> & { file: LocalFileInfo | null }): FieldErrors {
  const errors: FieldErrors = {};
  const fileError = validateFile(input.file);
  if (fileError) errors.file = fileError;
  if (!input.unitId) errors.unitId = 'Elige la unidad a la que pertenece el material.';
  if ((!input.outcomeIds || input.outcomeIds.length === 0) && (!sessionService.isBackend() || !!getState().units.find((u) => u.id === input.unitId)?.outcomes.length)) errors.outcomeIds = 'Marca al menos un resultado de aprendizaje.';
  if (!input.documentType) errors.documentType = 'Elige el tipo de documento.';
  if (!input.usePermission) errors.usePermission = 'Debes confirmar que cuentas con permiso de uso del material.';
  if (!errors.file && input.file && input.unitId) {
    const duplicate = getState().documents.some(
      (d) => d.unitId === input.unitId && d.fileName.toLowerCase() === input.file!.name.toLowerCase(),
    );
    if (duplicate) errors.file = 'Ya existe un documento con ese nombre en la unidad.';
  }
  return errors;
}

function patchDocument(id: string, patch: Partial<MaterialDocument>): void {
  setState((s) => ({ ...s, documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

const STEPS: ProcessingStep[] = ['extraccion', 'segmentacion', 'vectorizacion'];

export const materialService = {
  async downloadDocument(doc: MaterialDocument) {
    const blob = await (await configurationFetch(`/documentos/${encodeURIComponent(doc.id)}/archivo`)).blob();
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = doc.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async registerDocument(input: RegisterInput): Promise<MaterialDocument> {
    const errors = validateRegistration(input);
    if (Object.keys(errors).length > 0) throw new ServiceError('Revisa los campos marcados.');
    if (sessionService.isBackend()) {
      if (!input.file.blob) throw new ServiceError('Vuelve a seleccionar el archivo.');
      const data = new FormData(); data.append('file', input.file.blob);
      const { file: _file, ...contexto } = input; data.append('contexto', JSON.stringify(contexto));
      const doc: MaterialDocument = await (await configurationFetch('/documentos', { method: 'POST', body: data })).json();
      setState((s) => ({ ...s, documents: [doc, ...s.documents] })); return doc;
    }
    await wait(300);
    const doc: MaterialDocument = {
      id: newId('doc'),
      fileName: input.file.name,
      kind: fileKindFromName(input.file.name)!,
      sizeBytes: input.file.size,
      unitId: input.unitId,
      outcomeIds: [...input.outcomeIds],
      documentType: input.documentType,
      suggestedStage: input.suggestedStage,
      usePermission: input.usePermission,
      status: 'registrado',
      currentStep: null,
      registeredAt: new Date().toISOString(),
      processedAt: null,
      fragmentCount: 0,
      pageCount: null,
      errorMessage: null,
      isDemo: false,
    };
    setState((s) => ({ ...s, documents: [doc, ...s.documents] }));
    return doc;
  },

  /** Recorre los pasos del procesamiento sin procesar el archivo. */
  async processDocument(id: string, options: { simulateFailure?: boolean } = {}): Promise<void> {
    const doc = getState().documents.find((d) => d.id === id);
    if (doc?.source === 'backend') throw new ServiceError('El archivo está guardado. La extracción real está pendiente.');
    if (!doc) throw new ServiceError('El documento ya no existe.');
    if (doc.status === 'procesando') return;
    patchDocument(id, { status: 'procesando', currentStep: STEPS[0], errorMessage: null });
    for (let i = 0; i < STEPS.length; i += 1) {
      patchDocument(id, { currentStep: STEPS[i] });
      await wait(900);
      if (!getState().documents.some((d) => d.id === id)) return; // eliminado durante el proceso
      if (options.simulateFailure && STEPS[i] === 'segmentacion') {
        patchDocument(id, {
          status: 'error',
          currentStep: null,
          errorMessage: 'Fallo simulado durante la segmentación. Puedes reintentar el procesamiento.',
        });
        return;
      }
    }
    patchDocument(id, {
      status: 'procesado',
      currentStep: null,
      processedAt: new Date().toISOString(),
      fragmentCount: 0,
    });
  },

  async removeDocument(id: string): Promise<void> {
    if (sessionService.isBackend()) {
      const doc = getState().documents.find((d) => d.id === id);
      if (doc?.source !== 'backend') throw new ServiceError('Los ejemplos de demostración son de solo lectura en modo conectado.');
      await configurationFetch(`/documentos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } else await wait(150);
    setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
  },
};

export const STEP_LABELS: Record<ProcessingStep, string> = {
  extraccion: 'Extracción de texto',
  segmentacion: 'Segmentación en fragmentos',
  vectorizacion: 'Vectorización e indexación',
};
