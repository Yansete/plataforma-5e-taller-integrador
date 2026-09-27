import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SourceTag } from '../components/domain';
import { Alert, Card, CardHeader, EmptyState, PageHeader, ProgressBar, SelectField, Tag } from '../components/ui';
import { discardReasonLabel } from '../data/catalog';
import { INDICATORS } from '../data/indicators';
import { ACTION_LABELS, catalogService, computeIndicators, inPeriod, preferencesService, unitShortLabel } from '../services';
import { useAppState } from '../store/store';
import type { DashboardPeriod, IndicatorDefinition, IndicatorValue } from '../types';
import { formatDateTime } from '../utils/format';

export function IndicadoresPage() {
  const resources = useAppState((s) => s.resources);
  const reviewLog = useAppState((s) => s.reviewLog);
  const filters = useAppState((s) => s.ui.dashboardFilters);
  const units = catalogService.listUnits();
  const [view, setView] = useState<'tarjetas' | 'tabla'>('tarjetas');

  const values = useMemo(() => computeIndicators(resources, filters), [resources, filters]);

  const rows = INDICATORS.filter((d) => filters.scope === 'todos' || d.inDashboard).map((def) => ({
    def,
    value: values.find((v) => v.code === def.code)!,
  }));

  const counts = {
    local: rows.filter((r) => r.value.source === 'local').length,
    demo: rows.filter((r) => r.value.source === 'demo').length,
    pendiente: rows.filter((r) => r.value.source === 'pendiente').length,
  };

  const log = useMemo(() => {
    const titles = new Map(resources.map((r) => [r.id, r]));
    return reviewLog
      .filter((e) => {
        const r = titles.get(e.resourceId);
        return (filters.unitId === 'todas' || r?.unitId === filters.unitId) && inPeriod(e.at, filters.period);
      })
      .slice(0, 12)
      .map((e) => ({ entry: e, resource: titles.get(e.resourceId) }));
  }, [reviewLog, resources, filters]);

  const setFilter = (patch: Partial<typeof filters>) => preferencesService.update('dashboardFilters', { ...filters, ...patch });

  return (
    <>
      <PageHeader
        overline="Tablero de indicadores"
        title="Indicadores del proyecto"
        description="Valor actual frente a la meta documentada (S2 Product Discovery, HU-021). Cada indicador indica si se calcula aquí, si es un ejemplo o si está pendiente."
      />

      <Card>
        <div className="grid grid--4">
          <SelectField
            label="Unidad"
            value={filters.unitId}
            onChange={(v) => setFilter({ unitId: v })}
            options={[{ value: 'todas', label: 'Todas las unidades' }, ...units.map((u) => ({ value: u.id, label: `Unidad ${u.number}` }))]}
          />
          <SelectField
            label="Periodo"
            value={filters.period}
            onChange={(v) => setFilter({ period: v as DashboardPeriod })}
            options={[
              { value: 'todo', label: 'Todo el periodo' },
              { value: '7dias', label: 'Últimos 7 días' },
              { value: 'hoy', label: 'Hoy' },
            ]}
          />
          <SelectField
            label="Indicadores"
            value={filters.scope}
            onChange={(v) => setFilter({ scope: v as 'tablero' | 'todos' })}
            options={[
              { value: 'tablero', label: 'Los del tablero (HU-021)' },
              { value: 'todos', label: 'Los 23 indicadores' },
            ]}
          />
          <SelectField
            label="Vista"
            value={view}
            onChange={(v) => setView(v as 'tarjetas' | 'tabla')}
            options={[
              { value: 'tarjetas', label: 'Tarjetas' },
              { value: 'tabla', label: 'Tabla' },
            ]}
          />
        </div>
      </Card>

      <Alert tone="info" title="Cómo leer el tablero">
        <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
          <li>
            <strong>Calculado localmente ({counts.local}):</strong> se obtiene de tus acciones en esta demostración (generaciones y decisiones de revisión).
          </li>
          <li>
            <strong>Ejemplo, no es medición ({counts.demo}):</strong> valor inventado para mostrar el diseño; no representa resultados del proyecto.
          </li>
          <li>
            <strong>Pendiente ({counts.pendiente}):</strong> necesita backend, piloto con docentes y estudiantes o validadores externos.
          </li>
          <li>El filtro de periodo solo afecta a los indicadores calculados localmente (según la fecha de propuesta de cada recurso).</li>
        </ul>
      </Alert>

      {view === 'tarjetas' ? (
        <section aria-label="Indicadores" className="grid grid--3">
          {rows.map(({ def, value }) => (
            <IndicatorCard key={def.code} def={def} value={value} />
          ))}
        </section>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="visually-hidden">Indicadores: valor, meta, estado y origen</caption>
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  <th scope="col" className="num">Valor</th>
                  <th scope="col">Meta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Origen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ def, value }) => (
                  <tr key={def.code}>
                    <td data-label="Indicador">
                      <strong>{def.code}</strong> {def.name}
                      <div className="caption">{value.detail}</div>
                    </td>
                    <td data-label="Valor" className="num nowrap">{value.display}</td>
                    <td data-label="Meta">{def.goalText}</td>
                    <td data-label="Estado"><GoalStatus value={value} /></td>
                    <td data-label="Origen"><SourceTag source={value.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="caption">(*) Meta propuesta por el equipo; se recalibra tras medir la línea base local (S2).</p>

      <Card>
        <CardHeader
          title="Registro de decisiones de revisión"
          description={`Fuente de I2, I3 e I5 (EN-006). ${unitFilterLabel(filters.unitId)} · ${periodLabel(filters.period)}.`}
        />
        {log.length === 0 ? (
          <EmptyState icon="review" title="Sin decisiones registradas en este corte">
            Aprueba, edita o descarta recursos en la revisión para alimentar los indicadores calculados localmente.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Recurso</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {log.map(({ entry, resource }) => (
                  <tr key={entry.id}>
                    <td data-label="Fecha" className="nowrap">{formatDateTime(entry.at)}</td>
                    <td data-label="Acción">{ACTION_LABELS[entry.action]}{entry.optionId ? ` (${entry.optionId.toUpperCase()})` : ''}</td>
                    <td data-label="Recurso">{resource ? `${resource.title} · ${unitShortLabel(resource.unitId)}` : 'Recurso eliminado'}</td>
                    <td data-label="Motivo">{entry.reason ? discardReasonLabel(entry.reason) : '—'}</td>
                    <td data-label="Usuario">{entry.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function unitFilterLabel(unitId: string) {
  return unitId === 'todas' ? 'Todas las unidades' : unitShortLabel(unitId);
}

function periodLabel(p: DashboardPeriod) {
  return p === 'todo' ? 'Todo el periodo' : p === '7dias' ? 'Últimos 7 días' : 'Hoy';
}

function GoalStatus({ value }: { value: IndicatorValue }) {
  if (value.meetsGoal === null) return <Tag icon="pending">Sin comparación</Tag>;
  if (value.meetsGoal)
    return (
      <Tag tone="approved" icon="check">
        {value.source === 'demo' ? 'En meta (ejemplo)' : 'En meta'}
      </Tag>
    );
  return (
    <Tag tone="review" icon="alert">
      {value.source === 'demo' ? 'Fuera de meta (ejemplo)' : 'Fuera de meta'}
    </Tag>
  );
}

function barScale(def: IndicatorDefinition, value: number): { max: number; goal?: number } | null {
  if (!def.goal || def.goal.op === 'rango') return null;
  if (def.unit === 'ratio') return { max: 1, goal: def.goal.value };
  if (def.unit !== '%') return null;
  if (def.goal.op === '>=') return { max: 100, goal: def.goal.value };
  return { max: Math.max(def.goal.value * 4, value * 1.25, 1), goal: def.goal.value };
}

function IndicatorCard({ def, value }: { def: IndicatorDefinition; value: IndicatorValue }) {
  const scale = value.value !== null ? barScale(def, value.value) : null;
  return (
    <article className="card stack stack--tight" aria-labelledby={`ind-${def.code}`}>
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="overline">{def.code}</span>
        <SourceTag source={value.source} />
      </div>
      <h2 className="title" id={`ind-${def.code}`}>
        {def.name}
      </h2>
      <span className={value.value === null ? 'display-number muted' : 'display-number'}>{value.display}</span>
      {scale && value.value !== null && (
        <ProgressBar
          value={value.value}
          max={scale.max}
          goal={scale.goal}
          label={`${def.code}: ${value.display}; meta ${def.goalText}`}
          tone={value.meetsGoal === false ? 'warn' : 'accent'}
        />
      )}
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="text-ui">
          <Icon name="target" size={16} /> Meta: {def.goalText}
        </span>
        <GoalStatus value={value} />
      </div>
      <p className="caption">{value.detail}</p>
    </article>
  );
}
