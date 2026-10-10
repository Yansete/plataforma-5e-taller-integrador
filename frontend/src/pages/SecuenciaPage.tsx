import { useNavigate } from 'react-router-dom';
import { ReviewStatusTag } from '../components/domain';
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, SelectField, Tag } from '../components/ui';
import { STAGES, resourceTypeName } from '../data/catalog';
import { catalogService, preferencesService } from '../services';
import { useAppState } from '../store/store';
import type { Resource, ResourceType } from '../types';

/** Formato en que se presenta cada tipo de recurso (SP-002). Los formatos multimedia e interactivos llegan con HU-006. */
const FORMAT_OF: Record<ResourceType, string> = {
  pregunta_detonante: 'Textual',
  sondeo_diagnostico: 'Textual',
  guia_exploracion: 'Textual',
  caso_indagacion: 'Textual',
  explicacion: 'Textual con citas',
  glosario: 'Textual',
  ejercicio_aplicacion: 'Textual',
  item_opcion_multiple: 'Ítem de evaluación',
};

/**
 * Vista de la secuencia 5E de una unidad (prototipo para el recorrido de HU-054; la historia
 * completa es HU-040/HU-044). Muestra qué recursos tiene cada etapa y su estado de revisión.
 */
export function SecuenciaPage() {
  const resources = useAppState((s) => s.resources);
  const unitId = useAppState((s) => s.ui.reviewFilters.unitId);
  const filters = useAppState((s) => s.ui.reviewFilters);
  const navigate = useNavigate();
  const units = catalogService.listUnits();
  const selectedUnit = unitId !== 'todas' && units.some((u) => u.id === unitId) ? unitId : units.find((u) => resources.some((r) => r.unitId === u.id))?.id ?? units[0]?.id;
  const unitResources = resources.filter((r) => r.unitId === selectedUnit);
  const approved = unitResources.filter((r) => r.status === 'aprobado').length;
  const covered = STAGES.filter((st) => unitResources.some((r) => r.stage === st.id && r.status === 'aprobado')).length;

  const open = (r: Resource) => {
    preferencesService.update('reviewFilters', { ...filters, unitId: r.unitId, stage: 'todas', status: 'todos' });
    preferencesService.update('selectedResourceId', r.id);
    navigate('/revision');
  };

  return (
    <>
      <PageHeader
        overline="Paso 3 · Secuencia 5E"
        title="Secuencia 5E"
        description="Recursos propuestos para cada etapa de la unidad. Abre uno para revisarlo con su evidencia, regenerarlo o aprobarlo."
        actions={
          <ButtonLink to="/revision" variant="primary" icon="arrowRight">
            Ir a revisión
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader
          title="Unidad"
          description={`${unitResources.length} recurso(s) · ${approved} aprobado(s) · ${covered} de 5 etapas con al menos un aprobado`}
        />
        <SelectField
          label="Unidad de la secuencia"
          value={selectedUnit ?? ''}
          onChange={(v) => preferencesService.update('reviewFilters', { ...filters, unitId: v })}
          options={units.map((u) => ({ value: u.id, label: `Unidad ${u.number}: ${u.title}` }))}
        />
      </Card>

      <ol className="sequence-board" aria-label="Etapas de la secuencia 5E">
        {STAGES.map((st) => {
          const inStage = unitResources.filter((r) => r.stage === st.id);
          return (
            <li key={st.id} className="card sequence-column" aria-labelledby={`etapa-${st.id}`}>
              <div className="stack stack--tight">
                <h2 className="title" id={`etapa-${st.id}`}>
                  {st.name} <span className="caption">({st.english})</span>
                </h2>
                <p className="caption">{st.intent}</p>
              </div>
              {inStage.length === 0 ? (
                <EmptyState icon="layers" title="Sin recursos" action={<ButtonLink to="/chat" compact>Pedir uno</ButtonLink>}>
                  Aún no hay propuestas para esta etapa.
                </EmptyState>
              ) : (
                <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {inStage.map((r) => (
                    <li key={r.id}>
                      <button type="button" className="queue__item" onClick={() => open(r)} aria-label={`Abrir «${r.title}» en revisión`}>
                        <span className="queue__main">
                          <span className="queue__title">{r.title}</span>
                          <span className="caption">
                            {resourceTypeName(r.type)} · {FORMAT_OF[r.type]}
                            {r.version > 1 ? ` · versión ${r.version}` : ''}
                          </span>
                        </span>
                        <ReviewStatusTag status={r.status} edited={r.edited} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <p className="caption">
        <Tag icon="info">Prototipo</Tag> Los formatos gamificado, multimedia e interactivo (SP-002) se añadirán con el catálogo de tipos de recurso
        (HU-006); por ahora la demostración solo tiene recursos textuales e ítems.
      </p>
    </>
  );
}
