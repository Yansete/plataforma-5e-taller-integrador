/**
 * TA-008 · Pruebas de caja blanca del almacén del cliente y de las preferencias.
 * Recorren los caminos de lectura del almacenamiento: guardado válido, versión antigua,
 * datos dañados y procesamiento interrumpido por una recarga.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

/** Carga el almacén desde cero, como si el docente recargara la página. */
async function recargar() {
  vi.resetModules();
  const store = await import('./store');
  const { preferencesService } = await import('../services/preferencesService');
  return { ...store, preferencesService };
}

describe('almacén del cliente', () => {
  beforeEach(() => storage.clear());

  it('sin nada guardado arranca con los datos de demostración y solo guarda al primer cambio', async () => {
    const app = await recargar();
    expect(app.getState().resources.length).toBeGreaterThan(0);
    expect(storage.getItem(app.STORAGE_KEY)).toBeNull();
    app.preferencesService.update('exportTargetLms', 'moodle');
    expect(storage.getItem(app.STORAGE_KEY)).not.toBeNull();
  });

  it('conserva los cambios al recargar', async () => {
    const primera = await recargar();
    primera.preferencesService.update('exportTargetLms', 'moodle');
    const segunda = await recargar();
    expect(segunda.getState().ui.exportTargetLms).toBe('moodle');
  });

  it('HU-045 migra la versión 1 sin perder decisiones previas', async () => {
    const app = await recargar();
    const state = app.getState();
    storage.setItem(app.STORAGE_KEY, JSON.stringify({ ...state, version: 1, courses: undefined, units: undefined, ui: { ...state.ui, exportTargetLms: 'moodle' } }));
    const migrated = (await recargar()).getState();
    expect(migrated.courses).toHaveLength(1);
    expect(migrated.units.length).toBeGreaterThan(0);
    expect(migrated.resources).toEqual(state.resources);
    expect(migrated.ui.exportTargetLms).toBe('moodle');
  });

  it('descarta lo guardado si es de otra versión o está dañado', async () => {
    const app = await recargar();
    storage.setItem(app.STORAGE_KEY, JSON.stringify({ ...app.getState(), version: -1, ui: { ...app.getState().ui, exportTargetLms: 'viejo' } }));
    expect((await recargar()).getState().ui.exportTargetLms).not.toBe('viejo');

    storage.setItem(app.STORAGE_KEY, '{esto no es JSON');
    expect((await recargar()).getState().resources.length).toBeGreaterThan(0);
  });

  it('un documento que se estaba procesando queda en error tras recargar', async () => {
    const app = await recargar();
    const estado = app.getState();
    const documento = { ...estado.documents[0], status: 'procesando' as const, currentStep: estado.documents[0].currentStep };
    storage.setItem(app.STORAGE_KEY, JSON.stringify({ ...estado, documents: [documento, ...estado.documents.slice(1)] }));

    const recargado = (await recargar()).getState().documents[0];
    expect(recargado.status).toBe('error');
    expect(recargado.currentStep).toBeNull();
    expect(recargado.errorMessage).toMatch(/recargar/);
  });

  it('avisa a los suscriptores y deja de avisar al desuscribirse', async () => {
    const app = await recargar();
    const aviso = vi.fn();
    const desuscribir = app.subscribe(aviso);
    app.preferencesService.update('selectedResourceId', null);
    expect(aviso).toHaveBeenCalledTimes(1);
    desuscribir();
    app.preferencesService.update('selectedResourceId', null);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('restablecer la demo vuelve al estado inicial', async () => {
    const app = await recargar();
    const inicial = app.getState().ui.exportTargetLms;
    app.preferencesService.update('exportTargetLms', 'chamilo');
    const aviso = vi.fn();
    app.subscribe(aviso);
    app.preferencesService.resetDemo();
    expect(app.getState().ui.exportTargetLms).toBe(inicial);
    expect(aviso).toHaveBeenCalled();
  });

  it('sigue funcionando en memoria si el navegador no deja guardar', async () => {
    const app = await recargar();
    const original = storage.setItem;
    storage.setItem = () => {
      throw new Error('cuota llena');
    };
    try {
      app.preferencesService.update('exportTargetLms', 'sin-guardar');
      expect(app.getState().ui.exportTargetLms).toBe('sin-guardar');
    } finally {
      storage.setItem = original;
    }
  });
});
