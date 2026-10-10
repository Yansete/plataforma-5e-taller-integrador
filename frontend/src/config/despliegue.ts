/**
 * Configuración del despliegue.
 *
 * - VITE_SOLO_LOCAL=true: versión sin backend; solo se ofrece el modo «Prototipo local».
 * - VITE_API_URL: dirección del backend publicado (por ejemplo https://plataforma5e-api.onrender.com).
 *   Si no se define, el frontend llama a /api en el mismo dominio (en local, Vite lo redirige al puerto 8000).
 * Ambas variables se fijan al compilar (ver frontend/vercel.json).
 */
export const SOLO_LOCAL = import.meta.env?.VITE_SOLO_LOCAL === 'true';

export const API_BASE = (import.meta.env?.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

/** Dirección completa de una ruta de la API, por ejemplo apiUrl('/api/v1/cursos'). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** true cuando el frontend publicado tiene un backend configurado: el modo servidor es el recomendado. */
export const BACKEND_PUBLICADO = API_BASE !== '';
