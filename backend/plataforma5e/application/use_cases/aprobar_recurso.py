"""Caso de uso para la revisión docente."""
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.domain.models import RecursoDominio


class AprobarRecurso:
    def __init__(self, servicio: RecursoService):
        self._servicio = servicio

    def ejecutar(self, recurso_id: str) -> RecursoDominio:
        return self._servicio.aprobar_recurso(recurso_id)
