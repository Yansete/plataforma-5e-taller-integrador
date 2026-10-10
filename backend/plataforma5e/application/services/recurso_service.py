"""Casos de uso para recursos formativos y exportación."""
from typing import List, Optional
from plataforma5e.application.ports.recurso_repository import RecursoRepositoryPort
from plataforma5e.domain.models import RecursoDominio
from plataforma5e.domain.errores import RecursoNoEncontrado, SinRecursosAprobados


class RecursoService:
    def __init__(self, repositorio: RecursoRepositoryPort):
        self._repo = repositorio

    def generar_o_reiniciar_recursos(self) -> List[RecursoDominio]:
        return self._repo.reiniciar_demo()

    def obtener_recurso(self, recurso_id: str) -> RecursoDominio:
        recurso = self._repo.obtener_por_id(recurso_id)
        if recurso is None:
            raise RecursoNoEncontrado()
        return recurso

    def tomar_decision_alternativa(self, recurso_id: str, letra: str, decision: str, nuevo_texto: Optional[str] = None) -> RecursoDominio:
        if decision not in {"aceptar", "descartar", "editar"}:
            raise ValueError("Decisión inválida: usa aceptar, descartar o editar")
        recurso = self._repo.obtener_por_id(recurso_id)
        if not recurso:
            raise RecursoNoEncontrado()

        alt = next((a for a in recurso.alternativas if a.letra == letra), None)
        if not alt:
            raise ValueError("Alternativa no encontrada")

        if decision == "aceptar":
            alt.estado = "aceptado"
        elif decision == "descartar":
            alt.estado = "descartado"
        elif decision == "editar":
            alt.estado = "editado"
            if nuevo_texto:
                alt.texto = nuevo_texto

        return self._repo.guardar(recurso)

    def aprobar_recurso(self, recurso_id: str) -> RecursoDominio:
        recurso = self._repo.obtener_por_id(recurso_id)
        if not recurso:
            raise RecursoNoEncontrado()

        pendientes = [a for a in recurso.alternativas if a.estado == "pendiente"]
        if pendientes:
            raise ValueError("aprobacion_bloqueada: faltan alternativas por revisar")

        recurso.estado_revision = "aprobado"
        return self._repo.guardar(recurso)

    def obtener_aprobados(self) -> List[RecursoDominio]:
        return [r for r in self._repo.obtener_todos() if r.estado_revision == "aprobado"]

    def obtener_aprobados_para_exportar(self) -> List[RecursoDominio]:
        aprobados = self.obtener_aprobados()
        if not aprobados:
            raise SinRecursosAprobados()
        return aprobados
