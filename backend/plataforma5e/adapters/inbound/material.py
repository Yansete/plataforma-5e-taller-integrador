"""API de ingesta y RAG: procesar documentos, ver sus fragmentos y crear material desde un tema."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from plataforma5e.adapters.inbound.autorizacion import obtener_autorizacion
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.application.services.material_service import MaterialService


class TemaEntrada(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    unitId: str = Field(min_length=1, max_length=120)
    tema: str = Field(min_length=3, max_length=120)
    maximo: int = Field(default=3, ge=1, le=5)


def crear_router_material(material: MaterialService, configuracion: ConfiguracionService, generador: dict) -> APIRouter:
    router = APIRouter(prefix='/api/v1', tags=['Ingesta y RAG'])

    def docente(authorization: str | None = Depends(obtener_autorizacion)):
        return configuracion.autenticar(authorization)

    @router.post('/documentos/desde-tema', status_code=201, summary='Buscar un tema en fuentes abiertas y guardarlo como material procesado')
    def desde_tema(req: TemaEntrada, email=Depends(docente)):
        return material.desde_tema(email, req.unitId, req.tema, req.maximo)

    @router.post('/documentos/{id}/procesar', summary='Extraer el texto del documento y partirlo en fragmentos')
    def procesar(id: str, email=Depends(docente)):
        return material.procesar(email, id)

    @router.get('/documentos/{id}/fragmentos', summary='Ver los fragmentos de un documento procesado')
    def fragmentos(id: str, email=Depends(docente)):
        return material.fragmentos(email, id)

    @router.get('/ia', summary='Generador activo: modelo de IA o reglas')
    def ia():
        return generador

    return router
