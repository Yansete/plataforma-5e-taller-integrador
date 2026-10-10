import { useEffect, useMemo, useState } from 'react';
import { StageCoverage } from '../components/domain';
import { Alert, Button, ButtonLink, Card, CardHeader, Checkbox, EmptyState, PageHeader, SelectField, Spinner, TextField } from '../components/ui';
import { RESOURCE_TYPES, STAGES, resourceTypeName, stageName } from '../data/catalog';
import {
  availableExamples,
  catalogService,
  generationService,
  PHASE_LABELS,
  preferencesService,
  unitHasUsableMaterial,
  unitShortLabel,
  type GenerationPhase,
} from '../services';
import { useAppState } from '../store/store';
import type { Difficulty, GenerationOutcome, GenerationRequest, ResourceType, Stage5E } from '../types';
import { MODALITIES } from '../services/chatService';
import { formatDateTime } from '../utils/format';

type ConfigForm = Omit<GenerationRequest, 'id' | 'createdAt'>;

const DEFAULTS: ConfigForm = {
  unitId: 'u2',
  outcomeId: null,
  stage: 'engage',
  resourceType: 'pregunta_detonante',
  quantity: 2,
  difficulty: 'intermedia',
  optionCount: 4,
  topK: 10,
  evidenceThreshold: 0.6,
  instructions: '',
  audience: '',
  competency: 'Pensamiento crítico',
  modalities: ['Textual'],
};

const PENDING_HINT = 'Se registra en la solicitud; su efecto requiere el motor RAG (pendiente).';

export function ConfiguracionPage() {
  const mode = useAppState((s) => s.ui.generationMode ?? 'local');
  const saved = useAppState((s) => s.ui.config);
  const documents = useAppState((s) => s.documents);
  const resources = useAppState((s) => s.resources);
  const requests = useAppState((s) => s.requests);
  const units = catalogService.listUnits();

  const [form, setForm] = useState<ConfigForm>({ ...DEFAULTS, ...saved });
  const [phase, setPhase] = useState<GenerationPhase | null>(null);
  const [result, setResult] = useState<GenerationOutcome | null>(null);

  // Conserva la configuración al navegar y al recargar.
  useEffect(() => {
    preferencesService.update('config', form);
  }, [form]);

  const unit = catalogService.getUnit(form.unitId);
  const typesForStage = RESOURCE_TYPES.filter((t) => t.stage === form.stage);
  const stageInfo = STAGES.find((s) => s.id === form.stage)!;

  const update = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setResult(null);
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'unitId') next.outcomeId = null;
      if (key === 'stage') next.resourceType = RESOURCE_TYPES.find((t) => t.stage === value)!.id;
      return next;
    });
  };

  const unitDocs = documents.filter((d) => d.unitId === form.unitId);
  const usableDocs = unitDocs.filter((d) => d.status === 'procesado' && d.fragmentCount > 0);
  const hasMaterial = unitHasUsableMaterial(form.unitId);
  const examples = availableExamples(form.unitId, form.stage, form.resourceType, form.outcomeId);
  const alreadyInQueue = examples.filter((e) => resources.some((r) => r.exampleId === e.exampleId)).length;
  const recentRequests = useMemo(() => requests.slice(0, 5), [requests]);

  const generate = async () => {
    setResult(null);
    try { setResult(await generationService.generate(form, setPhase)); }
    finally { setPhase(null); }
  };

  const busy = phase !== null;

  return (
    <>
      <PageHeader
        overline="Paso 2 · Configuración de la generación"
        title="Configuración de la generación"
        description="Elige la unidad, el resultado de aprendizaje y la etapa 5E. La generación está simulada con ejemplos preparados; todo lo propuesto pasa a revisión."
      />

      <div className="cluster"><ButtonLink to="/chat">Preparar solicitud por chat</ButtonLink></div>
      <div className="split">
        <Card>
          <CardHeader title="Solicitud de generación" />
          <SelectField label="Origen de las propuestas" value={mode}
            onChange={(v) => { setResult(null); preferencesService.update('generationMode', v as 'local' | 'api_demo'); }}
            options={[{ value: 'local', label: 'Demostración local' }, { value: 'api_demo', label: 'API de demostración' }]} disabled={busy}
            hint="La API usa ejemplos preparados y guarda las solicitudes en el servidor. La generación RAG sigue pendiente." />
          {mode === 'api_demo' && <Alert title="Integración con API activa">Las propuestas se reciben del backend. Su contenido y evidencia son ficticios de demostración; las decisiones de revisión se guardan en este navegador.</Alert>}

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <div className="form-grid">
              <SelectField
                label="Unidad"
                value={form.unitId}
                onChange={(v) => update('unitId', v)}
                options={units.map((u) => ({ value: u.id, label: `${catalogService.listCourses().find((c) => c.id === u.courseId)?.code ?? "Curso"} · Unidad ${u.number}: ${u.title}` }))}
                disabled={busy}
              />
              <SelectField
                label="Resultado de aprendizaje"
                value={form.outcomeId ?? ''}
                onChange={(v) => update('outcomeId', v || null)}
                options={[
                  { value: '', label: 'Todos los resultados de la unidad' },
                  ...(unit?.outcomes.map((o) => ({ value: o.id, label: `${o.code}: ${o.text}` })) ?? []),
                ]}
                disabled={busy}
              />
            </div>

            <fieldset className="fieldset">
              <legend className="fieldset__legend">Etapa del modelo 5E</legend>
              <div className="grid grid--auto" style={{ gap: 'var(--space-2)' }}>
                {STAGES.map((s) => (
                  <label key={s.id} className={form.stage === s.id ? 'card card--inner check option-card--selected' : 'card card--inner check'} style={{ padding: 'var(--space-3)' }}>
                    <input type="radio" name="stage" value={s.id} checked={form.stage === s.id} disabled={busy} onChange={() => update('stage', s.id as Stage5E)} />
                    <span>
                      <strong>{s.name}</strong> <span className="caption">({s.english})</span>
                      <span className="field__hint" style={{ display: 'block' }}>{s.intent}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-grid">
              <TextField label="Público objetivo / Ciclo" value={form.audience ?? ''} onChange={(v) => update('audience', v)} maxLength={200} hint="Se conserva en la solicitud; su efecto requiere RAG." />
              <TextField label="Competencia a desarrollar" value={form.competency ?? ''} onChange={(v) => update('competency', v)} maxLength={200} />
            </div>
            <fieldset className="fieldset">
              <legend className="fieldset__legend">Enfoque Multimodal</legend>
              <div className="grid grid--auto">
                {MODALITIES.map((m) => <Checkbox key={m} label={m} checked={(form.modalities ?? []).includes(m)} disabled={busy}
                  onChange={(checked) => update('modalities', checked ? [...(form.modalities ?? []), m] : (form.modalities ?? []).filter((v) => v !== m))} />)}
              </div>
            </fieldset>

            <div className="form-grid">
              <SelectField
                label="Formato base de generación (Simulación)"
                value={form.resourceType}
                onChange={(v) => update('resourceType', v as ResourceType)}
                options={typesForStage.map((t) => ({ value: t.id, label: `${t.name} (${t.story})` }))}
                disabled={busy}
              />
              <SelectField
                label="Cantidad de recursos"
                value={String(form.quantity)}
                onChange={(v) => update('quantity', Number(v))}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                hint="Máximo según los ejemplos preparados disponibles."
                disabled={busy}
              />
              <SelectField
                label="Nivel de dificultad"
                value={form.difficulty}
                onChange={(v) => update('difficulty', v as Difficulty)}
                options={[
                  { value: 'basica', label: 'Básica' },
                  { value: 'intermedia', label: 'Intermedia' },
                  { value: 'avanzada', label: 'Avanzada' },
                ]}
                hint="En la demostración no cambia los ejemplos."
                disabled={busy}
              />
              {form.stage === 'evaluate' && (
                <SelectField
                  label="Alternativas por ítem"
                  value={String(form.optionCount)}
                  onChange={(v) => update('optionCount', Number(v))}
                  options={[
                    { value: '3', label: '3 (no disponible en la demo)', disabled: true },
                    { value: '4', label: '4' },
                    { value: '5', label: '5 (no disponible en la demo)', disabled: true },
                  ]}
                  hint="Los ejemplos preparados tienen 4 alternativas."
                  disabled={busy}
                />
              )}
            </div>

            <details className="card card--inner">
              <summary className="text-ui" style={{ cursor: 'pointer', minHeight: 'var(--touch-target)', display: 'flex', alignItems: 'center' }}>
                Parámetros de recuperación (avanzado)
              </summary>
              <div className="form-grid" style={{ marginTop: 'var(--space-3)' }}>
                <SelectField
                  label="Fragmentos a recuperar (top-k)"
                  value={String(form.topK)}
                  onChange={(v) => update('topK', Number(v))}
                  options={[5, 10, 20].map((n) => ({ value: String(n), label: String(n) }))}
                  hint={PENDING_HINT}
                  disabled={busy}
                />
                <SelectField
                  label="Umbral mínimo de evidencia"
                  value={String(form.evidenceThreshold)}
                  onChange={(v) => update('evidenceThreshold', Number(v))}
                  options={[0.4, 0.5, 0.6, 0.7, 0.8].map((n) => ({ value: String(n), label: n.toLocaleString('es-ES', { minimumFractionDigits: 1 }) }))}
                  hint={PENDING_HINT}
                  disabled={busy}
                />
              </div>
            </details>

            <TextField
              label="Indicaciones adicionales (opcional)"
              value={form.instructions}
              onChange={(v) => update('instructions', v)}
              multiline
              rows={3}
              maxLength={500}
              hint="Por ejemplo: «usar ejemplos del contexto peruano». Se guardan en la solicitud; la demo no las interpreta."
            />

            <div className="cluster">
              <Button type="submit" variant="primary" icon="layers" loading={busy} disabled={busy}>
                {mode === 'api_demo' ? 'Solicitar propuestas a la API' : 'Generar propuestas (simulado)'}
              </Button>
              {busy && phase && <Spinner label={`${PHASE_LABELS[phase]}…`} />}
            </div>
          </form>

          <div aria-live="polite" style={{ marginTop: result ? 'var(--space-4)' : 0 }}>
            {result?.kind === 'ok' && result.created.length > 0 && (
              <Alert tone="success" title={`${result.created.length} recurso(s) enviados a revisión`} role="status">
                <p>
                  Quedan en estado «En revisión». Ninguno se aprueba sin tu decisión.
                  {result.created.length < form.quantity && ` Solo hay ${result.created.length} ejemplo(s) nuevos disponibles de los ${form.quantity} solicitados.`}
                  {result.skipped > 0 && ` ${result.skipped} ejemplo(s) ya estaban en la cola y no se duplicaron.`}
                </p>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <ButtonLink to="/revision" variant="primary" icon="arrowRight" compact>
                    Ir a revisión
                  </ButtonLink>
                </div>
              </Alert>
            )}
            {result?.kind === 'ok' && result.created.length === 0 && (
              <Alert tone="info" title="No se añadieron recursos nuevos" role="status">
                Los {result.available} ejemplo(s) preparados para esta combinación ya están en la cola de revisión. Prueba otra etapa, tipo o
                resultado de aprendizaje.
              </Alert>
            )}
            {result?.kind === 'error' && (
              <Alert tone="warn" title={`Solicitud fallida (${result.code})`} role="alert">
                {result.message} No se añadieron propuestas. Puedes volver a solicitar cuando se resuelva el problema.
              </Alert>
            )}
            {result?.kind === 'rechazado' && (
              <Alert tone="warn" title={`Generación rechazada (${result.code})`} role="alert">
                {result.message}
              </Alert>
            )}
          </div>
        </Card>

        <div className="stack">
          <Card as="aside" aria-labelledby="evidencia-disponible">
            <CardHeader id="evidencia-disponible" title="Evidencia disponible" description={unit ? `Unidad ${unit.number}: ${unit.title}` : ''} headingLevel={2} />
            <ul className="stack stack--tight text-ui" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
              <li>{`${usableDocs.length} documento(s) con fragmentos de ejemplo`}</li>
              <li>{`${catalogService.countFragmentsForUnit(form.unitId)} fragmentos de demostración en la unidad`}</li>
              <li>{`${unitDocs.length - usableDocs.length} documento(s) tuyos sin fragmentos (procesamiento simulado)`}</li>
            </ul>
            <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
            <p className="text-ui">
              <strong>{examples.length}</strong> ejemplo(s) preparado(s) para {stageName(form.stage)} · {resourceTypeName(form.resourceType)}
              {alreadyInQueue > 0 && `, ${alreadyInQueue} ya en revisión`}.
            </p>
            {!hasMaterial && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Alert tone="warn" title="Sin evidencia utilizable">
                  Esta unidad no tiene documentos con fragmentos. Restablece la demo o registra material en la carga (aunque su procesamiento es simulado).
                </Alert>
              </div>
            )}
          </Card>

          <Card as="aside" aria-labelledby="plan-secuencia">
            <CardHeader id="plan-secuencia" title="Plan de la secuencia 5E" description="Recursos aprobados por etapa en la unidad elegida (HU-014)." />
            <StageCoverage unitId={form.unitId} resources={resources} compact />
            <p className="caption" style={{ marginTop: 'var(--space-3)' }}>
              Etapa elegida: {stageInfo.name}. Responsable en el equipo: {stageInfo.owner}.
            </p>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Solicitudes recientes" description="Parámetros registrados en cada solicitud (se enviarán al backend cuando exista)." />
        {recentRequests.length === 0 ? (
          <EmptyState title="Aún no hay solicitudes" />
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">Cantidad</th>
                  <th scope="col">Parámetros</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Fecha" className="nowrap">{formatDateTime(r.createdAt)}</td>
                    <td data-label="Unidad">{unitShortLabel(r.unitId)}</td>
                    <td data-label="Etapa">{stageName(r.stage)}</td>
                    <td data-label="Tipo">{resourceTypeName(r.resourceType)}</td>
                    <td data-label="Cantidad" className="num">{r.quantity}</td>
                    <td data-label="Parámetros" className="caption">{`top-k ${r.topK} · umbral ${r.evidenceThreshold.toLocaleString('es-ES', { minimumFractionDigits: 1 })} · ${r.difficulty}`}</td>
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