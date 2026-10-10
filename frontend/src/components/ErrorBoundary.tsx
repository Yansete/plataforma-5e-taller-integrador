import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Evita la pantalla en blanco: si una pantalla falla al dibujarse, muestra un aviso y permite
 * volver al inicio o restablecer los datos de la demostración. El resto de la aplicación sigue
 * funcionando (menú, sesión). Se reinicia al cambiar de pantalla (`key` en Layout).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error al mostrar la pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="stack">
        <Alert tone="warn" title="No se pudo mostrar esta pantalla" role="alert">
          Ocurrió un error inesperado. Tus datos guardados no se perdieron. Vuelve al inicio o recarga la página; si el
          problema continúa, usa «Restablecer demo» en el menú.
        </Alert>
        <div className="btn-row">
          <Button variant="primary" icon="home" onClick={() => window.location.assign('/')}>
            Volver al inicio
          </Button>
          <Button onClick={() => window.location.reload()}>Recargar la página</Button>
        </div>
      </div>
    );
  }
}
