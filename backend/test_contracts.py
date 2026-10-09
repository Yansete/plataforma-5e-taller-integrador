"""
Módulo de pruebas de integridad para contratos de generación.
"""

import sys
from pydantic import ValidationError
from app.contracts.evaluate import ResourceEvaluateItemModel

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


def ejecutar_pruebas():
    print("Iniciando validación de contratos de datos...")
    
    # 1. Comprobar que el caso válido es aceptado
    try:
        recurso = ResourceEvaluateItemModel(**payload_valido)
        print(f"[OK] Payload válido aceptado correctamente: {recurso.id}")
    except ValidationError as error:
        print(f"[FALLO] El payload válido fue rechazado inesperadamente: {error}")
        sys.exit(1)

    # 2. Comprobar que el caso inválido es bloqueado
    try:
        ResourceEvaluateItemModel(**payload_invalido)
        print("[FALLO] El contrato aceptó un recurso sin evidencia documental.")
        sys.exit(1)
    except ValidationError as error:
        errores = error.errors()
        print(f"[OK] Rechazo controlado: se detectaron {len(errores)} infracciones estructurales.")
        for err in errores:
            campo = " -> ".join(str(p) for p in err["loc"])
            print(f"     Campo: {campo} | Motivo: {err['msg']}")

    print("\nIntegridad de contratos verificada con éxito.")


if __name__ == "__main__":
    ejecutar_pruebas()