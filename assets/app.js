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
  ['notas','checklists','pneus','viagens','descargas','abastecimentos','faturamento','vales','ctes','servicos','anexos','estoqueBaterias','estoquePneus','seguros','pedagios','pagamentos'].forEach(k=>{ if(!Array.isArray(DB[k])) DB[k]=clone(SEED[k]||[]); });
  if(!DB.checklistModelo) DB.checklistModelo = clone(SEED.checklistModelo);
  if(!Array.isArray(DB.arquivos)) DB.arquivos = (typeof ARQUIVOS_EMPRESA!=='undefined'? clone(ARQUIVOS_EMPRESA):[]);
  if(!Array.isArray(DB.motoristas)) DB.motoristas=clone(SEED.motoristas);
  DB.motoristas.forEach(m=>{ if(m.endereco===undefined)m.endereco=''; if(m.socio===undefined)m.socio=false; });
  importarManutencaoPlanilhas();
  importarCtesSeed();
  corrigirValoresAntigos();
}
/* Importa (uma vez) os CT-e vindos dos XML. Não duplica (id = cte_<chave>). */
function importarCtesSeed(){
  if(typeof CTES_SEED==='undefined' || !Array.isArray(CTES_SEED)) return;
  if(!Array.isArray(DB.ctes)) DB.ctes=[];
  const ids=new Set(DB.ctes.map(c=>c.id));
  CTES_SEED.forEach(r=>{ if(!ids.has(r.id)){ DB.ctes.push(cteDerivaPlaca(Object.assign({},r))); } });
}
/* Descobre a placa do CT-e a partir do texto (PLACA: XXX) ou do Renavam citado na observação */
function cteDerivaPlaca(c){
  if(c.placa) return c;
  let m=(c.obs||'').match(/placa[:\s]+([A-Za-z]{3}[-\s]?\d[A-Za-z0-9]\d{2})/i);
  if(m){ const v=veiculoByPlaca(m[1]); c.placa = v? v.placa : m[1].toUpperCase().replace(/\s/g,'-'); return c; }
  const rm=(c.obs||'').match(/renavam\s*0*(\d{6,})/i);
  if(rm){ const alvo=rm[1].replace(/^0+/,''); const v=(DB.veiculos||[]).find(x=>String(x.renavam||'').replace(/^0+/,'')===alvo); if(v) c.placa=v.placa; }
  return c;
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
    else {  // preenche o que faltava em quem foi importado antes
      if(!ex.tipo) ex.tipo=r.tipo;
      if((ex.km===''||ex.km==null) && r.km!=='' && r.km!=null) ex.km=r.km;      // horas das carretas migram p/ o campo km
      if(ex.obs && /^Hora TK/i.test(ex.obs)) ex.obs='';
    }
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
  if(f) return `<span style="display:inline-flex;align-items:center;gap:5px">
    <span class="st ok" style="cursor:pointer" title="Ver ${esc(f.name)}" onclick="event.stopPropagation();verArquivo('${f.id}')">${svg('clip')} Anexado</span>
    <button class="btn ghost sm no-print" title="Baixar" onclick="event.stopPropagation();baixarArquivo('${f.id}')">${svg('download')}</button>
    <button class="btn ghost sm no-print" title="Excluir" onclick="event.stopPropagation();excluirArquivo('${f.id}')">${svg('trash')}</button></span>`;
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
  if(v.entidade==='seguro'){ const s=(DB.seguros||[]).find(x=>x.id===v.refId); return s?(s.segurado||s.seguradora||'—'):'—'; }
  return '—';
}
/* Rótulo curto do ramo do seguro */
function ramoLabel(r){ return {auto:'Automóvel',frota:'Frota',carga:'Carga',vida:'Vida'}[r]||'Seguro'; }
/* Vencimentos (NÃO inclui garantia de bateria — essa fica só na aba Baterias).
   Inclui as apólices de seguro ATIVAS: o fim da vigência vira o vencimento, para
   aparecerem no módulo Vencimentos, no Painel de Controle e nas notificações. */
function todosVencimentos(){
  const base = DB.vencimentos.slice();
  (DB.seguros||[]).forEach(s=>{
    if(!s || s.status==='Cancelado' || !s.fim) return;
    base.push({ id:'seg_'+s.id, entidade:'seguro', refId:s.id, tipo:'Seguro — '+ramoLabel(s.ramo),
      validade:s.fim, emissao:s.inicio||'', numero:s.apolice||'', orgao:s.seguradora||'',
      nome:(s.segurado||s.seguradora||''), obs:s.tipo||'', _seg:true });
  });
  return base;
}

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
  cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4" stroke="currentColor" stroke-width="1.7"/>',
  trend:'<path d="M3 17l6-6 4 4 8-8M21 7v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  coins:'<ellipse cx="9" cy="6" rx="6" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 6v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 13.6v4c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5c0-1.4-2.7-2.6-6-2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  search:'<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m20.5 20.5-4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  chevron:'<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  filter:'<path d="M3 5h18M6 12h12M10 19h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  umbrella:'<path d="M12 2v2M12 21a2 2 0 0 1-4 0M3.5 12a8.5 8.5 0 0 1 17 0c0 .8-.9.3-2 .3s-2 .5-2.5.5S13.5 12 12 12s-1.5.8-3 .8-1.4-.5-2.5-.5-2 .5-3 0z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 12v7" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  toll:'<path d="M4 21V10l4-6h8l4 6v11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 21h16M9 21v-6h6v6M8 8h8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  clients:'<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a7 7 0 0 1 14 0M16 3.5a3 3 0 0 1 0 5.8M22 20a6.5 6.5 0 0 0-4-6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
};
/* Ícone por tipo de documento/vencimento */
function tipoIcone(t){
  if(/^Seguro/i.test(t)) return 'umbrella';
  const m={'CNH':'idcard','Toxicológico':'flask','ASO':'clinic','Tacógrafo':'taco','CRLV':'doc','Vigilância Sanitária':'shield',
    'Opentech Funcionário':'chip','Opentech Veículo':'chip','PCMSO':'clinic','PGR':'shield','Certificado Digital':'chip',
    'Direção Defensiva':'wheel','Seguro':'umbrella','Rastreador':'chip'};
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
    const _pct = total? Math.round(d.value/total*100):0;
    const seg = `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${th}"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" data-tip="${esc(d.label)}: ${d.value} (${_pct}%)"/>`;
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
  opts=opts||{}; const h=opts.h||150, w=opts.w||420, pad=26, base=h-24, top=16;
  const n=Math.max(1,data.length); const gap=(w-pad*2)/n; const bw=Math.min(opts.bw||40, gap*0.56);
  const cmpArr=opts.compare||null;
  const max=Math.max(1,...data.map(d=>d.value||0), ...(cmpArr||[]));
  const totalV=data.reduce((s,d)=>s+(d.value||0),0)||1;
  let grid=''; for(let g=1;g<=4;g++){ const gy=(top+(base-top)*(1-g/4)); grid+=`<line class="bc-grid" x1="${pad}" y1="${gy.toFixed(1)}" x2="${w-pad}" y2="${gy.toFixed(1)}"/>`; }
  const bars=data.map((d,i)=>{
    const bh=Math.max(0,d.value||0)/max*(base-top);
    const x=pad+i*gap+(gap-bw)/2, y=base-bh;
    const clk=d.js?` class="bar-clk" onclick="${d.js}"`:(d.hash?` class="bar-clk" onclick="location.hash='${d.hash}'"`:'');
    const lbl=d.vtxt!=null?esc(d.vtxt):(opts.pct?Math.round((d.value||0)/totalV*100)+'%':(d.value||0));
    let cmp=''; if(cmpArr&&cmpArr[i]!=null){ const ch=Math.max(0,cmpArr[i])/max*(base-top); cmp=`<rect class="bc-cmp" x="${(x-4).toFixed(1)}" y="${(base-ch).toFixed(1)}" width="${(bw+8).toFixed(1)}" height="${ch.toFixed(1)}" rx="4"/>`; }
    const tip=` data-tip="${esc(d.label)}: ${d.vtxt!=null?esc(d.vtxt):(d.value||0)}${cmpArr&&cmpArr[i]!=null?' · período anterior: '+cmpArr[i]:''}"`;
    return `<g${clk}${tip}>
      ${d.hash?`<rect x="${(pad+i*gap).toFixed(1)}" y="0" width="${gap.toFixed(1)}" height="${h}" fill="transparent"/>`:''}
      ${cmp}
      <rect class="bc-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${d.color||'url(#bg)'}"/>
      ${(d.value||0)?`<text x="${(x+bw/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" class="bar-val">${lbl}</text>`:''}
      <text x="${(x+bw/2).toFixed(1)}" y="${h-8}" text-anchor="middle" class="bar-lbl">${esc(d.label)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="barchart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a7ff"/><stop offset="1" stop-color="#0062e0"/></linearGradient></defs>
    <g class="bc-grids">${grid}</g>${bars}</svg>`;
}
/* ---- Linha / Área (desenha sozinha) ---- */
function lineChart(data, opts){
  opts=opts||{}; const h=opts.h||160, w=opts.w||460, pad=30, top=16, base=h-26;
  const n=data.length; if(!n) return emptyState('Sem dados para o gráfico.');
  const cmpArr=opts.compare||null;
  const max=Math.max(1,...data.map(d=>d.value||0), ...(cmpArr||[]));
  const X=i=> pad+(w-pad*2)*(n<=1?0.5:i/(n-1));
  const Y=v=> base-(Math.max(0,v||0)/max)*(base-top);
  const pts=data.map((d,i)=>[X(i),Y(d.value)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=`M${X(0).toFixed(1)} ${base} `+pts.map(p=>'L'+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')+` L${X(n-1).toFixed(1)} ${base} Z`;
  let grid=''; for(let g=0;g<=3;g++){ const gy=top+(base-top)*g/3; grid+=`<line class="bc-grid" x1="${pad}" y1="${gy.toFixed(1)}" x2="${w-pad}" y2="${gy.toFixed(1)}"/>`; }
  let cmp=''; if(cmpArr){ const cl=cmpArr.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' '); cmp=`<path class="ln-cmp" d="${cl}" fill="none" pathLength="1"/>`; }
  const dots=pts.map((p,i)=>`<circle class="ln-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" data-tip="${esc(data[i].label)}: ${data[i].vtxt!=null?esc(data[i].vtxt):(data[i].value||0)}"${data[i].js?` style="cursor:pointer" onclick="${data[i].js}"`:''}/>`).join('');
  const labels=data.map((d,i)=>`<text x="${X(i).toFixed(1)}" y="${h-6}" text-anchor="middle" class="bar-lbl">${esc(d.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" class="linechart" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="lnf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,170,255,.34)"/><stop offset="1" stop-color="rgba(0,119,255,0)"/></linearGradient></defs>
    <g class="bc-grids">${grid}</g>
    <path class="ln-area" d="${area}" fill="url(#lnf)"/>${cmp}
    <path class="ln-line" d="${line}" fill="none" pathLength="1"/>${dots}${labels}</svg>`;
}
/* ---- Sparkline reutilizável (desenha sozinha) ---- */
function sparkline(values, opts){ opts=opts||{}; const w=opts.w||80, h=opts.h||26, n=(values||[]).length; if(!n) return '';
  const max=Math.max(...values), min=Math.min(...values), rng=(max-min)||1;
  const pts=values.map((v,i)=>[(n<=1?w/2:i/(n-1)*w),(h-3)-((v-min)/rng)*(h-6)]);
  return `<svg class="ini-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline class="cy-spark-line" points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" pathLength="1" fill="none" stroke="${opts.color||'#00e5ff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
/* ---- Heatmap (intensidade por célula) ---- */
function heatmap(cells, opts){ opts=opts||{}; const max=Math.max(1,...cells.map(c=>c.value||0));
  return `<div class="heatmap">${cells.map(c=>{ const t=(c.value||0)/max; const op=(0.10+t*0.9).toFixed(2);
    return `<div class="hm-cell${c.hash?' clk':''}"${c.hash?` onclick="location.hash='${c.hash}'"`:''} data-tip="${esc(c.tip||(c.label+': '+(c.value||0)))}" style="--i:${op}"><span class="hm-v">${c.value||0}</span><span class="hm-l">${esc(c.label)}</span></div>`; }).join('')}</div>`; }
/* ---- Timeline (eventos com linha) ---- */
function timeline(events, opts){ opts=opts||{}; if(!events||!events.length) return emptyState('Nada na linha do tempo.');
  return `<div class="timeline">${events.map(e=>`<div class="tl-row${e.hash?' clk':''}"${e.hash?` onclick="location.hash='${e.hash}'"`:''}><span class="tl-dot ${e.cls||''}"></span><div class="tl-main"><b>${esc(e.title)}</b>${e.sub?`<span>${esc(e.sub)}</span>`:''}</div>${e.when?`<div class="tl-when">${esc(e.when)}</div>`:''}</div>`).join('')}</div>`; }
/* ---- Radar (perfil multieixo) ---- */
function radar(axes, opts){ opts=opts||{}; const size=opts.size||220, cx=size/2, cy=size/2, R=size/2-30, n=(axes||[]).length; if(n<3) return '';
  const max=opts.max||Math.max(1,...axes.map(a=>a.value||0));
  const ang=i=> -Math.PI/2 + i*2*Math.PI/n;
  const pt=(i,rr)=>[cx+Math.cos(ang(i))*rr, cy+Math.sin(ang(i))*rr];
  let rings=''; for(let g=1;g<=3;g++){ const rr=R*g/3; rings+=`<polygon class="rd-ring" points="${axes.map((a,i)=>pt(i,rr).map(v=>v.toFixed(1)).join(',')).join(' ')}"/>`; }
  let spokes=''; for(let i=0;i<n;i++){ const p=pt(i,R); spokes+=`<line class="rd-spoke" x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}"/>`; }
  const dataPoly=axes.map((a,i)=>pt(i,R*Math.min(1,(a.value||0)/max)).map(v=>v.toFixed(1)).join(',')).join(' ');
  const labels=axes.map((a,i)=>{ const p=pt(i,R+15); return `<text class="rd-lbl" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="middle">${esc(a.label)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="radar">${rings}${spokes}<polygon class="rd-area" points="${dataPoly}"/>${labels}</svg>`; }

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
  pedagios:{t:'Pedágios', s:'Passagens, custos, praças e concessionárias', ico:'toll'},
  seguros:{t:'Seguros', s:'Apólices, vigências, prêmios e renovações', ico:'umbrella'},
  socios:{t:'Quadro Societário', s:'Sócios, fotos e documentos', ico:'briefcase'},
  etica:{t:'Código de Ética', s:'Conduta e normas da empresa', ico:'shield'},
  financeiro:{t:'Financeiro', s:'Faturamento, vales e pagamentos', ico:'lock'},
  config:{t:'Configurações', s:'Preferências e backup', ico:'gear'},
};
function go(h){ location.hash=h; }
function router(){
  const h = (location.hash||'#inicio').slice(1);
  try{ _pexTrackNav(); }catch(e){}                 // histórico p/ o botão Voltar (mobile)
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
  else if(rota==='km'){ kmFiltro=arg||'todos'; el.innerHTML=viewKM(); }
  else if(rota==='oleo') el.innerHTML=viewOleo();
  else if(rota==='manutencao'){ if(arg){ const v=veiculo(arg); if(v){ titulo=v.placa; sub='Relatório de Manutenção'; } el.innerHTML=viewManutencaoVeiculo(arg); } else el.innerHTML=viewManutencao(); }
  else if(rota==='pneus'){ if(arg && arg!=='limite'){ const v=veiculo(arg); if(v){ titulo=v.placa; sub='Pneus'; } el.innerHTML=viewPneusVeiculo(arg); } else { pneusFiltro=(arg==='limite')?'limite':'todos'; el.innerHTML=viewPneus(); } }
  else if(rota==='baterias'){ if(arg){ const v=veiculo(arg); if(v){ titulo=v.placa; sub='Baterias'; } el.innerHTML=viewBateriasVeiculo(arg); } else el.innerHTML=viewBaterias(); }
  else if(rota==='abastecimento') el.innerHTML=viewAbastecimento();
  else if(rota==='viagens'){ el.innerHTML=viewViagens(); if(arg) setTimeout(function(){ if(typeof modalViagem==='function' && DB.viagens.some(x=>x.id===arg)) modalViagem(arg); },30); }
  else if(rota==='descargas') el.innerHTML=viewDescargas();
  else if(rota==='ctes') el.innerHTML=viewCtes();
  else if(rota==='checklist') el.innerHTML=viewChecklist();
  else if(rota==='alarmes') el.innerHTML=viewAlarmes();
  else if(rota==='notas') el.innerHTML=viewNotas();
  else if(rota==='documentos'){ if(arg) docFiltroEnt=arg; el.innerHTML=viewDocumentos(); }
  else if(rota==='pedagios'){ if(arg) pedFiltro=arg; el.innerHTML=viewPedagios(); }
  else if(rota==='seguros'){ if(arg) segFiltro=arg; el.innerHTML=viewSeguros(); }
  else if(rota==='socios') el.innerHTML=viewSocios();
  else if(rota==='financeiro') el.innerHTML=viewFinanceiro();
  else if(rota==='etica') el.innerHTML=viewEtica();
  else if(rota==='inicio') el.innerHTML=viewInicio();
  else if(rota==='config') el.innerHTML=viewConfig();
  else if(rota==='dashboard') el.innerHTML=viewDashboard();
  else el.innerHTML=viewInicio();

  document.getElementById('pageTitle').innerHTML = esc(titulo)+'<small>'+esc(sub)+'</small>';
  window.scrollTo(0,0); closeSidebar(); if(typeof updateUserBadge==='function') updateUserBadge();
  if(typeof pexAfterRender==='function') pexAfterRender(rota);
}

/* ================================================================== */
/*  APP MOBILE (v6.54) — camada de apresentação (≤860px).              */
/*  Só comportamentos pós-render: NÃO altera telas/lógica; aplica a     */
/*  QUALQUER conteúdo, então toda tela nova entra no padrão sozinha.    */
/* ================================================================== */
function _pexMob(){ return typeof window!=='undefined' && window.matchMedia && window.matchMedia('(max-width:860px)').matches; }
function pexMobileInit(rota){
  if(!_pexMob()){ var c=document.getElementById('mobCtx'); if(c) c.remove(); return; }
  pexMobileCtx(rota);
  pexMobileTables();
  pexMobileGlobals();
}
/* Barra de contexto: seta Voltar (sempre no mesmo lugar) + título da tela; some na home */
function pexMobileCtx(rota){
  var home = rota==='inicio' || rota==='dashboard';
  var ctx=document.getElementById('mobCtx');
  if(home){ if(ctx) ctx.remove(); return; }
  var pt=document.getElementById('pageTitle');
  var titulo = pt ? (pt.firstChild ? (pt.firstChild.textContent||'').trim() : pt.textContent.trim()) : '';
  if(!titulo && typeof ROTAS!=='undefined' && ROTAS[rota]) titulo=ROTAS[rota].t;
  if(!ctx){ ctx=document.createElement('div'); ctx.id='mobCtx'; ctx.className='mob-ctx no-print';
    var view=document.getElementById('view'); if(view && view.parentNode) view.parentNode.insertBefore(ctx, view); }
  ctx.innerHTML='<button class="mob-ctx-back" onclick="navVoltar()" aria-label="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button><div class="mob-ctx-title">'+esc(titulo)+'</div>';
}
/* Converte tabelas em cards: injeta data-th (do cabeçalho) em cada célula. Idempotente. */
function pexMobileTables(){
  document.querySelectorAll('#view table.tbl').forEach(function(tbl){
    var head=tbl.tHead && tbl.tHead.rows[0]; if(!head) return;
    var ths=[].map.call(head.cells, function(c){ return (c.textContent||'').trim(); });
    if(!ths.some(function(t){ return t; })) return;
    tbl.classList.add('mob-cards');
    [].forEach.call(tbl.tBodies, function(tb){ [].forEach.call(tb.rows, function(r){
      if(r.classList.contains('grouprow')) return;
      [].forEach.call(r.cells, function(td,i){ if(!td.hasAttribute('data-th')) td.setAttribute('data-th', ths[i]||''); });
    }); });
  });
}
/* Listeners globais só-uma-vez: ripple nos botões + fechar o menu com gesto (swipe) */
function pexMobileGlobals(){
  if(window.__pexMobG) return; window.__pexMobG=true;
  document.addEventListener('pointerdown', function(e){
    if(!_pexMob()) return; var b=e.target.closest && e.target.closest('.btn, .mob-ctx-back'); if(!b) return;
    var rc=b.getBoundingClientRect(); var d=Math.max(rc.width,rc.height);
    var r=document.createElement('span'); r.className='pex-ripple';
    r.style.width=r.style.height=d+'px'; r.style.left=(e.clientX-rc.left-d/2)+'px'; r.style.top=(e.clientY-rc.top-d/2)+'px';
    b.appendChild(r); setTimeout(function(){ if(r.parentNode) r.parentNode.removeChild(r); }, 560);
  }, {passive:true});
  var sb=document.querySelector('.sidebar'); if(sb){ var x0=null,y0=null;
    sb.addEventListener('touchstart', function(e){ if(!sb.classList.contains('open')) return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; }, {passive:true});
    sb.addEventListener('touchmove', function(e){ if(x0==null) return; var dx=e.touches[0].clientX-x0, dy=e.touches[0].clientY-y0;
      if(dx<-55 && Math.abs(dx)>Math.abs(dy)){ if(typeof closeSidebar==='function') closeSidebar(); x0=null; } }, {passive:true});
    sb.addEventListener('touchend', function(){ x0=null; }, {passive:true});
  }
}

/* ================================================================== */
/*  APRIMORAMENTOS DE UX (v6.6) — tabelas, tooltips, mapa, loading      */
/*  Pós-render: não altera as telas nem a lógica; só realça a UX.       */
/* ================================================================== */
function pexAfterRender(rota){
  try{ var _vw=document.getElementById('view'); if(_vw){ _vw.setAttribute('data-route',rota);
      /* tema CYBER global: liga em todas as telas, EXCETO Início/Painel/Manutenção
         (já têm bloco cyber próprio scoped). Viagens/Descargas também são cyber. */
      var _noCy={inicio:1,dashboard:1,manutencao:1}; _vw.classList.toggle('cyber', !_noCy[rota]); }
    document.body.classList.toggle('pex-home', rota==='inicio'||rota==='dashboard');  // esconde o Voltar (mobile) nas telas iniciais
    pexTipInit(); pexEnhanceTables(); pexEnhanceCharts(); pexDashMapReveal(); if((rota==='inicio'||rota==='dashboard') && typeof iniCountUp==='function') iniCountUp();
    if(rota==='inicio' && typeof iniBaseWx==='function') iniBaseWx();
    if(rota==='descargas' && typeof descInit==='function') descInit();
    if(rota==='pedagios' && typeof pedCountUp==='function') pedCountUp();
    if(typeof pexMobileInit==='function') pexMobileInit(rota);
    if(typeof pexNotifBadge==='function') pexNotifBadge(); }catch(e){}
}
/* ---- Gráficos: botão de ampliar (zoom) nos cards com gráfico ---- */
function pexEnhanceCharts(){
  document.querySelectorAll('#view .card').forEach(function(card){
    if(!card.querySelector('.barchart,.linechart,.donut,.heatmap,.radar')) return;
    var head=card.querySelector('.card-h'); if(!head || head.querySelector('.chart-zoom')) return;
    var r=head.querySelector('.r'); if(!r){ r=document.createElement('div'); r.className='r'; head.appendChild(r); }
    var b=document.createElement('button'); b.type='button'; b.className='btn ghost sm chart-zoom no-print'; b.title='Ampliar gráfico';
    b.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"/></svg>';
    b.addEventListener('click', function(){ pexZoomChart(card); });
    r.insertBefore(b, r.firstChild);
  });
}
function pexZoomChart(card){
  var title=((card.querySelector('.card-h h3')||{}).textContent||'Gráfico').trim();
  var body=card.querySelector('.card-b'); if(!body) return;
  openModal('<div class="m-h">'+svg('dash')+'<h3>'+esc(title)+'</h3><button class="x" onclick="closeModal()">×</button></div>'+
    '<div class="m-b chart-zoom-body">'+body.innerHTML+'</div>', true);
}
/* ---- tabelas premium: busca + ordenação + paginação ---- */
function pexEnhanceTables(){
  document.querySelectorAll('#view table.tbl').forEach(function(tbl){
    if(tbl.closest('.dsc-months')||tbl.classList.contains('pex-noenh')) return;  // Descargas/Viagens têm lista própria (sem paginação)
    var tbody=tbl.tBodies[0]; if(!tbody) return;
    var rows=[].slice.call(tbody.rows).filter(function(r){ return !r.querySelector('.empty') && r.cells.length>1; });
    if(rows.length<6) return;                      // só vale a pena em tabelas maiores
    var wrap=tbl.closest('.tbl-wrap')||tbl.parentNode;
    var bar=document.createElement('div'); bar.className='pex-tbar no-print';
    bar.innerHTML='<div class="pex-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Pesquisar…"></div><div class="pex-pg"></div>';
    wrap.parentNode.insertBefore(bar, wrap);
    var st={page:1,per:12,q:''}; tbl.__st=st; tbl.__rows=rows; tbl.__bar=bar;
    if(tbl.tHead && tbl.tHead.rows[0]){ [].forEach.call(tbl.tHead.rows[0].cells,function(th,ci){
      if(!th.textContent.trim()||th.classList.contains('no-print')) return;
      th.classList.add('pex-sortable'); th.addEventListener('click',function(){ pexSort(tbl,ci,th); });
    }); }
    bar.querySelector('input').addEventListener('input',function(){ st.q=this.value.toLowerCase(); st.page=1; pexPaginate(tbl); });
    pexPaginate(tbl);
  });
}
function pexPaginate(tbl){
  var st=tbl.__st, rows=tbl.__rows;
  var filtered=rows.filter(function(r){ return !st.q || r.textContent.toLowerCase().indexOf(st.q)>=0; });
  var pages=Math.max(1,Math.ceil(filtered.length/st.per)); if(st.page>pages) st.page=pages;
  rows.forEach(function(r){ r.style.display='none'; });
  filtered.forEach(function(r,i){ if(i>=(st.page-1)*st.per && i<st.page*st.per) r.style.display=''; });
  var pg=tbl.__bar.querySelector('.pex-pg');
  var info='<span class="pex-count">'+filtered.length+' registro(s)</span>';
  if(filtered.length<=st.per){ pg.innerHTML=info; return; }
  pg.innerHTML=info+'<button class="pex-pgb" data-d="-1" '+(st.page<=1?'disabled':'')+'>‹</button><span class="pex-pgn">'+st.page+' / '+pages+'</span><button class="pex-pgb" data-d="1" '+(st.page>=pages?'disabled':'')+'>›</button>';
  [].forEach.call(pg.querySelectorAll('.pex-pgb'),function(b){ b.onclick=function(){ st.page+=(+b.getAttribute('data-d')); pexPaginate(tbl); }; });
}
function _pexKey(v){ v=(v==null?'':v).trim();
  var dm=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(dm) return {n:+(dm[3]+String(dm[2]).padStart(2,'0')+String(dm[1]).padStart(2,'0'))};
  // numérico só se NÃO houver letras (ignora prefixo R$ e sufixo de unidade); assim placas viram texto
  var b=v.replace(/^R\$\s*/i,'').replace(/\s*(km|kms|h|hrs?|kg|lts?|l|un|mm|%)\.?$/i,'').trim();
  if(b && !/[a-zà-ÿ]/i.test(b) && /\d/.test(b)){ var n=parseFloat(b.replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.')); if(!isNaN(n)) return {n:n}; }
  return {s:v.toLowerCase()}; }
function pexSort(tbl,ci,th){
  var dir=(th.__dir==='asc')?'desc':'asc';
  [].forEach.call(tbl.tHead.rows[0].cells,function(c){ c.__dir=null; c.classList.remove('pex-asc','pex-desc'); });
  th.__dir=dir; th.classList.add(dir==='asc'?'pex-asc':'pex-desc');
  var rows=tbl.__rows, sign=dir==='asc'?1:-1;
  rows.sort(function(a,b){ var ka=_pexKey((a.cells[ci]||{}).textContent||''), kb=_pexKey((b.cells[ci]||{}).textContent||'');
    if(ka.n!=null && kb.n!=null) return (ka.n-kb.n)*sign;
    if(ka.n!=null) return -1; if(kb.n!=null) return 1;
    return (ka.s||'').localeCompare(kb.s||'','pt')*sign; });
  var tbody=tbl.tBodies[0]; rows.forEach(function(r){ tbody.appendChild(r); });
  tbl.__st.page=1; pexPaginate(tbl);
}
/* ---- tooltip elegante (para gráficos, mapa e qualquer [data-tip]) ---- */
function pexTipInit(){
  if(window.__pexTip) return; window.__pexTip=true;
  var tip=document.createElement('div'); tip.id='pexTip'; tip.className='pex-tip'; document.body.appendChild(tip);
  var cur=null;
  document.addEventListener('mouseover',function(e){ var t=e.target.closest?e.target.closest('[data-tip]'):null;
    if(t){ cur=t; tip.textContent=t.getAttribute('data-tip'); tip.classList.add('show'); } });
  document.addEventListener('mousemove',function(e){ if(tip.classList.contains('show')){
    var x=e.clientX+14, y=e.clientY+16; if(x>innerWidth-180)x=e.clientX-tip.offsetWidth-14; tip.style.left=x+'px'; tip.style.top=y+'px'; } });
  document.addEventListener('mouseout',function(e){ if(cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))){ cur=null; tip.classList.remove('show'); } });
}
/* ---- barra de carregamento global (topo) + estado loading de botão ---- */
function pexBar(on){ var b=document.getElementById('pexBar'); if(!b){ b=document.createElement('div'); b.id='pexBar'; document.body.appendChild(b); } b.className=on?'run':''; }
function pexBtnLoad(btn,on){ if(!btn)return; if(on){ btn.classList.add('loading'); btn.disabled=true; } else { btn.classList.remove('loading'); btn.disabled=false; } }
/* ---- revela o mapa do dashboard após um skeleton (widget "ao vivo") ---- */
function pexDashMapReveal(){ var s=document.getElementById('pexMapSkel'); if(!s) return;
  setTimeout(function(){ s.classList.add('gone'); setTimeout(function(){ if(s.parentNode) s.remove(); },450); }, 700); }


/* ================================================================== */
/*  7. SIDEBAR                                                         */
/* ================================================================== */
function contadores(){
  let venc=0, crit=0;
  todosVencimentos().forEach(v=>{ const s=situacao(v.validade); if(s.ord===0) venc++; else if(s.ord===1) crit++; });
  let seg=0; (DB.seguros||[]).forEach(s=>{ if(s && s.status!=='Cancelado'){ const d=diasAte(s.fim); if(d!=null && d<=60) seg++; } });
  return {venc, crit, total:venc+crit, seg};
}
function renderSidebar(rota){
  const c = contadores();
  const item=(k,badge)=>{ const m=ROTAS[k];
    const b = badge?`<span class="badge ${badge.cls}">${badge.n}</span>`:'';
    return `<a href="#${k}" data-label="${esc(m.t)}" class="${rota===k?'active':''}">${svg(m.ico,'ico')}<span>${m.t}</span>${b}</a>`; };
  document.getElementById('nav').innerHTML =
    `<div class="group">Principal</div>`+ item('inicio')+ item('dashboard')+
    item('vencimentos', c.total?{n:c.total, cls:c.venc?'':'warn'}:null)+
    `<div class="group">Cadastros</div>`+ item('frota')+ item('motoristas')+ item('exames')+ item('direcao')+
    `<div class="group">Manutenção</div>`+ item('km')+ item('oleo')+ item('manutencao')+ item('pneus')+ item('baterias')+ item('abastecimento')+ item('tacografos')+
    `<div class="group">Operação</div>`+ item('viagens')+ item('descargas')+ item('ctes')+ item('checklist')+ item('notas')+ item('pedagios')+ item('alarmes')+ item('documentos')+
    `<div class="group">Financeiro</div>`+ item('financeiro')+ item('seguros', c.seg?{n:c.seg, cls:'warn'}:null)+
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
/* KPI de vidro com count-up + sparkline (compartilhado Início/Painel) */
function iniKpiTile(ico,cls,val,pre,suf,label,href,color,pts){
  return `<a class="ini-kpi ${cls}" href="#${href}"><span class="ic">${svg(ico)}</span><span class="num" data-count="${val}" data-pre="${pre||''}" data-suf="${suf||''}">${(pre||'')}0${(suf||'')}</span><span class="l">${label}</span><svg class="ini-spark" viewBox="0 0 80 26" preserveAspectRatio="none"><polyline class="cy-spark-line" points="${pts}" pathLength="1" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`;
}
function viewDashboard(){
  const vs = todosVencimentos().map(v=>({v, s:situacao(v.validade)}));
  const venc = vs.filter(x=>x.s.ord===0), crit = vs.filter(x=>x.s.ord===1), aten = vs.filter(x=>x.s.ord===2), emdia=vs.filter(x=>x.s.ord===3);
  /* Faixas IGUAIS às do módulo Vencimentos (v6.27): Vencidos / ≤10 / 11–20 / 21–30 dias.
     A contagem de cada card é calculada por dias para bater EXATAMENTE com o que abre ao clicar. */
  const _vd = todosVencimentos().map(v=>({v,d:diasAte(v.validade)}));
  const fVenc=_vd.filter(x=>x.d!=null&&x.d<0);
  const fD10 =_vd.filter(x=>x.d!=null&&x.d>=0&&x.d<=10);
  const fD20 =_vd.filter(x=>x.d!=null&&x.d>10&&x.d<=20);
  const fD30 =_vd.filter(x=>x.d!=null&&x.d>20&&x.d<=30);
  const fTotal=fVenc.length+fD10.length+fD20.length+fD30.length;
  const cavalos = DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado').length;
  const reb = DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado').length;
  const motAtivos = DB.motoristas.filter(m=>m.status==='Ativo').length;
  const segList = (DB.seguros||[]).filter(s=>s&&s.status!=='Cancelado');
  const segAv = segList.filter(s=>{ const d=diasAte(s.fim); return d!=null && d>=0 && d<=90; }).length;  // = exatamente o que abre em #seguros/avencer
  const segCrit = segList.some(s=>{ const d=diasAte(s.fim); return d!=null && d>=0 && d<=30; });

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
  const pneusAlerta = DB.pneus.filter(_pneuNoLimite).length;
  const chkMes = DB.checklists.filter(c=>{ const d=parseD(c.data),h=hoje(); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).length;
  const chkUlt = DB.checklists.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,5);
  const tipos={Cavalos:cavalos,Reboques:reb};
  // Últimos 6 meses (viagens e despesas) — para gráficos clicáveis
  const now2=hoje(); const ult6=[];
  for(let i=5;i>=0;i--){ const d=new Date(now2.getFullYear(),now2.getMonth()-i,1); ult6.push({ym:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), label:MESES[d.getMonth()]}); }
  const viagensMes=ult6.map(m=>({label:m.label, value:DB.viagens.filter(v=>(v.data||'').slice(0,7)===m.ym).length, js:"viagemMes='"+m.ym+"';location.hash='viagens'"}));
  const despMes=ult6.map(m=>({label:m.label, value:Math.round(DB.notas.filter(n=>(n.fim||'').slice(0,7)===m.ym).reduce((s,n)=>s+totalNota(n),0)), color:'url(#bg)', js:"location.hash='notas'"}));
  const vSitData=[{label:'Pendentes',value:DB.viagens.filter(v=>v.status==='Pendente').length,color:'#c99a2e'},{label:'Concluídas',value:DB.viagens.filter(v=>v.status==='Concluída').length,color:'#0f766e'},{label:'Canceladas',value:DB.viagens.filter(v=>v.status==='Cancelada').length,color:'#9f1239'}];
  // Período anterior (6 meses antes) — para comparação nos gráficos de linha
  const prev6=[]; for(let i=11;i>=6;i--){ const d=new Date(now2.getFullYear(),now2.getMonth()-i,1); prev6.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); }
  const viagensCmp=prev6.map(ym=>DB.viagens.filter(v=>(v.data||'').slice(0,7)===ym).length);
  const despCmp=prev6.map(ym=>Math.round(DB.notas.filter(n=>(n.fim||'').slice(0,7)===ym).reduce((s,n)=>s+totalNota(n),0)));
  const _sum=a=>a.reduce((s,x)=>s+(x||0),0);
  const vgAtual=_sum(viagensMes.map(m=>m.value)), vgAnt=_sum(viagensCmp);
  const vgPct= vgAnt? Math.round((vgAtual-vgAnt)/vgAnt*100) : null;
  // Heatmap de atividade (viagens nos últimos 12 meses)
  const heat=[]; for(let i=11;i>=0;i--){ const d=new Date(now2.getFullYear(),now2.getMonth()-i,1); const ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); const cnt=DB.viagens.filter(v=>(v.data||'').slice(0,7)===ym).length; heat.push({label:MESES[d.getMonth()].slice(0,3), value:cnt, hash:'#viagens', tip:MESES[d.getMonth()]+'/'+d.getFullYear()+': '+cnt+' viagem(ns)'}); }
  // Timeline dos próximos vencimentos
  const tlVenc = prox.map(x=>({ title:(x.v.tipo||'Documento')+(_vencNome(x.v)?' — '+_vencNome(x.v):''), sub:(x.s.dias<=0?'Vencido':'Vence em '+x.s.dias+' dia(s)'), when:fmtD(x.v.validade), cls:(x.s.ord===0?'crit':x.s.ord<=2?'warn':'ok'), hash:'#vencimentos' }));

  return `<div class="ini-cmd ini-dash">
  <div class="ini-top">
    <div class="ini-brand"><div class="mk"><img src="assets/logo.png" alt=""></div><div class="tx"><b>PAINEL DE CONTROLE</b><span>Visão geral da operação</span></div></div>
    <div class="ini-status"><span class="live"><i></i>Operação ativa</span><span class="clk" id="iniClock">--:--</span></div>
  </div>

  <div class="ini-kstrip4">
    ${iniKpiTile('truck','', cavalos+reb, '', '', 'Veículos ativos', 'frota', '#5cc8ff', '0,20 16,16 32,18 48,10 64,13 80,6')}
    ${iniKpiTile('user','', motAtivos, '', '', 'Motoristas ativos', 'motoristas', '#4bd6a0', '0,18 16,15 32,17 48,13 64,9 80,11')}
    ${iniKpiTile('shield', fVenc.length?'crit':'', fVenc.length, '', '', 'Documentos vencidos', 'vencimentos/venc', '#f2686b', '0,8 16,12 32,10 48,16 64,14 80,20')}
    ${iniKpiTile('bell', fD10.length?'crit':'', fD10.length, '', '', 'Vencem em ≤10 dias', 'vencimentos/d10', '#f2a44e', '0,10 16,14 32,9 48,16 64,12 80,18')}
    ${iniKpiTile('umbrella', segCrit?'crit':'', segAv, '', '', 'Seguros a vencer', 'seguros/avencer', '#f2a44e', '0,14 16,12 32,16 48,11 64,14 80,9')}
    ${iniKpiTile('money','', Math.round(ultNotaTotal), 'R$ ', '', 'Despesas', 'notas', '#4bd6a0', '0,18 16,14 32,17 48,12 64,15 80,10')}
    ${iniKpiTile('gauge', manutAlerta.length?'crit':'', manutAlerta.length, '', '', 'Trocas a vencer', 'km/avencer', '#e0b354', '0,16 16,14 32,18 48,12 64,15 80,10')}
    ${iniKpiTile('tire', pneusAlerta?'crit':'', pneusAlerta, '', '', 'Pneus no limite', 'pneus/limite', '#5c99ff', '0,14 16,16 32,12 48,15 64,13 80,9')}
    ${iniKpiTile('check','', chkMes, '', '', 'Check-lists no mês', 'checklist', '#4bd6a0', '0,18 16,14 32,16 48,10 64,13 80,8')}
  </div>

  <div class="grid two-col">
    <div class="card">
      <div class="card-h">${svg('shield')}<h3>Situação dos vencimentos</h3><div class="r"><span class="muted" style="font-size:11.5px">faixa de atenção · clique para abrir</span></div></div>
      <div class="card-b">
        <div class="donut-wrap">
          ${donut([
            {label:'Vencidos',value:fVenc.length,color:'#dc2626'},
            {label:'≤10 dias',value:fD10.length,color:'#f97316'},
            {label:'11–20 dias',value:fD20.length,color:'#eab308'},
            {label:'21–30 dias',value:fD30.length,color:'#3b82f6'},
          ],{center:fTotal,sub:'na faixa'})}
          <div class="legend">
            <div class="li clk" onclick="location.hash='vencimentos/venc'"><span class="dot" style="background:#dc2626"></span>Vencidos<b>${fVenc.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/d10'"><span class="dot" style="background:#f97316"></span>Vence em ≤10 dias<b>${fD10.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/d20'"><span class="dot" style="background:#eab308"></span>Vence em 11–20 dias<b>${fD20.length}</b></div>
            <div class="li clk" onclick="location.hash='vencimentos/d30'"><span class="dot" style="background:#3b82f6"></span>Vence em 21–30 dias<b>${fD30.length}</b></div>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-h">${svg('wrench')}<h3>Trocas a vencer (KM / Horas)</h3>
        <div class="r"><a class="btn sm" href="#km/avencer">Ver / atualizar</a></div></div>
      <div class="card-b p0">
        ${manutAlerta.length? manutAlerta.slice(0,6).map(x=>`
          <div class="alert-row" onclick="location.hash='km/avencer'">
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
          <div class="li clk" onclick="frotaFiltro='cavalo';location.hash='frota'"><span class="dot" style="background:#2563eb"></span>Cavalos<b>${cavalos}</b></div>
          <div class="li clk" onclick="frotaFiltro='reboque';location.hash='frota'"><span class="dot" style="background:#38bdf8"></span>Reboques<b>${reb}</b></div>
          <div class="li"><span class="dot" style="background:#94a3b8"></span>Pneus cadastrados<b>${DB.pneus.length}</b></div>
        </div>
      </div></div>
    </div>
    <div class="card">
      <div class="card-h">${svg('check')}<h3>Últimos check-lists</h3>
        <div class="r"><a class="btn sm" href="#checklist">Ver todos</a></div></div>
      <div class="card-b p0">
        ${chkUlt.length? chkUlt.map(c=>{ const v=veiculo(c.veiculoId); const r=chkResumo(c);
          return `<div class="alert-row" onclick="location.hash='checklist';modalChecklist('${c.id}')">
            <div class="a-ico ${r.nok?'i-red':'i-green'}">${svg('check')}</div>
            <div class="a-main"><b>${v?esc(v.placa):'—'} — ${esc(c.motoristaNome||(motorista(c.motoristaId)||{}).nome||'')}</b><span>${fmtDLong(c.data)}${c.km?' · '+num(c.km)+' km':''}</span></div>
            <div class="a-when"><span class="st ${r.nok?'crit':'ok'}">${r.nok?r.nok+' NOK':'OK'}</span></div></div>`;
        }).join('') : emptyState('Nenhum check-list ainda. Faça o primeiro em Check-list.')}
      </div>
    </div>
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

/* --- Cards de veículo estilo Frota, reutilizados em Manutenção/Pneus/Baterias --- */
function vcardMini(v, rota, footHtml){
  return `<div class="vcard" onclick="location.hash='${rota}/${v.id}'">
    <div class="vcard-top"><div class="vplate">${plate(v.placa,v.tipo)}</div>
      <span class="tag ${v.tipo==='Cavalo'?'cavalo':'rebo'}">${v.tipo==='Cavalo'?'Cavalo':'Reboque'}</span></div>
    <div class="vcard-body"><div class="vcard-model">${esc(v.marca||'—')} ${esc(v.modelo||'')}</div>
      <div class="vcard-sub">${esc(v.anoModelo||'')}${v.renavam?' · Renavam '+esc(v.renavam):''}</div></div>
    <div class="vcard-foot">${footHtml||''}</div>
  </div>`;
}
function vcardsSecoes(rota, footFn){
  const cav=DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado');
  const reb=DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado');
  return `<div class="sectitulo">${svg('truck')} Cavalos</div>
    <div class="grid vgrid">${cav.map(v=>vcardMini(v,rota,footFn(v))).join('')||emptyState('Nenhum cavalo.')}</div>
    <div class="sectitulo" style="margin-top:22px">${svg('battery')} Carretas</div>
    <div class="grid vgrid">${reb.map(v=>vcardMini(v,rota,footFn(v))).join('')||emptyState('Nenhuma carreta.')}</div>`;
}
/* Cabeçalho padrão da tela de detalhe de um veículo (placa + especificações) */
function detalheVeiculoHead(v, acaoHtml){
  const cavalo=v.tipo==='Cavalo';
  return `<button class="btn ghost sm no-print" onclick="history.back()" style="margin-bottom:14px">← Voltar</button>
  <div class="detail-head">
    <div class="avatar veh">${svg('truck')}</div>
    <div class="dh-main"><h2>${esc(v.placa)}</h2>
      <div class="meta"><span>${esc(v.marca||'—')} ${esc(v.modelo||'')}</span>
        <span class="tag ${cavalo?'cavalo':'rebo'}">${esc(v.tipo)}</span>
        <span>${cavalo?'KM '+num(v.kmAtual):'Horas '+num(v.horaAtual)}</span></div></div>
    <div class="dh-actions no-print">${acaoHtml||''}</div>
  </div>`;
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
  const extra = cavalo
    ? info2('Potência', v.potencia?esc(v.potencia)+' cv':'')+info2('Modelo do motor', esc(v.modeloMotor||''))+info2('Câmbio', esc(v.cambio||''))
    : info2('Equipamento (refrigeração)', esc(v.modeloEquip||''))+info2('Dimensões internas', esc(v.dimInternas||''))
      +info2('Divisória c/ ventilador', esc(v.divisoria||''))
      +info2('Trava-pallets', ((v.travaPalletQtd?esc(v.travaPalletQtd)+'× ':'')+(v.travaPalletModelo?esc(v.travaPalletModelo):'')).trim());

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
    ${info2('Cor', esc(v.cor||''))}
    ${extra}
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
  ${m.problemasSaude?`<div class="card" style="margin-bottom:18px;border-left:3px solid #ff6b6b"><div class="card-b" style="display:flex;gap:12px;align-items:flex-start">
    <span style="color:#ff6b6b;flex:0 0 auto;display:flex">${svg('stetho')}</span>
    <div><b style="display:block;color:#ff6b6b;margin-bottom:3px">Problemas de saúde</b><span style="white-space:pre-wrap">${esc(m.problemasSaude)}</span></div></div></div>`:''}
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
const VENC_SEC={
  venc:{t:'Vencidos',ico:'alarm',cor:'#ff4d4d',sub:'ação imediata',kico:'i-red'},
  d10:{t:'Vence em até 10 dias',ico:'bell',cor:'#ff8c1a',sub:'urgente',kico:'i-orange'},
  d20:{t:'Vence em 11 a 20 dias',ico:'bell',cor:'#ffb020',sub:'atenção',kico:'i-amber'},
  d30:{t:'Vence em 21 a 30 dias',ico:'cal',cor:'#2f8fff',sub:'programar',kico:'i-blue'}
};
function _vencBucket(d){ return d<0?'venc':(d<=10?'d10':(d<=20?'d20':'d30')); }
function viewVencimentos(){
  let all=todosVencimentos().map(v=>({v,d:diasAte(v.validade)}));
  const tipos=[...new Set(todosVencimentos().map(v=>v.tipo))].sort();
  if(vencTipo!=='todos') all=all.filter(x=>x.v.tipo===vencTipo);
  const semData=all.filter(x=>x.d==null).length;
  const faixa=all.filter(x=>x.d!=null && x.d<=30);   /* só a faixa: vencidos + próximos 30 dias */
  const groups={venc:[],d10:[],d20:[],d30:[]};
  faixa.forEach(x=>groups[_vencBucket(x.d)].push(x));
  Object.keys(groups).forEach(k=>groups[k].sort((a,b)=>a.d-b.d));
  const cont={venc:groups.venc.length,d10:groups.d10.length,d20:groups.d20.length,d30:groups.d30.length};
  const total=faixa.length;

  const kpiV=(k)=>{ const d=VENC_SEC[k]; return `<a class="kpi link ${vencFiltro===k?'ativo':''}" style="cursor:pointer" onclick="vencFiltro='${vencFiltro===k?'todos':k}';router()">
    <div class="k-top"><div class="k-ico ${d.kico}">${svg(d.ico)}</div><span class="k-go">→</span></div>
    <div class="k-val">${cont[k]}</div><div class="k-label">${d.t.replace('Vence em ','').replace('até ','≤')}</div></a>`; };

  const itemRow=(x,cor)=>{ const v=x.v;
    const alvo=v.entidade==='veiculo'?('frota/'+v.refId):(v.entidade==='motorista'?('motoristas/'+v.refId):(v.entidade==='seguro'?'seguros':'vencimentos'));
    const ent=v.entidade==='veiculo'?'Veículo':(v.entidade==='motorista'?'Motorista':(v.entidade==='seguro'?'Seguro':'Empresa'));
    const anexo=(v.anexoId&&arquivoPorId(v.anexoId));
    const dtxt = x.d<0?('Vencido há '+Math.abs(x.d)+' dia'+(Math.abs(x.d)===1?'':'s')):('Vence em '+x.d+' dia'+(x.d===1?'':'s'));
    return `<div class="venc-row">
      <div class="venc-ico" style="color:${cor};background:${cor}1f">${svg(tipoIcone(v.tipo))}</div>
      <div class="venc-main"><b onclick="modalVencimento('${v.id}')">${esc(v.tipo)}${v.numero?` · Nº ${esc(v.numero)}`:''}</b>
        <span onclick="event.stopPropagation();location.hash='${alvo}'">${esc(nomeEntidade(v))} · ${ent}${v.orgao?' · '+esc(v.orgao):''}</span></div>
      <div class="venc-when"><b class="mono">${fmtD(v.validade)}</b><span class="venc-dias" style="color:${cor};background:${cor}1f">${dtxt}</span></div>
      <div class="venc-act no-print">${anexo?`<button class="btn ghost sm" title="Baixar anexo" onclick="baixarArquivo('${anexo.id}')">${svg('download')}</button>`:''}<button class="btn ghost sm" title="Editar" onclick="modalVencimento('${v.id}')">${svg('edit')}</button></div>
    </div>`; };

  const section=(k)=>{ const g=groups[k]; if(!g.length) return ''; if(vencFiltro!=='todos' && vencFiltro!==k) return ''; const d=VENC_SEC[k];
    return `<div class="card venc-sec" style="border-left:3px solid ${d.cor}">
      <div class="venc-sec-h"><span class="venc-sec-dot" style="background:${d.cor};box-shadow:0 0 10px ${d.cor}"></span>
        <div><b>${d.t}</b><small>${d.sub}</small></div><span class="venc-sec-n" style="color:${d.cor};background:${d.cor}22">${g.length}</span></div>
      <div class="venc-list">${g.map(x=>itemRow(x,d.cor)).join('')}</div></div>`; };

  return `
  <div class="banner">${svg('bell')}<div><b>Vencimentos — faixa de atenção</b><span>Mostra apenas o que está vencido ou vence nos próximos 30 dias, agrupado por prazo. O que está em dia (mais de 30 dias) fica oculto.</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalVencimento()">${svg('plus')} Novo</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kpiV('venc')}${kpiV('d10')}${kpiV('d20')}${kpiV('d30')}
  </div>
  <div class="toolbar">
    <select class="selectlite" onchange="vencTipo=this.value;router()">
      <option value="todos">Todos os tipos</option>
      ${tipos.map(t=>`<option value="${esc(t)}" ${vencTipo===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    ${vencFiltro!=='todos'?`<button class="btn sm no-print" onclick="vencFiltro='todos';router()">${svg('list')} Ver todas as faixas</button>`:''}
    <div class="spacer"></div>
    <div class="muted no-print" style="font-size:12.5px">${total} vencimento(s) na faixa</div>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button>
    <button class="btn no-print" onclick="modalImportar()" title="Importe uma planilha (Excel ou CSV) e o sistema puxa as validades sozinho">${svg('upload')} Importar planilha</button>
  </div>
  ${total? `<div class="grid" style="gap:14px">${section('venc')}${section('d10')}${section('d20')}${section('d30')}</div>`
    : `<div class="card"><div class="card-b">${emptyState('Nada vencido e nada vence nos próximos 30 dias. Tudo em dia! 👍')}</div></div>`}
  ${semData?`<div class="muted no-print" style="font-size:12.5px;margin-top:14px">${svg('bell')} ${semData} documento(s) sem data de validade cadastrada — cadastre a validade para acompanhá-los aqui.</div>`:''}`;
}

/* ================================================================== */
/*  14. KM / HORAS                                                     */
/* ================================================================== */
let kmFiltro='todos';
function _kmAvencer(v){ const p=primaryItem(v); if(!p) return false; const info=manutInfo(p,v); return info.ok && (info.st==='vencido'||info.st==='crit'); }
function viewKM(){
  const avencer = kmFiltro==='avencer';
  const cavalos=DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado'&&(!avencer||_kmAvencer(v)));
  const carretas=DB.veiculos.filter(v=>isReb(v)&&v.status!=='Arquivado'&&(!avencer||_kmAvencer(v)));
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
        ${(cavalo?v.kmData:v.horaData)?`<div class="muted" style="font-size:11px;margin-top:6px">Última alteração: <b>${fmtD(cavalo?v.kmData:v.horaData)}</b> · <a href="#" onclick="event.preventDefault();modalHistLeitura('${v.id}')">ver histórico</a></div>`:''}
      </div>
      ${info&&info.ok?`
        <div class="kmcard-item"><span>${esc(p.item)}</span><b class="st ${info.st}">${info.restante<=0?'Vencida há '+num(-info.restante)+' '+un:'faltam '+num(info.restante)+' '+un}</b></div>
        <div class="bt"><i class="fill-${info.st}" style="width:${info.pct}%"></i></div>
        <div class="muted" style="font-size:11px;margin-top:4px">Próxima troca em ${num(info.prox)} ${un} · última ${fmtD(p.data)}</div>
      `:`<div class="muted" style="font-size:11.5px;margin-top:6px">Informe o ${cavalo?'KM':'horas'} para calcular a próxima troca.</div>`}
    </div>`;
  };
  if(avencer){
    return `<div class="banner">${svg('wrench')}<div><b>Trocas a vencer — KM / Horas</b><span>Somente os veículos com a troca de óleo/filtros vencida ou próxima. Atualize o KM/horas para recalcular.</span></div>
      <button class="btn no-print" style="margin-left:auto" onclick="location.hash='km'">${svg('list')} Ver todos os veículos</button></div>
    ${cavalos.length?`<div class="sectitulo">${svg('truck')} Cavalos</div><div class="grid kmgrid">${cavalos.map(cardVeic).join('')}</div>`:''}
    ${carretas.length?`<div class="sectitulo" style="margin-top:22px">${svg('battery')} Carretas — Thermo King</div><div class="grid kmgrid">${carretas.map(cardVeic).join('')}</div>`:''}
    ${(!cavalos.length&&!carretas.length)?`<div class="card"><div class="card-b">${emptyState('Nenhuma troca a vencer no momento. Tudo em dia! 👍')}</div></div>`:''}`;
  }
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
/* Serviços/reparos + TROCAS DE ÓLEO (que tenham valor) — óleo entra como Preventiva.
   Assim o custo das trocas de óleo é somado nos totais/gráficos da manutenção. */
function _manutTodos(){
  const out=DB.servicos.slice();
  (DB.manutencoes||[]).forEach(function(m){
    const v=Number(m.valor)||0; if(v<=0) return;
    out.push({ _oleoId:m.id, veiculoId:m.veiculoId, data:m.data||'', descricao:(m.item||'Troca de óleo'),
      oficina:m.oficina||'', km:(m.kmTroca!=null?m.kmTroca:m.horasTroca), valor:v, tipo:'Preventiva' });
  });
  return out;
}
function viewManutencao(){
  const todos=_manutTodos();
  const ehTipo=(x,t)=> (x.tipo||'Corretiva')===t;
  const filtr = manutFiltro==='corretiva'? todos.filter(x=>ehTipo(x,'Corretiva'))
             : manutFiltro==='preventiva'? todos.filter(x=>ehTipo(x,'Preventiva')) : todos;
  const total=_somaServ(todos), corr=_somaServ(todos.filter(x=>ehTipo(x,'Corretiva'))), prev=_somaServ(todos.filter(x=>ehTipo(x,'Preventiva')));
  const corrN=todos.filter(x=>ehTipo(x,'Corretiva')).length, prevN=todos.filter(x=>ehTipo(x,'Preventiva')).length;
  const h=hoje();
  const mesTot=_somaServ(todos.filter(x=>{ const d=parseD(x.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }));
  const mesNome=h.toLocaleDateString('pt-BR',{month:'long'});
  const veics=DB.veiculos.filter(v=>v.status!=='Arquivado');
  const comGasto=veics.map(v=>({v,g:_somaServ(filtr.filter(x=>x.veiculoId===v.id))})).filter(x=>x.g>0).sort((a,b)=>b.g-a.g);
  const barras=comGasto.map(x=>({label:esc(x.v.placa.split('-')[0]),value:Math.round(x.g),vtxt:moneyK(x.g),color:isReb(x.v)?'#1fd4c4':'#2f8fff',js:`location.hash='#manutencao/${x.v.id}'`}));
  const fb=(k,l)=>`<button class="${manutFiltro===k?'active':''}" onclick="manutFiltro='${k}';router()">${l}</button>`;
  const pctCorr= total? Math.round(corr/total*100):0;
  const kpiF=(ico,cor,val,label,sub,filtro)=>`<a class="kpi link ${manutFiltro===filtro?'ativo':''}" style="cursor:pointer" onclick="manutFiltro='${filtro}';router()" data-tip="Filtrar por ${label}">
    <div class="k-top"><div class="k-ico ${cor}">${svg(ico)}</div><span class="k-go">→</span></div>
    <div class="k-val">${val}</div><div class="k-label">${label}</div>${sub?`<div class="k-sub">${sub}</div>`:''}</a>`;
  const foot=(v)=>{ const s=filtr.filter(x=>x.veiculoId===v.id); const g=_somaServ(s);
    const c=s.filter(x=>ehTipo(x,'Corretiva')).length, p=s.length-c;
    const mix=s.length?`<div class="mnt-mix" data-tip="${c} corretiva(s) · ${p} preventiva(s)"><i style="flex:${c||0.001}"></i><b style="flex:${p||0.001}"></b></div>`:'';
    return `<div class="mnt-cardfoot"><div class="r"><span class="st neutro">${s.length} serviço(s)</span><span class="mnt-cost ${g>0?'has':''}">${money(g)}</span></div>${mix}</div>`; };
  return `
  <div class="banner">${svg('wrench')}<div><b>Relatório de Manutenção</b><span>Controle operacional de reparos e serviços — cavalos e carretas separados por placa, com tipo (corretiva/preventiva), gastos e gráficos. As trocas de óleo ficam na aba "Trocas de Óleo".</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalServico()">${svg('plus')} Novo serviço</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kpiF('coins','i-blue',money(total),'Gasto total',todos.length+' lançamentos','todas')}
    ${kpiF('wrench','i-amber',money(corr),'Corretiva',corrN+' serviço(s)','corretiva')}
    ${kpiF('shield','i-green',money(prev),'Preventiva',prevN+' serviço(s)','preventiva')}
    ${kpi('cal','i-slate',money(mesTot),'Gasto no mês',mesNome)}
  </div>
  <div class="grid mnt-graphs" style="grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card"><div class="card-h">${svg('trend')}<h3 style="font-size:14px">Gasto por veículo</h3><span class="sub" style="margin-left:auto">azul = cavalos · verde = carretas · clique numa barra</span></div>
      <div class="card-b">${comGasto.length?barChart(barras,{h:180,w:460}):emptyState('Sem gastos lançados.')}</div></div>
    <div class="card"><div class="card-h">${svg('shield')}<h3 style="font-size:14px">Corretiva × Preventiva</h3></div>
      <div class="card-b mnt-donut">
        ${donut([{value:corr,color:'#f5a623',label:'Corretiva'},{value:prev,color:'#16c98d',label:'Preventiva'}],{center:pctCorr+'%',sub:'corretiva',size:150})}
        <div class="mnt-legend">
          <div class="lg"><span class="dot" style="background:#f5a623"></span>Corretiva<b>${money(corr)}</b></div>
          <div class="lg"><span class="dot" style="background:#16c98d"></span>Preventiva<b>${money(prev)}</b></div>
        </div>
      </div></div>
  </div>
  <div class="toolbar"><div class="seg no-print">${fb('todas','Todas')}${fb('corretiva','Corretiva')}${fb('preventiva','Preventiva')}</div>
    <div class="spacer"></div><div class="muted no-print">Clique em uma placa para ver a planilha de manutenção</div></div>
  ${vcardsSecoes('manutencao', foot)}`;
}
/* Detalhe: planilha de manutenção de UM veículo (aberta ao clicar na placa) */
function viewManutencaoVeiculo(id){
  const v=veiculo(id); if(!v) return emptyState('Veículo não encontrado.');
  const cavalo=v.tipo==='Cavalo'; const un=cavalo?'km':'h';
  const servs=_manutTodos().filter(x=>x.veiculoId===v.id).sort((a,b)=>(a.data||'').localeCompare(b.data||'')); /* antigos → novos (inclui trocas de óleo com valor) */
  const soma=_somaServ(servs);
  const corr=_somaServ(servs.filter(x=>(x.tipo||'Corretiva')==='Corretiva'));
  const prev=_somaServ(servs.filter(x=>x.tipo==='Preventiva'));
  const rows=servs.map(x=>{ const ab=x._oleoId?`modalManutencao('${x._oleoId}')`:`modalServico('${x.id}')`;
    return `<tr class="clickable" onclick="${ab}">
      <td class="mono">${fmtD(x.data)}</td>
      <td class="mono muted">${x.km!=null&&x.km!==''?num(x.km)+' '+un:'—'}</td>
      <td><b>${esc(x.descricao||'—')}</b>${x._oleoId?' <span class="st neutro" style="font-size:9.5px;padding:1px 6px">óleo</span>':''}${x.obs?`<div class="muted" style="font-size:11px">${esc(x.obs)}</div>`:''}</td>
      <td>${manutTipoTag(x.tipo)}</td>
      <td>${esc(x.oficina||'—')}</td>
      <td class="mono ta-r"><b>${money(x.valor)}</b></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();${ab}">${svg('edit')}</button></td>
    </tr>`; }).join('');
  const pctCorr= soma? Math.round(corr/soma*100):0;
  return `${detalheVeiculoHead(v, `<button class="btn primary" onclick="modalServico(null,'${v.id}')">${svg('plus')} Novo serviço</button>`)}
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin:4px 0 16px">
    ${kpi('coins','i-blue',money(soma),'Gasto total',servs.length+' serviços')}
    ${kpi('wrench','i-amber',money(corr),'Corretiva',pctCorr+'% do total')}
    ${kpi('shield','i-green',money(prev),'Preventiva',(100-pctCorr)+'% do total')}
  </div>
  <div class="card mnt-detail"><div class="card-h">${svg('wrench')}<h3 style="font-size:14px">Serviços de ${esc(v.placa)} (mais antigos primeiro)</h3><span class="sub" style="margin-left:auto">${servs.length} lançamento(s)</span></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl mnt-table">
      <thead><tr><th>Data</th><th>${cavalo?'KM':'Horas'}</th><th>Serviço</th><th>Tipo</th><th>Oficina</th><th class="ta-r">Valor</th><th class="no-print"></th></tr></thead>
      <tbody>${rows||`<tr><td colspan="7">${emptyState('Nenhum serviço registrado para este veículo.')}</td></tr>`}</tbody>
      ${servs.length?`<tfoot><tr class="mnt-total"><td colspan="5">Total geral — ${servs.length} serviço(s)</td><td class="mono ta-r"><b>${money(soma)}</b></td><td class="no-print"></td></tr></tfoot>`:''}
    </table></div></div></div>`;
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
function _plk(s){ return String(s||'').replace(/\W/g,'').toUpperCase(); }
/* Tabela de baterias — colunas: Data / Marca / Local da compra / Valor / Trocado na garantia / Garantia (meses) / Telefone / Obs */
function batTabela(bs){
  const rows=bs.map(b=>{ const g=b.garantiaAte?situacao(b.garantiaAte):null;
    return `<tr class="clickable" onclick="modalBateria('${b.id}')">
      <td class="mono">${fmtD(b.data)}</td>
      <td><b>${esc(b.marca||'—')}</b></td>
      <td>${esc(b.local||'—')}</td>
      <td class="mono">${money(b.valor)}</td>
      <td class="mono">${b.trocaGarantia?fmtD(b.trocaGarantia):'—'}</td>
      <td>${b.garantiaMeses?esc(b.garantiaMeses)+' meses':'—'}${b.garantiaAte?`<div class="muted" style="font-size:10.5px">até ${fmtD(b.garantiaAte)} ${g?`<span class="st ${g.cls}" style="font-size:9px;padding:0 5px">${g.label}</span>`:''}</div>`:''}</td>
      <td class="mono muted">${esc(b.telefone||'—')}</td>
      <td class="muted" style="font-size:12px">${esc(b.obs||'—')}</td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalBateria('${b.id}')">${svg('edit')}</button></td>
    </tr>`; }).join('');
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Data</th><th>Marca</th><th>Local da compra</th><th>Valor</th><th>Trocado na garantia</th><th>Garantia</th><th>Telefone</th><th>Obs</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="9">${emptyState('Nenhuma bateria.')}</td></tr>`}</tbody></table></div>`;
}
function batGrupoBloco(pl, bs){ const v=veiculoByPlaca(pl); const ord=bs.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  return `<div class="card"><div class="card-h">${plate(pl,(v||{}).tipo)}<span class="sub">${bs.length} bateria(s)</span></div>
    <div class="card-b p0">${batTabela(ord)}</div></div>`; }
function viewBaterias(){
  const total=DB.baterias.reduce((s,b)=>s+(Number(b.valor)||0),0);
  const emGarantia=DB.baterias.filter(b=>b.garantiaAte&&diasAte(b.garantiaAte)>=0).length;
  const foot=(v)=>{ const bs=DB.baterias.filter(b=>_plk(b.placa)===_plk(v.placa)); if(!bs.length) return '<span class="st neutro">sem bateria</span>';
    const ult=bs.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0]; const g=ult.garantiaAte?situacao(ult.garantiaAte):null;
    return `<span class="st neutro">${bs.length} bateria(s)</span>${g?`<span class="st ${g.cls}">${fmtD(ult.garantiaAte)}</span>`:''}`; };
  const ativos=new Set(DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>_plk(v.placa)));
  const orf={}; DB.baterias.forEach(b=>{ if(!ativos.has(_plk(b.placa))) (orf[b.placa]=orf[b.placa]||[]).push(b); });
  const orfBlocos=Object.keys(orf).sort().map(pl=>batGrupoBloco(pl,orf[pl])).join('');
  return `<div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      ${kpi('battery','i-blue',DB.baterias.length,'Baterias registradas','')}
      ${kpi('shield','i-green',emGarantia,'Dentro da garantia','')}
      ${kpi('export','i-amber',money(total),'Investimento total','')}</div>
    <div class="toolbar"><div class="muted no-print">Clique em uma placa para ver as baterias daquele veículo. A garantia aparece <b>só aqui</b> — não gera alerta no painel.</div>
      <div class="spacer"></div><button class="btn primary" onclick="modalBateria()">${svg('plus')} Nova bateria</button></div>
    ${vcardsSecoes('baterias', foot)}
    ${orfBlocos?`<div class="sectitulo" style="margin-top:22px">${svg('battery')} Outras placas (fora da frota atual)</div><div class="grid" style="gap:14px">${orfBlocos}</div>`:''}
    ${estoqueBateriasSecao()}`;
}
/* --- Baterias reservas (estoque, não instaladas em veículo) --- */
function estoqueBateriasSecao(){
  const eb=DB.estoqueBaterias.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const qt=eb.reduce((s,x)=>s+(parseInt(x.qtd)||1),0);
  const tot=eb.reduce((s,x)=>s+(Number(x.valor)||0)*(parseInt(x.qtd)||1),0);
  const rows=eb.map(x=>`<tr class="clickable" onclick="modalEstoqueBateria('${x.id}')">
    <td class="mono">${fmtD(x.data)}</td><td><b>${esc(x.marca||'—')}</b></td><td>${esc(x.local||'—')}</td>
    <td class="mono">${x.qtd||1}</td><td class="mono">${money(x.valor)}</td>
    <td class="muted" style="font-size:12px">${esc(x.obs||'—')}</td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalEstoqueBateria('${x.id}')">${svg('edit')}</button></td></tr>`).join('');
  return `<div class="sectitulo" style="margin-top:24px">${svg('battery')} Baterias reservas (estoque)</div>
    <div class="card"><div class="card-h">${svg('battery')}<h3 style="font-size:14px">Em estoque — ${qt} bateria(s) · ${money(tot)}</h3>
      <button class="btn sm no-print" style="margin-left:auto" onclick="modalEstoqueBateria()">${svg('plus')} Nova reserva</button></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Marca</th><th>Local da compra</th><th>Qtd</th><th>Valor</th><th>Obs</th><th class="no-print"></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="7">${emptyState('Nenhuma bateria reserva. Clique em "Nova reserva".')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalEstoqueBateria(id){
  const x=id?DB.estoqueBaterias.find(y=>y.id===id):{data:new Date().toISOString().slice(0,10),marca:'',local:'',valor:'',qtd:1,obs:''};
  openModal(`<div class="m-h">${svg('battery')}<h3>${id?'Editar bateria reserva':'Nova bateria reserva'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data da compra','f_data',x.data,'date')}${fld('Quantidade','f_qtd',x.qtd||1,'number')}</div>
      <div class="field-row">${fld('Marca / capacidade','f_marca',x.marca)}${fldR$('Valor (R$)','f_valor',x.valor)}</div>
      ${fld('Local da compra','f_local',x.local)}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(x.obs||'')}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirEstoqueBateria('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarEstoqueBateria('${id||''}')">Salvar</button></div>`);
}
function salvarEstoqueBateria(id){ let q=parseInt(val('f_qtd'))||1; if(q<1)q=1;
  const d={data:val('f_data'),marca:val('f_marca'),local:val('f_local'),valor:parseBRL(val('f_valor')),qtd:q,obs:val('f_obs')};
  if(id)Object.assign(DB.estoqueBaterias.find(y=>y.id===id),d); else{ d.id=uid('eb'); DB.estoqueBaterias.push(d); } saveDB(); closeModal(); toast('Bateria reserva salva.'); router(); }
function excluirEstoqueBateria(id){ if(!confirm('Excluir esta bateria reserva?'))return; DB.estoqueBaterias=DB.estoqueBaterias.filter(y=>y.id!==id); saveDB(); closeModal(); toast('Excluída.'); router(); }
/* Detalhe: baterias de UM veículo (aberto ao clicar na placa) */
function viewBateriasVeiculo(id){
  const v=veiculo(id); if(!v) return emptyState('Veículo não encontrado.');
  const bs=DB.baterias.filter(b=>_plk(b.placa)===_plk(v.placa)).sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const total=bs.reduce((s,b)=>s+(Number(b.valor)||0),0);
  return `${detalheVeiculoHead(v, `<button class="btn primary" onclick="modalBateria(null,'${esc(v.placa)}')">${svg('plus')} Nova bateria</button>`)}
  <div class="card"><div class="card-h">${svg('battery')}<h3 style="font-size:14px">Baterias de ${esc(v.placa)} — ${bs.length} · ${money(total)}</h3></div>
    <div class="card-b p0">${batTabela(bs)}</div></div>`;
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
  if(typeof pexBar==='function') pexBar(true);
  try{
    for(const file of files){ await subirUm(file, entidade, refId, categoria); }
    await reloadFiles(); saveDB(); toast(files.length+' arquivo(s) enviado(s)'+(_online()?' e sincronizado(s).':'.')); router();
  } finally { if(typeof pexBar==='function') pexBar(false); }
}
/* ================================================================== */
/*  LEITOR DE PDF — extrai texto de NF/DANFE (inclui fontes CID)        */
/*  Descompacta FlateDecode, lê o mapa ToUnicode e strings hex <..>.    */
/* ================================================================== */
async function _pexInflate(bytes){
  for(const fmt of ['deflate','deflate-raw']){
    try{ const ab=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt))).arrayBuffer(); return new Uint8Array(ab); }catch(e){}
  }
  return null;
}
function _pexStr(s){ return String(s).replace(/\\(\d{1,3})/g,(_,o)=>String.fromCharCode(parseInt(o,8))).replace(/\\([()\\])/g,'$1').replace(/\\[nrtbf]/g,' '); }
function _pexHexToStr(h){ let s=''; for(let i=0;i+4<=h.length;i+=4){ s+=String.fromCharCode(parseInt(h.substr(i,4),16)); } return s; }
/* Lê os mapas ToUnicode (código do glifo -> caractere real) */
function _pexParseCMap(c, uni){ let m;
  const reC=/beginbfchar([\s\S]*?)endbfchar/g;
  while((m=reC.exec(c))){ let mm; const reP=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g; while((mm=reP.exec(m[1]))){ uni[parseInt(mm[1],16)]=_pexHexToStr(mm[2]); } }
  const reR=/beginbfrange([\s\S]*?)endbfrange/g;
  while((m=reR.exec(c))){ let mm; const reP=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    while((mm=reP.exec(m[1]))){ const a=parseInt(mm[1],16),b=parseInt(mm[2],16),d=parseInt(mm[3],16);
      for(let cc=a; cc<=b && (cc-a)<3000; cc++) uni[cc]=String.fromCharCode(d+(cc-a)); } }
}
function _pexDecodeTok(tok, uni, twoByte){
  let codes=[];
  if(tok[0]==='('){ const s=_pexStr(tok.slice(1,-1)); for(let i=0;i<s.length;i++) codes.push(s.charCodeAt(i)); }
  else { const h=tok.replace(/[^0-9A-Fa-f]/g,''); const step=twoByte?4:2; for(let i=0;i+step<=h.length;i+=step) codes.push(parseInt(h.substr(i,step),16)); }
  let out=''; const has=uni._n>0;
  codes.forEach(code=>{ out += (has && uni[code]!=null)? uni[code] : String.fromCharCode(code); });
  return out;
}
function _pexExtractText(c, uni){
  let out=''; let m; const twoByte = uni._2b;
  /* Percorre strings mostradas e operadores de posicao (Td, TD, T-star, Tm) para separar palavras */
  const re=/(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>)\s*(?:Tj|')|(\[(?:[^\][]|\\.)*\])\s*TJ|(Td|TD|T\*|Tm)/g;
  while((m=re.exec(c))){
    if(m[1]){ out+=_pexDecodeTok(m[1],uni,twoByte); }
    else if(m[2]){ let mm; const reIn=/\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|(-?\d+\.?\d*)/g;
      while((mm=reIn.exec(m[2]))){ const t=mm[0]; if(t[0]==='('||t[0]==='<') out+=_pexDecodeTok(t,uni,twoByte); else if(parseFloat(t)<=-80) out+=' '; } }
    else if(m[3]){ out+=' '; }
  }
  return out;
}
async function pexLerPdfTexto(file){
  try{
    const buf=new Uint8Array(await file.arrayBuffer());
    let raw=''; for(let i=0;i<buf.length;i++) raw+=String.fromCharCode(buf[i]);
    const streams=[]; const reObj=/(\d+)\s+\d+\s+obj\b/g; let mo;
    while((mo=reObj.exec(raw))){
      const sIdx=raw.indexOf('stream', reObj.lastIndex); const eObj=raw.indexOf('endobj', reObj.lastIndex);
      if(sIdx<0 || (eObj>=0 && sIdx>eObj)) continue;
      const dict=raw.slice(mo.index, sIdx);
      let st=sIdx+6; if(raw[st]==='\r')st++; if(raw[st]==='\n')st++;
      const e=raw.indexOf('endstream', st); if(e<0) continue;
      let content=raw.slice(st, e);
      if(/DCTDecode|JPXDecode|CCITTFax/.test(dict)) continue;
      if(/FlateDecode/.test(dict)){
        const b=new Uint8Array(content.length); for(let i=0;i<content.length;i++) b[i]=content.charCodeAt(i)&0xff;
        const inf=await _pexInflate(b); if(!inf) continue;
        content=''; for(let i=0;i<inf.length;i++) content+=String.fromCharCode(inf[i]);
      }
      streams.push(content);
    }
    const uni={}; streams.forEach(c=>{ if(/beginbf(char|range)/.test(c)) _pexParseCMap(c,uni); });
    let n=0,two=false; for(const k in uni){ n++; if(+k>255) two=true; } uni._n=n; uni._2b=two;
    let out=''; streams.forEach(c=>{ if(/(Tj|TJ)/.test(c) && !/beginbf(char|range)/.test(c)) out += _pexExtractText(c,uni)+'\n'; });
    return out.replace(/\s+/g,String.fromCharCode(32)).trim();
  }catch(e){ return ''; }
}
function _brNum(s){ if(s==null)return null; s=String(s).replace(/[^\d.,]/g,''); if(!s)return null;
  if(/,\d{1,3}$/.test(s)){ s=s.replace(/\./g,'').replace(',','.'); } else if(/\.\d{3}(\.|$)/.test(s)){ s=s.replace(/\./g,''); } else { s=s.replace(',','.'); }
  const n=parseFloat(s); return isNaN(n)?null:n; }
function _pexData(txt, re){ const m=String(txt).match(re||/(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})/); if(!m) return '';
  let y=m[3]; if(y.length===2) y='20'+y; return y+'-'+m[2]+'-'+m[1]; }
/* Decodifica a chave de 44 dígitos da NFe (do nome do arquivo): ano-mês, CNPJ */
function _pexChaveInfo(nome){ const m=String(nome||'').match(/(\d{44})/); if(!m) return {};
  const k=m[1]; return { chave:k, anoMes:'20'+k.slice(2,4)+'-'+k.slice(4,6), cnpjEmit:k.slice(6,20) }; }
/* Extrai dados de uma NF de abastecimento (adapta-se a vários formatos) */
function extrairAbastecimento(txt, nomeArquivo){
  const raw=String(txt); const T=' '+raw.toUpperCase().replace(/\s+/g,' ')+' ';
  const pick=(re)=>{ const m=T.match(re); return m?_brNum(m[1]):null; };
  const chave=_pexChaveInfo(nomeArquivo);
  /* LITROS: perto de combustível ou marcado como quantidade/UN/LT */
  let litros = pick(/(?:DIESEL|ARLA|GASOLINA|ETANOL|ALCOOL|\bS-?10\b|\bS-?500\b|COMBUST[IÍ]VEL)[^\d]{0,60}?([\d]{1,4}[.,]\d{2,3})\s*(?:UN|LT|L\b|LITRO)?/)
             || pick(/(?:QTDE?\.?|QUANT[.\s]*(?:COM|COMERCIAL)?|VOL\.?|LITROS?)[^\d]{0,12}([\d]{1,4}[.,]\d{2,3})/)
             || pick(/([\d]{1,4}[.,]\d{2,3})\s*(?:UN|LT|LTS|LITROS?)\b/);
  /* VALOR TOTAL da nota */
  let valor  = pick(/VALOR\s*TOTAL\s*DA\s*NOTA[^\d]{0,10}([\d.]{1,12},\d{2})/)
             || pick(/(?:V(?:ALOR|L)\.?\s*TOTAL|TOTAL\s*(?:DA\s*NOTA|GERAL|A\s*PAGAR|R\$))[^\d]{0,10}([\d.]{1,12},\d{2})/)
             || pick(/VLR?\.?\s*L[IÍ]QUIDO[^\d]{0,10}([\d.]{1,12},\d{2})/);
  /* KM / hodômetro (costuma vir nos dados adicionais) */
  let km     = pick(/(?:KM|HOD[OÔ]METRO|OD[OÔ]METRO|KILOMETRAGEM|HORIMETRO|HOR[IÍ]METRO)[^\d]{0,10}([\d.]{2,10})/);
  /* PLACA */
  let placa  = (T.match(/PLACA[^A-Z0-9]{0,6}([A-Z]{3}[- ]?\d[A-Z0-9]\d{2})/)||[])[1]
             || (T.match(/\b([A-Z]{3}[- ]?\d[A-Z0-9]\d{2})\b/)||[])[1] || '';
  /* DATA de emissão (senão, deixa vazio p/ hoje) */
  let data   = _pexData(raw, /(?:EMISS[ÃA]O|DT\.?\s*EMISS|DATA)[^\d]{0,12}(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/i) || _pexData(raw);
  const posto = (raw.match(/((?:AUTO\s*)?POSTO[^\n,;|]{2,44})/i)||[])[1] || '';
  return { litros, valor, km:(km!=null?Math.round(km):null), placa:(placa||'').toUpperCase().replace(/\s/g,'-'), data, posto:posto.trim(), chave:chave.chave||'' };
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
  try{ const b=_localBlob(id); if(b) return {url:URL.createObjectURL(b), local:true}; }catch(e){}
  const a=(DB.anexos||[]).find(x=>x.id===id);
  if(a && a.storagePath && typeof nuvemUrlArquivo==='function'){ try{ const u=await nuvemUrlArquivo(a.storagePath); if(u) return {url:u, local:false}; }catch(e){} }
  return null;
}
/* mensagem clara quando um arquivo enviado não está acessível aqui */
function _msgArquivoIndisp(id){
  const a=(DB.anexos||[]).find(x=>x.id===id);
  if(a) return 'Este arquivo foi enviado em outro aparelho e ainda não sincronizou. Entre na sua conta (nuvem) para vê-lo em qualquer lugar, ou reenvie-o aqui.';
  return 'Não consegui abrir este arquivo. Tente reenviá-lo pelo botão "Enviar arquivo".';
}
async function verArquivo(id){ let r; try{ r=await _urlArquivo(id); }catch(e){ r=null; }
  if(!r){ toast(_msgArquivoIndisp(id),'err'); return; }
  window.open(r.url,'_blank'); if(r.local) setTimeout(()=>URL.revokeObjectURL(r.url),20000); }
async function baixarArquivo(id){ let r; try{ r=await _urlArquivo(id); }catch(e){ r=null; }
  if(!r){ toast(_msgArquivoIndisp(id),'err'); return; }
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

      ${msec('Saúde')}
      <div class="field"><label>Problemas de saúde</label><textarea id="f_saude" rows="2" placeholder="Identifique aqui qualquer problema de saúde: hipertensão, diabetes, alergias, uso de medicação, restrições…">${esc(m.problemasSaude||'')}</textarea></div>

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
    cargo:val('f_cargo'),admissao:val('f_adm'),ctps:val('f_ctps'),pis:val('f_pis'),funcao:val('f_func'),socio:document.getElementById('f_socio').checked,problemasSaude:val('f_saude'),
    categoria:val('f_cat'),cnh:val('f_cnhn'),primeiraHab:val('f_prim'),emissaoCnh:val('f_emis'),cnhValidade:val('f_cnh'),ear:val('f_ear'),cnhUf:val('f_cnhuf'),cnhMunicipio:val('f_cnhmun'),renach:val('f_renach'),espelho:val('f_esp'),
    rntrc:val('f_rntrc'),rntrcSituacao:val('f_rntrcsit'),rntrcCadastro:val('f_rntrccad'),rntrcValidade:val('f_rntrcval'),
    cep:maskCEP(val('f_cep')),logradouro:val('f_log'),numero:val('f_num'),complemento:val('f_comp'),bairro:val('f_bairro'),ufEnd:val('f_ufend'),municipioEnd:val('f_munend'),foto:val('f_foto')};
  d.endereco=[d.logradouro, d.numero].filter(Boolean).join(', ')+(d.bairro?' — '+d.bairro:'')+(d.municipioEnd?', '+d.municipioEnd+(d.ufEnd?'/'+d.ufEnd:''):'');
  if(d.endereco===', ') d.endereco='';
  if(id){ Object.assign(motorista(id),d); const cv=DB.vencimentos.find(v=>v.tipo==='CNH'&&v.refId===id); if(cv){ if(d.cnhValidade)cv.validade=d.cnhValidade; if(d.cnh)cv.numero=d.cnh; } }
  else{ d.id=uid('m'); DB.motoristas.push(d); if(d.cnhValidade)DB.vencimentos.push({id:uid('c'),tipo:'CNH',entidade:'motorista',refId:d.id,emissao:d.emissaoCnh||'',validade:d.cnhValidade,numero:d.cnh||'',orgao:'',obs:'Categoria '+d.categoria}); }
  saveDB(); closeModal(); toast('Condutor salvo.'); router();
}
async function excluirMotorista(id){
  const m=motorista(id);
  if(!confirm('Excluir '+(m?m.nome:'este motorista')+' e TODOS os documentos dele (CNH, ASO, exames, toxicológico, Opentech, direção defensiva, comprovantes e arquivos anexados)?\n\nEsta ação não pode ser desfeita.')) return;
  // 1) vencimentos/documentos (CNH, ASO, Toxicológico, Opentech, Direção Defensiva...)
  DB.vencimentos=DB.vencimentos.filter(v=>!(v.entidade==='motorista'&&v.refId===id));
  // 2) arquivos ANEXADOS (enviados) — local (IndexedDB) + nuvem (Storage/DB.anexos)
  try{ const enviados=(typeof todosArquivos==='function'?todosArquivos():[]).filter(f=>f.entidade==='motorista'&&f.refId===id);
    for(const f of enviados){ try{ await _removerAnexoSilencioso(f.id); }catch(e){} } }catch(e){}
  // 3) arquivos REGISTRADOS da pasta (DB.arquivos) do motorista
  DB.arquivos=(DB.arquivos||[]).filter(f=>!(f.entidade==='motorista'&&f.refId===id));
  // 4) o motorista
  DB.motoristas=DB.motoristas.filter(x=>x.id!==id);
  try{ if(typeof reloadFiles==='function') await reloadFiles(); }catch(e){}
  saveDB(); closeModal(); toast('Motorista e todos os documentos excluídos.'); location.hash='motoristas'; router();
}

function _vehToggleTipo(){ const reb=/reboque/i.test(val('f_tipo'));
  const c=document.getElementById('cavaloFields'), r=document.getElementById('carretaFields');
  if(c) c.style.display=reb?'none':''; if(r) r.style.display=reb?'':'none'; }
function modalVeiculo(id){
  const v=id?veiculo(id):{placa:'',tipo:'Cavalo',marca:'',modelo:'',chassi:'',renavam:'',anoModelo:'',crlvAno:'',cor:'',status:'Ativo',kmAtual:'',horaAtual:'',
    potencia:'',modeloMotor:'',cambio:'',modeloEquip:'',dimInternas:'',divisoria:'',travaPalletQtd:'',travaPalletModelo:''};
  const reb=/reboque/i.test(v.tipo);
  const tipoSel=`<div class="field"><label>Tipo</label><select id="f_tipo" onchange="_vehToggleTipo()">${['Cavalo','Reboque Frigorífico','Reboque','Truck','Utilitário'].map(o=>`<option ${o===v.tipo?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  openModal(`<div class="m-h">${svg('truck')}<h3>${id?'Editar veículo':'Novo veículo'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Placa','f_placa',v.placa)}${tipoSel}</div>
      <div class="field-row">${fld('Marca','f_marca',v.marca)}${fld('Modelo','f_modelo',v.modelo)}</div>
      <div class="field-row">${fld('Renavam','f_renavam',v.renavam)}${fld('Ano/Modelo','f_ano',v.anoModelo)}</div>
      <div class="field-row">${fld('Chassi','f_chassi',v.chassi)}${fld('CRLV (ano)','f_crlv',v.crlvAno)}</div>
      <div class="field-row">${fld('Cor','f_cor',v.cor)}${sel('Situação','f_vstatus',v.status,['Ativo','Manutenção','Arquivado','Vendido'])}</div>
      <div class="field-row">${fld('KM atual (cavalo)','f_km',v.kmAtual,'number')}${fld('Horas atuais (carreta)','f_hora',v.horaAtual,'number')}</div>
      <div id="cavaloFields" style="display:${reb?'none':''}">
        <div class="sectitulo" style="margin:8px 0 10px">${svg('truck')} Dados do cavalo</div>
        <div class="field-row">${fld('Potência (cv)','f_pot',v.potencia,'text','Ex.: 440')}${fld('Modelo do motor','f_motor',v.modeloMotor,'text','Ex.: Volvo D13')}</div>
        ${sel('Câmbio','f_cambio',v.cambio||'',['','Manual','Automatizado','Automático'])}
      </div>
      <div id="carretaFields" style="display:${reb?'':'none'}">
        <div class="sectitulo" style="margin:8px 0 10px">${svg('truck')} Dados da carreta / equipamento</div>
        ${fld('Modelo do equipamento (refrigeração)','f_equip',v.modeloEquip,'text','Ex.: Thermo King SLXe')}
        ${fld('Dimensões internas','f_dim',v.dimInternas,'text','Ex.: 13,60 × 2,45 × 2,60 m')}
        <div class="field-row">${sel('Divisória interna com ventilador','f_divis',v.divisoria||'',['','Não','Sim'])}${fld('Nº de trava-pallets','f_tpqtd',v.travaPalletQtd,'number')}</div>
        ${fld('Modelo do trava-pallets','f_tpmod',v.travaPalletModelo,'text','Ex.: Marfinite / MacroPlast')}
      </div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirVeiculo('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarVeiculo('${id||''}')">Salvar</button></div>`);
}
function salvarVeiculo(id){ if(!val('f_placa')){toast('Informe a placa.','err');return;}
  const km=val('f_km'), hora=val('f_hora');
  const d={placa:val('f_placa').toUpperCase(),tipo:val('f_tipo'),marca:val('f_marca'),modelo:val('f_modelo'),renavam:val('f_renavam'),anoModelo:val('f_ano'),chassi:val('f_chassi').toUpperCase(),crlvAno:val('f_crlv'),cor:val('f_cor'),status:val('f_vstatus'),kmAtual:km===''?null:+km,horaAtual:hora===''?null:+hora,
    potencia:val('f_pot'),modeloMotor:val('f_motor'),cambio:val('f_cambio'),
    modeloEquip:val('f_equip'),dimInternas:val('f_dim'),divisoria:val('f_divis'),travaPalletQtd:val('f_tpqtd'),travaPalletModelo:val('f_tpmod')};
  if(id)Object.assign(veiculo(id),d); else{ d.id=uid('v'); DB.veiculos.push(d); }
  saveDB(); closeModal(); toast('Veículo salvo.'); router();
}
function excluirVeiculo(id){ if(!confirm('Excluir este veículo e seus vencimentos/manutenções?'))return; DB.veiculos=DB.veiculos.filter(v=>v.id!==id); DB.vencimentos=DB.vencimentos.filter(v=>!(v.entidade==='veiculo'&&v.refId===id)); DB.manutencoes=DB.manutencoes.filter(m=>m.veiculoId!==id); saveDB(); closeModal(); toast('Veículo excluído.'); location.hash='frota'; router(); }

const TIPOS_VENC=['CNH','Toxicológico','ASO','Direção Defensiva','Tacógrafo','CRLV','Vigilância Sanitária','Opentech Funcionário','Opentech Veículo','PCMSO','PGR','Certificado Digital','Seguro','Rastreador','Outro'];
function modalVencimento(id, entidadeFix, refFix, tipoFix){
  if(id && String(id).indexOf('seg_')===0){ return modalSeguro(String(id).slice(4)); }  // apólice de seguro → abre a ficha do seguro
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

/* ================================================================== */
/*  IMPORTAR PLANILHA — puxa validades de um Excel/CSV automaticamente */
/* ================================================================== */
window._impRows = [];
/* normaliza uma data para ISO (AAAA-MM-DD); aceita ISO, dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa */
function _impISO(s){
  s=String(s==null?'':s).trim(); if(!s) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if(m){ let d=+m[1], mo=+m[2], y=m[3]; if(y.length===2) y='20'+y; y=+y;
    if(mo>=1&&mo<=12&&d>=1&&d<=31&&y>=1900&&y<=2100)
      return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  return '';
}
/* resolve o registro (motorista/veículo) a partir do texto lido */
function _impRef(vinculo, chave){
  if(vinculo==='empresa') return 'empresa';
  if(vinculo==='veiculo'){ const v=(typeof _iaVeiculo==='function'?_iaVeiculo(chave):null)||veiculoByPlaca(chave); return v?v.id:''; }
  const m=(typeof _iaMotorista==='function')?_iaMotorista(chave):DB.motoristas.find(x=>_impNorm(x.nome)===_impNorm(chave));
  return m?m.id:'';
}
function _impNorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),'').trim(); }
/* já existe um vencimento igual? (mesmo tipo, vínculo, registro e validade) */
function _impDupe(r){ return DB.vencimentos.some(v=>v.entidade===r.vinculo && String(v.refId)===String(r.refId) && v.tipo===r.tipo && v.validade===r.validade); }
/* recalcula a situação de uma linha lida */
function _impStatus(r){
  if(!r.validade) return 'invalida';
  if(!r.refId) return 'falta';
  if(_impDupe(r)) return 'dupe';
  return DB.vencimentos.some(v=>v.entidade===r.vinculo && String(v.refId)===String(r.refId) && v.tipo===r.tipo) ? 'atualiza' : 'novo';
}

function modalImportar(){
  const suporta = !window.PEXImport || PEXImport.suportaXLSX();
  openModal(`<div class="m-h">${svg('upload')}<h3>Importar planilha</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="banner" style="margin:0 0 14px">${svg('bell')}<div><b>Traga as validades de uma planilha</b><span>Escolha um arquivo do Excel (.xlsx) ou CSV. O sistema lê as colunas de <b>Data</b>, <b>nome/placa</b> e <b>Validade</b> e monta os vencimentos sozinho. Depois é só conferir e confirmar.</span></div></div>
      ${suporta?'':`<div class="hint" style="color:var(--danger)">Este navegador não abre .xlsx direto — use o Chrome ou o Edge, ou salve a planilha como CSV.</div>`}
      <div class="field">
        <label>Arquivo (Excel ou CSV)</label>
        <label class="btn">${svg('upload')} Escolher planilha…<input type="file" accept=".xlsx,.csv,.txt" onchange="importarLerArquivo(this)" style="display:none"></label>
        <span id="impNome" class="muted" style="font-size:12.5px;margin-left:8px">Nenhum arquivo escolhido</span>
      </div>
      <div id="impPreview"></div>
    </div>
    <div class="m-f">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" id="impBtn" style="display:none" onclick="importarConfirmar()">Importar selecionados</button>
    </div>`, true);
  window._impRows=[];
}

async function importarLerArquivo(input){
  const file=input.files&&input.files[0]; if(!file) return;
  const nomeEl=document.getElementById('impNome'); if(nomeEl) nomeEl.textContent=file.name;
  const prev=document.getElementById('impPreview');
  prev.innerHTML=`<div class="muted" style="padding:14px 2px">${svg('gauge')} Lendo a planilha…</div>`;
  try{
    const {sheets}=await PEXImport.lerArquivo(file);
    let itens=[];
    sheets.forEach(sh=>{ PEXImport.detectarVencimentos(sh.grid).forEach(it=>itens.push(it)); });
    _impRows = itens.map(it=>{
      const r={ tipo:it.tipo, vinculo:it.vinculo, chave:it.chave||'', emissao:_impISO(it.emissao), validade:_impISO(it.validade), origemValid:it.validade };
      r.refId=_impRef(r.vinculo, r.chave);
      r.status=_impStatus(r);
      r.incluir=(r.status==='novo'||r.status==='atualiza');
      return r;
    });
    importarRender();
  }catch(e){
    prev.innerHTML=`<div class="hint" style="color:var(--danger)">Não consegui ler: ${esc(e.message||e)}</div>`;
    const b=document.getElementById('impBtn'); if(b) b.style.display='none';
  }
}

function importarRender(){
  const prev=document.getElementById('impPreview'), btn=document.getElementById('impBtn');
  if(!_impRows.length){
    prev.innerHTML=`<div class="hint">Não encontrei uma tabela de validades nesta planilha. O ideal é ter colunas com títulos <b>Data</b>, <b>Colaborador</b> ou <b>Placa</b>, e <b>Validade</b>, com um título de tipo acima (ex.: "Toxicológico", "CRLV"). Você também pode cadastrar manualmente pelo botão <b>Novo</b>.</div>`;
    if(btn) btn.style.display='none'; return;
  }
  const badge={novo:'<span class="st ok">Novo</span>',atualiza:'<span class="st warn">Atualiza</span>',
    dupe:'<span class="st neutro">Já existe</span>',falta:'<span class="st crit">Sem vínculo</span>',invalida:'<span class="st crit">Sem data válida</span>'};
  const alvoSel=(r,i)=>{
    if(r.vinculo==='empresa') return `<span class="muted">${esc(DB.empresa.nome)}</span>`;
    const lista = r.vinculo==='veiculo'
      ? DB.veiculos.map(v=>`<option value="${v.id}" ${r.refId===v.id?'selected':''}>${esc(v.placa)}</option>`).join('')
      : DB.motoristas.map(m=>`<option value="${m.id}" ${r.refId===m.id?'selected':''}>${esc(m.nome)}</option>`).join('');
    return `<select class="selectlite" onchange="importarSetRef(${i},this.value)"><option value="">— escolher (${esc(r.chave||'?')}) —</option>${lista}</select>`;
  };
  const linhas=_impRows.map((r,i)=>`<tr class="${r.incluir?'':'imp-off'}">
    <td class="no-print" style="text-align:center"><input type="checkbox" ${r.incluir?'checked':''} ${(r.status==='invalida')?'disabled':''} onchange="importarToggle(${i},this.checked)"></td>
    <td><b>${esc(r.tipo)}</b></td>
    <td>${alvoSel(r,i)}<div class="muted" style="font-size:11px">${r.vinculo==='veiculo'?'Veículo':(r.vinculo==='motorista'?'Motorista':'Empresa')}</div></td>
    <td class="mono">${r.validade?fmtD(r.validade):`<span class="muted">${esc(r.origemValid||'—')}</span>`}</td>
    <td>${r.validade?stBadge(r.validade):''} ${badge[r.status]||''}</td>
  </tr>`).join('');
  const nSel=_impRows.filter(r=>r.incluir).length;
  const cont={};_impRows.forEach(r=>cont[r.status]=(cont[r.status]||0)+1);
  const resumo=[cont.novo?cont.novo+' novo(s)':'',cont.atualiza?cont.atualiza+' p/ atualizar':'',cont.dupe?cont.dupe+' já existe(m)':'',cont.falta?cont.falta+' sem vínculo':'',cont.invalida?cont.invalida+' sem data':''].filter(Boolean).join(' · ');
  prev.innerHTML=`<div class="muted" style="margin:6px 0 8px;font-size:12.5px">Encontrei <b>${_impRows.length}</b> registro(s). ${resumo?'('+resumo+')':''}</div>
    <div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="tbl">
      <thead><tr><th class="no-print" style="width:34px"></th><th>Tipo</th><th>Vinculado a</th><th>Validade</th><th>Situação</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  if(btn){ btn.style.display=''; btn.textContent=nSel?('Importar '+nSel+' selecionado(s)'):'Nada selecionado'; btn.disabled=!nSel; }
}
function importarSetRef(i,v){ const r=_impRows[i]; if(!r) return; r.refId=v; r.status=_impStatus(r); if(r.status==='invalida') r.incluir=false; else if(r.refId&&(r.status==='novo'||r.status==='atualiza')) r.incluir=true; importarRender(); }
function importarToggle(i,on){ if(_impRows[i]) _impRows[i].incluir=!!on; const nSel=_impRows.filter(r=>r.incluir).length; const b=document.getElementById('impBtn'); if(b){ b.textContent=nSel?('Importar '+nSel+' selecionado(s)'):'Nada selecionado'; b.disabled=!nSel; } }

function importarConfirmar(){
  let novos=0, atualizados=0, pulados=0;
  _impRows.forEach(r=>{
    if(!r.incluir) return;
    if(!r.validade || (r.vinculo!=='empresa' && !r.refId)){ pulados++; return; }
    const existente=DB.vencimentos.find(v=>v.entidade===r.vinculo && String(v.refId)===String(r.refId) && v.tipo===r.tipo);
    if(existente){
      if(existente.validade===r.validade){ pulados++; return; } // idêntico, ignora
      existente.validade=r.validade; if(r.emissao) existente.emissao=r.emissao;
      existente.obs=(existente.obs?existente.obs+' · ':'')+'atualizado por planilha'; atualizados++;
    } else {
      DB.vencimentos.push({ id:uid('vc'), tipo:r.tipo, entidade:r.vinculo, refId:r.refId, emissao:r.emissao||'', validade:r.validade, numero:'', orgao:'', obs:'importado de planilha', anexoId:'' });
      novos++;
    }
  });
  saveDB(); closeModal();
  toast('Importado: '+novos+' novo(s), '+atualizados+' atualizado(s)'+(pulados?', '+pulados+' ignorado(s)':'')+'.');
  vencFiltro='todos'; vencTipo='todos'; if(location.hash.slice(1).split('/')[0]!=='vencimentos') location.hash='vencimentos'; router();
}

function modalBateria(id, placa){
  const b=id?DB.baterias.find(x=>x.id===id):{data:'',placa:placa||(DB.veiculos[0]||{}).placa||'',marca:'',local:'',valor:'',garantiaMeses:12,garantiaAte:'',trocaGarantia:'',telefone:'',obs:''};
  const placas=DB.veiculos.map(v=>v.placa); if(b.placa && placas.indexOf(b.placa)<0) placas.push(b.placa);  // inclui placa fora da frota
  openModal(`<div class="m-h">${svg('battery')}<h3>${id?'Editar bateria':'Nova bateria'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data da compra','f_data',b.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${placas.map(pl=>`<option ${b.placa===pl?'selected':''}>${esc(pl)}</option>`).join('')}</select></div></div>
      <div class="field-row">${fld('Marca / capacidade','f_marca',b.marca)}${fldR$('Valor (R$)','f_valor',b.valor)}</div>
      ${fld('Local de compra','f_local',b.local)}
      <div class="field-row">${fld('Garantia (meses)','f_gm',b.garantiaMeses,'number')}${fld('Garantia até','f_ga',b.garantiaAte,'date')}</div>
      <div class="field-row">${fld('Trocado na garantia (data)','f_tg',b.trocaGarantia,'date','Preencha só se a bateria foi trocada dentro da garantia')}${fldMask('Telefone do fornecedor','f_tel',b.telefone,'fone','(  ) automático')}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(b.obs||'')}"></div>
</div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirBateria('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarBateria('${id||''}')">Salvar</button></div>`);
}
function salvarBateria(id){ const d={data:val('f_data'),placa:val('f_placa'),marca:val('f_marca'),local:val('f_local'),valor:parseBRL(val('f_valor')),garantiaMeses:parseInt(val('f_gm'))||12,garantiaAte:val('f_ga'),trocaGarantia:val('f_tg'),telefone:maskFone(val('f_tel')),obs:val('f_obs')};
  if(id)Object.assign(DB.baterias.find(x=>x.id===id),d); else{ d.id=uid('b'); DB.baterias.push(d); } saveDB(); closeModal(); toast('Bateria salva.'); router(); }
function excluirBateria(id){ if(!confirm('Excluir esta bateria?'))return; DB.baterias=DB.baterias.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluída.'); router(); }

function modalManutencao(id,vId){
  const m=id?DB.manutencoes.find(x=>x.id===id):{veiculoId:vId||(DB.veiculos[0]||{}).id,item:'',data:'',intervalo:'',kmTroca:'',proxKm:'',horasTroca:'',proxHoras:'',valor:'',oficina:''};
  openModal(`<div class="m-h">${svg('wrench')}<h3>${id?'Editar manutenção':'Novo registro'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${m.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.marca)} ${esc(v.modelo)}</option>`).join('')}</select></div>
      <div class="field-row">${fld('Item / serviço','f_item',m.item)}${fld('Intervalo','f_int',m.intervalo,'text','Ex.: 20.000 km / 1.000 h')}</div>
      <div class="field-row">${fld('Data da última troca','f_data',m.data,'date')}${fldR$('Valor da troca (R$)','f_valor',m.valor)}</div>
      ${fld('Oficina / local','f_ofi',m.oficina)}
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
  const d={veiculoId:val('f_veic'),item:val('f_item'),intervalo:val('f_int'),data:val('f_data'),kmTroca:numOrNull('f_km'),proxKm:numOrNull('f_pkm'),horasTroca:numOrNull('f_h'),proxHoras:numOrNull('f_ph'),valor:parseBRL(val('f_valor')),oficina:val('f_ofi')};
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
let alarmeCat='todos';
/* categoriza um alarme pela descrição → {key,label,ico,cor} (1ª regra que casa vence) */
const ALARME_CATS=[
  {key:'controle', label:'Controlador', ico:'chip',    cor:'#b18cff', re:/micro|processad|controlad|display|hmi|memoria|reset|software|comunica|\bplaca\b|rele|relay|cpu|firmware/},
  {key:'energia',  label:'Energia',     ico:'battery', cor:'#ffc061', re:/bateria|batter|voltag|tensao|\bvolt|alternador|\bcarga|energia|fusivel|corrente|amper/},
  {key:'sensor',   label:'Sensor',      ico:'gauge',   cor:'#00e5ff', re:/sensor|bobina|termistor|sonda|leitura|probe/},
  {key:'temp',     label:'Temperatura', ico:'alarm',   cor:'#ff9d5c', re:/temp|ambient|degelo|defrost|aquec|\bfrio|quente|setpoint|set\s*point|calor/},
  {key:'motor',    label:'Motor / Refrigeração', ico:'wrench', cor:'#ff6b6b', re:/motor|engine|\brpm|rota[çc]|oleo|\boil|arrefec|radiador|combust|fuel|diesel|pressao|compressor|\bgas|refriger|condensad|evaporad|correia|ventilad|damper/},
];
function _alarmeCat(a){
  const t=_dnorm((a.d||'')+' '+(a.ex||''));
  for(const c of ALARME_CATS){ if(c.re.test(t)) return c; }
  return {key:'geral', label:'Geral', ico:'alarm', cor:'#7fe0ff'};
}
function _alarmesFiltrados(){
  const q=_dnorm(alarmeBusca);
  return (typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]).filter(a=>{
    if(alarmeCat!=='todos' && _alarmeCat(a).key!==alarmeCat) return false;
    if(!q) return true;
    return _dnorm(a.c).includes(q) || _dnorm(a.d).includes(q) || _dnorm(a.ex||'').includes(q);
  });
}
function viewAlarmes(){
  const todos=(typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]);
  const lista=_alarmesFiltrados();
  // contagem por categoria (para os chips de filtro)
  const cont={}; todos.forEach(a=>{ const k=_alarmeCat(a).key; cont[k]=(cont[k]||0)+1; });
  const chip=(key,label,cor)=>`<button class="alm-chip ${alarmeCat===key?'on':''}" style="--ac:${cor}" onclick="alarmeCat='${key}';renderAlarmesList();alarmeSyncChips()">
    ${key!=='todos'?`<i class="alm-chip-dot"></i>`:''}${label}<b>${key==='todos'?todos.length:(cont[key]||0)}</b></button>`;
  const chips=`<button class="alm-chip ${alarmeCat==='todos'?'on':''}" style="--ac:#00e5ff" onclick="alarmeCat='todos';renderAlarmesList();alarmeSyncChips()">Todos<b>${todos.length}</b></button>`
    + ALARME_CATS.map(c=>chip(c.key,c.label,c.cor)).join('');
  return `
  <div class="banner">${svg('alarm')}<div><b>Tabela de Alarmes Thermo King</b><span>Referência dos códigos das unidades SB III / Super II / 190 / 210 / 210+ / 310 / 310+ / 400. Digite o número que aparece no visor para encontrar o significado.</span></div></div>
  <div class="alm-tools no-print">
    <div class="alm-search">${svg('search')}<input id="alarmeSearch" placeholder="Buscar código, descrição ou peça… (ex.: 61, bateria, sensor)" value="${esc(alarmeBusca)}" oninput="alarmeBusca=this.value;renderAlarmesList()"></div>
    <div id="almChips" class="alm-chips">${chips}</div>
  </div>
  <div class="alm-count no-print muted" id="almCount">${lista.length} de ${todos.length} códigos</div>
  <div id="alarmeList" class="alm-grid">${alarmeCards(lista)}</div>`;
}
function alarmeCards(lista){
  if(!lista.length) return `<div style="grid-column:1/-1">${emptyState('Nenhum código encontrado para essa busca.')}</div>`;
  return lista.map((a,i)=>{ const cat=_alarmeCat(a);
    return `<button class="alm-card" style="--ac:${cat.cor};animation-delay:${Math.min(i,18)*22}ms" onclick="modalAlarme('${esc(a.c)}')" title="Ver o que significa e o que fazer">
      <span class="alm-ico">${svg(cat.ico)}</span>
      <span class="alm-code">${esc(a.c)}</span>
      <span class="alm-main"><span class="alm-desc">${esc(a.d)}</span><span class="alm-cat">${esc(cat.label)}</span></span>
      <span class="alm-go">${svg('chevron')}</span>
    </button>`;
  }).join('');
}
function renderAlarmesList(){
  const el=document.getElementById('alarmeList'); if(el) el.innerHTML=alarmeCards(_alarmesFiltrados());
  const c=document.getElementById('almCount'); if(c){ const tot=(typeof ALARMES_TK!=='undefined'?ALARMES_TK.length:0); c.textContent=_alarmesFiltrados().length+' de '+tot+' códigos'; }
}
function alarmeSyncChips(){ const box=document.getElementById('almChips'); if(!box) return;
  box.querySelectorAll('.alm-chip').forEach(b=>{ const on=/alarmeCat='([^']+)'/.exec(b.getAttribute('onclick')); b.classList.toggle('on', on&&on[1]===alarmeCat); }); }

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
    <td class="no-print" onclick="event.stopPropagation()">${badgeAnexo('nota',n.id,/nota|nf|fiscal|\.pdf/i,'Nota Fiscal')}</td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalNota('${n.id}')">${svg('edit')}</button></td></tr>`).join('');
  const AZ='#4a90d9', LA='#e0812f', CZ='#a6a6a6';
  const pizza = ultimo? [
    {label:'Alexandria', value:Number(ultimo.alexandria)||0, color:AZ},
    {label:'Notas em geral', value:Number(ultimo.notasGerais)||0, color:LA},
    {label:'Combustível', value:Number(ultimo.combustivel)||0, color:CZ}
  ]:[];
  return `
  <div class="banner">${svg('money')}<div><b>Notas de Despesa</b><span>Envie a NF em PDF (fica anexada e eu sugiro o valor) ou digite os valores no padrão R$ (ex.: 50.490,84). Despesas somadas por período.</span></div>
    <label class="btn no-print" style="margin-left:auto">${svg('upload')} Enviar PDF<input type="file" accept="application/pdf,.pdf" onchange="notaNfUpload(event)" style="display:none"></label>
    <button class="btn primary no-print" onclick="modalNota()">${svg('plus')} Novo período</button></div>
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
        <thead><tr><th>Período</th><th>Alexandria</th><th>Notas em geral</th><th>Combustível</th><th>Total</th><th class="no-print">NF</th><th class="no-print"></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="7">${emptyState('Nenhum período lançado.')}</td></tr>`}
        ${notas.length?`<tr style="background:#f7f9fc;font-weight:800"><td>TOTAL GERAL</td><td class="mono">${money(somaAlex)}</td><td class="mono">${money(notas.reduce((s,n)=>s+(Number(n.notasGerais)||0),0))}</td><td class="mono">${money(somaComb)}</td><td class="mono">${money(acumulado)}</td><td class="no-print"></td><td class="no-print"></td></tr>`:''}</tbody></table></div></div></div>
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
function modalNota(id, pre){
  const n=id?DB.notas.find(x=>x.id===id):Object.assign({inicio:'',fim:'',alexandria:'',notasGerais:'',combustivel:'',obs:''}, pre||{});
  openModal(`<div class="m-h">${svg('money')}<h3>${id?'Editar período':'Novo período de notas'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      ${n._nfNome?`<div class="hint" style="background:#e7f6ec;color:#166534;padding:8px 12px;border-radius:8px;margin-bottom:12px">📎 Anexei a nota <b>${esc(n._nfNome)}</b> e sugeri o valor em "Notas em geral". Confira e classifique.</div>`:''}
      <div class="field-row">${fld('Início do período','f_ini',n.inicio,'date')}${fld('Fim do período','f_fim',n.fim,'date')}</div>
      <div class="field-row">${fldR$('Alexandria (R$)','f_alex',n.alexandria)}${fldR$('Notas em geral (R$)','f_ger',n.notasGerais)}</div>
      ${fldR$('Combustível (R$)','f_comb',n.combustivel)}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(n.obs)}"></div>
      <div class="hint">O total é somado automaticamente (Alexandria + Notas em geral + Combustível).</div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirNota('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarNota('${id||''}')">Salvar</button></div>`);
}
async function salvarNota(id){ if(!val('f_fim')){toast('Informe o fim do período.','err');return;}
  const d={inicio:val('f_ini'),fim:val('f_fim'),alexandria:r2(val('f_alex'))||0,notasGerais:r2(val('f_ger'))||0,combustivel:r2(val('f_comb'))||0,obs:val('f_obs')};
  let novoId=id;
  if(id)Object.assign(DB.notas.find(x=>x.id===id),d); else{ d.id=uid('nf'); novoId=d.id; DB.notas.push(d); }
  if(_notaNfPendente){ try{ await subirUm(_notaNfPendente,'nota',novoId,'Nota Fiscal'); await reloadFiles(); }catch(e){} _notaNfPendente=null; }
  saveDB(); closeModal(); toast('Período salvo.'); router(); }
function excluirNota(id){ if(!confirm('Excluir este período?'))return; DB.notas=DB.notas.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
/* Enviar PDF de nota fiscal: anexa ao período e sugere o valor total encontrado */
let _notaNfPendente=null;
async function notaNfUpload(ev){
  const f=(ev.target.files||[])[0]; ev.target.value=''; if(!f) return;
  toast('Lendo a nota fiscal…');
  const txt=await pexLerPdfTexto(f); const dd=extrairAbastecimento(txt||'');
  _notaNfPendente=f;
  modalNota(null, { _nfNome:f.name, notasGerais:(dd.valor!=null?dd.valor:''), fim:dd.data||'' });
}

/* ---------- PNEUS ---------- */
const PNEU_STATUS=['Novo','Usado','Recapado','Estepe','Descarte'];
function pneuKmRodado(p){ const v=veiculo(p.veiculoId); if(!v||v.kmAtual==null||p.kmInstalacao==null) return null; const r=v.kmAtual-p.kmInstalacao; return r>=0?r:null; }
/* Quantidade de um registro de pneu e total somado (cada linha pode ter vários pneus) */
function pneuQtd(p){ return parseInt(p&&p.qtd)||1; }
function pneuTotal(list){ return (list||DB.pneus).reduce((s,p)=>s+pneuQtd(p),0); }
/* um pneu está "no limite" quando precisa de troca (condição crítica ou próxima da troca) */
function _pneuNoLimite(p){ const c=pneuCondicao(p); return !!c && (c.key==='crit'||c.key==='troca'); }
let pneusFiltro='todos';
function viewPneus(){
  if(pneusFiltro==='limite') return viewPneusLimite();
  const total=pneuTotal();
  const veics=DB.veiculos.filter(v=>v.status!=='Arquivado');
  const comPneus=veics.filter(v=>DB.pneus.some(p=>p.veiculoId===v.id)).length;
  const foot=(v)=>{ const ps=DB.pneus.filter(p=>p.veiculoId===v.id); const t=pneuTotal(ps);
    return t? `<span class="st ok">${t} pneu(s)</span>` : `<span class="st neutro">sem pneus</span>`; };
  return `
  <div class="banner">${svg('tire')}<div><b>Pneus</b><span>Controle de pneus por veículo e o estoque de reserva. Clique numa placa para ver e cadastrar. Ao instalar um pneu, você pode dar baixa automática no estoque.</span></div>
    <button class="btn primary no-print" style="margin-left:auto" onclick="modalPneu()">${svg('plus')} Novo pneu</button></div>
  <div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
    ${kpi('tire','i-blue',total,'Pneus no total','instalados na frota')}
    ${kpi('truck','i-amber', comPneus, 'Veículos com pneus','')}
    <a class="kpi link" onclick="pneuIrEstoque()"><div class="k-top"><div class="k-ico i-green">${svg('tire')}</div><span class="k-go">→</span></div>
      <div class="k-val">${pneuTotal(DB.estoquePneus)}</div><div class="k-label">Pneus em estoque</div><div class="k-sub">clique para abrir</div></a>
  </div>
  <div class="toolbar"><div class="muted no-print">Clique em uma placa para ver e cadastrar os pneus daquele veículo.</div><div class="spacer"></div></div>
  ${vcardsSecoes('pneus', foot)}
  ${estoquePneusSecao()}`;
}
/* Navegação inteligente: só os pneus que precisam de troca (chamada do Painel via #pneus/limite) */
function viewPneusLimite(){
  const alertas=[];
  DB.veiculos.filter(v=>v.status!=='Arquivado').forEach(v=>{
    DB.pneus.filter(p=>p.veiculoId===v.id && _pneuNoLimite(p)).forEach(p=>alertas.push({v,p}));
  });
  alertas.sort((a,b)=>{ const ka=pneuCondicao(a.p).key==='crit'?0:1, kb=pneuCondicao(b.p).key==='crit'?0:1; return ka-kb; });
  const rows=alertas.map(({v,p})=>{ const c=pneuCondicao(p); const crit=c.key==='crit';
    return `<div class="alert-row" onclick="location.hash='pneus/${v.id}'">
      <div class="a-ico ${crit?'i-red':'i-orange'}">${svg('tire')}</div>
      <div class="a-main"><b>${plate(v.placa,v.tipo)} — ${esc(p.posicao||p.slot||'Pneu')}</b>
        <span>${esc(p.marca||'—')}${p.modelo?' '+esc(p.modelo):''} · Sulco: ${(p.sulco!=null&&p.sulco!=='')?esc(p.sulco)+' mm':'—'}</span></div>
      <div class="a-when"><span class="st ${crit?'crit':'warn'}">${esc(c.label||'Trocar')}</span></div></div>`;
  }).join('');
  return `
  <div class="banner">${svg('tire')}<div><b>Pneus no limite</b><span>Somente os pneus em condição crítica ou próximos da troca (sulco ≤ ${DB.config.sulcoMinimo} mm). Clique num pneu para abrir o veículo e ver o diagrama.</span></div>
    <a class="btn no-print" style="margin-left:auto" href="#pneus">${svg('tire')} Ver todos os pneus</a></div>
  <div class="grid kpis" style="grid-template-columns:1fr;margin-bottom:16px">
    ${kpi('tire', alertas.length?'i-red':'i-green', alertas.length, 'Pneus para trocar', 'condição crítica ou próxima da troca')}
  </div>
  <div class="card"><div class="card-b p0">
    ${alertas.length? rows : emptyState('Nenhum pneu no limite. Todos com sulco acima do mínimo. 👍')}
  </div></div>`;
}
function pneuIrEstoque(){ const el=document.getElementById('sec-estoque-pneus'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }
/* --- Pneus em estoque (não instalados) --- */
function estoquePneusSecao(){
  const ep=DB.estoquePneus.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const qt=ep.reduce((s,x)=>s+(parseInt(x.qtd)||1),0);
  const tot=ep.reduce((s,x)=>s+(Number(x.valor)||0)*(parseInt(x.qtd)||1),0);
  const rows=ep.map(x=>`<tr class="clickable" onclick="modalEstoquePneu('${x.id}')">
    <td class="mono">${x.qtd||1}</td><td><b>${esc(x.marca||'—')}</b></td><td class="mono">${esc(x.medida||'—')}</td>
    <td class="mono muted">${esc(x.dot||'—')}</td><td class="mono">${fmtD(x.data)}</td><td>${esc(x.local||'—')}</td>
    <td>${esc(x.localEstoque||'—')}</td><td class="mono">${money(x.valor)}</td><td class="muted" style="font-size:12px">${esc(x.obs||'—')}</td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalEstoquePneu('${x.id}')">${svg('edit')}</button></td></tr>`).join('');
  return `<div class="sectitulo" id="sec-estoque-pneus" style="margin-top:24px;scroll-margin-top:70px">${svg('tire')} Pneus em estoque</div>
    <div class="card"><div class="card-h">${svg('tire')}<h3 style="font-size:14px">Em estoque — ${qt} pneu(s) · ${money(tot)}</h3>
      <button class="btn sm no-print" style="margin-left:auto" onclick="modalEstoquePneu()">${svg('plus')} Novo pneu em estoque</button></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Qtd</th><th>Marca</th><th>Medida</th><th>DOT</th><th>Data</th><th>Local da compra</th><th>Local (onde está)</th><th>Valor</th><th>Obs</th><th class="no-print"></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="10">${emptyState('Nenhum pneu em estoque. Clique em "Novo pneu em estoque".')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalEstoquePneu(id){
  const x=id?DB.estoquePneus.find(y=>y.id===id):{data:new Date().toISOString().slice(0,10),marca:'',medida:'',local:'',localEstoque:'',valor:'',qtd:1,dot:'',obs:''};
  openModal(`<div class="m-h">${svg('tire')}<h3>${id?'Editar pneu em estoque':'Novo pneu em estoque'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data da compra','f_data',x.data,'date')}${fld('Quantidade','f_qtd',x.qtd||1,'number')}</div>
      <div class="field-row">${fld('Marca','f_marca',x.marca)}${fld('Medida','f_medida',x.medida,'text','Ex.: 295/80 R22.5')}</div>
      <div class="field-row">${fld('DOT (semana/ano)','f_dot',x.dot)}${fldR$('Valor (R$)','f_valor',x.valor)}</div>
      <div class="field-row">${fld('Local da compra','f_local',x.local,'text','Onde foi comprado')}${fld('Local (onde está)','f_locest',x.localEstoque,'text','Onde o pneu está guardado')}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(x.obs||'')}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirEstoquePneu('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarEstoquePneu('${id||''}')">Salvar</button></div>`);
}
function salvarEstoquePneu(id){ let q=parseInt(val('f_qtd'))||1; if(q<1)q=1;
  const d={data:val('f_data'),marca:val('f_marca'),medida:val('f_medida'),dot:val('f_dot'),local:val('f_local'),localEstoque:val('f_locest'),valor:parseBRL(val('f_valor')),qtd:q,obs:val('f_obs')};
  if(id)Object.assign(DB.estoquePneus.find(y=>y.id===id),d); else{ d.id=uid('ep'); DB.estoquePneus.push(d); } saveDB(); closeModal(); toast('Pneu em estoque salvo.'); router(); }
function excluirEstoquePneu(id){ if(!confirm('Excluir este pneu em estoque?'))return; DB.estoquePneus=DB.estoquePneus.filter(y=>y.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
/* ================================================================== */
/*  PNEUS — GESTÃO INTELIGENTE (diagrama do veículo, condição, painel)  */
/* ================================================================== */
const PNEU_COND={'Excelente':{cor:'#25e88f',key:'bom'},'Bom':{cor:'#2fd07a',key:'bom'},'Atenção':{cor:'#ffb020',key:'aten'},'Ruim':{cor:'#ff8c1a',key:'troca'},'Crítico':{cor:'#ff3b30',key:'crit'},'Removido':{cor:'#8695ab',key:'rem'}};
const PNEU_COND_OPCS=['','Excelente','Bom','Atenção','Ruim','Crítico','Removido'];
function pneuCondicao(p){
  if(p.condicao && PNEU_COND[p.condicao]){ const m=PNEU_COND[p.condicao]; return {cor:m.cor,key:m.key,label:p.condicao,manual:true}; }
  const min=Number(DB.config.sulcoMinimo)||3; const st=(p.status||'').toLowerCase();
  if(/descarte|remov/.test(st)) return {cor:'#8695ab',key:'rem',label:'Removido'};
  const s=(p.sulco!=null&&p.sulco!=='')?Number(p.sulco):null;
  if(s!=null){ if(s<=min) return {cor:'#ff3b30',key:'crit',label:'Crítico'};
    if(s<=min+2) return {cor:'#ff8c1a',key:'troca',label:'Próximo da troca'};
    if(s<=min+5) return {cor:'#ffb020',key:'aten',label:'Atenção'};
    return {cor:'#25e88f',key:'bom',label:'Excelente'}; }
  const b=(p.borracha!=null&&p.borracha!=='')?Number(p.borracha):null;
  if(b!=null){ if(b<25) return {cor:'#ff3b30',key:'crit',label:'Crítico'};
    if(b<45) return {cor:'#ff8c1a',key:'troca',label:'Próximo da troca'};
    if(b<65) return {cor:'#ffb020',key:'aten',label:'Atenção'};
    return {cor:'#25e88f',key:'bom',label:'Excelente'}; }
  if(/estepe/.test(st)) return {cor:'#8695ab',key:'estepe',label:'Estepe'};
  if(/novo/.test(st)) return {cor:'#25e88f',key:'bom',label:'Excelente'};
  if(/recap|usado/.test(st)) return {cor:'#ffb020',key:'aten',label:'Atenção'};
  return {cor:'#8695ab',key:'sem',label:'Sem dados'};
}
function pneuVidaPct(p){ const min=Number(DB.config.sulcoMinimo)||3;
  const s=(p.sulco!=null&&p.sulco!=='')?Number(p.sulco):null;
  if(s!=null){ return Math.max(0,Math.min(100,Math.round((s-min)/(16-min)*100))); }
  const b=(p.borracha!=null&&p.borracha!=='')?Number(p.borracha):null; if(b!=null) return Math.max(0,Math.min(100,Math.round(b)));
  return null; }
function pneuCustoKmTxt(p){ const km=pneuKmRodado(p); const val=Number(p.valor)||0;
  if(!val||!km) return '—'; return 'R$ '+(val/km).toFixed(3).replace('.',',')+'/km'; }
function pneuSlots(v){ const cavalo=v.tipo==='Cavalo';
  if(cavalo) return [
    {id:'1E',eixo:1,cod:'1E',nome:'Dianteira Esquerda',x:60,y:166},{id:'1D',eixo:1,cod:'1D',nome:'Dianteira Direita',x:240,y:166},
    {id:'2EE',eixo:2,cod:'2EE',nome:'Tração Externo LE',x:42,y:300},{id:'2EI',eixo:2,cod:'2EI',nome:'Tração Interno LE',x:80,y:300},{id:'2DI',eixo:2,cod:'2DI',nome:'Tração Interno LD',x:220,y:300},{id:'2DE',eixo:2,cod:'2DE',nome:'Tração Externo LD',x:258,y:300},
    {id:'3EE',eixo:3,cod:'3EE',nome:'Truck Externo LE',x:42,y:378},{id:'3EI',eixo:3,cod:'3EI',nome:'Truck Interno LE',x:80,y:378},{id:'3DI',eixo:3,cod:'3DI',nome:'Truck Interno LD',x:220,y:378},{id:'3DE',eixo:3,cod:'3DE',nome:'Truck Externo LD',x:258,y:378}];
  return [
    {id:'C1EE',eixo:1,cod:'1EE',nome:'Truck Externo LE',x:42,y:150},{id:'C1EI',eixo:1,cod:'1EI',nome:'Truck Interno LE',x:80,y:150},{id:'C1DI',eixo:1,cod:'1DI',nome:'Truck Interno LD',x:220,y:150},{id:'C1DE',eixo:1,cod:'1DE',nome:'Truck Externo LD',x:258,y:150},
    {id:'C2EE',eixo:2,cod:'2EE',nome:'Eixo Meio Externo LE',x:42,y:245},{id:'C2EI',eixo:2,cod:'2EI',nome:'Eixo do Meio Interno LE',x:80,y:245},{id:'C2DI',eixo:2,cod:'2DI',nome:'Eixo do Meio Interno LD',x:220,y:245},{id:'C2DE',eixo:2,cod:'2DE',nome:'Eixo do Meio Externo LD',x:258,y:245},
    {id:'C3EE',eixo:3,cod:'3EE',nome:'Último Eixo Externo LE',x:42,y:340},{id:'C3EI',eixo:3,cod:'3EI',nome:'Último Eixo Interno LE',x:80,y:340},{id:'C3DI',eixo:3,cod:'3DI',nome:'Último Eixo Interno LD',x:220,y:340},{id:'C3DE',eixo:3,cod:'3DE',nome:'Último Eixo Externo LD',x:258,y:340},
    {id:'CE1',eixo:0,cod:'EST',nome:'Estepe Esquerdo',x:96,y:448,spare:1},{id:'CE2',eixo:0,cod:'EST',nome:'Estepe Direito',x:204,y:448,spare:1}];
}
function pneuNomeSlot(v, sid){ if(!sid) return ''; const s=pneuSlots(v).find(x=>x.id===sid); return s?s.nome:sid; }
function pneuEixoNome(e){ return e===0?'Estepes':'Eixo '+e; }
function pneuPlacements(v, pneus){ const slots=pneuSlots(v); const bySlot={}; const used={};
  pneus.forEach(p=>{ if(p.slot && slots.some(s=>s.id===p.slot) && !bySlot[p.slot]){ bySlot[p.slot]=p; used[p.id]=1; } });
  const rest=pneus.filter(p=>!used[p.id]);
  const pools={dir:slots.filter(s=>s.eixo===1),drv:slots.filter(s=>s.eixo>=2),sp:slots.filter(s=>s.spare)};
  const takeFrom=arr=>{ for(let i=0;i<arr.length;i++){ if(!bySlot[arr[i].id]) return arr[i]; } return null; };
  rest.forEach(p=>{ const pos=(p.posicao||'').toLowerCase(), st=(p.status||'').toLowerCase();
    let n=Math.max(1,parseInt(p.qtd)||1); if(n>6)n=6;
    const order=/estepe/.test(pos+' '+st)?['sp','drv','dir']:(/dian|dire/.test(pos)?['dir','drv','sp']:['drv','dir','sp']);
    while(n-->0){ let placed=false; for(let k=0;k<order.length;k++){ const s=takeFrom(pools[order[k]]); if(s){ bySlot[s.id]=p; placed=true; break; } } if(!placed) break; }
  });
  return {slots, bySlot};
}
function pneuDiagramaSVG(v, pl){ const cavalo=v.tipo==='Cavalo'; const H=cavalo?440:500;
  const eixosY=cavalo?[166,300,378]:[150,245,340];
  const axles=eixosY.map(y=>`<g><line class="pn-axle" x1="30" y1="${y}" x2="270" y2="${y}"/><circle class="pn-hub" cx="150" cy="${y}" r="6"/></g>`).join('');
  const body=cavalo
    ? `<rect class="pn-chassis" x="122" y="118" width="56" height="296" rx="9"/>
       <rect class="pn-body" x="100" y="116" width="100" height="150" rx="14"/>
       <rect class="pn-cab" x="104" y="26" width="92" height="94" rx="16"/>
       <rect class="pn-glass" x="112" y="34" width="76" height="26" rx="7"/>
       <rect class="pn-mirror" x="95" y="60" width="9" height="18" rx="3"/><rect class="pn-mirror" x="196" y="60" width="9" height="18" rx="3"/>
       <line class="pn-chassis-l" x1="150" y1="120" x2="150" y2="410"/>`
    : `<rect class="pn-body" x="98" y="56" width="104" height="344" rx="16"/>
       <rect class="pn-chassis" x="124" y="66" width="52" height="326" rx="9"/>
       <circle class="pn-king" cx="150" cy="64" r="9"/><circle class="pn-king2" cx="150" cy="64" r="15"/>`;
  const tires=pl.slots.map(s=>{ const p=pl.bySlot[s.id]; const cond=p?pneuCondicao(p):{cor:'#33465e',label:'Vazio'};
    const w=22,h=42,x=s.x-w/2,y=s.y-h/2; const cls=p?'pn-tire has':'pn-tire empty';
    const tread=p?[y+8,y+15,y+22,y+29,y+36].map(ty=>`<line x1="${x+3.5}" y1="${ty}" x2="${x+w-3.5}" y2="${ty}" class="pn-tread"/>`).join(''):'';
    return `<g class="${cls}" onclick="pneuAbrir('${p?('p:'+p.id):('s:'+s.id)}','${v.id}')" data-tip="${esc(s.nome)}${p?(' · '+esc(p.marca||'Pneu')+' · '+cond.label+(p.sulco?' · '+p.sulco+'mm':'')):' · vazio'}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${cond.cor}"/>${tread}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" class="pn-tire-edge"/>
      <text x="${s.x}" y="${s.y+3}" text-anchor="middle" class="pn-tlbl">${esc(s.cod)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 300 ${H}" class="pn-diagram" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="pnBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(0,55,95,.5)"/><stop offset=".5" stop-color="rgba(0,95,155,.62)"/><stop offset="1" stop-color="rgba(0,55,95,.5)"/></linearGradient></defs>
    ${body}${axles}${tires}</svg>`;
}
/* Detalhe: pneus de UM veículo — diagrama inteligente + painel + ficha */
function viewPneusVeiculo(id){
  const v=veiculo(id); if(!v) return emptyState('Veículo não encontrado.');
  const cavalo=v.tipo==='Cavalo';
  const ps=DB.pneus.filter(p=>p.veiculoId===v.id);
  const pl=pneuPlacements(v, ps);
  const instalados=Object.values(pl.bySlot);
  const cont={bom:0,aten:0,troca:0,crit:0,rem:0};
  instalados.forEach(p=>{ const k=pneuCondicao(p).key; cont[/crit/.test(k)?'crit':/troca/.test(k)?'troca':/aten/.test(k)?'aten':/bom/.test(k)?'bom':'rem']++; });
  const proxTroca=instalados.filter(p=>['troca','crit'].indexOf(pneuCondicao(p).key)>=0)
    .sort((a,b)=>(pneuVidaPct(a)==null?999:pneuVidaPct(a))-(pneuVidaPct(b)==null?999:pneuVidaPct(b)));
  // análise por eixo
  const eixos={}; pl.slots.forEach(s=>{ const p=pl.bySlot[s.id]; if(!p) return; const e=s.eixo;
    eixos[e]=eixos[e]||{custo:0,vidas:[],n:0}; eixos[e].custo+=Number(p.valor)||0; eixos[e].n++; const vp=pneuVidaPct(p); if(vp!=null)eixos[e].vidas.push(vp); });
  const eixoKeys=Object.keys(eixos).sort();
  const custoBars=eixoKeys.map(e=>({label:pneuEixoNome(+e),value:Math.round(eixos[e].custo),vtxt:moneyK(eixos[e].custo),color:'#2f8fff'}));
  const custoTotal=instalados.reduce((s,p)=>s+(Number(p.valor)||0),0);
  const kmTotal=instalados.reduce((s,p)=>{ const k=pneuKmRodado(p); return s+(k||0); },0);
  const custoKmFrota= (custoTotal&&kmTotal)? 'R$ '+(custoTotal/kmTotal).toFixed(3).replace('.',',')+'/km' : '—';
  const desgasteHTML=eixoKeys.map(e=>{ const vs=eixos[e].vidas; const avg=vs.length?Math.round(vs.reduce((a,b)=>a+b,0)/vs.length):null;
    const cor=avg==null?'#8695ab':avg<25?'#ff3b30':avg<45?'#ff8c1a':avg<65?'#ffb020':'#25e88f';
    return `<div class="pn-desg"><span>${pneuEixoNome(+e)}</span><div class="pn-desg-bar"><i style="width:${avg==null?0:avg}%;background:${cor}"></i></div><b>${avg==null?'—':avg+'%'}</b></div>`; }).join('') || '<div class="muted">Sem dados de sulco/borracha ainda.</div>';
  const proxHTML=proxTroca.length? proxTroca.map(p=>{ const c=pneuCondicao(p); const slot=Object.keys(pl.bySlot).find(k=>pl.bySlot[k]===p)||'';
    return `<div class="pn-prox clk" onclick="pneuAbrir('p:${p.id}','${v.id}')"><span class="pn-dot" style="background:${c.cor}"></span><div class="a-main"><b>${esc(pneuNomeSlot(v,slot))||'Pneu'} — ${esc(p.marca||'')}</b><span>${esc(p.medida||'')}${p.sulco?' · '+p.sulco+'mm':''}</span></div><span class="st ${c.key==='crit'?'crit':'warn'}">${c.label}</span></div>`; }).join('') : `<div class="pn-ok">${svg('check')} Nenhum pneu na faixa de troca. 👍</div>`;
  const un=cavalo?'KM':'Horas';
  return `${detalheVeiculoHead(v, `<a class="btn" href="#km">${svg('gauge')} ${un}</a><button class="btn primary" onclick="modalPneu(null,'${v.id}')">${svg('plus')} Novo pneu</button>`)}
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin:4px 0 16px">
    ${kpi('tire','i-green',cont.bom,'Excelentes','')}
    ${kpi('tire','i-amber',cont.aten+cont.troca,'Atenção / troca','')}
    ${kpi('tire','i-red',cont.crit,'Críticos','')}
    ${kpi('money','i-blue',money(custoTotal),'Investido em pneus',custoKmFrota+' médio')}
  </div>
  <div class="grid" style="grid-template-columns:minmax(300px,380px) 1fr;gap:16px;align-items:start">
    <div class="card pn-stage"><div class="card-h">${svg('tire')}<h3 style="font-size:14px">${esc(v.placa)} · ${cavalo?'Cavalo (3 eixos)':'Carreta (3 eixos)'}</h3><span class="sub" style="margin-left:auto">clique num pneu</span></div>
      <div class="card-b pn-stage-b">
        ${pneuDiagramaSVG(v, pl)}
        <div class="pn-legend">
          <span><i style="background:#25e88f"></i>Excelente</span><span><i style="background:#ffb020"></i>Atenção</span>
          <span><i style="background:#ff8c1a"></i>Próx. troca</span><span><i style="background:#ff3b30"></i>Crítico</span>
          <span><i style="background:#8695ab"></i>Estoque/Removido</span><span><i style="background:#33465e"></i>Vazio</span>
        </div>
      </div>
      <aside class="pn-panel" id="pneuPanel"></aside>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card"><div class="card-h">${svg('bell')}<h3 style="font-size:14px">Pneus próximos da troca</h3></div><div class="card-b p0" style="padding:8px 12px">${proxHTML}</div></div>
      <div class="grid two-col" style="gap:16px">
        <div class="card"><div class="card-h">${svg('dash')}<h3 style="font-size:14px">Desgaste por eixo</h3></div><div class="card-b">${desgasteHTML}</div></div>
        <div class="card"><div class="card-h">${svg('money')}<h3 style="font-size:14px">Custo por eixo</h3></div><div class="card-b">${custoBars.length?barChart(custoBars,{h:150,w:300}):'<div class="muted">Cadastre o valor dos pneus.</div>'}</div></div>
      </div>
    </div>
  </div>
  ${pneuFichaTabela(v, ps)}`;
}
function pneuFichaTabela(v, ps){
  const rows=ps.slice().sort((a,b)=>(a.slot||a.posicao||'').localeCompare(b.slot||b.posicao||'')).map(p=>{ const km=pneuKmRodado(p); const c=pneuCondicao(p);
    return `<tr class="clickable" onclick="pneuAbrir('p:${p.id}','${v.id}')"><td><span class="qtd-badge">${p.qtd||1}</span></td>
      <td><b>${esc(pneuNomeSlot(v,p.slot)||p.posicao||'—')}</b></td>
      <td><b>${esc(p.marca||'—')}</b><div class="muted" style="font-size:11.5px">${esc(p.modelo||'')} ${esc(p.medida||'')}</div></td>
      <td class="mono muted">${esc(p.dot||'—')}</td><td class="mono">${p.sulco?p.sulco+'mm':'—'}</td>
      <td class="mono"><b>${km!=null?num(km)+' km':'—'}</b></td>
      <td><span class="st" style="background:${c.cor}22;color:${c.cor}"><i style="width:7px;height:7px;border-radius:50%;background:${c.cor};display:inline-block"></i>${c.label}</span></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalPneu('${p.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `<div class="card" style="margin-top:16px"><div class="card-h">${svg('tire')}<h3 style="font-size:14px">Ficha completa — ${pneuTotal(ps)} pneu(s)</h3></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Qtd</th><th>Posição</th><th>Marca / Modelo</th><th>DOT</th><th>Sulco</th><th>Rodado</th><th>Condição</th><th class="no-print"></th></tr></thead>
      <tbody>${rows||`<tr><td colspan="8">${emptyState('Nenhum pneu cadastrado para este veículo.')}</td></tr>`}</tbody></table></div></div></div>`;
}
/* ---- Painel lateral do pneu ---- */
function pneuAbrir(ref, vId){ const el=document.getElementById('pneuPanel'); if(!el) return;
  document.querySelectorAll('.pn-tire.sel').forEach(e=>e.classList.remove('sel'));
  const v=veiculo(vId);
  if(ref.slice(0,2)==='p:'){ const p=DB.pneus.find(x=>x.id===ref.slice(2)); if(p){ el.innerHTML=pneuPanelHTML(p,v); el.classList.add('show'); } }
  else { el.innerHTML=pneuPanelVazio(ref.slice(2),v); el.classList.add('show'); }
}
function pneuFecharPanel(){ const el=document.getElementById('pneuPanel'); if(el) el.classList.remove('show'); }
function _pnRow(l,val){ return `<div class="pn-f"><small>${l}</small><b>${val==null||val===''?'—':val}</b></div>`; }
function pneuPanelHTML(p, v){ const c=pneuCondicao(p); const km=pneuKmRodado(p); const vida=pneuVidaPct(p);
  const slot=Object.keys(pneuPlacements(v, DB.pneus.filter(x=>x.veiculoId===v.id)).bySlot).find(k=>{ const b=pneuPlacements(v, DB.pneus.filter(x=>x.veiculoId===v.id)).bySlot[k]; return b&&b.id===p.id; });
  const slots=pneuSlots(v);
  const moveOpts=slots.map(s=>`<option value="${s.id}" ${p.slot===s.id?'selected':''}>${esc(s.nome)}</option>`).join('');
  const condOpts=PNEU_COND_OPCS.map(o=>`<option value="${o}" ${(p.condicao||'')===o?'selected':''}>${o||'Automático (pelo sulco)'}</option>`).join('');
  const fotos=(typeof filesDe==='function')?filesDe('pneu',p.id):[];
  const fotosHTML=fotos.length? fotos.map(f=>`<button class="pn-foto" title="${esc(f.name||f.nome||'foto')}" onclick="${f.id?`verArquivo('${f.id}')`:`abrirReal('${esc(f.path)}')`}">${svg('eye')}</button>`).join('') : '<span class="muted" style="font-size:12px">Sem fotos</span>';
  return `<button class="pn-x" onclick="pneuFecharPanel()">×</button>
    <div class="pn-head"><span class="pn-badge" style="background:${c.cor}"></span><div><b class="pn-pos">${esc(pneuNomeSlot(v,slot)||p.posicao||'Pneu')}</b><span class="pn-cond" style="color:${c.cor}">${c.label}${c.manual?' · manual':''}</span></div></div>
    <div class="pn-vida"><small>Vida útil restante</small><div class="pn-vida-bar"><i style="width:${vida==null?0:vida}%;background:${c.cor}"></i></div><b>${vida==null?'—':vida+'%'}</b></div>
    <div class="pn-condset"><small>Condição (definir manualmente)</small><select onchange="pneuSetCondicao('${p.id}',this.value)">${condOpts}</select></div>
    <div class="pn-grid">
      ${_pnRow('Marca',esc(p.marca))}${_pnRow('Modelo',esc(p.modelo))}
      ${_pnRow('Medida',esc(p.medida))}${_pnRow('DOT',esc(p.dot))}
      ${_pnRow('Nº de Fogo',esc(p.fogo))}${_pnRow('Nota Fiscal',esc(p.nf))}
      ${_pnRow('Fornecedor',esc(p.fornecedor))}${_pnRow('Data da compra',fmtD(p.dataCompra))}
      ${_pnRow('Valor',money(p.valor))}${_pnRow('Sulco',p.sulco?esc(p.sulco)+' mm':'—')}
      ${_pnRow('KM rodados',km!=null?num(km)+' km':'—')}${_pnRow('Custo por KM',pneuCustoKmTxt(p))}
      ${_pnRow('Rodízios',p.rodizios||0)}${_pnRow('Reformas',p.reformas||0)}
      ${_pnRow('Status',esc(p.status))}${_pnRow('Instalado em',fmtD(p.dataInstalacao))}
    </div>
    <div class="pn-sec"><small>Observações</small><div class="pn-obs">${esc(p.obs)||'<span class="muted">—</span>'}</div></div>
    <div class="pn-sec"><small>Fotos</small><div class="pn-fotos">${fotosHTML}<button class="btn ghost sm" onclick="uploadPara('pneu','${p.id}','Foto do pneu')">${svg('upload')} Foto</button></div></div>
    <div class="pn-move"><small>Mover para posição</small><div style="display:flex;gap:8px"><select id="pnMove">${moveOpts}</select><button class="btn sm" onclick="pneuMover('${p.id}',document.getElementById('pnMove').value)">Mover</button></div></div>
    <div class="pn-acts"><button class="btn sm" onclick="modalPneu('${p.id}')">${svg('edit')} Editar</button><button class="btn ghost sm" onclick="pneuRemoverPos('${p.id}')">Tirar da posição</button></div>`;
}
function pneuSetCondicao(pneuId, cond){ const p=DB.pneus.find(x=>x.id===pneuId); if(!p) return; p.condicao=cond||''; saveDB(); router();
  if(typeof pneuAbrir==='function') pneuAbrir('p:'+pneuId, p.veiculoId); toast('Condição atualizada.'); }
function pneuPanelVazio(slotId, v){ const slots=pneuSlots(v); const s=slots.find(x=>x.id===slotId)||{nome:slotId};
  return `<button class="pn-x" onclick="pneuFecharPanel()">×</button>
    <div class="pn-head"><span class="pn-badge" style="background:#33465e"></span><div><b class="pn-pos">${esc(s.nome)}</b><span class="pn-cond muted">Posição vazia</span></div></div>
    <p class="muted" style="font-size:13px;margin:14px 0">Nenhum pneu nesta posição. Instale um pneu novo aqui ou mova um pneu existente pelo painel de outro pneu.</p>
    <button class="btn primary" style="width:100%" onclick="modalPneu(null,'${v.id}','${slotId}')">${svg('plus')} Instalar pneu aqui</button>`;
}
function pneuMover(pneuId, slotId){ const p=DB.pneus.find(x=>x.id===pneuId); if(!p) return;
  const outro=DB.pneus.find(x=>x!==p && x.veiculoId===p.veiculoId && x.slot===slotId);
  if(outro) outro.slot=p.slot||''; /* troca de posição */
  p.slot=slotId; (p.hist=p.hist||[]).push({t:'move',slot:slotId,data:new Date().toISOString().slice(0,10)});
  p.rodizios=(parseInt(p.rodizios)||0)+1; saveDB(); toast('Pneu movido para '+slotId+'.'); router(); }
function pneuRemoverPos(pneuId){ const p=DB.pneus.find(x=>x.id===pneuId); if(!p) return; p.slot=''; p.status='Estepe'; saveDB(); toast('Pneu tirado da posição (vai para estepe/estoque).'); router(); }
function modalPneu(id, vId, slotId){
  const p=id?DB.pneus.find(x=>x.id===id):{veiculoId:vId||(DB.veiculos[0]||{}).id,qtd:1,posicao:'',slot:slotId||'',marca:'',modelo:'',medida:'',dot:'',fogo:'',nf:'',fornecedor:'',dataCompra:'',valor:'',sulco:'',dataInstalacao:'',kmInstalacao:'',status:'Novo',borracha:'',rodizios:0,reformas:0,obs:''};
  const _sv=veiculo(p.veiculoId)||DB.veiculos[0]; const _slots=_sv?pneuSlots(_sv):[];
  openModal(`<div class="m-h">${svg('tire')}<h3>${id?'Editar pneu':'Novo pneu'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field"><label>Veículo</label><select id="f_veic">${DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>`<option value="${v.id}" ${p.veiculoId===v.id?'selected':''}>${esc(v.placa)} — ${esc(v.marca)} ${esc(v.modelo)}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label>Posição no diagrama</label><select id="f_slot"><option value="">— não posicionado —</option>${_slots.map(s=>`<option value="${s.id}" ${p.slot===s.id?'selected':''}>${esc(s.nome)}</option>`).join('')}</select></div>
        ${fld('Quantidade','f_qtd',p.qtd||1,'number','Ex.: 2 (dá p/ cadastrar 2 de uma vez)')}</div>
      <div class="field"><label>Condição</label><select id="f_cond">${PNEU_COND_OPCS.map(o=>`<option value="${o}" ${(p.condicao||'')===o?'selected':''}>${o||'Automático (pela profundidade do sulco)'}</option>`).join('')}</select><div class="hint">Deixe em "Automático" para a cor sair do sulco, ou defina Excelente / Bom / Atenção / Ruim / Crítico.</div></div>
      <div class="field-row">${fld('Marca','f_marca',p.marca)}${fld('Modelo','f_modelo',p.modelo)}</div>
      <div class="field-row">${fld('Medida','f_medida',p.medida,'text','Ex.: 295/80 R22.5')}${fld('Sulco (mm)','f_sulco',p.sulco,'number','Profundidade atual. Ex.: 12')}</div>
      <div class="field-row">
        <div class="field"><label>Status</label><select id="f_status" onchange="pneuToggleBorracha(this.value)">${PNEU_STATUS.map(o=>`<option ${o===p.status?'selected':''}>${esc(o)}</option>`).join('')}</select></div>
        ${fld('DOT (semana/ano)','f_dot',p.dot)}</div>
      <div class="field-row" id="f_borracha_wrap" style="${/usado|recap/i.test(p.status||'')?'':'display:none'}">
        ${fld('% de borracha restante','f_borracha',p.borracha,'number','Só p/ usado/recapado. Ex.: 70')}
        ${fld('Nº de fogo','f_fogo',p.fogo,'text','Marcação de identificação')}</div>
      <div class="field-row">${fldR$('Valor (R$)','f_valor',p.valor)}${fld('Fornecedor','f_forn',p.fornecedor)}</div>
      <div class="field-row">${fld('Data da compra','f_datac',p.dataCompra,'date')}${fld('Nota Fiscal','f_nf',p.nf)}</div>
      ${!id && DB.estoquePneus.some(e=>(parseInt(e.qtd)||0)>0) ? `<div class="field"><label>Tirar do estoque (opcional)</label><select id="f_estq"><option value="">— não usar estoque —</option>${DB.estoquePneus.filter(e=>(parseInt(e.qtd)||0)>0).map(e=>`<option value="${e.id}">${esc(e.marca||'Pneu')} ${esc(e.medida||'')} — ${e.qtd} em estoque${e.localEstoque?' ('+esc(e.localEstoque)+')':''}</option>`).join('')}</select><div class="hint">Se escolher, dá baixa automática no estoque ao salvar.</div></div>`:''}
      <div class="field-row">${fld('Data instalação','f_data',p.dataInstalacao,'date')}${fld('KM na instalação','f_km',p.kmInstalacao,'number')}</div>
      <div class="field-row">${fld('Rodízios','f_rod',p.rodizios||0,'number')}${fld('Reformas / recapagens','f_ref',p.reformas||0,'number')}</div>
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(p.obs)}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirPneu('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarPneu('${id||''}')">Salvar</button></div>`);
}
function pneuToggleBorracha(v){ const w=document.getElementById('f_borracha_wrap'); if(w) w.style.display=/usado|recap/i.test(v||'')?'':'none'; }
function salvarPneu(id){
  let q=parseInt(val('f_qtd'))||1; if(q<1)q=1; if(q>50)q=50;
  const st=val('f_status'); const slot=val('f_slot');
  const _v=veiculo(val('f_veic')); const _s=_v?pneuSlots(_v).find(x=>x.id===slot):null; const oldP=id?DB.pneus.find(x=>x.id===id):null;
  const d={veiculoId:val('f_veic'),qtd:q,slot:slot,posicao:_s?_s.nome:(oldP?oldP.posicao||'':''),condicao:val('f_cond')||'',
    marca:val('f_marca'),modelo:val('f_modelo'),medida:val('f_medida'),dot:val('f_dot'),
    fogo:val('f_fogo'),nf:val('f_nf'),fornecedor:val('f_forn'),dataCompra:val('f_datac'),valor:parseBRL(val('f_valor')),
    sulco:numOrNull('f_sulco'),status:st,borracha:(/usado|recap/i.test(st)?numOrNull('f_borracha'):null),
    dataInstalacao:val('f_data'),kmInstalacao:numOrNull('f_km'),rodizios:numOrNull('f_rod')||0,reformas:numOrNull('f_ref')||0,obs:val('f_obs')};
  let baixa='';
  if(id)Object.assign(DB.pneus.find(x=>x.id===id),d); else{ d.id=uid('pn'); DB.pneus.push(d);
    const eid=val('f_estq'); if(eid){ const e=DB.estoquePneus.find(x=>x.id===eid); if(e){ e.qtd=(parseInt(e.qtd)||0)-q;
      baixa=' Baixa de '+q+' no estoque'+(e.marca?' ('+e.marca+')':'')+'.'; if(e.qtd<=0) DB.estoquePneus=DB.estoquePneus.filter(x=>x.id!==eid); } } }
  saveDB(); closeModal(); toast('Pneu salvo.'+baixa); router(); }
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
    toast('💻 Este arquivo fica na pasta do computador — abra o sistema no PC para vê-lo. Para acessá-lo em qualquer lugar (celular/online), use "Enviar arquivo" e ele fica guardado dentro do sistema.');
    return true;
  }
  return false;
}
function _encPath(p){ try{ return encodeURI(String(p)); }catch(e){ return p; } }
function abrirReal(path){ if(_arquivoLocalIndisponivel(path)) return; const a=document.createElement('a'); a.href=_encPath(path); a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); }
function baixarReal(path,nome){ if(_arquivoLocalIndisponivel(path)) return; const a=document.createElement('a'); a.href=_encPath(path); a.download=nome||''; document.body.appendChild(a); a.click(); a.remove(); }

/* ---------- HOME · Centro de Comando: frota, painel lateral, count-up ---------- */
function iniCavalos(){ return DB.veiculos.filter(v=>v.tipo==='Cavalo'&&v.status!=='Arquivado').slice(0,5); }
function iniFecharVeic(){ const p=document.getElementById('iniVeicPanel'); if(p) p.classList.remove('show'); }
function iniAbrirVeic(placa){ const v=DB.veiculos.find(x=>x.placa===placa); const p=document.getElementById('iniVeicPanel'); if(!v||!p) return;
  p.innerHTML=`<button class="x" onclick="iniFecharVeic()">×</button>
    <div class="vp-plate">${esc(v.placa)}</div><div class="vp-model">${esc(((v.marca||'')+' '+(v.modelo||'')).trim()||'Cavalo')} · Cavalo</div>
    <div class="vp-st"><i></i>Em operação</div>
    <div class="vp-grid">
      <div><small>Ano</small><b>${esc(v.anoModelo||'—')}</b></div>
      <div><small>KM atual</small><b>${v.kmAtual!=null?num(v.kmAtual)+' km':'—'}</b></div>
      <div><small>Renavam</small><b>${esc(v.renavam||'—')}</b></div>
      <div><small>Status</small><b>${esc(v.status||'Ativo')}</b></div>
    </div>
    <div class="vp-note">${svg('route')} Rastreamento em tempo real: aguardando rastreador.</div>
    <div class="vp-links">
      <a href="#frota/${v.id}" onclick="iniFecharVeic()">${svg('truck')} Ficha do veículo</a>
      <a href="#pneus/${v.id}" onclick="iniFecharVeic()">${svg('tire')} Pneus</a>
      <a href="#abastecimento" onclick="iniFecharVeic()">${svg('fuel')} Abastecimentos</a>
      <a href="#viagens" onclick="iniFecharVeic()">${svg('route')} Viagens</a>
    </div>`;
  p.classList.add('show');
}
/* Command Center — zoom do mapa (visual, ao redor da base Londrina) */
var _ccZoom=1;
function iniMapZoom(d,reset){ _ccZoom=reset?1:Math.max(1,Math.min(2.4, _ccZoom+d));
  const g=document.getElementById('ccZoom'); if(g){ g.style.transformOrigin='440px 258px'; g.style.transform='scale('+_ccZoom+')'; } }
/* clima REAL de Londrina (mesma fonte do cockpit) no chip da base */
function iniBaseWx(){ const g=document.getElementById('iniBaseWx'); if(!g) return;
  try{ const c=JSON.parse(localStorage.getItem('pex_weather')||'null'); if(c && c.temp!=null){ const t=g.querySelector('text'); if(t) t.textContent=c.temp+'°'; } }catch(e){} }
function iniCountUp(){
  const els=document.querySelectorAll('.ini-cmd .num[data-count]');
  const ic=document.getElementById('iniClock'); if(ic){ const d=new Date(); ic.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  els.forEach(function(el){ const target=+el.getAttribute('data-count')||0, pre=el.getAttribute('data-pre')||'', suf=el.getAttribute('data-suf')||'';
    if(reduce){ el.textContent=pre+target.toLocaleString('pt-BR')+suf; return; }
    let start=null; const dur=900;
    function step(ts){ if(!start)start=ts; const p=Math.min(1,(ts-start)/dur); const val=Math.round(target*(1-Math.pow(1-p,3)));
      el.textContent=pre+val.toLocaleString('pt-BR')+suf; if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
}

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
  const viagens=DB.viagens.length;
  const cteSum=(DB.ctes||[]).reduce((s,c)=>{ const v=(c.valor!=null&&c.valor!=='')?c.valor:(c.vTPrest||0);
    const n=(typeof v==='number')?v:(parseFloat(String(v).replace(/[^\d.,-]/g,'').replace(/\./g,'').replace(',','.'))||0); return s+n; },0);
  const cteK=Math.round(cteSum/1000);
  const spark=(color,pts)=>`<svg class="ini-spark" viewBox="0 0 80 26" preserveAspectRatio="none"><polyline class="cy-spark-line" points="${pts}" pathLength="1" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const kt=(ico,cls,val,pre,suf,label,href,color,pts)=>`<a class="ini-kpi ${cls}" href="#${href}"><span class="ic">${svg(ico)}</span><span class="num" data-count="${val}" data-pre="${pre||''}" data-suf="${suf||''}">${pre||''}0${suf||''}</span><span class="l">${label}</span>${spark(color,pts)}</a>`;
  const cav=iniCavalos();
  const rotas=['pxr1','pxr2','pxr3','pxr4','pxr1'], durs=[24,28,20,26,23], begs=['0','-14','0','-10','-8'];
  const trucks=cav.map((v,i)=>`<g class="ini-veh" data-tip="${esc(v.placa)}" onclick="iniAbrirVeic('${esc(v.placa)}')"><circle class="ring" r="13"/><use href="#iniTruck"/><animateMotion dur="${durs[i%5]}s" begin="${begs[i%5]}s" rotate="auto" repeatCount="indefinite"><mpath href="#${rotas[i%5]}"/></animateMotion></g>`).join('');
  const cidades=[['MARINGÁ',185,150],['PAIÇANDU',108,200],['CAMBÉ',330,368],['IBIPORÃ',548,360]];
  const cidadesSVG=cidades.map(c=>`<g class="cc-city">
      <circle class="cc-cring" cx="${c[1]}" cy="${c[2]}" r="13"/>
      <circle class="cc-cglow" cx="${c[1]}" cy="${c[2]}" r="7.5"/>
      <circle class="cc-cdot" cx="${c[1]}" cy="${c[2]}" r="3.4"/>
      <text class="cc-cname" x="${c[1]}" y="${c[2]-18}" text-anchor="middle">${esc(c[0])}</text>
      <g class="cc-csig" transform="translate(${c[1]},${c[2]+21})"><rect x="-23" y="-8" width="46" height="15" rx="7.5"/><circle cx="-14" cy="-.5" r="2.6"/><text x="4" y="3.6" text-anchor="middle">ONLINE</text></g>
    </g>`).join('');
  const roads=[['PR-323',300,126],['PR-445',248,214],['PR-369',372,334],['PR-090',500,300]];
  const roadsSVG=roads.map(r=>`<g class="cc-road" transform="translate(${r[1]},${r[2]})"><rect x="-25" y="-8" width="50" height="16" rx="4"/><text y="3.6" text-anchor="middle">${r[0]}</text></g>`).join('');
  const gridL=`${[110,220,330,440].map(y=>`<line x1="0" y1="${y}" x2="640" y2="${y}"/>`).join('')}${[130,260,390,520].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="520"/>`).join('')}`;
  return `<div class="ini-cmd">
  <div class="ini-top">
    <div class="ini-brand"><div class="mk"><img src="assets/logo.png" alt=""></div><div class="tx"><b>PLANETA EXPRESS</b><span>Centro de Comando Operacional</span></div></div>
    <div class="ini-status"><span class="live"><i></i>Operação ativa</span><span class="clk" id="iniClock">--:--</span></div>
  </div>

  <div class="grid ini-mon2">
    <div class="ini-left">
      ${kt('truck','', cavalos+reb, '', '', 'Veículos ativos', 'frota', '#5cc8ff', '0,20 16,16 32,18 48,10 64,13 80,6')}
      ${kt('user','', mot, '', '', 'Motoristas ativos', 'motoristas', '#4bd6a0', '0,18 16,15 32,17 48,13 64,9 80,11')}
    </div>
    <div class="ini-stage card">
      <div class="ini-stage-h"><b>Monitoramento</b><div class="r"><span class="pex-live">● AO VIVO</span><a class="btn sm" href="#viagens">Viagens</a></div></div>
      <div class="pex-map pex-map-hero ini-map ini-map-half cc-map" id="pexDashMap">
        <svg viewBox="0 0 640 520" preserveAspectRatio="xMidYMid meet" class="cc-svg">
          <defs>
            <pattern id="ccHex" width="34" height="30" patternUnits="userSpaceOnUse"><path d="M17 0 L34 8.6 L34 21.4 L17 30 L0 21.4 L0 8.6 Z" fill="none" stroke="rgba(0,190,255,.055)" stroke-width="1"/></pattern>
            <linearGradient id="pexRg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#40f8ff"/><stop offset="1" stop-color="#0077ff"/></linearGradient>
            <radialGradient id="beamG" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="156"><stop offset="0" stop-color="rgba(0,229,255,.32)"/><stop offset="1" stop-color="rgba(0,229,255,0)"/></radialGradient>
            <radialGradient id="ccBaseG" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(0,229,255,.5)"/><stop offset=".5" stop-color="rgba(0,150,255,.16)"/><stop offset="1" stop-color="rgba(0,150,255,0)"/></radialGradient>
            <g id="iniTruck"><ellipse class="tk-shadow" cx="0" cy="6" rx="10" ry="2.4"/><rect class="tk-body" x="-9" y="-4.6" width="13" height="9.2" rx="2.6"/><rect class="tk-cab" x="4" y="-3.8" width="6.4" height="7.6" rx="1.7"/><rect class="tk-head" x="9.7" y="-2.3" width="1.8" height="4.6" rx=".9"/><rect class="tk-tail" x="-9.8" y="-3" width="1.5" height="6" rx=".75"/></g>
          </defs>
          <rect class="cc-hex" x="0" y="0" width="640" height="520" fill="url(#ccHex)"/>
          <g class="cc-grid">${gridL}</g>
          <g id="ccZoom" class="cc-zoom">
            <polyline class="cc-corridor" points="440,258 185,150 108,200"/><polyline class="cc-corridor" points="440,258 330,368"/><polyline class="cc-corridor" points="440,258 548,360"/>
            <path id="pxr1" class="cc-route" d="M440 258 Q305 175 185 150"/>
            <path id="pxr2" class="cc-route" d="M440 258 Q255 235 108 200"/>
            <path id="pxr3" class="cc-route" d="M440 258 Q395 325 330 368"/>
            <path id="pxr4" class="cc-route" d="M440 258 Q505 300 548 360"/>
            <use href="#pxr1" class="cc-flow"/><use href="#pxr2" class="cc-flow"/><use href="#pxr3" class="cc-flow"/><use href="#pxr4" class="cc-flow"/>
            ${roadsSVG}
            <circle cx="440" cy="258" r="92" fill="url(#ccBaseG)"/>
            <g class="cc-base" transform="translate(440 258)">
              <circle class="cc-radar" r="24"/><circle class="cc-radar d1" r="24"/><circle class="cc-radar d2" r="24"/>
              <g class="cc-beam"><path d="M0 0 L150 -44 A156 156 0 0 1 150 44 Z" fill="url(#beamG)"/><animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/></g>
              <circle class="cc-ring2" r="40"/><circle class="cc-ring2 b" r="58"/>
              <circle class="cc-core-g" r="20"/><circle class="cc-core" r="8.5"/><circle class="cc-core2" r="4.2"/>
            </g>
            <text class="cc-baseName" x="440" y="226" text-anchor="middle">LONDRINA</text>
            <text class="cc-baseSub" x="440" y="240" text-anchor="middle">BASE OPERACIONAL</text>
            <g class="cc-wx" id="iniBaseWx" transform="translate(440,292)"><rect x="-27" y="-1" width="54" height="17" rx="8.5"/><text x="0" y="11" text-anchor="middle">--°</text></g>
            ${cidadesSVG}
            ${trucks}
          </g>
        </svg>
        <div class="cc-controls no-print">
          <button class="cc-ctl" onclick="iniMapZoom(.3)" title="Aproximar" aria-label="Aproximar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="cc-ctl" onclick="iniMapZoom(-.3)" title="Afastar" aria-label="Afastar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>
          <button class="cc-ctl" onclick="iniMapZoom(0,true)" title="Centralizar" aria-label="Centralizar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>
          <button class="cc-ctl" title="Camadas" aria-label="Camadas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/></svg></button>
        </div>
        <div class="pex-skel-ov" id="pexMapSkel"><span>Conectando ao monitoramento…</span></div>
        <aside class="ini-vpanel" id="iniVeicPanel"></aside>
      </div>
    </div>
  </div>
  </div>`;
}

/* ================================================================== */
/*  SEGUROS / APÓLICES                                                 */
/* ================================================================== */
let segFiltro='todos';
let APOLICE_FILA=[];   // arquivos aguardando anexar (envio de apólice)
const RAMO_COR={carga:'#f2a44e',frota:'#5cc8ff',auto:'#8b9dff',vida:'#4bd6a0'};
function segCor(r){ return RAMO_COR[r]||'#8b9dff'; }
/* Prêmio em texto (apólices de averbação não têm prêmio anual fixo) */
function segPremioTxt(s){ if(s.premio==null||s.premio==='') return 'Averbação'; return money(s.premio); }
/* Situação da apólice (respeita cancelamento) */
function segSit(s){ if(s.status==='Cancelado') return {cls:'neutro',label:'Cancelado',dias:null,ord:9}; return situacao(s.fim); }

function viewSeguros(){
  const all = (DB.seguros||[]).slice();
  const ativos = all.filter(s=>s.status!=='Cancelado');
  const cancelados = all.filter(s=>s.status==='Cancelado');

  /* KPIs (sobre as apólices ativas) */
  const premioAnual = ativos.reduce((t,s)=>t+(Number(s.premio)||0),0);
  const dias = s=>diasAte(s.fim);
  const aVencer = ativos.filter(s=>{ const d=dias(s); return d!=null && d>=0 && d<=90; });
  const vencidas = ativos.filter(s=>{ const d=dias(s); return d!=null && d<0; });

  const kseg=(ico,val,label,sub,cor,filtro,ativoCor)=>{ const on=filtro&&segFiltro===filtro;
    return `<a class="kpi ${filtro?'link':''} ${on?'ativo':''}" ${filtro?`style="cursor:pointer" onclick="segFiltro='${on?'todos':filtro}';router()"`:''}>
      <div class="k-top"><div class="k-ico" style="color:${cor};background:${cor}1f">${svg(ico)}</div>${filtro?'<span class="k-go">→</span>':''}</div>
      <div class="k-val" style="${ativoCor&&val!=='0'?`color:${cor}`:''}">${val}</div><div class="k-label">${label}</div>${sub?`<div class="k-sub">${sub}</div>`:''}</a>`; };

  /* Próximas renovações (ativas que vencem em até 180 dias, das mais próximas) */
  const renov = ativos.filter(s=>{ const d=dias(s); return d!=null && d<=180; }).sort((a,b)=>dias(a)-dias(b));
  const renovBox = renov.length? `
    <div class="card" style="margin-bottom:16px">
      <div class="card-h">${svg('bell')}<h3>Próximas renovações</h3><div class="r"><span class="muted" style="font-size:11.5px">clique para abrir a apólice</span></div></div>
      <div class="card-b p0">
        ${renov.map(s=>{ const st=situacao(s.fim); const ic=st.ord===0?'i-red':st.ord===1?'i-orange':st.ord===2?'i-amber':'i-green';
          return `<div class="alert-row" onclick="modalSeguro('${s.id}')">
            <div class="a-ico ${ic}">${svg('umbrella')}</div>
            <div class="a-main"><b>${esc(ramoLabel(s.ramo))} — ${esc(s.seguradora)}</b><span>Apólice ${esc(s.apolice)}${s.objeto?' · '+esc(s.objeto):''}</span></div>
            <div class="a-when"><span class="st ${st.cls}">${st.label}</span><div class="muted" style="font-size:11px;text-align:right">${fmtD(s.fim)}</div></div>
          </div>`; }).join('')}
      </div>
    </div>` : '';

  /* Lista conforme o filtro ativo */
  let lista = ativos.slice();
  if(segFiltro==='avencer') lista = aVencer.slice();
  else if(segFiltro==='vencidos') lista = vencidas.slice();
  else if(['auto','frota','carga','vida'].indexOf(segFiltro)>=0) lista = ativos.filter(s=>s.ramo===segFiltro);
  else if(segFiltro==='cancelados') lista = cancelados.slice();

  /* Agrupa por segurado (titular) — ordem: empresa → funcionários → sócios */
  const rank={empresa:0,func:1,socio:2};
  const grupos={};
  lista.forEach(s=>{ const k=s.segurado||s.seguradora||'—'; (grupos[k]=grupos[k]||{nome:k,grupo:s.grupo||'empresa',items:[]}).items.push(s); });
  const ordem=Object.values(grupos).sort((a,b)=>(rank[a.grupo]??3)-(rank[b.grupo]??3) || a.nome.localeCompare(b.nome,'pt'));

  const row=(s)=>{ const st=segSit(s); const cor=segCor(s.ramo);
    return `<tr style="cursor:pointer" onclick="modalSeguro('${s.id}')">
      <td><span class="seg-tag" style="--c:${cor}">${esc(ramoLabel(s.ramo))}</span></td>
      <td><b>${esc(s.seguradora)}</b><div class="muted" style="font-size:11.5px">${esc(s.tipo||'')}</div></td>
      <td class="mono">${esc(s.apolice||'—')}${s.endosso?`<div class="muted" style="font-size:11px">endosso ${esc(s.endosso)}</div>`:''}<div class="seg-anexo-cell">${_segAnexo(s)}</div></td>
      <td>${esc(s.objeto||'—')}${s.cobertura?`<div class="muted" style="font-size:11px">${esc(s.cobertura)}</div>`:''}</td>
      <td class="mono" style="white-space:nowrap">${fmtD(s.inicio)} <span class="muted">→</span> <b>${fmtD(s.fim)}</b></td>
      <td><span class="st ${st.cls}">${st.label}</span></td>
      <td class="ta-r" style="white-space:nowrap"><b class="mono">${segPremioTxt(s)}</b>${s.pagamento?`<div class="muted" style="font-size:11px">${esc(s.pagamento)}</div>`:''}</td>
    </tr>`; };

  const grupoCard=(g)=>{ const tot=g.items.reduce((t,s)=>t+(Number(s.premio)||0),0);
    const gico=g.grupo==='socio'?'user':(g.grupo==='func'?'user':'briefcase');
    return `<div class="card" style="margin-bottom:16px">
      <div class="card-h">${svg(gico)}<h3>${esc(g.nome)}</h3>
        <div class="r"><span class="muted" style="font-size:12px">${g.items.length} apólice(s)${tot?' · '+money(tot)+'/ano':''}</span></div></div>
      <div class="tbl-wrap"><table class="tbl pex-noenh">
        <thead><tr><th>Ramo</th><th>Seguradora</th><th>Apólice</th><th>Objeto</th><th>Vigência</th><th>Situação</th><th class="ta-r">Prêmio</th></tr></thead>
        <tbody>${g.items.map(row).join('')}</tbody></table></div>
    </div>`; };

  const filtroLabel={avencer:'a vencer (90 dias)',vencidos:'vencidas',auto:'Automóvel',frota:'Frota',carga:'Carga',vida:'Vida',cancelados:'canceladas'}[segFiltro];

  return `
  <div class="banner">${svg('umbrella')}<div><b>Seguros — apólices e vigências</b><span>Controle de todas as apólices da empresa e dos sócios: seguradora, número, vigência, prêmio e avisos de renovação. As apólices ativas também aparecem em Vencimentos e no Painel de Controle.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="modalEnviarApolice()">${svg('upload')} Enviar apólice</button>
      <button class="btn primary" onclick="modalSeguro()">${svg('plus')} Novo seguro</button>
    </div></div>

  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kseg('umbrella', String(ativos.length), 'Apólices ativas', cancelados.length?cancelados.length+' cancelada(s)':'', '#5c99ff', '')}
    ${kseg('coins', moneyK(premioAnual), 'Prêmio anual', 'somando as ativas', '#4bd6a0', '')}
    ${kseg('bell', String(aVencer.length), 'A vencer (90 dias)', 'renovação próxima', '#f2a44e', 'avencer', true)}
    ${kseg('shield', String(vencidas.length), 'Vencidas', 'renovar já', '#f2686b', 'vencidos', true)}
  </div>

  ${segFiltro==='todos'? renovBox : ''}

  <div class="toolbar">
    <select class="selectlite" onchange="segFiltro=this.value;router()">
      <option value="todos" ${segFiltro==='todos'?'selected':''}>Todos os ramos (ativos)</option>
      <option value="auto" ${segFiltro==='auto'?'selected':''}>Automóvel</option>
      <option value="frota" ${segFiltro==='frota'?'selected':''}>Frota</option>
      <option value="carga" ${segFiltro==='carga'?'selected':''}>Carga (RCTR-C / RC-DC)</option>
      <option value="vida" ${segFiltro==='vida'?'selected':''}>Vida</option>
      <option value="avencer" ${segFiltro==='avencer'?'selected':''}>A vencer (90 dias)</option>
      <option value="vencidos" ${segFiltro==='vencidos'?'selected':''}>Vencidas</option>
      <option value="cancelados" ${segFiltro==='cancelados'?'selected':''}>Canceladas</option>
    </select>
    ${segFiltro!=='todos'?`<button class="btn sm no-print" onclick="segFiltro='todos';router()">${svg('list')} Ver todos</button><span class="muted" style="font-size:12.5px">filtro: ${esc(filtroLabel||'')}</span>`:''}
    <div class="spacer"></div>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button>
  </div>

  ${ordem.length? ordem.map(grupoCard).join('') : `<div class="card"><div class="card-b">${emptyState('Nenhuma apólice neste filtro.')}</div></div>`}

  ${(segFiltro==='todos' && cancelados.length)? `
    <div class="card" style="margin-top:4px;opacity:.85">
      <div class="card-h">${svg('umbrella')}<h3>Canceladas</h3><div class="r"><span class="muted" style="font-size:12px">${cancelados.length} apólice(s)</span></div></div>
      <div class="tbl-wrap"><table class="tbl pex-noenh">
        <thead><tr><th>Ramo</th><th>Seguradora</th><th>Apólice</th><th>Objeto</th><th>Vigência</th><th>Situação</th><th class="ta-r">Prêmio</th></tr></thead>
        <tbody>${cancelados.map(row).join('')}</tbody></table></div>
    </div>` : ''}`;
}

function modalSeguro(id){
  const s = id? (DB.seguros||[]).find(x=>x.id===id) : {ramo:'auto',tipo:'',seguradora:'',apolice:'',endosso:'',segurado:'',grupo:'empresa',objeto:'',placa:'',inicio:'',fim:'',premio:'',pagamento:'',cobertura:'',status:'Ativo',obs:''};
  if(!s){ toast('Seguro não encontrado.','err'); return; }
  const opt=(v,cur,lab)=>`<option value="${v}" ${cur===v?'selected':''}>${lab}</option>`;
  const anexo = id? _segAnexo(s) : '';
  openModal(`<div class="m-h">${svg('umbrella')}<h3>${id?'Editar seguro':'Novo seguro'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">
        <div class="field"><label>Ramo</label><select id="f_ramo">
          ${opt('auto',s.ramo,'Automóvel')}${opt('frota',s.ramo,'Frota')}${opt('carga',s.ramo,'Carga (RCTR-C / RC-DC)')}${opt('vida',s.ramo,'Vida')}${opt('outro',s.ramo,'Outro')}
        </select></div>
        <div class="field"><label>Grupo / titular</label><select id="f_grupo">
          ${opt('empresa',s.grupo,'Empresa')}${opt('socio',s.grupo,'Sócio')}${opt('func',s.grupo,'Funcionários')}
        </select></div>
      </div>
      ${fld('Descrição do seguro','f_tipo',s.tipo,'text','Ex.: Seguro de Automóvel, RCTR-C, Vida em Grupo')}
      <div class="field-row">${fld('Seguradora','f_seg',s.seguradora)}${fld('Nº da apólice','f_apolice',s.apolice)}</div>
      <div class="field-row">${fld('Endosso (se houver)','f_endosso',s.endosso)}${fld('Segurado / titular','f_segurado',s.segurado)}</div>
      <div class="field-row">${fld('Objeto (o que cobre)','f_objeto',s.objeto,'text','Placa, "Frota", "Carga", nome…')}${fld('Placa (se veículo)','f_placa',s.placa)}</div>
      <div class="field-row">${fld('Início da vigência','f_inicio',s.inicio,'date')}${fld('Fim da vigência (vencimento)','f_fim',s.fim,'date')}</div>
      <div class="field-row">${fldR$('Prêmio total (R$/ano)','f_premio',s.premio)}${fld('Forma de pagamento','f_pgto',s.pagamento,'text','Ex.: 12x Boleto, 10x Cartão')}</div>
      ${fld('Cobertura / importância segurada','f_cobertura',s.cobertura,'text','Ex.: Limite de garantia R$ 1.000.000')}
      <div class="field"><label>Status</label><select id="f_status">${opt('Ativo',s.status,'Ativo')}${opt('Cancelado',s.status,'Cancelado')}</select></div>
      <div class="field"><label>Observação</label><textarea id="f_obs" rows="2">${esc(s.obs||'')}</textarea></div>
      ${id?`<div class="field"><label>Apólice (PDF / imagem)</label><div>${anexo}</div><div class="hint">Anexe aqui o PDF da apólice para guardar junto do registro.</div></div>`:`<div class="hint">Salve o seguro para poder anexar o PDF da apólice.</div>`}
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirSeguro('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarSeguro('${id||''}')">Salvar</button></div>`);
}
function salvarSeguro(id){
  if(!val('f_seg')){ toast('Informe a seguradora.','err'); return; }
  const pr=val('f_premio').trim();
  const d={ ramo:val('f_ramo'), tipo:val('f_tipo'), seguradora:val('f_seg'), apolice:val('f_apolice'), endosso:val('f_endosso'),
    segurado:val('f_segurado'), grupo:val('f_grupo'), objeto:val('f_objeto'), placa:val('f_placa'),
    inicio:val('f_inicio'), fim:val('f_fim'), premio: pr? parseBRL(pr) : null, pagamento:val('f_pgto'),
    cobertura:val('f_cobertura'), status:val('f_status'), obs:val('f_obs') };
  if(id){ Object.assign((DB.seguros||[]).find(x=>x.id===id), d); }
  else { d.id=uid('s'); (DB.seguros=DB.seguros||[]).push(d); }
  saveDB(); closeModal(); toast('Seguro salvo.'); router();
}
function excluirSeguro(id){ if(!confirm('Excluir esta apólice do controle?'))return; DB.seguros=(DB.seguros||[]).filter(x=>x.id!==id); saveDB(); closeModal(); toast('Apólice excluída.'); router(); }

/* ---------- ENVIAR APÓLICE (lê o arquivo, detecta o seguro certo e anexa) ---------- */
/* Leitura profissional: pdf.js extrai o texto real (inclui apólices da Tokio/
   Allianz com object streams que o leitor interno não abre); se a página for
   escaneada (sem texto), renderiza e passa OCR (Tesseract). Sem as libs (offline),
   cai no leitor interno pexLerPdfTexto. */
function _pdfjs(){ return (typeof window!=='undefined' && window.pdfjsLib) ? window.pdfjsLib : null; }
function _tess(){ return (typeof window!=='undefined' && window.Tesseract) ? window.Tesseract : null; }
async function _pdfDoc(file){
  const lib=_pdfjs(); if(!lib) return null;
  try{ if(lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; }catch(e){}
  const buf=await file.arrayBuffer();
  return await lib.getDocument({data:new Uint8Array(buf), isEvalSupported:false}).promise;
}
async function _ocrCanvas(canvas, onProgress){
  const T=_tess(); if(!T) return '';
  try{ const r=await T.recognize(canvas,'por',onProgress?{logger:m=>{ if(m.status==='recognizing text') onProgress('OCR '+Math.round((m.progress||0)*100)+'%'); }}:undefined); return (r&&r.data&&r.data.text)||''; }
  catch(e){ return ''; }
}
async function _ocrPagina(page, onProgress){
  try{
    const vp=page.getViewport({scale:2.0});
    const canvas=document.createElement('canvas'); canvas.width=vp.width; canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'), viewport:vp}).promise;
    return await _ocrCanvas(canvas, onProgress);
  }catch(e){ return ''; }
}
async function _ocrImagem(file, onProgress){
  const T=_tess(); if(!T) return '';
  const url=URL.createObjectURL(file);
  try{ const r=await T.recognize(url,'por',onProgress?{logger:m=>{ if(m.status==='recognizing text') onProgress('OCR '+Math.round((m.progress||0)*100)+'%'); }}:undefined); return (r&&r.data&&r.data.text)||''; }
  catch(e){ return ''; } finally{ try{ URL.revokeObjectURL(url); }catch(_){} }
}
/* Lê o texto de um arquivo de apólice do jeito mais forte possível */
async function pexLerApoliceTexto(file, onProgress){
  const nome=file.name||'';
  const isPdf=/\.pdf$/i.test(nome) || file.type==='application/pdf';
  const isImg=/^image\//.test(file.type||'') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(nome);
  let text='';
  if(isPdf){
    let doc=null;
    if(_pdfjs()){ try{ doc=await _pdfDoc(file); }catch(e){ doc=null; } }
    if(doc){
      const np=Math.min(doc.numPages,5);
      for(let p=1;p<=np;p++){
        try{
          const page=await doc.getPage(p);
          const tc=await page.getTextContent();
          let ptxt=tc.items.map(it=>it.str).join(' ');
          if(ptxt.replace(/\s/g,'').length<40 && _tess()){ if(onProgress)onProgress('lendo imagem pág. '+p); ptxt+=' '+await _ocrPagina(page,onProgress); }
          text+=' '+ptxt;
        }catch(e){}
      }
      try{ doc.destroy&&doc.destroy(); }catch(e){}
    }
    if(text.replace(/\s/g,'').length<40){ try{ text+=' '+(await pexLerPdfTexto(file)||''); }catch(e){} }  // fallback leitor interno
  } else if(isImg){
    if(_tess()){ if(onProgress)onProgress('lendo imagem'); text=await _ocrImagem(file,onProgress); }
  }
  return text;
}
/* Descobre a qual seguro o arquivo pertence (nº da apólice/endosso, placa,
   seguradora, titular e tipo/ramo) casando no NOME + TEXTO lido do arquivo. */
function _apoliceMatch(nome, texto){
  const raw=((nome||'')+' \n '+(texto||''));
  const hay=raw.toLowerCase();
  const haynum=hay.replace(/[^0-9]/g,'');
  const haya=hay.replace(/[^a-z0-9]/g,'');
  let best='', bestScore=0, bestWhy='';
  (DB.seguros||[]).forEach(s=>{
    let sc=0; const why=[];
    const ap=String(s.apolice||'').replace(/[^0-9]/g,'');
    if(ap.length>=5 && haynum.indexOf(ap)>=0){ sc+=100; why.push('nº da apólice'); }
    const en=String(s.endosso||'').replace(/[^0-9]/g,'');
    if(en.length>=5 && en!==ap && haynum.indexOf(en)>=0){ sc+=45; why.push('endosso'); }
    const pl=String(s.placa||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    if(pl.length>=6 && haya.indexOf(pl)>=0){ sc+=70; why.push('placa'); }
    const toks=(s.seguradora||'').toLowerCase().split(/[\s/]+/).filter(t=>t.length>=3);
    toks.forEach((t,i)=>{ if(hay.indexOf(t)>=0){ sc+=(i===0?18:10); if(i===0)why.push('seguradora'); } });
    if(s.grupo==='socio' && s.segurado){ const nm=(s.segurado.split(/\s+/)[0]||'').toLowerCase(); if(nm.length>=4 && hay.indexOf(nm)>=0){ sc+=14; why.push('titular'); } }
    const kwMap={carga:['rctr','rc-dc','rcdc','rc dc','desaparecimento','transportador rodovi','carga'],vida:['vida'],frota:['frota'],auto:['autom','automóvel','automovel']};
    (kwMap[s.ramo]||[]).forEach(k=>{ if(hay.indexOf(k)>=0) sc+=8; });
    if(s.ramo==='vida'){ if(s.grupo==='func' && /vida\s+em\s+grupo|em\s+grupo/.test(hay)) sc+=14; if(s.grupo==='socio' && /individual/.test(hay)) sc+=14; }
    if(sc>bestScore){ bestScore=sc; best=s.id; bestWhy=why.join(', '); }
  });
  return {id:bestScore>0?best:'', score:bestScore, reason:bestWhy};
}
function modalEnviarApolice(){
  openModal(`<div class="m-h">${svg('upload')}<h3>Enviar apólice</h3><button class="x" onclick="APOLICE_FILA=[];closeModal()">×</button></div>
    <div class="m-b">
      <label class="apo-drop" id="apoDrop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="_apoliceDrop(event)">
        <input type="file" accept=".pdf,image/*" multiple style="display:none" onchange="_apoliceLer(this.files);this.value=''">
        ${svg('upload')}<b>Solte os PDFs das apólices aqui ou clique para escolher</b>
        <span>O sistema lê cada arquivo e descobre sozinho a qual seguro ele pertence. Você confere e confirma.</span>
      </label>
      <div id="apoFila">${_apoliceFilaHTML()}</div>
    </div>
    <div class="m-f">
      <button class="btn" onclick="APOLICE_FILA=[];closeModal()">Fechar</button>
      <button class="btn primary" id="apoBtn" onclick="_apoliceAnexar()" ${APOLICE_FILA.length?'':'disabled'}>Anexar ${APOLICE_FILA.filter(f=>f.matchId).length||''} apólice(s)</button>
    </div>`, true);
}
function _apoliceFilaHTML(){
  if(!APOLICE_FILA.length) return `<div class="hint" style="margin-top:12px">Nenhum arquivo escolhido ainda.</div>`;
  return `<div class="apo-list">`+APOLICE_FILA.map((f,i)=>{
    if(f.status==='reading'){
      return `<div class="apo-row reading">
        <div class="apo-file">${svg('doc')}<span title="${esc(f.nome)}">${esc(f.nome)}</span></div>
        <div class="apo-reading"><span class="apo-spin"></span>Lendo${f.hint?' · '+esc(f.hint):'…'}</div>
      </div>`;
    }
    const conf = f.matchId? (f.score>=60?'ok':'warn') : 'crit';
    const lab = f.matchId? (f.score>=60?'Detectado':'Confira') : 'Escolha o seguro';
    return `<div class="apo-row">
      <div class="apo-file">${svg('doc')}<span title="${esc(f.nome)}">${esc(f.nome)}</span>${f.matchId&&f.reason?`<small class="apo-why">${esc(f.reason)}</small>`:''}</div>
      <select class="selectlite" onchange="APOLICE_FILA[${i}].matchId=this.value;_apoliceRefresh()">
        <option value="">— Escolha o seguro —</option>
        ${(DB.seguros||[]).map(s=>`<option value="${s.id}" ${f.matchId===s.id?'selected':''}>${esc(ramoLabel(s.ramo))} · ${esc(s.seguradora)} · ${esc(s.apolice)}${s.segurado?' ('+esc((s.segurado||'').split(/\s|—/)[0])+')':''}</option>`).join('')}
      </select>
      <span class="st ${conf}">${lab}</span>
      <button class="btn ghost sm" title="Remover" onclick="_apoliceRemove(${i})">${svg('trash')}</button>
    </div>`;
  }).join('')+`</div>`;
}
function _apoliceRefresh(){ const el=document.getElementById('apoFila'); if(el) el.innerHTML=_apoliceFilaHTML();
  const b=document.getElementById('apoBtn'); if(b){ const lendo=APOLICE_FILA.some(f=>f.status==='reading'); const n=APOLICE_FILA.filter(f=>f.matchId).length;
    b.disabled=!APOLICE_FILA.length||lendo; b.innerHTML=lendo?'Lendo arquivos…':('Anexar '+(n||'')+' apólice(s)'); } }
function _apoliceRemove(i){ APOLICE_FILA.splice(i,1); _apoliceRefresh(); }
function _apoliceDrop(e){ e.preventDefault(); const el=e.currentTarget; if(el)el.classList.remove('over'); if(e.dataTransfer&&e.dataTransfer.files) _apoliceLer(e.dataTransfer.files); }
async function _apoliceLer(fileList){
  const files=[].slice.call(fileList||[]); if(!files.length) return;
  if(!IDB && !_online()){ toast('Upload indisponível neste navegador. Abra em Chrome ou Edge.','err'); return; }
  const start=APOLICE_FILA.length;
  files.forEach(f=>APOLICE_FILA.push({file:f, nome:f.name, matchId:'', score:0, reason:'', status:'reading', hint:''}));
  _apoliceRefresh();
  if(typeof pexBar==='function') pexBar(true);
  try{
    for(let k=0;k<files.length;k++){
      const idx=start+k, file=files[k];
      const prog=(msg)=>{ if(APOLICE_FILA[idx]){ APOLICE_FILA[idx].hint=msg; _apoliceRefresh(); } };
      let texto=''; try{ texto=await pexLerApoliceTexto(file, prog)||''; }catch(e){}
      const mt=_apoliceMatch(file.name, texto);
      if(APOLICE_FILA[idx]){ Object.assign(APOLICE_FILA[idx], {matchId:mt.id, score:mt.score, reason:mt.reason, status:'done', hint:''}); }
      _apoliceRefresh();
    }
  } finally { if(typeof pexBar==='function') pexBar(false); }
  _apoliceRefresh();
}
async function _apoliceAnexar(){
  const sel=APOLICE_FILA.filter(f=>f.matchId);
  if(!sel.length){ toast('Escolha a qual seguro pertence cada arquivo.','err'); return; }
  if(typeof pexBar==='function') pexBar(true);
  try{ for(const f of sel){ await subirUm(f.file,'seguro',f.matchId,'Apólice'); } await reloadFiles(); saveDB(); }
  finally { if(typeof pexBar==='function') pexBar(false); }
  APOLICE_FILA=[]; closeModal(); toast(sel.length+' apólice(s) anexada(s)'+(_online()?' e sincronizada(s).':'.')); location.hash='#seguros'; router();
}
/* Selo do arquivo da apólice, direto na lista: verde "Anexado" (ver) + baixar +
   trocar + remover; ou botão "Anexar" quando ainda não tem arquivo. */
function _segAnexo(s){
  const f=anexoTipo('seguro', s.id, /./);
  if(f){
    return `<span class="seg-anexo" onclick="event.stopPropagation()">`
      +`<span class="st ok" title="Ver ${esc(f.name)}" style="cursor:pointer" onclick="verArquivo('${f.id}')">${svg('clip')} Anexado</span>`
      +`<button class="btn ghost sm no-print" title="Baixar" onclick="baixarArquivo('${f.id}')">${svg('download')}</button>`
      +`<button class="btn ghost sm no-print" title="Trocar arquivo" onclick="_segTrocarAnexo('${s.id}','${f.id}')">${svg('edit')}</button>`
      +`<button class="btn ghost sm no-print" title="Remover" onclick="excluirArquivo('${f.id}')">${svg('trash')}</button>`
    +`</span>`;
  }
  return `<button class="btn ghost sm no-print" onclick="event.stopPropagation();uploadPara('seguro','${s.id}','Apólice')">${svg('upload')} Anexar apólice</button>`;
}
/* Troca (substitui) o arquivo anexado: sobe o novo e apaga o antigo */
function _segTrocarAnexo(ref, oldId){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.pdf,image/*';
  inp.onchange=async function(e){ const files=e.target.files; if(!files||!files.length) return;
    if(typeof pexBar==='function') pexBar(true);
    try{ await subirUm(files[0],'seguro',ref,'Apólice'); await _removerAnexoSilencioso(oldId); await reloadFiles(); saveDB(); toast('Apólice substituída.'); }
    catch(err){ toast('Não foi possível trocar: '+((err&&err.message)||''),'err'); }
    finally{ if(typeof pexBar==='function') pexBar(false); router(); }
  };
  inp.click();
}
async function _removerAnexoSilencioso(id){
  const a=(DB.anexos||[]).find(x=>x.id===id);
  if(a){ if(a.storagePath && typeof nuvemRemoverArquivo==='function'){ try{ await nuvemRemoverArquivo(a.storagePath); }catch(e){} } DB.anexos=DB.anexos.filter(x=>x.id!==id); }
  try{ await idbDel(id); }catch(e){}
}

/* ================================================================== */
/*  PEDÁGIOS — Centro de Inteligência (extrato Sem Parar)              */
/* ================================================================== */
let pedFiltro='todos';      // todos | mes | ano | personalizado
let pedTipo='todos';        // todos | Pedágio | Vale-pedágio
let pedDe='', pedAte='';
const PED_CONC_COR={ 'PRVIAS':'#00e5ff', 'EPR PARANÁ':'#4bd6a0', 'VIA ARAUCÁRIA':'#f2a44e', 'CCR':'#8b9dff', 'VIA ARAUCARIA':'#f2a44e' };
function _pedConcCor(c){ return PED_CONC_COR[c]||'#5c99ff'; }
function _pedNorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
/* Extrai rodovia/km/sentido/cidade do texto da praça */
function _pedInfo(praca){
  const p=String(praca||'');
  const rm=p.match(/\b(BR|PR)[\s\-]?0?(\d{2,3})\b/i);
  const rodovia= rm? (rm[1].toUpperCase()+'-'+rm[2]) : '';
  const km=(p.match(/KM\s*([\d]+(?:\+\d+)?)/i)||[])[1]||'';
  const sm=(p.match(/\b(NORTE|SUL|LESTE|OESTE)\b/i)||[])[1]||'';
  const sent=sm? sm.charAt(0)+sm.slice(1).toLowerCase() : '';
  const parts=p.split(',').map(s=>s.trim()).filter(Boolean);
  const cidade=parts.length? parts[parts.length-1] : '';
  return { rodovia, km, sentido:sent, cidade };
}
function _pedNaData(p){
  if(pedFiltro==='todos') return true;
  const d=parseD(p.data); if(!d) return false; const h=hoje();
  if(pedFiltro==='mes') return d.getMonth()===h.getMonth() && d.getFullYear()===h.getFullYear();
  if(pedFiltro==='ano') return d.getFullYear()===h.getFullYear();
  if(pedFiltro==='personalizado'){ const de=parseD(pedDe), at=parseD(pedAte); if(de&&d<de)return false; if(at&&d>at)return false; return true; }
  return true;
}
function _pedFiltradas(){ return (DB.pedagios||[]).filter(p=> _pedNaData(p) && (pedTipo==='todos'||p.tipo===pedTipo) ); }
function _pedCidade(p){ return (_pedInfo(p.praca).cidade||'').trim(); }
/* Alertas inteligentes sobre um conjunto de passagens */
function _pedAlertas(lista){
  const al=[];
  // duplicadas: mesma placa + data + hora + praça
  const seen={}; lista.forEach(p=>{ const k=p.placa+'|'+p.data+'|'+p.hora+'|'+p.praca+'|'+p.tipo; if(seen[k]) al.push({cls:'crit',t:'Passagem duplicada',s:p.placa+' · '+fmtD(p.data)+' '+p.hora+' · '+_pedCidade(p),id:p.id}); else seen[k]=1; });
  // TAG divergente: placa com mais de uma TAG
  const tags={}; lista.forEach(p=>{ (tags[p.placa]=tags[p.placa]||new Set()).add(p.tag||''); });
  Object.keys(tags).forEach(pl=>{ if(tags[pl].size>1) al.push({cls:'warn',t:'TAG divergente',s:pl+' aparece com '+tags[pl].size+' TAGs diferentes'}); });
  // categoria (eixos) divergente por veículo
  const cats={}; lista.forEach(p=>{ (cats[p.placa]=cats[p.placa]||new Set()).add(p.cat); });
  Object.keys(cats).forEach(pl=>{ if(cats[pl].size>2) al.push({cls:'warn',t:'Categoria divergente',s:pl+' passou em '+cats[pl].size+' categorias diferentes'}); });
  return al;
}
function viewPedagios(){
  const lista=_pedFiltradas();
  const total=lista.reduce((s,p)=>s+(+p.valor||0),0);
  const pago=lista.filter(p=>p.tipo==='Pedágio').reduce((s,p)=>s+(+p.valor||0),0);
  const vale=lista.filter(p=>p.tipo==='Vale-pedágio').reduce((s,p)=>s+(+p.valor||0),0);
  const qtd=lista.length;
  const ticket= qtd? total/qtd : 0;
  const veics=[...new Set(lista.map(p=>p.placa))];
  const custoVeic= veics.length? total/veics.length : 0;
  const pracas=[...new Set(lista.map(_pedCidade).filter(Boolean))];
  const concs=[...new Set(lista.map(p=>p.conc).filter(Boolean))];
  const alertas=_pedAlertas(lista);

  const kp=(ico,val,label,sub,cor,money1,href)=>`<a class="kpi ${href?'link':''}" ${href?`onclick="${href}" style="cursor:pointer"`:''}>
    <div class="k-top"><div class="k-ico" style="color:${cor};background:${cor}1f">${svg(ico)}</div>${href?'<span class="k-go">→</span>':''}</div>
    <div class="k-val" data-count="${val}" data-money="${money1?1:0}">${money1?'R$ 0':'0'}</div><div class="k-label">${label}</div>${sub?`<div class="k-sub">${sub}</div>`:''}</a>`;

  // ---- gráficos ----
  const meses={}; lista.forEach(p=>{ const ym=(p.data||'').slice(0,7); if(!ym)return; meses[ym]=(meses[ym]||0)+(+p.valor||0); });
  const mesData=Object.keys(meses).sort().map(ym=>{ const [y,m]=ym.split('-'); return {label:MESES[+m-1], value:Math.round(meses[ym]), vtxt:moneyK(meses[ym]) }; });
  const porConc={}; lista.forEach(p=>{ porConc[p.conc]=(porConc[p.conc]||0)+(+p.valor||0); });
  const concData=Object.keys(porConc).map(c=>({label:c, value:Math.round(porConc[c]), color:_pedConcCor(c)}));
  const porVeic={}; lista.forEach(p=>{ porVeic[p.placa]=(porVeic[p.placa]||0)+(+p.valor||0); });
  const veicData=Object.keys(porVeic).sort((a,b)=>porVeic[b]-porVeic[a]).map(pl=>({label:pl, value:Math.round(porVeic[pl]), vtxt:moneyK(porVeic[pl]), js:`pedBuscaPlaca('${pl}')`}));
  const porPraca={}; lista.forEach(p=>{ const c=_pedCidade(p)||p.praca; porPraca[c]=(porPraca[c]||0)+(+p.valor||0); });
  const pracaData=Object.keys(porPraca).sort((a,b)=>porPraca[b]-porPraca[a]).slice(0,8).map(c=>({label:c.length>10?c.slice(0,9)+'…':c, value:Math.round(porPraca[c]), vtxt:moneyK(porPraca[c])}));

  // ---- lista ----
  const linha=(p)=>{ const inf=_pedInfo(p.praca); const cor=_pedConcCor(p.conc);
    return `<tr style="cursor:pointer" onclick="pedAbrir('${p.id}')">
      <td class="mono" _pexKey>${fmtD(p.data)}</td><td class="mono">${esc(p.hora||'')}</td>
      <td>${plate(p.placa,'')}</td>
      <td>${esc(inf.cidade)}<div class="muted" style="font-size:11px">${esc(inf.rodovia)}${inf.km?' · KM '+esc(inf.km):''}${inf.sentido?' · '+esc(inf.sentido):''}</div></td>
      <td><span class="ped-tag" style="--c:${cor}">${esc(p.conc)}</span></td>
      <td class="mono">${p.cat||'—'}</td>
      <td>${p.tipo==='Vale-pedágio'?`<span class="st warn" title="Reembolsado por ${esc(p.emb||'embarcador')}">Vale (${esc(p.emb||'BRF')})</span>`:'<span class="st ok">Pago</span>'}</td>
      <td class="mono">${esc(p.viagem||'—')}</td>
      <td class="ta-r mono"><b>${money(p.valor)}</b></td>
    </tr>`; };

  const perChip=(k,l)=>`<button class="seg-b ${pedFiltro===k?'on':''}" onclick="pedFiltro='${k}';${k==='personalizado'?'pedPeriodoModal()':'router()'}">${l}</button>`;
  const tpChip=(k,l)=>`<button class="seg-b ${pedTipo===k?'on':''}" onclick="pedTipo='${k}';router()">${l}</button>`;

  return `
  <div class="banner">${svg('toll')}<div><b>Pedágios — centro de inteligência</b><span>Todas as passagens de pedágio da frota (extrato Sem Parar), com custos, praças, concessionárias, rotas e integração com viagens e financeiro.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="pedImportarModal()">${svg('upload')} Importar extrato</button>
      <button class="btn primary" onclick="pedModal()">${svg('plus')} Novo pedágio</button>
    </div></div>

  <div class="toolbar" style="gap:10px;flex-wrap:wrap">
    <div class="seg2">${perChip('todos','Todos')}${perChip('mes','Este mês')}${perChip('ano','Este ano')}${perChip('personalizado','Personalizado')}</div>
    <div class="seg2">${tpChip('todos','Tudo')}${tpChip('Pedágio','Pagos')}${tpChip('Vale-pedágio','Vale-pedágio')}</div>
    <div class="spacer"></div>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Relatório</button>
  </div>

  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:6px">
    ${kp('coins', Math.round(total), 'Total em pedágios', qtd+' passagens', '#00e5ff', 1)}
    ${kp('wallet', Math.round(pago), 'Pago pela empresa', 'débito direto', '#f2686b', 1, "pedTipo='Pedágio';router()")}
    ${kp('shield', Math.round(vale), 'Vale-pedágio (BRF)', 'reembolsado', '#4bd6a0', 1, "pedTipo='Vale-pedágio';router()")}
    ${kp('toll', qtd, 'Passagens', pracas.length+' praças', '#8b9dff', 0)}
  </div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kp('trend', Math.round(ticket), 'Ticket médio', 'por passagem', '#5cc8ff', 1)}
    ${kp('truck', Math.round(custoVeic), 'Custo médio', 'por veículo', '#e0b354', 1)}
    ${kp('map', pracas.length, 'Praças distintas', '', '#37e3d0', 0)}
    ${kp('clients', concs.length, 'Concessionárias', concs.join(' · '), '#8b9dff', 0)}
  </div>

  <div class="grid two-col">
    <div class="card"><div class="card-h">${svg('trend')}<h3>Gastos por mês</h3></div>
      <div class="card-b">${mesData.length?lineChart(mesData,{h:170}):emptyState('Sem passagens no período.')}</div></div>
    <div class="card"><div class="card-h">${svg('coins')}<h3>Pago × Vale-pedágio</h3></div>
      <div class="card-b"><div class="donut-wrap">
        ${donut([{label:'Pago pela empresa',value:Math.round(pago),color:'#f2686b'},{label:'Vale-pedágio (BRF)',value:Math.round(vale),color:'#4bd6a0'}],{center:moneyK(total),sub:'total'})}
        <div class="legend">
          <div class="li"><span class="dot" style="background:#f2686b"></span>Pago pela empresa<b>${money(pago)}</b></div>
          <div class="li"><span class="dot" style="background:#4bd6a0"></span>Vale-pedágio (BRF)<b>${money(vale)}</b></div>
        </div></div></div></div>
  </div>

  <div class="grid two-col" style="margin-top:16px">
    <div class="card"><div class="card-h">${svg('truck')}<h3>Gasto por veículo</h3></div>
      <div class="card-b">${veicData.length?barChart(veicData,{h:160}):emptyState('Sem dados.')}</div></div>
    <div class="card"><div class="card-h">${svg('clients')}<h3>Gasto por concessionária</h3></div>
      <div class="card-b"><div class="donut-wrap">
        ${donut(concData.map(c=>({label:c.label,value:c.value,color:c.color})),{center:concs.length,sub:'concess.'})}
        <div class="legend">${concData.sort((a,b)=>b.value-a.value).map(c=>`<div class="li"><span class="dot" style="background:${c.color}"></span>${esc(c.label)}<b>${money(c.value)}</b></div>`).join('')}</div>
      </div></div></div>
  </div>

  <div class="grid two-col" style="margin-top:16px">
    <div class="card"><div class="card-h">${svg('map')}<h3>Top praças por custo</h3></div>
      <div class="card-b">${pracaData.length?barChart(pracaData,{h:160}):emptyState('Sem dados.')}</div></div>
    <div class="card"><div class="card-h">${svg('bell')}<h3>Alertas inteligentes</h3><div class="r"><span class="st ${alertas.length?'warn':'ok'}">${alertas.length||'0'}</span></div></div>
      <div class="card-b p0">${alertas.length? alertas.slice(0,8).map(a=>`<div class="alert-row" ${a.id?`onclick="pedAbrir('${a.id}')"`:''}>
        <div class="a-ico ${a.cls==='crit'?'i-red':'i-amber'}">${svg('bell')}</div>
        <div class="a-main"><b>${esc(a.t)}</b><span>${esc(a.s)}</span></div></div>`).join('') : emptyState('Nenhuma inconsistência detectada. 👍')}</div></div>
  </div>

  <div class="card" style="margin-top:16px"><div class="card-h">${svg('map')}<h3>Mapa de praças</h3><div class="r"><span class="muted" style="font-size:11.5px">clique numa praça</span></div></div>
    <div class="card-b">${_pedMapa(lista)}</div></div>

  <div class="card" style="margin-top:16px"><div class="card-h">${svg('toll')}<h3>Passagens</h3><div class="r"><span class="muted" style="font-size:12px">${qtd} passagem(ns) · ${money(total)}</span></div></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Data</th><th>Hora</th><th>Veículo</th><th>Praça</th><th>Concessionária</th><th>Cat</th><th>Tipo</th><th>Viagem</th><th class="ta-r">Valor</th></tr></thead>
      <tbody>${lista.length? lista.slice().sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora)).map(linha).join('') : `<tr><td colspan="9">${emptyState('Nenhuma passagem neste filtro.')}</td></tr>`}</tbody>
    </table></div></div>

  <aside class="pn-panel" id="pedPanel"></aside>`;
}
/* Mapa estilizado das praças (base Londrina + praças como nós clicáveis) */
function _pedMapa(lista){
  const POS={ 'LONDRINA':[300,232],'ROLÂNDIA':[248,206],'ARAPONGAS':[212,190],'MANDAGUARI':[168,174],'MAUÁ DA SERRA':[364,256],'ORTIGUEIRA':[434,238],'IMBAÚ':[484,214],'TIBAGI':[530,198],'WITMARSUM':[602,186],'SÃO LUIZ DO PURUNÃ':[664,206] };
  const agg={}; lista.forEach(p=>{ const cid=_pedCidade(p).toUpperCase(); if(!cid)return; (agg[cid]=agg[cid]||{cid,n:0,v:0}); agg[cid].n++; agg[cid].v+=(+p.valor||0); });
  const nodes=Object.values(agg).filter(a=>POS[a.cid]);
  const maxN=Math.max(1,...nodes.map(a=>a.n)); const base=POS['LONDRINA'];
  const routes=nodes.filter(a=>a.cid!=='LONDRINA').map(a=>{ const q=POS[a.cid]; return `<line class="pdm-route" x1="${base[0]}" y1="${base[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }).join('');
  const marks=nodes.map(a=>{ const q=POS[a.cid]; const r=(a.cid==='LONDRINA')?11:(6+(a.n/maxN)*9); const isBase=a.cid==='LONDRINA';
    return `<g class="pdm-node" onclick="pedPraca('${esc(a.cid).replace(/'/g,'')}')" data-tip="${esc(a.cid)}: ${a.n} passagem(ns) · ${esc(money(a.v))}">
      <circle cx="${q[0]}" cy="${q[1]}" r="${(r+7).toFixed(1)}" class="pdm-halo ${isBase?'base':''}"></circle>
      <circle cx="${q[0]}" cy="${q[1]}" r="${r.toFixed(1)}" class="pdm-dot ${isBase?'base':''}"></circle>
      <text x="${q[0]}" y="${(q[1]-r-7).toFixed(1)}" text-anchor="middle" class="pdm-lbl ${isBase?'base':''}">${isBase?'LONDRINA · BASE':esc(a.cid)}</text>
    </g>`; }).join('');
  return `<svg viewBox="0 0 720 360" class="pdm-map" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="pdmr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#0077ff"/></linearGradient></defs>
    <g class="pdm-routes">${routes}</g>${marks}</svg>`;
}
function pedBuscaPlaca(pl){ location.hash='#pedagios'; setTimeout(()=>{ const b=document.querySelector('#view .pex-search input'); if(b){ b.value=pl; b.dispatchEvent(new Event('input',{bubbles:true})); b.scrollIntoView({block:'center'}); } },60); }
function pedPraca(cid){ const el=document.getElementById('pedPanel'); if(!el)return;
  const ps=_pedFiltradas().filter(p=>_pedCidade(p).toUpperCase()===cid.toUpperCase());
  const tot=ps.reduce((s,p)=>s+(+p.valor||0),0); const inf=ps[0]?_pedInfo(ps[0].praca):{};
  el.innerHTML=`<div class="pn-head"><b>${esc(cid)}</b><button class="pn-x" onclick="pedFechar()">×</button></div>
    <div class="pn-body">
      <div class="pn-f"><small>Rodovia</small><b>${esc(inf.rodovia||'—')}</b></div>
      <div class="pn-f"><small>Passagens</small><b>${ps.length}</b></div>
      <div class="pn-f"><small>Custo total</small><b>${money(tot)}</b></div>
      <div class="pn-sec">Passagens nesta praça</div>
      ${ps.sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora)).map(p=>`<div class="pn-item" onclick="pedAbrir('${p.id}')"><b>${plate(p.placa,'')} ${money(p.valor)}</b><span>${fmtD(p.data)} ${esc(p.hora)} · ${esc(_pedInfo(p.praca).sentido)}</span></div>`).join('')}
    </div>`;
  el.classList.add('show');
}
function pedAbrir(id){ const el=document.getElementById('pedPanel'); if(!el)return; const p=(DB.pedagios||[]).find(x=>x.id===id); if(!p)return;
  const inf=_pedInfo(p.praca); const v=veiculoByPlaca(p.placa);
  const alertas=_pedAlertas((DB.pedagios||[]).filter(x=>x.placa===p.placa)).filter(a=>!a.id||a.id===id);
  el.innerHTML=`<div class="pn-head"><b>${esc(p.placa)} · ${money(p.valor)}</b><button class="pn-x" onclick="pedFechar()">×</button></div>
    <div class="pn-body">
      <div class="pn-f"><small>Data / hora</small><b>${fmtD(p.data)} · ${esc(p.hora||'—')}</b></div>
      <div class="pn-f"><small>Veículo</small><b>${esc(p.placa)}${v?' · '+esc(v.marca+' '+v.modelo):''}</b></div>
      <div class="pn-f"><small>Concessionária</small><b>${esc(p.conc||'—')}</b></div>
      <div class="pn-f"><small>Praça</small><b>${esc(p.praca||'—')}</b></div>
      <div class="pn-grid2">
        <div class="pn-f"><small>Rodovia</small><b>${esc(inf.rodovia||'—')}</b></div>
        <div class="pn-f"><small>KM</small><b>${esc(inf.km||'—')}</b></div>
        <div class="pn-f"><small>Sentido</small><b>${esc(inf.sentido||'—')}</b></div>
        <div class="pn-f"><small>Cidade / UF</small><b>${esc(inf.cidade||'—')} / PR</b></div>
        <div class="pn-f"><small>Categoria (eixos)</small><b>${p.cat||'—'}</b></div>
        <div class="pn-f"><small>TAG</small><b>${esc(p.tag||'—')}</b></div>
      </div>
      <div class="pn-f"><small>Tipo</small><b>${p.tipo==='Vale-pedágio'?'Vale-pedágio — reembolsado por '+esc(p.emb||'embarcador'):'Pago pela empresa'}</b></div>
      ${p.viagem?`<div class="pn-f"><small>Viagem</small><b>${esc(p.viagem)}</b></div>`:''}
      ${p.obs?`<div class="pn-f"><small>Observações</small><b>${esc(p.obs)}</b></div>`:''}
      ${alertas.length?`<div class="pn-sec" style="color:#ffb020">⚠ Alertas</div>${alertas.map(a=>`<div class="pn-item"><b>${esc(a.t)}</b><span>${esc(a.s)}</span></div>`).join('')}`:''}
      <div class="pn-sec">Comprovante</div>
      <div>${badgeAnexo('pedagio', p.id, /./, 'Pedágio')}</div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn sm" onclick="pedModal('${p.id}')">${svg('edit')} Editar</button>
        <button class="btn ghost sm" onclick="pedExcluir('${p.id}')">${svg('trash')} Excluir</button>
      </div>
    </div>`;
  el.classList.add('show');
}
function pedFechar(){ const el=document.getElementById('pedPanel'); if(el) el.classList.remove('show'); }
function pedModal(id){
  const p=id?(DB.pedagios||[]).find(x=>x.id===id):{data:'',hora:'',placa:(DB.veiculos[0]||{}).placa||'',conc:'',praca:'',cat:'',valor:'',tipo:'Pedágio',emb:'',viagem:'',tag:'',obs:''};
  if(!p){ toast('Pedágio não encontrado.','err'); return; }
  const placas=[...new Set([...(DB.veiculos||[]).map(v=>v.placa), ...(DB.pedagios||[]).map(x=>x.placa)])];
  if(p.placa && placas.indexOf(p.placa)<0) placas.push(p.placa);
  const opt=(v,cur,l)=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l||v)}</option>`;
  openModal(`<div class="m-h">${svg('toll')}<h3>${id?'Editar pedágio':'Novo pedágio'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',p.data,'date')}${fld('Hora','f_hora',p.hora,'text','hh:mm:ss')}</div>
      <div class="field-row"><div class="field"><label>Veículo (placa)</label><select id="f_placa">${placas.map(pl=>opt(pl,p.placa)).join('')}</select></div>
        <div class="field"><label>Tipo</label><select id="f_tipo">${opt('Pedágio',p.tipo)}${opt('Vale-pedágio',p.tipo)}</select></div></div>
      <div class="field-row">${fld('Concessionária','f_conc',p.conc)}${fld('Categoria (eixos)','f_cat',p.cat,'number')}</div>
      ${fld('Praça (rodovia, KM, sentido, cidade)','f_praca',p.praca,'text','Ex.: BR-376, KM 448+550, NORTE, TIBAGI')}
      <div class="field-row">${fldR$('Valor (R$)','f_valor',p.valor)}${fld('TAG','f_tag',p.tag)}</div>
      <div class="field-row">${fld('Embarcador (vale-pedágio)','f_emb',p.emb)}${fld('Viagem','f_viagem',p.viagem)}</div>
      <div class="field"><label>Observações</label><input id="f_obs" value="${esc(p.obs||'')}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="pedExcluir('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="pedSalvar('${id||''}')">Salvar</button></div>`);
}
function pedSalvar(id){
  if(!val('f_praca')){ toast('Informe a praça.','err'); return; }
  const d={ data:val('f_data'), hora:val('f_hora'), placa:val('f_placa'), conc:val('f_conc'), praca:val('f_praca'),
    cat: val('f_cat')? parseInt(val('f_cat')) : '', valor:parseBRL(val('f_valor')), tipo:val('f_tipo'),
    emb:val('f_emb'), viagem:val('f_viagem'), tag:val('f_tag'), obs:val('f_obs') };
  if(id){ Object.assign((DB.pedagios||[]).find(x=>x.id===id), d); }
  else { d.id=uid('pd'); (DB.pedagios=DB.pedagios||[]).push(d); }
  saveDB(); closeModal(); toast('Pedágio salvo.'); router();
}
function pedExcluir(id){ if(!confirm('Excluir esta passagem?'))return; DB.pedagios=(DB.pedagios||[]).filter(x=>x.id!==id); saveDB(); closeModal(); pedFechar(); toast('Passagem excluída.'); router(); }
function pedPeriodoModal(){
  openModal(`<div class="m-h">${svg('cal')}<h3>Período personalizado</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b"><div class="field-row">${fld('De','f_de',pedDe,'date')}${fld('Até','f_ate',pedAte,'date')}</div></div>
    <div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="pedDe=val('f_de');pedAte=val('f_ate');pedFiltro='personalizado';closeModal();router()">Aplicar</button></div>`);
}
/* ---- Importar extrato (PDF Sem Parar / imagem / CSV) ---- */
let PED_FILA=[];
function pedImportarModal(){
  openModal(`<div class="m-h">${svg('upload')}<h3>Importar extrato de pedágios</h3><button class="x" onclick="PED_FILA=[];closeModal()">×</button></div>
    <div class="m-b">
      <label class="apo-drop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="event.preventDefault();this.classList.remove('over');_pedImportLer(event.dataTransfer.files)">
        <input type="file" accept=".pdf,.csv,image/*" multiple style="display:none" onchange="_pedImportLer(this.files);this.value=''">
        ${svg('upload')}<b>Solte o extrato Sem Parar (PDF) aqui ou clique</b>
        <span>O sistema lê o extrato e extrai as passagens automaticamente (data, hora, praça, concessionária, valor…). Você confere antes de importar.</span>
      </label>
      <div id="pedImpFila">${_pedImpFilaHTML()}</div>
    </div>
    <div class="m-f"><button class="btn" onclick="PED_FILA=[];closeModal()">Fechar</button>
      <button class="btn primary" id="pedImpBtn" onclick="_pedImportConfirmar()" ${PED_FILA.length?'':'disabled'}>Importar ${PED_FILA.filter(x=>x._ok).length||''}</button></div>`, true);
}
function _pedImpFilaHTML(){
  if(!PED_FILA.length) return `<div class="hint" style="margin-top:12px">Nenhuma passagem lida ainda.</div>`;
  const novas=PED_FILA.filter(x=>x._ok).length, dup=PED_FILA.filter(x=>x._dup).length;
  return `<div class="muted" style="margin:12px 0 8px">Encontradas <b>${PED_FILA.length}</b> passagens · ${novas} novas${dup?' · '+dup+' já existem (ignoradas)':''}</div>
    <div class="tbl-wrap" style="max-height:320px;overflow:auto"><table class="tbl"><thead><tr><th></th><th>Data</th><th>Placa</th><th>Praça</th><th>Conc.</th><th class="ta-r">Valor</th></tr></thead>
    <tbody>${PED_FILA.map((x,i)=>`<tr style="${x._dup?'opacity:.5':''}"><td><input type="checkbox" ${x._ok?'checked':''} ${x._dup?'disabled':''} onchange="PED_FILA[${i}]._ok=this.checked;_pedImpRefresh()"></td>
      <td class="mono">${fmtD(x.data)} ${esc(x.hora||'')}</td><td>${esc(x.placa)}</td><td>${esc(_pedInfo(x.praca).cidade||x.praca)}</td><td>${esc(x.conc)}</td><td class="ta-r mono">${money(x.valor)}${x._dup?' <span class="st neutro">existe</span>':''}</td></tr>`).join('')}</tbody></table></div>`;
}
function _pedImpRefresh(){ const el=document.getElementById('pedImpFila'); if(el)el.innerHTML=_pedImpFilaHTML();
  const b=document.getElementById('pedImpBtn'); if(b){ const n=PED_FILA.filter(x=>x._ok).length; b.disabled=!n; b.innerHTML='Importar '+(n||''); } }
async function _pedImportLer(fileList){
  const files=[].slice.call(fileList||[]); if(!files.length) return;
  if(typeof pexBar==='function') pexBar(true);
  try{ for(const f of files){ let txt=''; try{ txt=await pexLerApoliceTexto(f); }catch(e){}
      _pedParseSemParar(txt||'').forEach(r=>PED_FILA.push(r)); } }
  finally{ if(typeof pexBar==='function') pexBar(false); }
  // marca duplicados (mesma placa+data+hora+valor já no banco ou na fila)
  const existe=new Set((DB.pedagios||[]).map(p=>p.placa+'|'+p.data+'|'+p.hora+'|'+p.valor));
  const naFila=new Set();
  PED_FILA.forEach(x=>{ const k=x.placa+'|'+x.data+'|'+x.hora+'|'+x.valor; x._dup=existe.has(k)||naFila.has(k); naFila.add(k); x._ok=!x._dup; });
  _pedImpRefresh();
}
/* Extrai passagens de um extrato Sem Parar (texto do PDF) — melhor esforço */
function _pedParseSemParar(txt){
  const out=[]; if(!txt) return out;
  const anoBase='20'+((txt.match(/Data de Emiss[aã]o[:\s]*\d{2}\/\d{2}\/(\d{2})/i)||[])[1]||new Date().getFullYear().toString().slice(2));
  // placa atual (aparece em "Descritivo: XXX0X00" antes de cada bloco)
  const re=/([A-Z]{3}\d[A-Z0-9]\d{2})|(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-ZÂÁÃÀÉÊÍÓÔÕÚÜÇ.\/\- ]+?)\s+((?:F\.\s*FLOW|BR|PR|RODOVIA)[^\n]*?)\s+(\d)\s+([\d.]+,\d{2})\s*([CD])/gi;
  let m, placa='', tag='';
  while((m=re.exec(txt))){
    if(m[1]){ placa=m[1].replace(/([A-Z]{3})(\d[A-Z0-9]\d{2})/,'$1-$2'); continue; }
    const data=m[2].split('/').reverse(); const iso='20'+data[0]+'-'+data[1]+'-'+data[2];
    const conc=(m[4]||'').trim().replace(/\s+/g,' ');
    const dc=m[8];
    if(dc==='C') continue;  // crédito/reembolso não é passagem nova
    out.push({ data:iso, hora:m[3], placa:placa||'', conc:conc, praca:(m[5]||'').trim().replace(/\s+/g,' '),
      cat:parseInt(m[6])||'', valor:parseFloat(m[7].replace(/\./g,'').replace(',','.'))||0,
      tipo: /vale|embarcador/i.test(conc)?'Vale-pedágio':'Pedágio', emb:'', viagem:'', tag:tag });
  }
  return out;
}
function _pedImportConfirmar(){
  const sel=PED_FILA.filter(x=>x._ok && !x._dup);
  if(!sel.length){ toast('Nada novo para importar.','err'); return; }
  sel.forEach(x=>{ const {_ok,_dup,...rec}=x; rec.id=uid('pd'); (DB.pedagios=DB.pedagios||[]).push(rec); });
  PED_FILA=[]; saveDB(); closeModal(); toast(sel.length+' passagem(ns) importada(s).'); location.hash='#pedagios'; router();
}
/* Count-up dos KPIs (roda no pexAfterRender p/ a rota pedagios) */
function pedCountUp(){
  document.querySelectorAll('#view[data-route="pedagios"] .k-val[data-count]').forEach(function(el){
    var alvo=parseFloat(el.getAttribute('data-count'))||0, isM=el.getAttribute('data-money')==='1', t0=null, dur=850;
    function step(ts){ if(!t0)t0=ts; var k=Math.min(1,(ts-t0)/dur); var e=1-Math.pow(1-k,3); var v=alvo*e;
      el.textContent=isM? money(Math.round(v)) : Math.round(v).toLocaleString('pt-BR'); if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
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
  const ymAtual=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0');
  // KPI clicável: leva direto ao que está pendente (filtro correspondente)
  const kpiV=(ico,cls,val,label,onclk,ativo)=>`<a class="kpi link ${ativo?'ativo':''}" style="cursor:pointer" onclick="${onclk}">
    <div class="k-top"><div class="k-ico ${cls}">${svg(ico)}</div><span class="k-go">→</span></div>
    <div class="k-val">${val}</div><div class="k-label">${label}</div></a>`;
  let lista=DB.viagens.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  if(viagemFiltro==='emviagem') lista=lista.filter(v=>v.status==='Pendente');
  else if(viagemFiltro==='pendentes') lista=lista.filter(v=>v.baixado!=='SIM'&&v.baixado!=='TSP');
  else if(viagemFiltro==='termo') lista=lista.filter(v=>v.termoBaixado!=='SIM');
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
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalViagem('${v.id}')">${svg('edit')}</button></td></tr>`; };
  const corpo=Object.keys(grupos).sort().reverse().map(k=>{ const gs=grupos[k];
    return `<tr class="grouprow"><td colspan="9">${svg('cal')} ${k==='—'?'Sem data':mesLabel(k)} <span class="muted">· ${gs.length} viagem(ns)</span></td></tr>`+
      gs.map(linhaViagem).join('');
  }).join('');
  return `
  <div class="banner">${svg('route')}<div><b>Controle de Viagens BRF</b><span>Registre a saída do motorista com o número de transporte e o termo pallet. Filtre por mês e por placa.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="modalImportarViagem()">${svg('upload')} Importar Planilha Excel</button>
      <button class="btn primary" onclick="modalViagem()">${svg('plus')} Nova viagem</button></div></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
    ${kpiV('route','i-blue', mesAtual, 'Viagens no mês', "viagemFiltro='todas';viagemMes='"+ymAtual+"';router()", viagemMes===ymAtual)}
    ${kpiV('truck', emV?'i-orange':'i-green', emV, 'Pendentes', "viagemFiltro='emviagem';viagemMes='todos';router()", viagemFiltro==='emviagem')}
    ${kpiV('doc', pendBaixa?'i-red':'i-green', pendBaixa, 'Transportes a baixar', "viagemFiltro='pendentes';viagemMes='todos';router()", viagemFiltro==='pendentes')}
    ${kpiV('box', pendTermo?'i-amber':'i-green', pendTermo, 'Termos pallet pendentes', "viagemFiltro='termo';viagemMes='todos';router()", viagemFiltro==='termo')}
  </div>
  <div class="toolbar"><div class="seg">${fb('todas','Todas')}${fb('emviagem','Pendentes')}${fb('pendentes','A baixar')}${fb('termo','Termo pendente')}</div>
    <select class="selectlite" onchange="viagemMes=this.value;router()"><option value="todos">Todos os meses</option>
      ${meses.map(m=>`<option value="${m}" ${viagemMes===m?'selected':''}>${mesLabel(m)}</option>`).join('')}</select>
    <select class="selectlite" onchange="viagemPlaca=this.value;router()"><option value="todas">Todas as placas</option>
      ${placas.map(p=>`<option value="${esc(p)}" ${viagemPlaca===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <div class="spacer"></div><div class="muted no-print" style="font-size:12.5px;margin-right:6px">${lista.length} viagem(ns)${viagemMes!=='todos'?' · '+mesLabel(viagemMes):''}</div><button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button></div>
  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl viag-tbl pex-noenh">
    <thead><tr><th>Data</th><th>Placa</th><th>Motorista</th><th>Transporte</th><th>Destino</th><th>Baixado</th><th>Termo Pallet</th><th>Termo</th><th class="no-print"></th></tr></thead>
    <tbody>${corpo||`<tr><td colspan="10">${emptyState('Nenhuma viagem neste filtro.')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalViagem(id){
  const v=id?DB.viagens.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),placa:(DB.veiculos.find(x=>x.tipo==='Cavalo')||{}).placa||'',motorista:'',transporte:'',destino:'',baixado:'',termoPallet:'',termoBaixado:'',status:'Pendente',obs:''};
  const _plcs=DB.veiculos.filter(x=>x.status!=='Arquivado').map(x=>x.placa); if(v.placa && _plcs.indexOf(v.placa)<0) _plcs.push(v.placa);  // preserva placa fora da frota (importada)
  openModal(`<div class="m-h">${svg('route')}<h3>${id?'Editar viagem':'Nova viagem'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',v.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${_plcs.map(pl=>`<option ${v.placa===pl?'selected':''}>${esc(pl)}</option>`).join('')}</select></div></div>
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

/* ================================================================== */
/*  IMPORTAÇÃO INTELIGENTE DE PLANILHA (Viagens) — v6.33               */
/*  Identifica as colunas sozinho e extrai as viagens da planilha.     */
/* ================================================================== */
function _viagemDetectar(sheets){
  const FIELDS=[
    ['data',        /(^|\W)(data|dia|\bdt\b|saida|emiss)/],
    ['placa',       /placa|veiculo|cavalo|carreta|caminh|frota/],
    ['motorista',   /motorista|condutor|funcion|\bnome\b/],
    ['status',      /status|situacao/],
    ['termoBaixado',/termo\s*baix/],
    ['baixado',     /baix/],
    ['termoPallet', /termo\s*pallet|pallet|termo\s*p\b/],
    ['transporte',  /transporte|nota|\bnf\b|nfe|documento|conhecimento|\bcte\b|romaneio|numero|\bn[o°º.]/],
    ['destino',     /destino|cliente|cidade|entrega|\brota\b|recebedor|local|praca/],
  ];
  const LABEL={data:'Data',placa:'Placa',motorista:'Motorista',transporte:'Transporte',destino:'Destino',baixado:'Baixado',termoPallet:'Termo Pallet',termoBaixado:'Termo baixado',status:'Status'};
  const rows=[]; const campos={}; const vistos={};
  (sheets||[]).forEach(sh=>{
    const grid=sh.grid||[]; if(!grid.length) return;
    let hr=-1, best=0;
    for(let r=0;r<Math.min(grid.length,30);r++){ const row=grid[r]||[]; const hit={};
      for(let c=0;c<row.length;c++){ const t=_dnorm(row[c]); if(!t) continue;
        for(const [f,re] of FIELDS){ if(hit[f]) continue; if(re.test(t)){ hit[f]=1; break; } } }
      const n=Object.keys(hit).length; if(n>best){ best=n; hr=r; } }
    if(hr<0 || best<2) return;
    const map={}, used={}, hrow=grid[hr]||[];
    for(let c=0;c<hrow.length;c++){ const raw=hrow[c], t=_dnorm(raw); if(!t) continue;
      for(const [f,re] of FIELDS){ if(used[f]) continue; if(re.test(t)){ map[f]=c; used[f]=1; if(!campos[f]) campos[f]=String(raw).trim(); break; } } }
    if(!('data' in map) && !(('placa' in map)&&('transporte' in map))) return;
    const get=(row,f)=>{ const c=map[f]; return c==null?'':String((row&&row[c])!=null?row[c]:'').trim(); };
    for(let r=hr+1;r<grid.length;r++){ const row=grid[r]||[];
      const rData=get(row,'data'),rPlaca=get(row,'placa'),rMot=get(row,'motorista'),rTr=get(row,'transporte'),
            rDest=get(row,'destino'),rBx=get(row,'baixado'),rTp=get(row,'termoPallet'),rTb=get(row,'termoBaixado'),rSt=get(row,'status');
      if(!rData && !rPlaca && !rMot && !rTr && !rDest && !rTp) continue;
      const dataISO=_impISO(rData);
      if(!dataISO && !rPlaca && !rTr && !rMot) continue;
      // normaliza "baixado" (SIM/TSP/NÃO)
      const bxU=_dnorm(rBx); let baixado='';
      if(/tsp/.test(bxU)) baixado='TSP'; else if(/sim|\bok\b|baix|^s$/.test(bxU)) baixado='SIM';
      else if(/nao|^n$|pend/.test(bxU)) baixado='NÃO'; else baixado=rBx?String(rBx).toUpperCase():'';
      const tbU=_dnorm(rTb); let termoB='';
      if(/sim|\bok\b|baix|^s$/.test(tbU)) termoB='SIM'; else if(/nao|^n$/.test(tbU)) termoB='NÃO'; else termoB=rTb?String(rTb).toUpperCase():'';
      const stU=_dnorm(rSt); let status='';
      if(/conclu|finaliz|entreg/.test(stU)) status='Concluída'; else if(/cancel/.test(stU)) status='Cancelada'; else if(/pend|aberto|andamento/.test(stU)) status='Pendente';
      if(!status) status=(baixado==='SIM'||baixado==='TSP')?'Concluída':'Pendente';
      const o={ data:dataISO, placa:rPlaca, motorista:rMot, transporte:rTr, destino:rDest, baixado:baixado, termoPallet:rTp, termoBaixado:termoB, status:status };
      const issues=[];
      if(!dataISO) issues.push('sem data');
      if(!rPlaca) issues.push('sem placa'); else if(!veiculoByPlaca(rPlaca)) issues.push('placa fora da frota');
      if(!rMot) issues.push('sem motorista');
      const chave=(dataISO||'')+'|'+_plk(rPlaca)+'|'+_dnorm(rTr)+'|'+_dnorm(rMot);
      const dupeArq=!!vistos[chave]; vistos[chave]=1;
      const dupe=dupeArq
        || (rTr && DB.viagens.some(x=>x.data===dataISO && _dnorm(x.transporte)===_dnorm(rTr)))
        || (dataISO && rMot && DB.viagens.some(x=>x.data===dataISO && _plk(x.placa)===_plk(rPlaca) && _dnorm(x.motorista)===_dnorm(rMot)));
      o.imp = dupe?'dupe':(issues.length?'aviso':'ok');
      o.issues=issues; o.incluir=(o.imp!=='dupe');
      rows.push(o);
    }
  });
  const detectadas=Object.keys(campos).map(f=>LABEL[f]+' («'+campos[f]+'»)');
  return { rows, detectadas };
}
function modalImportarViagem(){
  const suporta=!window.PEXImport || PEXImport.suportaXLSX();
  openModal(`<div class="m-h">${svg('upload')}<h3>Importar Planilha Excel — Viagens</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="banner" style="margin:0 0 14px">${svg('route')}<div><b>Importe as viagens de uma planilha</b><span>Escolha um arquivo <b>.xlsx</b> ou <b>.csv</b>. O sistema identifica sozinho as colunas (Data, Placa, Motorista, Transporte, Destino, Baixado, Termo Pallet, Status), lê tudo e monta uma prévia. Você confere as inconsistências e confirma.</span></div></div>
      ${suporta?'':`<div class="hint" style="color:var(--danger)">Este navegador não abre .xlsx direto — use o Chrome ou o Edge, ou salve a planilha como CSV.</div>`}
      <div class="field">
        <label>Arquivo (Excel ou CSV)</label>
        <label class="btn">${svg('upload')} Escolher planilha…<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="viagemImpLer(this)" style="display:none"></label>
        <span id="vgImpNome" class="muted" style="font-size:12.5px;margin-left:8px">Nenhum arquivo escolhido</span>
      </div>
      <div id="vgImpPreview"></div>
    </div>
    <div class="m-f">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" id="vgImpBtn" style="display:none" onclick="viagemImpConfirmar()">Importar selecionadas</button>
    </div>`, true);
  window._vgImp=[];
}
async function viagemImpLer(input){
  const file=input.files&&input.files[0]; if(!file) return;
  const nomeEl=document.getElementById('vgImpNome'); if(nomeEl) nomeEl.textContent=file.name;
  const prev=document.getElementById('vgImpPreview');
  prev.innerHTML=`<div class="muted" style="padding:14px 2px">${svg('gauge')} Lendo a planilha…</div>`;
  try{
    const {sheets}=await PEXImport.lerArquivo(file);
    const {rows, detectadas}=_viagemDetectar(sheets);
    window._vgImp=rows; window._vgImpCols=detectadas;
    viagemImpRender();
  }catch(e){
    prev.innerHTML=`<div class="hint" style="color:var(--danger)">Não consegui ler: ${esc((e&&e.message)||e)}<br><span class="muted">Se o arquivo for um .xls antigo, abra-o no Excel e salve como <b>.xlsx</b> ou <b>.csv</b>.</span></div>`;
    const b=document.getElementById('vgImpBtn'); if(b) b.style.display='none';
  }
}
function viagemImpRender(){
  const prev=document.getElementById('vgImpPreview'), btn=document.getElementById('vgImpBtn');
  const rows=window._vgImp||[];
  if(!rows.length){
    prev.innerHTML=`<div class="hint">Não encontrei uma tabela de viagens nesta planilha. O ideal é ter uma linha de cabeçalho com colunas como <b>Data</b>, <b>Placa</b>, <b>Motorista</b>, <b>Transporte</b> e <b>Destino</b>. Você também pode lançar manualmente pelo botão <b>Nova viagem</b>.</div>`;
    if(btn) btn.style.display='none'; return;
  }
  const badge={ok:'<span class="st ok">Nova</span>',aviso:'<span class="st warn">Conferir</span>',dupe:'<span class="st neutro">Já existe</span>'};
  const linhas=rows.map((r,i)=>{
    const av=r.issues&&r.issues.length?`<div class="muted" style="font-size:10.5px">⚠ ${esc(r.issues.join(' · '))}</div>`:'';
    return `<tr class="${r.incluir?'':'imp-off'}">
      <td class="no-print" style="text-align:center"><input type="checkbox" ${r.incluir?'checked':''} onchange="viagemImpToggle(${i},this.checked)"></td>
      <td class="mono">${r.data?fmtD(r.data):'<span class="st crit">—</span>'}</td>
      <td class="mono">${esc(r.placa||'—')}</td>
      <td>${esc(r.motorista||'—')}</td>
      <td class="mono">${esc(r.transporte||'—')}</td>
      <td>${esc(r.destino||'—')}</td>
      <td>${badge[r.imp]||''}${av}</td>
    </tr>`;
  }).join('');
  const cont={}; rows.forEach(r=>cont[r.imp]=(cont[r.imp]||0)+1);
  const resumo=[cont.ok?cont.ok+' nova(s)':'',cont.aviso?cont.aviso+' p/ conferir':'',cont.dupe?cont.dupe+' já existe(m)':''].filter(Boolean).join(' · ');
  const cols=(window._vgImpCols||[]);
  const colInfo=cols.length?`<div class="dsc-imp-cols">${svg('filter')} <b>Colunas identificadas:</b> ${esc(cols.join(' · '))}</div>`:'';
  const nSel=rows.filter(r=>r.incluir).length;
  prev.innerHTML=`${colInfo}
    <div class="muted" style="margin:8px 0;font-size:12.5px">Encontrei <b>${rows.length}</b> viagem(ns). ${resumo?'('+resumo+')':''} Confira e desmarque o que não quiser.</div>
    <div class="tbl-wrap" style="max-height:44vh;overflow:auto"><table class="tbl">
      <thead><tr><th class="no-print" style="width:34px"></th><th>Data</th><th>Placa</th><th>Motorista</th><th>Transporte</th><th>Destino</th><th>Situação</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  if(btn){ btn.style.display=''; btn.textContent=nSel?('Importar '+nSel+' selecionada(s)'):'Nada selecionado'; btn.disabled=!nSel; }
}
function viagemImpToggle(i,on){
  const r=(window._vgImp||[])[i]; if(!r) return; r.incluir=!!on;
  const nSel=(window._vgImp||[]).filter(x=>x.incluir).length;
  const b=document.getElementById('vgImpBtn'); if(b){ b.textContent=nSel?('Importar '+nSel+' selecionada(s)'):'Nada selecionado'; b.disabled=!nSel; }
  const tr=document.querySelectorAll('#vgImpPreview tbody tr')[i]; if(tr) tr.classList.toggle('imp-off',!on);
}
function viagemImpConfirmar(){
  let novas=0, pulados=0;
  (window._vgImp||[]).forEach(r=>{
    if(!r.incluir){ pulados++; return; }
    DB.viagens.push({ id:uid('vg'), data:r.data||'', placa:(r.placa||'').trim(), motorista:(r.motorista||'').trim(),
      transporte:(r.transporte||'').trim(), destino:(r.destino||'').trim(), baixado:r.baixado||'',
      termoPallet:(r.termoPallet||'').trim(), termoBaixado:r.termoBaixado||'', status:r.status||'Pendente', obs:'' });
    novas++;
  });
  saveDB(); closeModal();
  toast('Importado: '+novas+' viagem(ns)'+(pulados?', '+pulados+' ignorada(s)':'')+'.');
  viagemFiltro='todas'; viagemMes='todos'; viagemPlaca='todas';
  if((location.hash.slice(1).split('/')[0])!=='viagens') location.hash='viagens';
  router();
}

/* ---------- DESCARGAS ---------- */
/*  Reformulado (v6.29): tema cyber + pesquisa rápida + filtro por placa +
    ACORDEÃO por competência (mês/ano), do mais recente ao mais antigo, com
    ordenação cronológica dentro de cada mês. Importação inteligente de Excel. */
let descBusca='';            // pesquisa rápida (texto)
let descPlaca='todos';       // filtro por placa
const descAbertos={};        // meses expandidos: 'AAAA-MM' -> 1
let _descIniciou=false;      // 1ª visita: abre o mês mais recente

function _descComp(d){ return (d.data||'').slice(0,7); }               // AAAA-MM
function _descNorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),''); }
function _descMatch(d,q){
  if(!q) return true;
  const v=veiculoByPlaca(d.placa);
  const hay=_descNorm([d.placa,(v?v.tipo:''),d.transporte,d.senha,d.local,d.pago,fmtD(d.data),String(d.valor)].join(' '));
  return _descNorm(q).split(/\s+/).every(t=>!t||hay.indexOf(t)>=0);
}
/* filtra + agrupa por competência (usado no 1º render e na pesquisa ao vivo) */
function _descGrupos(){
  const q=descBusca.trim().toLowerCase();
  const lista=DB.descargas.filter(d=>(descPlaca==='todos'||d.placa===descPlaca)&&_descMatch(d,q));
  const grupos={}; lista.forEach(d=>{ const c=_descComp(d)||'0000-00'; (grupos[c]=grupos[c]||[]).push(d); });
  const comps=Object.keys(grupos).sort().reverse();
  return { lista, grupos, comps, buscando:(!!q || descPlaca!=='todos') };
}
/* HTML dos meses (acordeão) — recalculado na pesquisa sem re-render total */
function descMonthsHTML(){
  const {grupos, comps, buscando}=_descGrupos();
  if(!_descIniciou){ _descIniciou=true; if(comps[0]) descAbertos[comps[0]]=1; }
  if(!comps.length){
    return `<div class="card"><div class="card-b">${emptyState(buscando
      ?'Nenhuma descarga encontrada com esse filtro.'
      :'Nenhuma descarga registrada. Use "Nova descarga" ou "Importar Planilha Excel".')}</div></div>`;
  }
  return comps.map(c=>{
    const arr=grupos[c].slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')||String(a.id).localeCompare(String(b.id)));
    const sub=arr.reduce((s,d)=>s+(Number(d.valor)||0),0);
    const aberto=buscando || descAbertos[c];
    const label=(c==='0000-00')?'Sem competência':mesLabel(c);
    const rows=arr.map(d=>{ const v=veiculoByPlaca(d.placa);
      return `<tr class="clickable" onclick="modalDescarga('${d.id}')">
        <td class="mono">${fmtD(d.data)}</td>
        <td>${v?plate(v.placa,v.tipo):esc(d.placa||'—')}</td>
        <td class="mono">${esc(d.transporte||'—')}</td>
        <td class="mono muted">${esc(d.senha||'—')}</td>
        <td class="mono"><b>${money(d.valor)}</b></td>
        <td>${esc(d.local||'—')}</td>
        <td class="muted">${esc(d.pago||'—')}</td>
        <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalDescarga('${d.id}')">${svg('edit')}</button></td></tr>`;
    }).join('');
    return `<div class="dsc-month ${aberto?'open':''}" data-m="${c}">
      <button class="dsc-month-h" type="button" onclick="descToggle('${c}')">
        <span class="dsc-chev">${svg('chevron')}</span>
        <span class="dsc-cal">${svg('cal')}</span>
        <span class="dsc-mtitle">${esc(label)}</span>
        <span class="dsc-mcount">${arr.length}</span>
        <span class="dsc-mspacer"></span>
        <span class="dsc-mtot">${money(sub)}</span>
      </button>
      <div class="dsc-monthbody"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Placa</th><th>Transporte</th><th>Senha</th><th>Valor</th><th>Local</th><th>Pago</th><th class="no-print"></th></tr></thead>
        <tbody>${rows}</tbody></table></div></div></div>`;
  }).join('');
}
function viewDescargas(){
  const h=hoje();
  const todas=DB.descargas;
  const total=todas.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const compAtual=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0');
  const mesAtual=todas.filter(d=>_descComp(d)===compAtual);
  const totalMes=mesAtual.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const ticket=todas.length?total/todas.length:0;
  const placas=[...new Set(todas.map(d=>d.placa).filter(Boolean))].sort();
  const {lista, comps}=_descGrupos();
  const totalFiltro=lista.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const buscando=(descBusca.trim()||descPlaca!=='todos');
  return `
  <div class="banner">${svg('box')}<div><b>Descargas</b><span>Senhas e valores de descarga (pagos via Bradesco), organizados por mês.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="modalImportarDescarga()">${svg('upload')} Importar Planilha Excel</button>
      <button class="btn primary" onclick="modalDescarga()">${svg('plus')} Nova descarga</button></div></div>
  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kpi('box','i-blue',DB.descargas.length,'Descargas registradas','')}
    ${kpi('money','i-green',money(totalMes),'Valor no mês atual',mesAtual.length+' descarga(s)')}
    ${kpi('coins','i-amber',money(total),'Valor acumulado','')}
    ${kpi('trend','i-orange',money(ticket),'Ticket médio','por descarga')}
  </div>
  <div class="dsc-toolbar no-print">
    <div class="dsc-search">${svg('search')}<input id="descBusca" placeholder="Pesquisa rápida: placa, local, senha, transporte, valor…" value="${esc(descBusca)}" oninput="descSetBusca(this.value)"></div>
    <select class="selectlite" onchange="descPlaca=this.value;router()"><option value="todos">Todas as placas</option>${placas.map(p=>`<option value="${esc(p)}" ${descPlaca===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    ${buscando?`<button class="btn ghost sm" onclick="descLimpar()">Limpar</button>`:''}
    <span class="spacer"></span>
    <button class="btn ghost sm" onclick="descExpandir(1)">Expandir tudo</button>
    <button class="btn ghost sm" onclick="descExpandir(0)">Recolher tudo</button>
    <button class="btn no-print" onclick="window.print()">${svg('print')} Imprimir</button>
  </div>
  <div id="dscMeta" class="dsc-meta muted no-print">${lista.length} descarga(s) em ${comps.length} mês(es) · <b>${money(totalFiltro)}</b></div>
  <div id="dscMonths" class="dsc-months">${descMonthsHTML()}</div>`;
}
/* pós-render: define a altura de cada mês (anima a expansão) */
function descInit(){
  document.querySelectorAll('#view .dsc-month').forEach(function(sec){
    const body=sec.querySelector('.dsc-monthbody'); if(!body) return;
    body.style.maxHeight = sec.classList.contains('open') ? body.scrollHeight+'px' : '0px';
  });
}
function descToggle(c){
  const sec=document.querySelector('#view .dsc-month[data-m="'+c+'"]'); if(!sec) return;
  const open=sec.classList.toggle('open');
  if(open) descAbertos[c]=1; else delete descAbertos[c];
  const body=sec.querySelector('.dsc-monthbody');
  if(body) body.style.maxHeight = open ? body.scrollHeight+'px' : '0px';
}
function descExpandir(on){
  _descGrupos().comps.forEach(function(c){ if(on) descAbertos[c]=1; else delete descAbertos[c]; });
  document.querySelectorAll('#view .dsc-month').forEach(function(sec){
    sec.classList.toggle('open',!!on);
    const body=sec.querySelector('.dsc-monthbody');
    if(body) body.style.maxHeight = on ? body.scrollHeight+'px' : '0px';
  });
}
/* pesquisa ao vivo — atualiza só a lista (mantém o foco no campo) */
function descSetBusca(v){
  descBusca=v;
  const m=document.getElementById('dscMonths'); if(m) m.innerHTML=descMonthsHTML();
  const g=_descGrupos(); const tot=g.lista.reduce((s,d)=>s+(Number(d.valor)||0),0);
  const meta=document.getElementById('dscMeta'); if(meta) meta.innerHTML=g.lista.length+' descarga(s) em '+g.comps.length+' mês(es) · <b>'+money(tot)+'</b>';
  descInit();
}
function descLimpar(){ descBusca=''; descPlaca='todos'; router(); }

function modalDescarga(id){
  const d=id?DB.descargas.find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),placa:(DB.veiculos[0]||{}).placa||'',transporte:'',senha:'',valor:'',pago:'Bradesco',local:''};
  const placas=DB.veiculos.map(v=>v.placa); if(d.placa && placas.indexOf(d.placa)<0) placas.push(d.placa);  // preserva placa fora da frota (importada)
  openModal(`<div class="m-h">${svg('box')}<h3>${id?'Editar descarga':'Nova descarga'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',d.data,'date')}
        <div class="field"><label>Placa</label><select id="f_placa">${placas.map(pl=>`<option ${d.placa===pl?'selected':''}>${esc(pl)}</option>`).join('')}</select></div></div>
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

/* ================================================================== */
/*  IMPORTAÇÃO INTELIGENTE DE PLANILHA (Descargas) — v6.29             */
/*  Lê .xlsx/.csv, identifica as colunas sozinho, extrai os dados,     */
/*  aponta inconsistências/duplicados e importa após conferência.      */
/* ================================================================== */
function _dnorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),'').trim(); }
/* número da célula: aceita cru do xlsx (560 / 560.5) e padrão BR (1.234,56 / R$ 90,00) */
function _descNum(s){
  s=String(s==null?'':s).trim(); if(!s) return null;
  if(/^-?\d+(\.\d+)?$/.test(s)){ const n=parseFloat(s); return isNaN(n)?null:Math.round(n*100)/100; }
  const n=parseBRL(s); return n?n:null;
}
/* já existe no banco? (mesma data + nº transporte, ou mesma data + placa + valor) */
function _descDupeDB(o){
  return DB.descargas.some(d=>{
    if(!o.data || d.data!==o.data) return false;
    if(o.transporte && d.transporte && _dnorm(d.transporte)===_dnorm(o.transporte)) return true;
    if(o.valor!=null && Number(d.valor)===Number(o.valor) && _plk(d.placa)===_plk(o.placa) && _plk(o.placa)) return true;
    return false;
  });
}
/* identifica colunas por cabeçalho e extrai as linhas de todas as abas */
function _descDetectar(sheets){
  const FIELDS=[
    ['data',      /(^|\W)(data|dia|\bdt\b|emiss)/],
    ['placa',     /placa|veiculo|cavalo|carreta|reboque|caminh|frota/],
    ['valor',     /valor|preco|custo|tarifa|r\$|total/],
    ['senha',     /senha|codigo|autoriza|libera|protocolo/],
    ['transporte',/transporte|nota|\bnf\b|nfe|documento|manifesto|conhecimento|\bcte\b|romaneio|pedido|numero|\bn[o°º.]/],
    ['pago',      /pago|pagamento|forma|banco|conta|quita/],
    ['local',     /local|cliente|destino|estabelec|loja|mercado|super\b|rede|recebedor|entrega|descarreg|unidade|filial/],
  ];
  const LABEL={data:'Data',placa:'Placa',transporte:'Transporte',senha:'Senha',valor:'Valor',pago:'Pago',local:'Local'};
  const rows=[]; const campos={}; const vistos={};
  (sheets||[]).forEach(sh=>{
    const grid=sh.grid||[]; if(!grid.length) return;
    // acha a linha de cabeçalho: a que casa mais campos distintos (>=2)
    let hr=-1, best=0;
    for(let r=0; r<Math.min(grid.length,30); r++){
      const row=grid[r]||[]; const hit={};
      for(let c=0;c<row.length;c++){ const t=_dnorm(row[c]); if(!t) continue;
        for(const [f,re] of FIELDS){ if(hit[f]) continue; if(re.test(t)){ hit[f]=1; break; } } }
      const n=Object.keys(hit).length;
      if(n>best){ best=n; hr=r; }
    }
    if(hr<0 || best<2) return;
    // mapeia cada coluna ao melhor campo ainda livre
    const map={}, used={}, hrow=grid[hr]||[];
    for(let c=0;c<hrow.length;c++){ const raw=hrow[c], t=_dnorm(raw); if(!t) continue;
      for(const [f,re] of FIELDS){ if(used[f]) continue; if(re.test(t)){ map[f]=c; used[f]=1; if(!campos[f]) campos[f]=String(raw).trim(); break; } } }
    if(!('data' in map) && !(('placa' in map)&&('valor' in map))) return;   // precisa de algo pra ancorar
    const get=(row,f)=>{ const c=map[f]; return c==null?'':String((row&&row[c])!=null?row[c]:'').trim(); };
    for(let r=hr+1; r<grid.length; r++){
      const row=grid[r]||[];
      const rawData=get(row,'data'), rawPlaca=get(row,'placa'), rawTransp=get(row,'transporte'),
            rawSenha=get(row,'senha'), rawValor=get(row,'valor'), rawLocal=get(row,'local'), rawPago=get(row,'pago');
      if(!rawData && !rawPlaca && !rawTransp && !rawSenha && !rawValor && !rawLocal) continue;   // linha vazia
      const dataISO=_impISO(rawData);
      const valor=_descNum(rawValor);
      // pula linhas totalmente inúteis (sem data, sem valor e sem identificação)
      if(!dataISO && valor==null && !rawPlaca && !rawTransp && !rawLocal) continue;
      const o={ data:dataISO, placa:rawPlaca, transporte:rawTransp, senha:rawSenha, valor:valor, local:rawLocal, pago:rawPago };
      // problemas apontados ao usuário
      const issues=[];
      if(!dataISO) issues.push('sem data');
      if(valor==null) issues.push('sem valor');
      if(rawPlaca && !veiculoByPlaca(rawPlaca)) issues.push('placa fora da frota');
      // duplicados (no banco ou dentro do próprio arquivo)
      const chave=(dataISO||'')+'|'+_plk(rawPlaca)+'|'+_dnorm(rawTransp)+'|'+(valor==null?'':valor);
      const dupeArq=!!vistos[chave]; vistos[chave]=1;
      const dupe=dupeArq || _descDupeDB(o);
      o.status = dupe ? 'dupe' : (issues.length ? 'aviso' : 'ok');
      o.issues = issues;
      o.incluir = (o.status!=='dupe');
      rows.push(o);
    }
  });
  const detectadas=Object.keys(campos).map(f=>LABEL[f]+' («'+campos[f]+'»)');
  return { rows, detectadas };
}

function modalImportarDescarga(){
  const suporta=!window.PEXImport || PEXImport.suportaXLSX();
  openModal(`<div class="m-h">${svg('upload')}<h3>Importar Planilha Excel — Descargas</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="banner" style="margin:0 0 14px">${svg('box')}<div><b>Importe as descargas de uma planilha</b><span>Escolha um arquivo <b>.xlsx</b> ou <b>.csv</b>. O sistema identifica sozinho as colunas (Data, Placa, Transporte, Senha, Valor, Local, Pago), lê tudo e monta uma prévia. Você confere as inconsistências e confirma — sem digitar nada que já esteja na planilha.</span></div></div>
      ${suporta?'':`<div class="hint" style="color:var(--danger)">Este navegador não abre .xlsx direto — use o Chrome ou o Edge, ou salve a planilha como CSV.</div>`}
      <div class="field">
        <label>Arquivo (Excel ou CSV)</label>
        <label class="btn">${svg('upload')} Escolher planilha…<input type="file" accept=".xlsx,.xls,.csv,.txt" onchange="descImpLer(this)" style="display:none"></label>
        <span id="dscImpNome" class="muted" style="font-size:12.5px;margin-left:8px">Nenhum arquivo escolhido</span>
      </div>
      <div id="dscImpPreview"></div>
    </div>
    <div class="m-f">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" id="dscImpBtn" style="display:none" onclick="descImpConfirmar()">Importar selecionadas</button>
    </div>`, true);
  window._dscImp=[];
}
async function descImpLer(input){
  const file=input.files&&input.files[0]; if(!file) return;
  const nomeEl=document.getElementById('dscImpNome'); if(nomeEl) nomeEl.textContent=file.name;
  const prev=document.getElementById('dscImpPreview');
  prev.innerHTML=`<div class="muted" style="padding:14px 2px">${svg('gauge')} Lendo a planilha…</div>`;
  try{
    const {sheets}=await PEXImport.lerArquivo(file);
    const {rows, detectadas}=_descDetectar(sheets);
    window._dscImp=rows; window._dscImpCols=detectadas;
    descImpRender();
  }catch(e){
    prev.innerHTML=`<div class="hint" style="color:var(--danger)">Não consegui ler: ${esc((e&&e.message)||e)}<br><span class="muted">Se o arquivo for um .xls antigo, abra-o no Excel e salve como <b>.xlsx</b> ou <b>.csv</b>.</span></div>`;
    const b=document.getElementById('dscImpBtn'); if(b) b.style.display='none';
  }
}
function descImpRender(){
  const prev=document.getElementById('dscImpPreview'), btn=document.getElementById('dscImpBtn');
  const rows=window._dscImp||[];
  if(!rows.length){
    prev.innerHTML=`<div class="hint">Não encontrei uma tabela de descargas nesta planilha. O ideal é ter uma linha de cabeçalho com colunas como <b>Data</b>, <b>Placa</b>, <b>Transporte</b>, <b>Senha</b>, <b>Valor</b>, <b>Local</b> e <b>Pago</b>. Você também pode lançar manualmente pelo botão <b>Nova descarga</b>.</div>`;
    if(btn) btn.style.display='none'; return;
  }
  const badge={ok:'<span class="st ok">Novo</span>',aviso:'<span class="st warn">Conferir</span>',dupe:'<span class="st neutro">Já existe</span>'};
  const linhas=rows.map((r,i)=>{
    const av=r.issues&&r.issues.length?`<div class="muted" style="font-size:10.5px">⚠ ${esc(r.issues.join(' · '))}</div>`:'';
    return `<tr class="${r.incluir?'':'imp-off'}">
      <td class="no-print" style="text-align:center"><input type="checkbox" ${r.incluir?'checked':''} onchange="descImpToggle(${i},this.checked)"></td>
      <td class="mono">${r.data?fmtD(r.data):'<span class="st crit">—</span>'}</td>
      <td class="mono">${esc(r.placa||'—')}</td>
      <td class="mono">${esc(r.transporte||'—')}</td>
      <td class="mono muted">${esc(r.senha||'—')}</td>
      <td class="mono"><b>${r.valor==null?'<span class="muted">—</span>':money(r.valor)}</b></td>
      <td>${esc(r.local||'—')}</td>
      <td>${badge[r.status]||''}${av}</td>
    </tr>`;
  }).join('');
  const cont={}; rows.forEach(r=>cont[r.status]=(cont[r.status]||0)+1);
  const resumo=[cont.ok?cont.ok+' novo(s)':'',cont.aviso?cont.aviso+' p/ conferir':'',cont.dupe?cont.dupe+' já existe(m)':''].filter(Boolean).join(' · ');
  const cols=(window._dscImpCols||[]);
  const colInfo=cols.length?`<div class="dsc-imp-cols">${svg('filter')} <b>Colunas identificadas:</b> ${esc(cols.join(' · '))}</div>`:'';
  const nSel=rows.filter(r=>r.incluir).length;
  prev.innerHTML=`${colInfo}
    <div class="muted" style="margin:8px 0;font-size:12.5px">Encontrei <b>${rows.length}</b> descarga(s). ${resumo?'('+resumo+')':''} Confira e desmarque o que não quiser.</div>
    <div class="tbl-wrap" style="max-height:44vh;overflow:auto"><table class="tbl">
      <thead><tr><th class="no-print" style="width:34px"></th><th>Data</th><th>Placa</th><th>Transporte</th><th>Senha</th><th>Valor</th><th>Local</th><th>Situação</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  if(btn){ btn.style.display=''; btn.textContent=nSel?('Importar '+nSel+' selecionada(s)'):'Nada selecionado'; btn.disabled=!nSel; }
}
function descImpToggle(i,on){
  const r=(window._dscImp||[])[i]; if(!r) return; r.incluir=!!on;
  const nSel=(window._dscImp||[]).filter(x=>x.incluir).length;
  const b=document.getElementById('dscImpBtn'); if(b){ b.textContent=nSel?('Importar '+nSel+' selecionada(s)'):'Nada selecionado'; b.disabled=!nSel; }
  const tr=document.querySelectorAll('#dscImpPreview tbody tr')[i]; if(tr) tr.classList.toggle('imp-off',!on);
}
function descImpConfirmar(){
  let novas=0, pulados=0;
  (window._dscImp||[]).forEach(r=>{
    if(!r.incluir){ pulados++; return; }
    DB.descargas.push({ id:uid('dc'), data:r.data||'', placa:(r.placa||'').trim(), transporte:(r.transporte||'').trim(),
      senha:(r.senha||'').trim(), valor:(r.valor==null?'':r.valor), pago:(r.pago||'').trim()||'Bradesco', local:(r.local||'').trim() });
    novas++;
  });
  saveDB(); closeModal();
  toast('Importado: '+novas+' descarga(s)'+(pulados?', '+pulados+' ignorada(s)':'')+'.');
  descBusca=''; descPlaca='todos'; _descIniciou=false;   // reabre o mês mais recente (provável mês importado)
  if((location.hash.slice(1).split('/')[0])!=='descargas') location.hash='descargas';
  router();
}

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
      <td class="no-print">${badgeAnexo('abastecimento',a.id,/nota|nf|fiscal|\.pdf/i,'Nota Fiscal')}</td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalAbastec('${a.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="banner">${svg('fuel')}<div><b>Abastecimentos e médias</b><span>Envie a NF em PDF que eu tento preencher sozinho (litros, valor, KM/horas). Cavalos: KM. Carretas: horas do Thermo King. A média de consumo é calculada automaticamente.</span></div>
    <label class="btn no-print" style="margin-left:auto">${svg('upload')} Enviar NF (PDF)<input type="file" accept="application/pdf,.pdf" onchange="abastecNfUpload(event)" style="display:none"></label>
    <button class="btn primary no-print" onclick="modalAbastec()">${svg('plus')} Novo abastecimento</button></div>
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
    <thead><tr><th>Data</th><th>Veículo</th><th>Litros</th><th>Valor</th><th>KM / Horas</th><th>Posto</th><th class="no-print">NF</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="8">${emptyState('Nenhum abastecimento. Envie a NF em PDF ou lance manualmente.')}</td></tr>`}</tbody></table></div></div></div>`;
}
function modalAbastec(id, pre){
  const a=id?DB.abastecimentos.find(x=>x.id===id):Object.assign({data:new Date().toISOString().slice(0,10),veiculoId:(DB.veiculos[0]||{}).id,litros:'',valor:'',km:'',horas:'',posto:'',obs:''}, pre||{});
  openModal(`<div class="m-h">${svg('fuel')}<h3>${id?'Editar abastecimento':'Novo abastecimento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      ${a._nfNome?(a._nfAchou? `<div class="hint" style="background:#e7f6ec;color:#166534;padding:8px 12px;border-radius:8px;margin-bottom:12px">📎 Li a nota <b>${esc(a._nfNome)}</b> e preenchi ${a._nfAchou} campo(s). Confira e ajuste antes de salvar.</div>` : `<div class="hint" style="background:#fff5e6;color:#b45309;padding:8px 12px;border-radius:8px;margin-bottom:12px">📎 Anexei <b>${esc(a._nfNome)}</b>, mas esse PDF não permitiu leitura automática (deve ser digitalizado/imagem). Preencha os campos abaixo — a nota fica anexada.</div>`):''}
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
async function salvarAbastec(id){ if(!val('f_lit')){toast('Informe os litros.','err');return;}
  const d={data:val('f_data'),veiculoId:val('f_veic'),litros:parseFloat(val('f_lit'))||0,valor:parseBRL(val('f_val')),km:numOrNull('f_km'),horas:numOrNull('f_h'),posto:val('f_posto')};
  let novoId=id;
  if(id)Object.assign(DB.abastecimentos.find(x=>x.id===id),d); else{ d.id=uid('ab'); novoId=d.id; DB.abastecimentos.push(d); }
  if(_nfPendente){ try{ await subirUm(_nfPendente,'abastecimento',novoId,'Nota Fiscal'); await reloadFiles(); }catch(e){} _nfPendente=null; }
  saveDB(); closeModal(); toast('Abastecimento salvo.'); router(); }
function excluirAbastec(id){ if(!confirm('Excluir este abastecimento?'))return; DB.abastecimentos=DB.abastecimentos.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
/* Enviar NF (PDF) de abastecimento: lê o PDF, preenche o que achar e abre o formulário */
let _nfPendente=null;
async function abastecNfUpload(ev){
  const f=(ev.target.files||[])[0]; ev.target.value=''; if(!f) return;
  toast('Lendo a nota fiscal…');
  const txt=await pexLerPdfTexto(f); const dd=extrairAbastecimento(txt||'', f.name);
  const achou=(dd.litros!=null)+(dd.valor!=null)+(dd.km!=null)+(dd.placa?1:0);
  const v=dd.placa?veiculoByPlaca(dd.placa):null;
  const pre={ _nfNome:f.name, _nfAchou:achou, data:dd.data||new Date().toISOString().slice(0,10),
    litros:(dd.litros!=null?dd.litros:''), valor:(dd.valor!=null?dd.valor:''), posto:dd.posto||'' };
  if(v){ pre.veiculoId=v.id; if(isReb(v)) pre.horas=(dd.km!=null?dd.km:''); else pre.km=(dd.km!=null?dd.km:''); }
  else if(dd.km!=null){ pre.km=dd.km; }
  _nfPendente=f; modalAbastec(null, pre);
}

/* ---------- ALARME: detalhe (causa e solução) ---------- */
function modalAlarme(code){
  const a=(typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]).find(x=>x.c===code); if(!a) return;
  const cat=(typeof _alarmeCat==='function')?_alarmeCat(a):{label:'Geral',ico:'alarm',cor:'#7fe0ff'};
  openModal(`<div class="m-h">${svg('alarm')}<h3>Alarme ${esc(a.c)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b alarme-modal">
      <div class="alarme-hero">
        <div class="alarme-det-code" style="--ac:${cat.cor}">${svg(cat.ico)}<b>${esc(a.c)}</b></div>
        <div class="alarme-hero-tx"><span class="alarme-cat" style="--ac:${cat.cor}">${svg(cat.ico)} ${esc(cat.label)}</span>
          <div class="alarme-det-title">${esc(a.d)}</div></div>
      </div>
      <div class="alarme-block"><div class="alarme-block-h">${svg('eye')} O que significa</div><p>${esc(a.ex||'—')}</p></div>
      <div class="alarme-block sol"><div class="alarme-block-h">${svg('wrench')} O que fazer</div><p>${esc(a.so||'—')}</p></div>
      <div class="alarme-aviso">${svg('bell')} <span>Orientação geral. Para o diagnóstico correto, consulte o manual e o técnico Thermo King.</span></div>
    </div>
    <div class="m-f"><button class="btn primary" onclick="closeModal()">Entendi</button></div>`);
}

/* ================================================================== */
/*  FINANCEIRO (protegido por senha)                                  */
/* ================================================================== */
let finUnlocked=false;
function viewFinanceiro(){ return viewFinConteudo(); }  /* senha removida a pedido do cliente — acesso direto */
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
let pagMes='todos';
function viewFinConteudo(){
  const h=hoje();
  /* PLANILHA DE PAGAMENTOS (livre — separada dos vales dos motoristas) */
  const pagAll=DB.pagamentos||[];
  const pagMeses=[...new Set(pagAll.map(p=>(p.data||'').slice(0,7)).filter(Boolean))].sort().reverse();
  let pagLista=pagAll.slice();
  if(pagMes!=='todos') pagLista=pagLista.filter(p=>(p.data||'').slice(0,7)===pagMes);
  pagLista.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const pagTotFiltro=pagLista.reduce((s,p)=>s+(Number(p.valor)||0),0);
  const pagMesTot=pagAll.filter(p=>{ const d=parseD(p.data); return d&&d.getMonth()===h.getMonth()&&d.getFullYear()===h.getFullYear(); }).reduce((s,p)=>s+(Number(p.valor)||0),0);
  const pagRows=pagLista.map(p=>`<tr class="clickable" onclick="modalPagamento('${p.id}')">
    <td class="mono">${fmtD(p.data)}</td><td>${esc(p.descricao||'—')}</td>
    <td>${p.categoria?`<span class="st neutro">${esc(p.categoria)}</span>`:'—'}</td>
    <td>${esc(p.forma||'—')}</td>
    <td class="ta-r mono"><b>${money(p.valor)}</b></td>
    <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalPagamento('${p.id}')">${svg('edit')}</button></td></tr>`).join('');
  const pagCard=`
  <div class="card" style="margin-top:18px"><div class="card-h">${svg('doc')}<h3>Planilha de Pagamentos</h3>
    <div class="r no-print" style="gap:8px">
      <select class="selectlite" onchange="pagMes=this.value;router()"><option value="todos">Todos os meses</option>${pagMeses.map(m=>`<option value="${m}" ${pagMes===m?'selected':''}>${mesLabel(m)}</option>`).join('')}</select>
      <button class="btn primary sm" onclick="modalPagamento()">${svg('plus')} Novo pagamento</button></div></div>
    <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="ta-r">Valor</th><th class="no-print"></th></tr></thead>
      <tbody>${pagRows||`<tr><td colspan="6">${emptyState('Nenhum pagamento lançado ainda. Clique em "Novo pagamento" para começar sua planilha.')}</td></tr>`}</tbody>
      ${pagLista.length?`<tfoot><tr><td colspan="4" style="text-align:right;padding-top:10px"><b>Total${pagMes!=='todos'?' · '+mesLabel(pagMes):''}</b></td><td class="ta-r mono" style="padding-top:10px"><b>${money(pagTotFiltro)}</b></td><td class="no-print"></td></tr></tfoot>`:''}
    </table></div></div></div>`;
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
  <div class="banner">${svg('wallet')}<div><b>Financeiro</b><span>Faturamento, vales dos motoristas e a sua planilha de pagamentos. Tudo somado automaticamente.</span></div></div>

  <div class="grid kpis fin-gold" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
    ${kpi('money','i-green', money(fatMes), 'Faturamento no mês','')}
    ${kpi('export','i-blue', money(fatTot), 'Faturamento acumulado', DB.faturamento.length+' lançamento(s)')}
    ${kpi('wallet','i-amber', money(valesAberto), 'Vales em aberto', 'Saldo devedor dos motoristas')}
    ${kpi('doc','i-red', money(pagMesTot), 'Pagamentos no mês', pagAll.length+' na planilha')}
  </div>

  <div class="grid two-col">
    <div class="card"><div class="card-h">${svg('money')}<h3>Faturamento</h3>
      <div class="r no-print" style="gap:6px"><button class="btn sm" onclick="modalImportarFatur()" title="Anexe o relatório do contador (PDF), planilha (Excel/CSV) ou XML das notas — o sistema preenche sozinho">${svg('upload')} Importar do contador</button><button class="btn primary sm" onclick="modalFaturamento()">${svg('plus')} Novo</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Obs</th><th class="no-print"></th></tr></thead>
        <tbody>${fatRows||`<tr><td colspan="5">${emptyState('Nenhum faturamento lançado.')}</td></tr>`}</tbody></table></div></div></div>
    <div class="card"><div class="card-h">${svg('wallet')}<h3>Vales e Pagamentos</h3>
      <div class="r no-print"><button class="btn primary sm" onclick="modalVale()">${svg('plus')} Novo</button></div></div>
      <div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Data</th><th>Motorista</th><th>Tipo</th><th>Valor</th><th class="no-print"></th></tr></thead>
        <tbody>${valeRows||`<tr><td colspan="5">${emptyState('Nenhum vale ou pagamento.')}</td></tr>`}</tbody></table></div></div></div>
  </div>

  ${pagCard}

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

/* ---------- IMPORTAR FATURAMENTO DO CONTADOR (PDF / Excel / XML) ---------- */
let FAT_FILA=[];
function _capitaliza(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1).toLowerCase(); }
function _fatCompLabel(comp){ if(!comp)return '—'; const p=String(comp).split('-'); return MESES_L[(+p[1])-1]+' '+p[0]; }
function modalImportarFatur(){
  openModal(`<div class="m-h">${svg('money')}<h3>Importar faturamento do contador</h3><button class="x" onclick="FAT_FILA=[];closeModal()">×</button></div>
    <div class="m-b">
      <label class="apo-drop" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="event.preventDefault();this.classList.remove('over');_faturLer(event.dataTransfer.files)">
        <input type="file" accept=".pdf,.xlsx,.xls,.csv,.xml,image/*" multiple style="display:none" onchange="_faturLer(this.files);this.value=''">
        ${svg('upload')}<b>Solte aqui o relatório do contador (PDF), a planilha (Excel/CSV) ou os XML das notas</b>
        <span>O sistema lê o arquivo e extrai o faturamento por mês (Saídas, Serviços e Total) ou por nota. Você confere antes de importar.</span>
      </label>
      <div id="fatImpFila">${_faturImpFilaHTML()}</div>
    </div>
    <div class="m-f"><button class="btn" onclick="FAT_FILA=[];closeModal()">Fechar</button>
      <button class="btn primary" id="fatImpBtn" onclick="_faturImportConfirmar()" ${FAT_FILA.length?'':'disabled'}>Importar ${FAT_FILA.filter(x=>x._ok).length||''}</button></div>`, true);
}
function _faturImpFilaHTML(){
  if(!FAT_FILA.length) return `<div class="hint" style="margin-top:12px">Nenhum lançamento lido ainda. Solte um arquivo acima.</div>`;
  const novas=FAT_FILA.filter(x=>x._ok).length, dup=FAT_FILA.filter(x=>x._dup).length;
  return `<div class="muted" style="margin:12px 0 8px">Encontrados <b>${FAT_FILA.length}</b> lançamento(s) · ${novas} novos${dup?' · '+dup+' já existem (ignorados)':''}</div>
    <div class="tbl-wrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr><th></th><th>Competência / Data</th><th>Descrição</th><th class="ta-r">Valor</th></tr></thead>
    <tbody>${FAT_FILA.map((x,i)=>`<tr style="${x._dup?'opacity:.5':''}"><td><input type="checkbox" ${x._ok?'checked':''} ${x._dup?'disabled':''} onchange="FAT_FILA[${i}]._ok=this.checked;_faturImpRefresh()"></td>
      <td class="mono">${x._tipo==='mensal'?esc(_fatCompLabel(x.competencia)):fmtD(x.data)}</td><td>${esc((x.cliente||x.obs||'').slice(0,64))}</td><td class="ta-r mono"><b>${money(x.valor)}</b>${x._dup?' <span class="st neutro">existe</span>':''}</td></tr>`).join('')}</tbody></table></div>`;
}
function _faturImpRefresh(){ const el=document.getElementById('fatImpFila'); if(el)el.innerHTML=_faturImpFilaHTML();
  const b=document.getElementById('fatImpBtn'); if(b){ const n=FAT_FILA.filter(x=>x._ok).length; b.disabled=!n; b.innerHTML='Importar '+(n||''); } }
async function _faturLer(fileList){
  const files=[].slice.call(fileList||[]); if(!files.length) return;
  if(typeof pexBar==='function') pexBar(true);
  try{ for(const f of files){ const nome=(f.name||'').toLowerCase(); let regs=[];
    if(/\.xml$/.test(nome)){ try{ regs=_faturParseXml(await f.text()); }catch(e){} }
    else if(/\.(xlsx|xls|csv)$/.test(nome)){ try{ if(typeof PEXImport!=='undefined'){ const r=await PEXImport.lerArquivo(f); (r.sheets||[]).forEach(sh=>{ regs=regs.concat(_faturDetectExcel(sh.grid||[])); }); } }catch(e){} }
    else { try{ const txt=await pexLerApoliceTexto(f); regs=_faturParseRelatorio(txt||''); }catch(e){} }
    regs.forEach(r=>FAT_FILA.push(r));
  } }
  finally{ if(typeof pexBar==='function') pexBar(false); }
  // marca duplicados: mensal = mesma competência; nota = mesma chave (ou data+valor)
  const compExiste=new Set((DB.faturamento||[]).map(f=>(f.data||'').slice(0,7)));
  const chaveExiste=new Set((DB.faturamento||[]).map(f=>f.chave).filter(Boolean));
  const naFila=new Set();
  FAT_FILA.forEach(x=>{ let dup=false;
    if(x._tipo==='mensal'){ const k='M'+x.competencia; dup=compExiste.has(x.competencia)||naFila.has(k); naFila.add(k); }
    else { const k=x.chave||('D'+x.data+'|'+x.valor); dup=(x.chave&&chaveExiste.has(x.chave))||naFila.has(k); naFila.add(k); }
    x._dup=dup; x._ok=!dup; });
  _faturImpRefresh();
}
/* Relatório de faturamento do contador (PDF/texto): linhas "Mês Ano Saídas Serviços Outros Total" */
function _faturParseRelatorio(txt){
  const out=[]; if(!txt) return out;
  const MES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const num=s=>parseFloat(String(s).replace(/\./g,'').replace(',','.'))||0;
  const re=/(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/gi;
  let m;
  while((m=re.exec(txt))){ const mes=MES[_pedNorm(m[1])]; if(!mes) continue; const ano=m[2];
    const saidas=num(m[3]), servicos=num(m[4]), outros=num(m[5]), total=num(m[6]); const comp=ano+'-'+String(mes).padStart(2,'0');
    out.push({ data:comp+'-01', cliente:'', valor:total,
      obs:'Faturamento '+_capitaliza(m[1])+'/'+ano+' — Saídas '+money(saidas)+' · Serviços '+money(servicos)+(outros?' · Outros '+money(outros):'')+' (relatório do contador)',
      competencia:comp, saidas, servicos, outros, fonte:'contador', _tipo:'mensal' }); }
  return out;
}
/* XML de NF-e / CT-e (uma nota por arquivo) */
function _faturParseXml(txt){
  const out=[]; let doc; try{ doc=new DOMParser().parseFromString(txt,'text/xml'); }catch(e){ return out; }
  const tag=(root,name)=>{ const el=(root||doc).getElementsByTagName(name); return el.length?el[el.length-1].textContent.trim():''; };
  const first=(root,name)=>{ const el=(root||doc).getElementsByTagName(name); return el.length?el[0].textContent.trim():''; };
  const money2=s=>parseFloat(String(s).replace(/[^\d.]/g,''))||0;
  const vNF=tag(doc,'vNF');
  if(vNF){ const dh=first(doc,'dhEmi')||first(doc,'dEmi'); let destNome=''; const dest=doc.getElementsByTagName('dest'); if(dest.length) destNome=first(dest[0],'xNome');
    out.push({ data:(dh||'').slice(0,10), cliente:destNome, valor:money2(vNF), obs:'NF-e nº '+first(doc,'nNF'), chave:(first(doc,'chNFe')||'').replace(/\D/g,''), fonte:'contador', _tipo:'nota' }); return out; }
  const vTP=tag(doc,'vTPrest');
  if(vTP){ const dh=first(doc,'dhEmi'); let nome=''; const rem=doc.getElementsByTagName('rem'); if(rem.length) nome=first(rem[0],'xNome');
    out.push({ data:(dh||'').slice(0,10), cliente:nome, valor:money2(vTP), obs:'CT-e nº '+first(doc,'nCT'), chave:(first(doc,'chCTe')||'').replace(/\D/g,''), fonte:'contador', _tipo:'nota' }); return out; }
  const vNFS=tag(doc,'ValorServicos')||tag(doc,'ValorLiquidoNfse')||tag(doc,'vServ');
  if(vNFS){ const dh=first(doc,'DataEmissao')||first(doc,'dhEmi'); out.push({ data:(dh||'').slice(0,10), cliente:first(doc,'RazaoSocial')||'', valor:money2(vNFS), obs:'NFS-e', chave:'', fonte:'contador', _tipo:'nota' }); return out; }
  return out;
}
/* Planilha Excel/CSV do contador (mensal ou por nota) */
function _faturDetectExcel(grid){
  const out=[]; if(!grid||!grid.length) return out;
  const norm=s=>_pedNorm(String(s==null?'':s));
  const num=s=>{ s=String(s==null?'':s).replace(/[^\d.,-]/g,''); if(!s)return 0; if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.'); return parseFloat(s)||0; };
  const MES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  let hIdx=-1; const cols={};
  for(let i=0;i<Math.min(grid.length,20);i++){ const row=(grid[i]||[]).map(norm);
    if(row.some(c=>/total|valor/.test(c)) && row.some(c=>/mes|m e s|data|compet|periodo|ano/.test(c))){ hIdx=i;
      row.forEach((c,j)=>{ if(/^m ?e ?s$|^mes|mês/.test(c)&&cols.mes==null)cols.mes=j; else if(/ano/.test(c))cols.ano=j; else if(/(data|compet|periodo)/.test(c)&&cols.data==null)cols.data=j;
        else if(/total/.test(c))cols.total=j; else if(/valor/.test(c)&&cols.valor==null)cols.valor=j; else if(/saida/.test(c))cols.saidas=j; else if(/servic/.test(c))cols.servicos=j; else if(/outros/.test(c))cols.outros=j;
        else if(/cliente|tomador|remet|razao|destinat/.test(c))cols.cliente=j; }); break; } }
  if(hIdx<0) return out;
  for(let i=hIdx+1;i<grid.length;i++){ const row=grid[i]||[]; const g=k=>cols[k]!=null?row[cols[k]]:'';
    const mesRaw=norm(g('mes')); if(/total|totais/.test(mesRaw)) continue;
    const totalV=num(g('total'))||num(g('valor'));
    if(cols.mes!=null && MES[mesRaw]){ const mes=MES[mesRaw]; const am=String(g('ano')||'').match(/\d{4}/); const ano=am?am[0]:String(hoje().getFullYear());
      const comp=ano+'-'+String(mes).padStart(2,'0'); const saidas=num(g('saidas')), servicos=num(g('servicos')), outros=num(g('outros')); const val=totalV||(saidas+servicos+outros); if(!val)continue;
      out.push({ data:comp+'-01', cliente:'', valor:val, obs:'Faturamento '+_capitaliza(mesRaw)+'/'+ano+((saidas||servicos)?' — Saídas '+money(saidas)+' · Serviços '+money(servicos):'')+' (planilha do contador)', competencia:comp, saidas, servicos, outros, fonte:'contador', _tipo:'mensal' });
    } else if(cols.data!=null){ const dISO=(typeof _impISO==='function')?_impISO(g('data')):''; if(!dISO||!totalV)continue;
      out.push({ data:dISO, cliente:String(g('cliente')||'').trim(), valor:totalV, obs:'Importado da planilha do contador', fonte:'contador', _tipo:'nota' }); } }
  return out;
}
function _faturImportConfirmar(){
  const sel=FAT_FILA.filter(x=>x._ok && !x._dup);
  if(!sel.length){ toast('Nada novo para importar.','err'); return; }
  sel.forEach(x=>{ const rec={}; Object.keys(x).forEach(k=>{ if(k[0]!=='_') rec[k]=x[k]; }); rec.id=uid('ft'); (DB.faturamento=DB.faturamento||[]).push(rec); });
  FAT_FILA=[]; saveDB(); closeModal(); toast(sel.length+' lançamento(s) de faturamento importado(s).'); location.hash='#financeiro'; router();
}
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

/* ---------- PLANILHA DE PAGAMENTOS (separada dos vales) ---------- */
function modalPagamento(id){
  const p=id?(DB.pagamentos||[]).find(x=>x.id===id):{data:new Date().toISOString().slice(0,10),descricao:'',categoria:'',forma:'',valor:'',obs:''};
  if(!p){ toast('Pagamento não encontrado.','err'); return; }
  const cats=['Combustível','Manutenção','Pedágio','Pneus','Peças','Fornecedor','Salário','Imposto/Taxa','Aluguel','Financiamento/Parcela','Seguro','Escritório','Outros'];
  const formas=['Pix','Dinheiro','Boleto','Cartão','Débito automático','Transferência','Cheque'];
  openModal(`<div class="m-h">${svg('wallet')}<h3>${id?'Editar pagamento':'Novo pagamento'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="field-row">${fld('Data','f_data',p.data,'date')}${fldR$('Valor pago (R$)','f_valor',p.valor)}</div>
      ${fld('Descrição','f_desc',p.descricao,'text','O que foi pago (ex.: Diesel Posto X, Boleto fornecedor...)')}
      <div class="field-row">
        <div class="field"><label>Categoria</label><input id="f_cat" list="pagCats" value="${esc(p.categoria||'')}" placeholder="Escolha ou digite"><datalist id="pagCats">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><label>Forma de pagamento</label><input id="f_forma" list="pagFormas" value="${esc(p.forma||'')}" placeholder="Escolha ou digite"><datalist id="pagFormas">${formas.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
      <div class="field"><label>Observações</label><input id="f_obs" value="${esc(p.obs||'')}"></div>
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirPagamento('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarPagamento('${id||''}')">Salvar</button></div>`);
}
function salvarPagamento(id){
  if(!val('f_desc') && !val('f_valor')){ toast('Informe pelo menos a descrição e o valor.','err'); return; }
  const d={ data:val('f_data'), descricao:val('f_desc'), categoria:val('f_cat'), forma:val('f_forma'), valor:parseBRL(val('f_valor')), obs:val('f_obs') };
  if(id){ Object.assign((DB.pagamentos||[]).find(x=>x.id===id), d); }
  else { d.id=uid('pg'); (DB.pagamentos=DB.pagamentos||[]).push(d); }
  saveDB(); closeModal(); toast('Pagamento salvo.'); router();
}
function excluirPagamento(id){ if(!confirm('Excluir este pagamento da planilha?'))return; DB.pagamentos=(DB.pagamentos||[]).filter(x=>x.id!==id); saveDB(); closeModal(); toast('Pagamento excluído.'); router(); }

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
      <td class="mono">${fmtD(c.data)}</td><td class="mono"><b>${esc(c.numero||'—')}</b>${c.serie?`<div class="muted" style="font-size:10.5px">série ${esc(c.serie)}</div>`:''}</td>
      <td>${v?plate(v.placa,v.tipo):esc(c.placa||'—')}</td>
      <td>${esc(c.cliente||'—')}${c.destinatario?`<div class="muted" style="font-size:11px">→ ${esc(c.destinatario)}</div>`:''}</td>
      <td class="muted" style="font-size:12px">${(c.origem||c.destino)?esc((c.origem||'?')+' → '+(c.destino||'?')):'—'}</td>
      <td class="mono">${money(c.valor)}</td>
      <td><span class="st ${cteStCls(c.status)}">${esc(c.status||'—')}</span></td>
      <td class="no-print" style="text-align:right"><button class="btn ghost sm" onclick="event.stopPropagation();modalCte('${c.id}')">${svg('edit')}</button></td></tr>`;
  }).join('');
  return `
  <div class="banner">${svg('ctedoc')}<div><b>CT-e — Conhecimentos de Transporte</b><span>Controle dos CT-e emitidos, lançados, trocados e pagos. Importe os XML direto aqui. Filtre por situação e por mês.</span></div>
    <label class="btn no-print" style="margin-left:auto">${svg('import')} Importar XML<input type="file" accept=".xml,text/xml" multiple onchange="importarCteArquivos(event)" style="display:none"></label>
    <button class="btn primary no-print" onclick="modalCte()">${svg('plus')} Novo CT-e</button></div>
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
    <thead><tr><th>Data</th><th>Nº CT-e</th><th>Placa</th><th>Cliente / Destinatário</th><th>Rota</th><th>Valor</th><th>Situação</th><th class="no-print"></th></tr></thead>
    <tbody>${rows||`<tr><td colspan="8">${emptyState('Nenhum CT-e neste filtro. Importe os XML ou clique em "Novo CT-e".')}</td></tr>`}</tbody></table></div></div></div>`;
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
      <div class="field-row">${fld('Origem','f_orig',c.origem||'')}${fld('Destino','f_dest',c.destino||'')}</div>
      ${fld('Destinatário (recebedor)','f_dtn',c.destinatario||'')}
      <div class="field"><label>Observação</label><input id="f_obs" value="${esc(c.obs)}"></div>
      ${c.chave?`<div class="hint" style="word-break:break-all">Chave: <span class="mono">${esc(c.chave)}</span>${c.produto?`<br>Produto: ${esc(c.produto)}`:''}${c.cfop?` · CFOP ${esc(c.cfop)}`:''}${c.vCarga?` · Carga R$ ${esc(c.vCarga)}`:''}</div>`:''}
    </div>
    <div class="m-f">${id?`<button class="btn danger" style="margin-right:auto" onclick="excluirCte('${id}')">${svg('trash')} Excluir</button>`:''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="salvarCte('${id||''}')">Salvar</button></div>`);
}
function salvarCte(id){ const d={data:val('f_data'),numero:val('f_num'),placa:val('f_placa'),cliente:val('f_cli'),valor:parseBRL(val('f_val')),status:val('f_status'),
    origem:val('f_orig'),destino:val('f_dest'),destinatario:val('f_dtn'),obs:val('f_obs')};
  if(id)Object.assign(DB.ctes.find(x=>x.id===id),d); else{ d.id=uid('ct'); DB.ctes.push(d); } saveDB(); closeModal(); toast('CT-e salvo.'); router(); }
function excluirCte(id){ if(!confirm('Excluir este CT-e?'))return; DB.ctes=DB.ctes.filter(x=>x.id!==id); saveDB(); closeModal(); toast('Excluído.'); router(); }
/* ---- Importar CT-e a partir dos arquivos XML (funciona no navegador, offline) ---- */
function parseCteXml(txt, fname){
  const doc=new DOMParser().parseFromString(txt,'text/xml');
  if(doc.getElementsByTagName('parsererror').length) return null;
  const first=(root,tag)=>{ const p=(root||doc).getElementsByTagName(tag)[0]; return p?p.textContent.trim():''; };
  const ide=doc.getElementsByTagName('ide')[0];
  const rem=doc.getElementsByTagName('rem')[0], dest=doc.getElementsByTagName('dest')[0];
  const vp=doc.getElementsByTagName('vPrest')[0], carga=doc.getElementsByTagName('infCarga')[0];
  if(!ide) return null;
  let chave=(fname&&(fname.match(/(\d{44})/)||[])[1])||first(null,'chCTe'); if(!chave) return null;
  const dh=first(ide,'dhEmi'); const data=(dh.match(/(\d{4}-\d{2}-\d{2})/)||[])[1]||'';
  const vtp=parseFloat((first(vp,'vTPrest')||'0').replace(/[^\d.]/g,''))||0;
  const c={ id:'cte_'+chave, chave:chave, data:data, numero:first(ide,'nCT'), serie:first(ide,'serie'),
    cfop:first(ide,'CFOP'), tpCTe:first(ide,'tpCTe'),
    cliente:rem?first(rem,'xNome'):'', destinatario:dest?first(dest,'xNome'):'',
    origem:(first(ide,'xMunIni')+'/'+first(ide,'UFIni')).replace(/^\/$/,''),
    destino:(first(ide,'xMunFim')+'/'+first(ide,'UFFim')).replace(/^\/$/,''),
    valor:vtp, vCarga:carga?first(carga,'vCarga'):'', produto:carga?first(carga,'proPred'):'',
    placa:'', status:'Emitido', pago:'', obs:first(doc,'xObs') };
  return cteDerivaPlaca(c);
}
function importarCteArquivos(ev){
  const files=[].slice.call(ev.target.files||[]); ev.target.value='';
  if(!files.length) return;
  let add=0, dup=0, err=0, pend=files.length;
  files.forEach(f=>{ const r=new FileReader();
    r.onload=()=>{ try{ const c=parseCteXml(r.result, f.name);
        if(!c){ err++; } else if(DB.ctes.some(x=>x.id===c.id)){ dup++; } else { DB.ctes.push(c); add++; }
      }catch(e){ err++; }
      if(--pend===0){ saveDB(); router();
        toast(add+' CT-e importado(s)'+(dup?' · '+dup+' já existiam':'')+(err?' · '+err+' com erro':'')+'.', err&&!add?'err':undefined); }
    };
    r.readAsText(f,'UTF-8');
  });
}

function tick(){ const d=new Date(); const el=document.getElementById('clock'); if(el) el.innerHTML=`<b>${DIAS[d.getDay()]}</b>, ${String(d.getDate()).padStart(2,'0')} de ${MESES_L[d.getMonth()]} de ${d.getFullYear()}`; }
/* Tirar relatório: monta um cabeçalho e abre a impressão (permite salvar em PDF) */
function imprimirRelatorio(){
  const h=(location.hash||'#inicio').slice(1).split('/'); const meta=(typeof ROTAS!=='undefined'&&ROTAS[h[0]])||{};
  let tit=meta.t||'Relatório';
  if(h[1]){ const v=veiculo(h[1]); const m=motorista(h[1]); if(v) tit+=' — '+v.placa; else if(m) tit+=' — '+m.nome; }
  const ph=document.getElementById('printHead');
  if(ph){ const d=new Date();
    ph.innerHTML=`<div class="ph-row">
        <div class="ph-co"><b>PLANETA EXPRESS TRANSPORTES</b><span>${esc(DB.empresa.razao||DB.empresa.nome||'')} · CNPJ ${esc(DB.empresa.cnpj||'')}</span></div>
        <div class="ph-dt">Emitido em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div class="ph-title">${esc(tit)}</div>`;
  }
  closeSidebar(); window.print();
}
function toggleSidebar(){ document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('scrim').classList.toggle('show'); }
function closeSidebar(){ document.querySelector('.sidebar')?.classList.remove('open'); document.getElementById('scrim')?.classList.remove('show'); }

/* ---- Navegação mobile: pilha de histórico para o botão Voltar ---- */
var PEX_NAV=[]; var _pexNavBack=false;
function _pexTrackNav(){
  var h=location.hash||'#inicio';
  if(_pexNavBack){ _pexNavBack=false; return; }           // veio do "Voltar": não re-empilha
  if(PEX_NAV[PEX_NAV.length-1]!==h) PEX_NAV.push(h);       // ignora repetição da mesma tela
  if(PEX_NAV.length>60) PEX_NAV.shift();
}
function navVoltar(){
  closeSidebar();
  if(PEX_NAV.length>1){
    PEX_NAV.pop();                                          // remove a tela atual
    var alvo=PEX_NAV[PEX_NAV.length-1]||'#inicio';
    _pexNavBack=true;
    if((location.hash||'#inicio')===alvo){ router(); } else { location.hash=alvo; }
  } else {                                                  // sem histórico → Início (nunca prende o usuário)
    if((location.hash||'#inicio')!=='#inicio') location.hash='#inicio'; else router();
  }
}
/* Recolher menu para "trilho" só-ícones (desktop). Estado salvo no aparelho. */
function toggleRail(){ const on=!document.body.classList.contains('rail'); document.body.classList.toggle('rail',on);
  try{ localStorage.setItem('pex_rail', on?'1':'0'); }catch(e){}
  const b=document.querySelector('.rail-toggle'); if(b) b.title = on?'Expandir menu':'Recolher menu'; }
function applyRail(){ let on=false; try{ on=localStorage.getItem('pex_rail')==='1'; }catch(e){}
  document.body.classList.toggle('rail',on);
  const b=document.querySelector('.rail-toggle'); if(b) b.title = on?'Expandir menu':'Recolher menu'; }

/* ================================================================== */
/*  COCKPIT SUPERIOR (v6.19) — busca global, comandos rápidos,          */
/*  atalhos, central de notificações, clima, relógio, status.           */
/*  Só interface/UX: não altera dados, rotas, permissões nem módulos.   */
/* ================================================================== */
/* ---- Busca global inteligente ---- */
function pexSearch(q){
  q=(q||'').trim().toLowerCase(); if(!q) return [];
  const kq=q.replace(/[^a-z0-9]/g,'');
  const inc=(s)=> String(s==null?'':s).toLowerCase().indexOf(q)>=0;
  const inck=(s)=> kq.length>=2 && String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]/g,'').indexOf(kq)>=0;
  const R=[]; const add=(cat,ico,title,sub,hash)=>R.push({cat,ico,title,sub,hash});
  (DB.veiculos||[]).forEach(v=>{ if(v.status==='Arquivado')return;
    if(inck(v.placa)||inc(v.marca)||inc(v.modelo)||inc(v.chassi)||inc(v.renavam)) add('Veículo','truck',v.placa,((v.marca||'')+' '+(v.modelo||'')).trim()||'—','#frota/'+v.id); });
  (DB.motoristas||[]).forEach(m=>{ if(inc(m.nome)||inck(m.cpf)||inck(m.rg)) add('Motorista','user',m.nome,m.funcao||'Motorista','#motoristas/'+m.id); });
  (DB.ctes||[]).forEach(c=>{ if(inc(c.numero)||inck(c.chave)||inc(c.cliente)||inc(c.destinatario)||inc(c.origem)||inc(c.destino)) add('CT-e','ctedoc','CT-e '+(c.numero||''),(c.cliente||'')+(c.destino?' → '+c.destino:''),'#ctes'); });
  (DB.viagens||[]).forEach(v=>{ if(inck(v.placa)||inc(v.motorista)||inc(v.destino)||inc(v.transporte)||inck(v.transporte)||inc(v.termoPallet)||inck(v.termoPallet))
    add('Viagem','route',(v.placa||'—')+(v.destino?' · '+v.destino:''),'Transp. '+(v.transporte||'—')+' · Termo '+(v.termoPallet||'—')+(v.data?' · '+fmtD(v.data):''),'#viagens/'+v.id); });
  (DB.servicos||[]).forEach(s=>{ if(inc(s.descricao)||inc(s.oficina)){ const v=veiculo(s.veiculoId); add('Manutenção','wrench',s.descricao||'Serviço',((v?v.placa+' · ':'')+(s.oficina||'')).trim()||'—', v?'#manutencao/'+v.id:'#manutencao'); } });
  (DB.pneus||[]).forEach(p=>{ if(inc(p.marca)||inc(p.medida)||inc(p.posicao)){ const v=veiculo(p.veiculoId); add('Pneu','tire',((p.marca||'Pneu')+' '+(p.medida||'')).trim(),((v?v.placa+' · ':'')+(p.posicao||'')).trim()||'—', v?'#pneus/'+v.id:'#pneus'); } });
  (DB.notas||[]).forEach(n=>{ if(inc(n.obs)||inc(n.inicio)||inc(n.fim)) add('Nota','money','Nota '+fmtD(n.inicio)+'–'+fmtD(n.fim),money(totalNota(n)),'#notas'); });
  try{ (typeof todosArquivos==='function'?todosArquivos():[]).forEach(f=>{ const nome=f.name||f.nome||''; if(inc(nome)) add('Documento','doc',nome,f.categoria||'Arquivo','#documentos'); }); }catch(e){}
  return R.slice(0,40);
}
/* ---- Ações rápidas (Novo…) ---- */
const PEX_CMDS=[
  {label:'Novo veículo', ico:'truck', fn:function(){ modalVeiculo(); }},
  {label:'Novo motorista', ico:'user', fn:function(){ modalMotorista(); }},
  {label:'Nova viagem', ico:'route', fn:function(){ modalViagem(); }},
  {label:'Novo abastecimento', ico:'fuel', fn:function(){ modalAbastec(); }},
  {label:'Novo serviço de manutenção', ico:'wrench', fn:function(){ modalServico(); }},
  {label:'Novo CT-e', ico:'ctedoc', fn:function(){ modalCte(); }},
  {label:'Novo check-list', ico:'check', fn:function(){ modalChecklist(); }},
  {label:'Nova nota de despesa', ico:'money', fn:function(){ modalNota(); }},
  {label:'Nova descarga', ico:'box', fn:function(){ modalDescarga(); }},
  {label:'Tirar relatório desta tela', ico:'print', fn:function(){ imprimirRelatorio(); }}
];
/* ---- Paleta de comandos (Ctrl+K / Ctrl+N) ---- */
let PEXCMD={sel:0, items:[]};
function pexCmdOpen(mode){
  let el=document.getElementById('pexCmd'); if(!el){ el=document.createElement('div'); el.id='pexCmd'; el.className='cmdk'; document.body.appendChild(el); }
  el.innerHTML=`<div class="cmdk-back" onclick="pexCmdClose()"></div>
    <div class="cmdk-box" role="dialog" aria-label="Busca e comandos">
      <div class="cmdk-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="cmdkInput" placeholder="Buscar placa, motorista, CT-e, nota, viagem, manutenção, pneus…" autocomplete="off"><kbd>ESC</kbd></div>
      <div class="cmdk-list" id="cmdkList"></div>
      <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>K</kbd> buscar · <kbd>Ctrl</kbd><kbd>N</kbd> novo</span></div>
    </div>`;
  requestAnimationFrame(()=>el.classList.add('show'));
  const inp=document.getElementById('cmdkInput');
  inp.value = mode==='new' ? '>' : '';
  inp.addEventListener('input', function(){ pexCmdRender(inp.value); });
  inp.addEventListener('keydown', pexCmdKey);
  pexCmdRender(inp.value);
  setTimeout(function(){ inp.focus(); },40);
}
function pexCmdClose(){ const el=document.getElementById('pexCmd'); if(el){ el.classList.remove('show'); setTimeout(function(){ if(el && !el.classList.contains('show')) el.innerHTML=''; },200); } }
function pexCmdRender(q){
  q=q||''; const cmdMode=q.charAt(0)==='>'; const qq=(cmdMode?q.slice(1):q).trim();
  let html=''; const items=[];
  const cmds=PEX_CMDS.filter(function(c){ return !qq || c.label.toLowerCase().indexOf(qq.toLowerCase())>=0; });
  if(cmds.length){ html+='<div class="cmdk-cat">Ações rápidas</div>';
    cmds.forEach(function(c){ const i=items.length; items.push({fn:c.fn});
      html+=`<a class="cmdk-row" data-i="${i}" onclick="pexCmdDo(${i})"><span class="cmdk-ico">${svg(c.ico)}</span><span class="cmdk-t">${esc(c.label)}</span><span class="cmdk-tag act">Ação</span></a>`; });
  }
  if(!cmdMode && qq){ const res=pexSearch(qq);
    if(res.length){ html+='<div class="cmdk-cat">Resultados</div>';
      res.forEach(function(r){ const i=items.length; items.push({hash:r.hash});
        html+=`<a class="cmdk-row" data-i="${i}" onclick="pexCmdDo(${i})"><span class="cmdk-ico">${svg(r.ico)}</span><span class="cmdk-t">${esc(r.title)}<small>${esc(r.sub||'')}</small></span><span class="cmdk-tag">${esc(r.cat)}</span></a>`; });
    } else if(!cmds.length){ html+='<div class="cmdk-empty">Nada encontrado para "'+esc(qq)+'".</div>'; }
  }
  if(!html) html='<div class="cmdk-empty">Digite para buscar, ou escolha uma ação rápida.</div>';
  PEXCMD.items=items; PEXCMD.sel=0;
  const list=document.getElementById('cmdkList'); if(list){ list.innerHTML=html; pexCmdHi(); }
}
function pexCmdHi(){ const rows=document.querySelectorAll('#cmdkList .cmdk-row'); rows.forEach(function(r,i){ r.classList.toggle('sel',i===PEXCMD.sel); }); const cur=rows[PEXCMD.sel]; if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:'nearest'}); }
function pexCmdKey(e){ const n=PEXCMD.items.length;
  if(e.key==='ArrowDown'){ e.preventDefault(); PEXCMD.sel=Math.min(Math.max(0,n-1),PEXCMD.sel+1); pexCmdHi(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); PEXCMD.sel=Math.max(0,PEXCMD.sel-1); pexCmdHi(); }
  else if(e.key==='Enter'){ e.preventDefault(); pexCmdDo(PEXCMD.sel); }
  else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); pexCmdClose(); } }
function pexCmdDo(i){ const it=PEXCMD.items[i]; if(!it) return; pexCmdClose();
  if(it.hash){ location.hash=it.hash; } else if(it.fn){ try{ it.fn(); }catch(e){} } }

/* ---- Central de notificações ---- */
function _vencNome(x){ if(x.entidade==='veiculo'){ const v=veiculo(x.refId); return v?v.placa:''; } if(x.entidade==='motorista'){ const m=motorista(x.refId); return m?m.nome:''; } return x.nome||''; }
function pexNotifData(){ const crit=[],avi=[],info=[];
  (todosVencimentos()||[]).forEach(function(x){ const s=situacao(x.validade); const nome=_vencNome(x); const t=(x.tipo||'Documento')+(nome?' — '+nome:'');
    if(s.ord===0) crit.push({t:t, s:'Documento vencido', when:fmtD(x.validade), hash:'#vencimentos/vencido'});
    else if(s.ord===1) avi.push({t:t, s:'Vence em '+s.dias+' dia(s)', when:fmtD(x.validade), hash:'#vencimentos/critico'}); });
  const ver=(document.querySelector('.sidebar .foot b')||{}).textContent||'';
  info.push({t:'Sistema atualizado', s:'Versão '+ver+' instalada', when:''});
  info.push({t:'Backup automático', s:'Programado para 03:00', when:''});
  const pend=(DB.viagens||[]).filter(function(v){ return v.status==='Pendente'; }).length;
  if(pend) info.push({t:pend+' viagem(ns) pendente(s)', s:'Aguardando baixa', when:'', hash:'#viagens'});
  return {crit:crit, avi:avi, info:info}; }
function pexNotifBadge(){ const d=pexNotifData(); const n=d.crit.length+d.avi.length; const b=document.getElementById('cockBadge');
  if(b){ b.textContent=n>99?'99+':(n||''); b.style.display=n?'flex':'none'; b.classList.toggle('crit',d.crit.length>0); } }
function pexNotifToggle(ev){ if(ev) ev.stopPropagation();
  let el=document.getElementById('cockNotif');
  if(el && el.classList.contains('show')){ pexNotifClose(); return; }
  if(!el){ el=document.createElement('div'); el.id='cockNotif'; el.className='cock-notif'; document.body.appendChild(el); }
  const d=pexNotifData();
  const sec=function(title,arr,cls){ return arr.length? `<div class="cn-cat ${cls}">${title}<span>${arr.length}</span></div>`+arr.slice(0,10).map(function(x){ return `<div class="cn-row"${x.hash?` onclick="location.hash='${x.hash}';pexNotifClose()"`:''}><span class="cn-dot ${cls}"></span><div class="cn-main"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div>${x.when?`<div class="cn-when">${esc(x.when)}</div>`:''}</div>`; }).join('') : ''; };
  const body=sec('Críticos',d.crit,'crit')+sec('Avisos',d.avi,'warn')+sec('Informativos',d.info,'info');
  el.innerHTML=`<div class="cn-h">${svg('bell')}<b>Central de notificações</b></div><div class="cn-body">${body||'<div class="cn-empty">Tudo em dia ✓</div>'}</div>`;
  requestAnimationFrame(function(){ el.classList.add('show'); });
  setTimeout(function(){ document.addEventListener('click', pexNotifOutside); },10);
}
function pexNotifOutside(e){ const el=document.getElementById('cockNotif'), bell=document.getElementById('cockBell');
  if(el && !el.contains(e.target) && bell && !bell.contains(e.target)) pexNotifClose(); }
function pexNotifClose(){ const el=document.getElementById('cockNotif'); if(el) el.classList.remove('show'); document.removeEventListener('click', pexNotifOutside); }

/* ---- Clima (Londrina) — melhor-esforço online, degrada offline ---- */
function _wxInfo(code){ code=+code;
  if(code===0) return ['☀️','Céu limpo']; if(code<=2) return ['🌤️','Parcialmente nublado']; if(code===3) return ['☁️','Nublado'];
  if(code>=45&&code<=48) return ['🌫️','Névoa']; if(code>=51&&code<=67) return ['🌦️','Garoa/chuva']; if(code>=71&&code<=77) return ['❄️','Neve'];
  if(code>=80&&code<=82) return ['🌧️','Pancadas']; if(code>=95) return ['⛈️','Tempestade']; return ['🌡️','—']; }
function pexWeatherRender(temp,code){ const el=document.getElementById('cockWeather'); if(!el) return; const wi=_wxInfo(code);
  el.style.display='flex'; el.title='Clima em Londrina — '+wi[1]; el.innerHTML=`<span class="wx-ic">${wi[0]}</span><span class="wx-tx"><b>${temp}°</b><small>Londrina</small></span>`; }
function pexWeather(){ const el=document.getElementById('cockWeather'); if(!el) return;
  try{ const c=JSON.parse(localStorage.getItem('pex_weather')||'null'); if(c && (Date.now()-c.t)<1800000){ pexWeatherRender(c.temp,c.code); return; } }catch(e){}
  if(!navigator.onLine){ el.style.display='none'; return; }
  fetch('https://api.open-meteo.com/v1/forecast?latitude=-23.31&longitude=-51.16&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo')
    .then(function(r){ return r.json(); })
    .then(function(j){ const temp=Math.round(j.current.temperature_2m), code=j.current.weather_code;
      try{ localStorage.setItem('pex_weather', JSON.stringify({t:Date.now(),temp:temp,code:code})); }catch(e){}
      pexWeatherRender(temp,code); })
    .catch(function(){ el.style.display='none'; }); }

/* ---- Relógio em tempo real ---- */
function cockTick(){ const d=new Date();
  const t=document.getElementById('cockTime'); if(t) t.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  const dt=document.getElementById('cockDate'); if(dt) dt.textContent=(DIAS[d.getDay()]||'')+' · '+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }

/* ---- Status do sistema (online/backup/sincronização/banco) ---- */
function pexCockStatus(){ const el=document.getElementById('cockStatus'); if(!el) return;
  const on=!!(typeof nuvemAtiva==='function' && nuvemAtiva() && typeof nuvemUser==='function' && nuvemUser());
  el.className='cock-status '+(on?'on':'off');
  el.innerHTML=`<i></i><span>${on?'Online':'Local'}</span>`;
  const quem=on?(nomeUsuario()||'usuário'):'';
  el.title=on ? ('Servidor online · '+quem+' · 1 usuário conectado · Backup 03:00 · Banco de dados sincronizado') : 'Modo local — dados salvos com segurança neste aparelho'; }

/* ---- Inicialização do cockpit ---- */
function pexCockInit(){
  cockTick(); setInterval(cockTick,1000);
  pexWeather(); setInterval(pexWeather,1800000);
  pexCockStatus(); setInterval(pexCockStatus,15000);
  pexNotifBadge();
  window.addEventListener('online', function(){ pexCockStatus(); pexWeather(); });
  window.addEventListener('offline', pexCockStatus);
  document.addEventListener('keydown', function(e){ if(!(e.ctrlKey||e.metaKey)) return; const k=(e.key||'').toLowerCase();
    if(k==='k'){ e.preventDefault(); pexCmdOpen(); }
    else if(k==='n'){ e.preventDefault(); pexCmdOpen('new'); }
    else if(k==='/'){ e.preventDefault(); pexCmdOpen(); } });
}
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
  applyRail();
  try{ await idbOpen(); await reloadFiles(); }catch(e){ FILES=[]; }
  tick(); setInterval(tick,30000);
  window.addEventListener('hashchange',router);
  document.getElementById('overlay').addEventListener('click',e=>{ if(e.target.id==='overlay') closeModal(); });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    const ov=document.getElementById('overlay');
    if(ov && ov.classList.contains('show')){ closeModal(); return; }      // modal aberto → fecha
    if(document.querySelector('#pexCmd.show')) return;                     // paleta Ctrl+K cuida do próprio ESC
    const nt=document.getElementById('cockNotif'); if(nt && nt.classList.contains('show')){ nt.classList.remove('show'); return; }
    if(typeof navVoltar==='function') navVoltar();                        // nada aberto → volta uma tela
  });
  document.addEventListener('input', aplicarMascaraInput);   /* pontuação automática (CPF, RG, telefone…) */
  if(typeof iaAtualizarAcesso==='function') iaAtualizarAcesso();  /* IA: aparece offline; online só após login */
  const s=document.getElementById('gsearch'); if(s) s.addEventListener('keydown',e=>{ if(e.key==='Enter') buscaGlobal(s.value); });
  if(typeof pexCockInit==='function') pexCockInit();
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
