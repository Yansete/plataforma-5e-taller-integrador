/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** «true» en la versión publicada en Vercel: solo modo prototipo local, sin backend. */
  readonly VITE_SOLO_LOCAL?: string;
}
