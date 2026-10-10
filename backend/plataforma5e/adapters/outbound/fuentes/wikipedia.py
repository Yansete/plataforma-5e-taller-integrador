"""Búsqueda de material por tema en Wikipedia en español (texto libre, licencia CC BY-SA 4.0)."""
import re
from urllib.parse import quote

import httpx

AGENTE = 'Plataforma5E/1.0 (proyecto academico Taller Integrador UPAO)'
_SECCIONES_FINALES = re.compile(r'^\s*={2,}\s*(Véase también|Referencias|Notas|Bibliografía|Enlaces externos|Fuentes)\s*={2,}\s*$',
                                re.MULTILINE | re.IGNORECASE)
MAX_CARACTERES = 60000


class FuenteWikipedia:
    def __init__(self, idioma: str = 'es', cliente: httpx.Client | None = None, tiempo_max: float = 20.0):
        self._idioma = idioma
        self._api = f'https://{idioma}.wikipedia.org/w/api.php'
        self._cliente = cliente or httpx.Client(headers={'User-Agent': AGENTE}, timeout=tiempo_max, follow_redirects=True)

    def _consultar(self, **parametros) -> dict:
        respuesta = self._cliente.get(self._api, params={'format': 'json', 'formatversion': 2, **parametros})
        respuesta.raise_for_status()
        return respuesta.json()

    def buscar(self, tema: str, maximo: int) -> list[dict]:
        resultados = self._consultar(action='query', list='search', srsearch=tema, srlimit=maximo, srnamespace=0)
        articulos = []
        for item in resultados.get('query', {}).get('search', []):
            datos = self._consultar(action='query', prop='extracts|info', inprop='url', explaintext=1,
                                    exsectionformat='wiki', redirects=1, titles=item['title'])
            paginas = datos.get('query', {}).get('pages', [])
            if not paginas or paginas[0].get('missing'):
                continue
            pagina = paginas[0]
            texto = pagina.get('extract') or ''
            final = _SECCIONES_FINALES.search(texto)
            texto = (texto[:final.start()] if final else texto).strip()[:MAX_CARACTERES]
            if len(texto) < 300:  # desambiguaciones o esbozos sin contenido útil
                continue
            titulo = pagina.get('title', item['title'])
            url = pagina.get('fullurl') or f"https://{self._idioma}.wikipedia.org/wiki/{quote(titulo.replace(' ', '_'))}"
            articulos.append({'titulo': titulo, 'url': url, 'texto': texto, 'licencia': 'CC BY-SA 4.0', 'fuente': 'Wikipedia'})
        return articulos
