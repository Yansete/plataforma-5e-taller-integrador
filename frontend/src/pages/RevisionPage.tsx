import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { DistractorTag, FragmentCard, ReviewStatusTag } from '../components/domain';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SelectField,
  Tag,
  TextField,
} from '../components/ui';
import { DISCARD_REASONS, STAGES, discardReasonLabel, resourceTypeName, stageName } from '../data/catalog';
import {
  approvalBlockers,
  catalogService,
  preferencesService,
  reviewService,
  unitShortLabel,
  type ResourceEdits,
} from '../services';
import { useAppState } from '../store/store';
import type { DiscardReason, ItemOption, Resource, ReviewStatus, Stage5E } from '../types';

const STATUS_ORDER: Record<ReviewStatus, number> = { pendiente: 0, aprobado: 1, descartado: 2 };
const LETTERS = 'ABCDEFGH';

type DiscardTarget = { kind: 'resource' } | { kind: 'option'; optionId: string };

export function RevisionPage() {
  const resources = useAppState((s) => s.resources);
  const filters = useAppState((s) => s.ui.reviewFilters);
  const selectedId = useAppState((s) => s.ui.selectedResourceId);
  const units = catalogService.listUnits();

  const [message, setMessage] = useState<{ tone: 'success' | 'warn' | 'info'; text: string } | null>(null);

  const filtered = useMemo(
    () =>
      resources
        .filter(
          (r) =>
            (filters.unitId === 'todas' || r.unitId === filters.unitId) &&
            (filters.stage === 'todas' || r.stage === filters.stage) &&
            (filters.status === 'todos' || r.status === filters.status),
        )
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)),
    [resources, filters],
  );

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;
  const index = selected ? filtered.findIndex((r) => r.id === selected.id) : -1;
  const counts = useMemo(
    () => ({
      pendiente: resources.filter((r) => r.status === 'pendiente').length,
      aprobado: resources.filter((r) => r.status === 'aprobado').length,
      descartado: resources.filter((r) => r.status === 'descartado').length,
    }),
    [resources],
  );

  const select = (id: string) => {
    preferencesService.update('selectedResourceId', id);
    setMessage(null);
  };

  const setFilter = (patch: Partial<typeof filters>) => {
    preferencesService.update('reviewFilters', { ...filters, ...patch });
    setMessage(null);
  };

  const nextPending = filtered.find((r) => r.status === 'pendiente' && r.id !== selected?.id);

  return (
    <>
      <PageHeader
        overline="Paso 3 · Revisión docente"
        title="Revisión docente"
        description="Revisa cada propuesta con su evidencia a la vista. Acepta, edita o descarta los distractores y decide sobre cada recurso. Nada se aprueba sin tu acción."
        actions={
          <ButtonLink to="/exportacion" icon="arrowRight">
            Continuar a exportación
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader
          title="Cola de revisión"
          description={`${counts.pendiente} en revisión · ${counts.aprobado} aprobado(s) · ${counts.descartado} descartado(s)`}
        />
        <div className="grid grid--3" style={{ marginBottom: 'var(--space-4)' }}>
          <SelectField
            label="Unidad"
            value={filters.unitId}
            onChange={(v) => setFilter({ unitId: v })}
            options={[{ value: 'todas', label: 'Todas las unidades' }, ...units.map((u) => ({ value: u.id, label: `Unidad ${u.number}` }))]}
          />
          <SelectField
            label="Etapa 5E"
            value={filters.stage}
            onChange={(v) => setFilter({ stage: v as Stage5E | 'todas' })}
            options={[{ value: 'todas', label: 'Todas las etapas' }, ...STAGES.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <SelectField
            label="Estado"
            value={filters.status}
            onChange={(v) => setFilter({ status: v as ReviewStatus | 'todos' })}
            options={[
              { value: 'todos', label: 'Todos los estados' },
              { value: 'pendiente', label: 'En revisión' },
              { value: 'aprobado', label: 'Aprobados' },
              { value: 'descartado', label: 'Descartados' },
            ]}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon="review"
            title={resources.length === 0 ? 'No hay recursos para revisar' : 'Ningún recurso coincide con los filtros'}
            action={
              resources.length === 0 ? (
                <ButtonLink to="/configuracion" variant="primary">Configurar una generación</ButtonLink>
              ) : (
                <Button onClick={() => setFilter({ unitId: 'todas', stage: 'todas', status: 'todos' })}>Quitar filtros</Button>
              )
            }
          >
            {resources.length === 0 ? 'Genera propuestas para empezar la revisión.' : 'Cambia los filtros para ver otros recursos.'}
          </EmptyState>
        ) : (
          <ul className="queue" aria-label="Recursos de la cola">
            {filtered.map((r) => (
              <li key={r.id}>
                <button type="button" className="queue__item" aria-current={r.id === selected?.id ? 'true' : undefined} onClick={() => select(r.id)}>
                  <span className="queue__main">
                    <span className="queue__title">{r.title}</span>
                    <span className="caption">
                      {unitShortLabel(r.unitId)} · {stageName(r.stage)} · {resourceTypeName(r.type)}
                    </span>
                  </span>
                  <ReviewStatusTag status={r.status} edited={r.edited} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div aria-live="polite">
        {message && (
          <Alert tone={message.tone} role="status">
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span>{message.text}</span>
              {nextPending && message.tone === 'success' && (
                <Button compact icon="chevronRight" onClick={() => select(nextPending.id)}>
                  Siguiente en revisión
                </Button>
              )}
            </div>
          </Alert>
        )}
      </div>

      {selected && (
        <ResourceDetail
          key={selected.id}
          resource={selected}
          position={`${index + 1} de ${filtered.length}`}
          onPrev={index > 0 ? () => select(filtered[index - 1].id) : undefined}
          onNext={index < filtered.length - 1 ? () => select(filtered[index + 1].id) : undefined}
          onMessage={setMessage}
        />
      )}
    </>
  );
}

interface DetailProps {
  resource: Resource;
  position: string;
  onPrev?: () => void;
  onNext?: () => void;
  onMessage: (m: { tone: 'success' | 'warn' | 'info'; text: string }) => void;
}

function ResourceDetail({ resource, position, onPrev, onNext, onMessage }: DetailProps) {
  const [editing, setEditing] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null);
  const [reason, setReason] = useState<DiscardReason | ''>('');
  const [highlight, setHighlight] = useState<string[]>([]);

  const outcome = catalogService.getOutcome(resource.outcomeId);
  const blockers = approvalBlockers(resource);
  const isPending = resource.status === 'pendiente';
  const isAprobado = resource.status === 'aprobado';
  const isDescartado = resource.status === 'descartado';
  const isItem = resource.type === 'item_opcion_multiple';

  useEffect(() => {
    setHighlight([]);
  }, [resource.id]);

  const run = (action: () => void, success: string) => {
    try {
      action();
      onMessage({ tone: 'success', text: success });
    } catch (err) {
      onMessage({ tone: 'warn', text: err instanceof Error ? err.message : 'No se pudo completar la acción.' });
    }
  };

  const confirmDiscard = () => {
    if (!discardTarget || !reason) return;
    if (discardTarget.kind === 'resource') {
      run(() => reviewService.discardResource(resource.id, reason), `Recurso descartado (${discardReasonLabel(reason)}).`);
    } else {
      run(() => reviewService.discardDistractor(resource.id, discardTarget.optionId, reason), `Distractor descartado (${discardReasonLabel(reason)}).`);
    }
    setDiscardTarget(null);
    setReason('');
  };

  const allFragmentIds = [...new Set(resource.citations.flatMap((c) => c.fragmentIds))];

  // Aplicación del Sistema de Diseño (HU-025) a la tarjeta principal
  let borderColor = '#DCD7CC';
  if (isAprobado) borderColor = '#1F5C4A'; // Verde de marca
  else if (isDescartado) borderColor = '#A84A26'; // Rojo terracota

  return (
    <div className="split split--review">
      <Card as="article" aria-labelledby="recurso-titulo" style={{ 
        border: `2px solid ${borderColor}`, 
        opacity: isDescartado ? 0.7 : 1, 
        transition: 'all 0.3s ease' 
      }}>
        <div className="card__header">
          <div>
            <span className="overline" style={{ color: '#4A544F', fontWeight: 600 }}>
              {unitShortLabel(resource.unitId)} · {stageName(resource.stage)} · {resourceTypeName(resource.type)}
            </span>
            <h2 className="title" id="recurso-titulo" style={{ fontFamily: '"Fraunces", serif', color: '#1A211E' }}>
              {resource.title}
            </h2>
            {outcome && (
              <p className="caption">
                {outcome.code}: {outcome.text}
              </p>
            )}
          </div>
          <div className="stack stack--tight" style={{ alignItems: 'flex-end' }}>
            <ReviewStatusTag status={resource.status} edited={resource.edited} />
            <div className="cluster">
              <Button compact icon="chevronLeft" aria-label="Recurso anterior" onClick={onPrev} disabled={!onPrev} />
              <span className="caption nowrap">{position}</span>
              <Button compact icon="chevronRight" aria-label="Recurso siguiente" onClick={onNext} disabled={!onNext} />
            </div>
          </div>
        </div>

        {editing ? (
          <EditForm
            resource={resource}
            onCancel={() => setEditing(false)}
            onSave={(edits) => {
              try {
                reviewService.saveEdits(resource.id, edits);
                setEditing(false);
                onMessage({ tone: 'info', text: 'Cambios guardados. El recurso sigue en revisión: apruébalo cuando esté listo.' });
              } catch (err) {
                onMessage({ tone: 'warn', text: err instanceof Error ? err.message : 'No se pudieron guardar los cambios.' });
              }
            }}
          />
        ) : (
          <div className="stack">
            {isItem ? (
              <p className="h2" style={{ fontFamily: '"Fraunces", serif', fontSize: '19px', color: '#1A211E' }}>{resource.body}</p>
            ) : (
              <div className="prose">
                {resource.body.split('\n\n').map((p, i) => (
                  <p key={i} style={{ whiteSpace: 'pre-line', color: '#1A211E' }}>
                    {p}
                  </p>
                ))}
              </div>
            )}

            {resource.options && (
              <ol className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Alternativas">
                {resource.options.map((o, i) => (
                  <OptionCard
                    key={o.id}
                    option={o}
                    letter={LETTERS[i]}
                    editable={isPending}
                    highlighted={highlight.length > 0 && o.sourceFragmentIds.every((f) => highlight.includes(f))}
                    onShowEvidence={() => setHighlight(o.sourceFragmentIds)}
                    onAccept={() => run(() => reviewService.acceptDistractor(resource.id, o.id), `Distractor ${LETTERS[i]} aceptado.`)}
                    onDiscard={() => {
                      setReason(o.reliabilityWarning ? 'tambien_correcto' : '');
                      setDiscardTarget({ kind: 'option', optionId: o.id });
                    }}
                    onReopen={() => run(() => reviewService.revertDistractor(resource.id, o.id), `Distractor ${LETTERS[i]} reabierto.`)}
                    onSaveEdit={(text, feedback) =>
                      run(() => reviewService.editDistractor(resource.id, o.id, text, feedback), `Distractor ${LETTERS[i]} editado y aceptado.`)
                    }
                  />
                ))}
              </ol>
            )}

            {resource.status === 'descartado' && (
              <Alert tone="warn" title="Recurso descartado">
                Motivo: {discardReasonLabel(resource.discardReason)}. No se exportará.
              </Alert>
            )}

            <hr className="divider" />

            {isPending && blockers.length > 0 && (
              <div className="alert alert--info" id="bloqueos-aprobacion">
                <Icon name="info" />
                <div className="alert__body">
                  <span className="alert__title">Para aprobar este recurso</span>
                  <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                    {blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="btn-row">
              {isPending ? (
                <>
                  <Button
                    variant="primary"
                    icon="check"
                    aria-disabled={blockers.length > 0}
                    aria-describedby={blockers.length > 0 ? 'bloqueos-aprobacion' : undefined}
                    onClick={() => {
                      if (blockers.length > 0) {
                        onMessage({ tone: 'warn', text: blockers[0] });
                        return;
                      }
                      run(() => reviewService.approveResource(resource.id), 'Recurso aprobado. Ya está disponible para exportar.');
                    }}
                    style={{ backgroundColor: '#1F5C4A', color: 'white' }}
                  >
                    Aprobar recurso
                  </Button>
                  <Button icon="edit" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    icon="x"
                    onClick={() => {
                      setReason('');
                      setDiscardTarget({ kind: 'resource' });
                    }}
                    style={{ color: '#A84A26', borderColor: '#A84A26' }}
                  >
                    Descartar recurso
                  </Button>
                </>
              ) : (
                <Button icon="undo" onClick={() => run(() => reviewService.revertResource(resource.id), 'El recurso volvió a revisión.')}>
                  Devolver a revisión
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card as="aside" aria-labelledby="evidencia-titulo">
      {resource.source === 'api_demo' && <Alert title="Propuesta recibida de la API de demostración">El recurso y sus fragmentos son ejemplos ficticios enviados por HTTP. Tu revisión se guarda localmente; la sincronización de decisiones con la API sigue pendiente.</Alert>}

        <CardHeader
          id="evidencia-titulo"
          title="Evidencia de origen"
          overline="Datos de demostración"
          description="Fragmentos del material citados por el recurso. En el sistema real provendrán de la recuperación RAG."
        />
        {resource.citations.length === 0 ? (
          <Alert tone="warn" title="Sin evidencia citada">
            Este recurso no cita fragmentos. En el sistema real sería rechazado por falta de anclaje (HU-007).
          </Alert>
        ) : (
          <div className="stack">
            {highlight.length > 0 && (
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <span className="caption">Resaltando la evidencia de la alternativa elegida.</span>
                <button type="button" className="link-button" onClick={() => setHighlight([])}>
                  Quitar resaltado
                </button>
              </div>
            )}
            {resource.citations.map((c, i) => (
              <div key={i} className="stack stack--tight" style={{ backgroundColor: '#F6F4EF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #4A544F' }}>
                <span className="cluster text-ui">
                  <Icon name="quote" size={16} />
                  <strong style={{ color: '#1A211E' }}>{c.claim}</strong>
                </span>
                {c.fragmentIds.map((f) => (
                  <FragmentCard key={f} fragmentId={f} highlight={highlight.includes(f)} />
                ))}
              </div>
            ))}
            {highlight.filter((f) => !allFragmentIds.includes(f)).map((f) => (
              <div key={f} className="stack stack--tight" style={{ backgroundColor: '#F6F4EF', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #1F5C4A' }}>
                <span className="caption">Fragmento de origen de la alternativa:</span>
                <FragmentCard fragmentId={f} highlight />
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={discardTarget !== null}
        title={discardTarget?.kind === 'resource' ? 'Descartar recurso' : 'Descartar distractor'}
        confirmLabel="Descartar"
        confirmVariant="danger"
        confirmDisabled={!reason}
        onConfirm={confirmDiscard}
        onCancel={() => {
          setDiscardTarget(null);
          setReason('');
        }}
      >
        <p className="text-ui">
          {discardTarget?.kind === 'resource'
            ? 'El recurso no se exportará. Podrás devolverlo a revisión más adelante.'
            : 'El motivo alimenta los indicadores I3 (sin sentido) e I5 (también correcto) calculados localmente.'}
        </p>
        <SelectField
          label="Motivo del descarte"
          value={reason}
          onChange={(v) => setReason(v as DiscardReason)}
          placeholder="Elige un motivo"
          options={DISCARD_REASONS.map((r) => ({ value: r.id, label: r.label }))}
        />
      </ConfirmDialog>
    </div>
  );
}

interface OptionCardProps {
  option: ItemOption;
  letter: string;
  editable: boolean;
  highlighted: boolean;
  onShowEvidence: () => void;
  onAccept: () => void;
  onDiscard: () => void;
  onReopen: () => void;
  onSaveEdit: (text: string, feedback: string) => void;
}

function OptionCard({ option, letter, editable, highlighted, onShowEvidence, onAccept, onDiscard, onReopen, onSaveEdit }: OptionCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(option.text);
  const [feedback, setFeedback] = useState(option.feedback);
  const locations = catalogService.getFragments(option.sourceFragmentIds).map((f) => f.location).join(', ');
  
  const className = ['card card--inner stack stack--tight option', option.isCorrect && 'option--key', option.decision === 'descartado' && 'option--discarded', highlighted && 'option--highlight']
    .filter(Boolean)
    .join(' ');

  // Aplicación del Sistema de Diseño a las Alternativas
  let bgColor = '#FFFFFF';
  let borderColor = '#DCD7CC';
  if (option.isCorrect) {
    bgColor = '#DCEBE3'; // Verde suave
    borderColor = '#1F5C4A';
  } else if (option.decision === 'descartado') {
    bgColor = '#F6F4EF';
    borderColor = '#A84A26';
  }

  return (
    <li className={className} style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
      <div className="cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', minWidth: 0 }}>
          <span className="option__letter" aria-hidden="true" style={{ fontWeight: 600, color: option.isCorrect ? '#1F5C4A' : '#1A211E' }}>
            {letter}
          </span>
          <span className="stack stack--tight" style={{ minWidth: 0 }}>
            <span className="visually-hidden">{`Alternativa ${letter}: `}</span>
            <span className={option.decision === 'descartado' ? 'text-ui option__text--discarded' : 'text-ui'} style={{ color: '#1A211E', fontSize: '15px' }}>{option.text}</span>
            <span className="caption" style={{ color: '#4A544F' }}>{option.feedback}</span>
          </span>
        </span>
        {option.isCorrect ? (
          <Tag tone="approved" icon="target">
            Respuesta correcta
          </Tag>
        ) : (
          <DistractorTag decision={option.decision} edited={option.edited} />
        )}
      </div>

      {option.reliabilityWarning && option.decision !== 'descartado' && (
        <Alert tone="warn" title="Advertencia del filtro de fiabilidad (simulada)">
          {option.reliabilityWarning}
        </Alert>
      )}
      {option.decision === 'descartado' && <span className="caption">Motivo: {discardReasonLabel(option.discardReason)}</span>}

      {editing ? (
        <div className="stack stack--tight">
          <TextField label={`Texto de la alternativa ${letter}`} value={text} onChange={setText} error={text.trim() ? undefined : 'El texto no puede quedar vacío.'} />
          <TextField label="Retroalimentación" value={feedback} onChange={setFeedback} multiline rows={2} />
          <div className="btn-row">
            <Button
              variant="primary"
              compact
              icon="check"
              disabled={!text.trim()}
              onClick={() => {
                onSaveEdit(text, feedback);
                setEditing(false);
              }}
            >
              Guardar y aceptar
            </Button>
            <Button
              compact
              onClick={() => {
                setText(option.text);
                setFeedback(option.feedback);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="link-button" onClick={onShowEvidence}>
            {`Ver origen (${locations || 'sin fragmento'})`}
          </button>
          {!option.isCorrect && editable && (
            <div className="btn-row">
              {option.decision === 'pendiente' ? (
                <>
                  <Button compact icon="check" onClick={onAccept}>
                    Aceptar
                  </Button>
                  <Button compact icon="edit" onClick={() => setEditing(true)}>
                    Editar
                  </Button>
                  <Button compact variant="danger" icon="x" onClick={onDiscard}>
                    Descartar
                  </Button>
                </>
              ) : (
                <Button compact icon="undo" onClick={onReopen}>
                  Cambiar decisión
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EditForm({ resource, onSave, onCancel }: { resource: Resource; onSave: (e: ResourceEdits) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(resource.title);
  const [body, setBody] = useState(resource.body);
  const [options, setOptions] = useState(resource.options?.map((o) => ({ id: o.id, text: o.text, feedback: o.feedback, isCorrect: o.isCorrect })) ?? []);

  const setOption = (id: string, patch: Partial<{ text: string; feedback: string }>) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title, body, options: resource.options ? options.map(({ id, text, feedback }) => ({ id, text, feedback })) : undefined });
      }}
    >
      <Alert tone="info">Editar no aprueba el recurso. Después de guardar, seguirá en revisión.</Alert>
      <TextField label="Título" value={title} onChange={setTitle} error={title.trim() ? undefined : 'El título no puede quedar vacío.'} />
      <TextField
        label={resource.options ? 'Enunciado' : 'Contenido'}
        value={body}
        onChange={setBody}
        multiline
        rows={resource.options ? 3 : 10}
        hint={resource.options ? undefined : 'Separa los párrafos con una línea en blanco.'}
        error={body.trim() ? undefined : 'El contenido no puede quedar vacío.'}
      />
      {options.map((o, i) => (
        <fieldset key={o.id} className="fieldset card card--inner">
          <legend className="fieldset__legend">{`Alternativa ${LETTERS[i]}${o.isCorrect ? ' (respuesta correcta)' : ''}`}</legend>
          <TextField label="Texto" value={o.text} onChange={(v) => setOption(o.id, { text: v })} error={o.text.trim() ? undefined : 'No puede quedar vacía.'} />
          <TextField label="Retroalimentación" value={o.feedback} onChange={(v) => setOption(o.id, { feedback: v })} multiline rows={2} />
        </fieldset>
      ))}
      <div className="btn-row">
        <Button type="submit" variant="primary" icon="check">
          Guardar cambios
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}