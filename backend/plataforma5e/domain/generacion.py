"""Errores y datos de generación independientes del transporte y la persistencia."""
class GeneracionError(Exception):
    def __init__(self, codigo: str, mensaje: str):
        self.codigo = codigo
        self.mensaje = mensaje
        super().__init__(mensaje)
