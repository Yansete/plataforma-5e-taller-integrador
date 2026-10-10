# Estado del proyecto

**Última actualización:** 10/10/2026 · **Etapa:** frontend de demostración v0.1.0 (primera versión completa para probar).

## Resumen

Existe un frontend navegable con modo local HU-045/HU-046 y modo EP-002 conectado: sesión demo verificada en servidor, cursos y unidades persistentes, archivos reales e historial autenticado. La generación HU-053 sigue usando ejemplos ficticios.
**Existe un backend base FastAPI con arquitectura hexagonal y adaptador SQLAlchemy**, conectado a Configuración mediante HU-053 / EN-006 en modo API de demostración. Guarda solicitudes y devuelve propuestas y fragmentos ficticios; no hay RAG real. Las decisiones docentes y la exportación siguen locales. La persistencia de esta entrega se probó con SQLite aislado, no con PostgreSQL.

## Implementado (funciona localmente en el navegador)

| Área | Qué hace | Historias relacionadas |
|---|---|---|
| Sistema de diseño | Tokens en `tokens.css`, componentes base únicos, iconos de trazo, foco visible, controles de 44 px | HU-001 (parcial: falta validación con docentes) |
| Navegación | Barra lateral de 244 px, recorrido en 4 pasos + Inicio + Indicadores, menú desplegable bajo 960 px, enlace «Saltar al contenido», página 404 | — |
| 1. Inicio | Resumen, pasos del recorrido con «siguiente paso», cobertura 5E por unidad, recursos recientes | — |
| 2. Carga | Selección local (arrastrar o elegir), validación de formato/tamaño/vacío/duplicado, contexto (unidad, RA, tipo, etapa sugerida, permiso), registro de metadatos, procesamiento **simulado** por pasos, error simulado y reintento, quitar con confirmación | HU-002, HU-003 (solo interfaz) |
| 3. Configuración | Unidad, RA, etapa 5E, tipo de recurso, cantidad, dificultad, alternativas, top-k, umbral, indicaciones; evidencia disponible; plan 5E de la unidad; rechazo simulado; historial de solicitudes | HU-005 a HU-009, HU-011 a HU-014 (solo interfaz) |
| 4. Revisión | Cola filtrable, contenido junto a evidencia de origen, aceptar/editar/descartar cada distractor (con motivo), editar/aprobar/descartar/devolver cada recurso, bloqueos de aprobación explicados, advertencia simulada de fiabilidad, registro de decisiones | HU-010, EN-006 (local), HU-015 (solo visual) |
| 5. Exportación | Solo lista recursos aprobados, selección persistente, 5 formatos, compatibilidad QTI/ítems, flujo de 5 pasos con pendientes explícitos, historial, resumen JSON **no importable** | HU-018, HU-019 (solo interfaz) |
| 6. Indicadores | 10 indicadores de HU-021 o los 23, filtros por unidad y periodo, vista de tarjetas o tabla, origen de cada valor, registro de decisiones | HU-021 (parcial) |
| Persistencia | Estado, decisiones y preferencias en `localStorage` (solo metadatos); restablecer demo | — |
| Base vectorial local (05/10/2026) | PostgreSQL 17 + pgvector 0.8.1 en Docker; migraciones con dbmate; tabla `fragmento` con `embedding vector(768)`, índice HNSW coseno, índice por unidad y GIN `spanish`; script de verificación | EN-011. El frontend aún no la usa |
| Pruebas | 15 pruebas de servicios (vitest) | — |

## Simulado (parece funcionar, pero no hay procesamiento real)

- **Procesamiento de documentos**: los pasos de extracción, segmentación y vectorización son temporizadores. Los documentos que registra el usuario quedan con 0 fragmentos.
- **Generación**: entrega ejemplos redactados a mano en `data/demoContent.ts`, filtrados por unidad, etapa, tipo y RA. No hay IA, recuperación ni verificación de anclaje. Dificultad, alternativas, top-k, umbral e indicaciones se registran pero no cambian el resultado.
- **Evidencia de origen**: 12 fragmentos ficticios de 3 documentos ficticios.
- **Filtro de fiabilidad**: una única advertencia fija en un distractor de ejemplo.
- **Exportación**: registra la solicitud; no genera paquetes. El JSON descargable avisa de que no es importable.
- **Usuario**: HU-045 conserva sesión local simulada. EP-002 añade una cuenta demo comprobada por servidor, token revocable y rutas protegidas; registro de usuarios y roles de producción de HU-001 siguen pendientes.

## Indicadores: qué es real y qué no

| Origen | Indicadores | Nota |
|---|---|---|
| Calculado localmente | I2, I3, I5, I22, I23 | A partir de las acciones de esta demo. I3 e I5 son **aproximaciones** (la medición oficial usa rúbrica experta). I22 se calcula sobre ejemplos, no sobre generación real. |
| Ejemplo (inventado) | I1, I9, I20, I21 | Valores ilustrativos en `data/indicators.ts`. **No son mediciones.** |
| Pendiente | I4, I6–I8, I10–I19 | Requieren backend, piloto, validadores o instrumentos externos. |

## Pendiente (fuera del alcance actual)

- Ampliaciones de API y modelo de datos definitivo (EN-002): la migración 0001 es un esquema base
  **provisional** creado para EN-011, que deberá ajustarse con migraciones nuevas cuando EN-002 se apruebe.
- Vectorización real de los fragmentos (EN-013): las columnas `embedding` y `modelo_embedding` existen pero están vacías.
- Contratos JSON de generación (EN-003): los tipos actuales son una propuesta.
- Ingesta real, segmentación, vectorización y recuperación híbrida (HU-002 a HU-005).
- Generación anclada, verificación de anclaje y rechazo real (HU-006, HU-007), etapas 5E (HU-008 a HU-017).
- Registro de decisiones en servidor con usuario autenticado (EN-006).
- Exportador QTI 3.0, empaquetado SCORM/Common Cartridge, validador 1EdTech y pruebas en LMS (HU-018, HU-019, TA-002, SP-001).
- Analítica de ítems con estudiantes (HU-020) e indicadores del piloto.
- Autenticación y roles docente/estudiante/administrador (TA-001, RN-003).
- Validación del sistema de diseño y del prototipo con al menos dos docentes (criterio de HU-001): **no realizada**.

## Verificaciones realizadas (26/09/2026)

- `npm run build` (TypeScript estricto + Vite): sin errores.
- `npm test`: 15 de 15 pruebas superadas.
- Recorrido automatizado en Chrome (puppeteer-core): 35 de 35 comprobaciones superadas, entre ellas:
  aprobación bloqueada sin decidir distractores; aprobación solo tras acción explícita; persistencia tras recargar;
  exportación con solo recursos aprobados; validación e importación como pendientes; generación y rechazo simulados;
  registro y procesamiento simulado de un archivo; restablecimiento; menú móvil; sin desbordamiento horizontal a
  1280, 820 y 375 px; primer Tab en «Saltar al contenido»; sin errores de consola.
- Revisión visual de capturas a 1280 y 375 px.
- Contraste de la paleta calculado con la fórmula WCAG 2.1 (ver `decisiones-tecnicas.md`).

## Verificaciones de EN-011 (05/10/2026)

- `dbmate up` aplica 0001 y 0002; `dbmate rollback` revierte 0002 (elimina la tabla y la extensión) y se vuelve a aplicar.
- `./db/verificacion/verificar.sh`: superada en 7 de 7 ejecuciones sobre una base temporal (4.005 fragmentos de prueba).
  Comprueba la extensión, la consulta top-k filtrada por unidad, el uso de `fragmento_embedding_hnsw` en el `EXPLAIN`
  y la búsqueda por palabras con el índice GIN.
- El recall@10 del índice HNSW frente a la búsqueda exacta con vectores **aleatorios** varió entre 6/10 y 10/10; con
  embeddings reales debe medirse en EN-013.
- Hallazgo: ejecutar la verificación muchas veces sobre la misma base acumula entradas muertas en el índice HNSW (141 MB
  con la tabla vacía) y el planificador deja de usarlo hasta un `REINDEX`. Por eso la verificación usa una base temporal.

## No verificado

- Lectores de pantalla reales (NVDA, JAWS, VoiceOver).
- Firefox y Safari (solo se probó Chrome).
- Uso con docentes reales o pruebas de usabilidad (SUS).
- Rendimiento con volúmenes grandes de datos.

## Problemas conocidos

- Si se recarga la página durante un procesamiento simulado, el documento queda en «Error» (se puede reintentar).
- Las solicitudes de generación rechazadas no se guardan en el historial de solicitudes.
- El menú móvil cierra con Esc o con el fondo, pero no retiene el foco dentro del panel mientras está abierto.
- Las fuentes se cargan desde Google Fonts; sin conexión se usan Georgia y Segoe UI.
- El número de alternativas (3 o 5) aparece deshabilitado porque los ejemplos tienen 4.

## Investigaciones (spikes)

| Spike | Resultado | Estado |
|---|---|---|
| SP-001 · Modelos de embeddings (05/10/2026) | Propuesta: `multilingual-e5-base` local, vectores de 768 dimensiones. Detalle en `docs/spikes/SP-001-modelos-embeddings.md`; experimento en `spikes/sp-001-embeddings/` | Medidos 3 modelos locales y 2 de Gemini (OpenAI sin saldo). Falta la prueba con material real. No aprobado por el equipo |
| SP-002 · Modelos de generación por tipo de recurso (05/10/2026) | Propuesta: Claude Sonnet 5.5 para todo lo textual/JSON (textual, ítems, gamificado, diagramas Mermaid, H5P); Gemini 3.1 Flash Image solo para imágenes opcionales; Gemini 3.8 Flash como alternativa. Unos USD 0,03-0,05 por recurso; detalle en `docs/spikes/SP-002-modelos-por-tipo-de-recurso.md` | Costos **estimados** (sin llamadas reales); falta la evaluación de calidad con docentes. No aprobado por el equipo |

## Próximos pasos sugeridos

1. Revisar esta versión con el equipo y decidir sobre las propuestas de `decisiones-tecnicas.md`.
2. Validar la interfaz con al menos dos docentes (HU-001) y registrar el resultado real.
3. Acordar los contratos de EN-003 y ajustar `types/index.ts`.
4. Sustituir los servicios simulados uno a uno según `integracion-backend.md`.
5. Añadir pruebas de componentes y de accesibilidad automatizadas si el equipo lo considera necesario.

## Avance HU-045 del 09/10/2026

Inicio de sesión simulado y catálogo editable de cursos/unidades, rutas /login y /cursos. Datos locales; sin endpoints nuevos. Migración del estado a versión 2 conserva las decisiones anteriores. Verificaciones de esta copia: build correcto, 36 pruebas unitarias y 3 recorridos Chromium superados. Capturas en docs/evidencias/HU-045; registro para Notion y límites en docs/HU-045-Notion.md. Pendiente revisión local de Silvana, publicación del código, acta Word, diapositiva y aprobación académica. No se ha realizado validación con docentes.

## Avance EP-002 del 10/10/2026

Configuración conectada: sesión de cuenta demo, cursos/unidades, carga multipart de archivos reales, descarga y eliminación, confirmación de solicitudes e historial persistente. Las pruebas incluyen reinicio del backend y recuperación sin caché. Los archivos no se extraen ni vectorizan. Detalle y límites en [EP-002-registro-avance.md](EP-002-registro-avance.md); instalación y evidencias en [EP-002-aplicar-cambios.md](EP-002-aplicar-cambios.md). Pendientes comprobación local de Silvana, capturas, publicación y revisión académica.
