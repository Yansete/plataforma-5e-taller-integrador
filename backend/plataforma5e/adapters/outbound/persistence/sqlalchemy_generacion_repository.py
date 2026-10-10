"""Persiste solicitudes y propuestas sin alterar las tablas de la demo anterior."""
import json
from pathlib import Path
from sqlalchemy import Column, JSON, String
from plataforma5e.adapters.outbound.persistence.db import Base, engine, SessionLocal

class GeneracionORM(Base):
    __tablename__ = 'generaciones_demo'
    id = Column(String, primary_key=True)
    resultado = Column(JSON, nullable=False)

class GeneracionDocenteORM(Base):
    __tablename__ = 'ep002_generaciones_docente'
    id = Column(String, primary_key=True)
    docente = Column(String, nullable=False)

from plataforma5e.adapters.outbound.persistence.errores import traducir_errores

class SQLAlchemyGeneracionRepository:
    @traducir_errores
    def __init__(self):
        GeneracionORM.__table__.create(bind=engine, checkfirst=True)
        GeneracionDocenteORM.__table__.create(bind=engine, checkfirst=True)

    @traducir_errores
    def catalogo_demo(self) -> dict:
        path = Path(__file__).resolve().parents[1] / 'fixtures' / 'generacion_demo.json'
        return json.loads(path.read_text(encoding='utf-8'))

    @traducir_errores
    def guardar(self, resultado: dict, docente: str | None = None) -> None:
        with SessionLocal() as session:
            session.add(GeneracionORM(id=resultado['request']['id'], resultado=resultado))
            if docente:
                session.add(GeneracionDocenteORM(id=resultado['request']['id'], docente=docente))
            session.commit()

    @traducir_errores
    def obtener(self, generacion_id: str) -> dict | None:
        with SessionLocal() as session:
            entity = session.get(GeneracionORM, generacion_id)
            return entity.resultado if entity else None
