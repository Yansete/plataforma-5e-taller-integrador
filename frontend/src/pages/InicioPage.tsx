import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ReviewStatusTag, StageCoverage } from '../components/domain';
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader } from '../components/ui';
import { resourceTypeName, stageName } from '../data/catalog';
import { catalogService, preferencesService, unitShortLabel } from '../services';
import { useAppState } from '../store/store';
import { formatDateTime } from '../utils/format';

type StepState = 'done' | 'current' | 'todo';

export function InicioPage() {
  const documents = useAppState((s) => s.documents);
  const resources = useAppState((s) => s.resources);
  const exportsDone = useAppState((s) => s.exports);
  const navigate = useNavigate();
  const units = catalogService.listUnits();

  const stats = useMemo(() => {
    const processed = documents.filter((d) => d.status === 'procesado').length;
    const pending = resources.filter((r) => r.status === 'pendiente').length;
    const approved = resources.filter((r) => r.status === 'aprobado').length;
    return { processed, pending, approved };
  }, [documents, resources]);

  const recent = useMemo(
    () => [...resources].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [resources],
  );

  const steps: { n: number; title: string; text: string; to: string; state: StepState; cta: string }[] = useMemo(() => {
    const hasMaterial = stats.processed > 0;
    const hasResources = resources.length > 0;
    const allDecided = hasResources && stats.pending === 0;
    const hasExport = exportsDone.length > 0;
    const flags = [hasMaterial, hasResources, allDecided && stats.approved > 0, hasExport];
    const firstOpen = flags.findIndex((f) => !f);
    const stateFor = (i: number): StepState => (flags[i] ? 'done' : i === firstOpen ? 'current' : 'todo');
    return [
      { n: 1, title: 'Cargar material', text: `${stats.processed} documento(s) procesado(s).`, to: '/carga', state: stateFor(0), cta: 'Ir a carga' },
      { n: 2, title: 'Configurar la generación', text: `${resources.length} recurso(s) propuesto(s).`, to: '/configuracion', state: stateFor(1), cta: 'Configurar' },
      { n: 3, title: 'Revisar con evidencia', text: `${stats.pending} en revisión · ${stats.approved} aprobado(s).`, to: '/revision', state: stateFor(2), cta: 'Revisar' },
      { n: 4, title: 'Exportar lo aprobado', text: `${exportsDone.length} exportación(es) simulada(s).`, to: '/exportacion', state: stateFor(3), cta: 'Exportar' },
    ];
  }, [stats, resources.length, exportsDone.length]);

  const next = steps.find((s) => s.state === 'current') ?? { to: '/indicadores', cta: 'Ver indicadores', title: 'Indicadores' };

  const openResource = (id: string) => {
    preferencesService.update('selectedResourceId', id);
    navigate('/revision');
  };

  return (
    <>
      <PageHeader
        overline="Inicio del docente"
        title="Resumen de tu trabajo"
        description={`${catalogService.getCourse().name} · Periodo ${catalogService.getCourse().term}. Prepara secuencias didácticas 5E a partir de tu material y revísalas antes de exportarlas.`}
        actions={
          <ButtonLink to={next.to} variant="primary" icon="arrowRight">
            {`Continuar: ${next.title}`}
          </ButtonLink>
        }
      />

      <section aria-labelledby="resumen-titulo">
        <h2 id="resumen-titulo" className="visually-hidden">
          Resumen
        </h2>
        <div className="grid grid--4">
          <StatTile label="Documentos procesados" value={stats.processed} note={`de ${documents.length} registrados`} />
          <StatTile label="Recursos en revisión" value={stats.pending} note="esperan tu decisión" />
          <StatTile label="Recursos aprobados" value={stats.approved} note="disponibles para exportar" />
          <StatTile label="Exportaciones" value={exportsDone.length} note="simuladas, sin paquete real" />
        </div>
      </section>

      <div className="split">
        <Card>
          <CardHeader title="Recorrido principal" description="Cada paso usa lo que hiciste en el anterior. Puedes volver a cualquiera." />
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.n} className={`step step--${s.state === 'done' ? 'done' : s.state === 'current' ? 'current' : 'todo'}`}>
                <span className="step__marker" aria-hidden="true">
                  {s.state === 'done' ? <Icon name="check" /> : s.n}
                </span>
                <div className="step__body">
                  <div className="step__head">
                    <span className="title">{`${s.n}. ${s.title}`}</span>
                    <span className="caption">{s.state === 'done' ? '· Hecho' : s.state === 'current' ? '· Siguiente paso' : '· Por hacer'}</span>
                  </div>
                  <span className="caption">{s.text}</span>
                </div>
                <ButtonLink to={s.to} compact variant={s.state === 'current' ? 'primary' : 'secondary'}>
                  {s.cta}
                </ButtonLink>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Cómo funciona esta demostración" />
          <ul className="stack stack--tight text-ui" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
            <li>La generación entrega ejemplos preparados; no hay IA conectada.</li>
            <li>Ningún recurso se aprueba sin tu acción explícita.</li>
            <li>Solo lo aprobado puede exportarse, y la exportación no produce paquetes válidos.</li>
            <li>Los archivos que selecciones no se leen ni se guardan; solo sus metadatos.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Secuencia 5E por unidad"
          description="Una unidad está cubierta cuando tiene al menos un recurso aprobado en cada una de las cinco etapas (I23)."
          actions={<ButtonLink to="/configuracion" compact icon="sliders">Generar recursos</ButtonLink>}
        />
        <div className="stack stack--loose">
          {units.map((u) => (
            <div key={u.id} className="stack stack--tight">
              <span className="title">{`Unidad ${u.number}: ${u.title}`}</span>
              <StageCoverage unitId={u.id} resources={resources} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Recursos recientes" description="Últimos recursos propuestos o modificados." />
        {recent.length === 0 ? (
          <EmptyState icon="layers" title="Todavía no hay recursos" action={<ButtonLink to="/configuracion" variant="primary">Configurar una generación</ButtonLink>}>
            Genera recursos a partir del material procesado para empezar la revisión.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Recurso">
                      <button type="button" className="link-button" onClick={() => openResource(r.id)} style={{ textAlign: 'left' }}>
                        {r.title}
                      </button>
                      <div className="caption">{resourceTypeName(r.type)}</div>
                    </td>
                    <td data-label="Unidad">{unitShortLabel(r.unitId)}</td>
                    <td data-label="Etapa">{stageName(r.stage)}</td>
                    <td data-label="Estado">
                      <ReviewStatusTag status={r.status} edited={r.edited} />
                    </td>
                    <td data-label="Actualizado" className="nowrap">
                      {formatDateTime(r.updatedAt)}
                    </td>
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

function StatTile({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="card stack stack--tight">
      <span className="overline">{label}</span>
      <span className="display-number">{value}</span>
      <span className="caption">{note}</span>
    </div>
  );
}
