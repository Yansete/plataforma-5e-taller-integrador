/**
 * Descarga de la secuencia 5E como documento (HTML).
 *
 * Moodle XML y QTI 2.1 solo admiten ítems de opción múltiple. Este documento reúne TODOS los
 * recursos aprobados (de cualquier etapa y tipo) con sus alternativas y su evidencia citada.
 * Se abre en el navegador o en Word y se puede imprimir como PDF.
 */
import { STAGES, resourceTypeName } from '../data/catalog';
import type { Fragment, Resource } from '../types';
import { escapeXml as esc, exportedOptions } from './exportFormats';

export interface SequenceContext {
  courseName: string;
  unitLabel: (unitId: string) => string;
  fragments: (ids: string[]) => Fragment[];
  documentName: (documentId: string) => string;
}

function paragraphs(text: string): string {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

function resourceHtml(r: Resource, ctx: SequenceContext): string {
  const options = r.options ? exportedOptions(r) : null;
  const letters = 'abcdefghij';
  const evidence = r.citations.map((c) => {
    const sources = ctx.fragments(c.fragmentIds).map((f) =>
      `<li><span class="quote">«${esc(f.text.length > 400 ? `${f.text.slice(0, 400)}…` : f.text)}»</span> <span class="src">${esc(ctx.documentName(f.documentId))}, ${esc(f.location)}</span></li>`).join('');
    return `<li><strong>${esc(c.claim)}</strong>${sources ? `<ul>${sources}</ul>` : ''}</li>`;
  }).join('');
  return `<article>
  <h3>${esc(r.title)}</h3>
  <p class="meta">${esc(ctx.unitLabel(r.unitId))} · ${esc(resourceTypeName(r.type))}${r.edited ? ' · editado por el docente' : ''}</p>
  ${paragraphs(r.body)}
  ${options ? `<ol class="options">${options.map((o, i) => `<li><span class="letter">${letters[i]})</span> ${esc(o.text)}${o.isCorrect ? ' <strong class="key">(clave)</strong>' : ''}${o.feedback ? `<div class="feedback">${esc(o.feedback)}</div>` : ''}</li>`).join('')}</ol>` : ''}
  ${evidence ? `<details open><summary>Evidencia del material</summary><ul class="evidence">${evidence}</ul></details>` : ''}
</article>`;
}

export function buildSequenceHtml(resources: Resource[], ctx: SequenceContext, date = new Date()): string {
  const sections = STAGES.map((stage, index) => {
    const items = resources.filter((r) => r.stage === stage.id);
    if (!items.length) return '';
    return `<section><h2>${index + 1}. ${esc(stage.name)} <span class="en">(${esc(stage.english)})</span></h2>${items.map((r) => resourceHtml(r, ctx)).join('\n')}</section>`;
  }).join('\n');
  const usesWikipedia = resources.some((r) => ctx.fragments(r.citations.flatMap((c) => c.fragmentIds))
    .some((f) => /wikipedia/i.test(ctx.documentName(f.documentId))));
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Secuencia 5E · ${esc(ctx.courseName)}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;max-width:820px;margin:32px auto;padding:0 20px;color:#1a211e;line-height:1.55}
h1{font-size:26px;margin-bottom:4px}h2{font-size:21px;border-bottom:2px solid #1f5c4a;padding-bottom:4px;margin-top:36px}
h3{font-size:17px;margin:22px 0 4px}.en{font-weight:normal;color:#4a544f;font-size:15px}.meta,.src{color:#4a544f;font-size:13px}
article{page-break-inside:avoid;border-left:3px solid #dcd7cc;padding-left:14px}.options{list-style:none;padding-left:0}
.options li{margin:6px 0}.letter{font-weight:bold}.key{color:#1f5c4a}.feedback{font-size:13px;color:#4a544f;margin-left:22px}
.evidence{font-size:13px}.quote{font-style:italic}details summary{cursor:pointer;font-size:14px;color:#1f5c4a}
footer{margin-top:40px;font-size:12px;color:#4a544f;border-top:1px solid #dcd7cc;padding-top:8px}
</style>
</head>
<body>
<h1>Secuencia didáctica 5E</h1>
<p class="meta">${esc(ctx.courseName)} · ${resources.length} recurso(s) aprobado(s) por el docente · ${esc(date.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' }))}</p>
${sections}
<footer>Generado con Plataforma 5E a partir del material del docente y revisado por el docente antes de su uso.${usesWikipedia ? ' Incluye texto de Wikipedia, disponible bajo la licencia CC BY-SA 4.0.' : ''}</footer>
</body>
</html>
`;
}
