"""Puerto del generador de recursos (un modelo de IA o el generador por reglas)."""
from typing import Protocol


class GeneradorRecursosPort(Protocol):
    descripcion: str  # se muestra al docente, por ejemplo «Gemini · gemini-3.8-flash»
    usa_ia: bool

    def generar(self, contexto: dict) -> dict:
        """Recibe el contexto de redaccion.construir_contexto y devuelve {'recursos': [...]}.

        Cada recurso: {'titulo', 'contenido', 'citas': [{'afirmacion', 'fragmentos': ['F1']}],
        'alternativas': [{'texto', 'correcta', 'retroalimentacion', 'fragmentos'}]}.
        Las citas usan las etiquetas F1, F2… de los fragmentos del contexto.
        """
        ...
