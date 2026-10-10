"""Comprobación HTTP de disponibilidad del servicio."""
from fastapi import APIRouter


def crear_router_salud() -> APIRouter:
    router = APIRouter()

    @router.get("/salud")
    def salud():
        return {"estado": "ok"}

    return router
