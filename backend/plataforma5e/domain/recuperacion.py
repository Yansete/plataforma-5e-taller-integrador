"""Recuperación de evidencia: busca los fragmentos del material más relacionados con la solicitud.

Usa BM25, la búsqueda por palabras clásica de los buscadores: premia los fragmentos que
contienen las palabras de la consulta, sobre todo las poco frecuentes en el material.
La búsqueda por significado con vectores (pgvector, EN-013 y HU-011) la complementará.
"""
import math
import re
import unicodedata
from collections import Counter, defaultdict

STOPWORDS = frozenset("""
a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuales
cuando de del desde donde dos e el ella ellas ellos en entre era eran es esa esas ese eso esos esta
estaba estado estan estar estas este esto estos fue fueron ha hace hacen hacer han hasta hay la las le
les lo los mas me mi mientras muy ni no nos nosotros o otra otras otro otros para pero poco por porque
puede pueden que quien se sea segun ser si sido sin sino sobre son su sus tambien tan tanto te tiene
tienen todo todos tu un una uno unos usted y ya cuyo cuya donde mediante tras durante bien solo
the of and to in is for on with as by an be this that are from or it at
""".split())

_SUFIJOS = ('aciones', 'iciones', 'ciones', 'acion', 'icion', 'cion', 'mente', 'idades', 'idad', 'es', 's')


def normalizar(texto: str) -> str:
    """Minúsculas y sin tildes, para comparar «información» con «informacion»."""
    descompuesto = unicodedata.normalize('NFD', texto.lower())
    return ''.join(c for c in descompuesto if unicodedata.category(c) != 'Mn')


def raiz(palabra: str) -> str:
    """Raíz aproximada: «protocolos» y «protocolo» cuentan como la misma palabra."""
    for sufijo in _SUFIJOS:
        if palabra.endswith(sufijo) and len(palabra) - len(sufijo) >= 3:
            return palabra[:-len(sufijo)]
    return palabra


def terminos(texto: str) -> list[str]:
    """Palabras útiles de un texto (sin vacías ni muy cortas), normalizadas y reducidas a su raíz."""
    return [raiz(p) for p in re.findall(r'[a-z0-9ñ]+', normalizar(texto)) if len(p) >= 3 and p not in STOPWORDS]


def puntuar_bm25(consulta: list[str], documentos: list[list[str]], k1: float = 1.5, b: float = 0.75) -> list[float]:
    """Puntaje BM25 de cada documento (lista de términos) frente a la consulta."""
    if not documentos:
        return []
    total = len(documentos)
    promedio = sum(len(d) for d in documentos) / total or 1.0
    frecuencia_doc = Counter(t for d in documentos for t in set(d))
    unicos = set(consulta)
    idf = {t: math.log(1 + (total - frecuencia_doc[t] + 0.5) / (frecuencia_doc[t] + 0.5)) for t in unicos}
    puntajes = []
    for documento in documentos:
        tf = Counter(documento)
        largo = len(documento) or 1
        puntajes.append(sum(
            idf[t] * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * largo / promedio))
            for t in unicos if tf[t]
        ))
    return puntajes


def recuperar(consulta: str, fragmentos: list[dict], k: int) -> list[dict]:
    """Devuelve hasta k fragmentos ordenados por relevancia, cada uno con 'relevancia' entre 0 y 1.

    Si ninguna palabra coincide, devuelve los primeros k del material: siguen siendo evidencia
    del docente, pero con relevancia 0 para que se note que la búsqueda no encontró coincidencias.
    """
    if not fragmentos or k <= 0:
        return []
    puntajes = puntuar_bm25(terminos(consulta), [terminos(f['texto']) for f in fragmentos])
    maximo = max(puntajes, default=0.0)
    if maximo <= 0:
        return [{**f, 'relevancia': 0.0} for f in fragmentos[:k]]
    ordenados = sorted((par for par in zip(puntajes, fragmentos) if par[0] > 0), key=lambda par: -par[0])[:k]
    return [{**f, 'relevancia': round(p / maximo, 3)} for p, f in ordenados]


def terminos_clave(textos: list[str], cantidad: int = 12) -> list[str]:
    """Palabras más representativas del material, en su forma original más usada."""
    conteo: Counter[str] = Counter()
    formas: dict[str, Counter[str]] = defaultdict(Counter)
    for texto in textos:
        for palabra in re.findall(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+', texto):
            normal = normalizar(palabra)
            if len(normal) < 5 or normal in STOPWORDS:
                continue
            clave = raiz(normal)
            conteo[clave] += 1
            formas[clave][palabra.lower()] += 1
    return [formas[clave].most_common(1)[0][0] for clave, _ in conteo.most_common(cantidad)]
