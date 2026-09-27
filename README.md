# Plataforma de generación asistida de contenido educativo — Frontend de demostración

Proyecto del curso **Taller Integrador 1** (UPAO, 2026-II). Plataforma que, a partir del material del docente, propone
recursos para una secuencia didáctica del modelo **5E**, con **revisión docente obligatoria**, **trazabilidad a la
evidencia de origen** y exportación futura a estándares (QTI, SCORM, IMS Common Cartridge).

> **Estado actual:** solo existe el **frontend** con datos de demostración y servicios **simulados**.
> No hay backend, IA, procesamiento real de documentos ni integración con LMS. Ver
> [docs/estado-del-proyecto.md](docs/estado-del-proyecto.md).

## Requisitos

- **Node.js 18 o superior** (recomendado: Node.js 22 LTS). Descárgalo de <https://nodejs.org> e instálalo con las opciones por defecto.
- Un navegador moderno (Chrome, Edge o Firefox).
- Conexión a internet solo para instalar dependencias y cargar las fuentes de Google Fonts (sin conexión la interfaz usa Georgia y Segoe UI).

Comprueba la instalación en una terminal nueva:

```bash
node --version   # debe mostrar v18 o superior
npm --version
```

## Instalación y ejecución

```bash
cd frontend
npm install        # instala dependencias (solo la primera vez o si cambia package.json)
npm run dev        # abre el servidor de desarrollo
```

Abre en el navegador la dirección que muestra la terminal (normalmente <http://localhost:5173>). Para detenerlo, pulsa `Ctrl + C`.

Otros comandos (dentro de `frontend/`):

| Comando | Qué hace |
|---|---|
| `npm run build` | Comprueba los tipos y genera la versión de producción en `frontend/dist/` |
| `npm run preview` | Sirve la versión de producción en <http://localhost:4173> (ejecuta antes `npm run build`) |
| `npm run typecheck` | Solo comprueba los tipos de TypeScript |
| `npm test` | Ejecuta las pruebas automáticas de los servicios |

## Cómo probar el recorrido

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

## Estructura

```
taller-integrador/
├── documentos/            Documentos del curso (solo lectura)
├── docs/                  Documentación de continuidad
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
├── CLAUDE.md              Contexto técnico para retomar el trabajo
└── README.md
```

## Documentación

- [Estado del proyecto](docs/estado-del-proyecto.md): qué funciona, qué está simulado y qué falta.
- [Decisiones técnicas](docs/decisiones-tecnicas.md): decisiones, motivos, contradicciones y vacíos detectados.
- [Integración con el backend](docs/integracion-backend.md): modelos, contratos propuestos y puntos de sustitución.
- [Guía de Git y GitHub](docs/guia-git.md): pasos para versionar y subir el proyecto.

## Equipo

Juan Alegria · Silvana Diaz · Yan Liu Dai · Sergio Celi.
