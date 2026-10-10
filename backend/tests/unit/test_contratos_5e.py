"""
Módulo de pruebas de integridad para contratos de generación.
"""

import pytest
from copy import deepcopy
from pydantic import ValidationError
from plataforma5e.adapters.inbound.contratos.evaluate import ResourceEvaluateItemModel

# Caso A: Estructura válida con trazabilidad completa
payload_valido = {
    "id": "rec-001",
    "etapa_5e": "evaluate",
    "tipo": "item_opcion_multiple",
    "titulo": "Complejidad en estructuras de colas simples",
    "enunciado": "¿Cuál es la complejidad temporal de desencolar en un arreglo lineal sin apuntador circular?",
    "alternativas": [
        {
            "id": "a",
            "texto": "O(n), debido a la necesidad de desplazar los elementos restantes hacia el inicio.",
            "correcta": True,
            "retroalimentacion": "Correcto. El desplazamiento de N-1 posiciones requiere tiempo lineal.",
            "fragmentos_origen": ["f-u2-03"]
        },
        {
            "id": "b",
            "texto": "O(1), puesto que solo se actualiza el índice de cabecera.",
            "correcta": False,
            "retroalimentacion": "Incorrecto. En una cola lineal sin puntero flotante los elementos deben reubicarse.",
            "fragmentos_origen": ["f-u2-04"],
            "similitud_con_clave": 0.74
        },
        {
            "id": "c",
            "texto": "O(log n), aplicando división sucesiva de posiciones.",
            "correcta": False,
            "retroalimentacion": "Incorrecto. No existe partición logarítmica en un arreglo estático simple.",
            "fragmentos_origen": ["f-u2-03"],
            "similitud_con_clave": 0.42
        }
    ],
    "citas": [
        {
            "afirmacion": "La operación desencolar en un arreglo estático simple traslada los elementos consumiendo tiempo proporcional al tamaño.",
            "fragmentos": ["f-u2-03"]
        }
    ],
    "estado": "pendiente"
}

# Caso B: Estructura inválida que carece de citas de evidencia
payload_invalido = {
    "id": "rec-002",
    "etapa_5e": "evaluate",
    "tipo": "item_opcion_multiple",
    "titulo": "Pregunta no respaldada",
    "enunciado": "¿Pregunta generada por un modelo sin anclaje en el corpus?",
    "alternativas": [
        {
            "id": "a",
            "texto": "Alternativa sin fragmento",
            "correcta": True,
            "retroalimentacion": "Retroalimentación genérica",
            "fragmentos_origen": []  # Inválido: lista vacía
        }
    ],
    "citas": []  # Inválido: requiere al menos una cita documentada
}


def test_contrato_evaluar_acepta_trazabilidad_completa():
    recurso = ResourceEvaluateItemModel(**payload_valido)
    assert recurso.id == "rec-001"
    assert recurso.alternativas[0].fragmentos_origen == ["f-u2-03"]
    assert recurso.citas[0].fragmentos == ["f-u2-03"]


def test_contrato_evaluar_rechaza_recurso_sin_evidencia():
    with pytest.raises(ValidationError) as error:
        ResourceEvaluateItemModel(**payload_invalido)
    campos = {e["loc"] for e in error.value.errors()}
    assert ("citas",) in campos
    assert ("alternativas", 0, "fragmentos_origen") in campos


@pytest.mark.parametrize("campo", ["citas", "fragmentos_origen"])
def test_cada_alternativa_y_el_recurso_requieren_evidencia(campo):
    datos = deepcopy(payload_valido)
    if campo == "citas":
        datos["citas"] = []
    else:
        datos["alternativas"][1]["fragmentos_origen"] = []
    with pytest.raises(ValidationError):
        ResourceEvaluateItemModel(**datos)
