# Plataforma de generación asistida de contenido educativo — Frontend de demostración y Backend Base

Proyecto del curso **Taller Integrador 1** (UPAO, 2026-II). Plataforma que, a partir del material del docente, propone
recursos para una secuencia didáctica del modelo **5E**, con **revisión docente obligatoria**, **trazabilidad a la
evidencia de origen** y exportación de lo aprobado a **Moodle (Moodle XML)** y **Chamilo (QTI 2.1)**.

> **Estado actual:** frontend interactivo y backend hexagonal (FastAPI y SQLAlchemy). En modo servidor el sistema procesa el
> material real del docente (PDF, PPTX o TXT, o artículos de Wikipedia buscados por tema), recupera los fragmentos
> relacionados y genera recursos de las cinco etapas 5E que citan su evidencia, con IA si hay clave o con reglas si no.
> La base vectorial con pgvector (EN-011) está lista para la búsqueda por significado del Sprint 2.

Enlace: https://plataforma-5e-taller-integrador.vercel.app/

## Demo rápida

Dos terminales desde la raíz del repositorio. El backend usa SQLite por defecto (no requiere Docker).

```bash
# Terminal 1 · backend (FastAPI)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn plataforma5e.bootstrap.app:crear_aplicacion --factory --port 8000

# Terminal 2 · frontend (React + Vite)
cd frontend
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) e inicia sesión con `docente@5e.demo` / `Demo5E!2026` (cuenta pública de
demostración). En **Modo de acceso** elige **Servidor de la plataforma (backend)** para guardar cursos, archivos e historial en
el backend, o **Prototipo local** para usar solo el navegador (no necesita la terminal 1).

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

pip install -e ".[dev]"    # dependencias del backend y de las pruebas
uvicorn plataforma5e.bootstrap.app:crear_aplicacion --factory --reload --port 8000
```

* **Swagger UI:** Documentación interactiva disponible en [http://localhost:8000/docs](http://localhost:8000/docs).
* **Contrato OpenAPI:** Archivo estático versionado en [`docs/openapi.json`](docs/openapi.json).

Otros comandos (dentro de `backend/`):

| Comando                       | Qué hace                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `pytest`                    | Ejecuta la suite completa de pruebas (unitarias, arquitectura, integración y e2e) |
| `pytest tests/unit`         | Ejecuta exclusivamente las pruebas de dominio unitarias                            |
| `pytest tests/arquitectura` | Valida el aislamiento y las reglas de capas de la arquitectura hexagonal           |
| `pytest tests/integration`  | Valida los repositorios y la persistencia ORM con la base de datos                 |
| `pytest tests/e2e`          | Ejecuta pruebas HTTP y XML; SQLite temporal por defecto, PostgreSQL configurable             |

## Cómo probar el recorrido

El menú lateral sigue los pasos del docente. Cada pantalla tiene un botón para avanzar al siguiente.

1. **Cursos y unidades**: crea o edita un curso y sus unidades. Luego «Continuar a carga de material».
2. **Carga de material** (paso 1): registra un PDF, PPTX o TXT con su contexto. En modo backend el servidor extrae el texto y
   lo parte en fragmentos («Ver fragmentos» muestra lo que la generación puede citar). Sin material propio, «Busca el tema»
   trae artículos de Wikipedia y los procesa igual.
3. **Solicitud** (paso 2): pide recursos con los **selectores** de Configuración o con la **solicitud por chat**, que muestra
   la interpretación para que la corrijas antes de continuar. En modo backend se genera con tu material; en el prototipo
   local, con ejemplos preparados.
4. **Secuencia 5E** (paso 3): tablero con las cinco etapas de la unidad, sus recursos y su estado de revisión.
5. **Revisión docente** (paso 4): revisa cada recurso con la evidencia citada. Acepta, edita o descarta cada distractor (el
   descarte pide un motivo) y aprueba. «Regenerar» propone otra versión y conserva la anterior, que puedes restaurar.
6. **Exportación** (paso 5): elige **Moodle** (Moodle XML) o **Chamilo** (paquete QTI 2.1 en ZIP), exporta los ítems aprobados y
   descarga el archivo. «Descargar secuencia (.html)» reúne todos los recursos aprobados, de cualquier tipo, con su evidencia.
7. **Indicadores**: valores calculados con tus decisiones, ejemplos y pendientes.
8. **Restablecer demo** (barra lateral): vuelve al estado inicial.

Tus decisiones se conservan al recargar la página (F5). Con la ventana estrecha, la barra lateral se convierte en un menú.

## Base de datos local (PostgreSQL + pgvector) y Almacenamiento

Requiere **Docker Desktop** abierto. Desde la raíz del repositorio:

```bash
cp .env.example .env
docker compose up -d --wait db        # PostgreSQL 17 con pgvector
docker compose run --rm dbmate up     # aplica las migraciones
./db/verificacion/verificar.sh        # comprueba la extensión y los índices (EN-011)
```

Detalles, comandos y estructura de las migraciones en [db/README.md](db/README.md).

### Dónde se guardan los datos y archivos

* **Datos y Embeddings (PostgreSQL):** La información relacional (recursos pedagógicos, opciones, revisiones) e índices vectoriales de los fragmentos se almacenan en el contenedor de **PostgreSQL 17** gestionado por Docker, persistiendo en el volumen local `datos-postgres`.
* **Archivos del docente y fragmentos:** en modo backend, los PDF, PPTX y TXT y sus fragmentos se guardan en la base de datos del backend (SQLite por defecto o PostgreSQL con `DATABASE_URL`). Los embeddings en pgvector son el siguiente paso (EN-013).

## Estructura

```
taller-integrador/
├── backend/               Backend en FastAPI (Arquitectura Hexagonal)
│   ├── plataforma5e/      Módulos del backend
│   │   ├── domain/        Entidades nucleares y reglas pedagógicas puras
│   │   ├── application/   Puertos, servicios y casos de uso
│   │   ├── adapters/      Rutas y contratos en inbound/; persistencia y exportación en outbound/
│   │   └── bootstrap/     Factoría de aplicación e inyección de dependencias
│   └── tests/             Suites de pruebas (unit, arquitectura, integration, e2e)
├── documentos/            Documentos del curso (solo lectura)
├── db/                    Base de datos local: migraciones (dbmate), esquema y verificación
├── docs/                  Documentación técnica y especificación OpenAPI (openapi.json)
├── frontend/              Aplicación React + TypeScript + Vite
│   └── src/
│       ├── components/    Componentes reutilizables (sistema de diseño)
│       ├── pages/         Pantallas del recorrido (+ página 404)
│       ├── services/      Servicios: llaman al backend o simulan lo que aún no existe
│       ├── store/         Estado local y persistencia en localStorage
│       ├── data/          Datos de demostración y catálogos
│       ├── types/         Modelos de datos
│       ├── styles/        tokens.css (variables) y base.css
│       └── utils/         Formato de fechas y números
├── spikes/                Experimentos aislados (no son código de producción)
├── docker-compose.yml     PostgreSQL + pgvector y dbmate
├── .env.example           Variables de entorno locales (copiar como .env)
└── README.md
```

## Generación con IA

Sin configuración, el backend usa el **generador por reglas**: arma los recursos con oraciones y términos del material, sin
inventar nada. Para redactar con un modelo de lenguaje, define en la terminal del backend (o en el servidor):

```bash
IA_PROVEEDOR=gemini        # gemini, anthropic u openai (o compatible, con IA_URL_BASE)
IA_API_KEY=tu-clave        # nunca se sube al repositorio
IA_MODELO=gemini-3.8-flash # opcional
```

`GET /api/v1/ia` indica qué generador está activo. Si el proveedor falla (clave inválida o límite de uso), la generación
usa el generador por reglas y lo avisa. El despliegue completo (Vercel, Render y Neon) está en
[docs/despliegue.md](docs/despliegue.md).

## Documentación

* [Arquitectura y estado del proyecto](docs/arquitectura.md): capas, contratos, integración, límites y ejecución.
* [Decisiones técnicas](docs/decisiones-tecnicas.md): decisiones, motivos, contradicciones y vacíos detectados.
* [Formatos de exportación SP-003](docs/spikes/SP-003-formatos-de-exportacion.md): Moodle XML y QTI 2.1, validación LMS pendiente.
* [Despliegue](docs/despliegue.md): Vercel, Render y Neon, variables de entorno y problemas frecuentes.
* [Pruebas](docs/pruebas.md): dónde va cada tipo de prueba y cómo correrlas.
* [Guía de Git y GitHub](docs/guia-git.md): pasos para versionar y subir el proyecto.
* [Especificación OpenAPI](docs/openapi.json): especificación contractual generada del backend.

## Equipo

| Integrante | Usuario en GitHub | Responsabilidad principal |
|---|---|---|
| Juan Alegria Sagastegui | `iamjuanyouarenot` | Product Owner, pruebas y medición; agentes de Elaborar y Evaluar |
| Silvana Diaz Calderon | `SilvanaD12` | EP-002 Configuración del docente y diseño de la interfaz |
| Yan Liu Dai | `Yansete` | EP-003 Creación por etapa 5E, ingesta y RAG, despliegue del frontend |
| Sergio Celi Vertiz | `sceliv` | EP-004 Integración y tipología, arquitectura del backend |
