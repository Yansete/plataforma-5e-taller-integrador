"""
Módulo de contratos de entrada para la solicitud de generación de recursos.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field


class GenerationRequestModel(BaseModel):
    """
    Especificación de entrada para el servicio de generación de secuencias didácticas.
    """
    unidad_id: str = Field(
        ...,
        description="Identificador de la unidad académica curricular (ej. u2)."
    )
    resultado_aprendizaje_id: Optional[str] = Field(
        default=None,
        description="Código del resultado de aprendizaje específico a cubrir (ej. ra-2-1)."
    )
    etapa_5e: Literal["engage", "explore", "explain", "elaborate", "evaluate"] = Field(
        ...,
        description="Etapa instruccional del modelo pedagógico 5E solicitada."
    )
    tipo_recurso: str = Field(
        ...,
        description="Subtipo de recurso didáctico a producir (ej. item_opcion_multiple, pregunta_detonante)."
    )
    cantidad: int = Field(
        default=1,
        ge=1,
        le=5,
        description="Número de variantes o instancias de recursos a generar."
    )
    dificultad: Literal["basica", "intermedia", "avanzada"] = Field(
        default="intermedia",
        description="Nivel de complejidad cognitiva estimada para el recurso."
    )
    alternativas: int = Field(
        default=4,
        ge=3,
        le=5,
        description="Cantidad de opciones de respuesta a generar en recursos de evaluación."
    )
    top_k: int = Field(
        default=10,
        ge=1,
        le=20,
        description="Cantidad máxima de fragmentos contextuales a recuperar de la base vectorial."
    )
    umbral_evidencia: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Umbral mínimo de similitud semántica requerido para admitir un fragmento."
    )
    indicaciones: Optional[str] = Field(
        default="",
        max_length=500,
        description="Instrucciones docentes complementarias para guiar el enfoque pedagógico."
    )