import pytest
from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.domain.configuracion import ConfiguracionError
from tests.unit.test_servicios_aplicacion import ConfiguracionRepoFalso


def test_credenciales_inyectadas_sin_leer_el_entorno(monkeypatch):
    monkeypatch.setenv('EP002_DOCENTE_EMAIL', 'ignorado@example.com')
    servicio = ConfiguracionService(ConfiguracionRepoFalso(), ' Docente@example.com ', ' clave con espacios ')
    assert servicio.login('docente@example.com', ' clave con espacios ')['email'] == 'docente@example.com'
    with pytest.raises(ConfiguracionError):
        servicio.login('docente@5e.demo', 'Demo5E!2026')


def test_consultas_documentos_y_historial_por_el_servicio():
    repo = ConfiguracionRepoFalso()
    servicio = ConfiguracionService(repo, 'docente@example.com', 'clave')
    servicio.login('docente@example.com', 'clave')
    assert servicio.listar_cursos('docente@example.com')[0]['id'] == 'curso-1'
    repo.documento_guardar('docente@example.com', {'id': 'doc-1'}, b'original')
    assert servicio.listar_documentos('docente@example.com') == [{'id': 'doc-1'}]
    assert servicio.obtener_documento('docente@example.com', 'doc-1') == ({'id': 'doc-1'}, b'original')
    with pytest.raises(ConfiguracionError) as error:
        servicio.obtener_documento('otro@example.com', 'doc-1')
    assert error.value.status == 404
    repo.historial = lambda email: [{'createdAt': '2026-10-01'}, {'createdAt': '2026-10-09'}]
    assert servicio.listar_solicitudes('docente@example.com')[0]['createdAt'] == '2026-10-09'
    servicio.borrar_documento('docente@example.com', 'doc-1')
    assert servicio.listar_documentos('docente@example.com') == []
    with pytest.raises(ConfiguracionError):
        servicio.borrar_documento('docente@example.com', 'doc-1')
