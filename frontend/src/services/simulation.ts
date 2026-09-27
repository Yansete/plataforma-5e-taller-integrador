/** Utilidades para simular la latencia de un backend. */

/** Factor global de latencia. Las pruebas lo ponen en 0 para ejecutarse al instante. */
let latencyFactor = 1;

export function setLatencyFactor(factor: number): void {
  latencyFactor = factor;
}

export function wait(ms: number): Promise<void> {
  const duration = ms * latencyFactor;
  if (duration <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}
