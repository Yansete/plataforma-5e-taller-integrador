"""Elige el generador según las variables de entorno.

IA_PROVEEDOR  gemini | anthropic | openai | reglas (por defecto: gemini si hay clave, si no reglas)
IA_API_KEY    clave del proveedor (nunca se sube al repositorio)
IA_MODELO     opcional; por defecto gemini-3.8-flash, claude-sonnet-5-5 o gpt-5.4-mini
IA_URL_BASE   opcional; para servicios compatibles con la API de OpenAI
IA_TIEMPO_MAX segundos de espera por respuesta (por defecto 90)
"""
import os

from plataforma5e.adapters.outbound.ia.generador_llm import GeneradorLLM
from plataforma5e.adapters.outbound.ia.generador_reglas import GeneradorReglas


def crear_generadores(entorno: dict | None = None):
    """Devuelve (principal, respaldo). Sin clave, el principal es el generador por reglas."""
    entorno = os.environ if entorno is None else entorno
    reglas = GeneradorReglas()
    clave = (entorno.get('IA_API_KEY') or '').strip()
    proveedor = (entorno.get('IA_PROVEEDOR') or ('gemini' if clave else 'reglas')).strip().lower()
    if proveedor == 'reglas' or not clave:
        return reglas, reglas
    principal = GeneradorLLM(
        proveedor, clave, modelo=(entorno.get('IA_MODELO') or '').strip() or None,
        url_base=(entorno.get('IA_URL_BASE') or '').strip() or None,
        tiempo_max=float(entorno.get('IA_TIEMPO_MAX') or 90),
    )
    return principal, reglas


def describir(principal) -> dict:
    return {'descripcion': principal.descripcion, 'usaIA': bool(principal.usa_ia),
            'proveedor': getattr(principal, 'proveedor', 'reglas'), 'modelo': getattr(principal, 'modelo', None)}
