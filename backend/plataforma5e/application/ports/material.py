"""Puertos de la ingesta del material: leer archivos, guardar fragmentos y buscar fuentes abiertas."""
from typing import Protocol


class ExtractorTextoPort(Protocol):
    def extraer(self, tipo: str, contenido: bytes) -> list[tuple[str, str]]:
        """Devuelve [(ubicación, texto)]: una entrada por página, diapositiva o sección."""
        ...


class MaterialRepositoryPort(Protocol):
    def fragmentos_reemplazar(self, docente: str, documento_id: str, unidad_id: str, fragmentos: list[dict]) -> None: ...
    def fragmentos_de_documento(self, docente: str, documento_id: str) -> list[dict]: ...
    def fragmentos_de_unidad(self, docente: str, unidad_id: str) -> list[dict]: ...
    def documento_actualizar(self, docente: str, datos: dict) -> None: ...


class FuenteAbiertaPort(Protocol):
    def buscar(self, tema: str, maximo: int) -> list[dict]:
        """Devuelve [{'titulo', 'url', 'texto', 'licencia', 'fuente'}] sobre el tema."""
        ...
