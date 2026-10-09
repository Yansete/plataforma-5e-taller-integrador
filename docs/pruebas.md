# Pruebas del proyecto

**Responsable:** Juan Alegria (TA-001, TA-007) · **Última actualización:** 09/10/2026

Este documento responde a la pregunta del asesor: *«Si van a hacer casos de prueba, por ejemplo una prueba
unitaria, ¿cuál es el directorio?»*. Cada tipo de prueba tiene su carpeta y todas corren solas en GitHub Actions
en cada `push` (archivo `.github/workflows/ci.yml`, pestaña **Actions** del repositorio).

## Dónde va cada prueba

```
backend/tests/
├── unit/                    Pruebas unitarias, una carpeta por capa de la arquitectura hexagonal
│   ├── domain/              Reglas del dominio, sin base de datos ni HTTP (p. ej. «una sola clave»)
│   ├── application/         Casos de uso (capa de servicios) con dobles de los puertos
│   └── adapters/            Cada adaptador por separado: exportador Moodle XML, recuperador…
├── arquitectura/            Vigila la regla de dependencia: el dominio no importa frameworks
├── integration/             La API completa dentro del mismo proceso (TestClient + SQLite en memoria)
├── e2e/                     Punta a punta: servidor uvicorn real, por HTTP, con SQLite o PostgreSQL
│   ├── conftest.py          Levanta y apaga el servidor en un puerto libre
│   ├── validador_moodle_xml.py   Reglas de la muestra que Moodle importó en SP-003
│   └── test_*.py
└── data/                    Archivos de referencia (muestra_moodle_verificada.xml)

frontend/
├── src/**/*.test.ts         Pruebas unitarias (vitest), junto al código que prueban
└── e2e/*.spec.ts            Punta a punta en el navegador (Playwright + Chromium)
```

| Tipo | Qué comprueba | Dónde | Comando |
|---|---|---|---|
| Unitaria | Una pieza aislada: entidad, caso de uso o adaptador | `backend/tests/unit`, `frontend/src/**/*.test.ts` | `pytest tests/unit` · `npm test` |
| Arquitectura | Que las capas respeten la regla de dependencia | `backend/tests/arquitectura` | `pytest tests/arquitectura` |
| Integración | La API con sus casos de uso, dominio y base de datos | `backend/tests/integration` | `pytest tests/integration` |
| Punta a punta (backend) | La historia de la demo contra el servidor real, y la fidelidad del XML exportado (I19) | `backend/tests/e2e` | `pytest tests/e2e` |
| Punta a punta (frontend) | El recorrido del docente en el navegador y las reglas de revisión | `frontend/e2e` | `npm run test:e2e` |
| Caja negra, carga, concurrencia y disponibilidad | Sistema desplegado y bajo carga | Sprint 2 (TA-005) | — |

## Cómo correrlas en local

Backend (desde `backend/`, con el entorno virtual activado):

```bash
pip install -e ".[dev]"
pytest                      # todas
pytest tests/e2e -v         # solo punta a punta (levanta su propio servidor)
```

Para la punta a punta contra PostgreSQL, con una base **vacía** creada para esto:

```bash
pip install -e ".[dev,postgres]"
E2E_DATABASE_URL=postgresql+psycopg://plataforma:plataforma@localhost:5432/plataforma5e pytest tests/e2e
```

En PowerShell: `$env:E2E_DATABASE_URL="postgresql+psycopg://..."; pytest tests/e2e`.

Frontend (desde `frontend/`):

```bash
npm install
npm test                    # unitarias
npx playwright install chromium   # solo la primera vez
npm run test:e2e            # punta a punta (levanta Vite en el puerto 5174)
```

Revisar un XML antes de importarlo en Moodle:

```bash
python -m tests.e2e.validador_moodle_xml salida_demo/archivo.xml
```

## Qué hace la integración continua

| Trabajo | Pasos |
|---|---|
| Frontend | `npm ci` → tipos → unitarias → build → Playwright |
| Backend | unitarias y arquitectura → integración → punta a punta con SQLite → punta a punta con PostgreSQL 16 |

Si el commit rompe algo, GitHub marca el commit con ✗ y guarda los reportes (`reportes-pytest`,
`informe-playwright`) en la ejecución. Si `backend/` todavía no está en el repositorio, ese trabajo se omite
con un aviso, sin fallar.

## Verificado el 09/10/2026 (en local, antes de subir)

- Backend: 79 pruebas superadas (58 unitarias y de arquitectura, 13 de integración, 8 de punta a punta).
- Punta a punta del backend superada con SQLite y con PostgreSQL 16.
- Control de calidad de la prueba: se rompió a propósito el exportador de tres formas (clave sin puntaje,
  exportar distractores descartados, quitar la retroalimentación) y la prueba falló en los tres casos.
- Frontend: 15 pruebas unitarias y 2 de punta a punta superadas; tipos y build sin errores.
- El archivo de GitHub Actions pasó `actionlint`. **Falta verlo correr en GitHub** tras el primer `push`.
