"""
Módulo de contratos de salida para la etapa pedagógica Evaluar (Evaluate).
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from plataforma5e.adapters.inbound.contratos.base import FragmentCitationModel


class ItemOptionModel(BaseModel):
    """
    Representa una opción de respuesta (clave correcta o distractor funcional).
    """
    id: Literal["a", "b", "c", "d", "e"] = Field(
        ...,
        description="Identificador correlativo de la alternativa dentro del ítem."
    )
    texto: str = Field(
        ...,
        min_length=1,
        description="Contenido textual de la alternativa de respuesta."
    )
    correcta: bool = Field(
        ...,
        description="Determina si la opción corresponde a la clave válida de la pregunta."
    )
    retroalimentacion: str = Field(
        ...,
        min_length=5,
        description="Explicación formativa que orienta al estudiante sobre el acierto o el error."
    )
    fragmentos_origen: List[str] = Field(
        ...,
        min_length=1,
        description="Lista de identificadores de fragmentos documentales que respaldan la alternativa."
    )
    advertencia_fiabilidad: Optional[str] = Field(
        default=None,
        description="Mensaje del motor de anclaje si el distractor requiere revisión por proximidad léxica."
    )
    similitud_con_clave: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Similitud semántica calculada frente a la clave para asegurar plausibilidad sin equivalencia."
    )


class CitationBlockModel(BaseModel):
    """
    Estructura de trazabilidad agregada para el cuerpo del ítem.
    """
    afirmacion: str = Field(
        ...,
        min_length=5,
        description="Aserción pedagógica o técnica formulada en el contenido del ítem."
    )
    fragmentos: List[str] = Field(
        ...,
        min_length=1,
        description="Colección de IDs de fragmentos asociados directamente a la afirmación."
    )
    evidencia_detallada: Optional[List[FragmentCitationModel]] = Field(
        default=None,
        description="Desglose exhaustivo de citas con texto literal, página y similitud."
    )


class ResourceEvaluateItemModel(BaseModel):
    """
    Recurso de evaluación formativa de opción múltiple.
    """
    id: str = Field(
        ...,
        description="Identificador persistente del recurso en la base de datos (ej. rec-eval-01)."
    )
    etapa_5e: Literal["evaluate"] = Field(
        default="evaluate",
        description="Etapa fija correspondiente al modelo instruccional 5E."
    )
    tipo: Literal["item_opcion_multiple"] = Field(
        default="item_opcion_multiple",
        description="Tipología estructural del recurso didáctico generado."
    )
    titulo: str = Field(
        ...,
        min_length=5,
        description="Encabezado descriptivo del ítem según el tema evaluado."
    )
    enunciado: str = Field(
        ...,
        min_length=10,
        description="Cuerpo de la pregunta, caso o problema planteado al estudiante."
    )
    alternativas: List[ItemOptionModel] = Field(
        ...,
        min_length=3,
        max_length=5,
        description="Conjunto de opciones que contiene una clave y entre 2 y 4 distractores funcionales."
    )
    citas: List[CitationBlockModel] = Field(
        ...,
        min_length=1,
        description="Bloques obligatorios de citas que verifican la fidelidad semántica con el material."
    )
    estado: Literal["pendiente", "aprobado", "descartado"] = Field(
        default="pendiente",
        description="Estado del recurso en el flujo de decisión del docente."
    )