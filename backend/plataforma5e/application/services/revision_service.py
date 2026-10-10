"""HU-010 y HU-052: revisión docente guardada en la base de datos, e historial de descargas de la unidad.

Los recursos se guardan al generarse (GeneracionService). Aquí el docente los revisa: acepta, edita o
descarta distractores y aprueba o descarta el recurso. Un recurso solo queda «aprobado» si cumple las
mismas reglas que muestra la pantalla: distractores decididos, al menos dos aceptados y una clave.
"""
from datetime import datetime, timezone
from uuid import uuid4

from plataforma5e.application.ports.configuracion_repository import ConfiguracionRepositoryPort
from plataforma5e.application.ports.revision import RevisionRepositoryPort
from plataforma5e.domain.configuracion import ConfiguracionError

MIN_DISTRACTORES = 2
ESTADOS = {'pendiente', 'aprobado', 'descartado'}
DECISIONES = {'pendiente', 'aceptado', 'descartado'}
MOTIVOS = {'sin_sentido', 'tambien_correcto', 'duplicado', 'fuera_de_unidad', 'otro', 'regenerado'}
FORMATOS = {'moodle_xml', 'qti21', 'documento'}
MAX_DESCARGAS = 50


def bloqueos_aprobacion(recurso: dict) -> list[str]:
    """Motivos por los que el recurso todavía no puede aprobarse. Lista vacía: puede aprobarse."""
    motivos = []
    if not str(recurso.get('body', '')).strip():
        motivos.append('El contenido no puede estar vacío.')
    opciones = recurso.get('options')
    if opciones:
        distractores = [o for o in opciones if not o.get('isCorrect')]
        pendientes = sum(o.get('decision') == 'pendiente' for o in distractores)
        if pendientes:
            motivos.append(f'Decide los {pendientes} distractor(es) pendiente(s).')
        elif sum(o.get('decision') == 'aceptado' for o in distractores) < MIN_DISTRACTORES:
            motivos.append(f'El ítem necesita al menos {MIN_DISTRACTORES} distractores aceptados.')
        if not any(o.get('isCorrect') and str(o.get('text', '')).strip() for o in opciones):
            motivos.append('El ítem necesita una clave (respuesta correcta).')
    return motivos


class RevisionService:
    def __init__(self, configuracion: ConfiguracionRepositoryPort, revision: RevisionRepositoryPort):
        self._config = configuracion
        self._revision = revision

    def _comprobar_unidad(self, docente: str, unidad_id: str) -> None:
        if not any(u['id'] == unidad_id for c in self._config.cursos(docente) for u in c['units']):
            raise ConfiguracionError('UNIDAD_NO_ENCONTRADA', 'La unidad no pertenece a tus cursos.', 404)

    def _recurso(self, docente: str, unidad_id: str, recurso_id: str) -> dict:
        self._comprobar_unidad(docente, unidad_id)
        recurso = self._revision.recurso_obtener(docente, recurso_id)
        if recurso is None or recurso.get('unitId') != unidad_id:
            raise ConfiguracionError('RECURSO_NO_ENCONTRADO', 'El recurso no existe.', 404)
        return recurso

    # ------------------------------------------------------------------ recursos

    def listar(self, docente: str, unidad_id: str) -> list[dict]:
        self._comprobar_unidad(docente, unidad_id)
        return sorted(self._revision.recursos_de_unidad(docente, unidad_id), key=lambda r: r.get('createdAt', ''), reverse=True)

    def actualizar(self, docente: str, unidad_id: str, recurso_id: str, cambios: dict) -> dict:
        """Guarda la revisión del docente. Solo cambia lo editable: textos, decisiones y estado."""
        recurso = self._recurso(docente, unidad_id, recurso_id)
        estado = cambios['status']
        if estado not in ESTADOS:
            raise ConfiguracionError('ESTADO_INVALIDO', 'El estado del recurso no es válido.', 422)
        motivo = cambios.get('discardReason')
        if motivo is not None and motivo not in MOTIVOS:
            raise ConfiguracionError('MOTIVO_INVALIDO', 'Elige un motivo de la lista.', 422)
        nuevo = {**recurso, 'title': cambios['title'], 'body': cambios['body'], 'edited': bool(cambios.get('edited'))}
        opciones = recurso.get('options')
        if opciones is not None:
            entrada = cambios.get('options')
            if entrada is None or sorted(o['id'] for o in entrada) != sorted(o['id'] for o in opciones):
                raise ConfiguracionError('ALTERNATIVAS_INVALIDAS', 'Las alternativas no coinciden con el recurso.', 422)
            por_id = {o['id']: o for o in entrada}
            actualizadas = []
            for o in opciones:
                e = por_id[o['id']]
                if e['decision'] not in DECISIONES or (e.get('discardReason') is not None and e['discardReason'] not in MOTIVOS):
                    raise ConfiguracionError('DECISION_INVALIDA', 'La decisión sobre la alternativa no es válida.', 422)
                decision = 'pendiente' if o['isCorrect'] else e['decision']  # la clave no se decide por separado
                actualizadas.append({**o, 'text': e['text'], 'feedback': e.get('feedback', ''), 'decision': decision,
                                     'discardReason': e.get('discardReason') if decision == 'descartado' else None,
                                     'edited': bool(e.get('edited'))})
            nuevo['options'] = actualizadas
        if estado == 'aprobado':
            motivos = bloqueos_aprobacion(nuevo)
            if motivos:
                raise ConfiguracionError('APROBACION_BLOQUEADA', motivos[0], 409)
        ahora = datetime.now(timezone.utc).isoformat()
        if estado != recurso.get('status'):
            nuevo['decidedAt'] = ahora if estado != 'pendiente' else None
        nuevo['status'] = estado
        nuevo['discardReason'] = motivo if estado == 'descartado' else None
        nuevo['updatedAt'] = ahora
        self._revision.recursos_guardar(docente, unidad_id, [nuevo])
        return nuevo

    def borrar(self, docente: str, unidad_id: str, recurso_id: str) -> None:
        self._recurso(docente, unidad_id, recurso_id)
        self._revision.recurso_borrar(docente, recurso_id)

    def resumen(self, docente: str) -> list[dict]:
        """Recursos aprobados y por revisar de cada unidad del docente (para la lista de cursos)."""
        resumen = []
        for curso in self._config.cursos(docente):
            for unidad in curso['units']:
                recursos = self._revision.recursos_de_unidad(docente, unidad['id'])
                resumen.append({'courseId': curso['id'], 'unitId': unidad['id'],
                                'approved': sum(r.get('status') == 'aprobado' for r in recursos),
                                'pending': sum(r.get('status') == 'pendiente' for r in recursos)})
        return resumen

    # ------------------------------------------------------------------ descargas

    def descargas(self, docente: str, unidad_id: str) -> list[dict]:
        self._comprobar_unidad(docente, unidad_id)
        return sorted(self._revision.descargas(docente, unidad_id), key=lambda d: d['createdAt'], reverse=True)[:MAX_DESCARGAS]

    def registrar_descarga(self, docente: str, unidad_id: str, entrada: dict) -> dict:
        self._comprobar_unidad(docente, unidad_id)
        if entrada['format'] not in FORMATOS:
            raise ConfiguracionError('FORMATO_INVALIDO', 'El formato de descarga no es válido.', 422)
        descarga = {'id': f'descarga-{uuid4()}', 'unitId': unidad_id, 'format': entrada['format'],
                    'fileName': entrada['fileName'], 'resourceCount': entrada['resourceCount'],
                    'createdAt': datetime.now(timezone.utc).isoformat()}
        self._revision.descarga_guardar(docente, unidad_id, descarga)
        return descarga

    def borrar_descargas(self, docente: str, unidad_id: str) -> None:
        self._comprobar_unidad(docente, unidad_id)
        self._revision.descargas_borrar(docente, unidad_id)
