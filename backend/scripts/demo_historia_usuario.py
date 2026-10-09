"""Script que ejecuta el flujo de la demo HU-043 (de punta a punta)."""
from __future__ import annotations

import argparse
from pathlib import Path
import httpx


def main():
    parser = argparse.ArgumentParser(description="Demo HU-043")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="URL base del servidor")
    parser.add_argument("--salida", default="./salida_demo", help="Carpeta de salida para el XML")
    args = parser.parse_args()

    directorio_salida = Path(args.salida)
    directorio_salida.mkdir(parents=True, exist_ok=True)

    with httpx.Client(base_url=args.url, timeout=30) as api:
        # 1. Generar recursos
        print("Paso 1: Generando recursos...")
        resp = api.post("/api/v1/recursos/generar", json={"unidad": 2, "etapa": "evaluate"})
        recursos = resp.json()
        rec1, rec2, rec3 = recursos[0], recursos[1], recursos[2]

        # 2. Revisión del primer y segundo recurso
        print("Paso 2: Revisando alternativas...")
        api.post(f"/api/v1/recursos/{rec1['id']}/alternativas/B/decision", json={"decision": "aceptar"}).raise_for_status()
        api.post(f"/api/v1/recursos/{rec1['id']}/alternativas/C/decision", json={"decision": "editar", "texto": "Texto editado por el docente"}).raise_for_status()
        api.post(f"/api/v1/recursos/{rec1['id']}/alternativas/D/decision", json={"decision": "descartar"}).raise_for_status()

        for letra in "BCD":
            api.post(f"/api/v1/recursos/{rec2['id']}/alternativas/{letra}/decision", json={"decision": "aceptar"}).raise_for_status()

        # 3. Intentar aprobar el tercer recurso sin revisar (debe fallar y mostrar aprobacion_bloqueada)
        print("Paso 3: Verificando que recurso sin revisar se bloquea...")
        resp_bloqueo = api.post(f"/api/v1/recursos/{rec3['id']}/aprobar")
        if resp_bloqueo.status_code == 400 and "aprobacion_bloqueada" in resp_bloqueo.text:
            print("aprobacion_bloqueada verificado con exito.")
        else:
            print("Advertencia: aprobacion_bloqueada no detectada.")

        # 4. Aprobar recursos 1 y 2
        print("Paso 4: Aprobando recursos 1 y 2...")
        api.post(f"/api/v1/recursos/{rec1['id']}/aprobar").raise_for_status()
        api.post(f"/api/v1/recursos/{rec2['id']}/aprobar").raise_for_status()

        # 5. Exportar a Moodle XML
        print("Paso 5: Exportando a Moodle XML...")
        exportacion = api.post("/api/v1/exportaciones", json={"formato": "moodle_xml"})
        exportacion.raise_for_status()

        archivo_xml = directorio_salida / "preguntas_moodle.xml"
        archivo_xml.write_bytes(exportacion.content)
        print(f"Exportacion completada en {archivo_xml}")


if __name__ == "__main__":
    main()