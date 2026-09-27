/**
 * Componentes del dominio compartidos por varias pantallas.
 * Todo estado se comunica con texto e icono además del color (sección 2.3).
 */
import { STAGES } from '../data/catalog';
import { catalogService } from '../services';
import type { DistractorDecision, DocumentStatus, IndicatorSource, Resource, ReviewStatus } from '../types';
import { Icon } from './Icon';
import { Tag } from './ui';

export function ReviewStatusTag({ status, edited }: { status: ReviewStatus; edited?: boolean }) {
  if (status === 'aprobado')
    return (
      <Tag tone="approved" icon="check">
        {edited ? 'Aprobado con edición' : 'Aprobado'}
      </Tag>
    );
  if (status === 'descartado')
    return (
      <Tag tone="discarded" icon="x">
        Descartado
      </Tag>
    );
  return (
    <Tag tone="review" icon="pending">
      {edited ? 'En revisión (editado)' : 'En revisión'}
    </Tag>
  );
}

export function DistractorTag({ decision, edited }: { decision: DistractorDecision; edited: boolean }) {
  if (decision === 'aceptado')
    return (
      <Tag tone="approved" icon="check">
        {edited ? 'Aceptado con edición' : 'Aceptado'}
      </Tag>
    );
  if (decision === 'descartado')
    return (
      <Tag tone="discarded" icon="x">
        Descartado
      </Tag>
    );
  return (
    <Tag tone="review" icon="pending">
      Sin decidir
    </Tag>
  );
}

export function DocumentStatusTag({ status }: { status: DocumentStatus }) {
  switch (status) {
    case 'procesado':
      return (
        <Tag tone="approved" icon="check">
          Procesado
        </Tag>
      );
    case 'procesando':
      return (
        <Tag tone="review" icon="clock">
          Procesando (simulado)
        </Tag>
      );
    case 'error':
      return (
        <Tag tone="discarded" icon="alert">
          Error
        </Tag>
      );
    default:
      return (
        <Tag tone="outline" icon="file">
          Registrado, sin procesar
        </Tag>
      );
  }
}

export function SourceTag({ source }: { source: IndicatorSource }) {
  if (source === 'local')
    return (
      <Tag tone="outline" icon="check">
        Calculado localmente
      </Tag>
    );
  if (source === 'demo')
    return (
      <Tag tone="review" icon="info">
        Ejemplo, no es medición
      </Tag>
    );
  return (
    <Tag icon="pending">
      Pendiente
    </Tag>
  );
}

/** Cobertura de la secuencia 5E de una unidad: aprobados / propuestos por etapa (HU-014, I23). */
export function StageCoverage({ unitId, resources, compact }: { unitId: string; resources: Resource[]; compact?: boolean }) {
  const unitResources = resources.filter((r) => r.unitId === unitId);
  return (
    <ol className={compact ? 'stage-strip stage-strip--compact' : 'stage-strip'} aria-label="Cobertura de la secuencia 5E">
      {STAGES.map((stage) => {
        const inStage = unitResources.filter((r) => r.stage === stage.id);
        const approved = inStage.filter((r) => r.status === 'aprobado').length;
        const pending = inStage.filter((r) => r.status === 'pendiente').length;
        const complete = approved > 0;
        return (
          <li key={stage.id} className={complete ? 'stage-cell stage-cell--complete' : 'stage-cell'}>
            <span className="stage-cell__name">{stage.name}</span>
            <span className="caption">{stage.english}</span>
            <span className="cluster text-ui">
              <Icon name={complete ? 'check' : 'pending'} size={16} />
              {complete ? `${approved} aprobado${approved === 1 ? '' : 's'}` : 'Sin aprobados'}
            </span>
            {pending > 0 && <span className="caption">{pending} en revisión</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Tarjeta de un fragmento de evidencia con su ubicación en el documento de origen. */
export function FragmentCard({ fragmentId, highlight }: { fragmentId: string; highlight?: boolean }) {
  const [fragment] = catalogService.getFragments([fragmentId]);
  if (!fragment) {
    return (
      <div className="card card--inner">
        <p className="caption">Fragmento {fragmentId} no disponible.</p>
      </div>
    );
  }
  return (
    <figure className={highlight ? 'card card--inner card--soft' : 'card card--inner'} style={{ margin: 0 }}>
      <figcaption className="cluster caption" style={{ marginBottom: 'var(--space-2)' }}>
        <Icon name="file" size={16} />
        <span className="break">
          {catalogService.documentName(fragment.documentId)} · {fragment.location}
        </span>
      </figcaption>
      <blockquote className="text-ui" style={{ margin: 0 }}>
        {fragment.text}
      </blockquote>
    </figure>
  );
}
