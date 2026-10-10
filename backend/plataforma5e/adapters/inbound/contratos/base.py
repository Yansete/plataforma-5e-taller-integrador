"""
Módulo base para estructuras de datos compartidas y anclaje de evidencia.
"""

from typing import Optional
from pydantic import BaseModel, Field


class FragmentCitationModel(BaseModel):
    """
    Representa una referencia explícita a un fragmento del material de estudio.
    """
    fragment_id: str = Field(
        ...,
        description="Identificador persistente del fragmento en la tabla fragmento (ej. f-u2-01)."
    )
    document_id: Optional[str] = Field(
        default=None,
        description="Identificador único o nombre del documento maestro de origen."
    )
    location: int = Field(
        ...,
        ge=1,
        description="Número de página o diapositiva donde se ubica el texto original."
    )
    quoted_text: str = Field(
        ...,
        min_length=10,
        description="Extracto literal del fragmento que valida la afirmación generada."
    )
    similarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Coeficiente de similitud semántica coseno entre el texto generado y el fragmento."
    )