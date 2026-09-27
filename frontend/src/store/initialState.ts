import { DEMO_DOCUMENTS, DEMO_UNITS, EXAMPLES, INITIAL_EXAMPLE_IDS, type ExampleResource } from '../data/demoContent';
import type { AppState, GenerationRequest, Resource } from '../types';

export const STATE_VERSION = 1;

let counter = 0;
/** Identificador local. El backend asignará los definitivos. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Convierte un ejemplo preparado en un recurso propuesto, siempre en estado «pendiente». */
export function instantiateExample(example: ExampleResource, requestId: string, now: string): Resource {
  return {
    id: newId('rec'),
    exampleId: example.exampleId,
    requestId,
    unitId: example.unitId,
    outcomeId: example.outcomeId,
    stage: example.stage,
    type: example.type,
    title: example.title,
    body: example.body,
    options: example.options
      ? example.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          feedback: o.feedback,
          sourceFragmentIds: [...o.sourceFragmentIds],
          decision: 'pendiente',
          discardReason: null,
          edited: false,
          reliabilityWarning: o.reliabilityWarning ?? null,
        }))
      : null,
    citations: example.citations.map((c) => ({ claim: c.claim, fragmentIds: [...c.fragmentIds] })),
    status: 'pendiente',
    edited: false,
    discardReason: null,
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
  };
}

export function createInitialState(): AppState {
  const now = new Date().toISOString();
  const initialRequest: GenerationRequest = {
    id: 'sol-inicial',
    unitId: 'u2',
    outcomeId: null,
    stage: 'evaluate',
    resourceType: 'item_opcion_multiple',
    quantity: 4,
    difficulty: 'intermedia',
    optionCount: 4,
    topK: 10,
    evidenceThreshold: 0.6,
    instructions: 'Solicitud de ejemplo incluida en la demostración.',
    createdAt: now,
  };
  const resources = INITIAL_EXAMPLE_IDS.map((id) => {
    const example = EXAMPLES.find((e) => e.exampleId === id)!;
    return instantiateExample(example, initialRequest.id, now);
  });

  return {
    version: STATE_VERSION,
    documents: DEMO_DOCUMENTS.map((d) => ({ ...d })),
    resources,
    reviewLog: [],
    requests: [initialRequest],
    exports: [],
    ui: {
      config: {},
      reviewFilters: { unitId: 'todas', stage: 'todas', status: 'todos' },
      selectedResourceId: resources[0]?.id ?? null,
      exportSelection: [],
      exportFormat: 'qti30',
      exportTargetLms: 'por_definir',
      dashboardFilters: { unitId: 'todas', period: 'todo', scope: 'tablero' },
      uploadDefaults: { unitId: DEMO_UNITS[0].id },
    },
  };
}
