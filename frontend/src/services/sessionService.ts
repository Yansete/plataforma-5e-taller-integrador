/** HU-045 local y EP-002: cuenta demo verificada por el servidor, con token revocable. */
import { useSyncExternalStore } from 'react';
import { selectSessionStore } from '../store/store';
import { apiUrl } from '../config/despliegue';
const KEY = 'plataforma5e.session.demo';
const API_KEY = 'plataforma5e.session.backend';
export const DEMO_EMAIL = 'docente@5e.demo';
export const DEMO_PASSWORD = 'Demo5E!2026';
type ApiSession = { email: string; token: string };
function readApi(): ApiSession | null {
  try { const value = JSON.parse(sessionStorage.getItem(API_KEY) ?? 'null'); return value && typeof value.email === 'string' && typeof value.token === 'string' ? value : null; } catch { return null; }
}
let apiSession = readApi();
if (apiSession) selectSessionStore(apiSession.email);
function readSession(): string | null {
  try { return apiSession?.email ?? (sessionStorage.getItem(KEY) === DEMO_EMAIL ? DEMO_EMAIL : null); } catch { return null; }
}
let session = readSession();
const listeners = new Set<() => void>();
function update(value: string | null) {
  session = value;
  try { if (value && !apiSession) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY);
    if (apiSession) sessionStorage.setItem(API_KEY, JSON.stringify(apiSession)); else sessionStorage.removeItem(API_KEY);
  } catch { /* sesión en memoria */ }
  listeners.forEach((listener) => listener());
}
export const sessionService = {
  isBackend: () => apiSession !== null,
  headers: (): Record<string, string> => apiSession ? { Authorization: `Bearer ${apiSession.token}` } : {},
  expire() { apiSession = null; selectSessionStore(); update(null); },
  login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Ingresa un correo electrónico válido.');
    if (!password) throw new Error('Ingresa la contraseña.');
    if (normalized !== DEMO_EMAIL || password !== DEMO_PASSWORD) throw new Error('Correo o contraseña incorrectos. Usa las credenciales de demostración.');
    selectSessionStore();
    apiSession = null; update(normalized);
  },
  async loginBackend(email: string, password: string) {
    // El servidor gratuito se duerme tras 15 minutos sin uso y tarda hasta un minuto en despertar.
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(apiUrl('/api/v1/sesiones'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: controller.signal });
      const value = await response.json().catch(() => null);
      if (!value) throw new Error('El backend no respondió correctamente. Comprueba que esté iniciado.');
      if (!response.ok) throw new Error(value.error?.mensaje ?? 'No se pudo iniciar sesión.');
      if (typeof value.email !== 'string' || typeof value.token !== 'string') throw new Error('Respuesta de sesión incompatible.');
      selectSessionStore(value.email); apiSession = { email: value.email, token: value.token }; update(value.email);
    } catch (error) {
      if (error instanceof TypeError || controller.signal.aborted) throw new Error('No se pudo conectar con el backend. Inícialo y vuelve a intentar.');
      throw error;
    } finally { clearTimeout(timer); }
  },
  async logout() {
    // Revocación primero: si la API falla se conserva la sesión para reintentar.
    if (apiSession) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
      try { const response = await fetch(apiUrl('/api/v1/sesiones/actual'), { method: 'DELETE', headers: this.headers(), signal: controller.signal });
        if (!response.ok && response.status !== 401) throw new Error('No se pudo cerrar la sesión en el servidor. Vuelve a intentar.');
      } finally { clearTimeout(timer); }
    }
    const backend = !!apiSession; apiSession = null; update(null); if (backend) selectSessionStore();
  },
};
export function useDemoSession() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => session, () => null);
}
