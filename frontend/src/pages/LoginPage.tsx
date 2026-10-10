import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, PageHeader, TextField } from '../components/ui';
import { DEMO_EMAIL, DEMO_PASSWORD, sessionService, useDemoSession } from '../services';
export function LoginPage() {
  const session = useDemoSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Inicio de sesión · Plataforma 5E'; }, []);
  if (session) return <Navigate to="/cursos" replace />;
  function submit(event: FormEvent) {
    event.preventDefault();
    try { sessionService.login(email, password); navigate('/cursos', { replace: true }); }
    catch (err) { setError((err as Error).message); }
  }
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <main id="contenido" className="login-shell" tabIndex={-1}>
      <PageHeader overline="Plataforma 5E · HU-045" title="Inicio de sesión" description="Accede al prototipo docente para organizar tus cursos y preparar el recorrido 5E." />
      <Card className="stack">
        <Alert title="Sesión de demostración">La autenticación es simulada. Usa correo {DEMO_EMAIL} y contraseña {DEMO_PASSWORD}. No ingreses credenciales personales.</Alert>
        <form className="stack" onSubmit={submit} noValidate>
          <TextField label="Correo electrónico" type="email" autoComplete="username" value={email} onChange={(v) => { setEmail(v); setError(''); }} />
          <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(v) => { setPassword(v); setError(''); }} />
          {error && <Alert tone="warn" title="No se pudo iniciar sesión" role="alert">{error}</Alert>}
          <Button type="submit" variant="primary">Iniciar sesión</Button>
        </form>
      </Card>
    </main>
  </>;
}
