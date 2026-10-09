/**
 * TA-008 · Pruebas de caja blanca del catálogo académico (curso, unidades, resultados y fragmentos).
 * Cubren los caminos encontrados y no encontrados de cada función.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_COURSE, DEMO_DOCUMENTS, DEMO_FRAGMENTS, DEMO_UNITS } from '../data/demoContent';
import { catalogService, unitLabel, unitShortLabel } from './catalogService';

const unidad = DEMO_UNITS[0];
const resultado = unidad.outcomes[0];

describe('catálogo académico', () => {
  it('devuelve el curso y todas sus unidades', () => {
    expect(catalogService.getCourse()).toEqual(DEMO_COURSE);
    expect(catalogService.listUnits()).toHaveLength(DEMO_UNITS.length);
  });

  it('encuentra una unidad por su id y no inventa unidades', () => {
    expect(catalogService.getUnit(unidad.id)).toEqual(unidad);
    expect(catalogService.getUnit('no-existe')).toBeUndefined();
  });

  it('busca un resultado de aprendizaje en todas las unidades', () => {
    const ultima = DEMO_UNITS[DEMO_UNITS.length - 1];
    const ultimoResultado = ultima.outcomes[ultima.outcomes.length - 1];
    expect(catalogService.getOutcome(resultado.id)).toEqual(resultado);
    expect(catalogService.getOutcome(ultimoResultado.id)).toEqual(ultimoResultado);
    expect(catalogService.getOutcome('no-existe')).toBeUndefined();
  });

  it('devuelve los fragmentos pedidos en orden e ignora los que no existen', () => {
    const [a, b] = DEMO_FRAGMENTS;
    expect(catalogService.getFragments([b.id, 'no-existe', a.id])).toEqual([b, a]);
    expect(catalogService.getFragments([])).toEqual([]);
  });

  it('muestra el nombre del documento o, si no existe, su id', () => {
    const documento = DEMO_DOCUMENTS[0];
    expect(catalogService.documentName(documento.id)).toBe(documento.fileName);
    expect(catalogService.documentName('doc-desconocido')).toBe('doc-desconocido');
  });

  it('cuenta los fragmentos de cada unidad', () => {
    const total = DEMO_UNITS.reduce((suma, u) => suma + catalogService.countFragmentsForUnit(u.id), 0);
    expect(total).toBe(DEMO_FRAGMENTS.filter((f) => DEMO_UNITS.some((u) => u.id === f.unitId)).length);
    expect(catalogService.countFragmentsForUnit('no-existe')).toBe(0);
  });

  it('arma las etiquetas de unidad para la interfaz', () => {
    expect(unitLabel(unidad.id)).toBe(`Unidad ${unidad.number}: ${unidad.title}`);
    expect(unitShortLabel(unidad.id)).toBe(`Unidad ${unidad.number}`);
    expect(unitLabel('no-existe')).toBe('Unidad desconocida');
    expect(unitShortLabel('no-existe')).toBe('—');
  });
});
