"""Contrato de salida para exportar recursos revisados."""
from typing import Protocol
from plataforma5e.domain.models import RecursoDominio


class ExportadorPort(Protocol):
    def exportar(self, recursos: list[RecursoDominio]) -> str: ...
