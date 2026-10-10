/** HU-045: sesión de demostración. No autentica contra servidor ni almacena contraseñas. */
import { useSyncExternalStore } from 'react';
const KEY = 'plataforma5e.session.demo';
export const DEMO_EMAIL = 'docente@5e.demo';
export const DEMO_PASSWORD = 'Demo5E!2026';
function readSession(): string | null {
  try { return sessionStorage.getItem(KEY) === DEMO_EMAIL ? DEMO_EMAIL : null; } catch { return null; }
}
let session = readSession();
const listeners = new Set<() => void>();
function update(value: string | null) {
  session = value;
  try { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); } catch { /* sesión en memoria */ }
  listeners.forEach((listener) => listener());
}
export const sessionService = {
  login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Ingresa un correo electrónico válido.');
    if (!password) throw new Error('Ingresa la contraseña.');
    if (normalized !== DEMO_EMAIL || password !== DEMO_PASSWORD) throw new Error('Correo o contraseña incorrectos. Usa las credenciales de demostración.');
    update(normalized);
  },
  logout() { update(null); },
};
export function useDemoSession() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => session, () => null);
}
