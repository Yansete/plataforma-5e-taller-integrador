"""Punto de composición de la aplicación FastAPI (Bootstrap)."""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from plataforma5e.domain.configuracion import ConfiguracionError
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.adapters.outbound.persistence.sqlalchemy_configuracion_repository import SQLAlchemyConfiguracionRepository
from plataforma5e.adapters.inbound.configuracion import crear_router_configuracion
from fastapi.exceptions import RequestValidationError

from plataforma5e.adapters.outbound.persistence.sqlalchemy_recurso_repository import SQLAlchemyRecursoRepository
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.adapters.inbound.error_handlers import value_error_handler, request_validation_error_handler
from plataforma5e.adapters.inbound.generaciones import crear_router_generaciones
from plataforma5e.application.services.generacion_service import GeneracionService
from plataforma5e.adapters.outbound.persistence.sqlalchemy_generacion_repository import SQLAlchemyGeneracionRepository


from plataforma5e.adapters.inbound.recursos import crear_router_recursos
from plataforma5e.adapters.inbound.salud import crear_router_salud
from plataforma5e.adapters.outbound.exportacion.moodle_xml import MoodleXMLExportador
from plataforma5e.application.use_cases.revisar_alternativa import RevisarAlternativa
from plataforma5e.application.use_cases.aprobar_recurso import AprobarRecurso
from plataforma5e.application.use_cases.exportar_aprobados import ExportarAprobados
from plataforma5e.domain.errores import RecursoNoEncontrado, RegistroDuplicado, PersistenciaNoDisponible
from plataforma5e.domain.material import MaterialError
from plataforma5e.application.services.material_service import MaterialService
from plataforma5e.adapters.inbound.material import crear_router_material
from plataforma5e.adapters.outbound.persistence.sqlalchemy_material_repository import SQLAlchemyMaterialRepository
from plataforma5e.adapters.outbound.extraccion.extractor_documentos import ExtractorDocumentos
from plataforma5e.adapters.outbound.fuentes.wikipedia import FuenteWikipedia
from plataforma5e.adapters.outbound.ia.configuracion_ia import crear_generadores, describir
from plataforma5e.adapters.inbound.error_handlers import recurso_no_encontrado_handler, error_configuracion, conflicto, error_bd


def crear_aplicacion() -> FastAPI:
    app = FastAPI(title="Plataforma 5E - Backend Hexagonal", version="1.1.0")

    # El frontend publicado (Vercel) llama al backend desde otro dominio: se permite solo
    # a los orígenes de CORS_ORIGENES (separados por comas). En local, Vite usa un proxy.
    origenes = [o.strip().rstrip('/') for o in os.getenv('CORS_ORIGENES', '').split(',') if o.strip()]
    if origenes:
        app.add_middleware(CORSMiddleware, allow_origins=origenes, allow_methods=['*'], allow_headers=['*'])

    # Inyección de dependencias en el arranque
    repositorio = SQLAlchemyRecursoRepository()
    servicio = RecursoService(repositorio)

    generaciones = SQLAlchemyGeneracionRepository()
    repositorio_configuracion = SQLAlchemyConfiguracionRepository(generaciones)
    configuracion = ConfiguracionService(
        repositorio_configuracion,
        correo=os.getenv('EP002_DOCENTE_EMAIL', 'docente@5e.demo'),
        clave=os.getenv('EP002_DOCENTE_PASSWORD', 'Demo5E!2026'),
    )
    # Ingesta y RAG: material real del docente y generador (IA si hay clave; si no, reglas).
    repositorio_material = SQLAlchemyMaterialRepository()
    material = MaterialService(repositorio_configuracion, repositorio_material, ExtractorDocumentos(),
                               FuenteWikipedia() if os.getenv('BUSQUEDA_POR_TEMA', 'true').lower() != 'false' else None)
    generador, respaldo = crear_generadores()
    app.include_router(crear_router_configuracion(configuracion))
    app.include_router(crear_router_material(material, configuracion, describir(generador)))
    app.include_router(crear_router_generaciones(
        GeneracionService(generaciones, repositorio_configuracion, repositorio_material, generador, respaldo), configuracion))

    app.add_exception_handler(ConfiguracionError, error_configuracion)
    app.add_exception_handler(MaterialError, error_configuracion)
    app.add_exception_handler(RegistroDuplicado, conflicto)
    app.add_exception_handler(PersistenciaNoDisponible, error_bd)

    # Manejo único de errores (C02 de EN-006)
    app.add_exception_handler(RecursoNoEncontrado, recurso_no_encontrado_handler)
    app.add_exception_handler(ValueError, value_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)

    app.include_router(crear_router_salud())

    app.include_router(crear_router_recursos(
        servicio, RevisarAlternativa(servicio), AprobarRecurso(servicio),
        ExportarAprobados(servicio, MoodleXMLExportador()),
    ))
    return app
