from sqlalchemy import Column, String, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from plataforma5e.adapters.outbound.persistence.db import Base


class RecursoORM(Base):
    __tablename__ = "recursos"

    id = Column(String, primary_key=True)
    titulo = Column(String, nullable=False)
    enunciado = Column(String, nullable=False)
    retroalimentacion = Column(String, nullable=False)
    estado_revision = Column(String, default="borrador")
    citas = Column(JSON, default=list)

    alternativas = relationship("AlternativaORM", back_populates="recurso", cascade="all, delete-orphan")


class AlternativaORM(Base):
    __tablename__ = "alternativas"

    id = Column(String, primary_key=True)
    recurso_id = Column(String, ForeignKey("recursos.id"), nullable=False)
    letra = Column(String, nullable=False)
    texto = Column(String, nullable=False)
    es_correcta = Column(Boolean, default=False)
    justificacion = Column(String, nullable=False)
    estado = Column(String, default="pendiente")
    citas = Column(JSON, default=list)
    fragmentos_origen = Column(JSON, default=list)

    recurso = relationship("RecursoORM", back_populates="alternativas")