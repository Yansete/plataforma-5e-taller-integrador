/**
 * Unidad de un curso. Cuatro pestañas en el orden de trabajo: Material → Generación → Revisión → Exportación.
 * Los recursos de la unidad se cargan aquí y las pestañas los comparten.
 */
import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { Breadcrumb, ButtonLink, EmptyState, PageHeader } from '../../components/ui';
import { errorMessage } from '../../services/api';
import { unitDocuments } from '../../services/material';
import { countByStatus, listResources } from '../../services/revision';
import { useData } from '../../state/datos';
import type { Course, Resource, Unit } from '../../types';
import { plural } from '../../utils/format';
import { LoadingCourses } from '../estado';
import { usePageTitle } from '../usePageTitle';
import { ExportacionTab } from './ExportacionTab';
import { GeneracionTab } from './GeneracionTab';
import { MaterialTab } from './MaterialTab';
import { RevisionTab } from './RevisionTab';

export const TABS = [
  { id: 'material', label: 'Material' },
  { id: 'generacion', label: 'Generación' },
  { id: 'revision', label: 'Revisión' },
  { id: 'exportacion', label: 'Exportación' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export function UnidadPage() {
  const { courseId, unitId, tab } = useParams();
  const { courses, documents, reloadSummary } = useData();
  const course = courses?.find((c) => c.id === courseId);
  const unit = course?.units.find((u) => u.id === unitId);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [resourcesError, setResourcesError] = useState('');
  usePageTitle(unit ? `Unidad ${unit.number}: ${unit.title}` : 'Unidad');

  const loadResources = useCallback(async () => {
    if (!unitId) return;
    setResourcesError('');
    try {
      setResources(await listResources(unitId));
    } catch (e) {
      setResourcesError(errorMessage(e));
    }
  }, [unitId]);

  useEffect(() => {
    setResources(null);
    if (unit) void loadResources();
  }, [unit?.id, loadResources]);

  /** Agrega o reemplaza recursos en la lista y actualiza los contadores del curso. */
  const upsertResources = useCallback(
    (changed: Resource[]) => {
      setResources((list) => {
        const byId = new Map((list ?? []).map((r) => [r.id, r]));
        for (const r of changed) byId.set(r.id, r);
        return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      void reloadSummary();
    },
    [reloadSummary],
  );

  const removeResource = useCallback(
    (id: string) => {
      setResources((list) => (list ?? []).filter((r) => r.id !== id));
      void reloadSummary();
    },
    [reloadSummary],
  );

  if (courses === null) return <LoadingCourses />;
  if (!course || !unit)
    return (
      <EmptyState icon="book" title="No encontramos esta unidad" action={<ButtonLink to="/">Volver a Mis cursos</ButtonLink>}>
        Puede que el curso se haya borrado.
      </EmptyState>
    );
  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/cursos/${course.id}/unidades/${unit.id}/material`} replace />;

  const base = `/cursos/${course.id}/unidades/${unit.id}`;
  const docs = unitDocuments(documents, unit.id);
  const counts = countByStatus(resources ?? []);
  const shared = { course, unit, base, resources, resourcesError, reloadResources: loadResources, upsertResources, removeResource };

  return (
    <div className="stack stack--loose">
      <Breadcrumb items={[{ label: 'Mis cursos', to: '/' }, { label: `${course.code} · ${course.name}`, to: `/cursos/${course.id}` }, { label: `Unidad ${unit.number}` }]} />
      <PageHeader
        overline={`Unidad ${unit.number}`}
        title={unit.title}
        actions={
          resources && (
            <span className="tag tag--approved" role="status">
              {plural(counts.aprobado, 'recurso aprobado', 'recursos aprobados')}
            </span>
          )
        }
      >
        {unit.outcomes.length > 0 && (
          <ul className="chip-list" aria-label="Resultados de aprendizaje">
            {unit.outcomes.map((o) => (
              <li key={o.id} className="chip" title={o.text}>
                <strong>{o.code}</strong> {o.text.length > 70 ? `${o.text.slice(0, 70).trimEnd()}…` : o.text}
              </li>
            ))}
          </ul>
        )}
      </PageHeader>

      <nav className="tabs" aria-label="Pasos de la unidad">
        {TABS.map((t, i) => (
          <NavLink key={t.id} to={`${base}/${t.id}`} className="tab">
            <span className="tab__number" aria-hidden="true">
              {i + 1}
            </span>
            {t.label}
            {t.id === 'revision' && counts.pendiente > 0 && <span className="tab__badge">{counts.pendiente} por revisar</span>}
          </NavLink>
        ))}
      </nav>

      {tab === 'material' && <MaterialTab {...shared} documents={docs} />}
      {tab === 'generacion' && <GeneracionTab {...shared} documents={docs} />}
      {tab === 'revision' && <RevisionTab {...shared} />}
      {tab === 'exportacion' && <ExportacionTab {...shared} />}
    </div>
  );
}

export interface UnitTabProps {
  course: Course;
  unit: Unit;
  /** Ruta de la unidad, sin la pestaña. */
  base: string;
  /** null mientras se cargan. */
  resources: Resource[] | null;
  resourcesError: string;
  reloadResources: () => Promise<void>;
  upsertResources: (changed: Resource[]) => void;
  removeResource: (id: string) => void;
}
