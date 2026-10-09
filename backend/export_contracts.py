"""
Script de exportación y compilación de esquemas JSON Schema.
"""

import json
from pathlib import Path

from app.contracts.solicitud import GenerationRequestModel
from app.contracts.engage import ResourceEngageItemModel
from app.contracts.explore import ResourceExploreItemModel
from app.contracts.explain import ResourceExplainItemModel
from app.contracts.elaborate import ResourceElaborateItemModel
from app.contracts.evaluate import ResourceEvaluateItemModel

# Determina la raíz del repositorio y el directorio de documentación compartido
ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "docs" / "contratos"


def exportar_todos_los_contratos() -> None:
    """Serializa cada contrato de datos en un archivo JSON Schema versionado."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    catalogo_contratos = {
        "solicitud_generacion_v1.json": GenerationRequestModel.model_json_schema(),
        "recurso_engage_v1.json": ResourceEngageItemModel.model_json_schema(),
        "recurso_explore_v1.json": ResourceExploreItemModel.model_json_schema(),
        "recurso_explain_v1.json": ResourceExplainItemModel.model_json_schema(),
        "recurso_elaborate_v1.json": ResourceElaborateItemModel.model_json_schema(),
        "recurso_evaluate_v1.json": ResourceEvaluateItemModel.model_json_schema()
    }
    
    for nombre_archivo, esquema_json in catalogo_contratos.items():
        ruta_salida = OUTPUT_DIR / nombre_archivo
        with open(ruta_salida, "w", encoding="utf-8") as archivo:
            json.dump(esquema_json, archivo, indent=2, ensure_ascii=False)
        print(f"Esquema exportado exitosamente: {nombre_archivo}")


if __name__ == "__main__":
    exportar_todos_los_contratos()