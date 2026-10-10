import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, PageHeader, SelectField, TextField } from '../components/ui';
import { DEMO_EMAIL, DEMO_PASSWORD, sessionService, useDemoSession } from '../services';
import { BACKEND_PUBLICADO, SOLO_LOCAL } from '../config/despliegue';
export function LoginPage() {
  const session = useDemoSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(BACKEND_PUBLICADO && !SOLO_LOCAL ? 'backend' : 'local');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Inicio de sesión · Plataforma 5E'; }, []);
  if (session) return <Navigate to="/cursos" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { if (mode === 'backend' && !SOLO_LOCAL) await sessionService.loginBackend(email, password); else sessionService.login(email, password); navigate('/cursos', { replace: true }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <main id="contenido" className="login-shell" tabIndex={-1}>
      <PageHeader overline="Plataforma 5E" title="Inicio de sesión" description="Accede al prototipo docente para organizar tus cursos y preparar el recorrido 5E." />
      <Card className="stack">
        <Alert title="Sesión de demostración">{SOLO_LOCAL ? 'Versión publicada para revisión: funciona sin servidor y guarda tus datos solo en este navegador.' : mode === 'backend' ? 'Cuenta de demostración verificada por el servidor. Cursos, archivos e historial se guardan en la base de datos.' : 'Sesión local simulada.'} Usa correo {DEMO_EMAIL} y contraseña {DEMO_PASSWORD}. No ingreses credenciales personales.</Alert>
        <form className="stack" onSubmit={submit} noValidate>
          {!SOLO_LOCAL && <SelectField label="Modo de acceso" value={mode} onChange={setMode} disabled={busy} options={[{ value: 'local', label: 'Prototipo local (datos en este navegador)' }, { value: 'backend', label: 'Servidor de la plataforma (backend)' }]} />}
          <TextField label="Correo electrónico" type="email" autoComplete="username" value={email} onChange={(v) => { setEmail(v); setError(''); }} />
          <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(v) => { setPassword(v); setError(''); }} />
          {mode === 'backend' && BACKEND_PUBLICADO && <p className="caption">El servidor gratuito se apaga tras 15 minutos sin uso: la primera vez puede tardar hasta un minuto en responder.</p>}
          {error && <Alert tone="warn" title="No se pudo iniciar sesión" role="alert">{error}</Alert>}
          <Button type="submit" variant="primary" loading={busy} disabled={busy}>Iniciar sesión</Button>
        </form>
      </Card>
    </main>
  </>;
}
