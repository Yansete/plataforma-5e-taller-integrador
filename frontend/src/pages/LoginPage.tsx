import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, PageHeader, SelectField, TextField } from '../components/ui';
import { DEMO_EMAIL, DEMO_PASSWORD, sessionService, useDemoSession } from '../services';
export function LoginPage() {
  const session = useDemoSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Inicio de sesión · Plataforma 5E'; }, []);
  if (session) return <Navigate to="/cursos" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { if (mode === 'backend') await sessionService.loginBackend(email, password); else sessionService.login(email, password); navigate('/cursos', { replace: true }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <main id="contenido" className="login-shell" tabIndex={-1}>
      <PageHeader overline="Plataforma 5E · HU-045" title="Inicio de sesión" description="Accede al prototipo docente para organizar tus cursos y preparar el recorrido 5E." />
      <Card className="stack">
        <Alert title="Sesión de demostración">{mode === 'backend' ? 'Cuenta de demostración verificada por el servidor. Cursos, archivos e historial se guardan en la base de datos.' : 'Sesión local simulada.'} Usa correo {DEMO_EMAIL} y contraseña {DEMO_PASSWORD}. No ingreses credenciales personales.</Alert>
        <form className="stack" onSubmit={submit} noValidate>
          <SelectField label="Modo de acceso" value={mode} onChange={setMode} disabled={busy} options={[{ value: 'local', label: 'Prototipo local (HU-045)' }, { value: 'backend', label: 'Backend conectado (EP-002)' }]} />
          <TextField label="Correo electrónico" type="email" autoComplete="username" value={email} onChange={(v) => { setEmail(v); setError(''); }} />
          <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(v) => { setPassword(v); setError(''); }} />
          {error && <Alert tone="warn" title="No se pudo iniciar sesión" role="alert">{error}</Alert>}
          <Button type="submit" variant="primary" loading={busy} disabled={busy}>Iniciar sesión</Button>
        </form>
      </Card>
    </main>
  </>;
}
