"""Traduce fallos SQLAlchemy a errores independientes del adaptador."""
from functools import wraps
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from plataforma5e.domain.errores import PersistenciaNoDisponible, RegistroDuplicado


def traducir_errores(funcion):
    @wraps(funcion)
    def ejecutar(*args, **kwargs):
        try:
            return funcion(*args, **kwargs)
        except IntegrityError as exc:
            raise RegistroDuplicado() from exc
        except SQLAlchemyError as exc:
            raise PersistenciaNoDisponible() from exc
    return ejecutar
