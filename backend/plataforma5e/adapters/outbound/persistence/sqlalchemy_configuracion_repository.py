"""Cuentas, sesiones, cursos, archivos, recursos revisados y descargas. Los bytes se guardan en la misma BD."""
from sqlalchemy import Column, String, JSON, LargeBinary, Float, Integer, Text, UniqueConstraint, delete, select
from plataforma5e.adapters.outbound.persistence.db import Base, engine, SessionLocal
from plataforma5e.adapters.outbound.persistence.sqlalchemy_generacion_repository import GeneracionORM, GeneracionDocenteORM

class UsuarioORM(Base):
    """Cuentas de docente (HU-001). La contraseña se guarda como huella PBKDF2 con su sal."""
    __tablename__ = 'ep002_usuarios'
    email = Column(String, primary_key=True)
    nombre = Column(String, nullable=False)
    sal = Column(String, nullable=False)
    clave = Column(String, nullable=False)
    creado = Column(String, nullable=False)

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

class FragmentoORM(Base):
    """Fragmentos del material del docente (EN-012). Se borran junto con su documento."""
    __tablename__ = 'ep002_fragmentos'
    id = Column(String, primary_key=True)
    docente = Column(String, nullable=False, index=True)
    documento = Column(String, nullable=False, index=True)
    unidad = Column(String, nullable=False, index=True)
    orden = Column(Integer, nullable=False)
    ubicacion = Column(String, nullable=False)
    texto = Column(Text, nullable=False)

class RecursoDocenteORM(Base):
    """Recursos generados para una unidad, con su revisión (HU-010). `datos` guarda el recurso completo."""
    __tablename__ = 'ep002_recursos'
    id = Column(String, primary_key=True)
    docente = Column(String, nullable=False, index=True)
    unidad = Column(String, nullable=False, index=True)
    creado = Column(String, nullable=False)
    datos = Column(JSON, nullable=False)

class DescargaORM(Base):
    """Historial de descargas (Moodle XML, QTI 2.1 o documento) de una unidad."""
    __tablename__ = 'ep002_descargas'
    id = Column(String, primary_key=True)
    docente = Column(String, nullable=False, index=True)
    unidad = Column(String, nullable=False, index=True)
    creado = Column(String, nullable=False)
    datos = Column(JSON, nullable=False)

TABLAS = (UsuarioORM, SesionORM, CursoORM, DocumentoORM, FragmentoORM, RecursoDocenteORM, DescargaORM)

from plataforma5e.adapters.outbound.persistence.errores import traducir_errores

class SQLAlchemyConfiguracionRepository:
    @traducir_errores
    def __init__(self, generaciones):
        self._generaciones = generaciones
        for tabla in (*TABLAS, GeneracionDocenteORM):
            tabla.__table__.create(engine, checkfirst=True)

    @traducir_errores
    def usuario_obtener(self, email):
        with SessionLocal() as s:
            e = s.get(UsuarioORM, email)
            return {'email': e.email, 'nombre': e.nombre, 'sal': e.sal, 'clave': e.clave} if e else None

    @traducir_errores
    def usuario_crear(self, usuario):
        with SessionLocal() as s:
            s.add(UsuarioORM(**usuario)); s.commit()

    @traducir_errores
    def iniciar_catalogo(self, docente):
        with SessionLocal() as s:
            if s.scalars(select(CursoORM).where(CursoORM.docente == docente)).first():
                return
            unidades = self._generaciones.catalogo_demo()['units']
            curso = {'id': 'curso-aed', 'code': 'ICSI-205', 'name': 'Algoritmos y Estructuras de Datos', 'term': '2026-II', 'units': unidades}
            s.add(CursoORM(docente=docente, id=curso['id'], codigo=curso['code'], datos=curso))
            s.commit()

    @traducir_errores
    def sesion_guardar(self, huella, docente, vence):
        with SessionLocal() as s:
            s.add(SesionORM(huella=huella, docente=docente, vence=vence)); s.commit()

    @traducir_errores
    def sesion_obtener(self, huella):
        with SessionLocal() as s:
            e = s.get(SesionORM, huella)
            return (e.docente, e.vence) if e else None

    @traducir_errores
    def sesion_borrar(self, huella):
        with SessionLocal() as s:
            e = s.get(SesionORM, huella)
            if e: s.delete(e); s.commit()

    @traducir_errores
    def cursos(self, docente):
        with SessionLocal() as s:
            return [e.datos for e in s.scalars(select(CursoORM).where(CursoORM.docente == docente).order_by(CursoORM.id))]

    @traducir_errores
    def curso_guardar(self, docente, curso):
        with SessionLocal() as s:
            s.merge(CursoORM(docente=docente, id=curso['id'], codigo=curso['code'], datos=curso)); s.commit()

    @traducir_errores
    def curso_borrar(self, docente, curso_id, unidades):
        """Borra el curso y lo que cuelga de sus unidades, en una sola transacción."""
        with SessionLocal() as s:
            for tabla in (FragmentoORM, DocumentoORM, RecursoDocenteORM, DescargaORM):
                s.execute(delete(tabla).where(tabla.docente == docente, tabla.unidad.in_(unidades)))
            s.execute(delete(CursoORM).where(CursoORM.docente == docente, CursoORM.id == curso_id))
            s.commit()

    @traducir_errores
    def documentos(self, docente):
        with SessionLocal() as s:
            return [e.datos for e in s.scalars(select(DocumentoORM).where(DocumentoORM.docente == docente).order_by(DocumentoORM.id.desc()))]

    @traducir_errores
    def documento_guardar(self, docente, datos, contenido):
        with SessionLocal() as s:
            s.add(DocumentoORM(id=datos['id'], docente=docente, unidad=datos['unitId'], nombre=datos['fileName'].casefold(), datos=datos, contenido=contenido)); s.commit()

    @traducir_errores
    def documento_obtener(self, docente, id):
        with SessionLocal() as s:
            e = s.get(DocumentoORM, id)
            return (e.datos, e.contenido) if e and e.docente == docente else None

    @traducir_errores
    def documento_borrar(self, docente, id):
        with SessionLocal() as s:
            e = s.get(DocumentoORM, id)
            if e and e.docente == docente:
                s.execute(delete(FragmentoORM).where(FragmentoORM.documento == id, FragmentoORM.docente == docente))
                s.delete(e); s.commit()

    @traducir_errores
    def historial(self, docente):
        with SessionLocal() as s:
            return [e.resultado['request'] for e in s.scalars(select(GeneracionORM).join(GeneracionDocenteORM, GeneracionORM.id == GeneracionDocenteORM.id).where(GeneracionDocenteORM.docente == docente).order_by(GeneracionORM.id.desc()))]

    @traducir_errores
    def propietario_generacion(self, id):
        with SessionLocal() as s:
            e = s.get(GeneracionDocenteORM, id)
            return e.docente if e else None
