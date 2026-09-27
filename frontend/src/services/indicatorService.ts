/**
 * Indicadores del tablero (HU-021).
 *
 * Tres orígenes, siempre visibles en la interfaz:
 * - `local`: calculado en el navegador a partir de las acciones registradas en esta demostración.
 * - `demo`: valor de ejemplo inventado (DEMO_INDICATOR_VALUES). No es una medición.
 * - `pendiente`: requiere backend, piloto o instrumentos externos.
 *
 * Futuro: GET /indicadores?unidad=…&periodo=…
 */
import { STAGES } from '../data/catalog';
import { DEMO_INDICATOR_VALUES, INDICATORS, PENDING_REASONS } from '../data/indicators';
import type { DashboardPeriod, IndicatorDefinition, IndicatorValue, Resource } from '../types';

export interface IndicatorFilters {
  unitId: string; // 'todas' o id
  period: DashboardPeriod;
}

export function inPeriod(iso: string, period: DashboardPeriod, now = new Date()): boolean {
  if (period === 'todo') return true;
  const date = new Date(iso);
  if (period === 'hoy') return date.toDateString() === now.toDateString();
  return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

/** Recursos dentro del corte: unidad y periodo según su fecha de propuesta. */
export function resourcesInScope(resources: Resource[], filters: IndicatorFilters): Resource[] {
  return resources.filter(
    (r) => (filters.unitId === 'todas' || r.unitId === filters.unitId) && inPeriod(r.createdAt, filters.period),
  );
}

function pct(n: number, d: number): number {
  return Math.round((n / d) * 1000) / 10;
}

function formatPct(v: number): string {
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
}

function meets(def: IndicatorDefinition, value: number | null): boolean | null {
  const goal = def.goal;
  if (value === null || !goal) return null;
  if (goal.op === 'rango') return value >= goal.min && value <= goal.max;
  return goal.op === '>=' ? value >= goal.value : value <= goal.value;
}

function local(def: IndicatorDefinition, value: number | null, display: string, detail: string): IndicatorValue {
  return { code: def.code, source: 'local', value, display, detail, meetsGoal: meets(def, value) };
}

function computeLocal(def: IndicatorDefinition, scope: Resource[]): IndicatorValue | null {
  const distractors = scope.flatMap((r) => (r.options ?? []).filter((o) => !o.isCorrect));
  const evaluated = distractors.filter((o) => o.decision !== 'pendiente');

  switch (def.code) {
    case 'I2': {
      if (scope.length === 0) return local(def, null, 'Sin datos', 'No hay recursos propuestos en este corte.');
      const accepted = scope.filter((r) => r.status === 'aprobado' && !r.edited).length;
      const v = pct(accepted, scope.length);
      return local(def, v, formatPct(v), `${accepted} aprobado(s) sin edición de ${scope.length} propuesto(s).`);
    }
    case 'I3': {
      if (evaluated.length === 0) return local(def, null, 'Sin datos', 'Aún no se ha decidido ningún distractor en este corte.');
      const nonsense = evaluated.filter((o) => o.discardReason === 'sin_sentido').length;
      const v = pct(nonsense, evaluated.length);
      return local(def, v, formatPct(v), `${nonsense} descartado(s) como «sin sentido» de ${evaluated.length} evaluado(s). Aproximación: la medición oficial usa rúbrica experta.`);
    }
    case 'I5': {
      if (evaluated.length === 0) return local(def, null, 'Sin datos', 'Aún no se ha decidido ningún distractor en este corte.');
      const alsoCorrect = evaluated.filter((o) => o.discardReason === 'tambien_correcto').length;
      const v = pct(alsoCorrect, evaluated.length);
      return local(def, v, formatPct(v), `${alsoCorrect} descartado(s) por ser también correctos de ${evaluated.length} evaluado(s). Aproximación local.`);
    }
    case 'I22': {
      if (scope.length === 0) return local(def, null, 'Sin datos', 'No hay recursos generados en este corte.');
      const traced = scope.filter((r) => r.citations.length > 0 && r.citations.every((c) => c.fragmentIds.length > 0)).length;
      const v = pct(traced, scope.length);
      return local(def, v, formatPct(v), `${traced} de ${scope.length} recurso(s) citan fragmentos. Se calcula sobre los ejemplos de demostración, no sobre generación real.`);
    }
    case 'I23': {
      const unitIds = [...new Set(scope.map((r) => r.unitId))];
      if (unitIds.length === 0) return local(def, null, 'Sin datos', 'No hay unidades trabajadas en este corte.');
      const covered = unitIds.filter((u) =>
        STAGES.every((st) => scope.some((r) => r.unitId === u && r.stage === st.id && r.status === 'aprobado')),
      ).length;
      const v = pct(covered, unitIds.length);
      return local(def, v, formatPct(v), `${covered} de ${unitIds.length} unidad(es) trabajada(s) con recursos aprobados en las cinco etapas.`);
    }
    default:
      return null;
  }
}

export function computeIndicators(resources: Resource[], filters: IndicatorFilters): IndicatorValue[] {
  const scope = resourcesInScope(resources, filters);
  return INDICATORS.map((def) => {
    const localValue = computeLocal(def, scope);
    if (localValue) return localValue;

    const demo = DEMO_INDICATOR_VALUES[def.code];
    if (demo) {
      const v = demo[filters.unitId] ?? demo.todas;
      const display = def.unit === 'ratio' ? v.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : formatPct(v);
      const detail =
        def.code === 'I1'
          ? 'Valor de ejemplo: reducción del tiempo frente a una línea base manual que aún no se ha medido (EN-004).'
          : 'Valor de ejemplo inventado para la demostración. No es una medición.';
      return { code: def.code, source: 'demo', value: v, display, detail, meetsGoal: meets(def, v) };
    }

    return {
      code: def.code,
      source: 'pendiente',
      value: null,
      display: 'Pendiente',
      detail: PENDING_REASONS[def.code] ?? 'Requiere backend o piloto.',
      meetsGoal: null,
    };
  });
}
