"""Implementación con SQLAlchemy que satisface RecursoRepositoryPort (EN-020)."""
from typing import List, Optional
from plataforma5e.application.ports.recurso_repository import RecursoRepositoryPort
from plataforma5e.domain.models import RecursoDominio, AlternativaDominio
from plataforma5e.adapters.outbound.persistence.db import Base, engine, SessionLocal
from plataforma5e.adapters.outbound.persistence.orm_models import RecursoORM, AlternativaORM


from plataforma5e.adapters.outbound.persistence.errores import traducir_errores

class SQLAlchemyRecursoRepository(RecursoRepositoryPort):
    @traducir_errores
    def __init__(self):
        # Asegurar que las tablas existan con el engine activo
        RecursoORM.__table__.create(bind=engine, checkfirst=True)
        AlternativaORM.__table__.create(bind=engine, checkfirst=True)

    def _mapear_a_dominio(self, orm: RecursoORM) -> RecursoDominio:
        return RecursoDominio(
            id=orm.id,
            titulo=orm.titulo,
            enunciado=orm.enunciado,
            retroalimentacion=orm.retroalimentacion,
            estado_revision=orm.estado_revision,
            citas=orm.citas or [],
            alternativas=[
                AlternativaDominio(
                    letra=a.letra,
                    texto=a.texto,
                    es_correcta=a.es_correcta,
                    justificacion=a.justificacion,
                    estado=a.estado,
                    citas=a.citas or [],
                    fragmentos_origen=a.fragmentos_origen or [],
                )
                for a in orm.alternativas
            ]
        )

    @traducir_errores
    def obtener_todos(self) -> List[RecursoDominio]:
        with SessionLocal() as db:
            items = db.query(RecursoORM).all()
            return [self._mapear_a_dominio(i) for i in items]

    @traducir_errores
    def obtener_por_id(self, recurso_id: str) -> Optional[RecursoDominio]:
        with SessionLocal() as db:
            item = db.query(RecursoORM).filter(RecursoORM.id == recurso_id).first()
            return self._mapear_a_dominio(item) if item else None

    @traducir_errores
    def guardar(self, recurso: RecursoDominio) -> RecursoDominio:
        with SessionLocal() as db:
            orm = db.query(RecursoORM).filter(RecursoORM.id == recurso.id).first()
            if not orm:
                orm = RecursoORM(id=recurso.id)
                db.add(orm)

            orm.titulo = recurso.titulo
            orm.enunciado = recurso.enunciado
            orm.retroalimentacion = recurso.retroalimentacion
            orm.estado_revision = recurso.estado_revision
            orm.citas = recurso.citas

            # Sincronizar alternativas
            db.query(AlternativaORM).filter(AlternativaORM.recurso_id == recurso.id).delete()
            for a in recurso.alternativas:
                alt_orm = AlternativaORM(
                    id=f"{recurso.id}_{a.letra}",
                    recurso_id=recurso.id,
                    letra=a.letra,
                    texto=a.texto,
                    es_correcta=a.es_correcta,
                    justificacion=a.justificacion,
                    estado=a.estado,
                    citas=a.citas,
                    fragmentos_origen=a.fragmentos_origen,
                )
                db.add(alt_orm)

            db.commit()
            return self.obtener_por_id(recurso.id)

    @traducir_errores
    def reiniciar_demo(self) -> List[RecursoDominio]:
        with SessionLocal() as db:
            db.query(AlternativaORM).delete()
            db.query(RecursoORM).delete()
            db.commit()

        demo_items = [
            RecursoDominio(
                id="rec-demo-1",
                titulo="Pregunta 1: Algoritmos de Búsqueda",
                enunciado="<p>¿Cuál es la complejidad temporal en el peor caso del algoritmo de búsqueda binaria?</p>",
                retroalimentacion="<p>La búsqueda binaria divide el espacio de búsqueda a la mitad en cada paso, resultando en O(log n).</p>",
                alternativas=[
                    AlternativaDominio(letra="A", texto="O(log n)", es_correcta=True, justificacion="Correcto. La reducción logarítmica es la característica principal.", estado="aceptado"),
                    AlternativaDominio(letra="B", texto="O(n)", es_correcta=False, justificacion="Incorrecto. O(n) corresponde a la búsqueda lineal.", estado="pendiente"),
                    AlternativaDominio(letra="C", texto="O(n^2)", es_correcta=False, justificacion="Incorrecto. O(n^2) es típico de algoritmos de ordenamiento cuadrático.", estado="pendiente"),
                    AlternativaDominio(letra="D", texto="O(1)", es_correcta=False, justificacion="Incorrecto. El tiempo constante se obtiene en tablas hash, no en arreglos ordenados.", estado="pendiente"),
                ]
            ),
            RecursoDominio(
                id="rec-demo-2",
                titulo="Pregunta 2: Estructuras Lineales",
                enunciado="<p>¿Qué estructura de datos sigue el principio LIFO (Last In, First Out)?</p>",
                retroalimentacion="<p>La pila (stack) inserta y elimina elementos por el mismo extremo (tope).</p>",
                alternativas=[
                    AlternativaDominio(letra="A", texto="Pila (Stack)", es_correcta=True, justificacion="Correcto. El último elemento en entrar es el primero en salir.", estado="aceptado"),
                    AlternativaDominio(letra="B", texto="Cola (Queue)", es_correcta=False, justificacion="Incorrecto. La cola sigue el principio FIFO.", estado="pendiente"),
                    AlternativaDominio(letra="C", texto="Lista Enlazada Simple", es_correcta=False, justificacion="Incorrecto. Una lista permite inserciones y accesos en cualquier posición.", estado="pendiente"),
                    AlternativaDominio(letra="D", texto="Árbol Binario", es_correcta=False, justificacion="Incorrecto. El árbol es una estructura jerárquica no lineal.", estado="pendiente"),
                ]
            ),
            RecursoDominio(
                id="rec-demo-3",
                titulo="Pregunta 3: Recursión y Caso Base",
                enunciado="<p>¿Qué condición indispensable debe tener una función recursiva para evitar un bucle infinito?</p>",
                retroalimentacion="<p>Toda función recursiva debe definir al menos un caso base que detenga las llamadas sucesivas.</p>",
                alternativas=[
                    AlternativaDominio(letra="A", texto="Un caso base de parada", es_correcta=True, justificacion="Correcto. El caso base evita el desbordamiento de pila.", estado="pendiente"),
                    AlternativaDominio(letra="B", texto="Múltiples llamadas recursivas", es_correcta=False, justificacion="Incorrecto. No garantiza la terminación.", estado="pendiente"),
                    AlternativaDominio(letra="C", texto="Variables globales obligatorias", es_correcta=False, justificacion="Incorrecto. No son necesarias ni recomendadas.", estado="pendiente"),
                ]
            ),
        ]
        for r in demo_items:
            self.guardar(r)
        return self.obtener_todos()
