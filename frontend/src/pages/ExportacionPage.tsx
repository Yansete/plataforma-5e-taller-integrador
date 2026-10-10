import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, PageHeader, Tag } from '../components/ui';
import { EXPORT_FORMATS, TARGET_LMS_OPTIONS, exportFormatName, resourceTypeName, stageName, targetLmsName } from '../data/catalog';
import {
  EXPORT_STEPS,
  catalogService,
  exportService,
  exportableResources,
  formatForLms,
  formatIssues,
  preferencesService,
  unitShortLabel,
} from '../services';
import { getState, useAppState } from '../store/store';
import type { ExportJob, ExportStepId, ExportStepStatus, TargetLms } from '../types';
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

  const chooseLms = (lms: TargetLms) => {
    preferencesService.update('exportTargetLms', lms);
    preferencesService.update('exportFormat', formatForLms(lms));
    setLastJob(null);
    setError(null);
  };

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
        overline="Paso 5 · Exportación"
        title="Exportación"
        description="Elige recursos aprobados y la plataforma de destino: Moodle importa Moodle XML y Chamilo importa QTI 2.1 (SP-003)."
        actions={
          <ButtonLink to="/indicadores" icon="arrowRight">
            Ver indicadores
          </ButtonLink>
        }
      />

      <Alert tone="info" title="Archivo generado en el navegador">
        El archivo se arma con plantillas fijas a partir de lo aprobado, igual que lo hará el backend (ADR-005). La conexión con la API
        (EN-022) y la verificación de importación en instancias reales de Moodle y Chamilo (TA-006) siguen pendientes.
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
              <CardHeader title="Plataforma de destino" />
              <div className="stack">
                <fieldset className="fieldset">
                  <legend className="fieldset__legend">¿Dónde importarás los ítems?</legend>
                  {TARGET_LMS_OPTIONS.map((o) => {
                    const info = EXPORT_FORMATS.find((f) => f.id === o.format)!;
                    return (
                      <label key={o.id} className="check">
                        <input
                          type="radio"
                          name="destino"
                          value={o.id}
                          checked={targetLms === o.id}
                          disabled={running !== null}
                          onChange={() => chooseLms(o.id)}
                        />
                        <span>
                          <strong>
                            {o.label} · {info.name}
                          </strong>
                          <span className="field__hint" style={{ display: 'block' }}>{info.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
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
                  {`Exportar para ${targetLmsName(targetLms)}`}
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
                  <Alert tone="success" title="Archivo listo para descargar" role="status">
                    Se generó {lastJob.fileName} con {lastJob.resourceIds.length} ítem(s) aprobado(s) para {targetLmsName(lastJob.targetLms)}.
                    La validación en la plataforma y la importación real siguen pendientes (TA-006).
                  </Alert>
                  <DownloadFile job={lastJob} onError={setError} />
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Historial de exportaciones" description="Exportaciones guardadas en este navegador. El archivo se vuelve a generar con el contenido aprobado vigente." />
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
                  <th scope="col">Destino</th>
                  <th scope="col" className="num">Recursos</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Fecha" className="nowrap">{formatDateTime(job.createdAt)}</td>
                    <td data-label="Destino">
                      {targetLmsName(job.targetLms)} · {exportFormatName(job.format)}
                    </td>
                    <td data-label="Recursos" className="num">{job.resourceIds.length}</td>
                    <td data-label="Estado">
                      <Tag tone="review" icon="pending">Generado · importación por verificar</Tag>
                    </td>
                    <td data-label="Resumen">
                      <DownloadFile job={job} compact onError={setError} />
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

function DownloadFile({ job, compact, onError }: { job: ExportJob; compact?: boolean; onError: (message: string) => void }) {
  const legacy = job.format !== 'moodle_xml' && job.format !== 'qti21';
  const download = () => {
    try {
      const file = exportService.buildFile(job, getState());
      const blob = new Blob([file.data], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo generar el archivo.');
    }
  };
  if (legacy) return <span className="caption">Formato anterior, sin archivo</span>;
  if (compact)
    return (
      <Button compact icon="download" onClick={download} aria-label={`Descargar ${job.fileName ?? 'archivo'}`}>
        Descargar
      </Button>
    );
  return (
    <div className="stack stack--tight">
      <Button icon="download" onClick={download}>
        {job.format === 'qti21' ? 'Descargar paquete QTI 2.1 (.zip)' : 'Descargar Moodle XML (.xml)'}
      </Button>
      <span className="caption" style={{ overflowWrap: 'anywhere' }}>{job.fileName}</span>
    </div>
  );
}
