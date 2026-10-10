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

async def request_validation_error_handler(request: Request, exc):
    detalles = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": {"codigo": "PARAMETROS_INVALIDOS", "mensaje": "La API rechazó los parámetros. Revisa la unidad, etapa, tipo, cantidad y contexto."}, "detail": detalles})


async def recurso_no_encontrado_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={
        "error": {"codigo": "RECURSO_NO_ENCONTRADO", "mensaje": str(exc)}, "detail": str(exc)
    })


async def error_configuracion(request: Request, exc):
    return JSONResponse(status_code=exc.status, content={'error': {'codigo': exc.codigo, 'mensaje': exc.mensaje}})


async def conflicto(request: Request, exc):
    return JSONResponse(status_code=409, content={'error': {'codigo': 'REGISTRO_DUPLICADO', 'mensaje': str(exc)}})


async def error_bd(request: Request, exc):
    return JSONResponse(status_code=503, content={'error': {'codigo': 'PERSISTENCIA_NO_DISPONIBLE', 'mensaje': str(exc)}})
