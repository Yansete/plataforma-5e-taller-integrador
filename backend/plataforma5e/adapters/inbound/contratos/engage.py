"""
Módulo de contratos de salida para la etapa pedagógica Enganchar (Engage).
"""

from typing import List, Literal
from pydantic import BaseModel, Field
from plataforma5e.adapters.inbound.contratos.base import FragmentCitationModel


class ResourceEngageItemModel(BaseModel):
    """
    Recurso didáctico de conflicto cognitivo y activación previa.
    """
    id: str = Field(
        ...,
        description="Identificador único del recurso didáctico (ej. rec-engage-01)."
    )
    etapa_5e: Literal["engage"] = Field(
        default="engage",
        description="Etapa fija correspondiente al modelo instruccional 5E."
    )
    tipo: Literal["pregunta_detonante"] = Field(
        default="pregunta_detonante",
        description="Clasificación del tipo de recurso pedagógico producido."
    )
    titulo: str = Field(
        ...,
        min_length=5,
        description="Título de la actividad introductoria."
    )
    situacion_contexto: str = Field(
        ...,
        min_length=15,
        description="Descripción de un escenario real o dilema técnico que conecta con el tema."
    )
    pregunta_detonante: str = Field(
        ...,
        min_length=10,
        description="Interrogante abierta diseñada para suscitar el debate en el aula."
    )
    concepciones_erroneas: List[str] = Field(
        ...,
        min_length=1,
        description="Errores conceptuales frecuentes asociados al tema documentados en el corpus."
    )
    guia_docente: str = Field(
        ...,
        min_length=10,
        description="Orientaciones pedagógicas para que el profesor dirija la discusión grupal."
    )
    citas: List[FragmentCitationModel] = Field(
        ...,
        min_length=1,
        description="Referencias documentales que fundamentan el contexto y los conceptos erróneos."
    )
    estado: Literal["pendiente", "aprobado", "descartado"] = Field(
        default="pendiente",
        description="Estado de revisión del recurso antes de ser integrado a la secuencia."
    )