"""Generador con un modelo de lenguaje por HTTP (HU-018). Proveedores: gemini, anthropic y openai.

«openai» también sirve para cualquier servicio compatible con su API (por ejemplo Groq u
OpenRouter) cambiando IA_URL_BASE. Las instrucciones y la validación viven en
application/services/redaccion.py, así que son iguales con cualquier proveedor.
"""
import httpx

from plataforma5e.application.services.redaccion import construir_instrucciones, extraer_json

MODELOS_POR_DEFECTO = {'gemini': 'gemini-3.8-flash', 'anthropic': 'claude-sonnet-5-5', 'openai': 'gpt-5.4-mini'}
NOMBRES = {'gemini': 'Gemini', 'anthropic': 'Anthropic', 'openai': 'OpenAI'}
URL_POR_DEFECTO = {
    'gemini': 'https://generativelanguage.googleapis.com/v1beta',
    'anthropic': 'https://api.anthropic.com',
    'openai': 'https://api.openai.com/v1',
}
REINTENTO = '\n\nTu respuesta anterior no era JSON válido. Responde solo con el objeto JSON pedido.'


class ErrorProveedorIA(Exception):
    pass


class GeneradorLLM:
    usa_ia = True

    def __init__(self, proveedor: str, clave: str, modelo: str | None = None, url_base: str | None = None,
                 tiempo_max: float = 90.0, cliente: httpx.Client | None = None):
        if proveedor not in MODELOS_POR_DEFECTO:
            raise ValueError(f'Proveedor de IA desconocido: {proveedor}. Usa gemini, anthropic u openai.')
        self.proveedor = proveedor
        self.modelo = modelo or MODELOS_POR_DEFECTO[proveedor]
        self._clave = clave
        self._url = (url_base or URL_POR_DEFECTO[proveedor]).rstrip('/')
        self._cliente = cliente or httpx.Client(timeout=tiempo_max)
        self.descripcion = f'{NOMBRES[proveedor]} · {self.modelo}'

    def generar(self, contexto: dict) -> dict:
        sistema, usuario = construir_instrucciones(contexto)
        try:
            datos = extraer_json(self._completar(sistema, usuario))
        except ValueError:
            datos = extraer_json(self._completar(sistema, usuario + REINTENTO))
        return datos if isinstance(datos, dict) else {'recursos': datos}

    def _completar(self, sistema: str, usuario: str) -> str:
        if self.proveedor == 'gemini':
            datos = self._enviar(
                f'{self._url}/models/{self.modelo}:generateContent',
                {'x-goog-api-key': self._clave},
                {'systemInstruction': {'parts': [{'text': sistema}]},
                 'contents': [{'role': 'user', 'parts': [{'text': usuario}]}],
                 'generationConfig': {'responseMimeType': 'application/json'}},
            )
            candidatos = datos.get('candidates') or []
            if not candidatos:
                motivo = (datos.get('promptFeedback') or {}).get('blockReason', 'sin candidatos')
                raise ErrorProveedorIA(f'Gemini no devolvió texto ({motivo}).')
            partes = (candidatos[0].get('content') or {}).get('parts') or []
            return ''.join(p.get('text', '') for p in partes if not p.get('thought'))
        if self.proveedor == 'anthropic':
            datos = self._enviar(
                f'{self._url}/v1/messages',
                {'x-api-key': self._clave, 'anthropic-version': '2023-06-01'},
                {'model': self.modelo, 'max_tokens': 8000, 'system': sistema,
                 'messages': [{'role': 'user', 'content': usuario}]},
            )
            return ''.join(b.get('text', '') for b in datos.get('content', []) if b.get('type') == 'text')
        datos = self._enviar(
            f'{self._url}/chat/completions',
            {'Authorization': f'Bearer {self._clave}'},
            {'model': self.modelo, 'response_format': {'type': 'json_object'},
             'messages': [{'role': 'system', 'content': sistema}, {'role': 'user', 'content': usuario}]},
        )
        return datos['choices'][0]['message']['content'] or ''

    def _enviar(self, url: str, cabeceras: dict, cuerpo: dict) -> dict:
        try:
            respuesta = self._cliente.post(url, headers={'Content-Type': 'application/json', **cabeceras}, json=cuerpo)
        except httpx.HTTPError as exc:
            raise ErrorProveedorIA(f'sin conexión con {NOMBRES[self.proveedor]}: {exc.__class__.__name__}') from exc
        if respuesta.status_code >= 400:
            try:
                detalle = respuesta.json().get('error', {})
                mensaje = detalle.get('message', '') if isinstance(detalle, dict) else str(detalle)
            except ValueError:
                mensaje = respuesta.text[:200]
            if respuesta.status_code == 429:
                raise ErrorProveedorIA(f'límite de uso de {NOMBRES[self.proveedor]} alcanzado (429). Espera un minuto.')
            raise ErrorProveedorIA(f'{NOMBRES[self.proveedor]} respondió {respuesta.status_code}: {mensaje[:200]}')
        return respuesta.json()
