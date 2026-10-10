"""Regresión de decisiones, revisión y XML fiel al contenido aprobado."""
from xml.etree import ElementTree as ET

import pytest
from plataforma5e.adapters.outbound.exportacion.moodle_xml import MoodleXMLExportador
from plataforma5e.application.services.recurso_service import RecursoService
from plataforma5e.application.use_cases.revisar_alternativa import RevisarAlternativa
from plataforma5e.application.use_cases.aprobar_recurso import AprobarRecurso
from plataforma5e.application.use_cases.exportar_aprobados import ExportarAprobados
from plataforma5e.domain.errores import RecursoNoEncontrado, SinRecursosAprobados
from tests.unit.test_servicios_aplicacion import RecursoRepoFalso, _item


def test_exportacion_conserva_titulo_html_y_delimitadores():
    recurso = _item()
    recurso.titulo = 'Pilas & colas <comparación>'
    recurso.enunciado = '<p>Contenido con ]]> y &</p>'
    recurso.alternativas[0].texto = 'O(n) & O(1) ]]>'
    repo = RecursoRepoFalso([recurso])
    servicio = RecursoService(repo)
    revisar = RevisarAlternativa(servicio)
    for letra in 'ABC':
        revisar.ejecutar(recurso.id, letra, 'aceptar')
    AprobarRecurso(servicio).ejecutar(recurso.id)
    xml = ExportarAprobados(servicio, MoodleXMLExportador()).ejecutar('moodle_xml')
    pregunta = ET.fromstring(xml).find("question[@type='multichoice']")
    assert pregunta.findtext('name/text') == recurso.titulo
    assert pregunta.findtext('questiontext/text') == recurso.enunciado
    assert pregunta.findtext('answer/text') == recurso.alternativas[0].texto


@pytest.mark.parametrize('decision', ['aprobar', '', 'ACEPTAR'])
def test_decision_invalida_no_modifica_ni_guarda(decision):
    repo = RecursoRepoFalso([_item()])
    with pytest.raises(ValueError, match='Decisión inválida'):
        RevisarAlternativa(RecursoService(repo)).ejecutar('rec-1', 'A', decision)
    assert repo.guardados == 0
    assert repo.recursos['rec-1'].alternativas[0].estado == 'pendiente'


def test_exportacion_sin_aprobados_y_formato_invalido():
    exportar = ExportarAprobados(RecursoService(RecursoRepoFalso([_item()])), MoodleXMLExportador())
    with pytest.raises(SinRecursosAprobados):
        exportar.ejecutar('moodle_xml')
    with pytest.raises(ValueError, match='Formato no soportado'):
        exportar.ejecutar('scorm')


def test_obtener_recurso_inexistente_es_error_de_dominio():
    with pytest.raises(RecursoNoEncontrado):
        RecursoService(RecursoRepoFalso([])).obtener_recurso('ausente')


def test_el_dominio_no_inventa_evidencia():
    primero, segundo = _item(), _item()
    assert primero.citas == []
    assert primero.alternativas[0].fragmentos_origen == []
    primero.citas.append({'fragment_id': 'real'})
    primero.alternativas[0].fragmentos_origen.append('real')
    assert segundo.citas == []
    assert segundo.alternativas[0].fragmentos_origen == []
