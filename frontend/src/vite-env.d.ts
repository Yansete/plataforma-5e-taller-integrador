/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** «true» para publicar sin backend: solo modo prototipo local. */
  readonly VITE_SOLO_LOCAL?: string;
  /** Dirección del backend publicado, sin barra final. Vacía: mismo dominio (proxy de Vite en local). */
  readonly VITE_API_URL?: string;
}
