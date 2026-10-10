"""Servicio de ingesta con puertos falsos: procesar, ver fragmentos y crear material desde un tema."""
import pytest

from plataforma5e.application.services.material_service import MaterialService, nombre_para_articulo
from plataforma5e.domain.material import MaterialError

PAGINA = ('El protocolo TCP es orientado a la conexión y garantiza una entrega confiable de los datos. '
          'El protocolo UDP no establece conexión y es más rápido para videollamadas.')


class ConfigFalsa:
    def __init__(self):
        self.docs = {}
        self.unidad = {'id': 'u1', 'title': 'Protocolos', 'outcomes': []}

    def cursos(self, docente):
        return [{'id': 'c1', 'units': [self.unidad]}]

    def documentos(self, docente):
        return [d for d, _ in self.docs.values()]

    def documento_guardar(self, docente, datos, contenido):
        self.docs[datos['id']] = (datos, contenido)

    def documento_obtener(self, docente, id):
        return self.docs.get(id)


class MaterialFalso:
    def __init__(self, config):
        self.config = config
        self.fragmentos = {}

    def fragmentos_reemplazar(self, docente, documento_id, unidad_id, fragmentos):
        self.fragmentos[documento_id] = [{**f, 'documento_id': documento_id, 'unidad_id': unidad_id} for f in fragmentos]

    def fragmentos_de_documento(self, docente, documento_id):
        return self.fragmentos.get(documento_id, [])

    def fragmentos_de_unidad(self, docente, unidad_id):
        return [f for lista in self.fragmentos.values() for f in lista if f['unidad_id'] == unidad_id]

    def documento_actualizar(self, docente, datos):
        _, contenido = self.config.docs[datos['id']]
        self.config.docs[datos['id']] = (datos, contenido)


class ExtractorFalso:
    def __init__(self, paginas=None, error=None):
        self.paginas, self.error = paginas, error

    def extraer(self, tipo, contenido):
        if self.error:
            raise self.error
        return self.paginas


class FuenteFalsa:
    def __init__(self, articulos=None, falla=False):
        self.articulos, self.falla, self.pedidos = articulos or [], falla, []

    def buscar(self, tema, maximo):
        self.pedidos.append((tema, maximo))
        if self.falla:
            raise ConnectionError('sin red')
        return self.articulos


def preparar(paginas=None, error=None, fuente=None):
    config = ConfigFalsa()
    material = MaterialFalso(config)
    config.documento_guardar('d', {'id': 'doc1', 'unitId': 'u1', 'kind': 'txt', 'fileName': 'apuntes.txt', 'status': 'registrado'}, b'x')
    servicio = MaterialService(config, material, ExtractorFalso(paginas if paginas is not None else [('p. 1', PAGINA)], error), fuente)
    return servicio, config, material


def test_procesar_guarda_fragmentos_y_marca_procesado():
    servicio, config, material = preparar()
    datos = servicio.procesar('d', 'doc1')
    assert datos['status'] == 'procesado' and datos['fragmentCount'] == 1 and datos['pageCount'] == 1
    assert datos['processedAt'] and datos['errorMessage'] is None
    assert config.docs['doc1'][0]['status'] == 'procesado'
    assert material.fragmentos['doc1'][0]['id'].startswith('frag-')
    vista = servicio.fragmentos('d', 'doc1')
    assert vista[0]['location'] == 'p. 1' and vista[0]['text'].startswith('El protocolo TCP')


def test_procesar_sin_texto_deja_error_explicado():
    servicio, config, material = preparar(paginas=[('p. 1', ' '), ('p. 2', '')])
    datos = servicio.procesar('d', 'doc1')
    assert datos['status'] == 'error' and 'escaneado' in datos['errorMessage'] and datos['pageCount'] == 2
    assert material.fragmentos['doc1'] == []


def test_procesar_archivo_ilegible_no_lanza_y_explica():
    servicio, _, _ = preparar(error=MaterialError('PDF_PROTEGIDO', 'El PDF está protegido.'))
    datos = servicio.procesar('d', 'doc1')
    assert datos['status'] == 'error' and datos['errorMessage'] == 'El PDF está protegido.'


def test_documento_inexistente_devuelve_404():
    servicio, _, _ = preparar()
    with pytest.raises(MaterialError) as error:
        servicio.procesar('d', 'no-existe')
    assert error.value.status == 404
    with pytest.raises(MaterialError):
        servicio.fragmentos('d', 'no-existe')


def test_desde_tema_crea_documentos_procesados_y_no_duplica():
    articulo = {'titulo': 'Protocolo de control de transmisión', 'url': 'https://es.wikipedia.org/wiki/TCP', 'texto': PAGINA,
                'licencia': 'CC BY-SA 4.0', 'fuente': 'Wikipedia'}
    fuente = FuenteFalsa([articulo])
    servicio, config, _ = preparar(fuente=fuente)
    creados = servicio.desde_tema('d', 'u1', '  protocolo   TCP ', 9)
    assert fuente.pedidos == [('protocolo TCP', 5)]
    assert len(creados) == 1 and creados[0]['status'] == 'procesado'
    assert creados[0]['origin']['url'] == articulo['url'] and creados[0]['documentType'] == 'Artículo de fuente abierta'
    guardado = config.docs[creados[0]['id']][1].decode()
    assert guardado.startswith('Protocolo de control de transmisión\nFuente: https://es.wikipedia.org/wiki/TCP')
    otra_vez = servicio.desde_tema('d', 'u1', 'protocolo TCP')
    assert otra_vez[0]['id'] == creados[0]['id']  # el mismo artículo no se guarda dos veces


@pytest.mark.parametrize('tema,unidad,fuente,codigo', [
    ('ab', 'u1', FuenteFalsa(), 'TEMA_INVALIDO'),
    ('redes', 'otra', FuenteFalsa(), 'UNIDAD_NO_ENCONTRADA'),
    ('redes', 'u1', None, 'BUSQUEDA_NO_DISPONIBLE'),
    ('redes', 'u1', FuenteFalsa(falla=True), 'FUENTE_NO_DISPONIBLE'),
    ('redes', 'u1', FuenteFalsa([]), 'SIN_RESULTADOS'),
])
def test_desde_tema_rechazos(tema, unidad, fuente, codigo):
    servicio, _, _ = preparar(fuente=fuente)
    with pytest.raises(MaterialError) as error:
        servicio.desde_tema('d', unidad, tema)
    assert error.value.codigo == codigo


def test_desde_tema_propaga_errores_propios_de_la_fuente():
    class FuenteConError(FuenteFalsa):
        def buscar(self, tema, maximo):
            raise MaterialError('CUOTA', 'Límite de la fuente.', 429)
    servicio, _, _ = preparar(fuente=FuenteConError())
    with pytest.raises(MaterialError) as error:
        servicio.desde_tema('d', 'u1', 'redes')
    assert error.value.codigo == 'CUOTA'


def test_nombre_para_articulo_es_seguro():
    assert nombre_para_articulo('TCP/IP \\ redes', 'Wikipedia') == 'TCP IP   redes (Wikipedia).txt'
    assert nombre_para_articulo('', 'Wikipedia') == 'Artículo (Wikipedia).txt'
