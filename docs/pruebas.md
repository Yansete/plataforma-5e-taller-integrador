# Pruebas del proyecto

**Responsable:** Juan Alegria (TA-001, TA-007, TA-008) · **Última actualización:** 10/10/2026

Este documento responde a la pregunta del asesor: *«Si van a hacer casos de prueba, por ejemplo una prueba
unitaria, ¿cuál es el directorio?»*. Cada tipo de prueba tiene su carpeta y las pruebas corren solas en GitHub
Actions en cada `push` (archivo `.github/workflows/ci.yml`, pestaña **Actions** del repositorio).

## Dónde va cada prueba

```
backend/tests/
├── unit/                    Pruebas unitarias, sin base de datos ni red
│   ├── test_servicios_aplicacion.py             Capa de servicios con puertos falsos en memoria
│   ├── test_contratos_5e.py                     Contratos de generación (pydantic)
│   ├── test_revision_exportacion.py             Reglas de revisión y exportación
│   ├── test_recurso_unit.py                     Entidad del dominio
│   ├── test_configuracion_limites.py            Límites de la configuración
│   ├── test_cursos_con_sumilla_y_resultados.py  Sumilla, logro y resultados de aprendizaje del curso
│   ├── test_material_y_recuperacion.py          Ingesta: limpiar y fragmentar el texto; búsqueda de evidencia (BM25)
│   ├── test_material_service.py                 Procesar documentos y crear material desde un tema
│   ├── test_generacion_con_material.py          Generación con el material del docente: citas, respaldo, validación
│   └── test_adaptadores_material_ia.py          Lectura de PDF, PPTX y TXT; Wikipedia e IA con HTTP simulado;
│                                                generador por reglas
├── arquitectura/            Vigila la regla de dependencia entre las capas hexagonales (análisis del código)
├── integration/             Adaptadores de persistencia contra una base real y traducción de sus errores
├── e2e/                     Punta a punta: servidor uvicorn real, por HTTP, con SQLite o PostgreSQL
│   ├── conftest.py                    Levanta y apaga el servidor en un puerto libre (TA-007)
│   ├── test_demo_punta_a_punta.py     Historia de la demo (HU-043) y fidelidad del XML exportado (TA-007)
│   ├── validador_moodle_xml.py        Reglas de la muestra que Moodle importó en SP-003 (TA-007)
│   ├── test_validador_moodle_xml.py   Controles del validador (TA-007)
│   ├── test_configuracion_ep002.py    Configuración del docente (EP-002)
│   ├── test_generacion_hu053.py       Generación desde la configuración (HU-053)
│   ├── test_material_real.py          Material real: subir, procesar, ver fragmentos y generar con citas
│   └── test_errores_recursos.py       Errores de la API de recursos
└── data/                    Archivos de referencia (muestra_moodle_verificada.xml)

frontend/
├── src/**/*.test.ts         Pruebas unitarias (vitest), junto al código que prueban
└── e2e/*.spec.ts            Punta a punta en el navegador (Playwright + Chromium)
    ├── recorrido, hu045, hu046, hu054             Prototipo con datos de demostración (corren en la CI)
    └── hu053-api, ep002-api, material-real-api    Interfaz contra el backend real (aún no corren en la CI)
```

| Tipo | Qué comprueba | Dónde | Comando |
|---|---|---|---|
| Unitaria | Una pieza aislada: entidad, contrato, servicio, adaptador | `backend/tests/unit`, `frontend/src/**/*.test.ts` | `pytest tests/unit` · `npm test` |
| Arquitectura | Que las capas respeten la regla de dependencia | `backend/tests/arquitectura` | `pytest tests/arquitectura` |
| Integración | Los adaptadores de persistencia con una base real | `backend/tests/integration` | `pytest tests/integration` |
| Punta a punta (backend) | Historias completas contra el servidor real y fidelidad del XML exportado (I19) | `backend/tests/e2e` | `pytest tests/e2e` |
| Punta a punta (frontend) | El recorrido del docente en el navegador | `frontend/e2e` | `npm run test:e2e` |
| Punta a punta (sistema completo) | La interfaz contra el backend real, desde el curso hasta la descarga | `frontend/e2e/*-api.spec.ts` | `npm run test:api:e2e` |
| Cobertura (caja blanca) | Qué parte del código ejecutan las pruebas; falla si baja del umbral | La CI y `frontend/coverage/` | `npm run test:cobertura` · `pytest --cov` |
| Prueba manual con IA real | Que el proveedor configurado responda en el sistema publicado | Sistema desplegado | Ver «Prueba manual después del despliegue» |
| Caja negra, carga, concurrencia y disponibilidad | Sistema desplegado y bajo carga | Sprint 2 (TA-005) | — |

### Pruebas sin red ni clave de IA

Las pruebas automáticas no llaman a servicios externos. Las de punta a punta levantan el backend con
`IA_PROVEEDOR=reglas` (generador por reglas, sin IA) y `BUSQUEDA_POR_TEMA=false`, y las llamadas a Gemini,
Anthropic, OpenAI y Wikipedia se prueban con respuestas HTTP simuladas (`httpx.MockTransport`) en
`test_adaptadores_material_ia.py`. Así las pruebas no gastan cuota, no dependen de internet y nunca necesitan la
clave. Que el proveedor real responda se comprueba a mano en el sistema publicado (ver más abajo).

## Cómo correrlas en local

Backend (desde `backend/`, con el entorno virtual activado):

```bash
pip install -e ".[dev]"
python -m pytest                      # todas
python -m pytest tests/e2e -v         # solo punta a punta (levanta su propio servidor)
```

Para la punta a punta contra PostgreSQL, con una base **vacía** creada para esto:

```bash
E2E_DATABASE_URL=postgresql+psycopg://plataforma:plataforma@localhost:5432/plataforma5e python -m pytest tests/e2e
```

En PowerShell: `$env:E2E_DATABASE_URL="postgresql+psycopg://..."; python -m pytest tests/e2e`.

Frontend (desde `frontend/`):

```bash
npm install
npm test                          # unitarias
npx playwright install chromium   # solo la primera vez
npm run test:e2e                  # navegador con datos de demostración (levanta Vite en el puerto 5174)
npm run test:api:e2e              # navegador contra el backend real (levanta Vite y uvicorn)
```

`test:api:e2e` usa el Python que tenga instalado el backend. Si no es el `python` por defecto, indícalo con la
variable `HU053_PYTHON` (por ejemplo, la ruta del Python del entorno virtual de `backend/`). El recorrido completo
(`material-real-api.spec.ts`) guarda capturas y la secuencia descargada en `frontend/test-results/material-real/`.

Revisar un XML antes de importarlo en Moodle (desde `backend/`):

```bash
python -m tests.e2e.validador_moodle_xml salida_demo/archivo.xml
```

## Cobertura (caja blanca, TA-008)

La cobertura mide qué líneas, funciones y ramas del código ejecutan las pruebas. Es la prueba de caja blanca:
mira el código por dentro y señala lo que ninguna prueba recorre.

| Parte | Qué se mide | Umbral mínimo | Medido el 10/10/2026 |
|---|---|---|---|
| Backend | `plataforma5e/domain` y `plataforma5e/application` (reglas y servicios) | 80 % | 98,7 % |
| Frontend | `src/services`, `src/store`, `src/utils` | 80 % en líneas, sentencias y funciones; 70 % en ramas | 87,4 % en líneas, 84,1 % en funciones, 82,3 % en ramas |

Si un cambio hace bajar la cobertura del umbral, la CI marca el commit en rojo. Dónde ver el detalle:

- En GitHub, en cada ejecución de **Actions** aparece la tabla de cobertura en el resumen (*Summary*), y los
  reportes se descargan como `cobertura-frontend` y `reportes-pytest`.
- En local:

```bash
# Frontend (desde frontend/)
npm run test:cobertura            # luego abre coverage/index.html

# Backend (desde backend/)
python -m pytest tests/unit tests/arquitectura tests/integration --cov=plataforma5e.domain --cov=plataforma5e.application --cov-report=term-missing
```

## Qué hace la integración continua

| Trabajo | Pasos |
|---|---|
| Frontend | `npm ci` → tipos → unitarias con cobertura → build → Playwright con datos de demostración |
| Backend | unitarias y arquitectura → integración → cobertura → punta a punta con SQLite → punta a punta con PostgreSQL 16 |

PostgreSQL se descarga del espejo público de Amazon ECR para evitar el límite de descargas de Docker Hub.
Si el commit rompe algo, GitHub lo marca con ✗ y guarda los reportes (`reportes-pytest`, `cobertura-frontend`,
`informe-playwright`). Si alguna vez falta `backend/pyproject.toml`, el trabajo del backend se omite con un aviso.

**Pendiente (TA-002, Sprint 2):** llevar a la CI las pruebas de la interfaz contra el backend real
(`npm run test:api:e2e`, incluido el recorrido con material real).

## Prueba manual después del despliegue

Se hace en el enlace de Vercel, con el backend de Render configurado (ver [despliegue.md](despliegue.md)), y se
anota el resultado en el acta de la semana:

1. Abrir `https://<servicio>.onrender.com/api/v1/ia`: debe indicar el proveedor y el modelo configurados
   (por ejemplo, `Gemini · gemini-3.8-flash`). Si dice «Generador por reglas», falta la clave o el proveedor.
2. En la plataforma, modo servidor: crear un curso con un resultado de aprendizaje, subir un PDF con texto (o
   buscar el tema) y comprobar que aparecen fragmentos.
3. Generar un ítem de opción múltiple: el aviso debe decir «Generado con <proveedor> a partir de N fragmento(s)».
4. En Revisión, comprobar que cada cita lleva a un fragmento del material; aprobar y descargar el Moodle XML y la
   secuencia (.html).
5. Validar el XML descargado con `python -m tests.e2e.validador_moodle_xml <archivo.xml>` antes de importarlo en Moodle.

## Última verificación: 10/10/2026, copia limpia de `main` con los cambios del flujo real (antes del merge)

- Backend: 144 pruebas superadas (99 unitarias, 9 de arquitectura, 5 de integración y 31 de punta a punta). Las
  de punta a punta pasaron con SQLite y con PostgreSQL 16. Cobertura de dominio y servicios: 98,7 %.
- Frontend: 70 pruebas unitarias (87,4 % de las líneas y 84,1 % de las funciones cubiertas). Pasaron 8 pruebas en
  navegador con datos de demostración y 5 contra el backend real, entre ellas el recorrido completo: curso con
  sumilla y resultados → material procesado → generación citada → revisión → Moodle XML y secuencia (.html).
  Tipos y build sin errores.
- No cubierto por estas pruebas: las respuestas reales de los proveedores de IA y de Wikipedia (se simulan) y la
  ejecución de la CI en GitHub para esta rama, que se verá al subirla.

## Historial

- 10/10/2026 sobre `main` (antes del flujo real): 75 pruebas del backend y 64 unitarias del frontend; 8 en
  navegador con datos de demostración y 4 contra el backend real.
- Control de calidad de TA-007 (09/10): se rompió a propósito el exportador de tres formas (clave sin puntaje,
  exportar distractores descartados, quitar la retroalimentación) y la prueba falló en los tres casos.
- TA-008 (09/10): se comprobó que la CI falla si se exige un umbral de cobertura mayor al alcanzado.
- La CI de TA-001 y TA-008 corrió en verde en GitHub (ejecuciones #3 y #6 de «Pruebas»).
