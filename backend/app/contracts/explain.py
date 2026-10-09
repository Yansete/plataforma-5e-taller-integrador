"""
Módulo de contratos de salida para la etapa pedagógica Explicar (Explain).
"""

from typing import List, Literal
from pydantic import BaseModel, Field
from app.contracts.base import FragmentCitationModel


class DefinicionClaveModel(BaseModel):
    """
    Representa una entrada de terminología técnica fundamental.
    """
    termino: str = Field(
        ...,
        min_length=2,
        description="Nombre formal del término, algoritmo o estructura analizada."
    )
    definicion: str = Field(
        ...,
        min_length=10,
        description="Explicación conceptual precisa y fundamentada en la cátedra."
    )
    fragmento_origen_id: str = Field(
        ...,
        description="Identificador del fragmento que sustenta textualmente la definición."
    )


class ResourceExplainItemModel(BaseModel):
    """
    Recurso de formalización y síntesis conceptual.
    """
    id: str = Field(
        ...,
        description="Identificador persistente del recurso didáctico (ej. rec-expl-01)."
    )
    etapa_5e: Literal["explain"] = Field(
        default="explain",
        description="Etapa instruccional fija correspondiente al modelo 5E."
    )
    tipo: Literal["explicacion_conceptual"] = Field(
        default="explicacion_conceptual",
        description="Clasificación estructural del recurso generado."
    )
    titulo: str = Field(
        ...,
        min_length=5,
        description="Título de la formalización teórica."
    )
    sintesis_teorica: str = Field(
        ...,
        min_length=20,
        description="Desarrollo explicativo estructurado de los fundamentos y mecanismos."
    )
    definiciones_clave: List[DefinicionClaveModel] = Field(
        ...,
        min_length=1,
        description="Conjunto de términos técnicos esenciales con su definición formal."
    )
    ejemplo_canonico: str = Field(
        ...,
        min_length=15,
        description="Caso práctico completamente resuelto que ilustra la teoría expuesta."
    )
    citas: List[FragmentCitationModel] = Field(
        ...,
        min_length=1,
        description="Referencias documentales que certifican la exactitud de los conceptos expuestos."
    )
    estado: Literal["pendiente", "aprobado", "descartado"] = Field(
        default="pendiente",
        description="Estado del recurso dentro del flujo de revisión docente."
    )