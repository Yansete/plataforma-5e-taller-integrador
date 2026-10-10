/**
 * Versión publicada para revisión (Vercel). No hay backend desplegado, así que solo se ofrece
 * el modo «Prototipo local»: los datos se guardan en el navegador de quien la abre.
 * Se activa al compilar con VITE_SOLO_LOCAL=true (ver frontend/vercel.json).
 */
export const SOLO_LOCAL = import.meta.env?.VITE_SOLO_LOCAL === 'true';
