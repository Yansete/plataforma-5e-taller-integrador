"""Generador por reglas (sin IA): arma recursos directamente con oraciones y términos del material.

Sirve cuando no hay clave de IA o el proveedor no responde. No inventa nada: cada recurso
reutiliza oraciones del material y las cita. La calidad es menor que con un modelo de
lenguaje, por eso la pantalla de revisión indica qué generador se usó.
"""
import re
from collections import Counter

from plataforma5e.domain.material import oraciones
from plataforma5e.domain.recuperacion import STOPWORDS, normalizar, raiz, terminos_clave

_RUIDO = re.compile(r'https?://|^(Fuente|Licencia):', re.IGNORECASE)
_PALABRA = r'[\wáéíóúñÁÉÍÓÚÑ/-]+'
# «El protocolo TCP es…», «…, el enrutador se encarga…»: el sujeto de una definición es un buen término clave.
_SUJETO = re.compile(
    rf'(?:^|[,;:]\s+)(?:[Ee]l|[Ll]a|[Ll]os|[Ll]as|[Uu]n|[Uu]na)\s+((?:{_PALABRA}\s+){{0,2}}?{_PALABRA})\s+'
    r'(?:no\s+|también\s+|solo\s+)?(?:es|son|fue|se\s+encarga|se\s+usa|se\s+utiliza|se\s+define|trabaja|trabajan|'
    r'permite|permiten|consiste|establece|garantiza|divide|tiene|tienen|ofrece|decide|traduce|agrega)\b')
_SIGLA = re.compile(r'(?<![\w/])([A-Z]{2,6}(?:/[A-Z]{2,6})?)(?![\w/])')
_ROMANOS = {'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII'}


def _terminos(frases: list[tuple[str, str]], respaldo: list[str]) -> list[str]:
    """Términos clave: primero los sujetos de definiciones, luego las siglas y al final las palabras frecuentes."""
    sujetos = []
    for _, oracion in frases:
        for m in _SUJETO.finditer(oracion):
            palabras = m.group(1).split()
            while palabras and normalizar(palabras[-1]) in STOPWORDS:
                palabras.pop()
            if palabras and normalizar(palabras[0]) not in STOPWORDS:
                sujetos.append(' '.join(palabras))
    siglas = Counter(m for _, o in frases for m in _SIGLA.findall(o) if m not in _ROMANOS)
    vistos, resultado = set(), []
    for termino in [*sujetos, *(s for s, _ in siglas.most_common()), *respaldo]:
        clave = normalizar(termino)
        if clave not in vistos and len(clave) >= 2:
            vistos.add(clave)
            resultado.append(termino)
    return resultado


def _relacionados(clave: str, termino: str) -> bool:
    """True si un término contiene al otro o si es una sola palabra con la misma raíz («redes» y «red de…»)."""
    a, b = normalizar(clave), normalizar(termino)
    if a in b or b in a:
        return True
    if ' ' not in a or ' ' not in b:
        return raiz(a.split()[0]) == raiz(b.split()[0])
    return False


def _misma_cabeza(a: str, b: str) -> bool:
    return normalizar(a.split()[0]) == normalizar(b.split()[0])


def _contiene(oracion: str, termino: str) -> bool:
    return re.search(rf'(?<!\w){re.escape(termino)}(?!\w)', oracion, re.IGNORECASE) is not None


def _ocultar(oracion: str, termino: str) -> str:
    return re.sub(rf'(?<!\w){re.escape(termino)}(?!\w)', '________', oracion, count=1, flags=re.IGNORECASE)


def _mayuscula(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


class GeneradorReglas:
    descripcion = 'Generador por reglas (sin IA)'
    usa_ia = False

    def generar(self, contexto: dict) -> dict:
        frases, vistas = [], set()
        for f in contexto['fragmentos']:
            for o in oraciones(f['texto']):
                clave = normalizar(o)
                if (8 <= len(o.split()) <= 45 and not _RUIDO.search(o) and re.search(r'[.!?…»”")]$', o)
                        and clave not in vistas):
                    vistas.add(clave)
                    frases.append((f['etiqueta'], o))
        frecuentes = [t for t in terminos_clave([f['texto'] for f in contexto['fragmentos']], 24)
                      if normalizar(t) not in {'fuente', 'licencia', 'wikipedia'}]
        claves = _terminos(frases, frecuentes)
        s = contexto['solicitud']
        constructor = getattr(self, f"_{s['tipo']}")
        recursos = []
        for i in range(s['cantidad']):
            recurso = constructor(i, frases, claves, contexto)
            if recurso and all(recurso['contenido'] != r['contenido'] for r in recursos):
                recursos.append(recurso)
        return {'recursos': recursos}

    # Cada constructor recibe el número de recurso (i) para no repetir las mismas oraciones.

    @staticmethod
    def _con_termino(frases, claves, i):
        pares = [(e, o, t) for t in claves for e, o in frases if _contiene(o, t)]
        return pares[i * 3 % len(pares)] if pares else None

    def _item_opcion_multiple(self, i, frases, claves, contexto):
        n = contexto['solicitud']['alternativas']
        pares = [(e, o, t) for t in claves for e, o in frases if _contiene(o, t)]
        for desplazamiento in range(len(pares)):
            etiqueta, oracion, clave = pares[(i * 3 + desplazamiento) % len(pares)]
            candidatos = [t for t in claves if not _relacionados(clave, t) and not _contiene(oracion, t)]
            # Primero los del mismo tipo («protocolo TCP» → «protocolo UDP»): son los distractores más plausibles.
            cabeza = normalizar(clave.split()[0])
            candidatos.sort(key=lambda t: normalizar(t.split()[0]) != cabeza)
            distractores = []
            for t in candidatos:
                if not any(_relacionados(t, d) for d in distractores):
                    distractores.append(t)
            distractores = distractores[:n - 1]
            if len(distractores) < n - 1:
                continue
            origen = {t: next((e for e, o in frases if _contiene(o, t)), etiqueta) for t in distractores}
            alternativas = [{'texto': clave, 'correcta': True, 'fragmentos': [etiqueta],
                             'retroalimentacion': f'Correcto. El material lo afirma así: «{oracion}»'}]
            alternativas += [{'texto': t, 'correcta': False, 'fragmentos': [origen[t]],
                              'retroalimentacion': f'Incorrecto. «{t}» aparece en el material, pero con otro sentido. La afirmación original es: «{oracion}»'}
                             for t in distractores]
            return {
                'titulo': f"Concepto clave {i + 1}: {contexto['unidad']['titulo']}",
                'contenido': f'Según el material de la unidad, ¿qué término completa correctamente la siguiente afirmación?\n\n«{_ocultar(oracion, clave)}»',
                'citas': [{'afirmacion': oracion, 'fragmentos': [etiqueta]}],
                'alternativas': alternativas,
            }
        return None

    def _pregunta_detonante(self, i, frases, claves, contexto):
        par = self._con_termino(frases, claves, i)
        if not par:
            return None
        etiqueta, oracion, termino = par
        return {
            'titulo': f'¿Qué sabes sobre {termino}?',
            'contenido': (f'Situación para iniciar la clase:\n«{oracion}»\n\n'
                          f'Pregunta detonante: ¿Dónde has visto {termino} en tu vida diaria y qué pasaría si no existiera? '
                          'Comparte una respuesta breve antes de revisar el tema.'),
            'citas': [{'afirmacion': oracion, 'fragmentos': [etiqueta]}],
            'alternativas': [],
        }

    def _sondeo_diagnostico(self, i, frases, claves, contexto):
        elegidas = frases[i * 4:i * 4 + 4] or frases[:4]
        if len(elegidas) < 2:
            return None
        lineas, claves_resp, citas = [], [], []
        for n, (etiqueta, oracion) in enumerate(elegidas, start=1):
            # Una afirmación falsa cambia un término por otro del mismo tipo («TCP» por «UDP»), así se mantiene la gramática.
            cambio = next(((p, q) for p in claves if _contiene(oracion, p) for q in claves
                           if q != p and _misma_cabeza(p, q) and not _relacionados(p, q) and not _contiene(oracion, q)), None)
            if n % 2 == 0 and cambio:
                falsa = re.sub(rf'(?<!\w){re.escape(cambio[0])}(?!\w)', cambio[1], oracion, count=1, flags=re.IGNORECASE)
                lineas.append(f'{n}. {falsa} (V / F)')
                claves_resp.append(f'{n}. Falso: el material dice «{oracion}»')
            else:
                lineas.append(f'{n}. {oracion} (V / F)')
                claves_resp.append(f'{n}. Verdadero')
            citas.append({'afirmacion': oracion, 'fragmentos': [etiqueta]})
        contenido = ('Marca verdadero (V) o falso (F) antes de empezar el tema:\n' + '\n'.join(lineas)
                     + '\n\nClave para el docente:\n' + '\n'.join(claves_resp))
        return {'titulo': f"Sondeo de ideas previas: {contexto['unidad']['titulo']}", 'contenido': contenido,
                'citas': citas, 'alternativas': []}

    def _guia_exploracion(self, i, frases, claves, contexto):
        if len(frases) < 2 or len(claves) < 2:
            return None
        (e1, o1), (e2, o2) = frases[(i * 2) % len(frases)], frases[(i * 2 + 1) % len(frases)]
        t1, t2 = claves[i % len(claves)], claves[(i + 1) % len(claves)]
        contenido = (f'Objetivo: explorar {t1} y su relación con {t2}.\n\nPasos:\n'
                     f'1. Lee este fragmento del material: «{o1}»\n'
                     f'2. Subraya las palabras clave y escribe con tus palabras qué es {t1}.\n'
                     f'3. Lee este otro fragmento: «{o2}»\n'
                     f'4. Compara ambos fragmentos: ¿qué tienen en común {t1} y {t2}? Anótalo en una tabla.\n'
                     '5. Escribe una pregunta que te gustaría investigar sobre el tema.\n\n'
                     'Registro: anota tus observaciones y compártelas con tu grupo.')
        return {'titulo': f'Guía de exploración: {t1}', 'contenido': contenido,
                'citas': [{'afirmacion': o1, 'fragmentos': [e1]}, {'afirmacion': o2, 'fragmentos': [e2]}], 'alternativas': []}

    def _caso_indagacion(self, i, frases, claves, contexto):
        if len(frases) < 2 or not claves:
            return None
        (e1, o1), (e2, o2) = frases[(i * 2) % len(frases)], frases[(i * 2 + 1) % len(frases)]
        t1 = claves[i % len(claves)]
        t2 = claves[(i + 1) % len(claves)] if len(claves) > 1 else t1
        contenido = (f'Caso: {o1} {o2}\n\nPreguntas de indagación:\n'
                     f'1. ¿Qué papel cumple {t1} en este caso?\n'
                     f'2. ¿Qué pasaría si cambiara {t2}?\n'
                     '3. ¿Qué evidencia del material respalda tu respuesta?\n'
                     '4. ¿En qué otra situación de tu entorno ocurre algo parecido?')
        return {'titulo': f'Caso para indagar: {t1}', 'contenido': contenido,
                'citas': [{'afirmacion': o1, 'fragmentos': [e1]}, {'afirmacion': o2, 'fragmentos': [e2]}], 'alternativas': []}

    def _explicacion(self, i, frases, claves, contexto):
        orden = {par: n for n, par in enumerate(frases)}
        puntuadas = sorted(frases, key=lambda par: -sum(_contiene(par[1], t) for t in claves[:10]))
        elegidas = sorted(puntuadas[i * 4:i * 4 + 4] or puntuadas[:4], key=orden.get)  # en el orden del material
        if not elegidas:
            return None
        tema = claves[0] if claves else contexto['unidad']['titulo']
        return {'titulo': f'{_mayuscula(tema)}: explicación del material',
                'contenido': '\n\n'.join(o for _, o in elegidas),
                'citas': [{'afirmacion': o, 'fragmentos': [e]} for e, o in elegidas], 'alternativas': []}

    def _glosario(self, i, frases, claves, contexto):
        entradas, citas = [], []
        for termino in claves[i * 8:]:
            definicion = next(((e, o) for e, o in frases if _contiene(o, termino)
                               and re.search(r'\b(es|son|se define|consiste|significa|permite)\b', o, re.IGNORECASE)), None) \
                or next(((e, o) for e, o in frases if _contiene(o, termino)), None)
            if definicion:
                entradas.append(f'{_mayuscula(termino)}: {definicion[1]}')
                citas.append({'afirmacion': definicion[1], 'fragmentos': [definicion[0]]})
            if len(entradas) == 8:
                break
        if len(entradas) < 3:
            return None
        return {'titulo': f"Glosario: {contexto['unidad']['titulo']}", 'contenido': '\n'.join(entradas),
                'citas': citas, 'alternativas': []}

    def _ejercicio_aplicacion(self, i, frases, claves, contexto):
        par = self._con_termino(frases, claves, i)
        if not par:
            return None
        etiqueta, oracion, termino = par
        contenido = (f'Idea del material: «{oracion}»\n\n'
                     f'Consigna: aplica {termino} a una situación nueva de tu entorno (tu institución, tu comunidad o una empresa). '
                     'Describe la situación, explica paso a paso cómo intervendría y qué resultado esperas.\n\n'
                     f'Criterios de logro:\n- Usa correctamente el concepto de {termino}.\n'
                     '- Justifica cada paso con ideas del material.\n- Presenta una conclusión clara.')
        return {'titulo': f'Ejercicio de aplicación: {termino}', 'contenido': contenido,
                'citas': [{'afirmacion': oracion, 'fragmentos': [etiqueta]}], 'alternativas': []}
