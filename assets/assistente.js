/* ==========================================================================
   PLANETA EXPRESS — Assistente Inteligente (agente de comandos)
   Você escreve em português normal o que aconteceu e o sistema cria/atualiza
   sozinho o registro certo. Ex.:
     "trocado 4 pneus tração veículo IRU-4G62 dia 25/07/2026 com 1503600 km"
   Funciona 100% offline (sem internet). Reconhece: pneus, KM/horas, troca de
   óleo, bateria, abastecimento, descarga e serviços/reparos.
   ========================================================================== */
'use strict';

const IA = { msgs:[], open:false, undo:{}, chips:[], _uc:0 };

/* ------------------------------------------------------------------ */
/*  Leitura do texto (interpretação)                                   */
/* ------------------------------------------------------------------ */
function _iaNorm(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
function _iaHoje(){ return new Date().toISOString().slice(0,10); }
function _iaHojeBR(){ const d=new Date(); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
function _iaParseNum(s){ if(s==null) return null; s=String(s).trim();
  if(/,/.test(s)){ s=s.replace(/\./g,'').replace(',','.'); } else { s=s.replace(/\./g,''); }
  const n=parseFloat(s.replace(/[^\d.]/g,'')); return isNaN(n)?null:n; }
/* placa (formato antigo ABC-1234 ou Mercosul ABC1D23) -> veículo cadastrado */
function _iaPlacaTexto(t){ const m=String(t).toUpperCase().match(/\b([A-Z]{3})[- ]?(\d[A-Z0-9]\d{2})\b/); return m?(m[1]+'-'+m[2]):''; }
function _iaVeiculo(t){ const p=_iaPlacaTexto(t); return p?veiculoByPlaca(p):null; }
function _iaData(t){ const m=String(t).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if(m){ let d=m[1],mo=m[2],y=m[3]; if(y.length===2)y='20'+y; return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  const n=_iaNorm(t);
  if(/\bhoje\b/.test(n)) return _iaHoje();
  if(/\bontem\b/.test(n)){ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
  return _iaHoje(); }
function _iaKm(t){ let m=String(t).match(/([\d][\d.]*\d|\d)\s*(mil\s*)?(km|kms|quil)/i); if(m) return _iaParseNum(m[1]);
  m=String(t).match(/\bcom\s+([\d][\d.]*\d|\d)\b/i); if(m) return _iaParseNum(m[1]);
  m=String(t).match(/\b(?:e|para|pra|=|:)\s+([\d][\d.]*\d)\b/i); if(m) return _iaParseNum(m[1]); return null; }
function _iaHoras(t){ let m=String(t).match(/([\d][\d.]*\d|\d)\s*(mil\s*)?(h\b|hr|hrs|hora)/i); if(m) return _iaParseNum(m[1]);
  m=String(t).match(/\bcom\s+([\d][\d.]*\d|\d)\b/i); if(m) return _iaParseNum(m[1]); return null; }
function _iaValor(t){ const m=String(t).match(/(?:r\$|valor|custou|paguei|pagou|pre[çc]o)\s*:?\s*([\d.,]+)/i); return m?_iaParseNum(m[1]):null; }
function _iaQtd(t){ const m=String(t).match(/(\d+)\s*pneus?/i); return m?parseInt(m[1]):1; }
function _iaPct(t){ const m=String(t).match(/(\d{1,3})\s*%/); return m?Math.min(100,parseInt(m[1])):null; }
function _iaPosicao(t){ const n=_iaNorm(t);
  if(/trac/.test(n)) return 'Tração';
  if(/dianteir|direcao|steer/.test(n)) return 'Dianteira';
  if(/traseir/.test(n)) return 'Traseira';
  if(/estep|reserv/.test(n)) return 'Estepe';
  return ''; }
function _iaMarca(t){ const m=String(t).match(/marca\s+([A-Za-zÀ-ÿ0-9]+(?:\s+\d+\s*(?:ah|v)?)?)/i); return m?m[1].trim():''; }
function _iaFone(t){ const m=String(t).match(/(\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4})/); return m?maskFone(m[1]):''; }
function _iaDepois(t, re){ const m=String(t).match(re); return m?m[1].trim():''; }
/* Local "limpo": ignora quando o que veio depois de no/na/em foi a própria placa */
function _iaLocal(t, re){ let s=_iaDepois(t,re); if(/^[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}$/i.test(s.replace(/\s/g,''))) return ''; return s; }

/* ------------------------------------------------------------------ */
/*  Execução com "Desfazer" (guarda uma cópia antes de mexer)          */
/* ------------------------------------------------------------------ */
function _iaFazer(fn){
  const snap=JSON.stringify(DB);
  let r; try{ r=fn(); }catch(e){ return '⚠️ Tive um problema ao executar. Tente reescrever o comando de forma mais simples.'; }
  if(!r || !r.ok) return (r&&r.msg)||'Não consegui concluir.';
  const id='u'+(IA._uc++); IA.undo[id]={snap};
  saveDB(); router();
  return `${r.msg}<div class="ia-actions"><button class="ia-undo" onclick="iaDesfazer('${id}')">${svg('trash')} Desfazer</button></div>`;
}
function iaDesfazer(id){ const u=IA.undo[id]; if(!u){ iaBot('Essa alteração já não pode mais ser desfeita por aqui.'); return; }
  DB=JSON.parse(u.snap); if(typeof ensureCollections==='function') ensureCollections(); saveDB(); delete IA.undo[id];
  router(); iaBot('Pronto — desfiz a última alteração. ✅'); }

function _iaSemPlaca(){ const ps=DB.veiculos.filter(v=>v.status!=='Arquivado').map(v=>v.placa).join(', ');
  return 'Não achei a placa do veículo no que você escreveu. As placas cadastradas são: <b>'+esc(ps)+'</b>.<br>Exemplo: <i>"trocado 4 pneus tração IRU-4G62 dia '+_iaHojeBR()+' com 1520000 km"</i>.'; }

/* ------------------------------------------------------------------ */
/*  Interpretador principal                                            */
/* ------------------------------------------------------------------ */
function iaResponder(raw){
  const t=String(raw||'').trim(); if(!t) return 'Diga o que você quer que eu faça 🙂';
  const n=_iaNorm(t);
  if(/^(ajuda|help|\?|ola|oi|menu|comandos|op[çc]|o que voce|o que vc|o que tu)/.test(n) || n.length<3) return iaAjuda();
  if(/\bpneu/.test(n)) return iaCmdPneu(t,n);
  if(/(oleo|filtro)/.test(n)) return iaCmdOleo(t,n);
  if(/bateria/.test(n)) return iaCmdBateria(t,n);
  if(/(abastec|diesel|litro|arla)/.test(n)) return iaCmdAbastec(t,n);
  if(/descarga/.test(n)) return iaCmdDescarga(t,n);
  if(/(reparo|conserto|servico|freio|eletric|borrach|solda|lona|manuten)/.test(n)) return iaCmdServico(t,n);
  if(/(km|quilomet|hodometro|odometro|hora)/.test(n)) return iaCmdLeitura(t,n);
  return 'Ainda não entendi esse comando. Escreva <b>ajuda</b> para ver exemplos do que eu sei fazer. 💡';
}

/* ---------- PNEUS ---------- */
function iaCmdPneu(t,n){
  const v=_iaVeiculo(t); if(!v) return _iaSemPlaca();
  const qtd=_iaQtd(t), pos=_iaPosicao(t), data=_iaData(t), km=_iaKm(t);
  const usado=/usad/.test(n), recap=/recap/.test(n), bor=_iaPct(t);
  return _iaFazer(()=>{
    const carreta=isReb(v);
    const p={id:uid('pn'),veiculoId:v.id,qtd:qtd,posicao:pos||'—',marca:_iaMarca(t),medida:'',dot:'',
      status:recap?'Recapado':(usado?'Usado':'Novo'), borracha:(usado||recap)?bor:null,
      dataInstalacao:data, kmInstalacao:(carreta?null:km), obs:'Lançado pelo assistente'};
    DB.pneus.push(p);
    let extra='';
    if(km!=null){ registrarLeitura(v,km,data); extra=` Também atualizei ${carreta?'as horas':'o KM'} do veículo para <b>${num(km)} ${carreta?'h':'km'}</b>.`; }
    return {ok:true, msg:`✅ Cadastrei <b>${qtd}× pneu(s)</b>${pos?' na posição <b>'+pos+'</b>':''} do <b>${esc(v.placa)}</b>, em ${fmtD(data)}${(usado||recap)&&bor!=null?' — '+bor+'% de borracha':''}.${extra}`};
  });
}

/* ---------- KM / HORAS ---------- */
function iaCmdLeitura(t,n){
  const v=_iaVeiculo(t); if(!v) return _iaSemPlaca();
  const carreta=isReb(v); const hora=/hora/.test(n)||carreta;
  const valor= hora? _iaHoras(t): _iaKm(t);
  if(valor==null) return 'Diga o novo valor. Ex.: <i>"km do '+esc(v.placa)+' 1520000"</i>.';
  const data=_iaData(t);
  return _iaFazer(()=>{ registrarLeitura(v,valor,data);
    return {ok:true, msg:`✅ Atualizei ${hora?'as horas':'o KM'} do <b>${esc(v.placa)}</b> para <b>${num(valor)} ${hora?'h':'km'}</b> (registrado em ${fmtD(data)}).`};
  });
}

/* ---------- TROCA DE ÓLEO ---------- */
function iaCmdOleo(t,n){
  const v=_iaVeiculo(t); if(!v) return _iaSemPlaca();
  const carreta=isReb(v); const data=_iaData(t);
  const leitura= carreta? _iaHoras(t): _iaKm(t);
  return _iaFazer(()=>{
    let m=primaryItem(v);
    if(!m){ m={id:uid('o'),veiculoId:v.id,item:carreta?'Kit Filtro / Óleo':'Óleo / Filtros',intervalo:carreta?'1.000 h':'20.000 km'}; DB.manutencoes.push(m); }
    const base= leitura!=null? leitura : (carreta? v.horaAtual : v.kmAtual);
    const inter= carreta?1000:20000;
    m.data=data;
    if(carreta){ m.horasTroca=base; m.proxHoras=(base!=null?base+inter:null); }
    else { m.kmTroca=base; m.proxKm=(base!=null?base+inter:null); }
    let extra='';
    if(leitura!=null){ registrarLeitura(v,leitura,data); extra=` Atualizei ${carreta?'as horas':'o KM'} para <b>${num(leitura)} ${carreta?'h':'km'}</b>.`; }
    const prox=carreta?m.proxHoras:m.proxKm;
    return {ok:true, msg:`✅ Registrei a troca de <b>${esc(m.item)}</b> do <b>${esc(v.placa)}</b> em ${fmtD(data)}${base!=null?' com '+num(base)+(carreta?' h':' km'):''}.${prox!=null?' Próxima em <b>'+num(prox)+(carreta?' h':' km')+'</b>.':''}${extra}`};
  });
}

/* ---------- BATERIA ---------- */
function iaCmdBateria(t,n){
  const v=_iaVeiculo(t); const data=_iaData(t); const valor=_iaValor(t);
  const marca=_iaMarca(t); const fone=_iaFone(t);
  const local=_iaLocal(t,/\b(?:no|na|em)\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|hoje|ontem)\b|$)/i);
  const placa= v? v.placa : _iaPlacaTexto(t);
  if(!placa && !marca) return 'Diga ao menos a placa ou a marca da bateria. Ex.: <i>"bateria marca Moura 220AH no IRU-4G62 por R$ 950 hoje"</i>.';
  return _iaFazer(()=>{
    const d=_iaData(t).split('-'); const ga=new Date(+d[0]+1,+d[1]-1,+d[2]).toISOString().slice(0,10);
    DB.baterias.push({id:uid('b'),data:data,placa:placa||'—',marca:marca,local:local,valor:valor||0,garantiaMeses:12,garantiaAte:ga,telefone:fone});
    return {ok:true, msg:`✅ Cadastrei uma bateria${marca?' <b>'+esc(marca)+'</b>':''} para <b>${esc(placa||'—')}</b> em ${fmtD(data)}${valor?' — '+money(valor):''}. Garantia de 12 meses (até ${fmtD(ga)}).`};
  });
}

/* ---------- ABASTECIMENTO ---------- */
function iaCmdAbastec(t,n){
  const v=_iaVeiculo(t); if(!v) return _iaSemPlaca();
  const carreta=isReb(v); const data=_iaData(t); const valor=_iaValor(t);
  const litM=String(t).match(/([\d][\d.,]*\d|\d)\s*(litros?|lts?|l\b)/i); const lit=litM?_iaParseNum(litM[1]):null;
  const leitura= carreta? _iaHoras(t): _iaKm(t);
  if(lit==null) return 'Quantos litros? Ex.: <i>"abasteci 320 litros no '+esc(v.placa)+' por R$ 2100 com 1520000 km"</i>.';
  return _iaFazer(()=>{
    DB.abastecimentos.push({id:uid('ab'),data:data,veiculoId:v.id,litros:lit,valor:valor||0,km:carreta?null:leitura,horas:carreta?leitura:null,posto:''});
    if(leitura!=null) registrarLeitura(v,leitura,data);
    return {ok:true, msg:`✅ Lancei <b>${num(lit)} L</b> no <b>${esc(v.placa)}</b> em ${fmtD(data)}${valor?' — '+money(valor):''}${leitura!=null?' ('+num(leitura)+(carreta?' h':' km')+')':''}.`};
  });
}

/* ---------- DESCARGA ---------- */
function iaCmdDescarga(t,n){
  const v=_iaVeiculo(t); const data=_iaData(t); const valor=_iaValor(t);
  const local=_iaLocal(t,/\b(?:no|na|em)\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|hoje|ontem|senha)\b|$)/i);
  const senha=_iaDepois(t,/senha\s+([A-Z0-9]+)/i);
  const transp=_iaDepois(t,/(?:transporte|transp)\s*n?º?\s*(\d+)/i);
  const placa= v? v.placa : _iaPlacaTexto(t);
  return _iaFazer(()=>{
    DB.descargas.push({id:uid('dc'),data:data,placa:placa,transporte:transp,senha:senha,valor:valor||0,pago:'',local:local});
    return {ok:true, msg:`✅ Registrei uma descarga${local?' em <b>'+esc(local)+'</b>':''}${placa?' ('+esc(placa)+')':''} em ${fmtD(data)}${valor?' — '+money(valor):''}.`};
  });
}

/* ---------- SERVIÇO / REPARO ---------- */
function iaCmdServico(t,n){
  const v=_iaVeiculo(t); const data=_iaData(t); const valor=_iaValor(t); const km=_iaKm(t);
  const ofi=_iaDepois(t,/oficina\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|km|hoje|ontem)\b|$)/i);
  let desc=String(t).replace(/\b[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}\b/ig,' ')
    .replace(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g,' ')
    .replace(/(?:r\$|valor|custou|paguei|pagou|pre[çc]o)\s*:?\s*[\d.,]+/ig,' ')
    .replace(/oficina\s+[^,;]+/ig,' ').replace(/\bcom\s+[\d.]+\s*(?:km|h)\b/ig,' ')
    .replace(/\b(dia|hoje|ontem|no|na|em|do|da)\b/ig,' ').replace(/\s{2,}/g,' ').trim();
  if(desc.length<3) desc='Serviço / reparo';
  return _iaFazer(()=>{
    DB.servicos.push({id:uid('sv'),data:data,veiculoId:v?v.id:'',descricao:desc,oficina:ofi,km:(km!=null?km:''),valor:valor||0,obs:''});
    return {ok:true, msg:`✅ Registrei o serviço "<b>${esc(desc)}</b>"${v?' no <b>'+esc(v.placa)+'</b>':''} em ${fmtD(data)}${valor?' — '+money(valor):''}${ofi?' (oficina '+esc(ofi)+')':''}.`};
  });
}

/* ---------- AJUDA ---------- */
function iaAjuda(){
  return `Sou o assistente da Planeta Express. Escreva em português normal e eu <b>crio e atualizo</b> os registros sozinho. Exemplos:
  <ul class="ia-help">
    <li>🛞 <i>trocado 4 pneus tração IRU-4G62 dia ${_iaHojeBR()} com 1520000 km</i></li>
    <li>🛞 <i>2 pneus dianteira usados 70% no EJZ-4I65</i></li>
    <li>📏 <i>km do JSX-4D55 é 1110000</i> &nbsp;·&nbsp; <i>horas da carreta EOF-5A47 12500</i></li>
    <li>🛢️ <i>troca de óleo IRU-4G62 hoje com 1520000 km</i></li>
    <li>🔋 <i>bateria marca Moura 220AH no BDP-1B55 por R$ 950 hoje</i></li>
    <li>⛽ <i>abasteci 320 litros no QIO-9J07 por R$ 2100 com 673000 km</i></li>
    <li>📦 <i>descarga do IRU-4G62 no Muffato por R$ 800 hoje</i></li>
    <li>🔧 <i>troca de lonas de freio no EJZ-4I65 oficina Rede Única por R$ 1200</i></li>
  </ul>
  Depois de cada ação eu mostro um botão <b>Desfazer</b>, caso queira voltar atrás.`;
}
function iaSaudacao(){
  const h=new Date().getHours(); const s=h<12?'Bom dia':(h<18?'Boa tarde':'Boa noite');
  return `${s}! 👋 Sou seu assistente inteligente. Me diga o que aconteceu — por exemplo <i>"trocado 4 pneus tração IRU-4G62 dia ${_iaHojeBR()} com 1520000 km"</i> — que eu já lanço no sistema pra você. Toque em <b>Ajuda</b> para ver tudo que sei fazer.`;
}

/* ------------------------------------------------------------------ */
/*  Interface (botão flutuante + painel de chat)                       */
/* ------------------------------------------------------------------ */
function iaMontarFab(){
  if(document.getElementById('iaFab')) return;
  const fab=document.createElement('button');
  fab.id='iaFab'; fab.className='ia-fab no-print'; fab.title='Assistente inteligente';
  fab.innerHTML=`${svg('spark')}<span>Assistente</span>`; fab.onclick=iaToggle;
  document.body.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='iaPanel'; panel.className='ia-panel no-print';
  panel.innerHTML=`
    <div class="ia-head">
      <div class="ia-head-t">${svg('spark')}<div class="ia-head-txt"><b>Assistente Planeta</b><span>Inteligência que trabalha por você</span></div></div>
      <button class="ia-x" onclick="iaToggle()" title="Fechar">×</button>
    </div>
    <div class="ia-body" id="iaBody"></div>
    <div class="ia-quick" id="iaQuick"></div>
    <div class="ia-input">
      <input id="iaInput" placeholder="Escreva um comando…" autocomplete="off" onkeydown="if(event.key==='Enter')iaEnviar()">
      <button class="ia-send" onclick="iaEnviar()" title="Enviar">${svg('send')}</button>
    </div>`;
  document.body.appendChild(panel);
  if(!IA.msgs.length) iaBot(iaSaudacao());
  iaQuickChips();
}
function iaQuickChips(){ const q=document.getElementById('iaQuick'); if(!q) return;
  const cav=(DB.veiculos.find(v=>v.tipo==='Cavalo')||{}).placa||'IRU-4G62';
  IA.chips=[
    ['🛞 Pneus', `trocado 4 pneus tração ${cav} dia ${_iaHojeBR()} com 1520000 km`],
    ['📏 KM', `km do ${cav} é 1520000`],
    ['🛢️ Óleo', `troca de óleo ${cav} hoje com 1520000 km`],
    ['🔋 Bateria', `bateria marca Moura 220AH no ${cav} por R$ 950 hoje`],
    ['❓ Ajuda', 'ajuda'],
  ];
  q.innerHTML=IA.chips.map((c,i)=>`<button class="ia-chip" onclick="iaChip(${i})">${c[0]}</button>`).join('');
}
function iaChip(i){ const c=IA.chips[i]; if(!c) return; const el=document.getElementById('iaInput'); if(el){ el.value=c[1]; iaEnviar(); } }
function iaToggle(){ const p=document.getElementById('iaPanel'), f=document.getElementById('iaFab'); if(!p) return;
  IA.open=!IA.open; p.classList.toggle('open',IA.open); if(f) f.classList.toggle('hide',IA.open);
  if(IA.open) setTimeout(()=>{ const i=document.getElementById('iaInput'); if(i) i.focus(); },220); }
function iaEnviar(){ const el=document.getElementById('iaInput'); if(!el) return; const t=(el.value||'').trim(); if(!t) return;
  el.value=''; iaUser(t);
  const pensando={who:'bot',html:'<span class="ia-typing"><i></i><i></i><i></i></span>'}; IA.msgs.push(pensando); iaRender();
  setTimeout(()=>{ IA.msgs.pop(); const r=iaResponder(t); iaBot(r); }, 300);
}
function iaBot(html){ IA.msgs.push({who:'bot',html:html}); iaRender(); }
function iaUser(txt){ IA.msgs.push({who:'user',html:esc(txt)}); iaRender(); }
function iaRender(){ const b=document.getElementById('iaBody'); if(!b) return;
  b.innerHTML=IA.msgs.map(m=>`<div class="ia-msg ${m.who}">${m.who==='bot'?`<span class="ia-av">${svg('spark')}</span>`:''}<div class="ia-bubble">${m.html}</div></div>`).join('');
  b.scrollTop=b.scrollHeight; }
