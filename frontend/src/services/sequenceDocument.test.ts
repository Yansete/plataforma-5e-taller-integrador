import { describe, expect, it } from 'vitest';
import { buildSequenceHtml } from './sequenceDocument';
import type { Resource } from '../types';

const base: Resource = {
  id: 'r1', exampleId: 'x', requestId: 's', unitId: 'u1', outcomeId: 'ra', stage: 'evaluate', type: 'item_opcion_multiple',
  title: 'TCP <o> UDP', body: 'Primer párrafo.\n\nSegundo & último.', status: 'aprobado', edited: false, discardReason: null,
  createdAt: '', updatedAt: '', decidedAt: '', version: 1, versionOrigin: 'generada', previousVersions: [],
  citations: [{ claim: 'TCP garantiza la entrega', fragmentIds: ['f1'] }],
  options: [
    { id: 'a', text: 'TCP', isCorrect: true, feedback: 'Correcto.', sourceFragmentIds: ['f1'], decision: 'pendiente', discardReason: null, edited: false, reliabilityWarning: null },
    { id: 'b', text: 'UDP', isCorrect: false, feedback: 'No confirma.', sourceFragmentIds: ['f1'], decision: 'aceptado', discardReason: null, edited: false, reliabilityWarning: null },
    { id: 'c', text: 'IP', isCorrect: false, feedback: '', sourceFragmentIds: ['f1'], decision: 'descartado', discardReason: 'sin_sentido', edited: false, reliabilityWarning: null },
  ],
};
const ctx = {
  courseName: 'Redes',
  unitLabel: () => 'Unidad 1: Protocolos',
  fragments: () => [{ id: 'f1', documentId: 'd1', location: 'p. 3', text: 'TCP garantiza la entrega confiable.', unitId: 'u1', outcomeId: 'ra' }],
  documentName: () => 'Protocolo TCP (Wikipedia).txt',
};

describe('secuencia como documento', () => {
  it('agrupa por etapa, marca la clave, omite distractores descartados y escapa el texto', () => {
    const explicacion: Resource = { ...base, id: 'r2', stage: 'explain', type: 'explicacion', title: 'Explicación', options: null };
    const html = buildSequenceHtml([base, explicacion], ctx, new Date('2026-10-10T12:00:00Z'));
    expect(html.indexOf('3. Explicar')).toBeLessThan(html.indexOf('5. Evaluar'));
    expect(html).toContain('TCP &lt;o&gt; UDP');
    expect(html).toContain('<p>Segundo &amp; último.</p>');
    expect(html).toContain('TCP <strong class="key">(clave)</strong>');
    expect(html).toContain('UDP');
    expect(html).not.toContain('>IP<');
    expect(html).toContain('p. 3');
    expect(html).toContain('CC BY-SA 4.0');
    expect(html).not.toContain('2. Explorar');
  });
});
