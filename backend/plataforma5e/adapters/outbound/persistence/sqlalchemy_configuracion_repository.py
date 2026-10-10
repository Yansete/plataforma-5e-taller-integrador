"""Cursos, archivos y sesiones persistentes. Los bytes se guardan en la misma BD."""
from sqlalchemy import Column, String, JSON, LargeBinary, Float, UniqueConstraint, select
from plataforma5e.adapters.outbound.persistence.db import Base, engine, SessionLocal
from plataforma5e.adapters.outbound.persistence.sqlalchemy_generacion_repository import GeneracionORM, GeneracionDocenteORM, SQLAlchemyGeneracionRepository

class SesionORM(Base):
    __tablename__ = 'ep002_sesiones'
    huella = Column(String, primary_key=True)
    docente = Column(String, nullable=False)
    vence = Column(Float, nullable=False)

class CursoORM(Base):
    __tablename__ = 'ep002_cursos'
    docente = Column(String, primary_key=True)
    id = Column(String, primary_key=True)
    codigo = Column(String, nullable=False)
    datos = Column(JSON, nullable=False)
    __table_args__ = (UniqueConstraint('docente', 'codigo'),)

class DocumentoORM(Base):
    __tablename__ = 'ep002_documentos'
    id = Column(String, primary_key=True)
    docente = Column(String, nullable=False)
    unidad = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    datos = Column(JSON, nullable=False)
    contenido = Column(LargeBinary, nullable=False)
    __table_args__ = (UniqueConstraint('docente', 'unidad', 'nombre'),)

class SQLAlchemyConfiguracionRepository:
    def __init__(self):
        for tabla in (SesionORM, CursoORM, DocumentoORM, GeneracionDocenteORM):
            tabla.__table__.create(engine, checkfirst=True)

    def iniciar_catalogo(self, docente):
        with SessionLocal() as s:
            if s.scalars(select(CursoORM).where(CursoORM.docente == docente)).first():
                return
            unidades = SQLAlchemyGeneracionRepository().catalogo_demo()['units']
            curso = {'id': 'curso-aed', 'code': 'ICSI-205', 'name': 'Algoritmos y Estructuras de Datos', 'term': '2026-II', 'units': unidades}
            s.add(CursoORM(docente=docente, id=curso['id'], codigo=curso['code'], datos=curso))
            s.commit()

    def sesion_guardar(self, huella, docente, vence):
        with SessionLocal() as s:
            s.add(SesionORM(huella=huella, docente=docente, vence=vence)); s.commit()

    def sesion_obtener(self, huella):
        with SessionLocal() as s:
            e = s.get(SesionORM, huella)
            return (e.docente, e.vence) if e else None

    def sesion_borrar(self, huella):
        with SessionLocal() as s:
            e = s.get(SesionORM, huella)
            if e: s.delete(e); s.commit()

    def cursos(self, docente):
        with SessionLocal() as s:
            return [e.datos for e in s.scalars(select(CursoORM).where(CursoORM.docente == docente).order_by(CursoORM.id))]

    def curso_guardar(self, docente, curso):
        with SessionLocal() as s:
            s.merge(CursoORM(docente=docente, id=curso['id'], codigo=curso['code'], datos=curso)); s.commit()

    def documentos(self, docente):
        with SessionLocal() as s:
            return [e.datos for e in s.scalars(select(DocumentoORM).where(DocumentoORM.docente == docente).order_by(DocumentoORM.id.desc()))]

    def documento_guardar(self, docente, datos, contenido):
        with SessionLocal() as s:
            s.add(DocumentoORM(id=datos['id'], docente=docente, unidad=datos['unitId'], nombre=datos['fileName'].casefold(), datos=datos, contenido=contenido)); s.commit()

    def documento_obtener(self, docente, id):
        with SessionLocal() as s:
            e = s.get(DocumentoORM, id)
            return (e.datos, e.contenido) if e and e.docente == docente else None

    def documento_borrar(self, docente, id):
        with SessionLocal() as s:
            e = s.get(DocumentoORM, id)
            if e and e.docente == docente: s.delete(e); s.commit()

    def historial(self, docente):
        with SessionLocal() as s:
            return [e.resultado['request'] for e in s.scalars(select(GeneracionORM).join(GeneracionDocenteORM, GeneracionORM.id == GeneracionDocenteORM.id).where(GeneracionDocenteORM.docente == docente).order_by(GeneracionORM.id.desc()))]

    def propietario_generacion(self, id):
        with SessionLocal() as s:
            e = s.get(GeneracionDocenteORM, id)
            return e.docente if e else None
