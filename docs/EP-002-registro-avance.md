# Registro de avance EP-002 — Configuración del docente

Responsable: Silvana Díaz. Fecha: 10/10/2026. Base publicada: HU-053 (`1dc2784`).

Estado: implementación técnica preparada y probada en esta copia; aplicación en la computadora de Silvana, capturas manuales, commit y revisión académica pendientes.

## Criterios del módulo

| Criterio | Implementación | Evidencia que debe adjuntarse |
|---|---|---|
| C01: iniciar sesión, crear curso con unidades y subir material a una unidad | Cuenta demo verificada por backend; token revocable de 8 horas; creación y edición persistentes de cursos; carga multipart y descarga del archivo original | Inicio de sesión conectado, curso con unidades, material registrado y descargado |
| C02: solicitar por selectores o chat y confirmar la interpretación antes de generar | Chat local por reglas con resumen editable; transferencia a Configuración; cuadro de confirmación previo al POST autenticado | Interpretación corregida, confirmación de parámetros y respuesta de API |
| C03: guardar solicitud con parámetros y mostrar historial | Solicitud y asociación docente guardadas en la misma transacción; GET autenticado de historial; recuperación al iniciar sesión o recargar | Tabla de solicitudes y GET 200 después de volver a iniciar sesión o reiniciar backend |

## Persistencia y arquitectura

FastAPI recibe los contratos y compone servicios de aplicación con puertos de repositorio y adaptadores SQLAlchemy. Las tablas nuevas usan el prefijo `ep002_`: sesiones, cursos, documentos y asociación docente-generación. Se conserva `generaciones_demo` de HU-053 y la API anterior de recursos.

Las sesiones guardan únicamente la huella SHA-256 del token en la BD. La contraseña de la cuenta demo se configura mediante `EP002_DOCENTE_PASSWORD` y se compara en el servidor usando una derivación PBKDF2. La cuenta predeterminada sigue siendo pública para la demo. No se implementan registro de usuarios, recuperación de contraseñas ni roles de producción de HU-001.

La carga guarda los bytes reales y los metadatos en la base de datos. Valida permiso, unidad, RA, duplicados, extensión, tamaño, cabecera PDF, estructura básica PPTX y UTF-8 para TXT. Limita a 25 MB por archivo. La descarga devuelve el contenido original. Solo se eliminan documentos del docente autenticado. Los ejemplos de material son de solo lectura en modo conectado.

Se conservan por separado el estado local de HU-045 y la caché del modo conectado. El token se guarda en sessionStorage y se revoca en el backend al cerrar sesión. Los cursos, documentos e historial se recuperan por HTTP; los errores de API no crean registros locales como sustitución.

## Verificación técnica

- Compilación TypeScript y Vite correcta.
- Pruebas unitarias frontend: 54 superadas.
- Backend: 28 pruebas superadas, incluidas nueve de EP-002.
- Regresión frontend local: cinco recorridos Chromium.
- Integración con Vite y FastAPI: cuatro recorridos Chromium (HU-053 y EP-002).
- HTTP real: autenticación, rechazo de credenciales y tokens, revocación, cursos, unidades, archivo original descargado, duplicados, validaciones, límite de tamaño e historial.
- Reinicio: dos procesos del backend usan la misma BD SQLite; sesión, curso, archivo e historial permanecen.
- Navegador: borrar caché conectada y recargar recupera cursos, material e historial desde el servidor; cambiar de modo conserva el catálogo local anterior.

Los resultados anteriores corresponden a las pruebas de esta copia. Deben registrarse por separado los resultados en la computadora de Silvana. La persistencia se probó con SQLite; PostgreSQL no se verificó para esta integración.

## Límites de esta entrega

- El chat interpreta por reglas locales, sin IA.
- El archivo se almacena realmente, pero no se extrae ni vectoriza; queda registrado con cero fragmentos.
- La generación usa exclusivamente ejemplos preparados de HU-053. Público, competencia y demás parámetros quedan guardados, pero no convierten esa demo en generación con IA.
- Las decisiones de revisión y la exportación del frontend siguen locales.
- El historial muestra solicitudes exitosas; los rechazos no se incluyen como solicitudes generadas.
- No se acredita validación académica ni evaluación con docentes. RN-004 se realiza después con participantes reales.

## Registro final por completar

Horas reales: [completar]. Prueba local y fecha: [completar]. Capturas: [enlaces]. Commit: [completar]. Revisor y observaciones: [completar]. Estado de aprobación: pendiente.

Guía del recorrido y comandos: [EP-002-aplicar-cambios.md](EP-002-aplicar-cambios.md).

## Corrección de autorización en Swagger (09/10/2026)

El encabezado Authorization se declaró originalmente como parámetro manual. Swagger no lo enviaba y GET /solicitudes devolvía SESION_REQUERIDA aunque el campo estuviera escrito. Se reemplazó por un esquema HTTP Bearer compartido en los adaptadores de entrada. Ahora Swagger muestra Authorize y añade Authorization automáticamente al pegar solo el token. La API conserva los códigos de error de sesión y la compatibilidad de HU-053.

Se añadió una prueba que verifica el esquema Bearer, las operaciones protegidas, la ausencia del parámetro manual reservado y las respuestas HTTP con sesión válida o esquema incorrecto. No cambian los datos almacenados ni se requiere reinstalar dependencias.
