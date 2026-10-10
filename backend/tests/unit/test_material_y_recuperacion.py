"""Reglas puras de la ingesta (fragmentar) y de la recuperación de evidencia (BM25)."""
from plataforma5e.domain.material import MaterialError, fragmentar, limpiar_texto, oraciones, parrafos
from plataforma5e.domain.recuperacion import normalizar, puntuar_bm25, raiz, recuperar, terminos, terminos_clave

TEXTO = (
    'Unidad 2: Protocolos de red\n\n'
    'El protocolo TCP es orientado a la conexión y garantiza una entrega confiable. '
    'El protocolo UDP no establece conexión y por eso es más rápido.\n\n'
    'El enrutador es el dispositivo que decide el camino de cada paquete.'
)


def test_limpiar_une_palabras_cortadas_y_espacios():
    assert limpiar_texto('comuni-\ncación   de datos\r\n\n\n\nfin') == 'comunicación de datos\n\nfin'
    assert limpiar_texto(None) == ''


def test_parrafos_separa_titulos_cortos_de_un_pdf():
    pdf = 'Unidad 2: Protocolos\nEl protocolo TCP es orientado a la conexión y garantiza una entrega con\nfiabilidad en la red.'
    assert parrafos(pdf)[0] == 'Unidad 2: Protocolos'
    assert parrafos(pdf)[1].startswith('El protocolo TCP')


def test_oraciones_respeta_titulos_y_puntos():
    lista = oraciones(TEXTO)
    assert lista[0] == 'Unidad 2: Protocolos de red'
    assert lista[1].startswith('El protocolo TCP') and lista[2].startswith('El protocolo UDP')


def test_fragmentar_conserva_ubicacion_orden_y_parrafos():
    fragmentos = fragmentar([('p. 1', TEXTO), ('p. 2', '   '), ('p. 3', 'Solo un título')])
    assert [f['ubicacion'] for f in fragmentos] == ['p. 1']
    assert fragmentos[0]['orden'] == 0
    assert '\n\n' in fragmentos[0]['texto']  # los párrafos no se pegan


def test_fragmentar_parte_textos_largos_con_solape_corto():
    oracion = 'La capa de red mueve los paquetes entre redes distintas. '
    fragmentos = fragmentar([('sección 1', oracion * 60)], palabras=50)
    assert len(fragmentos) > 5
    assert all(len(f['texto'].split()) <= 60 for f in fragmentos)
    assert fragmentos[1]['texto'].startswith('La capa de red')  # repite la última oración (solape)


def test_fragmentar_oracion_mas_larga_que_un_fragmento():
    larga = ' '.join(f'palabra{i}' for i in range(130)) + '.'
    fragmentos = fragmentar([('p. 1', larga)], palabras=50)
    assert len(fragmentos) == 3


def test_material_error_lleva_codigo_y_estado():
    error = MaterialError('X', 'mensaje', 404)
    assert (error.codigo, error.mensaje, error.status, str(error)) == ('X', 'mensaje', 404, 'mensaje')


def test_terminos_normaliza_quita_vacias_y_reduce_a_raiz():
    assert normalizar('Información') == 'informacion'
    assert raiz('protocolos') == raiz('protocolo')
    assert terminos('Los protocolos de la red') == [raiz('protocolos'), 'red']


def test_bm25_premia_coincidencias_raras():
    docs = [terminos('el protocolo TCP confiable'), terminos('el protocolo UDP rapido'), terminos('el enrutador decide')]
    puntajes = puntuar_bm25(terminos('TCP confiable'), docs)
    assert puntajes[0] > 0 and puntajes[1] == 0 and puntajes[2] == 0
    assert puntuar_bm25(['x'], []) == []


def test_recuperar_ordena_por_relevancia_y_tiene_respaldo():
    fragmentos = [{'id': 'a', 'texto': 'El enrutador decide el camino'}, {'id': 'b', 'texto': 'TCP garantiza la entrega confiable de TCP'},
                  {'id': 'c', 'texto': 'UDP es rápido'}]
    elegidos = recuperar('entrega confiable TCP', fragmentos, 2)
    assert [f['id'] for f in elegidos] == ['b']
    assert elegidos[0]['relevancia'] == 1.0
    sin_coincidencia = recuperar('astronomía', fragmentos, 2)
    assert [f['id'] for f in sin_coincidencia] == ['a', 'b'] and sin_coincidencia[0]['relevancia'] == 0.0
    assert recuperar('TCP', [], 3) == [] and recuperar('TCP', fragmentos, 0) == []


def test_terminos_clave_devuelve_formas_frecuentes():
    claves = terminos_clave(['El protocolo TCP y el protocolo UDP son protocolos de transporte.'], 3)
    assert claves[0] == 'protocolo'
