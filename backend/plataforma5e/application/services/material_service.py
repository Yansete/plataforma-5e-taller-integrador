"""Ingesta del material del docente (EN-007 y EN-012): extrae el texto, lo parte en
fragmentos y los guarda. También crea material a partir de un tema buscando en una
fuente abierta, para el docente que todavía no tiene un documento propio.
"""
import re
from datetime import datetime, timezone
from uuid import uuid4

from plataforma5e.application.ports.configuracion_repository import ConfiguracionRepositoryPort
from plataforma5e.application.ports.material import ExtractorTextoPort, FuenteAbiertaPort, MaterialRepositoryPort
from plataforma5e.domain.material import MaterialError, fragmentar

TIPO_FUENTE_ABIERTA = 'Artículo de fuente abierta'
SIN_TEXTO = ('No se encontró texto en el archivo. Si es un PDF escaneado (solo imágenes), '
             'súbelo como PDF con texto seleccionable o copia el contenido en un TXT.')


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


def nombre_para_articulo(titulo: str, fuente: str) -> str:
    limpio = re.sub(r'[\\/\x00-\x1f]', ' ', titulo).strip()[:140] or 'Artículo'
    return f'{limpio} ({fuente}).txt'


class MaterialService:
    def __init__(self, configuracion: ConfiguracionRepositoryPort, material: MaterialRepositoryPort,
                 extractor: ExtractorTextoPort, fuente: FuenteAbiertaPort | None = None):
        self._config = configuracion
        self._material = material
        self._extractor = extractor
        self._fuente = fuente

    def _documento(self, docente: str, documento_id: str) -> tuple[dict, bytes]:
        encontrado = self._config.documento_obtener(docente, documento_id)
        if encontrado is None:
            raise MaterialError('DOCUMENTO_NO_ENCONTRADO', 'El documento no existe.', 404)
        return encontrado

    def _unidad(self, docente: str, unidad_id: str) -> dict:
        unidad = next((u for c in self._config.cursos(docente) for u in c['units'] if u['id'] == unidad_id), None)
        if unidad is None:
            raise MaterialError('UNIDAD_NO_ENCONTRADA', 'La unidad no pertenece a tus cursos.', 404)
        return unidad

    def procesar(self, docente: str, documento_id: str) -> dict:
        """Extrae el texto, lo fragmenta y deja el documento «procesado» (o «error» con el motivo)."""
        datos, contenido = self._documento(docente, documento_id)
        try:
            paginas = self._extractor.extraer(datos['kind'], contenido)
        except MaterialError as exc:
            return self._marcar_error(docente, datos, exc.mensaje)
        fragmentos = fragmentar(paginas)
        if not fragmentos:
            return self._marcar_error(docente, datos, SIN_TEXTO, len(paginas) or None)
        self._material.fragmentos_reemplazar(
            docente, documento_id, datos['unitId'],
            [{**f, 'id': f'frag-{uuid4().hex[:16]}'} for f in fragmentos],
        )
        actualizado = {**datos, 'status': 'procesado', 'currentStep': None, 'processedAt': _ahora(),
                       'fragmentCount': len(fragmentos), 'pageCount': len(paginas), 'errorMessage': None}
        self._material.documento_actualizar(docente, actualizado)
        return actualizado

    def _marcar_error(self, docente: str, datos: dict, mensaje: str, paginas: int | None = None) -> dict:
        self._material.fragmentos_reemplazar(docente, datos['id'], datos['unitId'], [])
        actualizado = {**datos, 'status': 'error', 'currentStep': None, 'processedAt': None,
                       'fragmentCount': 0, 'pageCount': paginas, 'errorMessage': mensaje}
        self._material.documento_actualizar(docente, actualizado)
        return actualizado

    def fragmentos(self, docente: str, documento_id: str) -> list[dict]:
        self._documento(docente, documento_id)
        return [{'id': f['id'], 'orden': f['orden'], 'location': f['ubicacion'], 'text': f['texto']}
                for f in self._material.fragmentos_de_documento(docente, documento_id)]

    def desde_tema(self, docente: str, unidad_id: str, tema: str, maximo: int = 3) -> list[dict]:
        """Busca el tema en la fuente abierta, guarda cada artículo como documento TXT y lo procesa."""
        tema = ' '.join((tema or '').split())
        if not 3 <= len(tema) <= 120:
            raise MaterialError('TEMA_INVALIDO', 'Escribe un tema de 3 a 120 caracteres.')
        unidad = self._unidad(docente, unidad_id)
        if self._fuente is None:
            raise MaterialError('BUSQUEDA_NO_DISPONIBLE', 'La búsqueda por tema no está activada en el servidor.', 503)
        try:
            articulos = self._fuente.buscar(tema, max(1, min(maximo, 5)))
        except MaterialError:
            raise
        except Exception as exc:
            raise MaterialError('FUENTE_NO_DISPONIBLE', 'No se pudo consultar la fuente abierta. Revisa la conexión del servidor y vuelve a intentar.', 503) from exc
        if not articulos:
            raise MaterialError('SIN_RESULTADOS', f'No se encontraron artículos sobre «{tema}». Prueba con otras palabras.', 404)
        existentes = {d['fileName'].casefold(): d for d in self._config.documentos(docente) if d['unitId'] == unidad['id']}
        resultado = []
        for articulo in articulos:
            nombre = nombre_para_articulo(articulo['titulo'], articulo.get('fuente', 'fuente abierta'))
            if nombre.casefold() in existentes:
                resultado.append(existentes[nombre.casefold()])
                continue
            encabezado = f"{articulo['titulo']}\nFuente: {articulo['url']}\nLicencia: {articulo['licencia']}\n\n"
            contenido = (encabezado + articulo['texto']).encode('utf-8')
            datos = {
                'unitId': unidad['id'], 'outcomeIds': [], 'documentType': TIPO_FUENTE_ABIERTA, 'suggestedStage': None,
                'usePermission': True, 'id': f'doc-api-{uuid4()}', 'fileName': nombre, 'kind': 'txt',
                'sizeBytes': len(contenido), 'status': 'registrado', 'currentStep': None, 'registeredAt': _ahora(),
                'processedAt': None, 'fragmentCount': 0, 'pageCount': None, 'errorMessage': None, 'isDemo': False,
                'source': 'backend',
                'origin': {'fuente': articulo.get('fuente', ''), 'url': articulo['url'], 'licencia': articulo['licencia'], 'tema': tema},
            }
            self._config.documento_guardar(docente, datos, contenido)
            resultado.append(self.procesar(docente, datos['id']))
        return resultado
