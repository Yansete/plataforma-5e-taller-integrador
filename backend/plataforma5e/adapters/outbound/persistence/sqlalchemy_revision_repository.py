"""Recursos revisados y descargas de cada unidad (HU-010). Las tablas las crea SQLAlchemyConfiguracionRepository."""
from sqlalchemy import delete, select

from plataforma5e.adapters.outbound.persistence.db import SessionLocal
from plataforma5e.adapters.outbound.persistence.errores import traducir_errores
from plataforma5e.adapters.outbound.persistence.sqlalchemy_configuracion_repository import DescargaORM, RecursoDocenteORM


class SQLAlchemyRevisionRepository:
    @traducir_errores
    def recursos_de_unidad(self, docente, unidad_id):
        with SessionLocal() as s:
            consulta = select(RecursoDocenteORM).where(RecursoDocenteORM.docente == docente, RecursoDocenteORM.unidad == unidad_id)
            return [e.datos for e in s.scalars(consulta.order_by(RecursoDocenteORM.creado.desc()))]

    @traducir_errores
    def recurso_obtener(self, docente, recurso_id):
        with SessionLocal() as s:
            e = s.get(RecursoDocenteORM, recurso_id)
            return e.datos if e and e.docente == docente else None

    @traducir_errores
    def recursos_guardar(self, docente, unidad_id, recursos):
        with SessionLocal() as s:
            for r in recursos:
                s.merge(RecursoDocenteORM(id=r['id'], docente=docente, unidad=unidad_id, creado=r['createdAt'], datos=r))
            s.commit()

    @traducir_errores
    def recurso_borrar(self, docente, recurso_id):
        with SessionLocal() as s:
            s.execute(delete(RecursoDocenteORM).where(RecursoDocenteORM.id == recurso_id, RecursoDocenteORM.docente == docente))
            s.commit()

    @traducir_errores
    def descargas(self, docente, unidad_id):
        with SessionLocal() as s:
            consulta = select(DescargaORM).where(DescargaORM.docente == docente, DescargaORM.unidad == unidad_id)
            return [e.datos for e in s.scalars(consulta.order_by(DescargaORM.creado.desc()))]

    @traducir_errores
    def descarga_guardar(self, docente, unidad_id, descarga):
        with SessionLocal() as s:
            s.add(DescargaORM(id=descarga['id'], docente=docente, unidad=unidad_id, creado=descarga['createdAt'], datos=descarga))
            s.commit()

    @traducir_errores
    def descargas_borrar(self, docente, unidad_id):
        with SessionLocal() as s:
            s.execute(delete(DescargaORM).where(DescargaORM.docente == docente, DescargaORM.unidad == unidad_id))
            s.commit()
