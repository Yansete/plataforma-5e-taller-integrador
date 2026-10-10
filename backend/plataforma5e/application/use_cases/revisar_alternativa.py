"""Caso de uso para la revisión docente."""
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.domain.models import RecursoDominio


class RevisarAlternativa:
    def __init__(self, servicio: RecursoService):
        self._servicio = servicio

    def ejecutar(self, recurso_id: str, letra: str, decision: str, texto: str | None = None) -> RecursoDominio:
        return self._servicio.tomar_decision_alternativa(recurso_id, letra, decision, texto)
