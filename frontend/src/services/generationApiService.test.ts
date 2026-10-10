import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestGeneration, toApiRequest, validateApiGeneration } from './generationApiService';
import { generationService } from './generationService';
import { getState, resetState } from '../store/store';
import { preferencesService } from './preferencesService';
import { DEMO_DOCUMENTS, DEMO_FRAGMENTS, EXAMPLES } from '../data/demoContent';
import { instantiateExample } from '../store/initialState';
import type { GenerationRequest } from '../types';
const input: Omit<GenerationRequest,'id'|'createdAt'> = {unitId:'u2',outcomeId:null,stage:'explore',resourceType:'guia_exploracion',quantity:1,difficulty:'intermedia',optionCount:4,topK:10,evidenceThreshold:.6,instructions:'',audience:'Tercer ciclo',competency:'Pensamiento crítico',modalities:['Textual']};
function response() {
  const r = { ...instantiateExample(EXAMPLES.find((e) => e.unitId === 'u2' && e.type === 'guia_exploracion')!, 'sol-api-test', new Date().toISOString()), source: 'api_demo' };
  return {mode:'api_demo',notice:'Datos ficticios.',request:{...input,id:'sol-api-test',createdAt:r.createdAt},resources:[r],available:1,fragments:DEMO_FRAGMENTS.filter((f)=>f.unitId==='u2'),documents:DEMO_DOCUMENTS.filter((d)=>d.unitId==='u2')};
}
beforeEach(()=>resetState());afterEach(()=>vi.unstubAllGlobals());
describe('HU-053 frontera HTTP',()=>{
  it('mapea los parámetros al contrato del backend',()=>{expect(toApiRequest(input)).toMatchObject({unidad_id:'u2',etapa_5e:'explore',cantidad:1,publico_objetivo:'Tercer ciclo',modalidades:['Textual']});});
  it('integra una respuesta válida conservando las propuestas previas',async()=>{
    const previous=getState().resources;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(response()),{status:200})));
    preferencesService.update('generationMode','api_demo');
    expect((await generationService.generate(input)).kind).toBe('ok');
    expect(getState().resources).toHaveLength(previous.length+1);
    expect(getState().resources.slice(1)).toEqual(previous);
    expect(getState().resources[0].status).toBe('pendiente');
    expect(getState().ui.reviewFilters).toEqual({unitId:'u2',stage:'explore',status:'pendiente'});
    expect(getState().apiFragments?.length).toBeGreaterThan(0);
  });
  it.each(['CONEXION_FALLIDA','EVIDENCIA_INSUFICIENTE','RESPUESTA_INVALIDA'])('fallo %s no altera recursos ni solicitudes',async(code)=>{
    const before=getState();
    const fetcher=vi.fn();
    if(code==='CONEXION_FALLIDA')fetcher.mockRejectedValue(new TypeError('offline'));
    else fetcher.mockResolvedValue(new Response(JSON.stringify(code==='RESPUESTA_INVALIDA'?{resources:[]}:{error:{codigo:code,mensaje:'Sin evidencia'}}),{status:code==='RESPUESTA_INVALIDA'?200:400}));
    vi.stubGlobal('fetch',fetcher);preferencesService.update('generationMode','api_demo');
    expect(await generationService.generate(input)).toMatchObject({kind:'error',code});
    expect(getState().resources).toBe(before.resources);expect(getState().requests).toBe(before.requests);
  });
  it('rechaza una propuesta ya aprobada y una evidencia inexistente',()=>{
    const approved=response();approved.resources[0].status='aprobado';
    expect(()=>validateApiGeneration(approved,input)).toThrow('incompatible');
    const badEvidence=response();badEvidence.resources[0].citations[0].fragmentIds=['inexistente'];
    expect(()=>validateApiGeneration(badEvidence,input)).toThrow('incompatible');
  });
  it('informa parámetros inválidos y respuesta no JSON',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:[]}),{status:422})));
    await expect(requestGeneration(input)).rejects.toMatchObject({code:'HTTP_422'});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('Internal error',{status:500})));
    await expect(requestGeneration(input)).rejects.toMatchObject({code:'API_NO_DISPONIBLE'});
  });
  it('interrumpe una solicitud lenta y permite reintentar',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('abort'))))));
    const check=expect(requestGeneration(input)).rejects.toMatchObject({code:'TIEMPO_AGOTADO'});
    await vi.advanceTimersByTimeAsync(10001);await check;vi.useRealTimers();
  });
});
