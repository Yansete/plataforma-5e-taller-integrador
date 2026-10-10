"""Material del docente: limpieza del texto y fragmentación (primer paso del RAG).

Reglas puras, sin dependencias externas. Un fragmento es un trozo corto del material
(unas 220 palabras) que conserva su ubicación (página, diapositiva o sección) para que
cada recurso generado pueda citar de dónde sale cada afirmación.
"""
import re
import unicodedata

PALABRAS_POR_FRAGMENTO = 220  # ~300 tokens: cabe en los modelos de embeddings de SP-001 (máx. 512).
SOLAPE_MAXIMO = 40            # la última oración se repite al inicio del siguiente fragmento si es corta.
MAX_FRAGMENTOS = 3000         # tope por documento (un libro de ~400 páginas da unos 800).

_CONTROL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
_FIN_DE_ORACION = re.compile(r'(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9«"“(])')


class MaterialError(Exception):
    """Error de negocio de la ingesta. Lleva código, mensaje para el docente y estado HTTP."""

    def __init__(self, codigo: str, mensaje: str, status: int = 400):
        self.codigo, self.mensaje, self.status = codigo, mensaje, status
        super().__init__(mensaje)


def limpiar_texto(texto: str | None) -> str:
    """Normaliza espacios y saltos de línea, y une las palabras cortadas con guion al final de línea."""
    texto = unicodedata.normalize('NFC', texto or '')
    texto = _CONTROL.sub(' ', texto).replace('\r\n', '\n').replace('\r', '\n')
    texto = re.sub(r'(\w)-\n(\w)', r'\1\2', texto)
    texto = re.sub(r'[ \t ]+', ' ', texto)
    texto = re.sub(r' *\n *', '\n', texto)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    return texto.strip()


def parrafos(texto: str) -> list[str]:
    """Párrafos del texto. Une las líneas cortadas por el ancho de página (típico del PDF), pero
    separa los títulos: una línea corta, sin punto final, seguida de otra que empieza con mayúscula."""
    resultado = []
    for bloque in re.split(r'\n\s*\n', limpiar_texto(texto)):
        lineas = [linea.strip() for linea in bloque.split('\n') if linea.strip()]
        if not lineas:
            continue
        ancho = max(len(linea) for linea in lineas)
        actual = []
        for i, linea in enumerate(lineas):
            actual.append(linea)
            siguiente = lineas[i + 1] if i + 1 < len(lineas) else ''
            es_titulo = (len(lineas) > 1 and len(linea) < 0.6 * ancho and not re.search(r'[.!?…:;,]$', linea)
                         and re.match(r'[A-ZÁÉÍÓÚÑ¿¡0-9«"“(]', siguiente or 'a') is not None)
            if es_titulo:
                resultado.append(' '.join(actual))
                actual = []
        if actual:
            resultado.append(' '.join(actual))
    return resultado


def oraciones(texto: str) -> list[str]:
    """Divide un texto en oraciones, respetando párrafos y títulos."""
    return [o.strip() for p in parrafos(texto) for o in _FIN_DE_ORACION.split(p) if o.strip()]


def _trozos_de_oracion(oracion: str, palabras: int) -> list[str]:
    """Una oración más larga que un fragmento se parte por palabras."""
    lista = oracion.split()
    return [' '.join(lista[i:i + palabras]) for i in range(0, len(lista), palabras)]


def fragmentar(paginas: list[tuple[str, str]], palabras: int = PALABRAS_POR_FRAGMENTO,
               solape: int = SOLAPE_MAXIMO) -> list[dict]:
    """Convierte las páginas del material en fragmentos de hasta `palabras` palabras.

    `paginas` es una lista de (ubicación, texto); por ejemplo ('p. 3', '...').
    Los fragmentos no cruzan páginas, así la cita apunta a una ubicación exacta.
    Devuelve [{'orden', 'ubicacion', 'texto'}] en el orden del documento.
    """
    fragmentos: list[dict] = []
    for ubicacion, texto in paginas:
        # (parte, n.º de párrafo): al unir, los párrafos distintos se separan con una línea en blanco.
        partes = [(t, n) for n, p in enumerate(parrafos(texto))
                  for o in _FIN_DE_ORACION.split(p) if o.strip() for t in _trozos_de_oracion(o.strip(), palabras)]
        if sum(len(t.split()) for t, _ in partes) < 5:
            continue  # páginas vacías o con solo un número o un título suelto
        actual: list[tuple[str, int]] = []
        nuevas = 0
        for parte in partes:
            largo = len(parte[0].split())
            if actual and sum(len(t.split()) for t, _ in actual) + largo > palabras:
                fragmentos.append({'ubicacion': ubicacion, 'texto': _unir(actual)})
                ultima = actual[-1]
                actual = [ultima] if len(ultima[0].split()) <= solape else []
                nuevas = 0
            actual.append(parte)
            nuevas += 1
        if actual and nuevas:
            fragmentos.append({'ubicacion': ubicacion, 'texto': _unir(actual)})
    return [{'orden': i, **f} for i, f in enumerate(fragmentos[:MAX_FRAGMENTOS])]


def _unir(partes: list[tuple[str, int]]) -> str:
    texto = ''
    for i, (parte, parrafo) in enumerate(partes):
        if i:
            texto += '\n\n' if parrafo != partes[i - 1][1] else ' '
        texto += parte
    return texto
