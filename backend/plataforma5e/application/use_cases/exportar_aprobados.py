"""Exporta únicamente recursos aprobados por el docente."""
from plataforma5e.application.ports.exportador import ExportadorPort
from plataforma5e.application.services.recurso_service import RecursoService


class ExportarAprobados:
    def __init__(self, servicio: RecursoService, exportador: ExportadorPort):
        self._servicio = servicio
        self._exportador = exportador

    def ejecutar(self, formato: str) -> str:
        if formato != "moodle_xml":
            raise ValueError("Formato no soportado")
        return self._exportador.exportar(self._servicio.obtener_aprobados_para_exportar())
