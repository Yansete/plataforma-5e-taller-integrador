"""Rutas de recursos y exportación; delegan reglas en casos de uso."""
from typing import Any
from fastapi import APIRouter, Response
from pydantic import BaseModel
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.application.use_cases.revisar_alternativa import RevisarAlternativa
from plataforma5e.application.use_cases.aprobar_recurso import AprobarRecurso
from plataforma5e.application.use_cases.exportar_aprobados import ExportarAprobados


class DecisionRequest(BaseModel):
    decision: str
    texto: str | None = None


class ExportacionRequest(BaseModel):
    formato: str


def crear_router_recursos(servicio: RecursoService, revisar: RevisarAlternativa,
                         aprobar: AprobarRecurso, exportar: ExportarAprobados) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.post("/recursos/generar")
    def generar_recursos(payload: dict[str, Any]):
        return servicio.generar_o_reiniciar_recursos()

    @router.get("/recursos/{recurso_id}")
    def obtener_recurso(recurso_id: str):
        return servicio.obtener_recurso(recurso_id)

    @router.post("/recursos/{recurso_id}/alternativas/{letra}/decision")
    def tomar_decision(recurso_id: str, letra: str, req: DecisionRequest):
        revisar.ejecutar(recurso_id, letra, req.decision, req.texto)
        return {"estado": "actualizado"}

    @router.post("/recursos/{recurso_id}/aprobar")
    def aprobar_recurso(recurso_id: str):
        aprobar.ejecutar(recurso_id)
        return {"estado": "aprobado"}

    @router.post("/exportaciones")
    def exportar_recursos(req: ExportacionRequest):
        return Response(content=exportar.ejecutar(req.formato), media_type="application/xml")

    return router
