"""Puerto que define el contrato del repositorio de recursos."""
from abc import ABC, abstractmethod
from typing import List, Optional
from plataforma5e.domain.models import RecursoDominio


class RecursoRepositoryPort(ABC):
    @abstractmethod
    def obtener_todos(self) -> List[RecursoDominio]:
        pass

    @abstractmethod
    def obtener_por_id(self, recurso_id: str) -> Optional[RecursoDominio]:
        pass

    @abstractmethod
    def guardar(self, recurso: RecursoDominio) -> RecursoDominio:
        pass

    @abstractmethod
    def reiniciar_demo(self) -> List[RecursoDominio]:
        pass