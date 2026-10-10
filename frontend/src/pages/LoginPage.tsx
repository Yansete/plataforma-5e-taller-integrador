import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { Alert, Button, TextField } from '../components/ui';
import { errorMessage } from '../services/api';
import { login } from '../services/sesion';
import { useSession } from '../state/datos';
import { useSlowNotice } from './useSlowNotice';

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slow = useSlowNotice(loading);

  if (session && !loading) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Inicio de sesión" description="Ingresa con tu cuenta de docente.">
      <form className="stack" onSubmit={submit} noValidate>
        {from !== '/' && !error && <Alert tone="info">Inicia sesión para continuar.</Alert>}
        {error && (
          <Alert tone="warn" role="alert">
            {error}
          </Alert>
        )}
        <TextField label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Button type="submit" variant="primary" loading={loading} className="btn--block">
          Iniciar sesión
        </Button>
        {slow && (
          <p className="caption" role="status">
            Conectando con el servidor… la primera conexión del día puede tardar hasta un minuto.
          </p>
        )}
      </form>
      <p className="auth__switch">
        ¿No tienes cuenta? <Link to="/crear-cuenta">Crear cuenta</Link>
      </p>
    </AuthShell>
  );
}
