import { useEffect, useMemo, useState } from 'react';
import { SOLO_LOCAL } from '../config/despliegue';
import { StageCoverage } from '../components/domain';
import { Alert, Button, ButtonLink, Card, CardHeader, Checkbox, ConfirmDialog, EmptyState, PageHeader, SelectField, Spinner, TextField } from '../components/ui';
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
import { sessionService } from '../services/sessionService';
import { refreshBackendHistory } from '../services/configurationApiService';
import { fetchGeneratorInfo } from '../services/generationApiService';
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


const DIFFICULTY_NAMES: Record<Difficulty, string> = { basica: 'Básica', intermedia: 'Intermedia', avanzada: 'Avanzada' };
const difficultyName = (d: Difficulty) => DIFFICULTY_NAMES[d] ?? d;

export function ConfiguracionPage() {
  const connected = sessionService.isBackend();
  const [confirmRequest, setConfirmRequest] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const loadHistory = () => { setHistoryError(''); void refreshBackendHistory().catch((e) => setHistoryError(e.message)); };
  useEffect(() => { if (connected) loadHistory(); }, [connected]);
  const [generator, setGenerator] = useState<{ descripcion: string; usaIA: boolean } | null>(null);
  useEffect(() => { if (connected) void fetchGeneratorInfo().then(setGenerator); }, [connected]);
  const savedMode = useAppState((s) => s.ui.generationMode ?? 'local');
  // En la versión publicada (sin backend) solo existe la demostración local.
  const mode = SOLO_LOCAL ? 'local' : savedMode;
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
  const serverDocs = usableDocs.filter((d) => d.source === 'backend');
  const serverFragments = serverDocs.reduce((n, d) => n + d.fragmentCount, 0);
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
      <ConfirmDialog open={confirmRequest} title="Confirmar solicitud" confirmLabel="Confirmar y solicitar" onCancel={() => setConfirmRequest(false)} onConfirm={() => { setConfirmRequest(false); void generate(); }}>
        <p>{unit ? `Unidad ${unit.number}: ${unit.title}` : 'Selecciona una unidad'}</p>
        <p>{stageName(form.stage)} · {resourceTypeName(form.resourceType)} · {form.quantity} recurso(s) · {difficultyName(form.difficulty)}</p>
        <p>Resultado de aprendizaje: {form.outcomeId ? catalogService.getOutcome(form.outcomeId)?.code : 'Todos los de la unidad'} · Alternativas: {form.optionCount} · top-k: {form.topK} · Umbral: {form.evidenceThreshold}</p>
        <p>Público: {form.audience || 'Sin especificar'} · Competencia: {form.competency || 'Sin especificar'}</p>
        <p>Modalidades: {(form.modalities ?? []).join(', ')} · Indicaciones: {form.instructions || 'Sin indicaciones'}</p>
        <p>Confirma esta interpretación antes de enviarla al backend. Puedes cancelar para corregirla.</p>
      </ConfirmDialog>
      <PageHeader
        overline="Paso 2 · Solicitud por selectores"
        title="Configuración de la generación"
        description={connected
          ? 'Elige la unidad, el resultado de aprendizaje y la etapa 5E. El sistema busca en tu material los fragmentos relacionados y redacta las propuestas citándolos; todo pasa a tu revisión.'
          : 'Elige la unidad, el resultado de aprendizaje y la etapa 5E. La generación está simulada con ejemplos preparados; todo lo propuesto pasa a revisión.'}
        actions={
          <ButtonLink to="/secuencia" icon="arrowRight">
            Ver secuencia 5E
          </ButtonLink>
        }
      />

      <div className="cluster"><ButtonLink to="/chat">Preparar solicitud por chat</ButtonLink></div>
      <div className="split">
        <Card>
          <CardHeader title="Solicitud de generación" />
          {!SOLO_LOCAL && <SelectField label="Origen de las propuestas" value={mode}
            onChange={(v) => { setResult(null); preferencesService.update('generationMode', v as 'local' | 'api_demo'); }}
            options={[{ value: 'local', label: 'Demostración local' }, { value: 'api_demo', label: connected ? 'Servidor: tu material' : 'API de demostración' }]} disabled={busy || connected}
            hint={connected ? 'Con material procesado se genera con él; las unidades de ejemplo sin material propio usan propuestas preparadas.' : 'Sin iniciar sesión en el servidor, la API usa ejemplos preparados.'} />}
          {mode === 'api_demo' && !connected && <Alert title="Integración con API activa">Las propuestas se reciben del backend. Su contenido y evidencia son ficticios de demostración; las decisiones de revisión se guardan en este navegador.</Alert>}
          {connected && <Alert title={generator ? `Generador: ${generator.descripcion}` : 'Generación con tu material'}>
            {generator && !generator.usaIA
              ? 'El servidor no tiene una clave de IA configurada: los recursos se arman con oraciones y términos de tu material, sin inventar nada. Con una clave (IA_API_KEY) se redactan con un modelo de lenguaje.'
              : 'Los recursos se redactan con un modelo de lenguaje a partir de los fragmentos de tu material y citan cada afirmación. Si el modelo no responde, se usa el generador por reglas.'}
          </Alert>}

          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (connected) setConfirmRequest(true); else void generate();
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
              <TextField label="Público objetivo / Ciclo" value={form.audience ?? ''} onChange={(v) => update('audience', v)} maxLength={200} hint={connected ? 'El generador con IA adapta el lenguaje a este público.' : 'Se conserva en la solicitud; su efecto requiere RAG.'} />
              <TextField label="Competencia a desarrollar" value={form.competency ?? ''} onChange={(v) => update('competency', v)} maxLength={200} />
            </div>
            <fieldset className="fieldset">
              <legend className="fieldset__legend">Modalidades del recurso</legend>
              <div className="grid grid--auto">
                {MODALITIES.map((m) => <Checkbox key={m} label={m} checked={(form.modalities ?? []).includes(m)} disabled={busy}
                  onChange={(checked) => update('modalities', checked ? [...(form.modalities ?? []), m] : (form.modalities ?? []).filter((v) => v !== m))} />)}
              </div>
            </fieldset>

            <div className="form-grid">
              <SelectField
                label="Tipo de recurso"
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
                hint={connected ? 'Hasta 5 por solicitud. Solo se aceptan recursos que citan tu material.' : 'Máximo según los ejemplos preparados disponibles.'}
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
                hint={connected ? 'El generador con IA ajusta la complejidad; el generador por reglas no.' : 'En la demostración no cambia los ejemplos.'}
                disabled={busy}
              />
              {form.stage === 'evaluate' && (
                <SelectField
                  label="Alternativas por ítem"
                  value={String(form.optionCount)}
                  onChange={(v) => update('optionCount', Number(v))}
                  options={[
                    { value: '3', label: connected ? '3' : '3 (no disponible en la demo)', disabled: !connected },
                    { value: '4', label: '4' },
                    { value: '5', label: connected ? '5' : '5 (no disponible en la demo)', disabled: !connected },
                  ]}
                  hint={connected ? 'Las unidades de ejemplo sin material propio solo tienen ítems de 4 alternativas.' : 'Los ejemplos preparados tienen 4 alternativas.'}
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
                  hint={connected ? 'Cuántos fragmentos de tu material recibe el generador (máximo 12).' : PENDING_HINT}
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
              hint={connected ? 'Por ejemplo: «usar ejemplos del contexto peruano». El generador con IA las sigue; el generador por reglas no.' : 'Por ejemplo: «usar ejemplos del contexto peruano». Se guardan en la solicitud; la demo no las interpreta.'}
            />

            <div className="cluster">
              <Button type="submit" variant="primary" icon="layers" loading={busy} disabled={busy}>
                {connected ? 'Generar propuestas con mi material' : mode === 'api_demo' ? 'Solicitar propuestas a la API' : 'Generar propuestas (simulado)'}
              </Button>
              {busy && phase && <Spinner label={`${PHASE_LABELS[phase]}…`} />}
            </div>
          </form>

          <div aria-live="polite" style={{ marginTop: result ? 'var(--space-4)' : 0 }}>
            {result?.kind === 'ok' && result.created.length > 0 && (
              <Alert tone="success" title={`${result.created.length} recurso(s) enviados a revisión`} role="status">
                <p>
                  Quedan en estado «En revisión». Ninguno se aprueba sin tu decisión.
                  {result.notice && ` ${result.notice}`}
                  {result.created.length < form.quantity && (result.created[0]?.source === 'rag'
                    ? ` Se aceptaron ${result.created.length} de los ${form.quantity} pedidos: solo pasan los que citan tu material correctamente.`
                    : ` Solo hay ${result.created.length} ejemplo(s) nuevos disponibles de los ${form.quantity} solicitados.`)}
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
            {connected ? (
              <ul className="stack stack--tight text-ui" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                <li>{`${serverDocs.length} documento(s) tuyos procesados, con ${serverFragments} fragmento(s)`}</li>
                <li>{`${unitDocs.filter((d) => d.source === 'backend' && d.status !== 'procesado').length} documento(s) sin procesar o con error`}</li>
                {catalogService.countFragmentsForUnit(form.unitId) > 0 && <li>{`${catalogService.countFragmentsForUnit(form.unitId)} fragmentos de ejemplo (se usan solo si no subes material)`}</li>}
              </ul>
            ) : (
              <ul className="stack stack--tight text-ui" style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
                <li>{`${usableDocs.length} documento(s) con fragmentos de ejemplo`}</li>
                <li>{`${catalogService.countFragmentsForUnit(form.unitId)} fragmentos de demostración en la unidad`}</li>
                <li>{`${unitDocs.length - usableDocs.length} documento(s) tuyos sin fragmentos (procesamiento simulado)`}</li>
              </ul>
            )}
            <hr className="divider" style={{ margin: 'var(--space-4) 0' }} />
            {connected && serverDocs.length > 0 ? (
              <p className="text-ui">Se generará con tu material: {stageName(form.stage)} · {resourceTypeName(form.resourceType)}.</p>
            ) : (
              <p className="text-ui">
                <strong>{examples.length}</strong> ejemplo(s) preparado(s) para {stageName(form.stage)} · {resourceTypeName(form.resourceType)}
                {alreadyInQueue > 0 && `, ${alreadyInQueue} ya en revisión`}.
              </p>
            )}
            {connected && serverDocs.length === 0 && examples.length === 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Alert tone="warn" title="Sin material procesado">
                  Esta unidad todavía no tiene material procesado. Ve a <ButtonLink to="/carga" compact>Carga de material</ButtonLink> para subir un documento o buscar el tema.
                </Alert>
              </div>
            )}
            {!connected && !hasMaterial && (
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
        <CardHeader title="Solicitudes recientes" description={connected ? "Últimas solicitudes recuperadas del servidor con los parámetros confirmados por el docente." : "Parámetros registrados en este navegador."} actions={connected ? <Button onClick={loadHistory}>Actualizar historial</Button> : undefined} />
        {historyError && <Alert tone="warn" role="alert">{historyError}</Alert>}
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
                    <td data-label="Parámetros" className="caption">{`top-k ${r.topK} · umbral ${r.evidenceThreshold.toLocaleString('es-ES', { minimumFractionDigits: 1 })} · ${difficultyName(r.difficulty)} · ${r.audience || 'Sin público'} · ${r.competency || 'Sin competencia'} · ${(r.modalities ?? []).join(', ')} · ${r.instructions || 'Sin indicaciones'}`}</td>
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