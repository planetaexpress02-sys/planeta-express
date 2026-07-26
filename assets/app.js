/* ==========================================================================
   PLANETA EXPRESS — Sistema de Gestão Operacional  (v2.0)
   Aplicação principal — JavaScript puro, 100% offline
   ========================================================================== */
'use strict';

/* ================================================================== */
/*  1. BASE DE DADOS (localStorage)                                    */
/* ================================================================== */
const KEY = 'pex_db_v4';
const CFG_KEY = 'pex_config';   /* preferências persistem separadas -> sobrevivem às atualizações */
let DB = null;

let _applyingRemote=false, _nuvemSaveTimer=null;
function ensureCollections(){
  if(!DB.config) DB.config = clone(SEED.config);
  ['alertaCritico','alertaAtencao','alertaKm','alertaHora','sulcoMinimo','finPin'].forEach(k=>{ if(DB.config[k]==null) DB.config[k]=SEED.config[k]; });
  ['notas','checklists','pneus','viagens','descargas','abastecimentos','faturamento','vales','ctes','servicos','anexos'].forEach(k=>{ if(!Array.isArray(DB[k])) DB[k]=clone(SEED[k]||[]); });
  if(!DB.checklistModelo) DB.checklistModelo = clone(SEED.checklistModelo);
  if(!Array.isArray(DB.arquivos)) DB.arquivos = (typeof ARQUIVOS_EMPRESA!=='undefined'? clone(ARQUIVOS_EMPRESA):[]);
  if(!Array.isArray(DB.motoristas)) DB.motoristas=clone(SEED.motoristas);
  DB.motoristas.forEach(m=>{ if(m.endereco===undefined)m.endereco=''; if(m.socio===undefined)m.socio=false; });
  importarManutencaoPlanilhas();
  corrigirValoresAntigos();
}
/* Importa (uma vez) as manutenções extraídas das planilhas de Relatório de Manutenção.
   Não duplica: cada registro tem id fixo (mi_...). Roda em qualquer aparelho e sincroniza. */
function importarManutencaoPlanilhas(){
  if(typeof MANUT_SEED==='undefined' || !Array.isArray(MANUT_SEED)) return;
  if(!Array.isArray(DB.servicos)) DB.servicos=[];
  const porId={}; DB.servicos.forEach(s=>{ porId[s.id]=s; });
  MANUT_SEED.forEach(r=>{
    const ex=porId[r.id];
    if(!ex){ DB.servicos.push(Object.assign({},r)); }
    else if(!ex.tipo){ ex.tipo=r.tipo; if(!ex.obs&&r.obs) ex.obs=r.obs; }  // preenche o tipo em quem foi importado antes
  });
  DB.servicos.forEach(s=>{ if(!s.tipo) s.tipo='Corretiva'; });  // qualquer serviço sem tipo vira Corretiva por padrão
}
/* Conserta valores gravados errados pelo bug antigo (÷1000). Só mexe em valor
   com mais de 2 casas decimais (assinatura da corrupção); valores corretos ficam intactos. */
function fixMoney1000(v){ const n=Number(v); if(!n||isNaN(n)) return n;
  if(Math.abs(n*100 - Math.round(n*100)) > 0.01){ return Math.round(n*1000*100)/100; }
  return n; }
function corrigirValoresAntigos(){
  (DB.notas||[]).forEach(n=>{ ['alexandria','notasGerais','combustivel'].forEach(k=>{ if(n[k]!=null) n[k]=fixMoney1000(n[k]); }); });
  [['faturamento','valor'],['vales','valor'],['ctes','valor'],['servicos','valor'],['descargas','valor'],['baterias','valor'],['abastecimentos','valor']]
    .forEach(([col,f])=>{ (DB[col]||[]).forEach(x=>{ if(x[f]!=null) x[f]=fixMoney1000(x[f]); }); });
}
function loadDB(){
  const raw = localStorage.getItem(KEY);
  if(raw){ try{ DB = JSON.parse(raw); }catch(e){ DB = clone(SEED); } }
  else { DB = clone(SEED); }
  ensureCollections();
  // Preferências salvas separadamente têm prioridade (não se perdem entre versões)
  try{ const sc=localStorage.getItem(CFG_KEY); if(sc){ DB.config=Object.assign(DB.config, JSON.parse(sc)); } }catch(e){}
  saveLocal();
}
function saveLocal(){
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){}
  try{ localStorage.setItem(CFG_KEY, JSON.stringify(DB.config)); }catch(e){}
}
function saveDB(){
  saveLocal();
  // Modo online: envia para a nuvem (com pequeno atraso, para agrupar edições)
  if(typeof nuvemAtiva==='function' && nuvemAtiva() && nuvemUser && nuvemUser() && !_applyingRemote){
    clearTimeout(_nuvemSaveTimer);
    _nuvemSaveTimer=setTimeout(()=>{ nuvemSalvar(DB).catch(()=>{}); }, 700);
  }
}
/* Garante que a última edição vá para a nuvem AGORA (ao fechar/trocar de aba) */
function flushNuvem(){
  if(_nuvemSaveTimer){ clearTimeout(_nuvemSaveTimer); _nuvemSaveTimer=null; }
  if(typeof nuvemAtiva==='function' && nuvemAtiva() && nuvemUser && nuvemUser()){
    try{ nuvemSalvar(DB); }catch(e){}
  }
}
/* Recebe uma atualização de outro aparelho (tempo real) */
function aplicarRemoto(obj){
  if(!obj) return;
  _applyingRemote=true;
  DB=obj; ensureCollections(); saveLocal();
  _applyingRemote=false;
  const ov=document.getElementById('overlay');
  if(!ov || !ov.classList.contains('show')){ renderSidebar((location.hash||'#inicio').slice(1).split('/')[0]); router(); }
  toast('Dados atualizados (outro aparelho).');
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function uid(p){ return p + Math.random().toString(36).slice(2,8); }

/* ================================================================== */
/*  2. ARQUIVOS (IndexedDB — uploads reais: PDF, JPG, Word, NF...)     */
/* ================================================================== */
let IDB = null, FILES = [];
function idbOpen(){
  return new Promise((res,rej)=>{
    const rq = indexedDB.open('pex_files', 1);
    rq.onupgradeneeded = ()=>{ rq.result.createObjectStore('files',{keyPath:'id'}); };
    rq.onsuccess = ()=>{ IDB=rq.result; res(); };
    rq.onerror = ()=>rej(rq.error);
  });
}
function idbAll(){
  return new Promise((res)=>{
    if(!IDB) return res([]);
    const tx = IDB.transaction('files','readonly').objectStore('files').getAll();
    tx.onsuccess = ()=>res(tx.result||[]);
    tx.onerror = ()=>res([]);
  });
}
function idbPut(rec){ return new Promise((res)=>{ IDB.transaction('files','readwrite').objectStore('files').put(rec).onsuccess=()=>res(); }); }
function idbDel(id){ return new Promise((res)=>{ IDB.transaction('files','readwrite').objectStore('files').delete(id).onsuccess=()=>res(); }); }
async function reloadFiles(){ FILES = await idbAll(); }
/* Lista unificada: anexos da nuvem (sincronizados) + arquivos locais ainda não na nuvem */
function todosArquivos(){
  const cloud=(DB&&DB.anexos)?DB.anexos.slice():[];
  const ids=new Set(cloud.map(a=>a.id));
  const locais=FILES.filter(f=>!ids.has(f.id)).map(f=>({id:f.id,name:f.name,type:f.type,size:f.size,categoria:f.categoria,entidade:f.entidade,refId:f.refId,validade:f.validade||'',uploadedAt:f.uploadedAt,storagePath:'',_local:true}));
  return cloud.concat(locais);
}
function arquivoPorId(id){ return todosArquivos().find(a=>a.id===id); }
function filesDe(entidade, refId){ return todosArquivos().filter(f=>f.entidade===entidade && f.refId===refId); }
function totalArquivos(){ return todosArquivos().length; }
/* Procura um arquivo anexado (enviado na plataforma) de um tipo para um registro */
function anexoTipo(ent, ref, re){ return todosArquivos().find(f=>f.entidade===ent && f.refId===ref && re.test(((f.categoria||'')+' '+(f.name||'')))); }
/* Selo verde "Anexado" (clicável p/ ver) OU botão "Anexar" */
function badgeAnexo(ent, ref, re, categoria){
  const f=anexoTipo(ent,ref,re);
  if(f) return `<span class="st ok" style="cursor:pointer" title="Ver ${esc(f.name)}" onclick="event.stopPropagation();verArquivo('${f.id}')">${svg('clip')} Anexado</span>`;
  return `<button class="btn ghost sm no-print" onclick="event.stopPropagation();uploadPara('${ent}','${ref}','${esc(categoria)}')">${svg('upload')} Anexar</button>`;
}

/* ================================================================== */
/*  3. UTILIDADES                                                      */
/* ================================================================== */
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_L = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

function hoje(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function parseD(s){ if(!s) return null; const p=String(s).split('-'); if(p.length!==3) return null; return new Date(+p[0],+p[1]-1,+p[2]); }
function fmtD(s){ const d=parseD(s); if(!d) return '—'; return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
function fmtDLong(s){ const d=parseD(s); if(!d) return '—'; return d.getDate()+' de '+MESES_L[d.getMonth()]+' de '+d.getFullYear(); }
function diasAte(s){ const d=parseD(s); if(!d) return null; return Math.round((d-hoje())/86400000); }
function money(v){ if(v==null||v==='') return '—'; return 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function num(v){ if(v==null||v==='') return '—'; return Number(v).toLocaleString('pt-BR'); }
function moneyK(v){ v=Number(v)||0; if(v>=1000) return 'R$ '+(v/1000).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1})+'k'; return 'R$ '+v.toLocaleString('pt-BR'); }
function initials(nome){ const p=(nome||'?').trim().split(/\s+/); return ((p[0]||'')[0]||'')+((p[p.length-1]||'')[0]||''); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fileSize(b){ if(!b) return ''; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(0)+' KB'; return (b/1048576).toFixed(1)+' MB'; }

/* ---------- PONTUAÇÃO AUTOMÁTICA (deixa CPF, RG, telefone... profissional) ---------- */
function maskCPF(v){ const raw=String(v==null?'':v); const d=raw.replace(/\D/g,'').slice(0,11);
  if(d.length!==11) return raw; return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); }
function maskCNPJ(v){ const raw=String(v==null?'':v); const d=raw.replace(/\D/g,'').slice(0,14);
  if(d.length!==14) return raw; return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'); }
function maskFone(v){ const raw=String(v==null?'':v); const d=raw.replace(/\D/g,'').slice(0,11);
  if(d.length===11) return d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  if(d.length===10) return d.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3');
  return raw; }
function maskRG(v){ const raw=String(v==null?'':v); const d=raw.replace(/[^\dxX]/g,'');
  if(d.length===9) return d.replace(/(\d{2})(\d{3})(\d{3})([\dxX])/,'$1.$2.$3-$4').toUpperCase();
  if(d.length===8) return d.replace(/(\d{1})(\d{3})(\d{3})([\dxX])/,'$1.$2.$3-$4').toUpperCase();
  return raw; }
function maskCEP(v){ const raw=String(v==null?'':v); const d=raw.replace(/\D/g,'').slice(0,8);
  if(d.length===8) return d.replace(/(\d{5})(\d{3})/,'$1-$2'); return raw; }
/* Campo com pontuação automática enquanto digita (usa data-mask + listener global) */
function fldMask(label,id,v,mask,hint){
  return `<div class="field"><label>${label}</label><input id="${id}" type="text" data-mask="${mask}" value="${esc(v==null?'':v)}">${hint?`<div class="hint">${hint}</div>`:''}</div>`; }
const _MASKFN={cpf:maskCPF,cnpj:maskCNPJ,fone:maskFone,rg:maskRG,cep:maskCEP};
function aplicarMascaraInput(e){ const el=e.target; if(!el||!el.getAttribute) return;
  const m=el.getAttribute('data-mask'); const fn=_MASKFN[m]; if(!fn) return;
  const before=el.value, after=fn(before);
  if(after!==before){ const end=el.selectionStart===before.length; el.value=after; if(end){ try{ el.setSelectionRange(after.length,after.length); }catch(_){} } } }

function situacao(validade){
  const dd = diasAte(validade), cfg = DB.config;
  if(dd===null) return {cls:'neutro', label:'Sem data', dias:null, ord:5};
  if(dd < 0) return {cls:'vencido', label:'Vencido há '+Math.abs(dd)+'d', dias:dd, ord:0};
  if(dd <= cfg.alertaCritico) return {cls:'crit', label:'Vence em '+dd+'d', dias:dd, ord:1};
  if(dd <= cfg.alertaAtencao) return {cls:'warn', label:'Vence em '+dd+'d', dias:dd, ord:2};
  return {cls:'ok', label:'Em dia', dias:dd, ord:3};
}
function motorista(id){ return DB.motoristas.find(m=>m.id===id); }
function veiculo(id){ return DB.veiculos.find(v=>v.id===id); }
function veiculoByPlaca(p){ const k=String(p).replace(/[^A-Z0-9]/gi,''); return DB.veiculos.find(v=>v.placa.replace(/[^A-Z0-9]/gi,'')===k); }
function isReb(v){ return v && v.tipo.indexOf('Reboque')>=0; }
function nomeEntidade(v){
  if(v.entidade==='empresa') return DB.empresa.nome;
  if(v.entidade==='motorista'){ const m=motorista(v.refId); return m?m.nome:'—'; }
  if(v.entidade==='veiculo'){ const x=veiculo(v.refId); return x?x.placa:'—'; }
  return '—';
}
/* Vencimentos (NÃO inclui garantia de bateria — essa fica só na aba Baterias) */
function todosVencimentos(){ return DB.vencimentos.slice(); }

/* Cálculo de manutenção por KM / Horas */
function primaryItem(v){
  const items = DB.manutencoes.filter(m=>m.veiculoId===v.id);
  return isReb(v)? items.find(m=>/Kit Filtro/i.test(m.item)) : items.find(m=>/Óleo\s*\/\s*Filtros/i.test(m.item));
}
function manutInfo(m, v){
  const carreta = isReb(v);
  const atual = carreta? v.horaAtual : v.kmAtual;
  const troca = carreta? m.horasTroca : m.kmTroca;
  const prox = carreta? m.proxHoras : m.proxKm;
  if(atual==null || prox==null) return {ok:false, atual, prox, restante:null, pct:0, un:carreta?'h':'km'};
  const restante = prox - atual;
  const total = (prox - (troca!=null?troca:prox)) || 1;
  const consumido = atual - (troca!=null?troca:atual);
  let pct = total>0? (consumido/total*100) : 0;
  pct = Math.max(0, Math.min(100, pct));
  const limite = carreta? DB.config.alertaHora : DB.config.alertaKm;
  let st = 'ok';
  if(restante<=0) st='vencido'; else if(restante<=limite) st='crit'; else if(restante<=limite*2) st='warn';
  return {ok:true, atual, prox, troca, restante, pct, un:carreta?'h':'km', st, limite, carreta};
}

/* ================================================================== */
/*  4. ÍCONES                                                          */
/* ================================================================== */
const IC = {
  dash:'<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  truck:'<path d="M1.5 6.5a1 1 0 0 1 1-1h9.5a1 1 0 0 1 1 1v8H1.5zM13 9.5h3.4a1 1 0 0 1 .8.4l2 2.6a1 1 0 0 1 .3.7v1.3H13z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M1.5 14.5h18" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="17.6" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="17.6" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  user:'<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 1-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.6 2.6-2.2-.4-.4-2.2 2.6-2.6z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  battery:'<rect x="2" y="7" width="17" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M22 10v4M6 10v4M9.5 10v4M13 10v4" stroke="currentColor" stroke-width="1.8"/>',
  doc:'<path d="M6 2h8l4 4v16H6zM14 2v4h4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 13h6M9 17h6" stroke="currentColor" stroke-width="1.7"/>',
  gauge:'<path d="M12 13a2 2 0 1 0 0-.01M12 13l4-4M4 18a9 9 0 1 1 16 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  stetho:'<path d="M6 3v6a4 4 0 0 0 8 0V3M18 13a2 2 0 1 0 0 .01M18 15v2a5 5 0 0 1-10 0v-1" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  gear:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3L10 22h4l.3-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  plus:'<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none"/>',
  edit:'<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  chip:'<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 9h6v6H9zM2 9h2M2 15h2M20 9h2M20 15h2M9 2v2M15 2v2M9 20v2M15 20v2" stroke="currentColor" stroke-width="1.5"/>',
  shield:'<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" fill="none"/>',
  export:'<path d="M12 3v12M8 7l4-4 4 4M4 17v3h16v-3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  import:'<path d="M12 15V3M8 11l4 4 4-4M4 17v3h16v-3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  download:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  print:'<path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  clip:'<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14 7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  tire:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.5"/>',
  check:'<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  alarm:'<path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M5 3 2 6M19 3l3 3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  money:'<rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 9v6M18 9v6" stroke="currentColor" stroke-width="1.6"/>',
  home:'<path d="M3 11l9-7 9 7M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  fuel:'<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 8h3l3 3v6a2 2 0 0 1-4 0v-3h-2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 8h6" stroke="currentColor" stroke-width="1.6"/>',
  route:'<circle cx="6" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4M12 11v10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke="currentColor" stroke-width="1.7" fill="none"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" stroke="currentColor" stroke-width="1.7" fill="none"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16v4M17 11a2 2 0 0 0 0 4h4v-4z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  ctedoc:'<path d="M6 2h9l3 3v17H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2v4h4M9 12h6M9 16h6M9 8h2" stroke="currentColor" stroke-width="1.5"/>',
  idcard:'<rect x="2" y="5" width="20" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="8" cy="11" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.5 16.5c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M14.5 9.5h4M14.5 12.5h4M14.5 15.5h2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  flask:'<path d="M9 3h6M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 14h9" stroke="currentColor" stroke-width="1.5"/>',
  clinic:'<path d="M4 21V9l8-5 8 5v12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9v6M9 12h6" stroke="currentColor" stroke-width="1.8"/><path d="M2 21h20" stroke="currentColor" stroke-width="1.7"/>',
  wheel:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9V4M9.5 14.5 5.5 18M14.5 14.5l4 3.5" stroke="currentColor" stroke-width="1.6"/>',
  taco:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 12l4-3M5 12h2M17 12h2M12 5v2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" fill="currentColor"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" fill="currentColor"/>',
  send:'<path d="M4 12l16-8-6 16-3-6-7-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
/* Ícone por tipo de documento/vencimento */
function tipoIcone(t){
  const m={'CNH':'idcard','Toxicológico':'flask','ASO':'clinic','Tacógrafo':'taco','CRLV':'doc','Vigilância Sanitária':'shield',
    'Opentech Funcionário':'chip','Opentech Veículo':'chip','PCMSO':'clinic','PGR':'shield','Certificado Digital':'chip',
    'Direção Defensiva':'wheel','Seguro':'shield','Rastreador':'chip'};
  return m[t]||'bell';
}
function svg(name,cls){ return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${IC[name]||''}</svg>`; }

/* ================================================================== */
/*  5. GRÁFICOS (SVG nativo)                                           */
/* ================================================================== */
function donut(data, opts){
  opts = opts || {};
  const size = opts.size||160, th = opts.th||24, r=(size-th)/2, cx=size/2, cy=size/2;
  const C = 2*Math.PI*r;
  const total = data.reduce((s,d)=>s+d.value,0);
  let off = 0;
  const arcs = total? data.filter(d=>d.value>0).map(d=>{
    const len = d.value/total*C;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${th}"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
    off += len; return seg;
  }).join('') : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8edf3" stroke-width="${th}"/>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef1f6" stroke-width="${th}"/>
    ${arcs}
    <text x="${cx}" y="${cy-2}" text-anchor="middle" class="donut-c">${opts.center!=null?opts.center:total}</text>
    <text x="${cx}" y="${cy+16}" text-anchor="middle" class="donut-s">${esc(opts.sub||'')}</text>
  </svg>`;
}
function barChart(data, opts){
  opts=opts||{}; const h=opts.h||150, w=opts.w||420, pad=26, bw=(w-pad*2)/data.length*0.55, gap=(w-pad*2)/data.length;
  const max = Math.max(1,...data.map(d=>d.value));
  const bars = data.map((d,i)=>{
    const bh = d.value/max*(h-34);
    const x = pad + i*gap + (gap-bw)/2, y = h-24-bh;
    const clk = d.js? ` class="bar-clk" onclick="${d.js}"` : (d.hash? ` class="bar-clk" onclick="location.hash='${d.hash}'"` : '');
    return `<g${clk}>
      ${d.hash?`<rect x="${pad+i*gap}" y="0" width="${gap}" height="${h}" fill="transparent"/>`:''}
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${d.color||'url(#bg)'}"/>
      ${d.value?`<text x="${x+bw/2}" y="${y-5}" text-anchor="middle" class="bar-val">${d.vtxt!=null?esc(d.vtxt):d.value}</text>`:''}
      <text x="${x+bw/2}" y="${h-8}" text-anchor="middle" class="bar-lbl">${esc(d.label)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="barchart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
    ${bars}</svg>`;
}

/* ================================================================== */
/*  6. ROTEADOR                                                        */
/* ================================================================== */
const ROTAS = {
  inicio:{t:'Início', s:'Página inicial da empresa', ico:'home'},
  dashboard:{t:'Painel de Controle', s:'Visão geral da operação', ico:'dash'},
  frota:{t:'Frota', s:'Cavalos e reboques frigoríficos', ico:'truck'},
  motoristas:{t:'Motoristas', s:'Colaboradores e documentação', ico:'user'},
  exames:{t:'Exames', s:'ASO, Toxicológico e Opentech', ico:'clinic'},
  direcao:{t:'Direção Defensiva', s:'Certificados dos motoristas', ico:'wheel'},
  tacografos:{t:'Tacógrafos', s:'Aferição dos veículos', ico:'taco'},
  vencimentos:{t:'Vencimentos', s:'Agenda de validades e alertas', ico:'bell'},
  km:{t:'KM / Horas', s:'Atualize e acompanhe as próximas trocas', ico:'gauge'},
  oleo:{t:'Trocas de Óleo', s:'Óleo e filtros por veículo', ico:'wrench'},
  manutencao:{t:'Relatório de Manutenção', s:'Serviços e reparos', ico:'wrench'},
  pneus:{t:'Pneus', s:'Controle de pneus por posição', ico:'tire'},
  baterias:{t:'Baterias', s:'Controle e garantias', ico:'battery'},
  abastecimento:{t:'Abastecimentos', s:'Consumo e médias por veículo', ico:'fuel'},
  viagens:{t:'Viagens', s:'Controle de viagens BRF', ico:'route'},
  descargas:{t:'Descargas', s:'Senhas e valores de descarga', ico:'box'},
  ctes:{t:'CT-e', s:'Conhecimentos de transporte emitidos', ico:'ctedoc'},
  checklist:{t:'Check-list', s:'Inspeção de frota (cavalo e carreta)', ico:'check'},
  alarmes:{t:'Alarmes Thermo King', s:'Códigos, causas e soluções', ico:'alarm'},
  notas:{t:'Notas de Despesa', s:'Despesas somadas por período', ico:'money'},
  documentos:{t:'Documentos', s:'Arquivos da empresa — abrir e baixar', ico:'doc'},
  socios:{t:'Quadro Societário', s:'Sócios, fotos e documentos', ico:'briefcase'},
  etica:{t:'Código de Ética', s:'Conduta e normas da empresa', ico:'shield'},
  financeiro:{t:'Financeiro', s:'Faturamento, vales e pagamentos', ico:'lock'},
  config:{t:'Configurações', s:'Preferências e backup', ico:'gear'},
};
function go(h){ location.hash=h; }
function router(){
  const h = (location.hash||'#inicio').slice(1);
  const [rota, arg] = h.split('/');
  renderSidebar(rota);
  const meta = ROTAS[rota] || ROTAS.inicio;
  let titulo = meta.t, sub = meta.s;
  const el = document.getElementById('view');
  el.style.opacity=0; setTimeout(()=>{ el.style.opacity=1; },20);

  if(rota==='frota' && arg){ const v=veiculo(arg); if(v){ titulo=v.placa; sub=v.marca+' '+v.modelo; } el.innerHTML=viewVeiculo(arg); }
  else if(rota==='motoristas' && arg){ const m=motorista(arg); if(m){ titulo=m.nome; sub=m.funcao; } el.innerHTML=viewMotorista(arg); }
  else if(rota==='frota') el.innerHTML=viewFrota();
  else if(rota==='motoristas') el.innerHTML=viewMotoristas();
  else if(rota==='exames') el.innerHTML=viewExames();
  else if(rota==='direcao') el.innerHTML=viewDirecao();
  else if(rota==='tacografos') el.innerHTML=viewTacografos();
  else if(rota==='vencimentos'){ if(arg) vencFiltro=arg; el.innerHTML=viewVencimentos(); }
  else if(rota==='km') el.innerHTML=viewKM();
  else if(rota==='oleo') el.innerHTML=viewOleo();
  else if(rota==='manutencao') el.innerHTML=viewManutencao();
  else if(rota==='pneus') el.innerHTML=viewPneus();
  else if(rota==='baterias') el.innerHTML=viewBaterias();
  else if(rota==='abastecimento') el.innerHTML=viewAbastecimento();
  else if(rota==='viagens') el.innerHTML=viewViagens();
  else if(rota==='descargas') el.innerHTML=viewDescargas();
  else if(rota==='ctes') el.innerHTML=viewCtes();
  else if(rota==='checklist') el.innerHTML=viewChecklist();
  else if(rota==='alarmes') el.innerHTML=viewAlarmes();
  else if(rota==='notas') el.innerHTML=viewNotas();
  else if(rota==='documentos'){ if(arg) docFiltroEnt=arg; el.innerHTML=viewDocumentos(); }
  else if(rota==='socios') el.innerHTML=viewSocios();
  else if(rota==='financeiro') el.innerHTML=viewFinanceiro();
  else if(rota==='etica') el.innerHTML=viewEtica();
  else if(rota==='inicio') el.innerHTML=viewInicio();
  else if(rota==='config') el.innerHTML=viewConfig();
  else if(rota==='dashboard') el.innerHTML=viewDashboard();
  else el.innerHTML=viewInicio();

  document.getElementById('pageTitle').innerHTML = esc(titulo)+'<small>'+esc(sub)+'</small>';
  window.scrollTo(0,0); closeSidebar(); if(typeof updateUserBadge==='function') updateUserBadge();
}

/* ================================================================== */
/*  7. SIDEBAR                                                         */
/* ================================================================== */
function contadores(){
  let venc=0, crit=0;
  todosVencimentos().forEach(v=>{ const s=situacao(v.validade); if(s.ord===0) venc++; else if(s.ord===1) crit++; });
  return {venc, crit, total:venc+crit};
}
function renderSidebar(rota){
  const c = contadores();
  const item=(k,badge)=>{ const m=ROTAS[k];
    const b = badge?`<span class="badge ${badge.cls}">${badge.n}</span>`:'';
    return `<a href="#${k}" class="${rota===k?'active':''}">${svg(m.ico,'ico')}<span>${m.t}</span>${b}</a>`; };
  document.getElementById('nav').innerHTML =
    `<div class="group">Principal</div>`+ item('inicio')+ item('dashboard')+
    item('vencimentos', c.total?{n:c.total, cls:c.venc?'':'warn'}:null)+
    `<div class="group">Cadastros</div>`+ item('frota')+ item('motoristas')+ item('exames')+ item('direcao')+
    `<div class="group">Manutenção</div>`+ item('km')+ item('oleo')+ item('manutencao')+ item('pneus')+ item('baterias')+ item('abastecimento')+ item('tacografos')+
    `<div class="group">Operação</div>`+ item('viagens')+ item('descargas')+ item('ctes')+ item('checklist')+ item('notas')+ item('alarmes')+ item('documentos')+
    `<div class="group">Financeiro</div>`+ item('financeiro')+
    `<div class="group">Empresa</div>`+ item('socios')+ item('etica')+
    `<div class="group">Sistema</div>`+ item('config');
}

/* ================================================================== */
/*  8. COMPONENTES                                                     */
/* ================================================================== */
function kpi(ico,cor,val,label,sub,href){
  return `<a class="kpi ${href?'link':''}" ${href?`href="${href}"`:''}>
    <div class="k-top"><div class="k-ico ${cor}">${svg(ico)}</div>${href?'<span class="k-go">→</span>':''}</div>
    <div class="k-val">${val}</div><div class="k-label">${label}</div>${sub?`<div class="k-sub">${sub}</div>`:''}</a>`;
}
function stBadge(validade){ const s=situacao(validade); return `<span class="st ${s.cls}">${s.label}</span>`; }
function plate(placa,tipo){ const cls=(tipo&&tipo.indexOf('Reboque')>=0)?'plate rebo':'plate'; return `<span class="${cls}">${esc(placa)}</span>`; }
function emptyState(txt){ return `<div class="empty">${svg('folder')}<b>Nada por aqui</b><span>${esc(txt)}</span></div>`; }
function avatarFoto(m, size){ size=size||56;
  const st=`width:${size}px;height:${size}px;font-size:${size*0.34}px`;
  if(m.foto) return `<div class="avatar photo" style="${st}"><img src="${esc(m.foto)}" alt="" onerror="this.parentNode.classList.remove('photo');this.parentNode.textContent='${esc(initials(m.nome).toUpperCase())}'"></div>`;
  return `<div class="avatar" style="${st}">${esc(initials(m.nome).toUpperCase())}</div>`;
}

/* ================================================================== */
/*  9. DASHBOARD                                                       */
/* ================================================================== */
function viewDashboard(){
  const vs = todosVencimentos().map(v=>({v, s:situacao(v.validade)}));
  const venc = vs.filter(x=>x.s.ord===0), crit = vs.filter(x=>x.s.ord===1), aten = vs.filter(x=>x.s.ord===2), emdia=vs.filter(x=>x.s.ord===3);
  const cavalos = DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado').length;
  const reb = DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado').length;
  const motAtivos = DB.motoristas.filter(m=>m.status==='Ativo').length;

  const prox = vs.filter(x=>x.s.dias!==null && x.s.dias<=90).sort((a,b)=>a.s.dias-b.s.dias).slice(0,8);

  // Vencimentos próximos 6 meses (por mês)
  const meses=[]; const now=hoje();
  for(let i=0;i<6;i++){ const d=new Date(now.getFullYear(),now.getMonth()+i,1); meses.push({y:d.getFullYear(),m:d.getMonth(),label:MESES[d.getMonth()],value:0}); }
  vs.forEach(x=>{ const d=parseD(x.v.validade); if(!d) return; meses.forEach(mm=>{ if(d.getFullYear()===mm.y && d.getMonth()===mm.m) mm.value++; }); });

  // Manutenções que precisam de atenção
  const manutAlerta = DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>{ const p=primaryItem(v); if(!p) return null; const info=manutInfo(p,v); return info.ok?{v,p,info}:null; })
    .filter(x=>x && (x.info.st==='vencido'||x.info.st==='crit')).sort((a,b)=>a.info.restante-b.info.restante);

  const alertIco=(cls)=>{ const map={vencido:['i-red','!'],crit:['i-orange','!'],warn:['i-amber','•'],ok:['i-green','✓'],neutro:['i-blue','•']}; const [c,e]=map[cls]||map.neutro; return `<div class="a-ico ${c}">${e}</div>`; };

  // Indicadores complementares
  const notasOrd = DB.notas.slice().sort((a,b)=>(b.fim||'').localeCompare(a.fim||''));
  const ultNota = notasOrd[0]; const ultNotaTotal = ultNota? totalNota(ultNota):0;
  const pneusAlerta = DB.pneus.filter(p=>p.sulco!=null&&p.sulco!==''&&Number(p.sulco)<=DB.config.sulcoMinimo).length;
  const chkMes = DB.checklists.filter(c=>{ const d=parseD(c.data),h=hoje(); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).length;
  const chkUlt = DB.checklists.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,5);
  const tipos={Cavalos:cavalos,Reboques:reb};
  // Últimos 6 meses (viagens e despesas) — para gráficos clicáveis
  const now2=hoje(); const ult6=[];
  for(let i=5;i>=0;i--){ const d=new Date(now2.getFullYear(),now2.getMonth()-i,1); ult6.push({ym:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), label:MESES[d.getMonth()]}); }
  const viagensMes=ult6.map(m=>({label:m.label, value:DB.viagens.filter(v=>(v.data||'').slice(0,7)===m.ym).length, js:"viagemMes='"+m.ym+"';location.hash='viagens'"}));
  const despMes=ult6.map(m=>({label:m.label, value:Math.round(DB.notas.filter(n=>(n.fim||'').slice(0,7)===m.ym).reduce((s,n)=>s+totalNota(n),0)), color:'url(#bg)', js:"location.hash='notas'"}));
  const vSitData=[{label:'Pendentes',value:DB.viagens.filter(v=>v.status==='Pendente').length,color:'#c99a2e'},{label:'Concluídas',value:DB.viagens.filter(v=>v.status==='Concluída').length,color:'#0f766e'},{label:'Canceladas',value:DB.viagens.filter(v=>v.status==='Cancelada').length,color:'#9f1239'}];

  return `
  <div class="grid kpis">
    ${kpi('truck','i-blue', cavalos+reb, 'Veículos ativos', cavalos+' cavalos · '+reb+' reboques', '#frota')}
    ${kpi('user','i-green', motAtivos, 'Motoristas ativos', DB.motoristas.length+' cadastrados', '#motoristas')}
    ${kpi('bell','i-orange', crit.length, 'Vencimentos críticos', 'Próximos '+DB.config.alertaCritico+' dias', '#vencimentos/critico')}
    ${kpi('shield','i-red', venc.length, 'Documentos vencidos', venc.length?'Requer ação imediata':'Tudo regularizado', '#vencimentos/vencido')}
  </div>

  <div class="grid kpis" style="margin-top:-4px">
    ${kpi('money','i-green', money(ultNotaTotal), 'Despesas (último período)', ultNota?fmtD(ultNota.inicio)+' a '+fmtD(ultNota.fim):'Sem lançamentos', '#notas')}
    ${kpi('gauge','i-amber', manutAlerta.length, 'Trocas a vencer', 'Óleo / filtros · KM/horas', '#km')}
    ${kpi('tire', pneusAlerta?'i-red':'i-blue', pneusAlerta, 'Pneus no limite', 'Sulco ≤ '+DB.config.sulcoMinimo+' mm', '#pneus')}
    ${kpi('check','i-blue', chkMes, 'Check-lists no mês', DB.checklists.length+' no total', '#checklist')}
  </div>

  <div class="grid two-col">
    <div class="card">
      <div class="card-h">${svg('bell')}<h3>Próximos vencimentos</h3><span class="sub">— 90 dias</span>
        <div class="r"><a class="btn sm" href="#vencimentos">Ver todos</a></div></div>
      <div class="card-b p0">
        ${prox.length? prox.map(x=>{ const v=x.v;
          const alvo=v.entidade==='veiculo'?('#frota/'+v.refId):(v.entidade==='motorista'?('#motoristas/'+v.refId):'#vencimentos');
          return `<div class="alert-row" onclick="location.hash='${alvo}'">${alertIco(x.s.cls)}
            <div class="a-main"><b>${esc(v.tipo)} — ${esc(nomeEntidade(v))}</b><span>${esc(v.obs||fmtDLong(v.validade))}</span></div>
            <div class="a-when">${stBadge(v.validade)}<div class="s">${fmtD(v.validade)}</div></div></div>`;
        }).join('') : emptyState('Nenhum vencimento nos próximos 90 dias.')}
      </div>
    </div>

    <div class="card">
      <div class="card-h">${svg('shield')}<h3>Situação dos vencimentos</h3></div>
      <div class="card-b">
        <div class="donut-wrap">
          ${donut([
            {label:'Vencidos',value:venc.length,color:'#dc2626'},
            {label:'Críticos',value:crit.length,color:'#ea580c'},
            {label:'Atenção',value:aten.length,color:'#d99200'},
            {label:'Em dia',value:emdia.length,color:'#16a34a'},
          ],{center:vs.length,sub:'total'})}
          <div class="legend">
            <div class="li clk" onclick="location.hash='vencimentos/vencido'"><span class="dot" style="background:#dc2626"></span>Vencidos<b>${venc.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/critico'"><span class="dot" style="background:#ea580c"></span>Críticos<b>${crit.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/atencao'"><span class="dot" style="background:#d99200"></span>Atenção<b>${aten.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/emdia'"><span class="dot" style="background:#16a34a"></span>Em dia<b>${emdia.length}</b></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid two-col" style="margin-top:18px">
    <div class="card">
      <div class="card-h">${svg('bell')}<h3>Vencimentos por mês</h3><span class="sub">próximos 6 meses</span></div>
      <div class="card-b">${barChart(meses)}</div>
    </div>
    <div class="card">
      <div class="card-h">${svg('wrench')}<h3>Trocas a vencer (KM / Horas)</h3>
        <div class="r"><a class="btn sm" href="#km">Atualizar</a></div></div>
      <div class="card-b p0">
        ${manutAlerta.length? manutAlerta.slice(0,6).map(x=>`
          <div class="alert-row" onclick="location.hash='km'">
            <div class="a-ico ${x.info.st==='vencido'?'i-red':'i-orange'}">${svg('gauge')}</div>
            <div class="a-main"><b>${esc(x.v.placa)} — ${esc(x.p.item)}</b><span>Atual: ${num(x.info.atual)} ${x.info.un} · Próx.: ${num(x.info.prox)} ${x.info.un}</span></div>
            <div class="a-when"><span class="st ${x.info.st}">${x.info.restante<=0?'Vencido':num(x.info.restante)+' '+x.info.un}</span></div>
          </div>`).join('') : emptyState('Nenhuma troca próxima. Mantenha os KM/Horas atualizados.')}
      </div>
    </div>
  </div>

  <div class="grid two-col" style="margin-top:18px">
    <div class="card">
      <div class="card-h">${svg('truck')}<h3>Composição da frota</h3></div>
      <div class="card-b"><div class="donut-wrap">
        ${donut([{label:'Cavalos',value:cavalos,color:'#2563eb'},{label:'Reboques',value:reb,color:'#38bdf8'}],{center:cavalos+reb,sub:'veículos'})}
        <div class="legend">
          <div class="li clk" onclick="location.hash='frota'"><span class="dot" style="background:#2563eb"></span>Cavalos<b>${cavalos}</b></div>
          <div class="li clk" onclick="location.hash='frota'"><span class="dot" style="background:#38bdf8"></span>Reboques<b>${reb}</b></div>
          <div class="li"><span class="dot" style="background:#94a3b8"></span>Pneus cadastrados<b>${DB.pneus.length}</b></div>
        </div>
      </div></div>
    </div>
    <div class="card">
      <div class="card-h">${svg('check')}<h3>Últimos check-lists</h3>
        <div class="r"><a class="btn sm" href="#checklist">Ver todos</a></div></div>
      <div class="card-b p0">
        ${chkUlt.length? chkUlt.map(c=>{ const v=veiculo(c.veiculoId); const r=chkResumo(c);
          return `<div class="alert-row" onclick="location.hash='checklist'">
            <div class="a-ico ${r.nok?'i-red':'i-green'}">${svg('check')}</div>
            <div class="a-main"><b>${v?esc(v.placa):'—'} — ${esc(c.motoristaNome||(motorista(c.motoristaId)||{}).nome||'')}</b><span>${fmtDLong(c.data)}${c.km?' · '+num(c.km)+' km':''}</span></div>
            <div class="a-when"><span class="st ${r.nok?'crit':'ok'}">${r.nok?r.nok+' NOK':'OK'}</span></div></div>`;
        }).join('') : emptyState('Nenhum check-list ainda. Faça o primeiro em Check-list.')}
      </div>
    </div>
  </div>

  <div class="grid two-col" style="margin-top:18px">
    <div class="card">
      <div class="card-h">${svg('route')}<h3>Viagens por mês</h3><span class="sub">clique numa barra</span>
        <div class="r"><a class="btn sm" href="#viagens">Ver viagens</a></div></div>
      <div class="card-b">${barChart(viagensMes)}</div>
    </div>
    <div class="card">
      <div class="card-h">${svg('money')}<h3>Despesas por mês</h3><span class="sub">clique para ver</span>
        <div class="r"><a class="btn sm" href="#notas">Ver despesas</a></div></div>
      <div class="card-b">${DB.notas.length? barChart(despMes) : emptyState('Lance despesas para ver o gráfico.')}</div>
    </div>
  </div>

  <div class="grid two-col" style="margin-top:18px">
    <div class="card">
      <div class="card-h">${svg('route')}<h3>Situação das viagens</h3></div>
      <div class="card-b"><div class="donut-wrap">
        ${donut(vSitData,{center:DB.viagens.length,sub:'viagens'})}
        <div class="legend">
          <div class="li clk" onclick="viagemFiltro='emviagem';location.hash='viagens'"><span class="dot" style="background:#c99a2e"></span>Pendentes<b>${vSitData[0].value}</b></div>
          <div class="li clk" onclick="location.hash='viagens'"><span class="dot" style="background:#0f766e"></span>Concluídas<b>${vSitData[1].value}</b></div>
          <div class="li"><span class="dot" style="background:#9f1239"></span>Canceladas<b>${vSitData[2].value}</b></div>
        </div>
      </div></div>
    </div>
    <div class="card">
      <div class="card-h">${svg('doc')}<h3>Documentos por situação</h3></div>
      <div class="card-b"><div class="donut-wrap">
        ${donut([{label:'Vencidos',value:venc.length,color:'#9f1239'},{label:'Críticos',value:crit.length,color:'#c2410c'},{label:'Atenção',value:aten.length,color:'#c99a2e'},{label:'Em dia',value:emdia.length,color:'#0f766e'}],{center:vs.length,sub:'total'})}
        <div class="legend">
          <div class="li clk" onclick="location.hash='vencimentos/vencido'"><span class="dot" style="background:#9f1239"></span>Vencidos<b>${venc.length}</b></div>
          <div class="li clk" onclick="location.hash='vencimentos/critico'"><span class="dot" style="background:#c2410c"></span>Críticos<b>${crit.length}</b></div>
          <div class="li clk" onclick="location.hash='vencimentos/atencao'"><span class="dot" style="background:#c99a2e"></span>Atenção<b>${aten.length}</b></div>
          <div class="li clk" onclick="location.hash='vencimentos/emdia'"><span class="dot" style="background:#0f766e"></span>Em dia<b>${emdia.length}</b></div>
        </div>
      </div></div>
    </div>
  </div>`;
}

/* ================================================================== */
/*  10. FROTA                                                          */
/* ================================================================== */
let frotaFiltro='todos';
function viewFrota(){
  const fb=(k,l)=>`<button class="${frotaFiltro===k?'active':''}" onclick="frotaFiltro='${k}';router()">${l}</button>`;
  let lista=DB.veiculos.slice();
  if(frotaFiltro==='cavalo') lista=lista.filter(v=>v.tipo==='Cavalo');
  else if(frotaFiltro==='reboque') lista=lista.filter(v=>isReb(v));
  else if(frotaFiltro==='arquivado') lista=lista.filter(v=>v.status==='Arquivado');
  if(frotaFiltro!=='arquivado') lista=lista.filter(v=>v.status!=='Arquivado');

  const cards = lista.map(v=>{
    const vencs=todosVencimentos().filter(x=>x.entidade==='veiculo'&&x.refId===v.id);
    const pior=vencs.map(x=>situacao(x.validade)).sort((a,b)=>a.ord-b.ord)[0];
    const p=primaryItem(v); const info=p?manutInfo(p,v):null;
    return `<div class="vcard" onclick="location.hash='frota/${v.id}'">
      <div class="vcard-top">
        <div class="vplate">${plate(v.placa,v.tipo)}</div>
        <span class="tag ${v.tipo==='Cavalo'?'cavalo':'rebo'}">${v.tipo==='Cavalo'?'Cavalo':'Reboque'}</span>
      </div>
      <div class="vcard-body">
        <div class="vcard-model">${esc(v.marca||'—')} ${esc(v.modelo||'')}</div>
        <div class="vcard-sub">${esc(v.anoModelo||'')} ${v.renavam?'· Renavam '+esc(v.renavam):''}</div>
      </div>
      <div class="vcard-foot">
        ${pior?`<span class="st ${pior.cls}">${pior.label}</span>`:'<span class="st neutro">Sem registros</span>'}
        ${info&&info.ok?`<span class="st ${info.st}" title="Próxima troca">${svg('gauge')} ${info.restante<=0?'troca vencida':num(info.restante)+' '+info.un}</span>`:''}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="toolbar">
    <div class="seg">${fb('todos','Todos')}${fb('cavalo','Cavalos')}${fb('reboque','Reboques')}${fb('arquivado','Arquivados')}</div>
    <div class="spacer"></div>
    <button class="btn primary" onclick="modalVeiculo()">${svg('plus')} Novo veículo</button>
  </div>
  <div class="grid vgrid">${cards||emptyState('Nenhum veículo neste filtro.')}</div>`;
}

function viewVeiculo(id){
  const v=veiculo(id); if(!v) return emptyState('Veículo não encontrado.');
  const vencs=todosVencimentos().filter(x=>x.entidade==='veiculo'&&x.refId===v.id).sort((a,b)=>situacao(a.validade).ord-situacao(b.validade).ord);
  const manut=DB.manutencoes.filter(m=>m.veiculoId===v.id);
  const bats=DB.baterias.filter(b=>{ const vv=veiculoByPlaca(b.placa); return vv&&vv.id===v.id; });
  const anexos=filesDe('veiculo',v.id);
  const cavalo=v.tipo==='Cavalo';
  const p=primaryItem(v); const info=p?manutInfo(p,v):null;
  const info2=(l,val)=>`<div class="it"><div class="l">${l}</div><div class="v">${val||'—'}</div></div>`;

  return `
  <button class="btn ghost sm no-print" onclick="history.back()" style="margin-bottom:14px">← Voltar</button>
  <div class="detail-head">
    <div class="avatar veh">${svg('truck')}</div>
    <div class="dh-main"><h2>${esc(v.placa)}</h2>
      <div class="meta"><span>${esc(v.marca||'—')} ${esc(v.modelo||'')}</span>
        <span class="tag ${cavalo?'cavalo':'rebo'}">${esc(v.tipo)}</span><span>${esc(v.status)}</span></div></div>
    <div class="dh-actions no-print">
      <button class="btn" onclick="uploadPara('veiculo','${v.id}')">${svg('upload')} Anexar</button>
      <button class="btn" onclick="modalVencimento(null,'veiculo','${v.id}')">${svg('plus')} Vencimento</button>
      <button class="btn" onclick="modalVeiculo('${v.id}')">${svg('edit')} Editar</button>
    </div>
  </div>

  ${info&&info.ok?`<div class="gauge-strip">
    <div class="gauge-info"><b>${esc(p.item)}</b> — atual ${num(info.atual)} ${info.un}, próxima em <b>${num(info.prox)} ${info.un}</b></div>
    <div class="bt big"><i class="fill-${info.st}" style="width:${info.pct}%"></i></div>
    <div class="gauge-rest st ${info.st}">${info.restante<=0?'Troca vencida':'Faltam '+num(info.restante)+' '+info.un}</div>
    <button class="btn sm no-print" onclick="location.hash='km'">Atualizar ${cavalo?'KM':'horas'}</button>
  </div>`:''}

  <div class="info-grid" style="margin:18px 0">
    ${info2('CNPJ', esc(DB.empresa.cnpj))}
    ${info2('Renavam', esc(v.renavam))}
    ${info2('Chassi', `<span class="mono">${esc(v.chassi)}</span>`)}
    ${info2('Ano/Modelo', esc(v.anoModelo))}
    ${info2('CRLV (exercício)', esc(v.crlvAno))}
    ${info2(cavalo?'KM atual':'Horas atuais', cavalo?num(v.kmAtual):num(v.horaAtual))}
  </div>

  <div class="grid subgrid">
    <div class="card">
      <div class="card-h">${svg('bell')}<h3>Vencimentos & documentos</h3>
        <div class="r no-print"><button class="btn sm" onclick="modalVencimento(null,'veiculo','${v.id}')">${svg('plus')}</button></div></div>
      <div class="card-b p0">
        ${vencs.length? `<div class="tbl-wrap"><table class="tbl"><tbody>${vencs.map(x=>`
          <tr><td class="clickable" onclick="modalVencimento('${x.id}')"><b>${esc(x.tipo)}</b>${x.obs?`<div class="muted" style="font-size:12px">${esc(x.obs)}</div>`:''}</td>
          <td class="mono clickable" onclick="modalVencimento('${x.id}')">${fmtD(x.validade)}</td><td class="clickable" onclick="modalVencimento('${x.id}')">${stBadge(x.validade)}</td>
          <td style="text-align:right">${x._origem==='venc'?badgeAnexo('veiculo', v.id, new RegExp((x.tipo||'').replace(/[^\wçãáéíóúâê ]/gi,'').split(' ')[0],'i'), x.tipo):''}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Sem vencimentos cadastrados.')}
      </div>
    </div>
    <div class="grid" style="gap:18px">
      <div class="card">
        <div class="card-h">${svg('wrench')}<h3>Manutenção</h3>
          <div class="r no-print"><button class="btn sm" onclick="modalManutencao(null,'${v.id}')">${svg('plus')}</button></div></div>
        <div class="card-b p0">${manut.length? `<div class="tbl-wrap"><table class="tbl"><tbody>${manut.map(m=>{ const mi=manutInfo(m,v);
          return `<tr class="clickable" onclick="modalManutencao('${m.id}')"><td><b>${esc(m.item)}</b><div class="muted" style="font-size:12px">${esc(m.intervalo||'')}</div></td>
          <td class="mono">${fmtD(m.data)}</td>
          <td class="mono"><b>${m.proxKm!=null?num(m.proxKm)+' km':(m.proxHoras!=null?num(m.proxHoras)+' h':'—')}</b>
          ${mi.ok?`<div class="st ${mi.st}" style="margin-top:3px">${mi.restante<=0?'vencida':num(mi.restante)+' '+mi.un}</div>`:''}</td></tr>`;
        }).join('')}</tbody></table></div>` : emptyState('Sem registros.')}</div>
      </div>
      <div class="card">
        <div class="card-h">${svg('battery')}<h3>Baterias</h3></div>
        <div class="card-b p0">${bats.length? `<div class="tbl-wrap"><table class="tbl"><tbody>${bats.map(b=>`
          <tr><td><b>${esc(b.marca)}</b><div class="muted" style="font-size:12px">${esc(b.local)}</div></td>
          <td class="mono">${fmtD(b.data)}</td><td>${money(b.valor)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('Sem baterias.')}</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="card-h">${svg('doc')}<h3>Arquivos anexados</h3><span class="sub">${anexos.length}</span>
      <div class="r no-print"><button class="btn sm" onclick="uploadPara('veiculo','${v.id}')">${svg('upload')} Enviar arquivo</button></div></div>
    <div class="card-b">${anexos.length? filesGrid(anexos) : emptyState('Nenhum arquivo. Anexe CRLV, laudos, notas...')}</div>
  </div>`;
}

/* ================================================================== */
/*  11. MOTORISTAS                                                     */
/* ================================================================== */
function viewMotoristas(){
  const cards=DB.motoristas.map(m=>{
    const vencs=todosVencimentos().filter(x=>x.entidade==='motorista'&&x.refId===m.id);
    const pior=vencs.map(x=>situacao(x.validade)).sort((a,b)=>a.ord-b.ord)[0];
    const idade=m.nascimento? Math.floor((hoje()-parseD(m.nascimento))/(365.25*86400000)):null;
    return `<div class="mcard" onclick="location.hash='motoristas/${m.id}'">
      ${avatarFoto(m,64)}
      <div class="mcard-info">
        <div class="mcard-name">${esc(m.nome)}</div>
        <div class="muted" style="font-size:12.5px;margin-bottom:9px">${esc(m.funcao)}${idade?' · '+idade+' anos':''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="tag">CNH ${esc(m.categoria||'—')}</span>
          ${pior?`<span class="st ${pior.cls}">${pior.label}</span>`:'<span class="st neutro">Sem registros</span>'}
        </div>
      </div></div>`;
  }).join('');
  return `<div class="toolbar"><div class="spacer"></div>
    <button class="btn primary" onclick="modalMotorista()">${svg('plus')} Novo motorista</button></div>
    <div class="grid mgrid">${cards}</div>`;
}

function viewMotorista(id){
  const m=motorista(id); if(!m) return emptyState('Motorista não encontrado.');
  const vencs=todosVencimentos().filter(x=>x.entidade==='motorista'&&x.refId===m.id).sort((a,b)=>situacao(a.validade).ord-situacao(b.validade).ord);
  const anexos=filesDe('motorista',m.id);
  const idade=m.nascimento? Math.floor((hoje()-parseD(m.nascimento))/(365.25*86400000)):null;
  const info=(l,val)=>`<div class="it"><div class="l">${l}</div><div class="v">${val||'—'}</div></div>`;
  return `
  <button class="btn ghost sm no-print" onclick="history.back()" style="margin-bottom:14px">← Voltar</button>
  <div class="detail-head">
    ${avatarFoto(m,84)}
    <div class="dh-main"><h2>${esc(m.nome)}</h2>
      <div class="meta"><span>${esc(m.funcao)}</span>${idade?`<span>${idade} anos</span>`:''}<span>${esc(m.status)}</span></div></div>
    <div class="dh-actions no-print">
      <button class="btn" onclick="uploadPara('motorista','${m.id}')">${svg('upload')} Anexar</button>
      <button class="btn" onclick="modalVencimento(null,'motorista','${m.id}')">${svg('plus')} Vencimento</button>
      <button class="btn" onclick="modalMotorista('${m.id}')">${svg('edit')} Editar</button>
    </div>
  </div>
  <div class="info-grid" style="margin-bottom:18px">
    ${info('Matrícula', esc(m.matricula))}
    ${info('CPF', esc(m.cpf))}
    ${info('RG', esc(m.rg?((m.rg)+(m.emissorRg?' '+m.emissorRg:'')):''))}
    ${info('Nascimento', fmtD(m.nascimento))}
    ${info('Celular', (m.celular||m.telefone)?`<a class="pill-link" href="tel:${esc(m.celular||m.telefone)}">${esc(m.celular||m.telefone)}</a>`:'—')}
    ${info('E-mail', esc(m.email))}
    ${info('CNH nº', esc(m.cnh))}
    ${info('Categoria', esc(m.categoria))}
    ${info('Validade CNH', fmtD(m.cnhValidade))}
    ${info('RENACH', esc(m.renach))}
    ${info('Admissão', fmtD(m.admissao))}
    ${info('EAR', esc(m.ear))}
    ${info('Endereço', esc(m.endereco))}
  </div>
  <div class="grid subgrid">
    <div class="card">
      <div class="card-h">${svg('stetho')}<h3>Vencimentos & exames</h3>
        <div class="r no-print"><button class="btn sm" onclick="modalVencimento(null,'motorista','${m.id}')">${svg('plus')} Adicionar</button></div></div>
      <div class="card-b p0">${vencs.length? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Tipo</th><th>Emissão</th><th>Validade</th><th>Situação</th></tr></thead>
        <tbody>${vencs.map(x=>`<tr class="clickable" onclick="modalVencimento('${x.id}')"><td><b>${esc(x.tipo)}</b>${x.obs?`<div class="muted" style="font-size:12px">${esc(x.obs)}</div>`:''}</td>
        <td class="mono muted">${fmtD(x.emissao)}</td><td class="mono">${fmtD(x.validade)}</td><td>${stBadge(x.validade)}</td></tr>`).join('')}</tbody>
      </table></div>` : emptyState('Sem vencimentos cadastrados.')}</div>
    </div>
    <div class="card">
      <div class="card-h">${svg('doc')}<h3>Arquivos</h3><span class="sub">${anexos.length}</span>
        <div class="r no-print"><button class="btn sm" onclick="uploadPara('motorista','${m.id}')">${svg('upload')} Enviar</button></div></div>
      <div class="card-b">${anexos.length? filesGrid(anexos) : emptyState('Anexe CNH, ASO, toxicológico, foto...')}</div>
    </div>
  </div>`;
}

/* ================================================================== */
/*  12. EXAMES (matriz ASO / Toxicológico / Opentech)                 */
/* ================================================================== */
function viewExames(){
  const tipos=['ASO','Toxicológico','Opentech Funcionário'];
  const reDe={'ASO':/\baso\b/i,'Toxicológico':/tox/i,'Opentech Funcionário':/opentech/i};
  const cel=(m,tipo)=>{
    const v=DB.vencimentos.find(x=>x.entidade==='motorista'&&x.refId===m.id&&x.tipo===tipo);
    const bg=`<div style="margin-top:5px">${badgeAnexo('motorista', m.id, reDe[tipo]||new RegExp(tipo,'i'), tipo)}</div>`;
    if(!v) return `<td><button class="btn ghost sm" onclick="modalVencimento(null,'motorista','${m.id}','${tipo}')">${svg('plus')} Add</button>${bg}</td>`;
    const s=situacao(v.validade);
    return `<td><div class="clickable" onclick="modalVencimento('${v.id}')"><div class="st ${s.cls}">${s.label}</div><div class="muted mono" style="font-size:11.5px;margin-top:3px">${fmtD(v.validade)}</div></div>${bg}</td>`;
  };
  const rows=DB.motoristas.map(m=>`<tr>
    <td><div style="display:flex;align-items:center;gap:10px">${avatarFoto(m,36)}<div><b>${esc(m.nome)}</b><div class="muted" style="font-size:11.5px">${esc(m.funcao)}</div></div></div></td>
    ${tipos.map(t=>cel(m,t)).join('')}</tr>`).join('');

  // resumo por tipo
  const resumo=tipos.map(t=>{
    const arr=DB.vencimentos.filter(x=>x.tipo===t).map(x=>situacao(x.validade));
    const venc=arr.filter(s=>s.ord===0).length, crit=arr.filter(s=>s.ord===1).length;
    return {t, total:arr.length, venc, crit};
  });

  return `
  <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${resumo.map(r=>`<div class="card"><div class="card-b">
      <div style="font-size:12.5px;color:var(--text-soft);font-weight:600">${esc(r.t)}</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px">
        <span style="font-size:26px;font-weight:800">${r.total}</span>
        <span class="muted" style="font-size:12px">registros</span></div>
      <div style="margin-top:8px;display:flex;gap:6px">
        ${r.venc?`<span class="st vencido">${r.venc} vencido(s)</span>`:''}
        ${r.crit?`<span class="st crit">${r.crit} crítico(s)</span>`:''}
        ${!r.venc&&!r.crit?'<span class="st ok">Tudo em dia</span>':''}</div>
    </div></div>`).join('')}
  </div>
  <div class="card">
    <div class="card-h">${svg('stetho')}<h3>Matriz de exames por colaborador</h3>
      <div class="r no-print"><button class="btn sm" onclick="window.print()">${svg('print')} Imprimir</button></div></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl matrix">
      <thead><tr><th>Colaborador</th><th>ASO</th><th>Toxicológico</th><th>Opentech (BRF)</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>
  </div>`;
}

/* ================================================================== */
/*  13. VENCIMENTOS                                                    */
/* ================================================================== */
/* ---------- DIREÇÃO DEFENSIVA (motoristas) ---------- */
function viewDirecao(){
  const rows=DB.motoristas.map(m=>{
    const v=DB.vencimentos.find(x=>x.entidade==='motorista'&&x.refId===m.id&&x.tipo==='Direção Defensiva');
    const s=v?situacao(v.validade):null;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">${avatarFoto(m,36)}<div><b>${esc(m.nome)}</b><div class="muted" style="font-size:11.5px">${esc(m.funcao)}</div></div></div></td>
      <td class="mono muted">${v?fmtD(v.emissao):'—'}</td>
      <td class="mono">${v?fmtD(v.validade):'—'}</td>
      <td>${v?`<span class="st ${s.cls}">${s.label}</span>`:'<span class="st neutro">Não cadastrado</span>'}</td>
      <td>${badgeAnexo('motorista', m.id, /defensiv|dire[çc][ãa]o/i, 'Direção Defensiva')}</td>
      <td class="no-print" style="text-align:right">${v?`<button class="btn ghost sm" onclick="modalVencimento('${v.id}')">${svg('edit')}</button>`:`<button class="btn sm" onclick="modalVencimento(null,'motorista','${m.id}','Direção Defensiva')">${svg('plus')} Add</button>`}</td></tr>`;
  }).join('');
  const arr=DB.vencimentos.filter(x=>x.tipo==='Direção Defensiva').map(x=>situacao(x.validade));
  const comCert=DB.motoristas.filter(m=>anexoTipo('motorista',m.id,/defensiv|dire[çc][ãa]o/i)).length;
  return `
  <div class="banner">${svg('wheel')}<div><b>Direção Defensiva</b><span>Certificado de direção defensiva dos motoristas (válido por 1 ano). Anexe o certificado; ele aparece como "Anexado" e abre ao clicar.</span></div></div>
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('wheel','i-blue', arr.length, 'Certificados cadastrados','')}
    ${kpi('bell', arr.filter(s=>s.ord<=1).length?'i-red':'i-green', arr.filter(s=>s.ord<=1).length, 'Vencidos / críticos','')}
    ${kpi('clip','i-green', comCert, 'Com certificado anexado','')}
  </div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Motorista</th><th>Emissão</th><th>Validade</th><th>Situação</th><th>Certificado</th><th class="no-print"></th></tr></thead>
    <tbody>${rows}</tbody></table></div></div></div>`;
}

/* ---------- TACÓGRAFOS (somente cavalos) ---------- */
function tacoCertificado(v){
  // Só conta certificado REALMENTE enviado/sincronizado na plataforma (não os arquivos da pasta)
  const up=todosArquivos().find(f=>f.entidade==='veiculo'&&f.refId===v.id&&/tac[óo]grafo|cronotac/i.test((f.categoria||'')+' '+(f.name||'')));
  if(up) return {tipo:'up', nome:up.name, id:up.id};
  return null;
}
function viewTacografos(){
  const veics=DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado');
  const rows=veics.map(v=>{
    const t=DB.vencimentos.find(x=>x.entidade==='veiculo'&&x.refId===v.id&&x.tipo==='Tacógrafo');
    const s=t?situacao(t.validade):null; const cert=tacoCertificado(v);
    const certBadge=cert?`<span class="st ok" style="cursor:pointer" onclick="event.stopPropagation();${cert.tipo==='real'?`abrirReal('${esc(cert.path)}')`:`verArquivo('${cert.id}')`}">${svg('clip')} Certificado anexado</span>`
      :`<span class="muted" style="font-size:11.5px">sem certificado</span>`;
    return `<tr>
      <td>${plate(v.placa,v.tipo)} ${certBadge}</td><td>${esc(v.marca)} ${esc(v.modelo)}</td>
      <td class="mono muted">${t?fmtD(t.emissao):'—'}</td>
      <td class="mono">${t?fmtD(t.validade):'—'}</td>
      <td>${t?`<span class="st ${s.cls}">${s.label}</span>`:'<span class="st neutro">Não cadastrado</span>'}</td>
      <td class="no-print" style="text-align:right">
        <button class="btn sm" title="Anexar certificado" onclick="uploadPara('veiculo','${v.id}','Tacógrafo')">${svg('upload')} Anexar</button>
        ${t?`<button class="btn ghost sm" onclick="modalVencimento('${t.id}')">${svg('edit')}</button>`:`<button class="btn sm" onclick="modalVencimento(null,'veiculo','${v.id}','Tacógrafo')">${svg('plus')} Add</button>`}</td></tr>`;
  }).join('');
  const arr=veics.map(v=>DB.vencimentos.find(x=>x.entidade==='veiculo'&&x.refId===v.id&&x.tipo==='Tacógrafo')).filter(Boolean).map(x=>situacao(x.validade));
  const comCert=veics.filter(v=>tacoCertificado(v)).length;
  return `
  <div class="banner">${svg('taco')}<div><b>Tacógrafos — Cavalos</b><span>Aferição do cronotacógrafo (INMETRO). Anexe o certificado; ele aparece como "Certificado anexado" ao lado da placa.</span></div></div>
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('taco','i-blue', arr.length, 'Aferições cadastradas','')}
    ${kpi('bell', arr.filter(s=>s.ord<=1).length?'i-red':'i-green', arr.filter(s=>s.ord<=1).length, 'Vencidas / críticas','')}
    ${kpi('clip','i-green', comCert, 'Com certificado anexado','')}
  </div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Placa / Certificado</th><th>Veículo</th><th>Aferição</th><th>Validade</th><th>Situação</th><th class="no-print"></th></tr></thead>
    <tbody>${rows}</tbody></table></div></div></div>`;
}

let vencFiltro='todos', vencTipo='todos';
function viewVencimentos(){
  let list=todosVencimentos().map(v=>({v,s:situacao(v.validade)}));
  const tipos=[...new Set(todosVencimentos().map(v=>v.tipo))].sort();
  if(vencFiltro==='vencido') list=list.filter(x=>x.s.ord===0);
  else if(vencFiltro==='critico') list=list.filter(x=>x.s.ord===1);
  else if(vencFiltro==='atencao') list=list.filter(x=>x.s.ord===2);
  else if(vencFiltro==='emdia') list=list.filter(x=>x.s.ord===3);
  if(vencTipo!=='todos') list=list.filter(x=>x.v.tipo===vencTipo);
  list.sort((a,b)=> a.s.ord-b.s.ord || (a.s.dias??9e9)-(b.s.dias??9e9));

  const cont={vencido:0,critico:0,atencao:0,emdia:0};
  todosVencimentos().forEach(v=>{const o=situacao(v.validade).ord; if(o===0)cont.vencido++;else if(o===1)cont.critico++;else if(o===2)cont.atencao++;else if(o===3)cont.emdia++;});
  const fb=(k,l,n)=>`<button class="${vencFiltro===k?'active':''}" onclick="vencFiltro='${k}';router()">${l}${n!=null?` <b style="opacity:.55">${n}</b>`:''}</button>`;

  const rows=list.map(x=>{ const v=x.v;
    const alvo=v.entidade==='veiculo'?('frota/'+v.refId):(v.entidade==='motorista'?('motoristas/'+v.refId):'vencimentos');
    const ent=v.entidade==='veiculo'?'Veículo':(v.entidade==='motorista'?'Motorista':'Empresa');
    const anexo=(v.anexoId&&arquivoPorId(v.anexoId));
    return `<tr>
      <td class="clickable" onclick="modalVencimento('${v.id}')"><b>${esc(v.tipo)}</b>${v.numero?`<div class="muted" style="font-size:11.5px">Nº ${esc(v.numero)}</div>`:''}${v.obs?`<div class="muted" style="font-size:12px">${esc(v.obs)}</div>`:''}</td>
      <td class="clickable" onclick="location.hash='${alvo}'"><span class="pill-link">${esc(nomeEntidade(v))}</span><div class="muted" style="font-size:11.5px">${ent}${v.orgao?' · '+esc(v.orgao):''}</div></td>
      <td class="mono muted">${fmtD(v.emissao)}</td>
      <td class="mono">${fmtD(v.validade)}</td>
      <td>${stBadge(v.validade)}</td>
      <td class="no-print" style="text-align:right;white-space:nowrap">
        ${anexo?`<button class="btn ghost sm" title="Baixar anexo" onclick="baixarArquivo('${anexo.id}')">${svg('download')}</button>`:''}
        <button class="btn ghost sm" onclick="modalVencimento('${v.id}')">${svg('edit')}</button></td>
    </tr>`;
  }).join('');

  return `
  <div class="toolbar">
    <div class="seg">${fb('todos','Todos')}${fb('vencido','Vencidos',cont.vencido)}${fb('critico','Críticos',cont.critico)}${fb('atencao','Atenção',cont.atencao)}${fb('emdia','Em dia',cont.emdia)}</div>
    <select class="selectlite" onchange="vencTipo=this.value;router()">
      <option value="todos">Todos os tipos</option>
      ${tipos.map(t=>`<option value="${esc(t)}" ${vencTipo===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    <div class="spacer"></div>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button>
    <button class="btn primary" onclick="modalVencimento()">${svg('plus')} Novo</button>
  </div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap">
    <table class="tbl"><thead><tr><th>Documento / Tipo</th><th>Vinculado a</th><th>Emissão</th><th>Validade</th><th>Situação</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="6">${emptyState('Nenhum vencimento neste filtro.')}</td></tr>`}</tbody></table>
  </div></div></div>`;
}

/* ================================================================== */
/*  14. KM / HORAS                                                     */
/* ================================================================== */
function viewKM(){
  const cavalos=DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado');
  const carretas=DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado');
  const cardVeic=(v)=>{ const cavalo=v.tipo==='Cavalo'; const p=primaryItem(v); const info=p?manutInfo(p,v):null;
    const atual = cavalo? v.kmAtual : v.horaAtual; const un=cavalo?'km':'h';
    return `<div class="kmcard">
      <div class="kmcard-h">${plate(v.placa,v.tipo)}<span class="muted" style="font-size:12px">${esc(v.marca)} ${esc(v.modelo)}</span></div>
      <div class="kmcard-input">
        <label>${cavalo?'KM atual':'Horas atuais'}</label>
        <div class="inline">
          <input type="number" id="km_${v.id}" value="${atual!=null?atual:''}" placeholder="0">
          <button class="btn primary sm" onclick="salvarKM('${v.id}')">Atualizar</button>
        </div>
        ${(cavalo?v.kmData:v.horaData)?`<div class="muted" style="font-size:11.5px;margin-top:6px">${svg('cal')} Última alteração: <b>${fmtD(cavalo?v.kmData:v.horaData)}</b> · <a href="#" onclick="event.preventDefault();modalHistLeitura('${v.id}')">ver histórico</a></div>`:''}
      </div>
      ${info&&info.ok?`
        <div class="kmcard-item"><span>${esc(p.item)}</span><b class="st ${info.st}">${info.restante<=0?'Vencida há '+num(-info.restante)+' '+un:'faltam '+num(info.restante)+' '+un}</b></div>
        <div class="bt"><i class="fill-${info.st}" style="width:${info.pct}%"></i></div>
        <div class="muted" style="font-size:11.5px;margin-top:4px">Próxima troca em ${num(info.prox)} ${un} · última ${fmtD(p.data)}</div>
      `:`<div class="muted" style="font-size:12px;margin-top:6px">Informe o ${cavalo?'KM':'horas'} para calcular a próxima troca.</div>`}
    </div>`;
  };
  return `
  <div class="banner">${svg('gauge')}<div><b>Atualização rápida de KM e Horas</b><span>Digite o valor atual de cada veículo. O sistema recalcula automaticamente quanto falta para a próxima troca de óleo/filtros e alerta quando estiver perto.</span></div></div>
  <div class="sectitulo">${svg('truck')} Cavalos — quilometragem</div>
  <div class="grid kmgrid">${cavalos.map(cardVeic).join('')}</div>
  <div class="sectitulo" style="margin-top:22px">${svg('battery')} Carretas — horas do aparelho Thermo King</div>
  <div class="grid kmgrid">${carretas.map(cardVeic).join('')}</div>`;
}
function salvarKM(id){
  const v=veiculo(id); const el=document.getElementById('km_'+id);
  const nv = el.value===''? null : parseFloat(el.value);
  registrarLeitura(v, nv);
  saveDB(); toast('Atualizado: '+v.placa); router();
}
/* Grava a nova leitura de KM/horas E a data em que foi feita (histórico) */
function registrarLeitura(v, nv, dataISO){
  const dia=dataISO||new Date().toISOString().slice(0,10);
  if(v.tipo==='Cavalo'){
    if(nv!==v.kmAtual){ (v.histKm=v.histKm||[]).push({data:dia,valor:nv}); if(v.histKm.length>60)v.histKm=v.histKm.slice(-60); v.kmData=dia; }
    v.kmAtual=nv;
  } else {
    if(nv!==v.horaAtual){ (v.histHora=v.histHora||[]).push({data:dia,valor:nv}); if(v.histHora.length>60)v.histHora=v.histHora.slice(-60); v.horaData=dia; }
    v.horaAtual=nv;
  }
}
function modalHistLeitura(id){ const v=veiculo(id); if(!v)return; const cavalo=v.tipo==='Cavalo';
  const un=cavalo?'km':'h'; const hist=(cavalo?v.histKm:v.histHora)||[];
  const linhas=hist.slice().reverse().map(h=>`<tr><td class="mono">${fmtD(h.data)}</td><td class="mono"><b>${h.valor!=null?num(h.valor)+' '+un:'—'}</b></td></tr>`).join('');
  openModal(`<div class="m-h">${svg('gauge')}<h3>Histórico — ${esc(v.placa)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <p class="muted" style="margin-bottom:10px">Cada alteração do ${cavalo?'KM':'horas'} deste veículo, com a data em que foi feita.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data da alteração</th><th>${cavalo?'KM':'Horas'}</th></tr></thead>
      <tbody>${linhas||`<tr><td colspan="2">${emptyState('Nenhuma alteração registrada ainda.')}</td></tr>`}</tbody></table></div>
    </div>
    <div class="m-f"><button class="btn primary" onclick="closeModal()">Fechar</button></div>`);
}

/* ================================================================== */
/*  15. MANUTENÇÃO                                                     */
/* ================================================================== */
function manutBloco(v){ const ms=DB.manutencoes.filter(m=>m.veiculoId===v.id);
  return `<div class="card"><div class="card-h">${plate(v.placa,v.tipo)}<h3 style="font-size:14px">${esc(v.marca)} ${esc(v.modelo)}</h3>
    <div class="r no-print"><a class="btn sm" href="#km">${svg('gauge')} KM/Horas</a><button class="btn sm" onclick="modalManutencao(null,'${v.id}')">${svg('plus')}</button></div></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Item</th><th>Intervalo</th><th>Feita em</th><th>Próxima</th><th>Faltam</th><th class="no-print"></th></tr></thead>
      <tbody>${ms.map(m=>{ const mi=manutInfo(m,v);
        return `<tr class="clickable" onclick="modalManutencao('${m.id}')"><td><b>${esc(m.item)}</b><div class="muted" style="font-size:11px">${fmtD(m.data)}</div></td><td class="muted">${esc(m.intervalo||'—')}</td>
        <td class="mono muted">${m.kmTroca!=null?num(m.kmTroca)+' km':(m.horasTroca!=null?num(m.horasTroca)+' h':'—')}</td>
        <td class="mono"><b>${m.proxKm!=null?num(m.proxKm)+' km':(m.proxHoras!=null?num(m.proxHoras)+' h':'—')}</b></td>
        <td>${mi.ok?`<span class="st ${mi.st}">${mi.restante<=0?'vencida há '+num(-mi.restante)+' '+mi.un:num(mi.restante)+' '+mi.un}</span>`:'<span class="muted">—</span>'}</td>
        <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalManutencao('${m.id}')">${svg('edit')}</button></td></tr>`;
      }).join('')}</tbody></table></div></div></div>`;
}
function viewOleo(){
  const ativos=DB.veiculos.filter(v=>v.status!=='Arquivado'&&DB.manutencoes.some(m=>m.veiculoId===v.id));
  const cavalos=ativos.filter(v=>v.tipo==='Cavalo');
  const carretas=ativos.filter(v=>isReb(v));
  return `
  <div class="banner">${svg('wrench')}<div><b>Trocas de Óleo</b><span>Óleo e filtros por veículo. A coluna "Faltam" usa o KM/Horas atual (aba KM / Horas).</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalManutencao()">${svg('plus')} Nova troca</button></div>

  <div class="sectitulo">${svg('truck')} Cavalos (por quilometragem)</div>
  <div class="grid" style="gap:18px">${cavalos.length?cavalos.map(manutBloco).join(''):emptyState('Sem trocas de óleo de cavalos.')}</div>

  <div class="sectitulo" style="margin-top:24px">${svg('battery')} Carretas (horas do Thermo King)</div>
  <div class="grid" style="gap:18px">${carretas.length?carretas.map(manutBloco).join(''):emptyState('Sem trocas de óleo de carretas.')}</div>`;
}

/* ---------- RELATÓRIO DE MANUTENÇÃO (serviços / reparos) ---------- */
let manutFiltro='todas';
function manutTipoTag(t){ return (t==='Preventiva')
  ? '<span class="st ok" style="font-size:10.5px">Preventiva</span>'
  : '<span class="st warn" style="font-size:10.5px">Corretiva</span>'; }
function _somaServ(arr){ return arr.reduce((s,x)=>s+(Number(x.valor)||0),0); }
function viewManutencao(){
  const todos=DB.servicos.slice();
  const ehTipo=(x,t)=> (x.tipo||'Corretiva')===t;
  const filtr = manutFiltro==='corretiva'? todos.filter(x=>ehTipo(x,'Corretiva'))
             : manutFiltro==='preventiva'? todos.filter(x=>ehTipo(x,'Preventiva')) : todos;
  const total=_somaServ(todos), corr=_somaServ(todos.filter(x=>ehTipo(x,'Corretiva'))), prev=_somaServ(todos.filter(x=>ehTipo(x,'Preventiva')));
  const h=hoje();
  const mesTot=_somaServ(todos.filter(x=>{ const d=parseD(x.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }));
  const veics=DB.veiculos.filter(v=>v.status!=='Arquivado');
  const comGasto=veics.map(v=>({v,g:_somaServ(filtr.filter(x=>x.veiculoId===v.id))})).filter(x=>x.g>0).sort((a,b)=>b.g-a.g);
  const barras=comGasto.map(x=>({label:esc(x.v.placa.split('-')[0]),value:Math.round(x.g),vtxt:moneyK(x.g),color:isReb(x.v)?'#0ea5a4':'#2563eb'}));
  const cavalos=veics.filter(v=>v.tipo==='Cavalo'&&filtr.some(x=>x.veiculoId===v.id));
  const carretas=veics.filter(v=>isReb(v)&&filtr.some(x=>x.veiculoId===v.id));
  const cardsDe=(lst)=>lst.map(v=>manutCardVeiculo(v,filtr.filter(x=>x.veiculoId===v.id))).join('');
  const fb=(k,l)=>`<button class="${manutFiltro===k?'active':''}" onclick="manutFiltro='${k}';router()">${l}</button>`;
  return `
  <div class="banner">${svg('wrench')}<div><b>Relatório de Manutenção</b><span>Controle operacional de reparos e serviços — cavalos e carretas separados por placa, com tipo (corretiva/preventiva), gastos e gráficos. As trocas de óleo ficam na aba "Trocas de Óleo".</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalServico()">${svg('plus')} Novo serviço</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kpi('money','i-blue',money(total),'Gasto total',DB.servicos.length+' serviços')}
    ${kpi('wrench','i-amber',money(corr),'Corretiva','')}
    ${kpi('shield','i-green',money(prev),'Preventiva','')}
    ${kpi('cal','i-red',money(mesTot),'Gasto no mês','')}
  </div>
  <div class="grid" style="grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card"><div class="card-h">${svg('dash')}<h3 style="font-size:14px">Gasto por veículo</h3><span class="sub" style="margin-left:auto">azul = cavalos · verde = carretas</span></div>
      <div class="card-b">${comGasto.length?barChart(barras,{h:180,w:460}):emptyState('Sem gastos lançados.')}</div></div>
    <div class="card"><div class="card-h">${svg('shield')}<h3 style="font-size:14px">Corretiva × Preventiva</h3></div>
      <div class="card-b" style="display:flex;flex-direction:column;align-items:center;gap:10px">
        ${donut([{value:corr,color:'#f59e0b'},{value:prev,color:'#16a34a'}],{center:'',sub:'',size:150})}
        <div style="font-size:12.5px;text-align:center;line-height:1.9"><span class="st warn">Corretiva</span> <b>${money(corr)}</b><br><span class="st ok">Preventiva</span> <b>${money(prev)}</b></div>
      </div></div>
  </div>
  <div class="toolbar"><div class="seg no-print">${fb('todas','Todas')}${fb('corretiva','Corretiva')}${fb('preventiva','Preventiva')}</div>
    <div class="spacer"></div><div class="muted">${filtr.length} serviço(s) · <b>${money(_somaServ(filtr))}</b></div></div>
  <div class="sectitulo">${svg('truck')} Cavalos</div>
  <div class="grid" style="gap:18px">${cavalos.length?cardsDe(cavalos):emptyState('Nenhum serviço de cavalos neste filtro.')}</div>
  <div class="sectitulo" style="margin-top:22px">${svg('battery')} Carretas</div>
  <div class="grid" style="gap:18px">${carretas.length?cardsDe(carretas):emptyState('Nenhum serviço de carretas neste filtro.')}</div>`;
}
function manutCardVeiculo(v, servs){
  const soma=_somaServ(servs);
  const corr=servs.filter(x=>(x.tipo||'Corretiva')==='Corretiva').length;
  const prev=servs.filter(x=>x.tipo==='Preventiva').length;
  const rows=servs.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(x=>`
    <tr class="clickable" onclick="modalServico('${x.id}')">
      <td class="mono">${fmtD(x.data)}</td>
      <td>${manutTipoTag(x.tipo)}</td>
      <td><b>${esc(x.descricao||'—')}</b>${x.obs?`<div class="muted" style="font-size:11px">${esc(x.obs)}</div>`:''}</td>
      <td>${esc(x.oficina||'—')}</td>
      <td class="mono muted">${x.km!=null&&x.km!==''?num(x.km)+' km':'—'}</td>
      <td class="mono"><b>${money(x.valor)}</b></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalServico('${x.id}')">${svg('edit')}</button></td>
    </tr>`).join('');
  return `<div class="card"><div class="card-h">${plate(v.placa,v.tipo)}<h3 style="font-size:14px">${esc(v.marca)} ${esc(v.modelo)}</h3>
    <span class="sub">${servs.length} serviço(s) · ${corr} corretiva / ${prev} preventiva</span>
    <div class="r no-print" style="margin-left:auto;display:flex;align-items:center;gap:12px"><b style="font-size:15px">${money(soma)}</b><button class="btn sm" title="Novo serviço deste veículo" onclick="modalServico(null,'${v.id}')">${svg('plus')}</button></div></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Data</th><th>Tipo</th><th>Serviço</th><th>Oficina</th><th>KM/Horas</th><th>Valor</th><th class="no-print"></th></tr></thead>
      <tbody>${rows}</tbody></table></div></div></div>`;
}
function modalServico(id, vId){
  const x=id?DB.servicos.find(y=>y.id===id):{data:new Date().toISOString().slice(0,10),veiculoId:vId||(DB.veiculos[0]||{}).id,descricao:'',oficina:'',km:'',valor:'',tipo:'Corretiva',obs:''};
  openModal(`<div class="m-h">${svg('wrench')}<h3>${id?'Editar serviço':'Novo serviço'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',x.data,'date')}
        <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${x.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.tipo)}</option>`).join('')}</select></div></div>
      ${fld('Serviço / reparo','f_desc',x.descricao,'text','Ex.: Troca de lonas de freio')}
      <div class="field-row">${sel('Tipo de manutenção','f_tipo',x.tipo||'Corretiva',['Corretiva','Preventiva'])}${fld('Oficina','f_ofi',x.oficina)}</div>
      <div class="field-row">${fldR$('Valor (R$)','f_val',x.valor)}${fld('KM / Horas (opcional)','f_km',x.km,'number')}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(x.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirServico('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarServico('${id||''}')">Salvar</button></div>`);
}
function salvarServico(id){ if(!val('f_desc')){toast('Descreva o serviço.','err');return;}
  const d={data:val('f_data'),veiculoId:val('f_veic'),descricao:val('f_desc'),oficina:val('f_ofi'),km:numOrNull('f_km'),valor:parseBRL(val('f_val')),tipo:val('f_tipo')||'Corretiva',obs:val('f_obs')};
  if(id)Object.assign(DB.servicos.find(y=>y.id===id),d); else{ d.id=uid('sv'); DB.servicos.push(d); } saveDB(); closeModal(); toast('Serviço salvo.'); router(); }
function excluirServico(id){ if(!confirm('Excluir este serviço?'))return; DB.servicos=DB.servicos.filter(y=>y.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ================================================================== */
/*  16. BATERIAS                                                       */
/* ================================================================== */
let batTipo='cavalo', batOrdem='placa';
function viewBaterias(){
  const total=DB.baterias.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const emGarantia=DB.baterias.filter(b=>b.garantiaAte&&diasAte(b.garantiaAte)>=0).length;
  const tipoDe=(b)=>{ const v=veiculoByPlaca(b.placa); return v&&isReb(v)?'carreta':'cavalo'; };
  const fb=(k,l)=>`<button class="${batTipo===k?'active':''}" onclick="batTipo='${k}';router()">${l}</button>`;
  let lista=DB.baterias.filter(b=>batTipo==='todas'?true:tipoDe(b)===batTipo);
  const sorters={placa:(a,b)=>(a.placa||'').localeCompare(b.placa||''), data:(a,b)=>(b.data||'').localeCompare(a.data||''),
    garantia:(a,b)=>(a.garantiaAte||'9999').localeCompare(b.garantiaAte||'9999'), valor:(a,b)=>(Number(b.valor)||0)-(Number(a.valor)||0)};
  lista.sort(sorters[batOrdem]||sorters.placa);
  // agrupa por placa
  const grupos={}; lista.forEach(b=>{ (grupos[b.placa]=grupos[b.placa]||[]).push(b); });
  const placasOrd=Object.keys(grupos).sort();
  const blocos=placasOrd.map(pl=>{ const bs=grupos[pl].slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')); const v=veiculoByPlaca(pl);
    return `<div class="bat-group"><div class="bat-group-h">${plate(pl,(v||{}).tipo)}<span class="muted" style="font-size:12px">${bs.length} bateria(s)</span></div>
      ${bs.map(b=>{ const g=b.garantiaAte?situacao(b.garantiaAte):null;
        return `<div class="bat-item">
          <div class="bat-main"><b>${esc(b.marca||'—')}</b><div class="muted" style="font-size:12px">${esc(b.local||'')}</div></div>
          <div class="bat-meta"><span class="mono">${fmtD(b.data)}</span><span class="mono">${money(b.valor)}</span>
            ${b.garantiaAte?`<span class="st ${g.cls}">garantia ${fmtD(b.garantiaAte)}</span>`:`<span class="muted">${esc(b.garantiaMeses||'')} meses</span>`}
            ${b.telefone?`<span class="muted mono" style="font-size:11.5px">${esc(b.telefone)}</span>`:''}</div>
          <button class="btn ghost sm no-print" onclick="modalBateria('${b.id}')">${svg('edit')}</button></div>`; }).join('')}
    </div>`;
  }).join('');
  return `<div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
      ${kpi('battery','i-blue',DB.baterias.length,'Baterias registradas','')}
      ${kpi('shield','i-green',emGarantia,'Dentro da garantia','')}
      ${kpi('export','i-amber',money(total),'Investimento total','')}</div>
    <div class="toolbar"><div class="seg">${fb('cavalo','Cavalos')}${fb('carreta','Carretas')}${fb('todas','Todas')}</div>
      <select class="selectlite" onchange="batOrdem=this.value;router()">
        <option value="placa" ${batOrdem==='placa'?'selected':''}>Ordenar por placa</option>
        <option value="data" ${batOrdem==='data'?'selected':''}>Mais recentes</option>
        <option value="garantia" ${batOrdem==='garantia'?'selected':''}>Garantia (vence antes)</option>
        <option value="valor" ${batOrdem==='valor'?'selected':''}>Maior valor</option></select>
      <div class="spacer"></div><button class="btn primary" onclick="modalBateria()">${svg('plus')} Nova bateria</button></div>
    <div class="muted no-print" style="font-size:12px;margin-bottom:12px">A garantia aparece <b>somente aqui</b> — não gera alerta no painel.</div>
    <div class="grid" style="gap:14px">${blocos||emptyState('Nenhuma bateria neste grupo.')}</div>`;
}

/* ================================================================== */
/*  17. DOCUMENTOS (upload / download real)                            */
/* ================================================================== */
let docFiltroEnt='todos';
function fileThumb(f){
  const t=(f.type||'')+' '+(f.name||'');
  if(/image|jpg|jpeg|png|webp|gif/i.test(t)) return '🖼️';
  if(/pdf/i.test(t)) return '📕';
  if(/word|doc/i.test(t)) return '📘';
  if(/sheet|excel|xls|csv/i.test(t)) return '📗';
  if(/xml|nf/i.test(t)) return '🧾';
  return '📄';
}
function filesGrid(list){
  return `<div class="files">${list.map(f=>`<div class="filecard">
    <div class="fc-ico">${fileThumb(f)}</div>
    <div class="fc-main"><b title="${esc(f.name)}">${esc(f.name)}</b>
      <div class="muted" style="font-size:11px">${esc(f.categoria||'Arquivo')} · ${fileSize(f.size)}${f.validade?' · vence '+fmtD(f.validade):''}</div></div>
    <div class="fc-act no-print">
      <button class="btn ghost sm" title="Abrir" onclick="verArquivo('${f.id}')">${svg('eye')}</button>
      <button class="btn ghost sm" title="Baixar" onclick="baixarArquivo('${f.id}')">${svg('download')}</button>
      <button class="btn ghost sm" title="Excluir" onclick="excluirArquivo('${f.id}')">${svg('trash')}</button>
    </div></div>`).join('')}</div>`;
}
function viewDocumentos(){
  const fb=(k,l)=>`<button class="${docFiltroEnt===k?'active':''}" onclick="docFiltroEnt='${k}';router()">${l}</button>`;
  let ups=todosArquivos();
  if(docFiltroEnt==='empresa') ups=ups.filter(f=>f.entidade==='empresa');
  else if(docFiltroEnt==='motorista') ups=ups.filter(f=>f.entidade==='motorista');
  else if(docFiltroEnt==='veiculo') ups=ups.filter(f=>f.entidade==='veiculo');
  ups.sort((a,b)=>(b.uploadedAt||0)-(a.uploadedAt||0));

  const nomeVinc=(f)=> f.entidade==='motorista'?(motorista(f.refId)||{}).nome : f.entidade==='veiculo'?(veiculo(f.refId)||{}).placa : DB.empresa.nome;
  const upRows=ups.map(f=>`<tr>
    <td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:20px">${fileThumb(f)}</span><div><b>${esc(f.name)}</b><div class="muted" style="font-size:11.5px">${fileSize(f.size)} · ${new Date(f.uploadedAt).toLocaleDateString('pt-BR')}</div></div></div></td>
    <td>${esc(f.categoria||'—')}</td>
    <td>${esc(nomeVinc(f)||'—')}</td>
    <td>${f.validade?stBadge(f.validade):'<span class="muted">—</span>'}</td>
    <td class="no-print" style="text-align:right;white-space:nowrap">
      <button class="btn ghost sm" onclick="verArquivo('${f.id}')">${svg('eye')}</button>
      <button class="btn ghost sm" onclick="baixarArquivo('${f.id}')">${svg('download')}</button>
      <button class="btn ghost sm" onclick="excluirArquivo('${f.id}')">${svg('trash')}</button></td></tr>`).join('');

  // Arquivos reais da pasta da empresa (abrir/baixar/excluir da lista)
  const REG = DB.arquivos||[];
  let reg=REG.slice();
  if(docFiltroEnt==='empresa') reg=reg.filter(f=>f.entidade==='empresa');
  else if(docFiltroEnt==='motorista') reg=reg.filter(f=>f.entidade==='motorista');
  else if(docFiltroEnt==='veiculo') reg=reg.filter(f=>f.entidade==='veiculo');
  const vincReal=(f)=> f.entidade==='motorista'?((motorista(f.refId)||{}).nome||'Motorista') : f.entidade==='veiculo'?((veiculo(f.refId)||{}).placa||'Veículo') : DB.empresa.nome;
  const cats=[...new Set(reg.map(f=>f.categoria))].sort();
  const regBlocos=cats.map(c=>{ const fs=reg.filter(f=>f.categoria===c);
    return `<div class="card"><div class="card-h">${svg('folder')}<h3>${esc(c)}</h3><span class="sub">${fs.length}</span></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl"><tbody>${fs.map(f=>`<tr>
        <td><div style="display:flex;align-items:center;gap:10px"><span style="font-size:19px">${fileThumb({name:f.nome})}</span>
          <div style="min-width:0"><b style="display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">${esc(f.nome)}</b>
          <div class="muted" style="font-size:11px">${esc(vincReal(f))}</div></div></div></td>
        <td class="no-print" style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" title="Abrir" onclick="abrirReal('${esc(f.path)}')">${svg('eye')}</button>
          <button class="btn ghost sm" title="Baixar" onclick="baixarReal('${esc(f.path)}','${esc(f.nome)}')">${svg('download')}</button>
          <button class="btn ghost sm" title="Excluir da lista" onclick="excluirArquivoReg('${f.id}')">${svg('trash')}</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
  }).join('');

  return `
  <div class="banner">${svg('doc')}<div><b>Documentos da empresa</b><span>Todos os arquivos da pasta (CRLV, ASO, toxicológicos, CNH, jurídicos...) já ficam aqui para abrir e baixar. Você também pode enviar arquivos novos, que ficam guardados dentro do sistema.</span></div>
    <label class="btn primary no-print" style="margin-left:auto">${svg('upload')} Enviar arquivo<input type="file" id="docFileInput" onchange="uploadGeral(event)" style="display:none" multiple></label></div>

  <div class="toolbar"><div class="seg">${fb('todos','Todos')}${fb('empresa','Empresa')}${fb('motorista','Motoristas')}${fb('veiculo','Veículos')}</div>
    <div class="spacer"></div><div class="muted">${REG.length} arquivo(s) na pasta · ${totalArquivos()} enviado(s)${_online()?' · ☁ sincronizado':''}</div></div>

  ${ups.length?`<div class="card" style="margin-bottom:18px"><div class="card-h">${svg('upload')}<h3>Arquivos enviados no sistema</h3></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Arquivo</th><th>Categoria</th><th>Vinculado a</th><th>Validade</th><th class="no-print"></th></tr></thead>
      <tbody>${upRows}</tbody></table></div></div></div>`:''}

  <h3 style="font-size:14px;margin:8px 0 12px;color:var(--text-soft)">Arquivos da pasta da empresa</h3>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">${regBlocos||emptyState('Nenhum arquivo neste filtro.')}</div>
  <div class="hint" style="margin-top:12px">Obs.: os arquivos da pasta abrem quando você usa o sistema pelo computador (a partir do index.html). No celular (arquivo único), use os arquivos enviados.</div>`;
}

/* ---- upload / download handlers ---- */
let _uploadCtx = {entidade:'empresa', refId:'empresa'};
function uploadPara(entidade, refId, categoria){ _uploadCtx={entidade,refId};
  const inp=document.createElement('input'); inp.type='file'; inp.multiple=true;
  inp.onchange=(e)=>processUpload(e.target.files, entidade, refId, categoria); inp.click();
}
function uploadGeral(ev){ processUpload(ev.target.files,'empresa','empresa'); ev.target.value=''; }
function _online(){ return typeof nuvemAtiva==='function' && nuvemAtiva() && nuvemUser && nuvemUser(); }
/* Envia UM arquivo: guarda cópia local (IndexedDB) e, se online, sobe para a nuvem + registra metadados sincronizados */
async function subirUm(file, entidade, refId, categoria){
  const id=uid('f');
  const meta={ id, name:file.name, type:file.type||'', size:file.size, categoria:categoria||guessCat(file.name),
    entidade, refId, validade:'', obs:'', uploadedAt:Date.now(), storagePath:'' };
  try{ if(IDB) await idbPut(Object.assign({}, meta, {blob:file})); }catch(e){}
  if(_online()){
    try{ const path=id+'-'+String(file.name).replace(/[^\w.\-]/g,'_'); await nuvemUpload(path, file); meta.storagePath=path; }
    catch(e){ toast('Arquivo guardado, mas falhou o envio à nuvem: '+(e.message||''),'err'); }
    if(!Array.isArray(DB.anexos)) DB.anexos=[];
    DB.anexos.push(meta);
  }
  return meta;
}
async function processUpload(files, entidade, refId, categoria){
  if(!files||!files.length) return;
  if(!IDB && !_online()){ toast('Upload indisponível neste navegador. Abra em Chrome ou Edge.','err'); return; }
  for(const file of files){ await subirUm(file, entidade, refId, categoria); }
  await reloadFiles(); saveDB(); toast(files.length+' arquivo(s) enviado(s)'+(_online()?' e sincronizado(s).':'.')); router();
}
function guessCat(name){ const n=name.toLowerCase();
  if(/crlv|licenc/.test(n)) return 'CRLV';
  if(/cnh/.test(n)) return 'CNH';
  if(/aso/.test(n)) return 'ASO';
  if(/tox/.test(n)) return 'Toxicológico';
  if(/nf|nota/.test(n)) return 'Nota Fiscal';
  if(/pgr|pcmso/.test(n)) return 'SST';
  return 'Documento';
}
function _localBlob(id){ const f=FILES.find(x=>x.id===id); return f?f.blob:null; }
async function _urlArquivo(id){
  const b=_localBlob(id); if(b) return {url:URL.createObjectURL(b), local:true};
  const a=(DB.anexos||[]).find(x=>x.id===id);
  if(a && a.storagePath){ try{ const u=await nuvemUrlArquivo(a.storagePath); if(u) return {url:u, local:false}; }catch(e){} }
  return null;
}
async function verArquivo(id){ const r=await _urlArquivo(id); if(!r){ toast('Não foi possível abrir o arquivo.','err'); return; }
  window.open(r.url,'_blank'); if(r.local) setTimeout(()=>URL.revokeObjectURL(r.url),20000); }
async function baixarArquivo(id){ const r=await _urlArquivo(id); if(!r){ toast('Não foi possível baixar o arquivo.','err'); return; }
  const a=arquivoPorId(id); const nm=a?a.name:'arquivo';
  const el=document.createElement('a'); el.href=r.url; el.download=nm; el.target='_blank'; document.body.appendChild(el); el.click(); el.remove();
  if(r.local) setTimeout(()=>URL.revokeObjectURL(r.url),4000); }
async function excluirArquivo(id){ if(!confirm('Excluir este arquivo definitivamente?'))return;
  const a=(DB.anexos||[]).find(x=>x.id===id);
  if(a){ if(a.storagePath && typeof nuvemRemoverArquivo==='function'){ try{ await nuvemRemoverArquivo(a.storagePath); }catch(e){} } DB.anexos=DB.anexos.filter(x=>x.id!==id); }
  try{ await idbDel(id); }catch(e){}
  await reloadFiles(); saveDB(); toast('Arquivo excluído.'); router(); }
function excluirArquivoReg(id){ if(!confirm('Remover este documento da lista? (o arquivo original na pasta não é apagado)'))return; DB.arquivos=(DB.arquivos||[]).filter(f=>f.id!==id); saveDB(); toast('Documento removido da lista.'); router(); }

/* ================================================================== */
/*  18. CONFIGURAÇÕES                                                  */
/* ================================================================== */
function viewConfig(){ const c=DB.config;
  const temLib = (typeof window!=='undefined' && window.supabase);
  const online = (typeof nuvemAtiva==='function' && nuvemAtiva());
  const cfgSalvo = (window.PEX_CONFIG||{});
  const cloudCard = !temLib ? '' : (online ? '' : `
    <div class="card" style="grid-column:1/-1"><div class="card-h">${svg('lock')}<h3>Conectar à nuvem (login e sincronização)</h3></div>
      <div class="card-b">
        <p class="muted" style="margin-bottom:14px">Cole aqui os 2 códigos do seu projeto Supabase (veja o arquivo <b>SETUP-ONLINE.txt</b>). Depois de conectar, o sistema pede login e passa a sincronizar entre celular e computador.</p>
        <div class="field"><label>Project URL</label><input id="onUrl" value="${esc(cfgSalvo.url||'')}" placeholder="https://xxxxx.supabase.co"></div>
        <div class="field"><label>Chave anon public</label><input id="onKey" value="${esc(cfgSalvo.key||'')}" placeholder="eyJhbGciOi..."></div>
        <button class="btn primary" onclick="salvarOnlineCfg()">${svg('lock')} Conectar</button>
        ${(cfgSalvo.url||cfgSalvo.key)?`<button class="btn" style="margin-left:8px" onclick="desconectarOnline()">Limpar</button>`:''}
      </div></div>`);
  return `<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start;gap:18px">
    ${cloudCard}
    <div class="card"><div class="card-h">${svg('bell')}<h3>Alertas de vencimento</h3></div>
      <div class="card-b">
        <div class="field-row"><div class="field"><label>Prazo "crítico" (dias)</label><input type="number" id="cfgCrit" value="${c.alertaCritico}"></div>
          <div class="field"><label>Prazo "atenção" (dias)</label><input type="number" id="cfgAten" value="${c.alertaAtencao}"></div></div>
        <div class="field-row"><div class="field"><label>Alerta de troca — KM restantes</label><input type="number" id="cfgKm" value="${c.alertaKm}"></div>
          <div class="field"><label>Alerta de troca — Horas restantes</label><input type="number" id="cfgHora" value="${c.alertaHora}"></div></div>
        <button class="btn primary" onclick="salvarConfig()">Salvar preferências</button>
      </div></div>
    <div class="card"><div class="card-h">${svg('shield')}<h3>Backup e dados</h3></div>
      <div class="card-b">
        <p class="muted" style="margin-bottom:14px">Os dados ficam neste computador. Faça backups e guarde em pendrive/nuvem. O backup inclui cadastros; os arquivos enviados ficam no navegador (exporte-os individualmente se precisar).</p>
        <div class="chips" style="margin-bottom:16px">
          <button class="btn" onclick="exportar()">${svg('export')} Exportar backup (.json)</button>
          <label class="btn">${svg('import')} Importar backup<input type="file" accept="application/json" onchange="importar(event)" style="display:none"></label></div>
        <div class="divider"></div>
        <button class="btn danger" onclick="restaurarFabrica()">${svg('trash')} Restaurar dados de fábrica</button>
        <div class="hint" style="margin-top:8px">Substitui os cadastros pelos dados originais.</div>
      </div></div>
    ${(typeof nuvemAtiva==='function'&&nuvemAtiva())?`<div class="card" style="grid-column:1/-1"><div class="card-h">${svg('lock')}<h3>Conta online</h3></div>
      <div class="card-b">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div class="st ok">Conectado à nuvem</div>
          <span class="muted">${esc((nuvemUser&&nuvemUser()&&nuvemUser().email)||'')} (${esc(nomeUsuario()||'')})</span>
          <div style="flex:1"></div>
          <button class="btn" onclick="logoutNuvem()">Sair da conta</button>
        </div>
        <div class="divider"></div>
        <div class="chips">
          <button class="btn" onclick="modalTrocarSenhaConta()">${svg('lock')} Alterar minha senha</button>
          <button class="btn" onclick="modalGerenciarUsuarios()">${svg('user')} Gerenciar usuários</button>
          <button class="btn" onclick="exportar()">${svg('export')} Backup dos dados</button>
        </div>
      </div></div>`:''}
    <div class="card" style="grid-column:1/-1"><div class="card-h">${svg('gear')}<h3>Sobre o sistema</h3></div>
      <div class="card-b"><div class="info-grid">
        <div class="it"><div class="l">Empresa</div><div class="v">${esc(DB.empresa.nome)}</div></div>
        <div class="it"><div class="l">CNPJ</div><div class="v">${esc(DB.empresa.cnpj)}</div></div>
        <div class="it"><div class="l">Veículos</div><div class="v">${DB.veiculos.length}</div></div>
        <div class="it"><div class="l">Motoristas</div><div class="v">${DB.motoristas.length}</div></div>
        <div class="it"><div class="l">Vencimentos</div><div class="v">${DB.vencimentos.length}</div></div>
        <div class="it"><div class="l">Arquivos enviados</div><div class="v">${totalArquivos()}</div></div>
        <div class="it"><div class="l">Versão</div><div class="v">2.0</div></div>
      </div></div></div>
  </div>`;
}

/* ================================================================== */
/*  19. MODAIS                                                         */
/* ================================================================== */
function openModal(html,wide){ const ov=document.getElementById('overlay'); ov.innerHTML=`<div class="modal ${wide?'wide':''}">${html}</div>`; ov.classList.add('show'); }
function closeModal(){ const ov=document.getElementById('overlay'); ov.classList.remove('show'); ov.innerHTML=''; }
function fld(label,id,val,type,hint){ return `<div class="field"><label>${label}</label><input id="${id}" type="${type||'text'}" value="${esc(val==null?'':val)}">${hint?`<div class="hint">${hint}</div>`:''}</div>`; }
function sel(label,id,val,opts){ return `<div class="field"><label>${label}</label><select id="${id}">${opts.map(o=>`<option value="${esc(o)}" ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`; }
function val(id){ const e=document.getElementById(id); return e?(e.value||'').trim():''; }

const UFS=['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
function msec(t){ return `<div class="msec">${t}</div>`; }
function modalMotorista(id){
  const m=id?motorista(id):{status:'Ativo',categoria:'E',genero:'Masculino',ear:'Sim',socio:false};
  openModal(`<div class="m-h">${svg('user')}<h3>${id?'Editar condutor':'Novo condutor'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      ${msec('Identificação')}
      <div class="field-row">${fld('Matrícula','f_mat',m.matricula)}${fld('Nome completo','f_nome',m.nome)}</div>
      <div class="field-row">${fld('Nascimento','f_nasc',m.nascimento,'date')}${sel('Gênero','f_gen',m.genero,['Masculino','Feminino'])}</div>
      <div class="field-row">${fldMask('Celular','f_cel',m.celular,'fone','(  ) automático')}${fldMask('Telefone','f_tel',m.telefone,'fone','(  ) automático')}</div>
      ${fld('E-mail','f_email',m.email)}
      <div class="field-row">${sel('UF Naturalidade','f_ufnat',m.ufNat||'',UFS)}${fld('Município Naturalidade','f_munat',m.municipioNat)}</div>
      <div class="field-row">${fld('Tipo de Condutor','f_tipo',m.tipoCondutor)}${sel('Status','f_status',m.status,['Ativo','Inativo','Afastado','Férias'])}</div>

      ${msec('Documentos')}
      <div class="field-row">${fldMask('CPF','f_cpf',m.cpf,'cpf','000.000.000-00 automático')}${fldMask('RG','f_rg',m.rg,'rg','pontuação automática')}</div>
      ${fld('Emissor RG','f_emrg',m.emissorRg)}

      ${msec('Dados Trabalhistas')}
      <div class="field-row">${fld('Cargo','f_cargo',m.cargo)}${fld('Data Admissão','f_adm',m.admissao,'date')}</div>
      <div class="field-row">${fld('CTPS','f_ctps',m.ctps)}${fld('PIS','f_pis',m.pis)}</div>
      ${fld('Função no sistema','f_func',m.funcao,'text','Ex.: Sócio · Responsável Técnico · Motorista')}
      <label class="chkbox"><input type="checkbox" id="f_socio" ${m.socio?'checked':''}> É sócio da empresa (aparece no Quadro Societário)</label>

      ${msec('Habilitação (CNH)')}
      <div class="field-row">${sel('Categoria','f_cat',m.categoria,['A','B','C','D','E','AB','AC','AD','AE'])}${fld('Número','f_cnhn',m.cnh)}</div>
      <div class="field-row">${fld('Primeira Habilitação','f_prim',m.primeiraHab,'date')}${fld('Data Emissão','f_emis',m.emissaoCnh,'date')}</div>
      <div class="field-row">${fld('Validade','f_cnh',m.cnhValidade,'date')}${sel('EAR (atividade remunerada)','f_ear',m.ear||'Sim',['Sim','Não'])}</div>
      <div class="field-row">${sel('UF','f_cnhuf',m.cnhUf||'',UFS)}${fld('Município','f_cnhmun',m.cnhMunicipio)}</div>
      <div class="field-row">${fld('RENACH','f_renach',m.renach)}${fld('Espelho','f_esp',m.espelho)}</div>

      ${msec('ANTT')}
      <div class="field-row">${fld('RNTRC','f_rntrc',m.rntrc)}${fld('Situação','f_rntrcsit',m.rntrcSituacao)}</div>
      <div class="field-row">${fld('Data Cadastro','f_rntrccad',m.rntrcCadastro,'date')}${fld('Data Validade','f_rntrcval',m.rntrcValidade,'date')}</div>

      ${msec('Endereço')}
      <div class="field-row">${fldMask('CEP','f_cep',m.cep,'cep','00000-000 automático')}${fld('Logradouro','f_log',m.logradouro)}</div>
      <div class="field-row">${fld('Número','f_num',m.numero)}${fld('Complemento','f_comp',m.complemento)}</div>
      ${fld('Bairro','f_bairro',m.bairro)}
      <div class="field-row">${sel('UF','f_ufend',m.ufEnd||'',UFS)}${fld('Município','f_munend',m.municipioEnd)}</div>

      ${msec('Foto')}
      ${fld('Caminho da foto','f_foto',m.foto,'text','Ex.: assets/fotos/m1.png (opcional)')}
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirMotorista('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarMotorista('${id||''}')">Salvar</button></div>`, true);
}
function salvarMotorista(id){ if(!val('f_nome')){toast('Informe o nome.','err');return;}
  const d={matricula:val('f_mat'),nome:val('f_nome'),nascimento:val('f_nasc'),genero:val('f_gen'),celular:maskFone(val('f_cel')),telefone:maskFone(val('f_tel')),email:val('f_email'),
    ufNat:val('f_ufnat'),municipioNat:val('f_munat'),tipoCondutor:val('f_tipo'),status:val('f_status'),
    cpf:maskCPF(val('f_cpf')),rg:maskRG(val('f_rg')),emissorRg:val('f_emrg'),
    cargo:val('f_cargo'),admissao:val('f_adm'),ctps:val('f_ctps'),pis:val('f_pis'),funcao:val('f_func'),socio:document.getElementById('f_socio').checked,
    categoria:val('f_cat'),cnh:val('f_cnhn'),primeiraHab:val('f_prim'),emissaoCnh:val('f_emis'),cnhValidade:val('f_cnh'),ear:val('f_ear'),cnhUf:val('f_cnhuf'),cnhMunicipio:val('f_cnhmun'),renach:val('f_renach'),espelho:val('f_esp'),
    rntrc:val('f_rntrc'),rntrcSituacao:val('f_rntrcsit'),rntrcCadastro:val('f_rntrccad'),rntrcValidade:val('f_rntrcval'),
    cep:maskCEP(val('f_cep')),logradouro:val('f_log'),numero:val('f_num'),complemento:val('f_comp'),bairro:val('f_bairro'),ufEnd:val('f_ufend'),municipioEnd:val('f_munend'),foto:val('f_foto')};
  d.endereco=[d.logradouro, d.numero].filter(Boolean).join(', ')+(d.bairro?' — '+d.bairro:'')+(d.municipioEnd?', '+d.municipioEnd+(d.ufEnd?'/'+d.ufEnd:''):'');
  if(d.endereco===', ') d.endereco='';
  if(id){ Object.assign(motorista(id),d); const cv=DB.vencimentos.find(v=>v.tipo==='CNH'&&v.refId===id); if(cv){ if(d.cnhValidade)cv.validade=d.cnhValidade; if(d.cnh)cv.numero=d.cnh; } }
  else{ d.id=uid('m'); DB.motoristas.push(d); if(d.cnhValidade)DB.vencimentos.push({id:uid('c'),tipo:'CNH',entidade:'motorista',refId:d.id,emissao:d.emissaoCnh||'',validade:d.cnhValidade,numero:d.cnh||'',orgao:'',obs:'Categoria '+d.categoria}); }
  saveDB(); closeModal(); toast('Condutor salvo.'); router();
}
function excluirMotorista(id){ if(!confirm('Excluir este motorista e seus vencimentos?'))return; DB.motoristas=DB.motoristas.filter(m=>m.id!==id); DB.vencimentos=DB.vencimentos.filter(v=>!(v.entidade==='motorista'&&v.refId===id)); saveDB(); closeModal(); toast('Motorista excluído.'); location.hash='motoristas'; router(); }

function modalVeiculo(id){
  const v=id?veiculo(id):{placa:'',tipo:'Cavalo',marca:'',modelo:'',chassi:'',renavam:'',anoModelo:'',crlvAno:'',cor:'',status:'Ativo',kmAtual:'',horaAtual:''};
  openModal(`<div class="m-h">${svg('truck')}<h3>${id?'Editar veículo':'Novo veículo'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Placa','f_placa',v.placa)}${sel('Tipo','f_tipo',v.tipo,['Cavalo','Reboque Frigorífico','Reboque','Truck','Utilitário'])}</div>
      <div class="field-row">${fld('Marca','f_marca',v.marca)}${fld('Modelo','f_modelo',v.modelo)}</div>
      <div class="field-row">${fld('Renavam','f_renavam',v.renavam)}${fld('Ano/Modelo','f_ano',v.anoModelo)}</div>
      <div class="field-row">${fld('Chassi','f_chassi',v.chassi)}${fld('CRLV (ano)','f_crlv',v.crlvAno)}</div>
      <div class="field-row">${fld('KM atual (cavalo)','f_km',v.kmAtual,'number')}${fld('Horas atuais (carreta)','f_hora',v.horaAtual,'number')}</div>
      ${sel('Situação','f_vstatus',v.status,['Ativo','Manutenção','Arquivado','Vendido'])}
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirVeiculo('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarVeiculo('${id||''}')">Salvar</button></div>`);
}
function salvarVeiculo(id){ if(!val('f_placa')){toast('Informe a placa.','err');return;}
  const km=val('f_km'), hora=val('f_hora');
  const d={placa:val('f_placa').toUpperCase(),tipo:val('f_tipo'),marca:val('f_marca'),modelo:val('f_modelo'),renavam:val('f_renavam'),anoModelo:val('f_ano'),chassi:val('f_chassi').toUpperCase(),crlvAno:val('f_crlv'),status:val('f_vstatus'),kmAtual:km===''?null:+km,horaAtual:hora===''?null:+hora};
  if(id)Object.assign(veiculo(id),d); else{ d.id=uid('v'); d.cor=''; DB.veiculos.push(d); }
  saveDB(); closeModal(); toast('Veículo salvo.'); router();
}
function excluirVeiculo(id){ if(!confirm('Excluir este veículo e seus vencimentos/manutenções?'))return; DB.veiculos=DB.veiculos.filter(v=>v.id!==id); DB.vencimentos=DB.vencimentos.filter(v=>!(v.entidade==='veiculo'&&v.refId===id)); DB.manutencoes=DB.manutencoes.filter(m=>m.veiculoId!==id); saveDB(); closeModal(); toast('Veículo excluído.'); location.hash='frota'; router(); }

const TIPOS_VENC=['CNH','Toxicológico','ASO','Direção Defensiva','Tacógrafo','CRLV','Vigilância Sanitária','Opentech Funcionário','Opentech Veículo','PCMSO','PGR','Certificado Digital','Seguro','Rastreador','Outro'];
function modalVencimento(id, entidadeFix, refFix, tipoFix){
  const v=id?DB.vencimentos.find(x=>x.id===id):{tipo:tipoFix||'Toxicológico',entidade:entidadeFix||'motorista',refId:refFix||'',emissao:'',validade:'',numero:'',orgao:'',obs:'',anexoId:''};
  const optsRef=(ent)=>{ if(ent==='motorista')return DB.motoristas.map(m=>`<option value="${m.id}" ${v.refId===m.id?'selected':''}>${esc(m.nome)}</option>`).join('');
    if(ent==='veiculo')return DB.veiculos.map(x=>`<option value="${x.id}" ${v.refId===x.id?'selected':''}>${esc(x.placa)}</option>`).join('');
    return `<option value="empresa" selected>${esc(DB.empresa.nome)}</option>`; };
  const anexosDisp=filesDe(v.entidade, v.refId);
  const anexoAtual=v.anexoId&&arquivoPorId(v.anexoId);
  openModal(`<div class="m-h">${svg('bell')}<h3>${id?'Editar vencimento':'Novo vencimento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Tipo de documento</label><select id="f_tipo">${TIPOS_VENC.map(t=>`<option ${v.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label>Vínculo</label><select id="f_ent" onchange="_refRef()">
          <option value="motorista" ${v.entidade==='motorista'?'selected':''}>Motorista</option>
          <option value="veiculo" ${v.entidade==='veiculo'?'selected':''}>Veículo</option>
          <option value="empresa" ${v.entidade==='empresa'?'selected':''}>Empresa</option></select></div>
        <div class="field"><label>Registro</label><select id="f_ref">${optsRef(v.entidade)}</select></div>
      </div>
      <div class="field-row">${fld('Emissão','f_emis',v.emissao,'date')}${fld('Validade','f_valid',v.validade,'date')}</div>
      <div class="field-row">${fld('Número do documento','f_num',v.numero)}${fld('Órgão emissor','f_org',v.orgao)}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(v.obs)}"></div>
      <div class="field"><label>Anexo — imagem, PDF, foto do exame...</label>
        <input type="hidden" id="f_anexo" value="${v.anexoId||''}">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="btn sm">${svg('upload')} Anexar arquivo<input type="file" accept="image/*,application/pdf,.doc,.docx" onchange="anexarVenc(this)" style="display:none"></label>
          <span id="f_anexo_nome" class="muted" style="font-size:12.5px">${anexoAtual?('📎 '+esc(anexoAtual.name)):'Nenhum arquivo anexado'}</span>
        </div>
        ${anexosDisp.length?`<select id="f_anexo_sel" onchange="document.getElementById('f_anexo').value=this.value;document.getElementById('f_anexo_nome').innerHTML=this.value?('📎 '+this.options[this.selectedIndex].text):'Nenhum arquivo anexado'" style="margin-top:8px">
          <option value="">— ou escolher um já enviado —</option>${anexosDisp.map(f=>`<option value="${f.id}" ${v.anexoId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`:''}
        <div class="hint">A imagem/arquivo fica guardada no sistema e disponível para baixar depois.</div>
      </div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirVencimento('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarVencimento('${id||''}')">Salvar</button></div>`);
  window._refRef=function(){ document.getElementById('f_ref').innerHTML=optsRef(val('f_ent')); };
}
function salvarVencimento(id){ if(!val('f_valid')){toast('Informe a validade.','err');return;}
  const d={tipo:val('f_tipo'),entidade:val('f_ent'),refId:val('f_ref'),emissao:val('f_emis'),validade:val('f_valid'),numero:val('f_num'),orgao:val('f_org'),obs:val('f_obs'),anexoId:val('f_anexo')};
  if(id)Object.assign(DB.vencimentos.find(x=>x.id===id),d); else{ d.id=uid('vc'); DB.vencimentos.push(d); }
  saveDB(); closeModal(); toast('Vencimento salvo.'); router();
}
function excluirVencimento(id){ if(!confirm('Excluir este vencimento?'))return; DB.vencimentos=DB.vencimentos.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
async function anexarVenc(input){
  const files=input.files; if(!files||!files.length)return;
  if(!IDB && !_online()){ toast('Anexo indisponível neste navegador (use Chrome ou Edge).','err'); return; }
  const ent=val('f_ent'), ref=val('f_ref'), file=files[0];
  const meta=await subirUm(file, ent, ref, val('f_tipo')||'Documento');
  await reloadFiles(); saveDB();
  const h=document.getElementById('f_anexo'); if(h) h.value=meta.id;
  const n=document.getElementById('f_anexo_nome'); if(n) n.innerHTML='📎 '+esc(meta.name)+' — anexado ✓';
  toast('Arquivo anexado'+(_online()?' e sincronizado.':'.'));
}

function modalBateria(id){
  const b=id?DB.baterias.find(x=>x.id===id):{data:'',placa:(DB.veiculos[0]||{}).placa||'',marca:'',local:'',valor:'',garantiaMeses:12,garantiaAte:'',telefone:''};
  openModal(`<div class="m-h">${svg('battery')}<h3>${id?'Editar bateria':'Nova bateria'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data da compra','f_data',b.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${DB.veiculos.map(v=>`<option ${b.placa===v.placa?'selected':''}>${esc(v.placa)}</option>`).join('')}</select></div></div>
      <div class="field-row">${fld('Marca / capacidade','f_marca',b.marca)}${fldR$('Valor (R$)','f_valor',b.valor)}</div>
      ${fld('Local de compra','f_local',b.local)}
      <div class="field-row">${fld('Garantia (meses)','f_gm',b.garantiaMeses,'number')}${fld('Garantia até','f_ga',b.garantiaAte,'date')}</div>
      ${fldMask('Telefone do fornecedor','f_tel',b.telefone,'fone','(  ) automático')}
</div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirBateria('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarBateria('${id||''}')">Salvar</button></div>`);
}
function salvarBateria(id){ const d={data:val('f_data'),placa:val('f_placa'),marca:val('f_marca'),local:val('f_local'),valor:parseBRL(val('f_valor')),garantiaMeses:parseInt(val('f_gm'))||12,garantiaAte:val('f_ga'),telefone:maskFone(val('f_tel'))};
  if(id)Object.assign(DB.baterias.find(x=>x.id===id),d); else{ d.id=uid('b'); DB.baterias.push(d); } saveDB(); closeModal(); toast('Bateria salva.'); router(); }
function excluirBateria(id){ if(!confirm('Excluir esta bateria?'))return; DB.baterias=DB.baterias.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluída.'); router(); }

function modalManutencao(id,vId){
  const m=id?DB.manutencoes.find(x=>x.id===id):{veiculoId:vId||(DB.veiculos[0]||{}).id,item:'',data:'',intervalo:'',kmTroca:'',proxKm:'',horasTroca:'',proxHoras:''};
  openModal(`<div class="m-h">${svg('wrench')}<h3>${id?'Editar manutenção':'Novo registro'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${m.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.marca)} ${esc(v.modelo)}</option>`).join('')}</select></div>
      <div class="field-row">${fld('Item / serviço','f_item',m.item)}${fld('Intervalo','f_int',m.intervalo,'text','Ex.: 20.000 km / 1.000 h')}</div>
      ${fld('Data da última troca','f_data',m.data,'date')}
      <div class="field-row">${fld('Odômetro na troca (km)','f_km',m.kmTroca,'number')}${fld('Próxima troca (km)','f_pkm',m.proxKm,'number')}</div>
      <div class="field-row">${fld('Horas na troca','f_h',m.horasTroca,'number')}${fld('Próxima (horas)','f_ph',m.proxHoras,'number')}</div>
      <div class="hint">Cavalos: preencha KM. Carretas (Thermo King): preencha horas.</div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirManutencao('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarManutencao('${id||''}')">Salvar</button></div>`);
}
function numOrNull(id){ const s=val(id); return s===''?null:parseFloat(s); }
function salvarManutencao(id){ if(!val('f_item')){toast('Informe o item.','err');return;}
  const d={veiculoId:val('f_veic'),item:val('f_item'),intervalo:val('f_int'),data:val('f_data'),kmTroca:numOrNull('f_km'),proxKm:numOrNull('f_pkm'),horasTroca:numOrNull('f_h'),proxHoras:numOrNull('f_ph')};
  if(id)Object.assign(DB.manutencoes.find(x=>x.id===id),d); else{ d.id=uid('o'); DB.manutencoes.push(d); } saveDB(); closeModal(); toast('Manutenção salva.'); router(); }
function excluirManutencao(id){ if(!confirm('Excluir este registro?'))return; DB.manutencoes=DB.manutencoes.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

function modalDocumento(id){
  const d=id?DB.documentos.find(x=>x.id===id):{titulo:'',categoria:'Interno',entidade:'empresa',refId:'empresa',validade:'',arquivo:''};
  openModal(`<div class="m-h">${svg('doc')}<h3>${id?'Editar apontamento':'Novo apontamento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">${fld('Título','f_tit',d.titulo)}
      <div class="field-row">${fld('Categoria','f_cat',d.categoria)}${fld('Validade (se houver)','f_val',d.validade,'date')}</div>
      ${fld('Caminho do arquivo original','f_arq',d.arquivo,'text','Caminho dentro da pasta da empresa')}
      <div class="hint">Este é um apontamento (referência). Para guardar o arquivo dentro do sistema, use "Enviar arquivo".</div></div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirDocumento('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarDocumento('${id||''}')">Salvar</button></div>`);
}
function salvarDocumento(id){ if(!val('f_tit')){toast('Informe o título.','err');return;}
  const d={titulo:val('f_tit'),categoria:val('f_cat')||'Interno',entidade:'empresa',refId:'empresa',validade:val('f_val'),arquivo:val('f_arq')};
  if(id)Object.assign(DB.documentos.find(x=>x.id===id),d); else{ d.id=uid('d'); DB.documentos.push(d); } saveDB(); closeModal(); toast('Salvo.'); router(); }
function excluirDocumento(id){ if(!confirm('Excluir este apontamento?'))return; DB.documentos=DB.documentos.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ================================================================== */
/*  20. CONFIG / BACKUP / BUSCA / TOAST                                */
/* ================================================================== */
function salvarConfig(){ DB.config.alertaCritico=parseInt(val('cfgCrit'))||30; DB.config.alertaAtencao=parseInt(val('cfgAten'))||60;
  DB.config.alertaKm=parseInt(val('cfgKm'))||2000; DB.config.alertaHora=parseInt(val('cfgHora'))||200; saveDB(); toast('Preferências salvas.'); router(); }
function salvarOnlineCfg(){
  const url=(val('onUrl')||'').trim().replace(/\/+$/,''), key=(val('onKey')||'').trim();
  if(!/^https:\/\/.+\.supabase\.co$/.test(url)){ toast('Confira o Project URL (ex.: https://xxxx.supabase.co).','err'); return; }
  if(key.length<20){ toast('Confira a chave anon public.','err'); return; }
  try{ localStorage.setItem('pex_online_cfg', JSON.stringify({url:url,key:key})); }catch(e){}
  toast('Conectado! Recarregando para entrar…'); setTimeout(()=>location.reload(),800);
}
function desconectarOnline(){ if(!confirm('Desligar o modo online neste aparelho? Voltará a funcionar offline.'))return;
  try{ localStorage.removeItem('pex_online_cfg'); }catch(e){} setTimeout(()=>location.reload(),400); }
function exportar(){ const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='backup-planeta-express-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); toast('Backup exportado.'); }
function importar(ev){ const f=ev.target.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result); if(!d.veiculos||!d.motoristas)throw 0; DB=d; saveDB(); toast('Backup importado.'); location.hash='dashboard'; router(); }catch(e){ toast('Arquivo inválido.','err'); } };
  r.readAsText(f); }
function restaurarFabrica(){ if(!confirm('Substituir TODOS os cadastros pelos dados originais?'))return; DB=clone(SEED); saveDB(); toast('Dados restaurados.'); location.hash='dashboard'; router(); }

function buscaGlobal(q){ q=q.trim().toLowerCase(); if(!q){toast('Digite algo para buscar.');return;}
  const kq=q.replace(/[^a-z0-9]/g,'');
  const v=DB.veiculos.find(x=>x.placa.toLowerCase().replace(/[^a-z0-9]/g,'').includes(kq)&&kq.length>=3);
  if(v){ location.hash='frota/'+v.id; return; }
  const m=DB.motoristas.find(x=>x.nome.toLowerCase().includes(q)||(x.cpf||'').includes(q));
  if(m){ location.hash='motoristas/'+m.id; return; }
  toast('Nada encontrado para "'+q+'".','err'); }

function toast(msg,tipo){ const box=document.getElementById('toasts'); const t=document.createElement('div');
  t.className='toast '+(tipo==='err'?'err':'ok'); t.innerHTML=(tipo==='err'?'⚠ ':'✓ ')+esc(msg); box.appendChild(t);
  setTimeout(()=>{ t.style.opacity=0; t.style.transform='translateX(30px)'; setTimeout(()=>t.remove(),250); },3000); }

/* ================================================================== */
/*  21. RELÓGIO / SIDEBAR MOBILE / SPLASH                              */
/* ================================================================== */
/* ================================================================== */
/*  NOVAS ÁREAS (v2.2): Alarmes TK · Notas Fiscais · Pneus · Check-list*/
/* ================================================================== */

/* ---------- ALARMES THERMO KING ---------- */
let alarmeBusca='';
function viewAlarmes(){
  const lista = (typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]).filter(a=>{
    if(!alarmeBusca) return true; const q=alarmeBusca.toLowerCase();
    return a.c.toLowerCase().includes(q) || a.d.toLowerCase().includes(q);
  });
  return `
  <div class="banner">${svg('alarm')}<div><b>Tabela de Alarmes Thermo King</b><span>Referência dos códigos das unidades SB III / Super II / 190 / 210 / 210+ / 310 / 310+ / 400. Digite o número que aparece no visor para encontrar o significado.</span></div></div>
  <div class="toolbar">
    <div class="search" style="position:relative;flex:1;max-width:420px">
      ${svg('search')}<input id="alarmeSearch" class="alarme-input" placeholder="Buscar código ou descrição… (ex.: 61, bateria)" value="${esc(alarmeBusca)}" oninput="alarmeBusca=this.value;renderAlarmesList()">
    </div>
    <div class="spacer"></div><div class="muted">${lista.length} de ${(typeof ALARMES_TK!=='undefined'?ALARMES_TK.length:0)} códigos</div>
  </div>
  <div id="alarmeList" class="grid alarmgrid">${alarmeCards(lista)}</div>`;
}
function alarmeCards(lista){
  if(!lista.length) return emptyState('Nenhum código encontrado para essa busca.');
  return lista.map(a=>`<div class="alarmcard" onclick="modalAlarme('${esc(a.c)}')" title="Ver causa e solução"><div class="alarm-code">${esc(a.c)}</div><div class="alarm-desc">${esc(a.d)}</div><i class="alarm-go">→</i></div>`).join('');
}
function renderAlarmesList(){
  const el=document.getElementById('alarmeList'); if(!el) return;
  const q=alarmeBusca.toLowerCase();
  const lista=(typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]).filter(a=>!q||a.c.toLowerCase().includes(q)||a.d.toLowerCase().includes(q));
  el.innerHTML=alarmeCards(lista);
}

/* ---------- NOTAS FISCAIS ---------- */
function totalNota(n){ return (Number(n.alexandria)||0)+(Number(n.notasGerais)||0)+(Number(n.combustivel)||0); }
function viewNotas(){
  const notas=DB.notas.slice().sort((a,b)=>(b.fim||'').localeCompare(a.fim||''));
  const acumulado=notas.reduce((s,n)=>s+totalNota(n),0);
  const ultimo=notas[0];
  const somaAlex=notas.reduce((s,n)=>s+(Number(n.alexandria)||0),0);
  const somaComb=notas.reduce((s,n)=>s+(Number(n.combustivel)||0),0);
  const barras=notas.slice(0,8).reverse().map(n=>({label:fmtD(n.fim).slice(0,5),value:Math.round(totalNota(n))}));
  const rows=notas.map(n=>`<tr class="clickable" onclick="modalNota('${n.id}')">
    <td><b>${fmtD(n.inicio)} — ${fmtD(n.fim)}</b>${n.obs?`<div class="muted" style="font-size:12px">${esc(n.obs)}</div>`:''}</td>
    <td class="mono">${money(n.alexandria)}</td><td class="mono">${money(n.notasGerais)}</td><td class="mono">${money(n.combustivel)}</td>
    <td class="mono"><b>${money(totalNota(n))}</b></td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalNota('${n.id}')">${svg('edit')}</button></td></tr>`).join('');
  const AZ='#4a90d9', LA='#e0812f', CZ='#a6a6a6';
  const pizza = ultimo? [
    {label:'Alexandria', value:Number(ultimo.alexandria)||0, color:AZ},
    {label:'Notas em geral', value:Number(ultimo.notasGerais)||0, color:LA},
    {label:'Combustível', value:Number(ultimo.combustivel)||0, color:CZ}
  ]:[];
  return `
  <div class="banner">${svg('money')}<div><b>Notas de Despesa</b><span>Despesas somadas por período (Alexandria + Notas em geral + Combustível). Digite os valores no padrão R$ (ex.: 50.490,84).</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalNota()">${svg('plus')} Novo período</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
    ${kpi('money','i-green', ultimo?money(totalNota(ultimo)):money(0), 'Último período', ultimo?fmtD(ultimo.inicio)+' a '+fmtD(ultimo.fim):'—')}
    ${kpi('doc','i-blue', ultimo?money(ultimo.alexandria):money(0), 'Alexandria (período)','')}
    ${kpi('export','i-amber', ultimo?money(ultimo.notasGerais):money(0), 'Notas em geral (período)','')}
    ${kpi('truck','i-orange', ultimo?money(ultimo.combustivel):money(0), 'Combustível (período)','')}
  </div>
  <div class="grid two-col">
    <div class="card"><div class="card-h">${svg('money')}<h3>Despesas por período</h3>
      <div class="r no-print"><button class="btn sm" onclick="window.print()">${svg('print')}</button><button class="btn primary sm" onclick="modalNota()">${svg('plus')} Novo</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Período</th><th>Alexandria</th><th>Notas em geral</th><th>Combustível</th><th>Total</th><th class="no-print"></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="6">${emptyState('Nenhum período lançado.')}</td></tr>`}
        ${notas.length?`<tr style="background:#f7f9fc;font-weight:800"><td>TOTAL GERAL</td><td class="mono">${money(somaAlex)}</td><td class="mono">${money(notas.reduce((s,n)=>s+(Number(n.notasGerais)||0),0))}</td><td class="mono">${money(somaComb)}</td><td class="mono">${money(acumulado)}</td><td class="no-print"></td></tr>`:''}</tbody></table></div></div></div>
    <div class="card"><div class="card-h">${svg('dash')}<h3>Composição do último período</h3></div>
      <div class="card-b">${ultimo?`<div class="donut-wrap">
        ${donut(pizza,{center:'R$',sub:'último'})}
        <div class="legend">
          <div class="li"><span class="dot" style="background:${AZ}"></span>Alexandria<b>${money(ultimo.alexandria)}</b></div>
          <div class="li"><span class="dot" style="background:${LA}"></span>Notas em geral<b>${money(ultimo.notasGerais)}</b></div>
          <div class="li"><span class="dot" style="background:${CZ}"></span>Combustível<b>${money(ultimo.combustivel)}</b></div>
        </div></div>`:emptyState('Lance um período para ver a pizza.')}</div></div>
  </div>
  ${notas.length>1?`<div class="card" style="margin-top:18px"><div class="card-h">${svg('dash')}<h3>Evolução por período</h3></div>
    <div class="card-b">${barChart(barras)}</div></div>`:''}`;
}
/* Converte texto no padrão brasileiro (50.490,84) para número (50490.84) */
function parseBRL(s){ if(s==null)return 0; s=String(s).replace(/[^\d.,\-]/g,'').trim(); if(!s)return 0;
  if(s.indexOf(',')>=0){ s=s.replace(/\./g,'').replace(',','.'); }
  const n=parseFloat(s); return isNaN(n)?0:Math.round(n*100)/100; }
function r2(v){ return parseBRL(v); }
function fmtBRLin(v){ if(v==null||v===''){return '';} const n=Number(v); if(isNaN(n)){return '';} return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fldR$(label,id,v){ return `<div class="field"><label>${label}</label><input id="${id}" type="text" inputmode="decimal" placeholder="0,00" value="${esc(fmtBRLin(v))}"><div class="hint">Use vírgula para centavos. Ex.: 50490,84</div></div>`; }
function modalNota(id){
  const n=id?DB.notas.find(x=>x.id===id):{inicio:'',fim:'',alexandria:'',notasGerais:'',combustivel:'',obs:''};
  openModal(`<div class="m-h">${svg('money')}<h3>${id?'Editar período':'Novo período de notas'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Início do período','f_ini',n.inicio,'date')}${fld('Fim do período','f_fim',n.fim,'date')}</div>
      <div class="field-row">${fldR$('Alexandria (R$)','f_alex',n.alexandria)}${fldR$('Notas em geral (R$)','f_ger',n.notasGerais)}</div>
      ${fldR$('Combustível (R$)','f_comb',n.combustivel)}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(n.obs)}"></div>
      <div class="hint">O total é somado automaticamente (Alexandria + Notas em geral + Combustível).</div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirNota('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarNota('${id||''}')">Salvar</button></div>`);
}
function salvarNota(id){ if(!val('f_fim')){toast('Informe o fim do período.','err');return;}
  const d={inicio:val('f_ini'),fim:val('f_fim'),alexandria:r2(val('f_alex'))||0,notasGerais:r2(val('f_ger'))||0,combustivel:r2(val('f_comb'))||0,obs:val('f_obs')};
  if(id)Object.assign(DB.notas.find(x=>x.id===id),d); else{ d.id=uid('nf'); DB.notas.push(d); } saveDB(); closeModal(); toast('Período salvo.'); router(); }
function excluirNota(id){ if(!confirm('Excluir este período?'))return; DB.notas=DB.notas.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ---------- PNEUS ---------- */
const PNEU_STATUS=['Novo','Usado','Recapado','Estepe','Descarte'];
function pneuKmRodado(p){ const v=veiculo(p.veiculoId); if(!v||v.kmAtual==null||p.kmInstalacao==null) return null; const r=v.kmAtual-p.kmInstalacao; return r>=0?r:null; }
/* Quantidade de um registro de pneu e total somado (cada linha pode ter vários pneus) */
function pneuQtd(p){ return parseInt(p&&p.qtd)||1; }
function pneuTotal(list){ return (list||DB.pneus).reduce((s,p)=>s+pneuQtd(p),0); }
function viewPneus(){
  const total=pneuTotal();
  const veics=DB.veiculos.filter(v=>v.status!=='Arquivado');
  const comPneus=veics.filter(v=>DB.pneus.some(p=>p.veiculoId===v.id));
  const blocos=comPneus.map(v=>{ const cavalo=v.tipo==='Cavalo';
    const ps=DB.pneus.filter(p=>p.veiculoId===v.id).sort((a,b)=>(a.posicao||'').localeCompare(b.posicao||''));
    return `<div class="card"><div class="card-h">${plate(v.placa,v.tipo)}<h3 style="font-size:14px">${esc(v.marca)} ${esc(v.modelo)}</h3>
      <span class="sub">${pneuTotal(ps)} pneu(s) · ${cavalo?'atual '+num(v.kmAtual)+' km':'atual '+num(v.horaAtual)+' h'}</span>
      <div class="r no-print"><a class="btn sm" href="#km">${svg('gauge')} KM/Horas</a><button class="btn sm" onclick="modalPneu(null,'${v.id}')">${svg('plus')}</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Qtd</th><th>Posição</th><th>Marca / Medida</th><th>DOT</th><th>Instalação</th><th>Rodado (atualiza c/ o KM)</th><th>Status</th><th class="no-print"></th></tr></thead>
        <tbody>${ps.map(p=>{ const km=pneuKmRodado(p);
          return `<tr class="clickable" onclick="modalPneu('${p.id}')"><td><span class="qtd-badge">${p.qtd||1}</span></td>
          <td><b>${esc(p.posicao||'—')}</b></td>
          <td><b>${esc(p.marca||'—')}</b><div class="muted" style="font-size:11.5px">${esc(p.medida||'')}</div></td>
          <td class="mono muted">${esc(p.dot||'—')}</td><td class="mono">${fmtD(p.dataInstalacao)}</td>
          <td class="mono"><b>${km!=null?num(km)+' km':'—'}</b></td>
          <td><span class="tag">${esc(p.status||'—')}</span>${(/usado|recap/i.test(p.status||'')&&p.borracha!=null&&p.borracha!=='')?`<br><span class="borracha-badge" title="Borracha restante">${p.borracha}% borracha</span>`:''}</td>
          <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalPneu('${p.id}')">${svg('edit')}</button></td></tr>`;
        }).join('')}</tbody></table></div></div></div>`;
  }).join('');
  return `
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('tire','i-blue',total,'Pneus no total','soma das quantidades')}
    ${kpi('truck','i-amber', comPneus.length, 'Veículos com pneus','')}
    ${kpi('gauge','i-green', DB.pneus.length, 'Registros de pneus','')}
  </div>
  <div class="toolbar"><div class="muted">O <b>Rodado</b> é calculado automaticamente (KM atual do veículo − KM da instalação) e acompanha a atualização feita na aba KM/Horas.</div>
    <div class="spacer"></div><button class="btn primary" onclick="modalPneu()">${svg('plus')} Novo pneu</button></div>
  <div class="grid" style="gap:18px">${blocos||emptyState('Nenhum pneu cadastrado. Clique em "Novo pneu".')}</div>`;
}
function modalPneu(id, vId){
  const p=id?DB.pneus.find(x=>x.id===id):{veiculoId:vId||(DB.veiculos[0]||{}).id,qtd:1,posicao:'',marca:'',medida:'',dot:'',dataInstalacao:'',kmInstalacao:'',status:'Novo',borracha:'',obs:''};
  openModal(`<div class="m-h">${svg('tire')}<h3>${id?'Editar pneu':'Novo pneu'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${p.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.marca)} ${esc(v.modelo)}</option>`).join('')}</select></div>
      <div class="field-row">${fld('Quantidade','f_qtd',p.qtd||1,'number','Ex.: 2 pneus iguais nessa posição')}${fld('Posição','f_pos',p.posicao,'text','Ex.: Dianteira, Traseira, Estepe')}</div>
      <div class="field-row">${fld('Marca','f_marca',p.marca)}${fld('Medida','f_medida',p.medida,'text','Ex.: 295/80 R22.5')}</div>
      <div class="field-row">
        <div class="field"><label>Status</label><select id="f_status" onchange="pneuToggleBorracha(this.value)">${PNEU_STATUS.map(o=>`<option ${o===p.status?'selected':''}>${esc(o)}</option>`).join('')}</select></div>
        ${fld('DOT (semana/ano)','f_dot',p.dot)}</div>
      <div class="field-row" id="f_borracha_wrap" style="${/usado|recap/i.test(p.status||'')?'':'display:none'}">
        ${fld('% de borracha restante','f_borracha',p.borracha,'number','Só para pneu usado/recapado. Ex.: 70')}
        <div class="field"><label>&nbsp;</label><div class="hint">Quanto de vida útil o pneu ainda tem.</div></div></div>
      <div class="field-row">${fld('Data instalação','f_data',p.dataInstalacao,'date')}${fld('KM na instalação','f_km',p.kmInstalacao,'number')}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(p.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirPneu('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarPneu('${id||''}')">Salvar</button></div>`);
}
function pneuToggleBorracha(v){ const w=document.getElementById('f_borracha_wrap'); if(w) w.style.display=/usado|recap/i.test(v||'')?'':'none'; }
function salvarPneu(id){
  let q=parseInt(val('f_qtd'))||1; if(q<1)q=1; if(q>50)q=50;
  const st=val('f_status');
  const d={veiculoId:val('f_veic'),qtd:q,posicao:val('f_pos'),marca:val('f_marca'),medida:val('f_medida'),dot:val('f_dot'),
    status:st,borracha:(/usado|recap/i.test(st)?numOrNull('f_borracha'):null),dataInstalacao:val('f_data'),kmInstalacao:numOrNull('f_km'),obs:val('f_obs')};
  if(id)Object.assign(DB.pneus.find(x=>x.id===id),d); else{ d.id=uid('pn'); DB.pneus.push(d); }
  saveDB(); closeModal(); toast('Pneu salvo.'); router(); }
function excluirPneu(id){ if(!confirm('Excluir este pneu?'))return; DB.pneus=DB.pneus.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ---------- CHECK-LIST ---------- */
function chkResumo(c){ let nok=0,tot=0; ['itensCavalo','itensCarreta'].forEach(k=>{ Object.values(c[k]||{}).forEach(v=>{ tot++; if(v==='NOK')nok++; }); }); const av=(c.pontos||[]).filter(p=>p.status==='avaria'||p.status==='atencao').length; return {nok,tot,av}; }
/* Resultado final do check-list: APROVADO (verde) ou REPROVADO (vermelho) */
function chkAprovado(c){ const r=chkResumo(c); return r.nok===0 && r.av===0; }
function chkResultadoBadge(c){ return chkAprovado(c)
  ? `<span class="st aprov">${svg('check')} APROVADO</span>`
  : `<span class="st reprov">REPROVADO</span>`; }

/* ---- Mapa do veículo (leve, SVG) — marcar pontos ---- */
let _chkPontos=[], _chkView='lateral';
function truckSide(){ return `<svg viewBox="0 0 440 160" class="truck-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="132" y="34" width="288" height="78" rx="7" fill="#eef2f8" stroke="#b9c6da" stroke-width="2"/>
  <line x1="132" y1="60" x2="420" y2="60" stroke="#d3ddea" stroke-width="1.5"/>
  <path d="M40 112 V64 Q40 52 52 52 H98 L130 86 V112 Z" fill="#dce6f4" stroke="#9fb2cd" stroke-width="2"/>
  <path d="M60 66 H96 L116 86 H60 Z" fill="#c2d3ea"/>
  <rect x="28" y="108" width="392" height="8" rx="3" fill="#334155"/>
  <g fill="#1f2937" stroke="#0f172a" stroke-width="2">
    <circle cx="74" cy="122" r="15"/><circle cx="168" cy="122" r="15"/><circle cx="204" cy="122" r="15"/>
    <circle cx="320" cy="122" r="15"/><circle cx="356" cy="122" r="15"/></g>
  <g fill="#64748b"><circle cx="74" cy="122" r="5"/><circle cx="168" cy="122" r="5"/><circle cx="204" cy="122" r="5"/><circle cx="320" cy="122" r="5"/><circle cx="356" cy="122" r="5"/></g>
  <text x="86" y="30" font-size="10" fill="#94a3b8">CAVALO</text><text x="250" y="30" font-size="10" fill="#94a3b8">CARRETA</text>
</svg>`; }
function truckTop(){ return `<svg viewBox="0 0 440 150" class="truck-svg" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="46" width="90" height="58" rx="8" fill="#dce6f4" stroke="#9fb2cd" stroke-width="2"/>
  <rect x="138" y="38" width="282" height="74" rx="8" fill="#eef2f8" stroke="#b9c6da" stroke-width="2"/>
  <g fill="#1f2937"><rect x="52" y="34" width="14" height="10" rx="2"/><rect x="104" y="34" width="14" height="10" rx="2"/>
    <rect x="52" y="106" width="14" height="10" rx="2"/><rect x="104" y="106" width="14" height="10" rx="2"/>
    <rect x="300" y="30" width="14" height="10" rx="2"/><rect x="340" y="30" width="14" height="10" rx="2"/>
    <rect x="300" y="110" width="14" height="10" rx="2"/><rect x="340" y="110" width="14" height="10" rx="2"/></g>
  <text x="66" y="78" font-size="10" fill="#94a3b8">CAVALO</text><text x="250" y="78" font-size="10" fill="#94a3b8">CARRETA (vista superior)</text>
</svg>`; }
function chkMapInit(pontos){ _chkPontos=Array.isArray(pontos)?clone(pontos):[]; _chkView='lateral'; }
function chkSwitchView(v){ _chkView=v; chkRenderMap(); }
function chkAddPonto(ev){ if(ev.target.closest('.tm-pin'))return; const box=ev.currentTarget.getBoundingClientRect();
  const x=(ev.clientX-box.left)/box.width*100, y=(ev.clientY-box.top)/box.height*100;
  if(x<0||x>100||y<0||y>100)return; _chkPontos.push({view:_chkView,x:+x.toFixed(1),y:+y.toFixed(1),status:'avaria',obs:''}); chkRenderMap(); }
function chkDelPonto(i){ _chkPontos.splice(i,1); chkRenderMap(); }
function chkSetStatus(i,s){ _chkPontos[i].status=s; chkRenderMap(); }
function chkSetObs(i,v){ if(_chkPontos[i]) _chkPontos[i].obs=v; }
const _STLBL={avaria:'Avaria',atencao:'Atenção',ok:'OK',obs:'Observação'};
function chkRenderMap(){ const el=document.getElementById('chkMapArea'); if(!el)return;
  const svgv=_chkView==='lateral'?truckSide():truckTop();
  const pins=_chkPontos.map((p,i)=> p.view===_chkView?`<div class="tm-pin ${p.status}" style="left:${p.x}%;top:${p.y}%" onclick="event.stopPropagation();chkDelPonto(${i})" title="Remover ponto ${i+1}">${i+1}</div>`:'').join('');
  const lista=_chkPontos.map((p,i)=>`<div class="tm-row"><span class="tm-num ${p.status}">${i+1}</span>
    <select onchange="chkSetStatus(${i},this.value)">${['avaria','atencao','ok','obs'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${_STLBL[s]}</option>`).join('')}</select>
    <input placeholder="Descrição do ponto ${i+1}" value="${esc(p.obs)}" oninput="chkSetObs(${i},this.value)">
    <span class="muted tm-view">${p.view==='lateral'?'lateral':'de cima'}</span>
    <button type="button" class="btn ghost sm" onclick="chkDelPonto(${i})">${svg('trash')}</button></div>`).join('');
  el.innerHTML=`<div class="tm-toolbar"><div class="seg">
      <button type="button" class="${_chkView==='lateral'?'active':''}" onclick="chkSwitchView('lateral')">Lateral</button>
      <button type="button" class="${_chkView==='cima'?'active':''}" onclick="chkSwitchView('cima')">De cima</button></div>
      <span class="muted" style="font-size:12px">Toque no desenho para marcar um ponto</span></div>
    <div class="truckmap" onclick="chkAddPonto(event)">${svgv}${pins}</div>
    <div class="tm-list">${lista||'<div class="muted" style="font-size:12.5px;padding:6px 0">Nenhum ponto marcado ainda.</div>'}</div>`;
}
function viewChecklist(){
  const cls=DB.checklists.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const mes=cls.filter(c=>{ const d=parseD(c.data); const h=hoje(); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).length;
  const comNok=cls.filter(c=>chkResumo(c).nok>0).length;
  const rows=cls.map(c=>{ const v=veiculo(c.veiculoId), m=motorista(c.motoristaId); const r=chkResumo(c);
    return `<tr class="clickable" onclick="modalChecklist('${c.id}')">
      <td class="mono">${fmtD(c.data)}</td><td>${v?plate(v.placa,v.tipo):'—'}</td>
      <td>${m?esc(m.nome):esc(c.motoristaNome||'—')}</td><td class="mono muted">${c.km?num(c.km)+' km':'—'}</td>
      <td>${chkResultadoBadge(c)}</td>
      <td class="no-print" style="text-align:right">
        <button class="btn ghost sm" title="Exportar" onclick="event.stopPropagation();exportarChecklist('${c.id}')">${svg('download')}</button>
        <button class="btn ghost sm" onclick="event.stopPropagation();modalChecklist('${c.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="banner">${svg('check')}<div><b>Check-list mensal de frota</b><span>Inspeção do cavalo e da carreta (OK / NOK). Pode ser preenchido no computador ou no celular. Feito no celular? Toque em exportar e envie o arquivo — no computador use "Importar" para atualizar automaticamente.</span></div>
    <label class="btn no-print" style="margin-left:auto">${svg('import')} Importar<input type="file" accept="application/json" onchange="importarChecklist(event)" style="display:none"></label></div>
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('check','i-blue',cls.length,'Check-lists realizados','')}
    ${kpi('cal','i-green',mes,'Neste mês','')}
    ${kpi('bell', comNok?'i-red':'i-green', comNok, 'Reprovados','')}
  </div>
  <div class="toolbar"><div class="spacer"></div><button class="btn primary" onclick="modalChecklist()">${svg('plus')} Novo check-list</button></div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>KM</th><th>Resultado</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="6">${emptyState('Nenhum check-list realizado. Clique em "Novo check-list".')}</td></tr>`}</tbody></table></div></div></div>`;
}
function chkItemRow(sec, item, valor){
  const v=valor||'OK';
  const opt=(o,cls)=>`<button type="button" class="chk-opt ${cls} ${v===o?'on':''}" onclick="chkSet(this,'${o}')">${o}</button>`;
  return `<div class="chk-row" data-sec="${sec}" data-item="${esc(item)}" data-val="${v}">
    <span class="chk-name">${esc(item)}</span>
    <span class="chk-opts">${opt('OK','ok')}${opt('NOK','nok')}${opt('N.A.','na')}</span></div>`;
}
function chkSet(btn, o){
  const row=btn.closest('.chk-row'); row.dataset.val=o;
  row.querySelectorAll('.chk-opt').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
}
function modalChecklist(id){
  const c=id?DB.checklists.find(x=>x.id===id):{veiculoId:(DB.veiculos.find(v=>v.tipo==='Cavalo')||{}).id,motoristaId:'',data:new Date().toISOString().slice(0,10),km:'',itensCavalo:{},itensCarreta:{},obs:''};
  const mod=DB.checklistModelo;
  const secCav=mod.cavalo.map(it=>chkItemRow('cav',it,(c.itensCavalo||{})[it])).join('');
  const secCar=mod.carreta.map(it=>chkItemRow('car',it,(c.itensCarreta||{})[it])).join('');
  openModal(`<div class="m-h">${svg('check')}<h3>${id?'Check-list':'Novo check-list'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">
        <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${c.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.tipo)}</option>`).join('')}</select></div>
        <div class="field"><label>Motorista</label><select id="f_mot"><option value="">—</option>${DB.motoristas.map(m=>`<option value="${m.id}" ${c.motoristaId===m.id?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">${fld('Data','f_data',c.data,'date')}${fld('KM atual','f_km',c.km,'number')}</div>
      <div class="chk-legend"><span class="st ok">OK</span> conforme &nbsp; <span class="st vencido">NOK</span> pendência &nbsp; <span class="st neutro">N.A.</span> não se aplica</div>
      <div class="sectitulo">${svg('truck')} Itens do Cavalo</div>
      <div class="chk-list">${secCav}</div>
      <div class="sectitulo" style="margin-top:18px">${svg('battery')} Itens da Carreta</div>
      <div class="chk-list">${secCar}</div>
      <div class="sectitulo" style="margin-top:18px">${svg('truck')} Mapa do veículo — marque os pontos</div>
      <div id="chkMapArea"></div>
      <div class="field" style="margin-top:16px"><label>Observações / Fotos</label><textarea id="f_obs">${esc(c.obs||'')}</textarea></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirChecklist('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarChecklist('${id||''}')">Salvar</button></div>`, true);
  chkMapInit(c.pontos); chkRenderMap();
}
function _lerChkSecao(sec){ const o={}; document.querySelectorAll(`.chk-row[data-sec="${sec}"]`).forEach(r=>{ o[r.dataset.item]=r.dataset.val; }); return o; }
function salvarChecklist(id){
  const veic=val('f_veic'); const m=motorista(val('f_mot'));
  const d={veiculoId:veic,motoristaId:val('f_mot'),motoristaNome:m?m.nome:'',data:val('f_data'),km:numOrNull('f_km'),
    itensCavalo:_lerChkSecao('cav'),itensCarreta:_lerChkSecao('car'),pontos:clone(_chkPontos),obs:val('f_obs')};
  if(id)Object.assign(DB.checklists.find(x=>x.id===id),d); else{ d.id=uid('ck'); DB.checklists.push(d); }
  saveDB(); closeModal(); toast('Check-list salvo.'); router();
}
function excluirChecklist(id){ if(!confirm('Excluir este check-list?'))return; DB.checklists=DB.checklists.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
function exportarChecklist(id){ const c=DB.checklists.find(x=>x.id===id); if(!c)return;
  const blob=new Blob([JSON.stringify({_tipo:'checklist_planeta',dados:c},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); const v=veiculo(c.veiculoId);
  a.download='checklist-'+((v||{}).placa||'')+'-'+(c.data||'')+'.json'; a.click(); toast('Check-list exportado.'); }
function importarChecklist(ev){ const f=ev.target.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const o=JSON.parse(r.result); const c=o&&o._tipo==='checklist_planeta'?o.dados:o; if(!c||!c.itensCavalo&&!c.itensCarreta) throw 0;
    c.id=c.id&&!DB.checklists.some(x=>x.id===c.id)?c.id:uid('ck'); DB.checklists.push(c); saveDB(); toast('Check-list importado.'); router(); }
    catch(e){ toast('Arquivo de check-list inválido.','err'); } };
  r.readAsText(f); ev.target.value=''; }

/* ================================================================== */
/*  NOVAS ÁREAS (v3.0): Início · Ética · Viagens · Descargas · Abast.  */
/* ================================================================== */

/* ---------- Abrir / baixar arquivos reais da pasta ---------- */
function _arquivoLocalIndisponivel(path){
  if(String(path).indexOf('../')===0 && location.protocol.indexOf('http')===0){
    toast('Este documento fica na pasta do computador e não abre pelo site online. Para vê-lo em qualquer lugar, reenvie-o pelo botão "Enviar arquivo".','err');
    return true;
  }
  return false;
}
function abrirReal(path){ if(_arquivoLocalIndisponivel(path)) return; const a=document.createElement('a'); a.href=path; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); }
function baixarReal(path,nome){ if(_arquivoLocalIndisponivel(path)) return; const a=document.createElement('a'); a.href=path; a.download=nome||''; document.body.appendChild(a); a.click(); a.remove(); }

/* ---------- PÁGINA INICIAL ---------- */
function viewInicio(){
  const cavalos=DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado').length;
  const reb=DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado').length;
  const mot=DB.motoristas.filter(m=>m.status==='Ativo').length;
  const h=hoje();
  const vgMes=DB.viagens.filter(v=>{ const d=parseD(v.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).length;
  const emViagem=DB.viagens.filter(v=>v.status==='Pendente').length;
  const nfOrd=DB.notas.slice().sort((a,b)=>(b.fim||'').localeCompare(a.fim||''));
  const fat=nfOrd[0]?totalNota(nfOrd[0]):0;
  const atalho=(ico,t,sub,hash)=>`<a class="ini-atalho" href="#${hash}">${svg(ico)}<div><b>${t}</b><span>${sub}</span></div><i>→</i></a>`;
  return `
  <div class="ini-hero">
    <div class="ini-hero-bg"></div>
    <div class="ini-logo"><img src="assets/logo.png" alt="Planeta Express"></div>
    <div class="ini-hero-txt">
      <h1>Planeta Express Transportes</h1>
      <p>CNPJ ${esc(DB.empresa.cnpj)}</p>
    </div>
  </div>

  <div class="grid kpis" style="margin-top:20px;grid-template-columns:repeat(2,1fr)">
    ${kpi('truck','i-blue', cavalos+reb, 'Veículos ativos', cavalos+' cavalos · '+reb+' reboques', '#frota')}
    ${kpi('user','i-green', mot, 'Motoristas ativos', DB.motoristas.length+' cadastrados', '#motoristas')}
  </div>

  <div class="grid two-col" style="margin-top:4px">
    <div class="card">
      <div class="card-h">${svg('home')}<h3>Acesso rápido</h3></div>
      <div class="card-b"><div class="ini-atalhos">
        ${atalho('dash','Painel de Controle','Indicadores e alertas','dashboard')}
        ${atalho('bell','Vencimentos','Documentos e validades','vencimentos')}
        ${atalho('route','Controle de Viagens','Registrar saída de motorista','viagens')}
        ${atalho('gauge','KM / Horas','Atualizar e ver trocas','km')}
        ${atalho('check','Check-list','Inspeção da frota','checklist')}
        ${atalho('doc','Documentos','Abrir e baixar arquivos','documentos')}
      </div></div>
    </div>
    <div class="card ini-etica">
      <div class="card-h">${svg('shield')}<h3>Código de Ética e Conduta</h3></div>
      <div class="card-b">
        <p class="muted" style="line-height:1.6">A Planeta Express sempre visou a ética e a responsabilidade. Nossos valores: competência, profissionalismo, união, rentabilidade e confiabilidade.</p>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn primary" href="#etica">${svg('eye')} Ler o código completo</a>
          <button class="btn" onclick="baixarReal('../Documentos Internos/Código de Ética e Contuta.docx','Codigo de Etica.docx')">${svg('download')} Baixar (Word)</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- QUADRO SOCIETÁRIO ---------- */
function docsDoMotorista(m){
  const reais=(DB.arquivos||[]).filter(f=>f.entidade==='motorista'&&f.refId===m.id).map(f=>({tipo:'real',nome:f.nome,cat:f.categoria,path:f.path}));
  const ups=todosArquivos().filter(f=>f.entidade==='motorista'&&f.refId===m.id).map(f=>({tipo:'up',nome:f.name,cat:f.categoria,id:f.id}));
  return reais.concat(ups);
}
function viewSocios(){
  const socios=DB.motoristas.filter(m=>m.socio);
  if(!socios.length) return `<div class="banner">${svg('briefcase')}<div><b>Quadro Societário</b><span>Marque um colaborador como sócio no cadastro (Motoristas → Editar → Sócio).</span></div></div>${emptyState('Nenhum sócio marcado ainda.')}`;
  const cards=socios.map(m=>{ const docs=docsDoMotorista(m);
    return `<div class="card socio-card">
      <div class="socio-head">${avatarFoto(m,92)}
        <div class="socio-info"><h3>${esc(m.nome)}</h3><div class="socio-role">${esc(m.funcao||'Sócio')}</div>
          <div class="chips" style="margin-top:8px">${m.cpf?`<span class="tag">CPF ${esc(m.cpf)}</span>`:''}${m.categoria?`<span class="tag">CNH ${esc(m.categoria)}</span>`:''}</div></div>
        <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm" onclick="uploadPara('motorista','${m.id}')">${svg('upload')} Anexar</button>
          <button class="btn sm" onclick="modalMotorista('${m.id}')">${svg('edit')} Editar</button></div>
      </div>
      <div class="info-grid" style="margin:4px 0 14px">
        <div class="it"><div class="l">Telefone</div><div class="v">${m.telefone?`<a class="pill-link" href="tel:${esc(m.telefone)}">${esc(m.telefone)}</a>`:'—'}</div></div>
        <div class="it"><div class="l">Nascimento</div><div class="v">${fmtD(m.nascimento)}</div></div>
        <div class="it"><div class="l">Endereço</div><div class="v">${esc(m.endereco||'—')}</div></div>
        <div class="it"><div class="l">Validade CNH</div><div class="v">${fmtD(m.cnhValidade)}</div></div>
      </div>
      <div class="sectitulo">${svg('doc')} Documentos do sócio</div>
      ${docs.length?`<div class="files">${docs.map(d=>`<div class="filecard">
        <div class="fc-ico">${fileThumb({name:d.nome})}</div>
        <div class="fc-main"><b title="${esc(d.nome)}">${esc(d.nome)}</b><div class="muted" style="font-size:11px">${esc(d.cat||'Documento')}</div></div>
        <div class="fc-act no-print">
          ${d.tipo==='real'?`<button class="btn ghost sm" title="Abrir" onclick="abrirReal('${esc(d.path)}')">${svg('eye')}</button><button class="btn ghost sm" title="Baixar" onclick="baixarReal('${esc(d.path)}','${esc(d.nome)}')">${svg('download')}</button>`
            :`<button class="btn ghost sm" title="Abrir" onclick="verArquivo('${d.id}')">${svg('eye')}</button><button class="btn ghost sm" title="Baixar" onclick="baixarArquivo('${d.id}')">${svg('download')}</button><button class="btn ghost sm" title="Excluir" onclick="excluirArquivo('${d.id}')">${svg('trash')}</button>`}
        </div></div>`).join('')}</div>`:emptyState('Nenhum documento. Use "Anexar" para enviar.')}
    </div>`;
  }).join('');
  return `<div class="banner">${svg('briefcase')}<div><b>Quadro Societário — Planeta Express Transportes</b><span>Sócios da empresa, com foto e documentos. Todos os dados são editáveis pelo cadastro.</span></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:18px">${cards}</div>`;
}

/* ---------- CÓDIGO DE ÉTICA ---------- */
const ETICA_DEVERES=["Ter respeito com todos.","Desempenhar as atribuições do cargo com eficácia e rendimento.","Apresentar-se ao trabalho asseado e com uniforme adequado.","Comparecer ao trabalho e às viagens apto, livre de álcool ou drogas.","Zelar pela preservação dos veículos e equipamentos da empresa.","Respeitar o limite de 80 km/h em dias normais e 60 km/h em dias de chuva.","PROIBIDO levar acompanhante nas viagens a serviço (descumprimento pode gerar desligamento sem aviso).","Em trechos de serra, não exceder 35 km/h.","Utilizar os EPIs exigidos por lei e indicados pela Segurança.","Trafegar sempre com faróis acesos, inclusive de dia.","Não admitir, em hipótese alguma, trabalho infantil, pedofilia ou exploração sexual de menores.","Manter toda a documentação de motorista e veículo sempre em dia.","Jornada máxima diária de 12 horas (8 normais + prorrogação por acordo).","Realizar paradas de 30 minutos a cada 5h30 de direção contínua.","Estar apto na gerenciadora de risco, com ASO e Direção Defensiva válidos (1 ano).","Possuir o kit de segurança (colete, 4 cones, 2 calços, 100 m de fita zebrada e lanterna).","Multas de trânsito serão cobradas e identificadas ao condutor.","Proibida qualquer modificação no veículo sem autorização do responsável.","Evitar comportamentos que possam configurar assédio ou atentar contra a moral.","Em viagem ou serviço, manter o telefone sempre disponível para contato."];
const ETICA_NAO=["Ameaçar ou ferir outras pessoas.","Portar armas nas instalações, nos veículos da empresa ou em situações relacionadas à firma.","Usar, carregar, vender ou transportar drogas ilegais, narcóticos ou bebidas alcoólicas no trabalho.","Utilizar o patrimônio da empresa para finalidade particular.","Ocultar informações importantes para o trabalho.","Transportar passageiro que não seja membro da empresa.","Excesso de velocidade.","Descumprir qualquer norma descrita neste documento."];
function viewEtica(){
  return `
  <div class="etica-doc">
    <div class="etica-head">
      <div class="etica-logo"><img src="assets/logo.png" alt=""></div>
      <div><h2>Código de Ética e Conduta</h2><p class="muted">Planeta Express Transportes</p></div>
      <div class="no-print" style="margin-left:auto;display:flex;gap:8px">
        <button class="btn" onclick="window.print()">${svg('print')} Imprimir</button>
        <button class="btn primary" onclick="baixarReal('../Documentos Internos/Código de Ética e Contuta.docx','Codigo de Etica.docx')">${svg('download')} Baixar Word</button>
      </div>
    </div>
    <div class="etica-body">
      <p>Um Código de Conduta é um conjunto de regras para orientar as pessoas dentro da empresa, estabelecendo padrões de comportamento esperados e facilitando o trabalho e a produtividade de todos.</p>
      <p>Somos uma empresa formada por pessoas diferentes entre si, mas que trabalham juntas por um mesmo objetivo: <b>unir relacionamentos com segurança e qualidade por meio do transporte</b>. Para isso, precisamos estar alinhados às normas, valores e princípios éticos que norteiam a nossa empresa.</p>
      <p>Sempre prevaleceram a competência, o profissionalismo, a união, a rentabilidade e a confiabilidade — estes são os nossos valores. A Planeta Express Transportes sempre visou a ética, regendo as ações que a transformaram em um investimento sólido e de orgulho para todos.</p>
      <div class="etica-sec">${svg('check')}<h3>Deveres do Motorista</h3></div>
      <ol class="etica-list">${ETICA_DEVERES.map(d=>`<li>${esc(d)}</li>`).join('')}</ol>
      <div class="etica-sec danger">${svg('trash')}<h3>Comportamentos não aceitáveis</h3></div>
      <ul class="etica-list nao">${ETICA_NAO.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
      <p style="margin-top:18px">O não cumprimento pode expor o funcionário e a empresa a ilicitudes (civil, criminal e trabalhista). Qualquer violação deste Código poderá resultar em medidas administrativas ou rescisão do contrato de trabalho, sem prejuízo das ações judiciais cabíveis.</p>
      <p>Cada um de nós deve agir de forma responsável, respeitando todas as partes envolvidas no nosso ciclo de trabalho. Cumprindo este Código, continuaremos a escrever a história de uma empresa sólida e responsável.</p>
      <p class="etica-assin">Planeta Express Transportes</p>
    </div>
  </div>`;
}

/* ---------- CONTROLE DE VIAGENS ---------- */
let viagemFiltro='todas', viagemMes='todos', viagemPlaca='todas';
function mesLabel(ym){ const p=ym.split('-'); return MESES_L[(+p[1])-1]+' '+p[0]; }
function viewViagens(){
  const h=hoje();
  const mesAtual=DB.viagens.filter(v=>{ const d=parseD(v.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).length;
  const emV=DB.viagens.filter(v=>v.status==='Pendente').length;
  const pendTermo=DB.viagens.filter(v=>v.termoBaixado!=='SIM').length;
  const pendBaixa=DB.viagens.filter(v=>v.baixado!=='SIM'&&v.baixado!=='TSP').length;
  const meses=[...new Set(DB.viagens.map(v=>(v.data||'').slice(0,7)).filter(Boolean))].sort().reverse();
  const placas=[...new Set(DB.viagens.map(v=>v.placa).filter(Boolean))].sort();
  const fb=(k,l)=>`<button class="${viagemFiltro===k?'active':''}" onclick="viagemFiltro='${k}';router()">${l}</button>`;
  let lista=DB.viagens.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  if(viagemFiltro==='emviagem') lista=lista.filter(v=>v.status==='Pendente');
  else if(viagemFiltro==='pendentes') lista=lista.filter(v=>v.baixado!=='SIM'&&v.baixado!=='TSP');
  if(viagemMes!=='todos') lista=lista.filter(v=>(v.data||'').slice(0,7)===viagemMes);
  if(viagemPlaca!=='todas') lista=lista.filter(v=>v.placa===viagemPlaca);
  // agrupa por mês
  const grupos={}; lista.forEach(v=>{ const k=(v.data||'').slice(0,7)||'—'; (grupos[k]=grupos[k]||[]).push(v); });
  const linhaViagem=(v)=>{ const ve=veiculoByPlaca(v.placa); const bxCls=(v.baixado==='SIM'||v.baixado==='TSP')?'ok':(v.baixado?'vencido':'neutro');
    return `<tr class="clickable" onclick="modalViagem('${v.id}')">
      <td class="mono">${fmtD(v.data)}</td><td>${ve?plate(ve.placa,ve.tipo):esc(v.placa)}</td>
      <td>${esc(v.motorista||'—')}</td><td class="mono">${esc(v.transporte||'—')}</td><td>${esc(v.destino||'—')}</td>
      <td><span class="st ${bxCls}">${esc(v.baixado||'Pendente')}</span></td>
      <td class="mono">${esc(v.termoPallet||'—')}</td>
      <td><span class="st ${v.termoBaixado==='SIM'?'ok':'warn'}">${v.termoBaixado==='SIM'?'Baixado':'Pendente'}</span></td>
      <td><span class="tag ${v.status==='Pendente'?'rebo':(v.status==='Concluída'?'cavalo':'')}">${esc(v.status||'—')}</span></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalViagem('${v.id}')">${svg('edit')}</button></td></tr>`; };
  const corpo=Object.keys(grupos).sort().reverse().map(k=>{ const gs=grupos[k];
    return `<tr class="grouprow"><td colspan="10">${svg('cal')} ${k==='—'?'Sem data':mesLabel(k)} <span class="muted">· ${gs.length} viagem(ns)</span></td></tr>`+
      gs.map(linhaViagem).join('');
  }).join('');
  return `
  <div class="banner">${svg('route')}<div><b>Controle de Viagens BRF</b><span>Registre a saída do motorista com o número de transporte e o termo pallet. Filtre por mês e por placa.</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalViagem()">${svg('plus')} Nova viagem</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
    ${kpi('route','i-blue', mesAtual, 'Viagens no mês','')}
    ${kpi('truck', emV?'i-orange':'i-green', emV, 'Pendentes','')}
    ${kpi('doc', pendBaixa?'i-red':'i-green', pendBaixa, 'Transportes a baixar','')}
    ${kpi('box', pendTermo?'i-amber':'i-green', pendTermo, 'Termos pallet pendentes','')}
  </div>
  <div class="toolbar"><div class="seg">${fb('todas','Todas')}${fb('emviagem','Pendentes')}${fb('pendentes','A baixar')}</div>
    <select class="selectlite" onchange="viagemMes=this.value;router()"><option value="todos">Todos os meses</option>
      ${meses.map(m=>`<option value="${m}" ${viagemMes===m?'selected':''}>${mesLabel(m)}</option>`).join('')}</select>
    <select class="selectlite" onchange="viagemPlaca=this.value;router()"><option value="todas">Todas as placas</option>
      ${placas.map(p=>`<option value="${esc(p)}" ${viagemPlaca===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <div class="spacer"></div><button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button></div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Placa</th><th>Motorista</th><th>Transporte</th><th>Destino</th><th>Baixado</th><th>Termo Pallet</th><th>Termo</th><th>Status</th><th class="no-print"></th></tr></thead>
    <tbody>${corpo||`<tr><td colspan="10">${emptyState('Nenhuma viagem neste filtro.')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalViagem(id){
  const v=id?DB.viagens.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),placa:(DB.veiculos.find(x=>x.tipo==='Cavalo')||{}).placa||'',motorista:'',transporte:'',destino:'',baixado:'',termoPallet:'',termoBaixado:'',status:'Pendente',obs:''};
  openModal(`<div class="m-h">${svg('route')}<h3>${id?'Editar viagem':'Nova viagem'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',v.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${DB.veiculos.filter(x=>x.status!=='Arquivado').map(x=>`<option ${v.placa===x.placa?'selected':''}>${esc(x.placa)}</option>`).join('')}</select></div></div>
      <div class="field-row">${fld('Motorista','f_mot',v.motorista)}${fld('Nº Transporte','f_transp',v.transporte)}</div>
      ${fld('Destino','f_dest',v.destino)}
      <div class="field-row">${sel('Transporte baixado','f_baix',v.baixado||'',['','SIM','TSP','NÃO'])}${sel('Status','f_status',v.status,['Pendente','Concluída','Cancelada'])}</div>
      <div class="field-row">${fld('Termo Pallet (nº)','f_termo',v.termoPallet)}${sel('Termo baixado','f_termob',v.termoBaixado||'',['','SIM','NÃO'])}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(v.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirViagem('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarViagem('${id||''}')">Salvar</button></div>`);
}
function salvarViagem(id){ const d={data:val('f_data'),placa:val('f_placa'),motorista:val('f_mot'),transporte:val('f_transp'),destino:val('f_dest'),baixado:val('f_baix'),termoPallet:val('f_termo'),termoBaixado:val('f_termob'),status:val('f_status'),obs:val('f_obs')};
  if(id)Object.assign(DB.viagens.find(x=>x.id===id),d); else{ d.id=uid('vg'); DB.viagens.push(d); } saveDB(); closeModal(); toast('Viagem salva.'); router(); }
function excluirViagem(id){ if(!confirm('Excluir esta viagem?'))return; DB.viagens=DB.viagens.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluída.'); router(); }

/* ---------- DESCARGAS ---------- */
function viewDescargas(){
  const h=hoje(); const total=DB.descargas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const mes=DB.descargas.filter(d=>{ const dt=parseD(d.data); return dt&&dt.getMonth()===h.getMonth()&&dt.getFullYear()===h.getFullYear(); });
  const totalMes=mes.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const rows=DB.descargas.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(d=>{ const v=veiculoByPlaca(d.placa);
    return `<tr class="clickable" onclick="modalDescarga('${d.id}')"><td class="mono">${fmtD(d.data)}</td><td>${v?plate(v.placa,v.tipo):esc(d.placa)}</td>
      <td class="mono">${esc(d.transporte||'—')}</td><td class="mono muted">${esc(d.senha||'—')}</td><td class="mono"><b>${money(d.valor)}</b></td>
      <td>${esc(d.local||'—')}</td><td class="muted">${esc(d.pago||'—')}</td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalDescarga('${d.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('box','i-blue',DB.descargas.length,'Descargas registradas','')}
    ${kpi('money','i-green',money(totalMes),'Valor no mês',mes.length+' descarga(s)')}
    ${kpi('export','i-amber',money(total),'Valor acumulado','')}
  </div>
  <div class="toolbar"><div class="muted">Senhas e valores de descarga (pagos via Bradesco).</div><div class="spacer"></div>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button>
    <button class="btn primary" onclick="modalDescarga()">${svg('plus')} Nova descarga</button></div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Placa</th><th>Transporte</th><th>Senha</th><th>Valor</th><th>Local</th><th>Pago</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="8">${emptyState('Nenhuma descarga.')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalDescarga(id){
  const d=id?DB.descargas.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),placa:(DB.veiculos[0]||{}).placa||'',transporte:'',senha:'',valor:'',pago:'Bradesco',local:''};
  openModal(`<div class="m-h">${svg('box')}<h3>${id?'Editar descarga':'Nova descarga'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',d.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${DB.veiculos.map(x=>`<option ${d.placa===x.placa?'selected':''}>${esc(x.placa)}</option>`).join('')}</select></div></div>
      <div class="field-row">${fld('Nº Transporte','f_transp',d.transporte)}${fld('Senha','f_senha',d.senha)}</div>
      <div class="field-row">${fldR$('Valor (R$)','f_valor',d.valor)}${fld('Pago por','f_pago',d.pago)}</div>
      ${fld('Local','f_local',d.local)}
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirDescarga('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarDescarga('${id||''}')">Salvar</button></div>`);
}
function salvarDescarga(id){ const d={data:val('f_data'),placa:val('f_placa'),transporte:val('f_transp'),senha:val('f_senha'),valor:parseBRL(val('f_valor')),pago:val('f_pago'),local:val('f_local')};
  if(id)Object.assign(DB.descargas.find(x=>x.id===id),d); else{ d.id=uid('dc'); DB.descargas.push(d); } saveDB(); closeModal(); toast('Descarga salva.'); router(); }
function excluirDescarga(id){ if(!confirm('Excluir esta descarga?'))return; DB.descargas=DB.descargas.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluída.'); router(); }

/* ---------- ABASTECIMENTOS + MÉDIAS ---------- */
function mediaVeiculo(v){
  const carreta=isReb(v); const key=carreta?'horas':'km';
  const arr=DB.abastecimentos.filter(a=>a.veiculoId===v.id && a[key]!=null && a[key]!=='' && a.litros).sort((a,b)=>a[key]-b[key]);
  if(arr.length<2) return null;
  const dist=arr[arr.length-1][key]-arr[0][key]; let litros=0; for(let i=1;i<arr.length;i++) litros+=Number(arr[i].litros)||0;
  if(dist<=0||litros<=0) return null;
  return carreta? {tipo:'L/h', valor:litros/dist, un:'h'} : {tipo:'km/L', valor:dist/litros, un:'km'};
}
function viewAbastecimento(){
  const totL=DB.abastecimentos.reduce((s,a)=>s+(Number(a.litros)||0),0);
  const totR=DB.abastecimentos.reduce((s,a)=>s+(Number(a.valor)||0),0);
  const veics=DB.veiculos.filter(v=>v.status!=='Arquivado');
  const medias=veics.map(v=>({v,m:mediaVeiculo(v)})).filter(x=>x.m);
  const rows=DB.abastecimentos.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(a=>{ const v=veiculo(a.veiculoId);
    return `<tr class="clickable" onclick="modalAbastec('${a.id}')"><td class="mono">${fmtD(a.data)}</td><td>${v?plate(v.placa,v.tipo):'—'}</td>
      <td class="mono">${num(a.litros)} L</td><td class="mono">${money(a.valor)}</td>
      <td class="mono muted">${a.km!=null&&a.km!==''?num(a.km)+' km':(a.horas!=null&&a.horas!==''?num(a.horas)+' h':'—')}</td>
      <td>${esc(a.posto||'—')}</td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalAbastec('${a.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="banner">${svg('fuel')}<div><b>Abastecimentos e médias</b><span>Lance cada abastecimento com litros e o KM (cavalos) ou as horas do Thermo King (carretas). O sistema calcula a média de consumo automaticamente.</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalAbastec()">${svg('plus')} Novo abastecimento</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('fuel','i-blue', num(totL)+' L', 'Litros lançados','')}
    ${kpi('money','i-amber', money(totR), 'Valor total','')}
    ${kpi('gauge','i-green', medias.length, 'Veículos com média','')}
  </div>
  ${medias.length?`<div class="sectitulo">${svg('gauge')} Médias de consumo</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:20px">
    ${medias.map(x=>`<div class="card"><div class="card-b" style="text-align:center">
      ${plate(x.v.placa,x.v.tipo)}<div style="font-size:30px;font-weight:800;margin-top:10px">${x.m.valor.toFixed(2)}</div>
      <div class="muted" style="font-size:12.5px">${x.m.tipo}</div></div></div>`).join('')}
  </div>`:''}
  <div class="card"><div class="card-h">${svg('fuel')}<h3>Lançamentos</h3></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Veículo</th><th>Litros</th><th>Valor</th><th>KM / Horas</th><th>Posto</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="7">${emptyState('Nenhum abastecimento. Lance ao menos 2 por veículo para calcular a média.')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalAbastec(id){
  const a=id?DB.abastecimentos.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),veiculoId:(DB.veiculos[0]||{}).id,litros:'',valor:'',km:'',horas:'',posto:'',obs:''};
  openModal(`<div class="m-h">${svg('fuel')}<h3>${id?'Editar abastecimento':'Novo abastecimento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',a.data,'date')}
        <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${a.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.tipo)}</option>`).join('')}</select></div></div>
      <div class="field-row">${fld('Litros','f_lit',a.litros,'number')}${fldR$('Valor (R$)','f_val',a.valor)}</div>
      <div class="field-row">${fld('KM (cavalo)','f_km',a.km,'number')}${fld('Horas (carreta)','f_h',a.horas,'number')}</div>
      <div class="field"><label>Posto</label><input id="f_posto" value="${esc(a.posto)}"></div>
      <div class="hint">Cavalos: preencha o KM. Carretas: preencha as horas do Thermo King.</div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirAbastec('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarAbastec('${id||''}')">Salvar</button></div>`);
}
function salvarAbastec(id){ if(!val('f_lit')){toast('Informe os litros.','err');return;}
  const d={data:val('f_data'),veiculoId:val('f_veic'),litros:parseFloat(val('f_lit'))||0,valor:parseBRL(val('f_val')),km:numOrNull('f_km'),horas:numOrNull('f_h'),posto:val('f_posto')};
  if(id)Object.assign(DB.abastecimentos.find(x=>x.id===id),d); else{ d.id=uid('ab'); DB.abastecimentos.push(d); } saveDB(); closeModal(); toast('Abastecimento salvo.'); router(); }
function excluirAbastec(id){ if(!confirm('Excluir este abastecimento?'))return; DB.abastecimentos=DB.abastecimentos.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ---------- ALARME: detalhe (causa e solução) ---------- */
function modalAlarme(code){
  const a=(typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]).find(x=>x.c===code); if(!a) return;
  openModal(`<div class="m-h">${svg('alarm')}<h3>Alarme ${esc(a.c)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="alarme-det-code">${esc(a.c)}</div>
      <div class="alarme-det-title">${esc(a.d)}</div>
      <div class="alarme-block"><div class="alarme-block-h">${svg('eye')} O que significa</div><p>${esc(a.ex||'')}</p></div>
      <div class="alarme-block sol"><div class="alarme-block-h">${svg('wrench')} O que fazer</div><p>${esc(a.so||'')}</p></div>
      <div class="hint" style="margin-top:14px">⚠️ Orientação geral. Para o diagnóstico correto, consulte o manual e o técnico Thermo King.</div>
    </div>
    <div class="m-f"><button class="btn primary" onclick="closeModal()">Entendi</button></div>`);
}

/* ================================================================== */
/*  FINANCEIRO (protegido por senha)                                  */
/* ================================================================== */
let finUnlocked=false;
function viewFinanceiro(){
  if(!DB.config.finPin) return viewFinSetPin();
  if(!finUnlocked) return viewFinLock();
  return viewFinConteudo();
}
function viewFinSetPin(){
  return `<div class="fin-gate"><div class="fin-card">
    <div class="fin-lock">${svg('lock')}</div>
    <h2>Proteger o Financeiro</h2>
    <p class="muted">Defina uma senha de acesso. Só você terá acesso a esta área — guarde bem, pois sem ela os dados financeiros não abrem.</p>
    <div class="field"><label>Nova senha</label><input type="password" id="fp1" autocomplete="new-password"></div>
    <div class="field"><label>Repita a senha</label><input type="password" id="fp2" autocomplete="new-password"></div>
    <button class="btn primary" style="width:100%" onclick="finSetPin()">${svg('lock')} Definir senha e entrar</button>
  </div></div>`;
}
function finSetPin(){ const a=val('fp1'), b=val('fp2');
  if(a.length<4){ toast('Use ao menos 4 caracteres.','err'); return; }
  if(a!==b){ toast('As senhas não conferem.','err'); return; }
  DB.config.finPin=a; saveDB(); finUnlocked=true; toast('Senha definida.'); router();
}
function viewFinLock(){
  return `<div class="fin-gate"><div class="fin-card">
    <div class="fin-lock">${svg('lock')}</div>
    <h2>Área Financeira</h2>
    <p class="muted">Digite a senha para acessar.</p>
    <div class="field"><input type="password" id="fpin" placeholder="Senha" autocomplete="off" onkeydown="if(event.key==='Enter')finUnlock()"></div>
    <button class="btn primary" style="width:100%" onclick="finUnlock()">${svg('lock')} Entrar</button>
  </div></div>`;
}
function finUnlock(){ if(val('fpin')===DB.config.finPin){ finUnlocked=true; router(); } else toast('Senha incorreta.','err'); }
function modalFinPin(){
  openModal(`<div class="m-h">${svg('lock')}<h3>Alterar senha do Financeiro</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Senha atual</label><input type="password" id="fpa"></div>
      <div class="field"><label>Nova senha</label><input type="password" id="fpn1"></div>
      <div class="field"><label>Repita a nova senha</label><input type="password" id="fpn2"></div>
    </div>
    <div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="finTrocarPin()">Salvar</button></div>`);
}
function finTrocarPin(){ if(val('fpa')!==DB.config.finPin){ toast('Senha atual incorreta.','err'); return; }
  const n=val('fpn1'); if(n.length<4){ toast('Use ao menos 4 caracteres.','err'); return; }
  if(n!==val('fpn2')){ toast('As senhas não conferem.','err'); return; }
  DB.config.finPin=n; saveDB(); closeModal(); toast('Senha alterada.'); }

function valeSaldo(mId){ let s=0; DB.vales.filter(v=>v.motoristaId===mId).forEach(v=>{ s+= v.tipo==='Pagamento'? -(Number(v.valor)||0) : (Number(v.valor)||0); }); return s; }
function viewFinConteudo(){
  const h=hoje();
  const fatMes=DB.faturamento.filter(f=>{ const d=parseD(f.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).reduce((s,f)=>s+(Number(f.valor)||0),0);
  const fatTot=DB.faturamento.reduce((s,f)=>s+(Number(f.valor)||0),0);
  const valesAberto=DB.motoristas.reduce((s,m)=>s+Math.max(0,valeSaldo(m.id)),0);

  const fatRows=DB.faturamento.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(f=>`<tr class="clickable" onclick="modalFaturamento('${f.id}')">
    <td class="mono">${fmtD(f.data)}</td><td>${esc(f.cliente||'—')}</td><td class="mono"><b>${money(f.valor)}</b></td>
    <td class="muted">${esc(f.obs||'')}</td><td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalFaturamento('${f.id}')">${svg('edit')}</button></td></tr>`).join('');
  const valeRows=DB.vales.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(v=>{ const m=motorista(v.motoristaId);
    return `<tr class="clickable" onclick="modalVale('${v.id}')"><td class="mono">${fmtD(v.data)}</td><td>${m?esc(m.nome):'—'}</td>
    <td><span class="st ${v.tipo==='Pagamento'?'ok':'warn'}">${esc(v.tipo)}</span></td>
    <td class="mono"><b>${money(v.valor)}</b></td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalVale('${v.id}')">${svg('edit')}</button></td></tr>`; }).join('');
  const saldoCards=DB.motoristas.filter(m=>valeSaldo(m.id)!==0).map(m=>{ const s=valeSaldo(m.id);
    return `<div class="card"><div class="card-b" style="display:flex;align-items:center;gap:12px">
      ${avatarFoto(m,42)}<div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(m.nome.split(' ')[0])} ${esc((m.nome.split(' ')[1]||''))}</b>
      <div class="muted" style="font-size:11.5px">saldo de vales</div></div>
      <div class="mono" style="font-weight:800;font-size:16px;color:${s>0?'var(--warn)':'var(--ok)'}">${money(s)}</div></div></div>`; }).join('');

  return `
  <div class="banner">${svg('lock')}<div><b>Financeiro — acesso restrito</b><span>Faturamento e vales dos motoristas. Os vales são somados automaticamente por motorista.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px">
      <button class="btn" onclick="modalFinPin()">${svg('lock')} Alterar senha</button>
      <button class="btn" onclick="finUnlocked=false;router()">Bloquear</button></div></div>

  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
    ${kpi('money','i-green', money(fatMes), 'Faturamento no mês','')}
    ${kpi('export','i-blue', money(fatTot), 'Faturamento acumulado', DB.faturamento.length+' lançamento(s)')}
    ${kpi('wallet','i-amber', money(valesAberto), 'Vales em aberto', 'Saldo devedor dos motoristas')}
  </div>

  <div class="grid two-col">
    <div class="card"><div class="card-h">${svg('money')}<h3>Faturamento</h3>
      <div class="r no-print"><button class="btn primary sm" onclick="modalFaturamento()">${svg('plus')} Novo</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Obs</th><th class="no-print"></th></tr></thead>
        <tbody>${fatRows||`<tr><td colspan="5">${emptyState('Nenhum faturamento lançado.')}</td></tr>`}</tbody></table></div></div></div>
    <div class="card"><div class="card-h">${svg('wallet')}<h3>Vales e Pagamentos</h3>
      <div class="r no-print"><button class="btn primary sm" onclick="modalVale()">${svg('plus')} Novo</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Motorista</th><th>Tipo</th><th>Valor</th><th class="no-print"></th></tr></thead>
        <tbody>${valeRows||`<tr><td colspan="5">${emptyState('Nenhum vale ou pagamento.')}</td></tr>`}</tbody></table></div></div></div>
  </div>

  ${saldoCards?`<div class="sectitulo" style="margin-top:20px">${svg('wallet')} Saldo de vales por motorista</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${saldoCards}</div>`:''}`;
}
function modalFaturamento(id){
  const f=id?DB.faturamento.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),cliente:'',valor:'',obs:''};
  openModal(`<div class="m-h">${svg('money')}<h3>${id?'Editar faturamento':'Novo faturamento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',f.data,'date')}${fldR$('Valor (R$)','f_val',f.valor)}</div>
      ${fld('Cliente / origem','f_cli',f.cliente)}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(f.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirFaturamento('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarFaturamento('${id||''}')">Salvar</button></div>`);
}
function salvarFaturamento(id){ const d={data:val('f_data'),cliente:val('f_cli'),valor:parseBRL(val('f_val')),obs:val('f_obs')};
  if(id)Object.assign(DB.faturamento.find(x=>x.id===id),d); else{ d.id=uid('ft'); DB.faturamento.push(d); } saveDB(); closeModal(); toast('Faturamento salvo.'); router(); }
function excluirFaturamento(id){ if(!confirm('Excluir este faturamento?'))return; DB.faturamento=DB.faturamento.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
function modalVale(id){
  const v=id?DB.vales.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),motoristaId:(DB.motoristas[0]||{}).id,tipo:'Vale',valor:'',obs:''};
  openModal(`<div class="m-h">${svg('wallet')}<h3>${id?'Editar lançamento':'Novo vale / pagamento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Motorista</label><select id="f_mot">${DB.motoristas.map(m=>`<option value="${m.id}" ${v.motoristaId===m.id?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></div>
      <div class="field-row">${sel('Tipo','f_tipo',v.tipo,['Vale','Pagamento'])}${fldR$('Valor (R$)','f_val',v.valor)}</div>
      ${fld('Data','f_data',v.data,'date')}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(v.obs)}"></div>
      <div class="hint">"Vale" = adiantamento ao motorista. "Pagamento" = quitação/desconto. O saldo por motorista é somado automaticamente.</div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirVale('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarVale('${id||''}')">Salvar</button></div>`);
}
function salvarVale(id){ const d={data:val('f_data'),motoristaId:val('f_mot'),tipo:val('f_tipo'),valor:parseBRL(val('f_val')),obs:val('f_obs')};
  if(id)Object.assign(DB.vales.find(x=>x.id===id),d); else{ d.id=uid('vl'); DB.vales.push(d); } saveDB(); closeModal(); toast('Lançamento salvo.'); router(); }
function excluirVale(id){ if(!confirm('Excluir este lançamento?'))return; DB.vales=DB.vales.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

/* ================================================================== */
/*  CT-e (Conhecimento de Transporte Eletrônico)                      */
/* ================================================================== */
const CTE_STATUS=['Emitido','Lançado','Trocado','Cancelado','Pago'];
let cteFiltro='todos', cteMes='todos';
function cteStCls(s){ return {Emitido:'warn',Lançado:'ok',Trocado:'crit',Cancelado:'vencido',Pago:'ok'}[s]||'neutro'; }
function viewCtes(){
  const h=hoje();
  const total=DB.ctes.length;
  const valorTot=DB.ctes.filter(c=>c.status!=='Cancelado').reduce((s,c)=>s+(Number(c.valor)||0),0);
  const aReceber=DB.ctes.filter(c=>c.status!=='Pago'&&c.status!=='Cancelado').reduce((s,c)=>s+(Number(c.valor)||0),0);
  const meses=[...new Set(DB.ctes.map(c=>(c.data||'').slice(0,7)).filter(Boolean))].sort().reverse();
  const cont={}; CTE_STATUS.forEach(s=>cont[s]=DB.ctes.filter(c=>c.status===s).length);
  const fb=(k,l,n)=>`<button class="${cteFiltro===k?'active':''}" onclick="cteFiltro='${k}';router()">${l}${n!=null?` <b style="opacity:.55">${n}</b>`:''}</button>`;
  let lista=DB.ctes.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  if(cteFiltro!=='todos') lista=lista.filter(c=>c.status===cteFiltro);
  if(cteMes!=='todos') lista=lista.filter(c=>(c.data||'').slice(0,7)===cteMes);
  const rows=lista.map(c=>{ const v=veiculoByPlaca(c.placa);
    return `<tr class="clickable" onclick="modalCte('${c.id}')">
      <td class="mono">${fmtD(c.data)}</td><td class="mono"><b>${esc(c.numero||'—')}</b></td>
      <td>${v?plate(v.placa,v.tipo):esc(c.placa||'—')}</td><td>${esc(c.cliente||'—')}</td>
      <td class="mono">${money(c.valor)}</td>
      <td><span class="st ${cteStCls(c.status)}">${esc(c.status||'—')}</span></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalCte('${c.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="banner">${svg('ctedoc')}<div><b>CT-e — Conhecimentos de Transporte</b><span>Controle dos CT-e emitidos, lançados, trocados e pagos. Filtre por situação e por mês.</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalCte()">${svg('plus')} Novo CT-e</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
    ${kpi('ctedoc','i-blue', total, 'CT-e registrados','')}
    ${kpi('money','i-green', money(valorTot), 'Valor total (válidos)','')}
    ${kpi('wallet','i-amber', money(aReceber), 'A receber','Não pagos')}
    ${kpi('bell', cont.Trocado?'i-orange':'i-blue', cont.Trocado, 'Trocados','')}
  </div>
  <div class="toolbar"><div class="seg">${fb('todos','Todos')}${fb('Emitido','Emitidos',cont.Emitido)}${fb('Lançado','Lançados',cont.Lançado)}${fb('Trocado','Trocados',cont.Trocado)}${fb('Pago','Pagos',cont.Pago)}${fb('Cancelado','Cancelados',cont.Cancelado)}</div>
    <select class="selectlite" onchange="cteMes=this.value;router()"><option value="todos">Todos os meses</option>
      ${meses.map(m=>`<option value="${m}" ${cteMes===m?'selected':''}>${mesLabel(m)}</option>`).join('')}</select>
    <div class="spacer"></div><button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button></div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Nº CT-e</th><th>Placa</th><th>Cliente</th><th>Valor</th><th>Situação</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="7">${emptyState('Nenhum CT-e neste filtro. Clique em "Novo CT-e".')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalCte(id){
  const c=id?DB.ctes.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),numero:'',placa:(DB.veiculos.find(v=>v.tipo==='Cavalo')||{}).placa||'',cliente:'',valor:'',status:'Emitido',obs:''};
  openModal(`<div class="m-h">${svg('ctedoc')}<h3>${id?'Editar CT-e':'Novo CT-e'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data de emissão','f_data',c.data,'date')}${fld('Número do CT-e','f_num',c.numero)}</div>
      <div class="field-row">
        <div class="field"><label>Placa</label><select id="f_placa"><option value="">—</option>${DB.veiculos.map(v=>`<option ${c.placa===v.placa?'selected':''}>${esc(v.placa)}</option>`).join('')}</select></div>
        ${sel('Situação','f_status',c.status,CTE_STATUS)}</div>
      <div class="field-row">${fld('Cliente / Tomador','f_cli',c.cliente)}${fldR$('Valor (R$)','f_val',c.valor)}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(c.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirCte('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarCte('${id||''}')">Salvar</button></div>`);
}
function salvarCte(id){ const d={data:val('f_data'),numero:val('f_num'),placa:val('f_placa'),cliente:val('f_cli'),valor:parseBRL(val('f_val')),status:val('f_status'),obs:val('f_obs')};
  if(id)Object.assign(DB.ctes.find(x=>x.id===id),d); else{ d.id=uid('ct'); DB.ctes.push(d); } saveDB(); closeModal(); toast('CT-e salvo.'); router(); }
function excluirCte(id){ if(!confirm('Excluir este CT-e?'))return; DB.ctes=DB.ctes.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }

function tick(){ const d=new Date(); const el=document.getElementById('clock'); if(el) el.innerHTML=`<b>${DIAS[d.getDay()]}</b>, ${String(d.getDate()).padStart(2,'0')} de ${MESES_L[d.getMonth()]} de ${d.getFullYear()}`; }
function toggleSidebar(){ document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('scrim').classList.toggle('show'); }
function closeSidebar(){ document.querySelector('.sidebar')?.classList.remove('open'); document.getElementById('scrim')?.classList.remove('show'); }
function hideSplash(){ const s=document.getElementById('splash'); if(!s)return; s.classList.add('gone'); setTimeout(()=>s.remove(),700); }

/* ================================================================== */
/*  22. INICIALIZAÇÃO                                                  */
/* ================================================================== */
/* ---------- Usuário logado ---------- */
const NOMES_USUARIO={ 'uilian':'Uilian', 'marcelo':'Marcelo', 'planetaexpresstransportes':'Planeta Express' };
function nomeUsuario(){
  if(typeof nuvemUser!=='function') return '';
  const u=nuvemUser(); if(!u) return '';
  if(u.user_metadata && u.user_metadata.nome) return u.user_metadata.nome;
  const local=((u.email||'').split('@')[0]||'').toLowerCase();
  if(NOMES_USUARIO[local]) return NOMES_USUARIO[local];
  return local? local.charAt(0).toUpperCase()+local.slice(1) : '';
}
function updateUserBadge(){
  const el=document.getElementById('userbadge'); if(!el) return;
  const online=(typeof nuvemAtiva==='function'&&nuvemAtiva()&&nuvemUser&&nuvemUser());
  if(online){ el.innerHTML=`${svg('user')}<span>Olá, <b>${esc(nomeUsuario())}</b></span>`; el.style.display='flex'; }
  else { el.innerHTML=''; el.style.display='none'; }
}

/* ---------- Tela de login (modo online) ---------- */
function mostrarLogin(msg){
  const el=document.getElementById('loginScreen'); if(!el) return;
  el.style.display='flex';
  el.innerHTML=`<div class="login-box">
    <div class="login-logo"><img src="assets/logo.png" alt="Planeta Express"></div>
    <h2>PLANETA EXPRESS</h2><p class="login-sub">Sistema de Gestão · acesso</p>
    <div class="field"><label>E-mail</label><input type="email" id="lg_email" autocomplete="username" placeholder="seu@email.com"></div>
    <div class="field"><label>Senha</label><input type="password" id="lg_senha" autocomplete="current-password" onkeydown="if(event.key==='Enter')fazerLogin()"></div>
    <button class="btn primary" style="width:100%" id="lg_btn" onclick="fazerLogin()">${svg('lock')} Entrar</button>
    ${msg?`<div class="login-msg">${esc(msg)}</div>`:''}
    <div class="login-foot">Acesso exclusivo da Planeta Express Transportes</div>
  </div>`;
  const em=document.getElementById('lg_email'); if(em) em.focus();
}
function esconderLogin(){ const el=document.getElementById('loginScreen'); if(el){ el.style.display='none'; el.innerHTML=''; } }
async function fazerLogin(){
  const email=(document.getElementById('lg_email')||{}).value||'';
  const senha=(document.getElementById('lg_senha')||{}).value||'';
  if(!email||!senha){ mostrarLogin('Preencha e-mail e senha.'); return; }
  const btn=document.getElementById('lg_btn'); if(btn){ btn.disabled=true; btn.textContent='Entrando…'; }
  try{ await nuvemLogin(email.trim(), senha); await aposLogin(); }
  catch(e){ mostrarLogin('E-mail ou senha incorretos.'); }
}
async function aposLogin(){
  try{
    const remoto=await nuvemCarregar();
    if(remoto){ DB=remoto; ensureCollections(); saveDB(); }
    else { await nuvemSalvar(DB); }            // primeira vez: envia a base atual p/ a nuvem
    nuvemRealtime(aplicarRemoto);
  }catch(e){ toast('Conectado, mas houve um aviso ao sincronizar.','err'); }
  esconderLogin();
  renderSidebar('inicio'); router(); hideSplash(); updateUserBadge();
  if(typeof iaAtualizarAcesso==='function') iaAtualizarAcesso();   /* libera a IA só depois do login */
  toast('Bem-vindo, '+(nomeUsuario()||'')+'!');
}
async function logoutNuvem(){ if(!confirm('Sair da sua conta?'))return; await nuvemLogout(); location.reload(); }
function modalTrocarSenhaConta(){
  openModal(`<div class="m-h">${svg('lock')}<h3>Alterar minha senha</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <p class="muted" style="margin-bottom:14px">Você está alterando a senha de <b>${esc(nomeUsuario()||'')}</b> (${esc((nuvemUser&&nuvemUser()&&nuvemUser().email)||'')}).</p>
      <div class="field"><label>Nova senha</label><input type="password" id="ns1"></div>
      <div class="field"><label>Repita a nova senha</label><input type="password" id="ns2"></div>
    </div>
    <div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarNovaSenha()">Salvar senha</button></div>`);
}
async function salvarNovaSenha(){ const a=val('ns1'), b=val('ns2');
  if(a.length<4){ toast('Use ao menos 4 caracteres.','err'); return; }
  if(a!==b){ toast('As senhas não conferem.','err'); return; }
  try{ await nuvemAlterarSenha(a); closeModal(); toast('Senha alterada com sucesso.'); }
  catch(e){ toast('Não foi possível alterar: '+(e.message||''),'err'); }
}
function modalGerenciarUsuarios(){
  const ref='kxwcwpxaovwgwviqhelh';
  openModal(`<div class="m-h">${svg('user')}<h3>Gerenciar usuários</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <p class="muted" style="line-height:1.6">Por segurança, criar ou remover usuários é feito no painel do servidor (Supabase). É rápido:</p>
      <ol class="etica-list" style="margin-top:10px">
        <li>Abra o painel de usuários (botão abaixo).</li>
        <li>Para <b>adicionar</b>: "Add user" → "Create new user" → e-mail + senha → marque <b>Auto Confirm User</b>.</li>
        <li>Para <b>remover</b>: clique nos 3 pontinhos do usuário → "Delete user".</li>
        <li>Para <b>redefinir a senha de alguém</b>: 3 pontinhos → "Reset password" (ou apague e crie de novo).</li>
      </ol>
      <div class="hint" style="margin-top:12px">Dica: use e-mails <b>uilian@planetaexpress.com</b> e <b>marcelo@planetaexpress.com</b> para o sistema mostrar o nome certo na saudação.</div>
    </div>
    <div class="m-f"><button class="btn" onclick="closeModal()">Fechar</button>
      <button class="btn primary" onclick="abrirReal('https://supabase.com/dashboard/project/${ref}/auth/users')">${svg('user')} Abrir painel de usuários</button></div>`);
}

let _splashStart = Date.now();
function esperarSplash(ms){ return new Promise(r=>setTimeout(r, Math.max(0,(ms||3400)-(Date.now()-_splashStart)))); }
async function bootOnline(){
  try{
    await nuvemSessao();
    if(!nuvemUser()){ await esperarSplash(5000); hideSplash(); mostrarLogin(); return; }  // abertura charmosa, depois login
    await esperarSplash(3600); await aposLogin();
  }catch(e){ await esperarSplash(2800); toast('Sem conexão com a nuvem — abrindo offline.','err'); router(); hideSplash(); }
}

async function init(){
  loadDB();
  try{ await idbOpen(); await reloadFiles(); }catch(e){ FILES=[]; }
  tick(); setInterval(tick,30000);
  window.addEventListener('hashchange',router);
  document.getElementById('overlay').addEventListener('click',e=>{ if(e.target.id==='overlay') closeModal(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
  document.addEventListener('input', aplicarMascaraInput);   /* pontuação automática (CPF, RG, telefone…) */
  if(typeof iaAtualizarAcesso==='function') iaAtualizarAcesso();  /* IA: aparece offline; online só após login */
  const s=document.getElementById('gsearch'); s.addEventListener('keydown',e=>{ if(e.key==='Enter') buscaGlobal(s.value); });
  // Sincronização: salva na hora ao fechar/minimizar; ao voltar, puxa o mais recente da nuvem
  window.addEventListener('beforeunload', flushNuvem);
  window.addEventListener('pagehide', flushNuvem);
  document.addEventListener('visibilitychange', async ()=>{
    if(document.hidden){ flushNuvem(); return; }
    if(typeof nuvemAtiva==='function' && nuvemAtiva() && nuvemUser && nuvemUser()){
      try{ const r=await nuvemCarregar(); if(r) aplicarRemoto(r); }catch(e){}
    }
  });
  router();
  if(typeof nuvemAtiva==='function' && nuvemAtiva()){ bootOnline(); }
  else { setTimeout(hideSplash, 5000); }
}
document.addEventListener('DOMContentLoaded',init);
