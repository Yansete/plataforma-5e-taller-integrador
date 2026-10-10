"""Declara Bearer en OpenAPI para que Swagger envíe Authorization correctamente."""
from fastapi import Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

sesion_docente = HTTPBearer(
    auto_error=False,
    scheme_name='SesionDocente',
    description='Obtén el token con POST /api/v1/sesiones. En Authorize pega solamente el token, sin escribir Bearer.',
)

def obtener_autorizacion(
    request: Request,
    credenciales: HTTPAuthorizationCredentials | None = Security(sesion_docente),
) -> str | None:
    # Conserva también encabezados malformados para rechazarlos en el servicio;
    # auto_error=False permite la generación anónima de la demo anterior HU-053.
    return request.headers.get('Authorization')
