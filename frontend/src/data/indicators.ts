/**
 * Definiciones de los 23 indicadores (S2_Product_Discovery, tabla 1).
 * `inDashboard` marca los que exige HU-021: I1, I2, I3, I9, I16, I17 e I20 a I23.
 */
import type { IndicatorDefinition } from '../types';

export const INDICATORS: IndicatorDefinition[] = [
  { code: 'I1', name: 'Tiempo medio por recurso', definition: 'Σ minutos invertidos / n.º de recursos publicados, comparando flujo manual y asistido.', goalText: 'Reducción ≥ 50 %', instrument: 'Ficha de cronometraje y marcas de tiempo del sistema', moment: 'Línea base y piloto', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 50 } },
  { code: 'I2', name: 'Tasa de aceptación directa', definition: '(Recursos aceptados sin edición / recursos propuestos) × 100.', goalText: '≥ 50 %', instrument: 'Registro de acciones de la interfaz de revisión', moment: 'Sprints 1–2 y piloto', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 50 } },
  { code: 'I3', name: 'Distractores sin sentido (NDR)', definition: '(Distractores calificados «sin sentido» / evaluados) × 100.', goalText: '≤ 10 %', instrument: 'Rúbrica de juicio experto', moment: 'Cierre de cada sprint', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '<=', value: 10 } },
  { code: 'I4', name: 'Plausibilidad y concordancia', definition: 'Media en escala 1–3 y kappa de Cohen entre dos evaluadores.', goalText: 'Media ≥ 2,3 (*); κ ≥ 0,41', instrument: 'Rúbrica validada con doble anotación', moment: 'Cierre de cada sprint', provisionalGoal: true, inDashboard: false, unit: 'escala', goal: null },
  { code: 'I5', name: 'Error de fiabilidad', definition: '(Distractores que también son correctos / evaluados) × 100.', goalText: '≤ 5 % (*)', instrument: 'Rúbrica y verificación contra la evidencia', moment: 'Cierre de cada sprint', provisionalGoal: true, inDashboard: false, unit: '%', goal: { op: '<=', value: 5 } },
  { code: 'I6', name: 'Precisión frente a referencia', definition: 'P@1, F1@3 y NDCG@10 sobre el conjunto gold en español.', goalText: 'Superar la línea base de embeddings en ≥ 10 % relativo (*)', instrument: 'Script de evaluación offline', moment: 'Sprints 1–2', provisionalGoal: true, inDashboard: false, unit: '%', goal: null },
  { code: 'I7', name: 'Diversidad de distractores', definition: '(Pares con similitud coseno > 0,90 / total de pares) × 100.', goalText: '≤ 5 % duplicados (*)', instrument: 'Script de embeddings', moment: 'Cada ejecución', provisionalGoal: true, inDashboard: false, unit: '%', goal: { op: '<=', value: 5 } },
  { code: 'I8', name: 'Índice de dificultad', definition: 'p = respuestas correctas / respuestas totales al ítem.', goalText: '0,30–0,80 en ≥ 70 % de ítems', instrument: 'Análisis de ítems con estudiantes', moment: 'Piloto', provisionalGoal: false, inDashboard: false, unit: '%', goal: null },
  { code: 'I9', name: 'Eficiencia de distractores', definition: '(Distractores con elección ≥ 5 % y r-pb < 0 / total) × 100.', goalText: '≥ 65 %', instrument: 'Reporte de análisis de ítems por distractor', moment: 'Piloto', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 65 } },
  { code: 'I10', name: 'Discriminación del ítem', definition: 'Correlación punto-biserial entre acierto y puntaje total.', goalText: 'r-pb ≥ 0,20 en ≥ 70 % de ítems', instrument: 'Análisis de ítems', moment: 'Piloto', provisionalGoal: false, inDashboard: false, unit: '%', goal: null },
  { code: 'I11', name: 'Latencia', definition: 'Percentil 95 del tiempo de recuperación y de generación por recurso.', goalText: 'Recuperación ≤ 2 s; generación ≤ 15 s (*)', instrument: 'Registros del backend y pruebas de carga', moment: 'Cierre de Sprint 2', provisionalGoal: true, inDashboard: false, unit: 'num', goal: null },
  { code: 'I12', name: 'Usabilidad percibida', definition: 'Puntaje del System Usability Scale (0–100).', goalText: '≥ 68', instrument: 'Cuestionario SUS de 10 ítems', moment: 'Piloto', provisionalGoal: false, inDashboard: false, unit: 'num', goal: { op: '>=', value: 68 } },
  { code: 'I13', name: 'Disponibilidad', definition: '(Tiempo operativo / tiempo total del piloto) × 100.', goalText: '≥ 99 % (*)', instrument: 'Monitor de disponibilidad', moment: 'Piloto', provisionalGoal: true, inDashboard: false, unit: '%', goal: { op: '>=', value: 99 } },
  { code: 'I14', name: 'Seguridad', definition: 'Vulnerabilidades altas o críticas; % de endpoints con control de acceso por rol.', goalText: '0 críticas; 100 % endpoints', instrument: 'Escaneo OWASP ZAP y checklist ASVS nivel 1', moment: 'Antes del piloto', provisionalGoal: false, inDashboard: false, unit: 'num', goal: null },
  { code: 'I15', name: 'Gestión del proyecto', definition: '(Historias terminadas / comprometidas) × 100 por sprint.', goalText: '≥ 85 %', instrument: 'Tablero Scrum y burndown', moment: 'Cierre de cada sprint', provisionalGoal: false, inDashboard: false, unit: '%', goal: { op: '>=', value: 85 } },
  { code: 'I16', name: 'Conformidad con el estándar', definition: '(Paquetes válidos ante el validador / paquetes generados) × 100.', goalText: '100 %', instrument: 'Validador QTI de 1EdTech y verificación del manifiesto', moment: 'Cada entrega', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 100 } },
  { code: 'I17', name: 'Importación exitosa', definition: '(Importaciones sin error / intentos) × 100 por LMS objetivo.', goalText: '≥ 95 %', instrument: 'Pruebas de importación en instancias locales', moment: 'Cierre de cada sprint', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 95 } },
  { code: 'I18', name: 'Portabilidad', definition: 'Número de LMS distintos donde el mismo paquete funciona.', goalText: '≥ 2 (ideal 3)', instrument: 'Matriz de compatibilidad LMS × versión del estándar', moment: 'Cierre de Sprint 2', provisionalGoal: false, inDashboard: false, unit: 'num', goal: { op: '>=', value: 2 } },
  { code: 'I19', name: 'Fidelidad tras la importación', definition: '(Ítems que conservan enunciado, opciones, clave y retroalimentación / importados) × 100.', goalText: '100 %', instrument: 'Lista de verificación antes y después de importar', moment: 'Cierre de cada sprint', provisionalGoal: false, inDashboard: false, unit: '%', goal: { op: '>=', value: 100 } },
  { code: 'I20', name: 'Calidad de la recuperación', definition: 'recall@10 y precisión media sobre consultas con fragmentos relevantes anotados.', goalText: 'recall@10 ≥ 0,80', instrument: 'Conjunto de evaluación de recuperación y script de métricas', moment: 'Sprints 1–2', provisionalGoal: false, inDashboard: true, unit: 'ratio', goal: { op: '>=', value: 0.8 } },
  { code: 'I21', name: 'Tasa de alucinación', definition: 'Afirmaciones sin respaldo en los fragmentos recuperados / afirmaciones verificadas por muestreo.', goalText: '≤ 3 %', instrument: 'Verificación automática de anclaje más auditoría manual por muestra', moment: 'Cierre de cada sprint', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '<=', value: 3 } },
  { code: 'I22', name: 'Trazabilidad del recurso', definition: 'Recursos cuyas afirmaciones citan al menos un fragmento verificable / recursos generados.', goalText: '≥ 95 %', instrument: 'Validación del campo de trazabilidad en la salida estructurada', moment: 'Cada ejecución', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 95 } },
  { code: 'I23', name: 'Cobertura de la secuencia 5E', definition: 'Unidades con recursos aprobados en las cinco etapas / unidades trabajadas.', goalText: '100 %', instrument: 'Reporte del orquestador de secuencia', moment: 'Piloto', provisionalGoal: false, inDashboard: true, unit: '%', goal: { op: '>=', value: 100 } },
];

/**
 * VALORES DE EJEMPLO (inventados para la demostración; NO son mediciones).
 * Solo se definen para indicadores del tablero que no pueden calcularse en el navegador
 * y cuyo valor ilustrativo no se confunde con una validación técnica.
 * Claves: 'todas' o id de unidad.
 */
export const DEMO_INDICATOR_VALUES: Record<string, Record<string, number>> = {
  I1: { todas: 48, u2: 46, u3: 51 },
  I9: { todas: 66, u2: 69, u3: 61 },
  I20: { todas: 0.82, u2: 0.84, u3: 0.78 },
  I21: { todas: 2.6, u2: 2.1, u3: 3.4 },
};

/** Motivo por el que un indicador no tiene valor en esta etapa. */
export const PENDING_REASONS: Record<string, string> = {
  I4: 'Requiere la rúbrica validada y doble anotación de docentes.',
  I5: 'Se aproxima con los descartes «También es correcto»; la medición oficial usa rúbrica.',
  I6: 'Requiere el conjunto gold en español y el script de evaluación offline.',
  I7: 'Requiere el script de embeddings del backend.',
  I8: 'Requiere respuestas de estudiantes del piloto.',
  I10: 'Requiere respuestas de estudiantes del piloto.',
  I11: 'Requiere registros del backend y pruebas de carga.',
  I12: 'Requiere el cuestionario SUS aplicado en el piloto.',
  I13: 'Requiere un monitor de disponibilidad del servicio desplegado.',
  I14: 'Requiere el escaneo OWASP ZAP y el backend con control por rol.',
  I15: 'Se mide en el tablero Scrum, fuera de esta aplicación.',
  I16: 'Requiere el exportador real y el validador QTI de 1EdTech. La exportación de esta demo no genera paquetes.',
  I17: 'Requiere pruebas de importación en los LMS objetivo (SP-001, TA-002).',
  I18: 'Requiere la matriz de compatibilidad con LMS instalados (SP-001).',
  I19: 'Requiere importar paquetes reales y comparar antes y después.',
};
