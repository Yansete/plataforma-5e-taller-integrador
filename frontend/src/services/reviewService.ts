/**
 * Revisión docente human-in-the-loop (HU-010) y registro de decisiones (EN-006).
 *
 * Regla central: un recurso solo pasa a «aprobado» mediante `approveResource`,
 * que se invoca únicamente desde una acción explícita del docente.
 *
 * Futuro: POST /recursos/{id}/decisiones, PATCH /recursos/{id}.
 */
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { DiscardReason, ItemOption, Resource, ReviewAction, ReviewLogEntry } from '../types';
import { ServiceError } from './simulation';

export const DEMO_USER = 'Docente (demostración)';

/** Mínimo de distractores no descartados para aprobar un ítem (supuesto de diseño: ítem de al menos 3 alternativas). */
export const MIN_DISTRACTORS = 2;

function logEntry(resourceId: string, action: ReviewAction, optionId: string | null = null, reason: DiscardReason | null = null): ReviewLogEntry {
  return { id: newId('dec'), resourceId, optionId, action, reason, user: DEMO_USER, at: new Date().toISOString() };
}

function getResource(id: string): Resource {
  const r = getState().resources.find((x) => x.id === id);
  if (!r) throw new ServiceError('El recurso ya no existe.');
  return r;
}

function commit(updated: Resource, entry: ReviewLogEntry): void {
  setState((s) => ({
    ...s,
    resources: s.resources.map((r) => (r.id === updated.id ? updated : r)),
    reviewLog: [entry, ...s.reviewLog],
  }));
}

/** Motivos por los que un recurso todavía no puede aprobarse. Lista vacía = puede aprobarse. */
export function approvalBlockers(resource: Resource): string[] {
  const blockers: string[] = [];
  if (resource.status !== 'pendiente') blockers.push('Solo se aprueban recursos pendientes.');
  if (resource.options) {
    const distractors = resource.options.filter((o) => !o.isCorrect);
    const undecided = distractors.filter((o) => o.decision === 'pendiente').length;
    if (undecided > 0) blockers.push(`Decide los ${undecided} distractor(es) pendiente(s): aceptar, editar o descartar.`);
    const kept = distractors.filter((o) => o.decision === 'aceptado').length;
    if (undecided === 0 && kept < MIN_DISTRACTORS)
      blockers.push(`El ítem necesita al menos ${MIN_DISTRACTORS} distractores aceptados. Edita uno descartado o descarta el ítem.`);
    if (!resource.options.some((o) => o.isCorrect && o.text.trim())) blockers.push('El ítem necesita una clave (respuesta correcta).');
  }
  if (!resource.body.trim()) blockers.push('El contenido no puede estar vacío.');
  return blockers;
}

function requirePending(r: Resource): void {
  if (r.status !== 'pendiente') throw new ServiceError('Devuelve el recurso a revisión antes de modificarlo.');
}

function updateOption(r: Resource, optionId: string, patch: Partial<ItemOption>): Resource {
  if (!r.options) throw new ServiceError('Este recurso no tiene alternativas.');
  const option = r.options.find((o) => o.id === optionId);
  if (!option) throw new ServiceError('La alternativa no existe.');
  if (option.isCorrect && patch.decision) throw new ServiceError('La clave no se acepta ni se descarta por separado.');
  return { ...r, options: r.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)), updatedAt: new Date().toISOString() };
}

export interface ResourceEdits {
  title: string;
  body: string;
  /** Solo ítems: textos y retroalimentación de cada alternativa. */
  options?: { id: string; text: string; feedback: string }[];
}

export const reviewService = {
  approveResource(id: string): void {
    const r = getResource(id);
    const blockers = approvalBlockers(r);
    if (blockers.length > 0) throw new ServiceError(blockers[0]);
    const now = new Date().toISOString();
    commit({ ...r, status: 'aprobado', discardReason: null, decidedAt: now, updatedAt: now }, logEntry(id, 'aprobar'));
  },

  discardResource(id: string, reason: DiscardReason): void {
    const r = getResource(id);
    requirePending(r);
    const now = new Date().toISOString();
    commit({ ...r, status: 'descartado', discardReason: reason, decidedAt: now, updatedAt: now }, logEntry(id, 'descartar', null, reason));
  },

  /** Devuelve un recurso aprobado o descartado a «pendiente». */
  revertResource(id: string): void {
    const r = getResource(id);
    if (r.status === 'pendiente') return;
    commit({ ...r, status: 'pendiente', discardReason: null, decidedAt: null, updatedAt: new Date().toISOString() }, logEntry(id, 'revertir'));
  },

  /** Guarda cambios. El recurso sigue «pendiente»: editar NO aprueba. */
  saveEdits(id: string, edits: ResourceEdits): void {
    const r = getResource(id);
    requirePending(r);
    if (!edits.body.trim()) throw new ServiceError('El contenido no puede quedar vacío.');
    if (!edits.title.trim()) throw new ServiceError('El título no puede quedar vacío.');
    let options = r.options;
    if (options && edits.options) {
      options = options.map((o) => {
        const e = edits.options!.find((x) => x.id === o.id);
        if (!e) return o;
        if (!e.text.trim()) throw new ServiceError('Ninguna alternativa puede quedar vacía.');
        const changed = e.text !== o.text || e.feedback !== o.feedback;
        return changed ? { ...o, text: e.text, feedback: e.feedback, edited: true } : o;
      });
    }
    const changed =
      edits.title !== r.title || edits.body !== r.body || JSON.stringify(options) !== JSON.stringify(r.options);
    if (!changed) return;
    commit(
      { ...r, title: edits.title, body: edits.body, options, edited: true, updatedAt: new Date().toISOString() },
      logEntry(id, 'editar'),
    );
  },

  acceptDistractor(resourceId: string, optionId: string): void {
    const r = getResource(resourceId);
    requirePending(r);
    commit(updateOption(r, optionId, { decision: 'aceptado', discardReason: null }), logEntry(resourceId, 'aceptar_distractor', optionId));
  },

  discardDistractor(resourceId: string, optionId: string, reason: DiscardReason): void {
    const r = getResource(resourceId);
    requirePending(r);
    commit(
      updateOption(r, optionId, { decision: 'descartado', discardReason: reason }),
      logEntry(resourceId, 'descartar_distractor', optionId, reason),
    );
  },

  /** Editar un distractor equivale a aceptarlo con cambios; marca el recurso como editado. */
  editDistractor(resourceId: string, optionId: string, text: string, feedback: string): void {
    const r = getResource(resourceId);
    requirePending(r);
    if (!text.trim()) throw new ServiceError('El distractor no puede quedar vacío.');
    const updated = updateOption(r, optionId, { text, feedback, edited: true, decision: 'aceptado', discardReason: null });
    commit({ ...updated, edited: true }, logEntry(resourceId, 'editar_distractor', optionId));
  },

  revertDistractor(resourceId: string, optionId: string): void {
    const r = getResource(resourceId);
    requirePending(r);
    commit(updateOption(r, optionId, { decision: 'pendiente', discardReason: null }), logEntry(resourceId, 'revertir_distractor', optionId));
  },
};

export const ACTION_LABELS: Record<ReviewAction, string> = {
  aprobar: 'Aprobó el recurso',
  descartar: 'Descartó el recurso',
  editar: 'Editó el recurso',
  revertir: 'Devolvió el recurso a revisión',
  aceptar_distractor: 'Aceptó un distractor',
  descartar_distractor: 'Descartó un distractor',
  editar_distractor: 'Editó un distractor',
  revertir_distractor: 'Reabrió un distractor',
  regenerar: 'Pidió otra versión del recurso',
  restaurar_version: 'Restauró una versión anterior',
};
