"""Entidades del dominio para la generación y revisión de recursos."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Dict


@dataclass
class AlternativaDominio:
    letra: str
    texto: str
    es_correcta: bool
    justificacion: str
    estado: str = "pendiente"  # pendiente, aceptado, editado, descartado
    citas: List[Dict[str, Any]] = field(default_factory=list)
    fragmentos_origen: List[str] = field(default_factory=lambda: ["chunk-001"])


@dataclass
class RecursoDominio:
    id: str
    titulo: str
    enunciado: str
    retroalimentacion: str
    alternativas: List[AlternativaDominio]
    estado_revision: str = "borrador"  # borrador, aprobado, rechazado
    citas: List[Dict[str, Any]] = field(default_factory=lambda: [{"fragment_id": "chunk-001"}])