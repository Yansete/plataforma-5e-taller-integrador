# Plataforma de generación asistida de contenido educativo — Frontend de demostración y Backend Base

Proyecto del curso **Taller Integrador 1** (UPAO, 2026-II). Plataforma que, a partir del material del docente, propone
recursos para una secuencia didáctica del modelo **5E**, con **revisión docente obligatoria**, **trazabilidad a la
evidencia de origen** y exportación futura a estándares (QTI, SCORM, IMS Common Cartridge, Moodle XML).

> **Estado actual:** El repositorio cuenta con el **frontend** interactivo, la base de datos local en **PostgreSQL 17 + pgvector**, y el **backend base** consolidado bajo Arquitectura Hexagonal con FastAPI y SQLAlchemy.

## Requisitos

- **Node.js 18 o superior** (recomendado: Node.js 22 LTS). Descárgalo de [https://nodejs.org](https://nodejs.org) e instálalo con las opciones por defecto.
- **Python 3.11 o superior** (para el entorno del backend).
- **Docker Desktop** (requerido para la base de datos PostgreSQL + pgvector).
- Un navegador moderno (Chrome, Edge o Firefox).
- Conexión a internet solo para instalar dependencias y cargar las fuentes de Google Fonts (sin conexión la interfaz usa Georgia y Segoe UI).

Comprueba la instalación en una terminal nueva:

```bash
node --version   # debe mostrar v18 o superior
npm --version
python --version # debe mostrar 3.11 o superior
```

## Instalación y ejecución

### Frontend

```bash
cd frontend
npm install        # instala dependencias (solo la primera vez o si cambia package.json)
npm run dev        # abre el servidor de desarrollo
```

Abre en el navegador la dirección que muestra la terminal (normalmente [http://localhost:5173](http://localhost:5173)). Para detenerlo, pulsa `Ctrl + C`.

Otros comandos (dentro de `frontend/`):

| Comando               | Qué hace                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run build`     | Comprueba los tipos y genera la versión de producción en`frontend/dist/`                                       |
| `npm run preview`   | Sirve la versión de producción en[http://localhost:4173](http://localhost:4173) (ejecuta antes `npm run build`) |
| `npm run typecheck` | Solo comprueba los tipos de TypeScript                                                                             |
| `npm test`          | Ejecuta las pruebas automáticas de los servicios                                                                  |

### Backend

```bash
cd backend
python -m venv .venv
# Activar entorno virtual:
# En Windows (PowerShell): .\.venv\Scripts\Activate.ps1
# En Linux/macOS: source .venv/bin/activate

pip install -e .    # instala dependencias del backend
uvicorn plataforma5e.bootstrap.app:crear_aplicacion --reload --port 8000
```

* **Swagger UI:** Documentación interactiva disponible en [http://localhost:8000/docs](http://localhost:8000/docs).
* **Contrato OpenAPI:** Archivo estático versionado en [`docs/openapi.json`](https://www.google.com/search?q=docs/openapi.json).

Otros comandos (dentro de `backend/`):

| Comando                       | Qué hace                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `pytest`                    | Ejecuta la suite completa de pruebas (unitarias, arquitectura, integración y e2e) |
| `pytest tests/unit`         | Ejecuta exclusivamente las pruebas de dominio unitarias                            |
| `pytest tests/arquitectura` | Valida el aislamiento y las reglas de capas de la arquitectura hexagonal           |
| `pytest tests/integration`  | Valida los repositorios y la persistencia ORM con la base de datos                 |
| `pytest tests/e2e`          | Ejecuta las pruebas punta a punta contra PostgreSQL y exportación XML             |

## Cómo probar el recorrido

HU-045 incorpora /login y /cursos. Accede con `docente@5e.demo` / `Demo5E!2026` (credenciales públicas de demostración). Crea o edita cursos y unidades y pulsa «Continuar al inicio». La autenticación es simulada y el catálogo se guarda localmente. Evidencias y límites en `docs/HU-045-Notion.md`.


1. **Inicio**: revisa el resumen. Hay 3 documentos de demostración y 4 ítems en revisión; ninguno aprobado.
2. **Revisión docente** (paso 3): elige un ítem. Intenta «Aprobar recurso»: se bloquea hasta decidir cada distractor.
   Acepta, edita o descarta cada distractor (el descarte pide un motivo) y luego aprueba.
   En «Estructura para los trabajos de impresión» verás una advertencia simulada del filtro de fiabilidad.
3. **Recarga la página** (F5): tus decisiones se conservan.
4. **Exportación** (paso 4): solo aparecen los recursos aprobados. Selecciónalos, elige un formato y pulsa
   «Exportar selección (simulado)». La validación y la importación quedan como *pendientes*. Puedes descargar un
   resumen JSON que **no** es un paquete importable.
5. **Configuración** (paso 2): genera recursos de otra etapa (por ejemplo, Enganchar de la Unidad 2). Prueba también una
   combinación sin ejemplos (Unidad 3 + Enganchar) para ver el rechazo simulado.
6. **Carga de material** (paso 1): selecciona un PDF, PPTX o TXT, completa el contexto y registra. Observa el
   procesamiento simulado y el estado de error (activa «Simular un fallo» en *Opciones de la demostración*).
7. **Indicadores**: compara valores calculados localmente, ejemplos y pendientes; usa los filtros y la vista de tabla.
8. **Restablecer demo** (barra lateral): vuelve al estado inicial.

Prueba también con la ventana estrecha (o las herramientas de desarrollo del navegador en modo móvil): la barra lateral
se convierte en un menú.

## Base de datos local (PostgreSQL + pgvector) y Almacenamiento

Requiere **Docker Desktop** abierto. Desde la raíz del repositorio:

```bash
cp .env.example .env
docker compose up -d --wait db        # PostgreSQL 17 con pgvector
docker compose run --rm dbmate up     # aplica las migraciones
./db/verificacion/verificar.sh        # comprueba la extensión y los índices (EN-011)
```

Detalles, comandos y estructura de las migraciones en [db/README.md](https://www.google.com/search?q=db/README.md).

### Dónde se guardan los datos y archivos

* **Datos y Embeddings (PostgreSQL):** La información relacional (recursos pedagógicos, opciones, revisiones) e índices vectoriales de los fragmentos se almacenan en el contenedor de **PostgreSQL 17** gestionado por Docker, persistiendo en el volumen local `db_data`.
* **Archivos del docente:** Los documentos fuente subidos por el docente (PDF, PPTX, TXT) se gestionan localmente en el volumen de almacenamiento persistente montado en el servidor/contenedor bajo el directorio de ingestión del sistema, desde donde se procesan los fragmentos citados.

## Estructura

```
taller-integrador/
├── backend/               Backend en FastAPI (Arquitectura Hexagonal)
│   ├── app/contracts/     Modelos de validación y contratos Pydantic v2
│   ├── plataforma5e/      Módulos del backend
│   │   ├── domain/        Entidades nucleares y reglas pedagógicas puras
│   │   ├── application/   Puertos (ports/) y casos de uso (use_cases/)
│   │   ├── adapters/      Adaptadores REST (inbound) y persistencia ORM (outbound)
│   │   └── bootstrap/     Factoría de aplicación e inyección de dependencias
│   └── tests/             Suites de pruebas (unit, arquitectura, integration, e2e)
├── documentos/            Documentos del curso (solo lectura)
├── db/                    Base de datos local: migraciones (dbmate), esquema y verificación
├── docs/                  Documentación técnica y especificación OpenAPI (openapi.json)
├── frontend/              Aplicación React + TypeScript + Vite
│   └── src/
│       ├── components/    Componentes reutilizables (sistema de diseño)
│       ├── pages/         Las seis pantallas (+ página 404)
│       ├── services/      Servicios simulados (se sustituirán por el backend)
│       ├── store/         Estado local y persistencia en localStorage
│       ├── data/          Datos de demostración y catálogos
│       ├── types/         Modelos de datos
│       ├── styles/        tokens.css (variables) y base.css
│       └── utils/         Formato de fechas y números
├── spikes/                Experimentos aislados (no son código de producción)
├── docker-compose.yml     PostgreSQL + pgvector y dbmate
├── .env.example           Variables de entorno locales (copiar como .env)
├── CLAUDE.md              Contexto técnico para retomar el trabajo
└── README.md
```

## Documentación

* [Estado del proyecto](https://www.google.com/search?q=docs/estado-del-proyecto.md): qué funciona, qué está simulado y qué falta.
* [Decisiones técnicas](https://www.google.com/search?q=docs/decisiones-tecnicas.md): decisiones, motivos, contradicciones y vacíos detectados.
* [Integración con el backend](https://www.google.com/search?q=docs/integracion-backend.md): modelos, contratos propuestos y puntos de sustitución.
* [Guía de Git y GitHub](https://www.google.com/search?q=docs/guia-git.md): pasos para versionar y subir el proyecto.
* [Especificación OpenAPI](https://www.google.com/search?q=docs/openapi.json): especificación contractual generada del backend.

## Equipo

Juan Alegria · Silvana Diaz · Yan Liu Dai · Sergio Celi.
