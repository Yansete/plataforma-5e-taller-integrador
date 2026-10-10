"""API de la revisión docente (HU-010) y del historial de descargas de cada unidad."""
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field

from plataforma5e.adapters.inbound.autorizacion import obtener_autorizacion
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.application.services.revision_service import RevisionService

Motivo = Literal['sin_sentido', 'tambien_correcto', 'duplicado', 'fuera_de_unidad', 'otro', 'regenerado']


class Contrato(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class OpcionRevisada(Contrato):
    id: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=600)
    feedback: str = Field(default='', max_length=600)
    decision: Literal['pendiente', 'aceptado', 'descartado']
    discardReason: Motivo | None = None
    edited: bool = False


class RecursoRevisado(Contrato):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=8000)
    status: Literal['pendiente', 'aprobado', 'descartado']
    discardReason: Motivo | None = None
    edited: bool = False
    options: list[OpcionRevisada] | None = Field(default=None, max_length=10)


class DescargaEntrada(Contrato):
    format: Literal['moodle_xml', 'qti21', 'documento']
    fileName: str = Field(min_length=1, max_length=200)
    resourceCount: int = Field(ge=0, le=500)


def crear_router_revision(revision: RevisionService, configuracion: ConfiguracionService) -> APIRouter:
    router = APIRouter(prefix='/api/v1', tags=['Revisión y descargas'])

    def docente(authorization: str | None = Depends(obtener_autorizacion)):
        return configuracion.autenticar(authorization)

    @router.get('/resumen', summary='Recursos aprobados y por revisar de cada unidad del docente')
    def resumen(email=Depends(docente)):
        return revision.resumen(email)

    @router.get('/unidades/{unidad_id}/recursos', summary='Recursos generados para la unidad, con su revisión')
    def recursos(unidad_id: str, email=Depends(docente)):
        return revision.listar(email, unidad_id)

    @router.put('/unidades/{unidad_id}/recursos/{recurso_id}', summary='Guardar la revisión de un recurso')
    def revisar(unidad_id: str, recurso_id: str, req: RecursoRevisado, email=Depends(docente)):
        return revision.actualizar(email, unidad_id, recurso_id, req.model_dump())

    @router.delete('/unidades/{unidad_id}/recursos/{recurso_id}', status_code=204, summary='Borrar un recurso')
    def borrar(unidad_id: str, recurso_id: str, email=Depends(docente)):
        revision.borrar(email, unidad_id, recurso_id)
        return Response(status_code=204)

    @router.get('/unidades/{unidad_id}/descargas', summary='Historial de descargas de la unidad')
    def descargas(unidad_id: str, email=Depends(docente)):
        return revision.descargas(email, unidad_id)

    @router.post('/unidades/{unidad_id}/descargas', status_code=201, summary='Registrar una descarga')
    def registrar(unidad_id: str, req: DescargaEntrada, email=Depends(docente)):
        return revision.registrar_descarga(email, unidad_id, req.model_dump())

    @router.delete('/unidades/{unidad_id}/descargas', status_code=204, summary='Borrar el historial de descargas de la unidad')
    def borrar_historial(unidad_id: str, email=Depends(docente)):
        revision.borrar_descargas(email, unidad_id)
        return Response(status_code=204)

    return router
