/** EP-002: frontera HTTP para el catálogo, archivos e historial del docente. */
import { sessionService } from './sessionService';
import { getState, setState } from '../store/store';
import type { Course, Unit, MaterialDocument, GenerationRequest } from '../types';
export type ServerCourse = Course & { units: Unit[] };
export async function configurationFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/v1${path}`, { ...options, headers: { ...sessionService.headers(), ...options.headers }, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 401) sessionService.expire();
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.mensaje ?? `La API rechazó la operación (${response.status}).`);
    }
    return response;
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('No se pudo conectar con el backend. Vuelve a intentar.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function refreshBackendHistory() {
  const identity = sessionService.headers().Authorization;
  const requests: GenerationRequest[] = await (await configurationFetch('/solicitudes')).json();
  if (!identity || identity !== sessionService.headers().Authorization) return;
  setState((s) => ({ ...s, requests }));
}
export async function refreshBackendCatalog() {
  const identity = sessionService.headers().Authorization;
  const [coursesResponse, documentsResponse, requestsResponse] = await Promise.all([
    configurationFetch('/cursos'), configurationFetch('/documentos'), configurationFetch('/solicitudes'),
  ]);
  const courses: ServerCourse[] = await coursesResponse.json();
  const documents: MaterialDocument[] = await documentsResponse.json();
  const requests: GenerationRequest[] = await requestsResponse.json();
  if (!identity || identity !== sessionService.headers().Authorization) throw new Error('La sesión cambió. Vuelve a iniciar sesión.');
  const units = courses.flatMap((c) => c.units);
  const old = getState();
  setState((s) => ({ ...s, courses: courses.map(({ units: _units, ...c }) => c), units,
    documents: [...s.documents.filter((d) => d.isDemo && units.some((u) => u.id === d.unitId)), ...documents], requests,
    ui: { ...s.ui, generationMode: 'api_demo', uploadDefaults: { unitId: units.some((u) => u.id === old.ui.uploadDefaults.unitId) ? old.ui.uploadDefaults.unitId : units[0]?.id ?? '' } },
  }));
}
