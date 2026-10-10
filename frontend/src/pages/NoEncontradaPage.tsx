import { ButtonLink, EmptyState } from '../components/ui';
import { usePageTitle } from './usePageTitle';

export function NoEncontradaPage() {
  usePageTitle('Página no encontrada');
  return (
    <EmptyState icon="info" title="No encontramos esta página" action={<ButtonLink to="/" variant="primary">Ir a Mis cursos</ButtonLink>}>
      Revisa la dirección o vuelve a tus cursos.
    </EmptyState>
  );
}
