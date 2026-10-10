/**
 * Regeneración de recursos (HU-054).
 *
 * SIMULADA: no hay modelo de lenguaje. Para proponer «otra versión» se usa, si existe,
 * otro ejemplo preparado de la misma unidad, etapa y tipo que aún no esté en la cola;
 * si no, se construye una variante del recurso actual (redacción alternativa y otro
 * orden de alternativas). La versión anterior se conserva siempre y puede restaurarse.
 *
 * Futuro: POST /recursos/{id}/regeneraciones → el backend vuelve a llamar al agente de la
 * etapa con la misma evidencia y devuelve la nueva versión (HU-052).
 */
import { EXAMPLES, type ExampleResource } from '../data/demoContent';
import { getState, setState } from '../store/store';
import { newId } from '../store/initialState';
import type { ItemOption, Resource, ResourceVersion, ReviewLogEntry, Stage5E } from '../types';
import { DEMO_USER } from './reviewService';
import { ServiceError, wait } from './simulation';

/** Frases con las que la variante simulada cambia el enfoque según la etapa 5E. */
const VARIANT_INTROS: Record<Stage5E, string[]> = {
  engage: ['Antes de empezar la clase, piensa en esta situación.', 'Imagina el siguiente escenario cotidiano.'],
  explore: ['Trabaja en parejas y registra lo que observes.', 'Explora el caso paso a paso antes de sacar conclusiones.'],
  explain: ['En resumen, a partir del material de la unidad:', 'Dicho con otras palabras, según la fuente citada:'],
  elaborate: ['Aplica lo aprendido a un contexto nuevo.', 'Lleva el concepto a una situación distinta de la vista en clase.'],
  evaluate: ['Considera el siguiente caso.', 'Lee con atención y elige la mejor respuesta.'],
};

export function snapshotOf(resource: Resource): ResourceVersion {
  return {
    number: resource.version,
    exampleId: resource.exampleId,
    title: resource.title,
    body: resource.body,
    options: resource.options ? resource.options.map((o) => ({ ...o, sourceFragmentIds: [...o.sourceFragmentIds] })) : null,
    citations: resource.citations.map((c) => ({ claim: c.claim, fragmentIds: [...c.fragmentIds] })),
    origin: resource.versionOrigin,
    edited: resource.edited,
    createdAt: resource.updatedAt,
  };
}

function freshOptions(options: ExampleResource['options'] | ItemOption[] | null | undefined): ItemOption[] | null {
  if (!options) return null;
  return options.map((o) => ({
    id: o.id,
    text: o.text,
    isCorrect: o.isCorrect,
    feedback: o.feedback,
    sourceFragmentIds: [...o.sourceFragmentIds],
    decision: 'pendiente',
    discardReason: null,
    edited: false,
    reliabilityWarning: o.reliabilityWarning ?? null,
  }));
}

/** Otro ejemplo preparado de la misma combinación que todavía no está en la cola. */
export function alternativeExample(resource: Resource, used: Set<string>): ExampleResource | null {
  return (
    EXAMPLES.find(
      (e) =>
        e.unitId === resource.unitId &&
        e.stage === resource.stage &&
        e.type === resource.type &&
        e.exampleId !== resource.exampleId &&
        !used.has(e.exampleId),
    ) ?? null
  );
}

/**
 * Variante del recurso actual: cambia la redacción de entrada y, en los ítems, rota el orden
 * de los distractores. Conserva la evidencia citada, porque el anclaje no cambia.
 */
export function buildVariant(resource: Resource, nextNumber: number): Pick<Resource, 'title' | 'body' | 'options' | 'citations'> {
  const intros = VARIANT_INTROS[resource.stage];
  const intro = intros[(nextNumber - 2) % intros.length];
  // Quita una introducción puesta por una regeneración anterior para no acumularlas.
  let core = resource.body;
  for (const phrase of Object.values(VARIANT_INTROS).flat()) {
    if (core.startsWith(phrase)) core = core.slice(phrase.length).trimStart();
  }
  const separator = resource.type === 'item_opcion_multiple' ? ' ' : '\n\n';
  let options = freshOptions(resource.options);
  if (options) {
    const key = options.filter((o) => o.isCorrect);
    const distractors = options.filter((o) => !o.isCorrect);
    const rotated = distractors.length > 1 ? [...distractors.slice(1), distractors[0]] : distractors;
    // La clave cambia de posición para que la versión no sea idéntica a la anterior.
    const position = (nextNumber - 1) % (rotated.length + 1);
    options = [...rotated.slice(0, position), ...key, ...rotated.slice(position)];
  }
  return {
    title: resource.title,
    body: `${intro}${separator}${core}`,
    options,
    citations: resource.citations.map((c) => ({ claim: c.claim, fragmentIds: [...c.fragmentIds] })),
  };
}

function entry(resourceId: string, action: 'regenerar' | 'restaurar_version'): ReviewLogEntry {
  return { id: newId('dec'), resourceId, optionId: null, action, reason: null, user: DEMO_USER, at: new Date().toISOString() };
}

function getResource(id: string): Resource {
  const r = getState().resources.find((x) => x.id === id);
  if (!r) throw new ServiceError('El recurso ya no existe.');
  return r;
}

/** Motivo por el que no se puede regenerar, o `null` si se puede. */
export function regenerationBlocker(resource: Resource): string | null {
  if (resource.status === 'aprobado') return 'Devuelve el recurso a revisión antes de pedir otra versión: ya está aprobado.';
  return null;
}

export const regenerationService = {
  /**
   * Propone otra versión del recurso y conserva la vigente en `previousVersions`.
   * La nueva versión vuelve a «pendiente»: el docente debe revisarla de nuevo.
   */
  async regenerate(id: string): Promise<Resource> {
    const current = getResource(id);
    const blocker = regenerationBlocker(current);
    if (blocker) throw new ServiceError(blocker);
    await wait(1200);

    const latest = getResource(id);
    const used = new Set(getState().resources.map((r) => r.exampleId));
    for (const v of latest.previousVersions) used.add(v.exampleId);
    const nextNumber = Math.max(latest.version, ...latest.previousVersions.map((v) => v.number)) + 1;
    const alternative = alternativeExample(latest, used);
    const content = alternative
      ? {
          title: alternative.title,
          body: alternative.body,
          options: freshOptions(alternative.options),
          citations: alternative.citations.map((c) => ({ claim: c.claim, fragmentIds: [...c.fragmentIds] })),
        }
      : buildVariant(latest, nextNumber);

    const now = new Date().toISOString();
    const updated: Resource = {
      ...latest,
      ...content,
      exampleId: alternative ? alternative.exampleId : latest.exampleId,
      status: 'pendiente',
      discardReason: null,
      decidedAt: null,
      edited: false,
      version: nextNumber,
      versionOrigin: 'regenerada',
      // Historial ordenado de la versión más nueva a la más antigua (también tras restaurar).
      previousVersions: [snapshotOf(latest), ...latest.previousVersions].sort((a, b) => b.number - a.number),
      updatedAt: now,
    };
    setState((s) => ({
      ...s,
      resources: s.resources.map((r) => (r.id === id ? updated : r)),
      reviewLog: [entry(id, 'regenerar'), ...s.reviewLog],
    }));
    return updated;
  },

  /** Vuelve a una versión anterior; la vigente pasa al historial. */
  restoreVersion(id: string, versionNumber: number): Resource {
    const current = getResource(id);
    const blocker = regenerationBlocker(current);
    if (blocker) throw new ServiceError(blocker.replace('pedir otra versión', 'restaurar una versión anterior'));
    const target = current.previousVersions.find((v) => v.number === versionNumber);
    if (!target) throw new ServiceError('Esa versión ya no existe.');
    const now = new Date().toISOString();
    const updated: Resource = {
      ...current,
      exampleId: target.exampleId,
      title: target.title,
      body: target.body,
      options: freshOptions(target.options),
      citations: target.citations.map((c) => ({ claim: c.claim, fragmentIds: [...c.fragmentIds] })),
      status: 'pendiente',
      discardReason: null,
      decidedAt: null,
      edited: target.edited,
      version: target.number,
      versionOrigin: target.origin,
      previousVersions: [snapshotOf(current), ...current.previousVersions.filter((v) => v.number !== versionNumber)].sort(
        (a, b) => b.number - a.number,
      ),
      updatedAt: now,
    };
    setState((s) => ({
      ...s,
      resources: s.resources.map((r) => (r.id === id ? updated : r)),
      reviewLog: [entry(id, 'restaurar_version'), ...s.reviewLog],
    }));
    return updated;
  },
};
