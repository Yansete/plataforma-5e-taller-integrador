"""API EP-002 y HU-001: cuentas de docente, sesiones, cursos y documentos."""
import json
from typing import Literal
from urllib.parse import quote
from fastapi import APIRouter, Depends, Form, UploadFile, File, Response
from pydantic import BaseModel, ConfigDict, Field
from plataforma5e.application.services.configuracion_service import ConfiguracionService, MAX_ARCHIVO
from plataforma5e.domain.configuracion import ConfiguracionError
from plataforma5e.adapters.inbound.autorizacion import obtener_autorizacion

class Contrato(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Login(Contrato):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)
    # La contraseña conserva espacios: pueden formar parte de ella.
    model_config = ConfigDict(extra='forbid')

class Registro(Contrato):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=200)
    model_config = ConfigDict(extra='forbid')

class ResultadoEntrada(Contrato):
    id: str | None = None
    code: str | None = Field(default=None, max_length=20)
    text: str = Field(min_length=1, max_length=400)

class UnidadEntrada(Contrato):
    id: str | None = None
    title: str = Field(min_length=1, max_length=150)
    # None conserva los resultados que ya tenía la unidad; una lista los reemplaza.
    outcomes: list[ResultadoEntrada] | None = Field(default=None, max_length=20)

class CursoEntrada(Contrato):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=150)
    term: str = Field(min_length=1, max_length=30)
    sumilla: str | None = Field(default=None, max_length=3000)
    logro: str | None = Field(default=None, max_length=1000)
    units: list[UnidadEntrada] = Field(min_length=1, max_length=50)

class ContextoDocumento(Contrato):
    unitId: str
    outcomeIds: list[str] = Field(default_factory=list, max_length=50)
    documentType: str
    suggestedStage: Literal['engage', 'explore', 'explain', 'elaborate', 'evaluate'] | None = None
    usePermission: bool

def crear_router_configuracion(servicio: ConfiguracionService):
    router = APIRouter(prefix='/api/v1', tags=['Cuentas, cursos y documentos'])
    def docente(authorization: str | None = Depends(obtener_autorizacion)):
        return servicio.autenticar(authorization)
    @router.post('/cuentas', status_code=201, summary='Crear una cuenta de docente e iniciar sesión')
    def registrar(req: Registro): return servicio.registrar_cuenta(req.name, req.email, req.password)
    @router.post('/sesiones')
    def login(req: Login): return servicio.login(req.email, req.password)
    @router.get('/sesiones/actual')
    def actual(email=Depends(docente)): return servicio.perfil(email)
    @router.delete('/sesiones/actual', status_code=204)
    def logout(authorization: str | None = Depends(obtener_autorizacion)):
        servicio.logout(authorization)
        return Response(status_code=204)
    @router.get('/cursos')
    def cursos(email=Depends(docente)): return servicio.listar_cursos(email)
    @router.post('/cursos', status_code=201)
    def crear(req: CursoEntrada, email=Depends(docente)):
        return servicio.guardar_curso(email, req.model_dump())
    @router.put('/cursos/{id}')
    def editar(id: str, req: CursoEntrada, email=Depends(docente)):
        return servicio.guardar_curso(email, req.model_dump(), id)
    @router.delete('/cursos/{id}', status_code=204, summary='Borrar un curso con su material, recursos y descargas')
    def borrar_curso(id: str, email=Depends(docente)):
        servicio.borrar_curso(email, id)
        return Response(status_code=204)
    @router.get('/documentos')
    def documentos(email=Depends(docente)): return servicio.listar_documentos(email)
    @router.post('/documentos', status_code=201)
    async def cargar(file: UploadFile = File(...), contexto: str = Form(...), email=Depends(docente)):
        try:
            try: datos = ContextoDocumento.model_validate(json.loads(contexto)).model_dump()
            except (ValueError, TypeError): raise ConfiguracionError('CONTEXTO_INVALIDO', 'Revisa los datos del documento.', 422)
            contenido = await file.read(MAX_ARCHIVO + 1)
            return servicio.registrar(email, file.filename, contenido, datos)
        finally: await file.close()
    @router.get('/documentos/{id}/archivo')
    def descargar(id: str, email=Depends(docente)):
        datos, contenido = servicio.obtener_documento(email, id)
        return Response(contenido, media_type={'txt': 'text/plain; charset=utf-8', 'pdf': 'application/pdf', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[datos['kind']], headers={'Content-Disposition': "attachment; filename*=UTF-8''" + quote(datos['fileName'], safe='')})
    @router.delete('/documentos/{id}', status_code=204)
    def borrar(id: str, email=Depends(docente)):
        servicio.borrar_documento(email, id)
        return Response(status_code=204)
    @router.get('/solicitudes')
    def historial(email=Depends(docente)):
        return servicio.listar_solicitudes(email)
    return router
