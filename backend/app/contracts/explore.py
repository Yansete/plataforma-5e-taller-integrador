"""
Módulo de contratos de salida para la etapa pedagógica Explorar (Explore).
"""

from typing import List, Literal
from pydantic import BaseModel, Field
from app.contracts.base import FragmentCitationModel


class PasoIndagacionModel(BaseModel):
    """
    Representa una acción individual dentro del procedimiento de indagación.
    """
    numero: int = Field(
        ...,
        ge=1,
        description="Orden secuencial del paso dentro de la actividad."
    )
    consigna: str = Field(
        ...,
        min_length=10,
        description="Instrucción explícita de la tarea de exploración a ejecutar."
    )
    resultado_esperado: str = Field(
        ...,
        min_length=5,
        description="Evidencia o respuesta preliminar que el estudiante debe observar."
    )


class ResourceExploreItemModel(BaseModel):
    """
    Recurso de aprendizaje para el descubrimiento guiado de conceptos.
    """
    id: str = Field(
        ...,
        description="Identificador persistente del recurso didáctico (ej. rec-exp-01)."
    )
    etapa_5e: Literal["explore"] = Field(
        default="explore",
        description="Etapa instruccional fija correspondiente al modelo 5E."
    )
    tipo: Literal["guia_indagacion"] = Field(
        default="guia_indagacion",
        description="Clasificación estructural del recurso generado."
    )
    titulo: str = Field(
        ...,
        min_length=5,
        description="Encabezado temático de la guía de exploración."
    )
    objetivo_indagacion: str = Field(
        ...,
        min_length=10,
        description="Propósito pedagógico o patrón técnico que se espera sea descubierto."
    )
    material_necesario: List[str] = Field(
        ...,
        min_length=1,
        description="Conjunto de insumos, fragmentos de código o datos requeridos."
    )
    pasos: List[PasoIndagacionModel] = Field(
        ...,
        min_length=2,
        description="Secuencia ordenada de actividades prácticas a desarrollar."
    )
    preguntas_reflexion: List[str] = Field(
        ...,
        min_length=1,
        description="Interrogantes metacognitivas para sintetizar los hallazgos observados."
    )
    citas: List[FragmentCitationModel] = Field(
        ...,
        min_length=1,
        description="Referencias documentales que fundamentan el diseño de la actividad."
    )
    estado: Literal["pendiente", "aprobado", "descartado"] = Field(
        default="pendiente",
        description="Estado del recurso dentro del flujo de revisión docente."
    )