"""Punto de composición de la aplicación FastAPI (Bootstrap)."""
from __future__ import annotations

from typing import Any, Dict, List
from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from plataforma5e.domain.configuracion import ConfiguracionError
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.adapters.outbound.persistence.sqlalchemy_configuracion_repository import SQLAlchemyConfiguracionRepository
from plataforma5e.adapters.inbound.configuracion import crear_router_configuracion
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

from plataforma5e.adapters.outbound.persistence.sqlalchemy_recurso_repository import SQLAlchemyRecursoRepository
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.adapters.inbound.error_handlers import value_error_handler, request_validation_error_handler
from plataforma5e.domain.models import RecursoDominio
from plataforma5e.adapters.inbound.generaciones import crear_router_generaciones
from plataforma5e.application.services.generacion_service import GeneracionService
from plataforma5e.adapters.outbound.persistence.sqlalchemy_generacion_repository import SQLAlchemyGeneracionRepository


class DecisionRequest(BaseModel):
    decision: str
    texto: str | None = None


class ExportacionRequest(BaseModel):
    formato: str


def generar_moodle_xml(recursos_aprobados: List[RecursoDominio]) -> str:
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', "<quiz>"]
    xml.append('  <question type="category"><category><text>$course$/top/Por defecto en Curso</text></category><info format="html"><text></text></info><idnumber></idnumber></question>')

    for r in recursos_aprobados:
        vigentes = [a for a in r.alternativas if a.estado != "descartado"]
        xml.append('  <question type="multichoice">')
        xml.append(f"    <name><text>{r.titulo}</text></name>")
        xml.append(f'    <questiontext format="html"><text><![CDATA[{r.enunciado}]]></text></questiontext>')
        xml.append(f'    <generalfeedback format="html"><text><![CDATA[{r.retroalimentacion}]]></text></generalfeedback>')
        xml.append("    <defaultgrade>1.0000000</defaultgrade>")
        xml.append("    <penalty>0.3333333</penalty>")
        xml.append("    <hidden>0</hidden>")
        xml.append("    <idnumber></idnumber>")
        xml.append("    <single>true</single>")
        xml.append("    <shuffleanswers>true</shuffleanswers>")
        xml.append("    <answernumbering>abc</answernumbering>")
        xml.append("    <showstandardinstruction>0</showstandardinstruction>")
        xml.append('    <correctfeedback format="html"><text><![CDATA[<p>Respuesta correcta.</p>]]></text></correctfeedback>')
        xml.append('    <partiallycorrectfeedback format="html"><text><![CDATA[<p>Respuesta parcialmente correcta.</p>]]></text></partiallycorrectfeedback>')
        xml.append('    <incorrectfeedback format="html"><text><![CDATA[<p>Respuesta incorrecta.</p>]]></text></incorrectfeedback>')
        xml.append("    <shownumcorrect/>")

        for alt in vigentes:
            frac = "100" if alt.es_correcta else "0"
            xml.append(f'    <answer fraction="{frac}" format="html">')
            xml.append(f'      <text><![CDATA[{alt.texto}]]></text>')
            xml.append(f'      <feedback format="html"><text><![CDATA[{alt.justificacion}]]></text></feedback>')
            xml.append("    </answer>")
        xml.append("  </question>")

    xml.append("</quiz>")
    return "\n".join(xml)


def crear_aplicacion() -> FastAPI:
    app = FastAPI(title="Plataforma 5E - Backend Hexagonal", version="1.0.0")

    # Inyección de dependencias en el arranque
    repositorio = SQLAlchemyRecursoRepository()
    servicio = RecursoService(repositorio)

    configuracion = ConfiguracionService(SQLAlchemyConfiguracionRepository())
    app.include_router(crear_router_configuracion(configuracion))
    app.include_router(crear_router_generaciones(GeneracionService(SQLAlchemyGeneracionRepository()), configuracion))

    @app.exception_handler(ConfiguracionError)
    async def error_configuracion(request, exc):
        return JSONResponse(status_code=exc.status, content={'error': {'codigo': exc.codigo, 'mensaje': exc.mensaje}})

    @app.exception_handler(IntegrityError)
    async def conflicto(request, exc):
        return JSONResponse(status_code=409, content={'error': {'codigo': 'REGISTRO_DUPLICADO', 'mensaje': 'El registro ya existe. Actualiza la lista y revisa los datos.'}})

    @app.exception_handler(SQLAlchemyError)
    async def error_bd(request, exc):
        return JSONResponse(status_code=503, content={'error': {'codigo': 'PERSISTENCIA_NO_DISPONIBLE', 'mensaje': 'No se pudo guardar o consultar. Comprueba la conexión de la base de datos.'}})

    # Manejo único de errores (C02 de EN-006)
    app.add_exception_handler(ValueError, value_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)

    @app.get("/salud")
    def salud():
        return {"estado": "ok"}

    @app.post("/api/v1/recursos/generar")
    def generar_recursos(payload: Dict[str, Any]):
        return servicio.generar_o_reiniciar_recursos()

    @app.get("/api/v1/recursos/{recurso_id}")
    def obtener_recurso(recurso_id: str):
        rec = servicio.obtener_recurso(recurso_id)
        if not rec:
            raise ValueError("Recurso no encontrado")
        return rec

    @app.post("/api/v1/recursos/{recurso_id}/alternativas/{letra}/decision")
    def tomar_decision(recurso_id: str, letra: str, req: DecisionRequest):
        servicio.tomar_decision_alternativa(recurso_id, letra, req.decision, req.texto)
        return {"estado": "actualizado"}

    @app.post("/api/v1/recursos/{recurso_id}/aprobar")
    def aprobar_recurso(recurso_id: str):
        servicio.aprobar_recurso(recurso_id)
        return {"estado": "aprobado"}

    @app.post("/api/v1/exportaciones")
    def exportar_recursos(req: ExportacionRequest):
        if req.formato != "moodle_xml":
            raise ValueError("Formato no soportado")
        aprobados = servicio.obtener_aprobados()
        contenido_xml = generar_moodle_xml(aprobados)
        return Response(content=contenido_xml, media_type="application/xml")

    return app