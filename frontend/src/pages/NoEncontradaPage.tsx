import { ButtonLink, Card, EmptyState, PageHeader } from '../components/ui';

export function NoEncontradaPage() {
  return (
    <>
      <PageHeader overline="Error 404" title="Página no encontrada" />
      <Card>
        <EmptyState icon="alert" title="La dirección no corresponde a ninguna pantalla" action={<ButtonLink to="/" variant="primary" icon="home">Volver al inicio</ButtonLink>}>
          Revisa el enlace o usa el menú de navegación.
        </EmptyState>
      </Card>
    </>
  );
}
