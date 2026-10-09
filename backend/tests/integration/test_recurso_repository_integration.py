from plataforma5e.adapters.outbound.persistence.sqlalchemy_recurso_repository import (
    SQLAlchemyRecursoRepository,
)
from plataforma5e.domain.models import RecursoDominio, AlternativaDominio


def test_guardar_y_recuperar_recurso_integration():
    """Valida la persistencia real a través del adaptador SQLAlchemy."""
    repo = SQLAlchemyRecursoRepository()

    alt = AlternativaDominio(
        letra="A",
        texto="Respuesta de integración",
        es_correcta=True,
        justificacion="Justificación válida",
    )
    recurso = RecursoDominio(
        id="rec-int-001",
        titulo="Integración Repositorio",
        enunciado="¿Persiste el modelo correctamente?",
        retroalimentacion="Verificado con éxito",
        alternativas=[alt],
    )

    repo.guardar(recurso)

    recuperado = repo.obtener_por_id("rec-int-001")

    assert recuperado is not None
    assert recuperado.id == "rec-int-001"
    assert len(recuperado.alternativas) == 1
    assert recuperado.alternativas[0].texto == "Respuesta de integración"