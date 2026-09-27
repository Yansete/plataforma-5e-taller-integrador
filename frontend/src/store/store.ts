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

export const STORAGE_KEY = 'plataforma5e.demo.v1';

type Listener = () => void;

function readPersisted(): AppState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed?.version !== STATE_VERSION || !Array.isArray(parsed.resources)) return null;
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
