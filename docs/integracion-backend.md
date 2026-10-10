# Integración con el backend

**HU-053 / EN-006:** Configuración incorpora un modo API de demostración. `generationApiService` envía `POST /api/v1/generaciones`, valida la respuesta y conserva propuestas pendientes y fragmentos en el store. La API guarda cada solicitud en `generaciones_demo` con SQLAlchemy; `GET /api/v1/generaciones/{id}` permite recuperarla. La prueba técnica usa SQLite aislado; PostgreSQL no se verificó en esta entrega. El contenido es ficticio y no proviene de RAG real.

Los campos de entrada se basan en `app/contracts/solicitud.py` y agregan público, competencia y modalidades. OpenAPI se publica en `/docs` del backend y en `docs/openapi.json`. Las decisiones y exportaciones de la interfaz continúan locales; la ingesta de PDFs, RAG y autenticación real siguen pendientes. Las tablas siguientes describen los puntos pendientes de integración salvo el modo API de generación implementado.

## 1. Cómo está organizado hoy

```
pages/  ──lee──▶  store (useAppState)          ◀──escribe── services/*  ──usa──▶ data/ (demostración)
   └──────────── llama acciones ────────────────────────────▶ services/*
```

- `store/store.ts`: caché del cliente + persistencia en `localStorage`.
- `services/*.ts`: única vía para leer datos del catálogo y modificar el estado. Generación puede usar la API; los demás servicios siguen locales.
- `services/index.ts`: punto único de importación para las pantallas.

**Para conectar el backend**, se reemplaza el cuerpo de cada servicio por llamadas HTTP y, con la respuesta, se
actualiza el store con `setState`. Las firmas públicas deben mantenerse para no tocar las pantallas.

## 2. Servicios y puntos de sustitución

| Servicio (archivo) | Función actual | Simulación | Endpoint propuesto | Historias |
|---|---|---|---|---|
| `catalogService` | `getCourse`, `listUnits`, `getUnit`, `getOutcome`, `getFragments`, `documentName` | Lee `data/demoContent.ts` (síncrono) | `GET /cursos/{id}`, `GET /cursos/{id}/unidades`, `GET /fragmentos?ids=` | EN-002 |
| `materialService` | `registerDocument` | Guarda metadatos | `POST /documentos` (multipart: archivo + contexto) | HU-002 |
| | `processDocument` | Temporizadores por paso | `POST /documentos/{id}/procesar` + `GET /documentos/{id}/estado` (sondeo o eventos) | HU-002 a HU-004 |
| | `removeDocument` | Quita de la lista | `DELETE /documentos/{id}` | — |
| | `validateFile`, `validateRegistration` | Validación en cliente | Mantener en cliente y **repetir en servidor** | HU-002 |
| `generationService` | `generate(request, onPhase)` | Ejemplos preparados; códigos `EVIDENCIA_INSUFICIENTE` y `SIN_MATERIAL_PROCESADO` | `POST /generaciones` → recursos o código de rechazo | HU-005 a HU-009, HU-011 a HU-014 |
| `reviewService` | `approveResource`, `discardResource`, `revertResource`, `saveEdits`, `acceptDistractor`, `discardDistractor`, `editDistractor`, `revertDistractor` | Cambia el estado local y añade al registro | `POST /recursos/{id}/decisiones`, `PATCH /recursos/{id}` | HU-010, EN-006 |
| | `approvalBlockers` | Reglas en cliente | Mantener en cliente como ayuda; **el servidor debe aplicar las mismas reglas** | HU-010 |
| `exportService` | `runExport`, `buildSummary` | Registra la solicitud; resumen JSON no importable | `POST /exportaciones` → paquete + informe del validador | HU-018, HU-019, TA-002 |
| `indicatorService` | `computeIndicators(resources, filtros)` | I2, I3, I5, I22, I23 locales; I1, I9, I20, I21 de ejemplo | `GET /indicadores?unidad=&desde=&hasta=` | HU-021, EN-006 |
| `preferencesService` | `update`, `resetDemo` | `localStorage` | Preferencias pueden seguir en el cliente; `resetDemo` desaparece | — |

Al sustituir: eliminar `simulation.ts` (latencia) de los servicios reales, conservar `ServiceError` para mensajes al usuario
y borrar `data/demoContent.ts` e `indicators.ts → DEMO_INDICATOR_VALUES` cuando ya no se usen.

## 3. Modelos propuestos (`frontend/src/types/index.ts`)

Resumen (ver el archivo para el detalle completo):

- **Course**, **Unit**, **LearningOutcome** — la «unidad de trabajo» del S1 es la unidad del sílabo con sus RA.
- **MaterialDocument** — metadatos: `fileName`, `kind` (pdf|pptx|txt), `sizeBytes`, `unitId`, `outcomeIds`, `documentType`,
  `suggestedStage`, `usePermission`, `status` (registrado|procesando|procesado|error), `currentStep`, `fragmentCount`,
  `pageCount`, `errorMessage`, fechas.
- **Fragment** — `id`, `documentId`, `location` (página o diapositiva), `text`, `unitId`, `outcomeId`. En el backend tendrá
  además embedding, etapa 5E sugerida, nivel taxonómico (Anexo B, capa 3).
- **GenerationRequest** — `unitId`, `outcomeId|null`, `stage`, `resourceType`, `quantity`, `difficulty`, `optionCount`,
  `topK`, `evidenceThreshold`, `instructions`.
- **Resource** — `stage`, `type`, `title`, `body`, `options|null`, `citations[] {claim, fragmentIds[]}`, `status`
  (pendiente|aprobado|descartado), `edited`, `discardReason`, fechas.
- **ItemOption** — `text`, `isCorrect`, `feedback`, `sourceFragmentIds`, `decision` (pendiente|aceptado|descartado),
  `discardReason`, `edited`, `reliabilityWarning`.
- **ReviewLogEntry** — `resourceId`, `optionId`, `action`, `reason`, `user`, `at` (EN-006: acción, recurso, usuario, marca de tiempo).
- **ExportJob** — `format`, `resourceIds`, `targetLms`, `steps` (completado|simulado|pendiente por paso).
- **IndicatorDefinition / IndicatorValue** — `source` (local|demo|pendiente), `value`, `display`, `detail`, `meetsGoal`.

## 4. Ejemplo de contrato propuesto: generación

Solicitud:

```json
{
  "unidad_id": "u2",
  "resultado_aprendizaje_id": "ra-2-1",
  "etapa_5e": "evaluate",
  "tipo_recurso": "item_opcion_multiple",
  "cantidad": 2,
  "dificultad": "intermedia",
  "alternativas": 4,
  "top_k": 10,
  "umbral_evidencia": 0.6,
  "indicaciones": ""
}
```

Respuesta correcta:

```json
{
  "solicitud_id": "sol-123",
  "recursos": [
    {
      "id": "rec-1",
      "etapa_5e": "evaluate",
      "tipo": "item_opcion_multiple",
      "titulo": "…",
      "enunciado": "…",
      "alternativas": [
        { "id": "a", "texto": "…", "correcta": true, "retroalimentacion": "…", "fragmentos_origen": ["f-u2-01"] },
        { "id": "b", "texto": "…", "correcta": false, "retroalimentacion": "…", "fragmentos_origen": ["f-u2-03"],
          "advertencia_fiabilidad": null }
      ],
      "citas": [ { "afirmacion": "…", "fragmentos": ["f-u2-01"] } ],
      "estado": "pendiente"
    }
  ]
}
```

Respuesta de rechazo (HU-007):

```json
{ "codigo": "EVIDENCIA_INSUFICIENTE", "mensaje": "…", "fragmentos_recuperados": 2, "umbral": 0.6 }
```

Reglas que el servidor debe garantizar aunque el cliente también las aplique:

1. Todo recurso nuevo nace en `pendiente`.
2. Solo una decisión explícita del docente autenticado lo pasa a `aprobado`, y queda registrada con usuario y hora.
3. La exportación rechaza cualquier recurso no aprobado.
4. Todo recurso cita al menos un fragmento verificable (I22) o se rechaza.

## 5. Mapeo de nombres

El frontend usa nombres en inglés para campos (`unitId`, `stage`) y valores en español (`pendiente`, `aprobado`).
Si el backend usa nombres en español (como el ejemplo), se recomienda un adaptador en cada servicio (`toResource(dto)`)
en lugar de cambiar los tipos en todo el código. Esta convención debe acordarse en EN-003.

## 6. Pendientes de definición conjunta

- Contrato de errores único (TA-001) y cómo mostrarlo.
- Autenticación y roles (docente, estudiante, administrador) — hoy el usuario es fijo.
- Estrategia de estado del procesamiento: sondeo periódico o eventos del servidor.
- Límite de tamaño y tipos de documento definitivos.
- Qué hacer con `localStorage` cuando exista servidor (probablemente solo preferencias de interfaz).
