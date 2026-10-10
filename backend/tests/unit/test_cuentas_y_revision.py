"""Cuentas de docente, borrado de cursos y revisión guardada en la base de datos, con puertos falsos."""
import pytest

from plataforma5e.application.services.configuracion_service import ConfiguracionService
from plataforma5e.application.services.revision_service import RevisionService, bloqueos_aprobacion
from plataforma5e.domain.configuracion import ConfiguracionError
from tests.unit.test_servicios_aplicacion import ConfiguracionRepoFalso

INICIAL, CLAVE_INICIAL = 'docente@5e.demo', 'Demo5E!2026'


@pytest.fixture(scope='module')
def servicio_base():
    return ConfiguracionService(ConfiguracionRepoFalso(), INICIAL, CLAVE_INICIAL, catalogo_demo=False)


@pytest.fixture
def servicio(servicio_base):
    servicio_base.repo = ConfiguracionRepoFalso()
    return servicio_base


def codigo(funcion, *args):
    with pytest.raises(ConfiguracionError) as error:
        funcion(*args)
    return error.value.codigo, error.value.status


def test_crear_cuenta_abre_sesion_y_permite_volver_a_entrar(servicio):
    sesion = servicio.registrar_cuenta('  Ana   Pérez ', ' Ana@Correo.pe ', 'clave-segura')
    assert sesion['email'] == 'ana@correo.pe' and sesion['name'] == 'Ana Pérez' and sesion['token']
    guardado = servicio.repo.usuarios['ana@correo.pe']
    assert 'clave-segura' not in str(guardado) and len(guardado['sal']) == 32  # solo la huella y su sal
    assert servicio.autenticar('Bearer ' + sesion['token']) == 'ana@correo.pe'
    assert servicio.login('ANA@correo.pe', 'clave-segura')['name'] == 'Ana Pérez'
    assert servicio.perfil('ana@correo.pe') == {'email': 'ana@correo.pe', 'name': 'Ana Pérez'}
    assert codigo(servicio.login, 'ana@correo.pe', 'otra-clave') == ('CREDENCIALES_INVALIDAS', 401)


def test_crear_cuenta_valida_los_datos(servicio):
    servicio.registrar_cuenta('Ana', 'ana@correo.pe', 'clave-segura')
    assert codigo(servicio.registrar_cuenta, 'Otra', 'ana@correo.pe', 'clave-segura') == ('CUENTA_EXISTENTE', 409)
    assert codigo(servicio.registrar_cuenta, 'Otra', INICIAL, 'clave-segura') == ('CUENTA_EXISTENTE', 409)
    assert codigo(servicio.registrar_cuenta, 'A', 'b@correo.pe', 'clave-segura')[0] == 'NOMBRE_INVALIDO'
    assert codigo(servicio.registrar_cuenta, 'Beto', 'sin-arroba', 'clave-segura')[0] == 'CORREO_INVALIDO'
    assert codigo(servicio.registrar_cuenta, 'Beto', 'b@correo.pe', 'corta')[0] == 'CLAVE_INSEGURA'


def test_cuenta_inicial_sigue_funcionando_sin_curso_de_ejemplo(servicio):
    sesion = servicio.login(INICIAL, CLAVE_INICIAL)
    assert sesion['name'] == 'Docente' and servicio.repo.catalogos == {}  # catalogo_demo=False: empieza vacío
    assert servicio.perfil(INICIAL)['name'] == 'Docente'


def test_borrar_curso_incluye_sus_unidades(servicio):
    curso = servicio.guardar_curso('ana@correo.pe', {'code': 'red-301', 'name': 'Redes', 'term': '2026-II',
                                                       'units': [{'title': 'Protocolos'}, {'title': 'Subredes'}]})
    servicio.borrar_curso('ana@correo.pe', curso['id'])
    assert servicio.listar_cursos('ana@correo.pe') == []
    assert servicio.repo.borrados == [('ana@correo.pe', curso['id'], [u['id'] for u in curso['units']])]
    assert codigo(servicio.borrar_curso, 'ana@correo.pe', curso['id']) == ('CURSO_NO_ENCONTRADO', 404)


# --------------------------------------------------------------------------- revisión

class ConfigFalsa:
    def cursos(self, docente):
        return [{'id': 'c1', 'units': [{'id': 'u1'}, {'id': 'u2'}]}] if docente == 'ana' else []


class RevisionFalsa:
    def __init__(self):
        self.recursos, self.lista_descargas = {}, []

    def recursos_de_unidad(self, docente, unidad_id):
        return [r for (d, _), r in self.recursos.items() if d == docente and r['unitId'] == unidad_id]

    def recurso_obtener(self, docente, recurso_id):
        return self.recursos.get((docente, recurso_id))

    def recursos_guardar(self, docente, unidad_id, recursos):
        for r in recursos:
            self.recursos[(docente, r['id'])] = r

    def recurso_borrar(self, docente, recurso_id):
        self.recursos.pop((docente, recurso_id), None)

    def descargas(self, docente, unidad_id):
        return [d for (dd, u, d) in self.lista_descargas if dd == docente and u == unidad_id]

    def descarga_guardar(self, docente, unidad_id, descarga):
        self.lista_descargas.append((docente, unidad_id, descarga))

    def descargas_borrar(self, docente, unidad_id):
        self.lista_descargas = [x for x in self.lista_descargas if not (x[0] == docente and x[1] == unidad_id)]


def item(rid='r1', **cambios):
    opciones = [
        {'id': f'{rid}:a', 'text': 'TCP', 'isCorrect': True, 'feedback': 'Correcto.', 'decision': 'pendiente', 'discardReason': None, 'edited': False},
        {'id': f'{rid}:b', 'text': 'UDP', 'isCorrect': False, 'feedback': 'No.', 'decision': 'pendiente', 'discardReason': None, 'edited': False},
        {'id': f'{rid}:c', 'text': 'IP', 'isCorrect': False, 'feedback': 'No.', 'decision': 'pendiente', 'discardReason': None, 'edited': False},
        {'id': f'{rid}:d', 'text': 'DNS', 'isCorrect': False, 'feedback': 'No.', 'decision': 'pendiente', 'discardReason': None, 'edited': False},
    ]
    return {'id': rid, 'unitId': 'u1', 'title': 'TCP o UDP', 'body': '¿Cuál confirma la entrega?', 'options': opciones,
            'status': 'pendiente', 'edited': False, 'discardReason': None, 'createdAt': '2026-10-10T10:00:00', 'decidedAt': None, **cambios}


def revision_con(*recursos):
    repo = RevisionFalsa()
    repo.recursos_guardar('ana', 'u1', list(recursos))
    return RevisionService(ConfigFalsa(), repo), repo


def cambios(recurso, decisiones=None, **otros):
    opciones = [{**o, 'decision': (decisiones or {}).get(o['id'][-1], o['decision'])} for o in recurso['options']] if recurso['options'] else None
    return {'title': recurso['title'], 'body': recurso['body'], 'status': 'pendiente', 'discardReason': None, 'edited': False,
            'options': opciones, **otros}


def test_listar_ordena_y_solo_unidades_propias():
    servicio, _ = revision_con(item('r1'), item('r2', createdAt='2026-10-10T11:00:00'))
    assert [r['id'] for r in servicio.listar('ana', 'u1')] == ['r2', 'r1']
    with pytest.raises(ConfiguracionError) as error:
        servicio.listar('otro', 'u1')
    assert error.value.status == 404


def test_aprobar_exige_decidir_distractores():
    recurso = item()
    servicio, repo = revision_con(recurso)
    with pytest.raises(ConfiguracionError) as error:
        servicio.actualizar('ana', 'u1', 'r1', cambios(recurso, status='aprobado'))
    assert error.value.codigo == 'APROBACION_BLOQUEADA' and 'pendiente' in error.value.mensaje
    parcial = cambios(recurso, {'b': 'aceptado', 'c': 'descartado', 'd': 'descartado'}, status='aprobado')
    with pytest.raises(ConfiguracionError) as error:
        servicio.actualizar('ana', 'u1', 'r1', parcial)
    assert 'al menos 2' in error.value.mensaje
    aprobado = servicio.actualizar('ana', 'u1', 'r1', cambios(recurso, {'a': 'aceptado', 'b': 'aceptado', 'c': 'aceptado', 'd': 'descartado'}, status='aprobado'))
    assert aprobado['status'] == 'aprobado' and aprobado['decidedAt']
    assert aprobado['options'][0]['decision'] == 'pendiente'  # la clave no se decide por separado
    assert repo.recurso_obtener('ana', 'r1')['status'] == 'aprobado'
    devuelto = servicio.actualizar('ana', 'u1', 'r1', cambios(aprobado))
    assert devuelto['status'] == 'pendiente' and devuelto['decidedAt'] is None


def test_descartar_guarda_motivo_y_edicion():
    recurso = item()
    servicio, _ = revision_con(recurso)
    editado = servicio.actualizar('ana', 'u1', 'r1', cambios(recurso, title='Nuevo título', edited=True, status='descartado', discardReason='regenerado'))
    assert editado['title'] == 'Nuevo título' and editado['edited'] and editado['discardReason'] == 'regenerado'
    sin_motivo = servicio.actualizar('ana', 'u1', 'r1', cambios(editado))
    assert sin_motivo['discardReason'] is None


@pytest.mark.parametrize('malo,codigo_esperado', [
    ({'status': 'otro'}, 'ESTADO_INVALIDO'),
    ({'discardReason': 'inventado'}, 'MOTIVO_INVALIDO'),
    ({'options': []}, 'ALTERNATIVAS_INVALIDAS'),
    ({'options': None}, 'ALTERNATIVAS_INVALIDAS'),
])
def test_actualizar_rechaza_datos_invalidos(malo, codigo_esperado):
    recurso = item()
    servicio, _ = revision_con(recurso)
    with pytest.raises(ConfiguracionError) as error:
        servicio.actualizar('ana', 'u1', 'r1', {**cambios(recurso), **malo})
    assert error.value.codigo == codigo_esperado


def test_decision_invalida_en_una_alternativa():
    recurso = item()
    servicio, _ = revision_con(recurso)
    entrada = cambios(recurso)
    entrada['options'][1] = {**entrada['options'][1], 'decision': 'quizas'}
    with pytest.raises(ConfiguracionError) as error:
        servicio.actualizar('ana', 'u1', 'r1', entrada)
    assert error.value.codigo == 'DECISION_INVALIDA'


def test_recurso_sin_alternativas_y_recurso_de_otra_unidad():
    explicacion = {**item('r9'), 'options': None}
    servicio, _ = revision_con(explicacion)
    aprobado = servicio.actualizar('ana', 'u1', 'r9', cambios(explicacion, status='aprobado'))
    assert aprobado['status'] == 'aprobado' and aprobado['options'] is None
    with pytest.raises(ConfiguracionError) as error:
        servicio.actualizar('ana', 'u2', 'r9', cambios(explicacion))
    assert error.value.codigo == 'RECURSO_NO_ENCONTRADO'
    servicio.borrar('ana', 'u1', 'r9')
    assert servicio.listar('ana', 'u1') == []


def test_bloqueos_de_aprobacion():
    assert bloqueos_aprobacion({'body': ' ', 'options': None}) == ['El contenido no puede estar vacío.']
    sin_clave = item()
    sin_clave['options'] = [{**o, 'isCorrect': False, 'decision': 'aceptado'} for o in sin_clave['options']]
    assert bloqueos_aprobacion(sin_clave) == ['El ítem necesita una clave (respuesta correcta).']


def test_historial_de_descargas():
    servicio, _ = revision_con()
    primera = servicio.registrar_descarga('ana', 'u1', {'format': 'moodle_xml', 'fileName': 'red-301-unidad-1.xml', 'resourceCount': 2})
    servicio.registrar_descarga('ana', 'u2', {'format': 'documento', 'fileName': 'otra.html', 'resourceCount': 1})
    assert [d['id'] for d in servicio.descargas('ana', 'u1')] == [primera['id']]
    with pytest.raises(ConfiguracionError) as error:
        servicio.registrar_descarga('ana', 'u1', {'format': 'pdf', 'fileName': 'x.pdf', 'resourceCount': 1})
    assert error.value.codigo == 'FORMATO_INVALIDO'
    servicio.borrar_descargas('ana', 'u1')
    assert servicio.descargas('ana', 'u1') == [] and len(servicio.descargas('ana', 'u2')) == 1


def test_sin_cuenta_inicial_solo_entran_las_cuentas_creadas():
    servicio = ConfiguracionService(ConfiguracionRepoFalso(), '', '', catalogo_demo=False)
    assert codigo(servicio.login, '', '') == ('CREDENCIALES_INVALIDAS', 401)
    assert codigo(servicio.login, INICIAL, CLAVE_INICIAL) == ('CREDENCIALES_INVALIDAS', 401)
    servicio.registrar_cuenta('Ana', 'ana@correo.pe', 'clave-segura')
    assert servicio.login('ana@correo.pe', 'clave-segura')['name'] == 'Ana'


def test_resumen_cuenta_aprobados_y_pendientes_por_unidad():
    servicio, _ = revision_con(item('r1'), item('r2', status='aprobado'), item('r3', status='descartado'))
    assert servicio.resumen('ana') == [{'courseId': 'c1', 'unitId': 'u1', 'approved': 1, 'pending': 1},
                                       {'courseId': 'c1', 'unitId': 'u2', 'approved': 0, 'pending': 0}]
    assert servicio.resumen('otro') == []
