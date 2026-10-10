/** HU-046 / EN-005: intérprete local por reglas. No invoca IA ni genera contenido. */
import { RESOURCE_TYPES } from '../data/catalog';
import { getState } from '../store/store';
import { preferencesService } from './preferencesService';
import type { GenerationRequest, Stage5E } from '../types';

export const MODALITIES = ['Textual', 'Gamificado', 'Multimedia', 'Kinestésico'] as const;
export type Modality = typeof MODALITIES[number];
export interface ChatDraft {
  courseId: string;
  unitId: string;
  audience: string;
  competency: string;
  modalities: Modality[];
  quantity: string;
  stage: Stage5E;
}
export const EMPTY_CHAT_DRAFT: ChatDraft = {
  courseId: '', unitId: '', audience: '', competency: '', modalities: [], quantity: '', stage: 'engage',
};
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const contains = (text: string, term: string) => (` ${text.replace(/[^a-z0-9]/g, ' ')} `).includes(` ${normalize(term).replace(/[^a-z0-9]/g, ' ')} `);
const labelled = (text: string, label: string) => text.match(new RegExp(`(?:^|[;\\n])\\s*(?:${label})\\s*:\\s*([^;\\n]+)`, 'i'))?.[1].trim();

export function interpretChat(message: string, previous: ChatDraft): { draft: ChatDraft; reply: string } {
  const text = normalize(message);
  const draft = { ...previous, modalities: [...previous.modalities] };
  const notes: string[] = [];
  const { courses, units } = getState();
  const courseText = labelled(text, 'curso') ?? text;
  const matching = courses.filter((c) => contains(courseText, c.code) || contains(courseText, c.name));
  if (matching.length === 1) {
    if (draft.courseId !== matching[0].id) draft.unitId = '';
    draft.courseId = matching[0].id;
  } else if (matching.length > 1 || labelled(text, 'curso')) {
    draft.courseId = ''; draft.unitId = '';
    notes.push('No pude identificar un único curso. Selecciónalo en el resumen.');
  }
  const scopedUnits = units.filter((u) => u.courseId === draft.courseId);
  const unitNumber = text.match(/\bunidad\s*:?\s*(\d+)\b/)?.[1];
  const unitText = labelled(text, 'unidad') ?? text;
  const matchingUnits = scopedUnits.filter((u) => unitNumber ? u.number === Number(unitNumber) : contains(unitText, u.title));
  if (matchingUnits.length === 1) draft.unitId = matchingUnits[0].id;
  else if (unitNumber || labelled(text, 'unidad') || matchingUnits.length > 1) {
    draft.unitId = '';
    notes.push('No pude identificar la unidad de ese curso. Selecciónala en el resumen.');
  }
  // Los valores libres solo se capturan con delimitadores para no adivinar su alcance.
  const audience = labelled(message, 'público|publico|ciclo');
  const naturalAudience = message.match(/\bpara\s+(estudiantes[^;\n.,]*)/i)?.[1].trim();
  if (audience || naturalAudience) draft.audience = audience ?? naturalAudience!;
  const competency = labelled(message, 'competencia');
  const standard = ['Pensamiento crítico', 'Pensamiento innovador', 'Resolución de problemas', 'Trabajo en equipo'].filter((c) => contains(text, c));
  if (competency) draft.competency = competency;
  else if (standard.length === 1) draft.competency = standard[0];
  else if (standard.length > 1) { draft.competency = ''; notes.push('Hay varias competencias. Indica una en el resumen.'); }
  const modalityText = labelled(text, 'modalidad|modalidades') ?? text;
  const modalities = MODALITIES.filter((m) => contains(modalityText, m));
  // Una corrección reemplaza la selección anterior; nunca acumula modalidades implícitas.
  if (modalities.length) draft.modalities = [...modalities];
  else if (labelled(text, 'modalidad|modalidades')) { draft.modalities = []; notes.push('Modalidad no reconocida. Elígela en el resumen.'); }
  const quantity = labelled(text, 'cantidad') ?? text.match(/\b(\d+|un|uno|una|dos|tres|cuatro|cinco)\s+(?:recursos?|actividades?|preguntas?|propuestas?|items?)\b/)?.[1];
  if (quantity) {
    const words: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };
    const n = words[quantity] ?? Number(quantity);
    draft.quantity = String(n);
  }
  const stageText = labelled(text, 'etapa') ?? text;
  const stageTerms: [Stage5E, string[]][] = [['engage', ['engage', 'enganchar']], ['explore', ['explore', 'explorar']], ['explain', ['explain', 'explicar']], ['elaborate', ['elaborate', 'elaborar']], ['evaluate', ['evaluate', 'evaluar']]];
  const stages = stageTerms.filter(([, terms]) => terms.some((term) => contains(stageText, term)));
  if (stages.length === 1) draft.stage = stages[0][0];
  if (stages.length > 1) notes.push('Mencionaste varias etapas. Revisa la etapa inicial en el resumen.');
  const missing = validateChatDraft(draft);
  return { draft, reply: [...notes, missing.length ? `Revisa o completa: ${missing.join(', ')}.` : 'La solicitud está completa. Revisa mi interpretación y confirma antes de continuar.', 'Puedes corregir el resumen o enviar otro mensaje. La etapa inicial sugerida es Enganchar si no indicas otra.'].join(' ') };
}

export function validateChatDraft(draft: ChatDraft): string[] {
  const { courses, units } = getState();
  const missing: string[] = [];
  if (!courses.some((c) => c.id === draft.courseId)) missing.push('curso');
  if (!units.some((u) => u.id === draft.unitId && u.courseId === draft.courseId)) missing.push('unidad');
  if (!draft.audience.trim()) missing.push('público / ciclo');
  if (!draft.competency.trim()) missing.push('competencia');
  if (!draft.modalities.length || draft.modalities.some((m) => !MODALITIES.includes(m))) missing.push('modalidad');
  const n = Number(draft.quantity);
  if (!Number.isInteger(n) || n < 1 || n > 5) missing.push('cantidad entera de 1 a 5');
  if (!RESOURCE_TYPES.some((r) => r.stage === draft.stage)) missing.push('etapa 5E');
  return missing;
}

export const chatService = {
  confirm(draft: ChatDraft): void {
    const missing = validateChatDraft(draft);
    if (missing.length) throw new Error(`Completa: ${missing.join(', ')}.`);
    const config: Partial<Omit<GenerationRequest, 'id' | 'createdAt'>> = {
      ...getState().ui.config, unitId: draft.unitId, outcomeId: null, stage: draft.stage,
      resourceType: RESOURCE_TYPES.find((r) => r.stage === draft.stage)!.id,
      quantity: Number(draft.quantity), audience: draft.audience.trim(), competency: draft.competency.trim(), modalities: [...draft.modalities],
    };
    preferencesService.update('config', config);
  },
};
