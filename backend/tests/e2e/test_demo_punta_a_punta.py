"""TA-007 · Prueba de punta a punta de la historia de la demo (HU-043).

    Como docente, quiero generar ítems de opción múltiple a partir de mi material,
    revisarlos con su evidencia y exportarlos a Moodle.

Se ejecuta contra el servidor real (proceso aparte, por HTTP) y comprueba tres cosas:
1. El script que se muestra en la demo termina sin errores y deja un Moodle XML importable.
2. Lo exportado es fiel a lo que el docente aprobó (I19): enunciado, alternativas vigentes,
   clave y retroalimentación de cada alternativa.
3. Swagger y el estado del servicio responden en el servidor real.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import httpx

from tests.e2e.conftest import RAIZ_BACKEND
from tests.e2e.validador_moodle_xml import leer_preguntas, texto_plano, validar

SOLICITUD = {"unidad": 2, "etapa": "evaluate"}


def test_el_script_de_la_demo_termina_bien_y_deja_un_xml_importable(servidor: str, tmp_path: Path):
    salida = tmp_path / "salida_demo"
    resultado = subprocess.run(
        [sys.executable, "scripts/demo_historia_usuario.py", "--url", servidor, "--salida", str(salida)],
        cwd=RAIZ_BACKEND, capture_output=True, text=True, timeout=120,
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr
    assert "aprobacion_bloqueada" in resultado.stdout  # el paso 3 de la demo se bloqueó, como debe

    archivos = list(salida.glob("*.xml"))
    assert len(archivos) == 1, archivos
    contenido = archivos[0].read_bytes()
    assert validar(contenido) == []
    assert len(leer_preguntas(contenido)) == 2  # los dos ítems que la demo aprueba


def test_lo_exportado_es_fiel_a_lo_aprobado(servidor: str):
    with httpx.Client(base_url=servidor, timeout=30) as api:
        recursos = api.post("/api/v1/recursos/generar", json=SOLICITUD).json()
        primero, segundo, tercero = recursos[0], recursos[1], recursos[2]
        decision = "/api/v1/recursos/{}/alternativas/{}/decision"

        # Primero: acepta B, edita C y descarta D. Segundo: acepta todo. Tercero: sin revisar.
        api.post(decision.format(primero["id"], "B"), json={"decision": "aceptar"}).raise_for_status()
        api.post(decision.format(primero["id"], "C"), json={"decision": "editar", "texto": "Texto editado por el docente"}).raise_for_status()
        api.post(decision.format(primero["id"], "D"), json={"decision": "descartar"}).raise_for_status()
        for letra in "BCD":
            api.post(decision.format(segundo["id"], letra), json={"decision": "aceptar"}).raise_for_status()
        for recurso in (primero, segundo):
            assert api.post(f"/api/v1/recursos/{recurso['id']}/aprobar").status_code == 200

        aprobados = [api.get(f"/api/v1/recursos/{r['id']}").json() for r in (primero, segundo)]
        exportacion = api.post("/api/v1/exportaciones", json={"formato": "moodle_xml"})
        assert exportacion.status_code == 200, exportacion.text

    contenido = exportacion.content
    assert validar(contenido) == []
    preguntas = leer_preguntas(contenido)

    # Solo salen los aprobados: el tercero, sin revisar, no se exporta
    assert [p.nombre for p in preguntas] == [r["titulo"] for r in aprobados]
    assert tercero["titulo"] not in [p.nombre for p in preguntas]

    for recurso, pregunta in zip(aprobados, preguntas):
        assert pregunta.enunciado == texto_plano(recurso["enunciado"])
        assert pregunta.retroalimentacion_general == texto_plano(recurso["retroalimentacion"])
        vigentes = [a for a in recurso["alternativas"] if a["estado"] != "descartado"]
        esperado = [
            (texto_plano(a["texto"]), "100" if a["es_correcta"] else "0", texto_plano(a["justificacion"]))
            for a in vigentes
        ]
        assert pregunta.alternativas == esperado

    # El ítem revisado conserva la edición y pierde el distractor descartado
    textos_primero = [texto for texto, _, _ in preguntas[0].alternativas]
    assert "Texto editado por el docente" in textos_primero
    assert len(textos_primero) == 3


def test_swagger_y_salud_responden_en_el_servidor_real(servidor: str):
    assert httpx.get(f"{servidor}/salud").json() == {"estado": "ok"}
    esquema = httpx.get(f"{servidor}/openapi.json").json()
    for ruta in ("/api/v1/recursos/generar", "/api/v1/exportaciones"):
        assert ruta in esquema["paths"]
    assert httpx.get(f"{servidor}/docs").status_code == 200
