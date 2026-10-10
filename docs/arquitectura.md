# Arquitectura y estado de Plataforma 5E

Actualizado el 10/10/2026 para la revisión del Sprint 1. Este documento reúne el estado del proyecto,
la integración con el backend y las convenciones para retomar el trabajo.

## Estado actual

Existe un frontend React 18, TypeScript y Vite 5 y un backend FastAPI con SQLAlchemy. El frontend ofrece
modo local y modo conectado. La generación usa ejemplos ficticios preparados; no hay RAG ni IA en ejecución.
La exportación produce archivos reales con plantillas fijas. La importación en instancias reales de Moodle
y Chamilo permanece pendiente (TA-006).

| Área | Funcionamiento actual | Límite |
|---|---|---|
| Sesión | HU-045 local; EP-002 verifica una cuenta demo en el servidor con token revocable de ocho horas | Registro de usuarios y roles de producción pendientes |
| Cursos y unidades | Creación, edición y consulta locales o por API; conserva identificadores y RA existentes | Las unidades nuevas no tienen RA |
| Material | Local: metadatos y procesamiento simulado. Conectado: bytes originales en la BD, descarga y eliminación | Los archivos nuevos tienen cero fragmentos; no se extraen ni vectorizan |
| Solicitud | Selectores o chat por reglas, interpretación editable y confirmación antes del POST | No interpreta mediante modelos de IA |
| Generación e historial | HU-053 guarda solicitudes y devuelve propuestas y fragmentos ficticios; EP-002 asocia el historial al docente | Los parámetros registrados no convierten los ejemplos en generación real |
| Secuencia y revisión | Cinco etapas 5E, decisiones explícitas, regeneración simulada e historial de versiones | Las decisiones del frontend se guardan localmente; sincronización pendiente |
| Exportación | Frontend: Moodle XML y ZIP QTI 2.1. API de demo: Moodle XML de recursos aprobados | Exportación de la interfaz y API de recursos son recorridos distintos; no están sincronizados |
| Indicadores | I2, I3, I5, I22 e I23 calculados localmente; otros valores de ejemplo o pendientes | No representan métricas de un piloto con estudiantes |

## Backend hexagonal

La estructura de EN-004 es `backend/plataforma5e/`:

- `domain/`: entidades y errores propios. No importa aplicación, adaptadores, FastAPI ni SQLAlchemy.
- `application/ports/`: contratos de repositorios y `ExportadorPort`.
- `application/services/`: reglas de recursos, configuración y generación; no importa adaptadores ni frameworks.
- `application/use_cases/`: `RevisarAlternativa`, `AprobarRecurso` y `ExportarAprobados`.
- `adapters/inbound/`: rutas HTTP, contratos Pydantic en `contratos/`, autorización y manejadores de errores.
  No importa SQLAlchemy. Las rutas de configuración consultan el servicio, sin acceder a su repositorio.
- `adapters/outbound/persistence/`: repositorios SQLAlchemy y traducción de errores de persistencia.
- `adapters/outbound/exportacion/`: plantilla fija de Moodle XML; escapa el título y conserva el HTML de los campos.
- `bootstrap/`: crea los adaptadores, inyecta servicios y casos de uso y registra routers y manejadores.

Configuración recibe el correo y la clave de demostración desde bootstrap mediante
`EP002_DOCENTE_EMAIL` y `EP002_DOCENTE_PASSWORD`. El servicio no lee variables de entorno.
El repositorio de configuración recibe el catálogo de generación por constructor; no crea otro repositorio.

Una decisión debe ser `aceptar`, `descartar` o `editar`. Los recursos inexistentes producen 404.
La aprobación permanece bloqueada con alternativas pendientes y la exportación rechaza una lista sin aprobados.
Los valores de evidencia del dominio empiezan vacíos: no se inventa el fragmento `chunk-001`.

## API y contratos

Swagger está en `http://localhost:8000/docs`; OpenAPI está en `/openapi.json` y en
[openapi.json](openapi.json). El esquema HTTP Bearer `SesionDocente` permite autorizar con el token obtenido
al iniciar sesión. La cuenta predeterminada es pública y exclusiva de la demo.

| URL con prefijo `/api/v1` | Operación |
|---|---|
| `/sesiones` y `/sesiones/actual` | POST login; GET sesión; DELETE cierre |
| `/cursos` y `/cursos/{id}` | GET lista; POST creación; PUT edición |
| `/documentos` y `/documentos/{id}` | GET lista; POST multipart con archivo y contexto; DELETE eliminación |
| `/documentos/{id}/archivo` | GET archivo original |
| `/generaciones` y `/generaciones/{id}` | POST propuesta de demo; GET recuperación |
| `/solicitudes` | GET historial autenticado |
| `/recursos/generar` y `/recursos/{id}` | POST reinicio de recursos de demo; GET recurso |
| `/recursos/{id}/alternativas/{letra}/decision` | POST revisión de alternativa |
| `/recursos/{id}/aprobar` | POST aprobación explícita |
| `/exportaciones` | POST Moodle XML de aprobados |

Los contratos 5E están en `backend/plataforma5e/adapters/inbound/contratos/`.
Desde `backend/`, `python scripts/export_contracts.py` regenera sus JSON Schema en `docs/contratos/`.
`pytest tests/unit/test_contratos_5e.py` comprueba aceptación y rechazo de evidencia incompleta.

## Frontend y puntos de integración

Las pantallas leen el store con `useAppState` y escriben mediante servicios. Los selectores devuelven referencias
estables; los arreglos derivados se calculan con `useMemo`. `services/index.ts` conserva las firmas públicas.

| Servicio | Origen actual |
|---|---|
| `sessionService`, `courseService` | Sesión y cursos locales o conectados |
| `materialService` | Registro local o almacenamiento real por API según el modo |
| `generationApiService`, `configurationApiService` | Solicitudes, propuestas de demo e historial mediante HTTP |
| `chatService`, `preferencesService` | Interpretación por reglas y preferencias locales |
| `reviewService`, `exportService` | Decisiones locales y archivos construidos en el navegador |
| `indicatorService` | Indicadores locales, de ejemplo o pendientes |

El store conserva metadatos, preferencias y decisiones en `localStorage`; no guarda bytes de archivos.
La sesión conectada usa `sessionStorage`. El estado local y la caché conectada permanecen separados.
Una edición no aprueba un recurso. Solo la acción docente de aprobar lo vuelve exportable.

## Diseño y convenciones

El diseño de referencia está en `documentos/Sistema_de_Diseno_UI.docx`. Se conservan tokens de
`frontend/src/styles/tokens.css`, componentes compartidos en `components/ui.tsx` e iconos de trazo.
Fraunces se usa para títulos y Public Sans para texto. Hay etiquetas visibles, foco visible y controles de 44 px.
La barra lateral pasa a menú bajo 960 px. Los textos y comentarios se escriben en español.

Antes de modificar requisitos, consultar el backlog, planificación, Charter, Inception y Product Discovery de
`documentos/`. Se continúa sobre el código existente. Las decisiones y su estado se registran en
[decisiones-tecnicas.md](decisiones-tecnicas.md); los cambios visuales requieren revisar el sistema de diseño.
No se atribuyen aprobaciones académicas ni pruebas con docentes sin evidencia.

## Persistencia y entorno

El backend usa SQLite por defecto (`sqlite:///./demo.db`) y admite PostgreSQL con
`DATABASE_URL=postgresql+psycopg://...`. La URL `postgres://...` de `.env.example` corresponde al entorno
de dbmate y no se utiliza directamente para SQLAlchemy. La configuración se establece en la terminal del backend.
Las dependencias del backend se definen en `backend/pyproject.toml`.

El entorno de EN-011 en `db/` usa PostgreSQL 17 y pgvector 0.8.1, migraciones dbmate, fragmentos de 768
dimensiones e índices HNSW y GIN. Es distinto del almacenamiento de demo por defecto. Ver
[la guía de base de datos](../db/README.md). Las migraciones y `db/schema.sql` no se modifican en esta limpieza.
No se editarán migraciones ya aplicadas; los futuros cambios de esquema requieren una nueva migración.

## Ejecución y verificación

Desde `backend/`, con Python 3.11 o superior:

```bash
python -m venv .venv
# PowerShell: .\.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn plataforma5e.bootstrap.app:crear_aplicacion --factory --reload --port 8000
```

Desde `frontend/`, en otra terminal:

```bash
npm ci
npm run dev
```

Comprobaciones antes de entregar:

```bash
# En frontend/
npm run typecheck
npm test
npm run build
npm run test:e2e
# En backend/, con .venv activo
pytest
pytest tests/unit tests/arquitectura tests/integration --cov=plataforma5e.domain --cov=plataforma5e.application --cov-fail-under=80
```

Las pruebas e2e del backend usan HTTP y una BD temporal SQLite, o PostgreSQL si se define `E2E_DATABASE_URL`
para una base exclusiva de pruebas. No debe apuntar a datos de trabajo. La prueba de arquitectura analiza con AST
todos los archivos Python de dominio, aplicación y adaptadores de entrada.

Las capturas nuevas se generan en `frontend/test-results/`, excluido por Git, y se adjuntan a Notion.
Los informes de avance y las validaciones académicas también se conservan en Notion.

## Pendientes y límites

Ingesta y segmentación reales, embeddings, recuperación híbrida, RAG, generación y regeneración con modelos,
autenticación de producción, sincronización de decisiones y exportaciones, importación LMS y mediciones del piloto.
Faltan validación con docentes, lectores de pantalla y pruebas amplias de rendimiento. Las solicitudes rechazadas
no aparecen en el historial. La carga simulada interrumpida por recarga queda en error y permite reintento.

## Investigaciones y antecedentes

- [SP-001](spikes/SP-001-modelos-embeddings.md): propuesta de embeddings; no añade procesamiento real.
- [SP-002](spikes/SP-002-modelos-por-tipo-de-recurso.md): propuesta de modelos por tipo de recurso; estimaciones,
  no mediciones de generación con docentes.
- [SP-003](spikes/SP-003-formatos-de-exportacion.md): Moodle XML para Moodle y ZIP QTI 2.1 para Chamilo.
- HU-045 y HU-046: sesión, catálogo y chat locales publicados; sus registros de avance están en Notion.
- HU-053 y EP-002: solicitudes, sesión, cursos, archivos e historial conectados; mantienen ejemplos preparados.
- HU-054: recorrido enlazado, secuencia, versiones y exportación local en los dos formatos seleccionados.

Las verificaciones históricas de interfaz, contraste y base vectorial se conservan como antecedentes en Notion;
no se presentan como nuevas mediciones del Sprint ni como aprobación académica.
