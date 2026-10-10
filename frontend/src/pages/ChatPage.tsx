import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, CardHeader, Checkbox, PageHeader, SelectField, TextField } from '../components/ui';
import { STAGES } from '../data/catalog';
import { chatService, EMPTY_CHAT_DRAFT, interpretChat, MODALITIES, validateChatDraft, type ChatDraft } from '../services/chatService';
import { useAppState } from '../store/store';

export function ChatPage() {
  const courses = useAppState((s) => s.courses);
  const units = useAppState((s) => s.units);
  const [draft, setDraft] = useState<ChatDraft>({ ...EMPTY_CHAT_DRAFT, modalities: [] });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'Asistente de demostración', text: 'Describe el curso, unidad, público o ciclo, competencia, modalidad y cantidad. Te mostraré la interpretación para que la corrijas. No se genera ni se aprueba material desde este chat.' },
  ]);
  const navigate = useNavigate();
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);
  const missing = validateChatDraft(draft);
  const update = <K extends keyof ChatDraft>(key: K, value: ChatDraft[K]) => {
    setError('');
    setDraft((d) => ({ ...d, [key]: value, ...(key === 'courseId' ? { unitId: '' } : {}) }));
  };
  const send = () => {
    if (!message.trim()) { setError('Escribe una solicitud antes de enviarla.'); return; }
    const result = interpretChat(message.trim(), draft);
    setMessages((list) => [...list, { role: 'Docente', text: message.trim() }, { role: 'Asistente de demostración', text: result.reply }]);
    setDraft(result.draft); setMessage(''); setError('');
  };
  const confirm = () => {
    try { chatService.confirm(draft); navigate('/configuracion'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Revisa la solicitud.'); }
  };
  return <>
    <PageHeader overline="Paso 2 · Solicitud por chat" title="Solicitud por chat" description="Describe lo que necesitas y revisa la interpretación antes de continuar a la secuencia 5E." />
    <Alert title="Interpretación local de demostración">
      Este prototipo reconoce expresiones y campos por reglas. Todavía no usa un modelo de IA ni RAG. Los datos no reconocidos se completan en el resumen.
    </Alert>
    <div className="split chat-layout">
      <Card>
        <CardHeader title="Conversemos sobre tu clase" description="Puedes enviar una solicitud y luego corregirla con otro mensaje." />
        <div ref={logRef} className="chat-log" tabIndex={0} role="log" aria-label="Conversación de solicitud" aria-live="polite" aria-relevant="additions">
          {messages.map((m, i) => <div key={i} className={`chat-message${m.role === 'Docente' ? ' chat-message--teacher' : ''}`}>
            <strong className="caption">{m.role}</strong><p>{m.text}</p>
          </div>)}
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <TextField label="Tu solicitud o corrección" value={message} onChange={setMessage} multiline rows={4} maxLength={1500}
            hint={`Ejemplo: Curso: ${courses[0]?.code ?? "código del curso"}; Unidad: 2; Público: estudiantes de tercer ciclo; Competencia: pensamiento crítico; Modalidad: Textual; Cantidad: 2; Etapa: Engage. Usa una unidad de tu catálogo.`} />
          <Button type="submit" variant="primary">Enviar mensaje</Button>
        </form>
      </Card>
      <Card as="aside" aria-labelledby="chat-summary">
        <CardHeader id="chat-summary" title="Interpretación editable" description="Confirma los datos. Puedes corregir cualquiera antes de continuar." />
        <div className="stack">
          <SelectField label="Curso interpretado" value={draft.courseId} onChange={(v) => update('courseId', v)} options={[{ value: '', label: 'Selecciona un curso' }, ...courses.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))]} />
          <SelectField label="Unidad interpretada" value={draft.unitId} onChange={(v) => update('unitId', v)} disabled={!draft.courseId} options={[{ value: '', label: 'Selecciona una unidad' }, ...units.filter((u) => u.courseId === draft.courseId).map((u) => ({ value: u.id, label: `Unidad ${u.number}: ${u.title}` }))]} />
          <TextField label="Público / ciclo interpretado" value={draft.audience} onChange={(v) => update('audience', v)} maxLength={200} />
          <TextField label="Competencia interpretada" value={draft.competency} onChange={(v) => update('competency', v)} maxLength={200} />
          <fieldset className="fieldset"><legend className="fieldset__legend">Modalidad interpretada</legend>
            <div className="grid grid--auto">{MODALITIES.map((m) => <Checkbox key={m} label={m} checked={draft.modalities.includes(m)} onChange={(checked) => update('modalities', checked ? [...draft.modalities, m] : draft.modalities.filter((v) => v !== m))} />)}</div>
          </fieldset>
          <TextField label="Cantidad interpretada" value={draft.quantity} onChange={(v) => update('quantity', v)} type="number" min={1} max={5} step={1} hint="De 1 a 5 recursos por generación en el prototipo." />
          <SelectField label="Etapa inicial 5E" value={draft.stage} onChange={(v) => update('stage', v as ChatDraft['stage'])} options={STAGES.map((s) => ({ value: s.id, label: `${s.name} (${s.english})` }))} hint="Continúa por las etapas desde Configuración. La generación sigue simulada." />
          <div role="status" className="caption">{missing.length ? `Por completar: ${missing.join(', ')}.` : 'Datos completos. Listos para tu confirmación.'}</div>
          <Button variant="primary" onClick={confirm} disabled={missing.length > 0}>Confirmar y continuar a configuración</Button>
          <Button onClick={() => { setDraft({ ...EMPTY_CHAT_DRAFT, modalities: [] }); setMessages((list) => [list[0]]); setMessage(''); setError(''); }}>Nueva solicitud</Button>
        </div>
      </Card>
    </div>
    {error && <Alert tone="warn" title="Revisa tu solicitud" role="alert">{error}</Alert>}
  </>;
}
