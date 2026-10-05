# CLAUDE.md — Contexto técnico para retomar el trabajo

## Al empezar una sesión

1. Lee, en este orden: `docs/estado-del-proyecto.md`, `docs/decisiones-tecnicas.md`, `docs/integracion-backend.md`.
2. Examina el código existente en `frontend/src/` antes de proponer cambios. **Continúa sobre lo construido**; no rehagas el proyecto.
3. Si la tarea toca requisitos o diseño, consulta los documentos de `documentos/` (solo lectura, no modificarlos):
   - `Sistema_de_Diseno_UI.docx` — **autoridad visual** (colores, tipografía, espacios, componentes).
   - `Product_Backlog_Taller_Integrador (1).xlsx` — historias (HU, EN, TA, SP, RN, DO) y prioridades.
   - `Sprint_Planning_Taller_Integrador_5E_RAG (1).xlsx`, `Project_Charter_Taller_Integrador_1_final (1).docx`,
     `S1_Inception.docx`, `S2_Product_Discovery.docx` (indicadores I1–I23), `Presentacion_de_Avances_v3.docx`.
   - Son .docx/.xlsx: para leerlos sin Office, descomprímelos (son ZIP) y lee `word/document.xml` o `xl/sharedStrings.xml` + `xl/worksheets/*.xml`.
4. Al terminar una etapa relevante, actualiza `docs/estado-del-proyecto.md` y, si hubo decisiones, `docs/decisiones-tecnicas.md`.

## Alcance actual

- **Frontend** (React 18 + TypeScript + Vite 5 + React Router 6) y **base de datos local** (PostgreSQL 17 + pgvector,
  migraciones con dbmate en `db/`). Sin backend, autenticación real ni IA; el frontend no se conecta a la base.
- La migración `20261005000001_esquema_base.sql` es un sustituto **provisional** de EN-002. Nunca editar migraciones
  aplicadas: crear otra con `docker compose run --rm dbmate new <nombre>`.
- Servicios **simulados** en `frontend/src/services/`. No pedir claves de API para funciones simuladas.
- No presentar lo simulado como completado: procesamiento, generación, validación QTI e importación LMS son **pendientes**.
- No inventar aprobaciones del asesor, validaciones con docentes ni resultados de pruebas.

## Comandos (dentro de `frontend/`)

```bash
npm install        # dependencias
npm run dev        # desarrollo en http://localhost:5173
npm run build      # tsc + build de producción (debe pasar sin errores)
npm run typecheck  # solo tipos
npm test           # pruebas de servicios (vitest, entorno node)
npm run preview    # sirve dist/ en http://localhost:4173
```

Base de datos (desde la raíz, con Docker Desktop abierto; detalles en `db/README.md`):

```bash
cp .env.example .env                  # solo la primera vez
docker compose up -d --wait db        # PostgreSQL + pgvector
docker compose run --rm dbmate up     # aplica migraciones y regenera db/schema.sql
./db/verificacion/verificar.sh        # verificación EN-011 en una base temporal (debe terminar en SUPERADA)
```

## Arquitectura y convenciones

- **Pantallas** (`pages/`) leen el estado con `useAppState(selector)` y modifican datos **solo** mediante servicios (`services/index.ts`).
- `useAppState` usa `useSyncExternalStore`: el selector debe devolver **referencias estables** (p. ej. `s.resources`), nunca
  arreglos u objetos nuevos. Deriva con `useMemo` en el componente.
- `store/store.ts` persiste en `localStorage` (clave `plataforma5e.demo.v1`) **solo metadatos y datos de demostración**.
  Nunca guardar contenido de archivos. Si cambia la forma del estado, incrementa `STATE_VERSION` en `store/initialState.ts`.
- Regla crítica de revisión: un recurso solo pasa a `aprobado` con `reviewService.approveResource` (acción explícita).
  Editar **no** aprueba. Exportar exige `aprobado` (`exportableResources`). Hay pruebas que lo verifican.
- Los tipos (`types/index.ts`) son una **propuesta**: los contratos oficiales (EN-003) no existen aún.
- Textos de interfaz y contenido **en español**. Comentarios en español.
- Nombres: componentes en PascalCase, servicios `xxxService`, archivos de página `XxxPage.tsx`.

## Sistema de diseño (obligatorio)

- Todas las variables están en `frontend/src/styles/tokens.css`. No usar colores ni medidas sueltas en componentes.
- Componentes base únicos en `components/ui.tsx` (Button, Card, Tag, ProgressBar, campos, Alert, EmptyState, ConfirmDialog).
  **No crear variantes propias**; si falta algo, añádelo allí y documenta la propuesta.
- Fraunces solo para títulos de pantalla, enunciado de pregunta (`.h2`) y cifras (`.display-number`); Public Sans para lo demás.
- Sin degradados ni sombras (sombra solo en diálogos). Iconos de trazo en `components/Icon.tsx`; nunca emojis.
- Un solo botón primario (verde) por zona. Terracota solo para descartar y valores fuera de meta.
- Todo estado lleva texto o icono además del color. Etiquetas visibles, foco visible, controles de 44 px.
- Propuestas de ajuste vigentes (no aprobadas): `--color-line-strong` para bordes de campos (contraste 3:1) y
  comportamiento adaptable bajo 960 px. Ver `docs/decisiones-tecnicas.md`.

## Git y GitHub — RESTRICCIONES

- **El usuario ejecuta personalmente todas las operaciones de Git y GitHub.** No ejecutar `git init`, `add`, `commit`,
  `branch`, `checkout/switch`, `merge`, `rebase`, `tag`, `push`, `pull`, ni crear repositorios, PR, issues o publicaciones.
- Solo se permiten comandos de lectura (`git status`, `git log`, `git diff`, `git branch --list`) si ya existe un repositorio.
- No cambiar la configuración ni la identidad de Git.
- No añadir firmas, trailers `Co-authored-by`, menciones «Generated by Claude» ni atribuir autoría a Claude o Anthropic
  en commits, PR, código o documentación.
- Para cambios de versionado, actualiza `docs/guia-git.md` y entrega instrucciones al usuario.

## Verificación esperada antes de entregar cambios

1. `npm run build` y `npm test` sin errores.
2. Recorrido en navegador: aprobar exige decidir distractores; decisiones persisten tras recargar; exportación solo muestra aprobados.
3. Sin desbordamiento horizontal a 1280, 820 y 375 px.
4. Informar al usuario de lo que no se pudo verificar.
