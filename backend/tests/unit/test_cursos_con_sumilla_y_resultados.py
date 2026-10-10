"""Cursos con sumilla, logro y resultados de aprendizaje (lo que pidió el asesor el 10/10)."""
from plataforma5e.application.services.configuracion_service import ConfiguracionService


class RepoCursos:
    def __init__(self):
        self.cursos_guardados = {}

    def cursos(self, docente):
        return list(self.cursos_guardados.values())

    def curso_guardar(self, docente, curso):
        self.cursos_guardados[curso['id']] = curso


def curso(**cambios):
    return {'code': 'red-101', 'name': 'Redes', 'term': '2026-II', 'sumilla': ' Curso de redes. ', 'logro': 'Explica redes.',
            'units': [{'title': 'Protocolos', 'outcomes': [{'text': ' Distingue  TCP y UDP '}, {'code': 'RA-X', 'text': 'Compara OSI'}, {'text': '  '}]}],
            **cambios}


def test_crear_curso_guarda_sumilla_logro_y_resultados_con_codigo():
    servicio = ConfiguracionService(RepoCursos(), 'docente@5e.demo', 'clave')
    creado = servicio.guardar_curso('d', curso())
    assert creado['code'] == 'RED-101' and creado['sumilla'] == 'Curso de redes.' and creado['logro'] == 'Explica redes.'
    resultados = creado['units'][0]['outcomes']
    assert [(r['code'], r['text']) for r in resultados] == [('RA1.1', 'Distingue TCP y UDP'), ('RA-X', 'Compara OSI')]
    assert all(r['id'].startswith('ra-') for r in resultados)


def test_editar_conserva_ids_de_resultados_y_datos_no_enviados():
    repo = RepoCursos()
    servicio = ConfiguracionService(repo, 'docente@5e.demo', 'clave')
    creado = servicio.guardar_curso('d', curso())
    unidad = creado['units'][0]
    primero = unidad['outcomes'][0]
    editado = servicio.guardar_curso('d', curso(sumilla=None, logro=None, units=[
        {'id': unidad['id'], 'title': 'Protocolos', 'outcomes': [{'id': primero['id'], 'code': primero['code'], 'text': 'Distingue TCP, UDP e IP'}]},
        {'title': 'Dispositivos'},
    ]), creado['id'])
    assert editado['sumilla'] == 'Curso de redes.'  # sin dato nuevo, se conserva
    assert editado['units'][0]['outcomes'] == [{'id': primero['id'], 'code': 'RA1.1', 'text': 'Distingue TCP, UDP e IP'}]
    assert editado['units'][1]['outcomes'] == []
    sin_cambios = servicio.guardar_curso('d', curso(units=[{'id': unidad['id'], 'title': 'Protocolos'}, {'id': editado['units'][1]['id'], 'title': 'Dispositivos'}]), creado['id'])
    assert sin_cambios['units'][0]['outcomes'] == editado['units'][0]['outcomes']  # sin lista, se conservan


def test_id_repetido_o_ajeno_crea_uno_nuevo():
    repo = RepoCursos()
    servicio = ConfiguracionService(repo, 'docente@5e.demo', 'clave')
    creado = servicio.guardar_curso('d', curso())
    unidad = creado['units'][0]
    ident = unidad['outcomes'][0]['id']
    editado = servicio.guardar_curso('d', curso(units=[{'id': unidad['id'], 'title': 'Protocolos', 'outcomes': [
        {'id': ident, 'text': 'Uno'}, {'id': ident, 'text': 'Dos'}, {'id': 'ra-inventado', 'text': 'Tres'}]}]), creado['id'])
    ids = [r['id'] for r in editado['units'][0]['outcomes']]
    assert ids[0] == ident and len(set(ids)) == 3 and 'ra-inventado' not in ids
