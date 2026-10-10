import { useState, type FormEvent } from 'react';
import { Alert, Button, ButtonLink, Card, CardHeader, PageHeader, TextField } from '../components/ui';
import { courseService, outcomeLines, parseOutcomeLines, sessionService, type CourseInput } from '../services';
import { useAppState } from '../store/store';
import type { Unit } from '../types';

/** Formulario: los resultados de aprendizaje se escriben uno por línea. */
interface UnitDraft { id?: string; title: string; outcomes: string }
interface CourseDraft { code: string; name: string; term: string; sumilla: string; logro: string; units: UnitDraft[] }
const blank = (): CourseDraft => ({ code: '', name: '', term: '', sumilla: '', logro: '', units: [{ title: '', outcomes: '' }] });

function toInput(draft: CourseDraft, units: Unit[]): CourseInput {
  return {
    code: draft.code, name: draft.name, term: draft.term, sumilla: draft.sumilla, logro: draft.logro,
    units: draft.units.map((u) => ({ ...(u.id ? { id: u.id } : {}), title: u.title, outcomes: parseOutcomeLines(u.outcomes, units.find((old) => old.id === u.id)?.outcomes) })),
  };
}

export function CursosPage() {
  const courses = useAppState((s) => s.courses);
  const units = useAppState((s) => s.units);
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState<CourseDraft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const unitNumber = (u: UnitDraft, index: number) => u.id ? units.find((old) => old.id === u.id)?.number
    : Math.max(0, ...form.units.flatMap((draft) => draft.id ? [units.find((old) => old.id === draft.id)?.number ?? 0] : [])) + form.units.slice(0, index + 1).filter((draft) => !draft.id).length;
  const setUnit = (index: number, patch: Partial<UnitDraft>) => setForm({ ...form, units: form.units.map((old, i) => i === index ? { ...old, ...patch } : old) });
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const course = await courseService.saveConnected(toInput(form, units), editing);
      setMessage(`Curso ${course.code} ${editing ? 'actualizado' : 'creado'}.`);
      setEditing(undefined); setForm(blank()); setError('');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <>
    <PageHeader overline="Antes de empezar · Cursos y unidades" title="Cursos y unidades" description={sessionService.isBackend() ? 'Cursos y unidades guardados en el backend. La sumilla, el logro y los resultados de aprendizaje orientan la generación.' : 'Organiza el catálogo local del prototipo. Los cambios se guardan en este navegador.'} actions={<><ButtonLink to="/" icon="home">Ir al inicio</ButtonLink><ButtonLink to="/carga" variant="primary" icon="arrowRight">Continuar a carga de material</ButtonLink></>} />
    {message && <Alert tone="success" role="status">{message}</Alert>}
    <div className="split">
      <Card>
        <CardHeader title={editing ? 'Editar curso' : 'Crear curso'} />
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Código del curso" value={form.code} maxLength={30} onChange={(code) => setForm({ ...form, code })} />
          <TextField label="Nombre del curso" value={form.name} maxLength={150} onChange={(name) => setForm({ ...form, name })} />
          <TextField label="Periodo académico" value={form.term} maxLength={30} hint="Por ejemplo: 2026-II" onChange={(term) => setForm({ ...form, term })} />
          <TextField label="Sumilla (opcional)" value={form.sumilla} maxLength={3000} multiline rows={3} hint="Copia la sumilla del sílabo: la IA la usa para que los recursos respondan al curso." onChange={(sumilla) => setForm({ ...form, sumilla })} />
          <TextField label="Logro del curso (opcional)" value={form.logro} maxLength={1000} multiline rows={2} hint="Qué logrará el estudiante al terminar el curso." onChange={(logro) => setForm({ ...form, logro })} />
          <fieldset className="course-units stack">
            <legend className="title">Unidades numeradas</legend>
            {form.units.map((u, index) => <div key={u.id ?? index} className="card card--inner stack stack--tight">
              <TextField label={`Unidad ${unitNumber(u, index)}`} value={u.title} maxLength={150} onChange={(title) => setUnit(index, { title })} />
              <TextField label={`Resultados de aprendizaje de la unidad ${unitNumber(u, index)} (opcional)`} value={u.outcomes} multiline rows={3} maxLength={2000}
                hint="Uno por línea. Puedes empezar con su código, por ejemplo «RA1.1: Compara los modelos OSI y TCP/IP»." onChange={(outcomes) => setUnit(index, { outcomes })} />
            </div>)}
            <Button onClick={() => setForm({ ...form, units: [...form.units, { title: '', outcomes: '' }] })}>Añadir unidad</Button>
          </fieldset>
          {error && <Alert tone="warn" role="alert">{error}</Alert>}
          <div className="btn-row">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}>{editing ? 'Guardar cambios' : 'Crear curso'}</Button>
            <Button onClick={() => { setEditing(undefined); setForm(blank()); setError(''); setMessage(''); }}>Cancelar</Button>
          </div>
        </form>
      </Card>
      <section className="stack" aria-label="Cursos registrados">
        <h2 className="title">Cursos registrados ({courses.length})</h2>
        {courses.map((course) => <Card key={course.id} as="article" aria-label={course.name}>
          <CardHeader title={course.name} overline={`${course.code} · ${course.term}`} actions={<Button onClick={() => {
            setEditing(course.id); setError(''); setMessage('');
            setForm({ code: course.code, name: course.name, term: course.term, sumilla: course.sumilla ?? '', logro: course.logro ?? '',
              units: units.filter((u) => u.courseId === course.id).map((u) => ({ id: u.id, title: u.title, outcomes: outcomeLines(u.outcomes) })) });
            document.querySelector<HTMLInputElement>('main input')?.focus();
          }}>Editar curso</Button>} />
          {course.sumilla && <p className="caption">{course.sumilla}</p>}
          <ol className="course-list stack stack--tight">
            {units.filter((u) => u.courseId === course.id).map((u) => <li key={u.id}>Unidad {u.number}: {u.title}
              <span className="caption">{u.outcomes.length ? ` · ${u.outcomes.length} resultado(s) de aprendizaje` : ' · sin resultados de aprendizaje'}</span></li>)}
          </ol>
        </Card>)}
      </section>
    </div>
  </>;
}
