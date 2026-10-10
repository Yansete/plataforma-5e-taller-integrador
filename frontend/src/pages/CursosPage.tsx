import { useState, type FormEvent } from 'react';
import { Alert, Button, ButtonLink, Card, CardHeader, PageHeader, TextField } from '../components/ui';
import { courseService, sessionService, type CourseInput } from '../services';
import { useAppState } from '../store/store';
const blank = (): CourseInput => ({ code: '', name: '', term: '', units: [{ title: '' }] });
export function CursosPage() {
  const courses = useAppState((s) => s.courses);
  const units = useAppState((s) => s.units);
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState<CourseInput>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      const course = await courseService.saveConnected(form, editing);
      setMessage(`Curso ${course.code} ${editing ? 'actualizado' : 'creado'}.`);
      setEditing(undefined); setForm(blank()); setError('');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <>
    <PageHeader overline="Antes de empezar · Cursos y unidades" title="Cursos y unidades" description={sessionService.isBackend() ? "Cursos y unidades guardados en el backend. Se recuperan al iniciar sesión." : "Organiza el catálogo local del prototipo. Los cambios se guardan en este navegador."} actions={<><ButtonLink to="/" icon="home">Ir al inicio</ButtonLink><ButtonLink to="/carga" variant="primary" icon="arrowRight">Continuar a carga de material</ButtonLink></>} />
    {message && <Alert tone="success" role="status">{message}</Alert>}
    <div className="split">
      <Card>
        <CardHeader title={editing ? 'Editar curso' : 'Crear curso'} />
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Código del curso" value={form.code} maxLength={30} onChange={(code) => setForm({ ...form, code })} />
          <TextField label="Nombre del curso" value={form.name} maxLength={150} onChange={(name) => setForm({ ...form, name })} />
          <TextField label="Periodo académico" value={form.term} maxLength={30} hint="Por ejemplo: 2026-II" onChange={(term) => setForm({ ...form, term })} />
          <fieldset className="course-units stack">
            <legend className="title">Unidades numeradas</legend>
            {form.units.map((u, index) => <TextField key={u.id ?? index} label={`Unidad ${u.id ? units.find((old) => old.id === u.id)?.number : Math.max(0, ...form.units.flatMap((draft) => draft.id ? [units.find((old) => old.id === draft.id)?.number ?? 0] : [])) + form.units.slice(0, index + 1).filter((draft) => !draft.id).length}`} value={u.title} maxLength={150} onChange={(title) => setForm({ ...form, units: form.units.map((old, i) => i === index ? { ...old, title } : old) })} />)}
            <Button onClick={() => setForm({ ...form, units: [...form.units, { title: '' }] })}>Añadir unidad</Button>
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
            setForm({ code: course.code, name: course.name, term: course.term, units: units.filter((u) => u.courseId === course.id).map((u) => ({ id: u.id, title: u.title })) });
            document.querySelector<HTMLInputElement>('main input')?.focus();
          }}>Editar curso</Button>} />
          <ol className="course-list stack stack--tight">
            {units.filter((u) => u.courseId === course.id).map((u) => <li key={u.id}>Unidad {u.number}: {u.title}</li>)}
          </ol>
        </Card>)}
      </section>
    </div>
  </>;
}
