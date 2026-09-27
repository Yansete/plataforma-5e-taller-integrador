import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, PageHeader, SelectField, Tag } from '../components/ui';
import { EXPORT_FORMATS, TARGET_LMS_OPTIONS, exportFormatName, resourceTypeName, stageName } from '../data/catalog';
import {
  EXPORT_STEPS,
  catalogService,
  exportService,
  exportableResources,
  formatIssues,
  preferencesService,
  unitShortLabel,
} from '../services';
import { getState, useAppState } from '../store/store';
import type { ExportFormat, ExportJob, ExportStepId, ExportStepStatus } from '../types';
import { formatDateTime } from '../utils/format';

export function ExportacionPage() {
  const resources = useAppState((s) => s.resources);
  const savedSelection = useAppState((s) => s.ui.exportSelection);
  const format = useAppState((s) => s.ui.exportFormat);
  const targetLms = useAppState((s) => s.ui.exportTargetLms);
  const history = useAppState((s) => s.exports);

  const [running, setRunning] = useState<ExportStepId | null>(null);
  const [lastJob, setLastJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approved = useMemo(() => exportableResources(resources), [resources]);
  const approvedIds = useMemo(() => new Set(approved.map((r) => r.id)), [approved]);
  // La selección guardada se limita siempre a lo que sigue aprobado.
  const selection = useMemo(() => savedSelection.filter((id) => approvedIds.has(id)), [savedSelection, approvedIds]);
  const selectedResources = approved.filter((r) => selection.includes(r.id));
  const excluded = {
    pendiente: resources.filter((r) => r.status === 'pendiente').length,
    descartado: resources.filter((r) => r.status === 'descartado').length,
  };
  const issue = selectedResources.length > 0 ? formatIssues(format, selectedResources) : null;

  const setSelection = (ids: string[]) => {
    preferencesService.update('exportSelection', ids);
    setLastJob(null);
    setError(null);
  };

  const toggle = (id: string, checked: boolean) => setSelection(checked ? [...selection, id] : selection.filter((x) => x !== id));
  const allSelected = approved.length > 0 && selection.length === approved.length;

  const run = async () => {
    setError(null);
    setLastJob(null);
    try {
      const job = await exportService.runExport({ format, resourceIds: selection, targetLms }, setRunning);
      setLastJob(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la exportación simulada.');
    } finally {
      setRunning(null);
    }
  };

  const stepStatus = (id: ExportStepId): ExportStepStatus | 'en_curso' | 'por_hacer' => {
    if (lastJob) return lastJob.steps[id];
    if (running) {
      const order = EXPORT_STEPS.map((s) => s.id);
      const current = order.indexOf(running);
      const mine = order.indexOf(id);
      if (mine < current) return 'completado';
      if (mine === current) return 'en_curso';
      return mine >= order.indexOf('validacion') ? 'pendiente' : 'por_hacer';
    }
    if (id === 'seleccion') return selection.length > 0 ? 'completado' : 'por_hacer';
    if (id === 'formato') return selection.length > 0 && !issue ? 'completado' : 'por_hacer';
    return id === 'empaquetado' ? 'por_hacer' : 'pendiente';
  };

  return (
    <>
      <PageHeader
        overline="Paso 4 · Exportación"
        title="Exportación"
        description="Elige recursos aprobados y el formato de destino. La exportación está simulada: no se genera ningún paquete QTI, SCORM ni Common Cartridge."
      />

      <Alert tone="warn" title="Integración pendiente">
        El exportador real, la validación con el validador de 1EdTech y las pruebas de importación en LMS se implementarán con el backend
        (HU-018, HU-019, TA-002). El resumen descargable de esta pantalla no es un paquete válido.
      </Alert>

      {approved.length === 0 ? (
        <Card>
          <EmptyState icon="export" title="Aún no hay recursos aprobados" action={<ButtonLink to="/revision" variant="primary">Ir a revisión</ButtonLink>}>
            Solo se pueden exportar recursos que aprobaste de forma explícita en la revisión.
            {excluded.pendiente > 0 && ` Tienes ${excluded.pendiente} recurso(s) esperando tu decisión.`}
          </EmptyState>
        </Card>
      ) : (
        <div className="split">
          <Card>
            <CardHeader
              title="Recursos aprobados"
              description={`${selection.length} de ${approved.length} seleccionado(s). No aparecen ${excluded.pendiente} en revisión ni ${excluded.descartado} descartado(s).`}
              actions={
                <Button compact onClick={() => setSelection(allSelected ? [] : approved.map((r) => r.id))}>
                  {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
                </Button>
              }
            />
            <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {approved.map((r) => {
                const checked = selection.includes(r.id);
                return (
                  <li key={r.id} className={checked ? 'card card--inner option-card--selected' : 'card card--inner'} style={{ padding: 'var(--space-2) var(--space-3)' }}>
                    <label className="check">
                      <input type="checkbox" checked={checked} onChange={(e) => toggle(r.id, e.target.checked)} disabled={running !== null} />
                      <span className="stack stack--tight" style={{ gap: 2 }}>
                        <strong>{r.title}</strong>
                        <span className="caption">
                          {unitShortLabel(r.unitId)} · {stageName(r.stage)} · {resourceTypeName(r.type)}
                          {r.edited ? ' · editado por el docente' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="stack">
            <Card>
              <CardHeader title="Formato y destino" />
              <div className="stack">
                <fieldset className="fieldset">
                  <legend className="fieldset__legend">Formato</legend>
                  {EXPORT_FORMATS.map((f) => (
                    <label key={f.id} className="check">
                      <input
                        type="radio"
                        name="formato"
                        value={f.id}
                        checked={format === f.id}
                        disabled={running !== null}
                        onChange={() => {
                          preferencesService.update('exportFormat', f.id as ExportFormat);
                          setLastJob(null);
                          setError(null);
                        }}
                      />
                      <span>
                        <strong>{f.name}</strong> {f.role === 'respaldo' && <span className="tag">Respaldo</span>}
                        <span className="field__hint" style={{ display: 'block' }}>{f.description}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <SelectField
                  label="LMS de destino"
                  value={targetLms}
                  onChange={(v) => preferencesService.update('exportTargetLms', v)}
                  options={TARGET_LMS_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                  hint="Los LMS objetivo se definirán con la matriz de compatibilidad (SP-001)."
                />
                {issue && (
                  <Alert tone="warn" title="Formato incompatible con la selección" role="alert">
                    {issue}
                  </Alert>
                )}
                {error && (
                  <Alert tone="warn" title="No se pudo exportar" role="alert">
                    {error}
                  </Alert>
                )}
                <Button variant="primary" icon="export" onClick={run} loading={running !== null} disabled={selection.length === 0 || Boolean(issue) || running !== null}>
                  Exportar selección (simulado)
                </Button>
                {selection.length === 0 && <span className="caption">Selecciona al menos un recurso aprobado.</span>}
              </div>
            </Card>

            <Card aria-live="polite">
              <CardHeader title="Flujo de exportación" description={`${exportFormatName(format)} · ${selection.length} recurso(s)`} />
              <ol className="steps">
                {EXPORT_STEPS.map((s, i) => (
                  <FlowStep key={s.id} n={i + 1} label={s.label} note={s.pendingNote} status={stepStatus(s.id)} />
                ))}
              </ol>
              {lastJob && (
                <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
                  <Alert tone="success" title="Exportación simulada registrada" role="status">
                    Se registró la solicitud con {lastJob.resourceIds.length} recurso(s). No se generó ningún paquete; la validación y la
                    importación siguen pendientes.
                  </Alert>
                  <DownloadSummary job={lastJob} />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Historial de exportaciones" description="Solicitudes simuladas guardadas en este navegador." />
        {history.length === 0 ? (
          <EmptyState icon="clock" title="Sin exportaciones todavía">
            Cuando exportes una selección, aparecerá aquí.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Formato</th>
                  <th scope="col" className="num">Recursos</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Resumen</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Fecha" className="nowrap">{formatDateTime(job.createdAt)}</td>
                    <td data-label="Formato">{exportFormatName(job.format)}</td>
                    <td data-label="Recursos" className="num">{job.resourceIds.length}</td>
                    <td data-label="Estado">
                      <Tag tone="review" icon="pending">Simulada · validación pendiente</Tag>
                    </td>
                    <td data-label="Resumen">
                      <DownloadSummary job={job} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="caption">
        Curso: {catalogService.getCourse().name}. Los recursos que devuelvas a revisión dejan de estar disponibles para exportar.
      </p>
    </>
  );
}

function FlowStep({ n, label, note, status }: { n: number; label: string; note: string; status: ExportStepStatus | 'en_curso' | 'por_hacer' }) {
  const map = {
    completado: { cls: 'step step--done', text: 'Completado', icon: <Icon name="check" /> },
    simulado: { cls: 'step step--done', text: 'Simulado', icon: <Icon name="check" /> },
    en_curso: { cls: 'step step--current', text: 'En curso', icon: <span className="spinner" style={{ width: 14, height: 14 }} /> },
    pendiente: { cls: 'step step--pending', text: 'Pendiente de integración', icon: <Icon name="pending" /> },
    por_hacer: { cls: 'step', text: 'Por hacer', icon: <>{n}</> },
  }[status];
  return (
    <li className={map.cls}>
      <span className="step__marker" aria-hidden="true">
        {map.icon}
      </span>
      <div className="step__body">
        <div className="step__head">
          <span className="title">{label}</span>
          <span className="caption">· {map.text}</span>
        </div>
        {note && (status === 'pendiente' || status === 'simulado') && <span className="caption">{note}</span>}
      </div>
    </li>
  );
}

function DownloadSummary({ job, compact }: { job: ExportJob; compact?: boolean }) {
  const download = () => {
    const json = exportService.buildSummary(job, getState());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumen-exportacion-DEMO-${job.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <Button compact icon="download" onClick={download}>
      {compact ? 'Resumen JSON' : 'Descargar resumen (JSON, no importable)'}
    </Button>
  );
}
