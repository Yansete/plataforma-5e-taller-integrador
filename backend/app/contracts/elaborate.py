"""
Módulo de contratos de salida para la etapa pedagógica Elaborar (Elaborate).
"""

from typing import List, Literal
from pydantic import BaseModel, Field
from app.contracts.base import FragmentCitationModel


class CriterioEvaluacionModel(BaseModel):
    """
    Criterio o dimensión para valorar la resolución del problema.
    """
    rubro: str = Field(
        ...,
        min_length=3,
        description="Dimensión técnica o analítica evaluada (ej. Eficiencia, Modularidad)."
    )
    descripcion: str = Field(
        ...,
        min_length=5,
        description="Expectativa concreta de desempeño para superar satisfactoriamente el rubro."
    )


class ResourceElaborateItemModel(BaseModel):
    """
    Recurso de transferencia y profundización cognitiva.
    """
    id: str = Field(
        ...,
        description="Identificador persistente del recurso didáctico (ej. rec-elab-01)."
    )
    etapa_5e: Literal["elaborate"] = Field(
        default="elaborate",
        description="Etapa instruccional fija correspondiente al modelo 5E."
    )
    tipo: Literal["caso_transferencia"] = Field(
        default="caso_transferencia",
        description="Clasificación estructural del recurso generado."
    )
    titulo: str = Field(
        ...,
        min_length=5,
        description="Título descriptivo del desafío de aplicación."
    )
    contexto_nuevo: str = Field(
        ...,
        min_length=20,
        description="Descripción del escenario o sistema donde se sitúa el nuevo problema."
    )
    reto_planteado: str = Field(
        ...,
        min_length=10,
        description="Formulación explícita del problema o requerimiento complejo a resolver."
    )
    criterios_evaluacion: List[CriterioEvaluacionModel] = Field(
        ...,
        min_length=2,
        description="Pautas o rúbricas para guiar y verificar la calidad de la solución."
    )
    citas: List[FragmentCitationModel] = Field(
        ...,
        min_length=1,
        description="Referencias documentales que fundamentan los conceptos base aplicados."
    )
    estado: Literal["pendiente", "aprobado", "descartado"] = Field(
        default="pendiente",
        description="Estado del recurso dentro del flujo de revisión docente."
    )