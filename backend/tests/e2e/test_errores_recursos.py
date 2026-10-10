import httpx
import pytest


@pytest.mark.parametrize('ruta,payload', [
    ('/api/v1/recursos/ausente', None),
    ('/api/v1/recursos/ausente/aprobar', {}),
    ('/api/v1/recursos/ausente/alternativas/A/decision', {'decision': 'aceptar'}),
])
def test_recurso_inexistente_devuelve_404(servidor, ruta, payload):
    r = httpx.get(servidor + ruta) if payload is None else httpx.post(servidor + ruta, json=payload)
    assert r.status_code == 404
    assert r.json()['error']['codigo'] == 'RECURSO_NO_ENCONTRADO'


def test_exportar_sin_aprobados_devuelve_error(servidor):
    httpx.post(servidor + '/api/v1/recursos/generar', json={}).raise_for_status()
    r = httpx.post(servidor + '/api/v1/exportaciones', json={'formato': 'moodle_xml'})
    assert r.status_code == 400
    assert 'No hay recursos aprobados' in r.json()['error']['mensaje']
