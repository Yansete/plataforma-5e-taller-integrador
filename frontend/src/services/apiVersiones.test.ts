/**
 * Integración HU-053 + HU-054: las propuestas de la API llegan sin campos de versión
 * (el backend no los maneja). La revisión y la regeneración deben funcionar igual.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generationService } from './generationService';
import { regenerationService } from './regenerationService';
import { preferencesService } from './preferencesService';
import { setLatencyFactor } from './simulation';
import { getState, resetState } from '../store/store';
import { DEMO_DOCUMENTS, DEMO_FRAGMENTS, EXAMPLES } from '../data/demoContent';
import { instantiateExample } from '../store/initialState';
import type { GenerationRequest } from '../types';

const input: Omit<GenerationRequest, 'id' | 'createdAt'> = {
  unitId: 'u2', outcomeId: null, stage: 'explore', resourceType: 'guia_exploracion', quantity: 1, difficulty: 'intermedia',
  optionCount: 4, topK: 10, evidenceThreshold: 0.6, instructions: '', audience: '', competency: '', modalities: ['Textual'],
};

/** Respuesta con la forma del backend: sin version, versionOrigin ni previousVersions. */
function backendResponse() {
  const example = EXAMPLES.find((e) => e.unitId === 'u2' && e.type === 'guia_exploracion')!;
  const { version: _v, versionOrigin: _o, previousVersions: _p, ...resource } = instantiateExample(example, 'sol-api-v', new Date().toISOString());
  return {
    mode: 'api_demo', notice: 'Datos ficticios.', request: { ...input, id: 'sol-api-v', createdAt: resource.createdAt },
    resources: [{ ...resource, source: 'api_demo' }], available: 1,
    fragments: DEMO_FRAGMENTS.filter((f) => f.unitId === 'u2'), documents: DEMO_DOCUMENTS.filter((d) => d.unitId === 'u2'),
  };
}

beforeEach(() => {
  resetState();
  setLatencyFactor(0);
});
afterEach(() => vi.unstubAllGlobals());

describe('propuestas de la API y versiones (HU-053 + HU-054)', () => {
  it('completa la versión 1 en las propuestas recibidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(backendResponse()), { status: 200 })));
    preferencesService.update('generationMode', 'api_demo');
    const outcome = await generationService.generate(input);
    expect(outcome.kind).toBe('ok');
    const received = getState().resources[0];
    expect(received).toMatchObject({ source: 'api_demo', version: 1, versionOrigin: 'generada', previousVersions: [] });
  });

  it('permite regenerar y restaurar una propuesta de la API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(backendResponse()), { status: 200 })));
    preferencesService.update('generationMode', 'api_demo');
    await generationService.generate(input);
    const id = getState().resources[0].id;
    const regenerated = await regenerationService.regenerate(id);
    expect(regenerated.version).toBe(2);
    expect(regenerated.previousVersions[0]).toMatchObject({ number: 1, source: 'api_demo' });
    const restored = regenerationService.restoreVersion(id, 1);
    expect(restored).toMatchObject({ version: 1, source: 'api_demo' });
  });
});
