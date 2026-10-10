"""Los adaptadores traducen fallos técnicos antes de llegar a HTTP."""
import pytest
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from plataforma5e.adapters.outbound.persistence import sqlalchemy_generacion_repository as modulo
from plataforma5e.adapters.outbound.persistence.sqlalchemy_configuracion_repository import SQLAlchemyConfiguracionRepository
from plataforma5e.adapters.inbound.generaciones import crear_router_generaciones
from plataforma5e.application.services.generacion_service import GeneracionService
from plataforma5e.domain.errores import PersistenciaNoDisponible, RegistroDuplicado


def test_repositorio_configuracion_recibe_el_catalogo_por_constructor():
    class Catalogo:
        def catalogo_demo(self):
            return {'units': [{'id': 'unidad-inyectada', 'title': 'Prueba'}]}
    repo = SQLAlchemyConfiguracionRepository(Catalogo())
    repo.iniciar_catalogo('inyeccion@example.com')
    assert repo.cursos('inyeccion@example.com')[0]['units'][0]['id'] == 'unidad-inyectada'


@pytest.mark.parametrize('error,esperado', [
    (SQLAlchemyError('detalle interno'), PersistenciaNoDisponible),
    (IntegrityError('SQL interno', {}, Exception()), RegistroDuplicado),
])
def test_error_sql_no_atraviesa_el_puerto(monkeypatch, error, esperado):
    repo = modulo.SQLAlchemyGeneracionRepository()
    def fallar():
        raise error
    monkeypatch.setattr(modulo, 'SessionLocal', fallar)
    with pytest.raises(esperado):
        repo.guardar({'request': {'id': 'sol-prueba'}})


def test_generacion_con_bd_caida_conserva_respuesta_503(monkeypatch):
    repo = modulo.SQLAlchemyGeneracionRepository()
    def fallar():
        raise SQLAlchemyError('no debe filtrarse a HTTP')
    monkeypatch.setattr(modulo, 'SessionLocal', fallar)
    app = FastAPI()
    app.include_router(crear_router_generaciones(GeneracionService(repo)))
    respuesta = TestClient(app).post('/api/v1/generaciones', json={
        'unidad_id': 'u2', 'etapa_5e': 'explore', 'tipo_recurso': 'guia_exploracion', 'cantidad': 1,
    })
    assert respuesta.status_code == 503
    assert respuesta.json()['error']['codigo'] == 'PERSISTENCIA_NO_DISPONIBLE'
    assert 'no debe filtrarse' not in respuesta.text
