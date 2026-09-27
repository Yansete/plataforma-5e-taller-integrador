/**
 * Preferencias de la interfaz (selecciones y filtros) y restablecimiento de la demostración.
 * Se guardan en el navegador; no forman parte de los datos del backend.
 */
import { resetState, setState } from '../store/store';
import type { UiPreferences } from '../types';

export const preferencesService = {
  update<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]): void {
    setState((s) => ({ ...s, ui: { ...s.ui, [key]: value } }));
  },
  resetDemo(): void {
    resetState();
  },
};
