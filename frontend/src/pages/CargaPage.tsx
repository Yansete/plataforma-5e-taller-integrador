import { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { DocumentStatusTag } from '../components/domain';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  SelectField,
} from '../components/ui';
import { DOCUMENT_TYPES, MAX_FILE_SIZE_MB, STAGES, stageName } from '../data/catalog';
import {
  catalogService,
  materialService,
  preferencesService,
  STEP_LABELS,
  unitShortLabel,
  validateFile,
  validateRegistration,
  type FieldErrors,
  type LocalFileInfo,
} from '../services';
import { useAppState } from '../store/store';
import type { MaterialDocument, ProcessingStep, Stage5E } from '../types';
import { formatBytes, formatDateTime } from '../utils/format';

const STEP_ORDER: ProcessingStep[] = ['extraccion', 'segmentacion', 'vectorizacion'];

export function CargaPage() {
  const documents = useAppState((s) => s.documents);
  const defaultUnit = useAppState((s) => s.ui.uploadDefaults.unitId);
  const units = catalogService.listUnits();

  // Selección local: solo nombre y tamaño. El objeto File no se guarda en ningún almacenamiento.
  const [file, setFile] = useState<LocalFileInfo | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [unitId, setUnitId] = useState(defaultUnit);
  const [outcomeIds, setOutcomeIds] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [suggestedStage, setSuggestedStage] = useState<Stage5E | ''>('');
  const [usePermission, setUsePermission] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const [unitFilter, setUnitFilter] = useState('todas');
  const [toRemove, setToRemove] = useState<MaterialDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const outcomesErrorId = useId();
  const permissionErrorId = useId();

  const unit = catalogService.getUnit(unitId);

  const visibleDocs = useMemo(
    () => documents.filter((d) => unitFilter === 'todas' || d.unitId === unitFilter),
    [documents, unitFilter],
  );

  const selectFile = (f: File | undefined) => {
    if (!f) return;
    const info = { name: f.name, size: f.size };
    setFile(info);
    setFileError(validateFile(info));
    setErrors((e) => ({ ...e, file: undefined }));
    setMessage(null);
  };

  const clearForm = () => {
    setFile(null);
    setFileError(null);
    setOutcomeIds([]);
    setDocumentType('');
    setSuggestedStage('');
    setUsePermission(false);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const changeUnit = (id: string) => {
    setUnitId(id);
    setOutcomeIds([]);
    preferencesService.update('uploadDefaults', { unitId: id });
  };

  const toggleOutcome = (id: string, checked: boolean) => {
    setOutcomeIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { file, unitId, outcomeIds, documentType, suggestedStage: suggestedStage || null, usePermission };
    const found = validateRegistration(input);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: 'warn', text: 'Revisa los campos marcados antes de registrar el documento.' });
      return;
    }
    setSubmitting(true);
    try {
      const doc = await materialService.registerDocument({ ...input, file: file! });
      clearForm();
      setMessage({ tone: 'success', text: `«${doc.fileName}» registrado. El procesamiento simulado está en curso en la lista de abajo.` });
      void materialService.processDocument(doc.id, { simulateFailure });
    } catch (err) {
      setMessage({ tone: 'warn', text: err instanceof Error ? err.message : 'No se pudo registrar el documento.' });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    const name = toRemove.fileName;
    setToRemove(null);
    await materialService.removeDocument(toRemove.id);
    setMessage({ tone: 'success', text: `«${name}» se quitó de la lista.` });
  };

  return (
    <>
      <PageHeader
        overline="Paso 1 · Carga de material"
        title="Carga de material"
        description="Registra el material de tu unidad con su contexto: unidad, resultados de aprendizaje, tipo de documento y etapa 5E sugerida."
        actions={
          <ButtonLink to="/configuracion" variant="primary" icon="arrowRight">
            Continuar a configuración
          </ButtonLink>
        }
      />

      <div aria-live="polite">{message && <Alert tone={message.tone} role="status">{message.text}</Alert>}</div>

      <div className="split">
        <Card>
          <CardHeader title="Nuevo documento" description={`Formatos admitidos: PDF, PPTX y TXT. Tamaño máximo propuesto: ${MAX_FILE_SIZE_MB} MB.`} />
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor={fileInputId}>
                Archivo
              </label>
              <div
                className={['dropzone', dragActive && 'dropzone--active', (fileError || errors.file) && 'dropzone--invalid'].filter(Boolean).join(' ')}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  selectFile(e.dataTransfer.files?.[0]);
                }}
              >
                <Icon name="upload" size={24} />
                <span className="text-ui">Arrastra un archivo aquí o</span>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept=".pdf,.pptx,.txt"
                  className="visually-hidden"
                  tabIndex={-1}
                  onChange={(e) => selectFile(e.target.files?.[0])}
                />
                <Button
                  icon="file"
                  aria-describedby={fileError || errors.file ? `${fileInputId}-error` : undefined}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Elegir archivo
                </Button>
              </div>
              {(fileError || errors.file) && (
                <span className="field__error" id={`${fileInputId}-error`}>
                  <Icon name="alert" />
                  {fileError ?? errors.file}
                </span>
              )}
            </div>

            {file && (
              <div className="card card--inner card--soft stack stack--tight">
                <span className="overline">Selección local</span>
                <span className="cluster">
                  <Icon name="file" />
                  <strong className="break">{file.name}</strong>
                  <span className="caption">{formatBytes(file.size)}</span>
                </span>
                <span className="caption">
                  El archivo solo está seleccionado en tu navegador. No se ha leído, subido ni procesado. Al registrarlo se guardan
                  únicamente su nombre, tamaño y los datos de contexto.
                </span>
              </div>
            )}

            <div className="form-grid">
              <SelectField
                label="Unidad"
                value={unitId}
                onChange={changeUnit}
                options={units.map((u) => ({ value: u.id, label: `Unidad ${u.number}: ${u.title}` }))}
                error={errors.unitId}
                className="span-2"
              />

              <fieldset className="fieldset span-2" aria-describedby={errors.outcomeIds ? outcomesErrorId : undefined}>
                <legend className="fieldset__legend">Resultados de aprendizaje que cubre</legend>
                {unit?.outcomes.map((o) => (
                  <Checkbox key={o.id} label={<><strong>{o.code}.</strong> {o.text}</>} checked={outcomeIds.includes(o.id)} onChange={(c) => toggleOutcome(o.id, c)} />
                ))}
                {errors.outcomeIds && (
                  <span className="field__error" id={outcomesErrorId}>
                    <Icon name="alert" />
                    {errors.outcomeIds}
                  </span>
                )}
              </fieldset>

              <SelectField
                label="Tipo de documento"
                value={documentType}
                onChange={setDocumentType}
                placeholder="Elige un tipo"
                options={DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))}
                error={errors.documentType}
              />
              <SelectField
                label="Etapa 5E sugerida (opcional)"
                value={suggestedStage}
                onChange={(v) => setSuggestedStage(v as Stage5E | '')}
                hint="Metadato editable (HU-003)."
                options={[{ value: '', label: 'Sin sugerencia' }, ...STAGES.map((s) => ({ value: s.id, label: `${s.name} (${s.english})` }))]}
              />
            </div>

            <div className="stack stack--tight">
              <Checkbox
                label="Confirmo que tengo permiso para usar este material en la plataforma."
                checked={usePermission}
                onChange={setUsePermission}
                describedById={errors.usePermission ? permissionErrorId : undefined}
              />
              {errors.usePermission && (
                <span className="field__error" id={permissionErrorId}>
                  <Icon name="alert" />
                  {errors.usePermission}
                </span>
              )}
            </div>

            <details className="card card--inner">
              <summary className="text-ui" style={{ cursor: 'pointer', minHeight: 'var(--touch-target)', display: 'flex', alignItems: 'center' }}>
                Opciones de la demostración
              </summary>
              <Checkbox
                label="Simular un fallo durante el procesamiento"
                hint="Sirve para ver el estado de error y la opción de reintentar."
                checked={simulateFailure}
                onChange={setSimulateFailure}
              />
            </details>

            <div className="btn-row">
              <Button type="submit" variant="primary" icon="upload" loading={submitting}>
                Registrar y procesar (simulado)
              </Button>
              <Button onClick={clearForm} disabled={submitting}>
                Limpiar
              </Button>
            </div>
          </form>
        </Card>

        <Card as="aside" aria-labelledby="que-ocurre">
          <CardHeader id="que-ocurre" title="Qué ocurre con tu archivo" />
          <ol className="steps">
            <li className="step">
              <span className="step__marker" aria-hidden="true">1</span>
              <div className="step__body">
                <span className="title">Selección local</span>
                <span className="caption">El navegador conoce el nombre y el tamaño. El contenido no se lee.</span>
              </div>
            </li>
            <li className="step">
              <span className="step__marker" aria-hidden="true">2</span>
              <div className="step__body">
                <span className="title">Registro</span>
                <span className="caption">Se guardan solo los metadatos en este navegador.</span>
              </div>
            </li>
            <li className="step step--pending">
              <span className="step__marker" aria-hidden="true">3</span>
              <div className="step__body">
                <span className="title">Procesamiento simulado</span>
                <span className="caption">
                  Se muestran los pasos de extracción, segmentación y vectorización, pero no se procesa nada. Tu documento queda
                  con 0 fragmentos: la ingesta real (HU-002 a HU-004) está pendiente del backend.
                </span>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Material registrado"
          description="Los documentos de demostración ya incluyen fragmentos de ejemplo para la generación simulada."
          actions={
            <SelectField
              label="Filtrar por unidad"
              value={unitFilter}
              onChange={setUnitFilter}
              options={[{ value: 'todas', label: 'Todas las unidades' }, ...units.map((u) => ({ value: u.id, label: `Unidad ${u.number}` }))]}
            />
          }
        />
        {visibleDocs.length === 0 ? (
          <EmptyState icon="file" title="No hay documentos en este filtro">
            Registra un documento con el formulario o elige otra unidad.
          </EmptyState>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visibleDocs.map((d) => (
              <DocumentRow key={d.id} doc={d} onRemove={() => setToRemove(d)} />
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={toRemove !== null}
        title="¿Quitar este documento?"
        confirmLabel="Quitar documento"
        confirmVariant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      >
        <p>
          «{toRemove?.fileName}» dejará de aparecer en la lista.
          {toRemove?.isDemo && ' Es un documento de demostración: sin él, la unidad puede quedarse sin evidencia para generar. Puedes recuperarlo restableciendo la demo.'}
        </p>
      </ConfirmDialog>
    </>
  );
}

function DocumentRow({ doc, onRemove }: { doc: MaterialDocument; onRemove: () => void }) {
  const stepIndex = doc.currentStep ? STEP_ORDER.indexOf(doc.currentStep) : -1;
  const outcomes = doc.outcomeIds.map((id) => catalogService.getOutcome(id)?.code).filter(Boolean).join(', ');
  return (
    <li className="card card--inner stack stack--tight">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="cluster" style={{ minWidth: 0 }}>
          <Icon name="file" />
          <strong className="break">{doc.fileName}</strong>
          {doc.isDemo && <span className="tag">Demostración</span>}
        </span>
        <DocumentStatusTag status={doc.status} />
      </div>
      <p className="caption">
        {unitShortLabel(doc.unitId)} · {outcomes || 'Sin RA'} · {doc.documentType} · {doc.kind.toUpperCase()} · {formatBytes(doc.sizeBytes)}
        {doc.suggestedStage && ` · Etapa sugerida: ${stageName(doc.suggestedStage)}`} · Registrado {formatDateTime(doc.registeredAt)}
      </p>

      {doc.status === 'procesando' && (
        <div className="stack stack--tight" role="status">
          <span className="cluster text-ui">
            <span className="spinner" aria-hidden="true" />
            {`Paso ${stepIndex + 1} de 3: ${doc.currentStep ? STEP_LABELS[doc.currentStep] : ''} (simulado)`}
          </span>
          <div className="progress" aria-hidden="true">
            <div className="progress__fill" style={{ width: `${((stepIndex + 1) / 3) * 100}%` }} />
          </div>
        </div>
      )}

      {doc.status === 'procesado' && (
        <p className="text-ui">
          {doc.isDemo
            ? `${doc.fragmentCount} fragmentos de ejemplo disponibles para la generación simulada.`
            : '0 fragmentos: el procesamiento fue simulado. La extracción real está pendiente del backend (HU-002).'}
        </p>
      )}

      {doc.status === 'error' && <Alert tone="warn" title="El procesamiento no terminó">{doc.errorMessage}</Alert>}

      <div className="btn-row">
        {(doc.status === 'registrado' || doc.status === 'error') && (
          <Button compact icon="reset" onClick={() => void materialService.processDocument(doc.id)}>
            {doc.status === 'error' ? 'Reintentar procesamiento' : 'Procesar (simulado)'}
          </Button>
        )}
        <Button compact variant="danger" icon="trash" onClick={onRemove} disabled={doc.status === 'procesando'}>
          Quitar
        </Button>
      </div>
    </li>
  );
}
