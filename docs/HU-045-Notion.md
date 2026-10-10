# HU-045 Prototipar el inicio de sesión y la gestión de cursos

Proyecto: Plataforma 5E — Taller Integrador.
Responsable asignada: Silvana Díaz.
Fecha de registro: 09/10/2026 (America/Lima).
Épica: EP-002 Configuración del docente.
Estimación del Backlog: 1 SP (5–8 horas). Horas reales: completar con el tiempo trabajado por la responsable; la estimación no es evidencia de horas consumidas.
Estado recomendado: implementado en copia de trabajo, pendiente de revisión local por Silvana, publicación del código y validación académica.
Base del repositorio: d1085c5f2b2523f76c1c47bdde49d3bb41e277bc.

## Alcance implementado

Se incorporaron las rutas /login y /cursos al frontend existente en React y TypeScript. La sesión de demostración comprueba el formato del correo, la contraseña requerida y la coincidencia con las credenciales públicas de prueba. Ante errores presenta mensajes accesibles. Tras el acceso se muestra la gestión de cursos y se permite continuar al recorrido existente. El cierre de sesión devuelve al formulario.

El catálogo permite crear, listar y editar cursos con código, nombre, periodo y unidades numeradas. Se validan campos obligatorios, unidades sin título y códigos duplicados. La edición conserva identificadores y resultados de aprendizaje de las unidades existentes para mantener sus referencias. Los cambios se persisten en localStorage. La migración del estado local de versión 1 a 2 conserva las decisiones previas de revisión.

Se reutilizaron Button, Card, CardHeader, PageHeader, TextField y Alert, así como los tokens compartidos de EN-014. Se ajustó el token de foco a outline de 2 px con #16352C, conforme a HU-023; la barra lateral conserva su foco blanco visible sobre el fondo oscuro.

## Criterios y evidencias

| Criterio | Resultado técnico | Evidencia |
|---|---|---|
| C01 Inicio de sesión valida correo y contraseña y muestra errores claros | Verificado en la sesión simulada; no es autenticación real | 01-login.png y 02-error-login.png; prueba e2e HU-045 |
| C02 Se crean, editan y listan cursos con unidades numeradas | Verificado; datos locales conservados tras recarga | 03-curso-creado.png y 04-curso-editado.png; pruebas de integridad del catálogo |
| C03 Uso del sistema de diseño | Componentes compartidos y tokens; foco de teclado comprobado, sin desbordamiento a 1280, 820 y 375 px | 05-cursos-1280.png, 05-cursos-820.png y 05-cursos-375.png; CSS y componentes compartidos |

Capturas: docs/evidencias/HU-045/. Generadas por el recorrido automatizado contra Vite en http://localhost:5174. Son evidencias de la copia de trabajo del asistente; Silvana debe reproducir el recorrido en su computadora para su exposición. No corresponden a validaciones de docentes.

## Verificaciones ejecutadas

- npm run build: compilación TypeScript y Vite correcta.
- npm test: 36 pruebas superadas, incluidos duplicados, títulos vacíos, conservación de referencias y migración de estado.
- npm run test:e2e: 3 pruebas superadas en Chromium, incluido el recorrido HU-045 y las reglas existentes de aprobación y exportación.
- Revisión visual de capturas de inicio de sesión, cursos en escritorio y cursos a 375 px.
- Acceso inicial por Tab al enlace Saltar al contenido y al correo; foco #16352C comprobado.

Estas verificaciones no equivalen a una auditoría completa WCAG ni a pruebas con lectores de pantalla o docentes reales.

## Conexión con backend y RAG

La pantalla llama a courseService, que modifica el store y persiste metadatos en localStorage. catalogService consulta ahora el catálogo del store. Los selectores de unidades existentes pueden usar las unidades creadas, pero no hay ingesta ni generación real para ellas.

sessionService maneja únicamente una identidad pública de demostración en sessionStorage; no guarda contraseñas. El acceso visual a las rutas no es un control de seguridad del servidor.

La integración futura debe reemplazar estos servicios por una API de autenticación y cursos, persistir curso/unidad en PostgreSQL y asociar documentos y fragmentos a la unidad. La recuperación RAG necesita filtrar los fragmentos por la unidad solicitada. HU-045 no implementa esos endpoints ni el motor RAG.

El resumen y la marca lateral siguen mostrando el primer curso de demostración; la selección global y el filtrado completo del recorrido por curso no forman parte de esta entrega. Las unidades nuevas todavía no tienen resultados de aprendizaje ni evidencia real.

## Registro para el Daily Scrum

Usar únicamente después de aplicar y comprobar estos cambios personalmente:

«En HU-045 implementé el prototipo de inicio de sesión y la gestión de cursos con unidades numeradas, utilizando los componentes de EN-014 y el foco visible de HU-023. La sesión es de demostración y los cursos se guardan localmente. Estoy verificando el recorrido en localhost y preparando las evidencias para la revisión del Sprint. La autenticación y persistencia en servidor permanecen pendientes de integración.»

Horas reales de la sesión: [completar].
Enlace al commit: [añadir después de subir el código].
Bloqueos o hallazgos: [registrar lo observado].

## Pendientes para la validación académica

- Aplicar los cambios al repositorio local sin sobrescribir trabajo concurrente y ejecutar las verificaciones.
- Adjuntar esta página y las capturas a la tarjeta HU-045 en Notion.
- Subir el código mediante Git y registrar el enlace al commit.
- Preparar el acta de validación HU-045 en Word y la diapositiva individual con capturas de la computadora de Silvana.
- Registrar quién valida, fecha y resultado real. No marcar aprobación del profesor ni de docentes sin su revisión.
- RN-004 / EN-003 requiere posteriormente la participación real de al menos dos docentes.
