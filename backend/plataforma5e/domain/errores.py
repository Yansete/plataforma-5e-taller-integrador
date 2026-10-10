"""Errores del núcleo independientes de HTTP y de la persistencia."""


class RecursoNoEncontrado(ValueError):
    def __init__(self):
        super().__init__("Recurso no encontrado")


class SinRecursosAprobados(ValueError):
    def __init__(self):
        super().__init__("No hay recursos aprobados para exportar")


class PersistenciaNoDisponible(Exception):
    def __init__(self, mensaje="No se pudo guardar o consultar. Comprueba la conexión de la base de datos."):
        super().__init__(mensaje)


class RegistroDuplicado(Exception):
    def __init__(self):
        super().__init__("El registro ya existe. Actualiza la lista y revisa los datos.")
