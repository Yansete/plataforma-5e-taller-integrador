"""Fragmentos del material y estado de procesamiento de los documentos (EN-012)."""
from sqlalchemy import delete, select

from plataforma5e.adapters.outbound.persistence.db import SessionLocal
from plataforma5e.adapters.outbound.persistence.errores import traducir_errores
from plataforma5e.adapters.outbound.persistence.sqlalchemy_configuracion_repository import DocumentoORM, FragmentoORM


def _a_dict(e: FragmentoORM) -> dict:
    return {'id': e.id, 'documento_id': e.documento, 'unidad_id': e.unidad, 'orden': e.orden,
            'ubicacion': e.ubicacion, 'texto': e.texto}


class SQLAlchemyMaterialRepository:
    """Requiere que SQLAlchemyConfiguracionRepository ya haya creado las tablas."""

    @traducir_errores
    def fragmentos_reemplazar(self, docente, documento_id, unidad_id, fragmentos):
        with SessionLocal() as s:
            s.execute(delete(FragmentoORM).where(FragmentoORM.documento == documento_id, FragmentoORM.docente == docente))
            s.add_all(FragmentoORM(id=f['id'], docente=docente, documento=documento_id, unidad=unidad_id,
                                   orden=f['orden'], ubicacion=f['ubicacion'], texto=f['texto']) for f in fragmentos)
            s.commit()

    @traducir_errores
    def fragmentos_de_documento(self, docente, documento_id):
        with SessionLocal() as s:
            consulta = select(FragmentoORM).where(FragmentoORM.docente == docente, FragmentoORM.documento == documento_id)
            return [_a_dict(e) for e in s.scalars(consulta.order_by(FragmentoORM.orden))]

    @traducir_errores
    def fragmentos_de_unidad(self, docente, unidad_id):
        with SessionLocal() as s:
            consulta = select(FragmentoORM).where(FragmentoORM.docente == docente, FragmentoORM.unidad == unidad_id)
            return [_a_dict(e) for e in s.scalars(consulta.order_by(FragmentoORM.documento, FragmentoORM.orden))]

    @traducir_errores
    def documento_actualizar(self, docente, datos):
        with SessionLocal() as s:
            e = s.get(DocumentoORM, datos['id'])
            if e and e.docente == docente:
                e.datos = datos
                s.commit()
