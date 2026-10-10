import { sessionService } from './sessionService';
import { apiUrl } from '../config/despliegue';
/** HU-053 / EN-006: frontera HTTP. Los fallos no crean propuestas ni activan la demo local. */
import type { Fragment, GenerationRequest, MaterialDocument, Resource } from '../types';
export type GenerationInput = Omit<GenerationRequest, 'id' | 'createdAt'>;
/** `api_demo`: ejemplos preparados. `rag`: generado a partir del material real del docente. */
export interface ApiGeneration {
  mode: 'api_demo' | 'rag'; notice: string; request: GenerationRequest; resources: Resource[];
  available: number; fragments: Fragment[]; documents: MaterialDocument[];
  generator?: { descripcion: string; usaIA: boolean };
}
/** Espera máxima de una generación: con IA real puede tardar y el servidor gratuito además puede estar despertando. */
export const GENERATION_TIMEOUT_MS = 150000;
export class GenerationApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
export function validateApiGeneration(value: unknown, input: GenerationInput): ApiGeneration {
  const fail = () => { throw new GenerationApiError('RESPUESTA_INVALIDA', 'La API devolvió una respuesta incompatible. No se añadieron propuestas.'); };
  if (!obj(value) || (value.mode !== 'api_demo' && value.mode !== 'rag') || typeof value.notice !== 'string' || !obj(value.request) || typeof value.request.id !== 'string' || typeof value.request.createdAt !== 'string' || !Array.isArray(value.resources) || !value.resources.length || value.resources.length > input.quantity || !Number.isInteger(value.available) || !Array.isArray(value.fragments) || !Array.isArray(value.documents)) return fail();
  if (value.request.unitId !== input.unitId || value.request.stage !== input.stage || value.request.resourceType !== input.resourceType || value.request.quantity !== input.quantity) return fail();
  const fragments = new Map<string, Record<string, unknown>>();
  const docs = new Set<string>();
  for (const d of value.documents) {
    if (!obj(d) || typeof d.id !== 'string' || typeof d.fileName !== 'string' || d.unitId !== input.unitId) return fail();
    docs.add(d.id);
  }
  for (const f of value.fragments) {
    if (!obj(f) || typeof f.id !== 'string' || typeof f.documentId !== 'string' || typeof f.location !== 'string' || typeof f.text !== 'string' || f.unitId !== input.unitId || !docs.has(f.documentId)) return fail();
    fragments.set(f.id, f);
  }
  const ids = new Set<string>();
  for (const r of value.resources) {
    if (!obj(r) || typeof r.id !== 'string' || ids.has(r.id) || r.requestId !== value.request.id || r.unitId !== input.unitId || r.stage !== input.stage || r.type !== input.resourceType || r.source !== value.mode || r.status !== 'pendiente' || r.edited !== false || r.decidedAt !== null || r.discardReason !== null || typeof r.exampleId !== 'string' || typeof r.outcomeId !== 'string' || typeof r.title !== 'string' || typeof r.body !== 'string' || typeof r.createdAt !== 'string' || typeof r.updatedAt !== 'string' || !Array.isArray(r.citations) || !r.citations.length) return fail();
    ids.add(r.id);
    if (input.outcomeId && r.outcomeId !== input.outcomeId) return fail();
    for (const c of r.citations) if (!obj(c) || typeof c.claim !== 'string' || !strings(c.fragmentIds) || !c.fragmentIds.length || c.fragmentIds.some((id) => !fragments.has(id))) return fail();
    if (r.options !== null) {
      if (!Array.isArray(r.options) || r.options.length !== input.optionCount) return fail();
      if (r.options.filter((o) => obj(o) && o.isCorrect === true).length !== 1) return fail();
      const optionIds = new Set<string>();
      for (const o of r.options) {
        if (!obj(o) || typeof o.id !== 'string' || optionIds.has(o.id) || typeof o.text !== 'string' || typeof o.feedback !== 'string' || typeof o.isCorrect !== 'boolean' || o.decision !== 'pendiente' || o.edited !== false || o.discardReason !== null || !strings(o.sourceFragmentIds) || o.sourceFragmentIds.some((id) => !fragments.has(id))) return fail();
        optionIds.add(o.id);
      }
    } else if (input.stage === 'evaluate') return fail();
  }
  return value as unknown as ApiGeneration;
}
export function toApiRequest(input: GenerationInput) {
  return { unidad_id: input.unitId, resultado_aprendizaje_id: input.outcomeId, etapa_5e: input.stage, tipo_recurso: input.resourceType, cantidad: input.quantity, dificultad: input.difficulty, alternativas: input.optionCount, top_k: input.topK, umbral_evidencia: input.evidenceThreshold, indicaciones: input.instructions, publico_objetivo: input.audience ?? '', competencia: input.competency ?? '', modalidades: input.modalities ?? [] };
}
export async function requestGeneration(input: GenerationInput): Promise<ApiGeneration> {
  const authorization = sessionService.headers().Authorization;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl('/api/v1/generaciones'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...sessionService.headers() }, body: JSON.stringify(toApiRequest(input)), signal: controller.signal });
    let data: unknown;
    try { data = await response.json(); } catch { throw new GenerationApiError('API_NO_DISPONIBLE', 'La API no respondió correctamente. Comprueba que el backend esté iniciado y vuelve a intentar.'); }
    if (!response.ok) {
      if (response.status === 401 && sessionService.isBackend()) sessionService.expire();
      if (obj(data) && obj(data.error) && typeof data.error.codigo === 'string' && typeof data.error.mensaje === 'string') throw new GenerationApiError(data.error.codigo, data.error.mensaje);
      throw new GenerationApiError(`HTTP_${response.status}`, response.status === 422 ? 'La API rechazó los parámetros. Revisa la unidad, etapa, tipo y cantidad.' : 'No se pudo completar la solicitud. Comprueba el backend y vuelve a intentar.');
    }
    if (authorization && authorization !== sessionService.headers().Authorization) throw new GenerationApiError('SESION_CAMBIADA', 'La sesión cambió durante la solicitud. Consulta el historial al volver a iniciar sesión.');
    return validateApiGeneration(data, input);
  } catch (error) {
    if (error instanceof GenerationApiError) throw error;
    throw new GenerationApiError(controller.signal.aborted ? 'TIEMPO_AGOTADO' : 'CONEXION_FALLIDA', controller.signal.aborted ? 'La API tardó demasiado. Puedes volver a intentar.' : 'No se pudo conectar con la API. Inicia el backend y vuelve a intentar.');
  } finally { clearTimeout(timer); }
}

/** Generador activo en el servidor (modelo de IA o reglas). Sin servidor devuelve null. */
export async function fetchGeneratorInfo(): Promise<{ descripcion: string; usaIA: boolean } | null> {
  try {
    const response = await fetch(apiUrl('/api/v1/ia'));
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return obj(data) && typeof data.descripcion === 'string' ? { descripcion: data.descripcion, usaIA: data.usaIA === true } : null;
  } catch { return null; }
}
