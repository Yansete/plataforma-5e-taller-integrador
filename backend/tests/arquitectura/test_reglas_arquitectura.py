import inspect
import plataforma5e.domain.models as domain_models


def test_el_dominio_no_depende_de_capas_externas():
    """
    Regla Hexagonal:
    El núcleo de dominio no debe importar nada de adapters, application, ni frameworks como sqlalchemy o fastapi.
    """
    source = inspect.getsource(domain_models)

    assert "adapters" not in source, "El dominio no puede depender de adapters"
    assert "fastapi" not in source, "El dominio no puede depender del framework web (FastAPI)"
    assert "sqlalchemy" not in source, "El dominio no puede depender de la persistencia ORM (SQLAlchemy)"