"""Manejador estandarizado de excepciones (C02 de EN-006)."""
from fastapi import Request
from fastapi.responses import JSONResponse


async def value_error_handler(request: Request, exc: ValueError):
    # Devuelve el formato esperado por los tests y el estandar único
    status_code = 400
    return JSONResponse(
        status_code=status_code,
        content={"error": {"codigo": "ERROR_VALIDACION", "mensaje": str(exc)}, "detail": str(exc)}
    )