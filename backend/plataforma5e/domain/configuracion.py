"""Errores del módulo de configuración conectado (EP-002)."""
class ConfiguracionError(Exception):
    def __init__(self, codigo: str, mensaje: str, status: int = 400):
        self.codigo, self.mensaje, self.status = codigo, mensaje, status
        super().__init__(mensaje)
