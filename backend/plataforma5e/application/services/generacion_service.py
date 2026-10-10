"""HU-053: selecciona ejemplos por solicitud; no implementa RAG ni reinicia recursos."""
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4
from plataforma5e.application.ports.generacion_repository import GeneracionRepositoryPort
from plataforma5e.domain.generacion import GeneracionError

class GeneracionService:
    def __init__(self, repositorio: GeneracionRepositoryPort):
        self._repo = repositorio

    def generar(self, solicitud: dict, docente: str | None = None) -> dict:
        catalogo = self._repo.catalogo_demo()
        unidad = next((u for u in catalogo['units'] if u['id'] == solicitud['unitId']), None)
        if unidad is None:
            raise GeneracionError('SIN_MATERIAL_PROCESADO', 'Esta unidad no tiene material de demostración en la API. La ingesta real de PDFs sigue pendiente.')
        if solicitud['outcomeId'] and not any(o['id'] == solicitud['outcomeId'] for o in unidad['outcomes']):
            raise GeneracionError('RESULTADO_INVALIDO', 'El resultado de aprendizaje no pertenece a la unidad.')
        disponibles = [e for e in catalogo['examples'] if e['unitId'] == solicitud['unitId'] and e['stage'] == solicitud['stage'] and e['type'] == solicitud['resourceType'] and (solicitud['outcomeId'] is None or e['outcomeId'] == solicitud['outcomeId'])]
        if solicitud['stage'] == 'evaluate':
            disponibles = [e for e in disponibles if len(e.get('options', [])) == solicitud['optionCount']]
        if not disponibles:
            raise GeneracionError('EVIDENCIA_INSUFICIENTE', 'La API de demostración no tiene ejemplos para esta combinación de unidad, etapa y tipo. No se generó contenido.')
        ahora = datetime.now(timezone.utc).isoformat()
        request = {**solicitud, 'id': f'sol-api-{uuid4()}', 'createdAt': ahora}
        recursos = []
        referencias = set()
        for original in disponibles[:solicitud['quantity']]:
            e = deepcopy(original)
            rid = f'rec-api-{uuid4()}'
            citations = []
            for c in e['citations']:
                referencias.update(c['fragmentIds'])
                citations.append({**c, 'fragmentIds': [f'api-demo:{f}' for f in c['fragmentIds']]})
            options = None
            if e.get('options') is not None:
                options = []
                for o in e['options']:
                    referencias.update(o['sourceFragmentIds'])
                    options.append({**o, 'id': f'{rid}:{o["id"]}', 'sourceFragmentIds': [f'api-demo:{f}' for f in o['sourceFragmentIds']], 'decision': 'pendiente', 'discardReason': None, 'edited': False, 'reliabilityWarning': o.get('reliabilityWarning')})
            recursos.append({**{k: e[k] for k in ['exampleId','unitId','outcomeId','stage','type','title','body']}, 'id': rid, 'requestId': request['id'], 'source': 'api_demo', 'options': options, 'citations': citations, 'status': 'pendiente', 'edited': False, 'discardReason': None, 'createdAt': ahora, 'updatedAt': ahora, 'decidedAt': None})
        fragments = [f for f in catalogo['fragments'] if f['id'] in referencias]
        if {f['id'] for f in fragments} != referencias:
            raise GeneracionError('EVIDENCIA_INSUFICIENTE', 'Faltan fragmentos de demostración para sustentar la propuesta. No se generó contenido.')
        document_ids = {f['documentId'] for f in fragments}
        documents = [d for d in catalogo['documents'] if d['id'] in document_ids]
        if {d['id'] for d in documents} != document_ids:
            raise GeneracionError('EVIDENCIA_INSUFICIENTE', 'Falta el documento de origen de la evidencia de demostración.')
        resultado = {'mode': 'api_demo', 'notice': catalogo['notice'], 'request': request, 'resources': recursos, 'available': len(disponibles), 'fragments': [{**f, 'id': f'api-demo:{f["id"]}', 'documentId': f'api-demo:{f["documentId"]}'} for f in fragments], 'documents': [{**d, 'id': f'api-demo:{d["id"]}'} for d in documents]}
        self._repo.guardar(resultado, docente) if docente else self._repo.guardar(resultado)
        return resultado

    def obtener(self, generacion_id: str) -> dict:
        resultado = self._repo.obtener(generacion_id)
        if resultado is None:
            raise GeneracionError('GENERACION_NO_ENCONTRADA', 'La solicitud de generación no existe.')
        return resultado
