/**
 * Almacén del cliente.
 *
 * Guarda en memoria el estado de la demostración y lo persiste en localStorage.
 * Solo se guardan METADATOS y datos de demostración: nunca el contenido de archivos.
 *
 * Las pantallas LEEN con `useAppState`; para MODIFICAR datos deben usar los servicios
 * (src/services). Así, al conectar el backend solo cambian los servicios.
 */
import { useSyncExternalStore } from 'react';
import type { AppState } from '../types';
import { STATE_VERSION, createInitialState } from './initialState';

const LOCAL_STORAGE_KEY = 'plataforma5e.demo.v1';
export let STORAGE_KEY = LOCAL_STORAGE_KEY;

type Listener = () => void;

function readPersisted(): AppState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!Array.isArray(parsed?.resources)) return null;
    // HU-045: conserva las decisiones previas al añadir el catálogo editable.
    if (parsed.version === 1) {
      const initial = createInitialState();
      parsed.courses = initial.courses;
      parsed.units = initial.units;
      parsed.version = STATE_VERSION;
    }
    if (parsed.version !== STATE_VERSION || !Array.isArray(parsed.courses) || !Array.isArray(parsed.units)) return null;
    // Un procesamiento simulado interrumpido por una recarga no puede continuar.
    parsed.documents = parsed.documents.map((d) =>
      d.status === 'procesando'
        ? { ...d, status: 'error', currentStep: null, errorMessage: 'El procesamiento simulado se interrumpió al recargar la página. Vuelve a intentarlo.' }
        : d,
    );
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(state: AppState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena): la app sigue en memoria.
  }
}

let state: AppState = readPersisted() ?? createInitialState();
const listeners = new Set<Listener>();

// Cada modo conserva su propio catálogo y sus decisiones locales.
export function selectSessionStore(email?: string): void {
  STORAGE_KEY = email ? `plataforma5e.backend.${email}` : LOCAL_STORAGE_KEY;
  const saved = readPersisted();
  state = saved ?? createInitialState();
  if (email && !saved) { state.resources = []; state.requests = []; state.ui.selectedResourceId = null; state.ui.generationMode = 'api_demo'; }
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function setState(updater: (current: AppState) => AppState): void {
  state = updater(state);
  writePersisted(state);
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Restablece los datos de demostración y borra lo guardado en el navegador. */
export function resetState(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorar
  }
  state = createInitialState();
  writePersisted(state);
  listeners.forEach((l) => l());
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
