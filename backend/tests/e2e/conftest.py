"""Servidor real para las pruebas de punta a punta (TA-007).

A diferencia de tests/integration (que llama a la API dentro del mismo proceso), aquí se
levanta uvicorn en un proceso aparte y todo se hace por HTTP, como en la demo del sábado.

Base de datos:
- Por defecto, un archivo SQLite nuevo en una carpeta temporal.
- Si existe la variable E2E_DATABASE_URL (por ejemplo, PostgreSQL en GitHub Actions),
  se usa esa base. Debe estar vacía: las pruebas comparan contra lo que ellas mismas crean.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

RAIZ_BACKEND = Path(__file__).resolve().parents[2]


def _puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _vaciar_postgres(url: str) -> None:
    """Deja la base de PostgreSQL sin tablas para que cada servidor arranque limpio."""
    from sqlalchemy import create_engine, text

    motor = create_engine(url)
    with motor.begin() as conexion:
        conexion.execute(text("DROP SCHEMA public CASCADE"))
        conexion.execute(text("CREATE SCHEMA public"))
    motor.dispose()


@pytest.fixture
def servidor(tmp_path: Path) -> Iterator[str]:
    """Levanta la API en un puerto libre y devuelve su URL base. Se apaga al terminar."""
    url_bd = os.getenv("E2E_DATABASE_URL")
    if url_bd:
        _vaciar_postgres(url_bd)
    else:
        url_bd = f"sqlite:///{tmp_path / 'e2e.db'}"

    puerto = _puerto_libre()
    # Generador por reglas y sin búsqueda en Wikipedia: las pruebas no dependen de internet ni de una clave de IA.
    entorno = {**os.environ, "DATABASE_URL": url_bd, "CARGAR_DATOS_DEMO": "true", "IA_PROVEEDOR": "reglas",
               "BUSQUEDA_POR_TEMA": "false"}
    registro = (tmp_path / "uvicorn.log").open("w")
    proceso = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "plataforma5e.bootstrap.app:crear_aplicacion", "--factory",
         "--host", "127.0.0.1", "--port", str(puerto)],
        cwd=RAIZ_BACKEND, env=entorno, stdout=registro, stderr=subprocess.STDOUT,
    )
    base = f"http://127.0.0.1:{puerto}"
    try:
        limite = time.monotonic() + 30
        while True:
            if proceso.poll() is not None:
                registro.flush()
                pytest.fail("El servidor terminó al arrancar:\n" + (tmp_path / "uvicorn.log").read_text())
            try:
                if httpx.get(f"{base}/salud", timeout=1).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            if time.monotonic() > limite:
                pytest.fail("El servidor no respondió en 30 s:\n" + (tmp_path / "uvicorn.log").read_text())
            time.sleep(0.2)
        yield base
    finally:
        proceso.terminate()
        try:
            proceso.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proceso.kill()
        registro.close()
