/* ==========================================================================
   PLANETA EXPRESS — Inteligência Artificial da Planeta Express
   Assistente que ENTENDE português normal (mesmo com palavras incompletas),
   LANÇA dados sozinho (pneus, KM/horas, óleo, bateria, abastecimento,
   descarga, serviços) calculando o que der pra calcular, CONSULTA qualquer
   dado do sistema e PERGUNTA quando falta alguma informação.
   100% offline — sem internet.
   ========================================================================== */
'use strict';

const IA = { msgs:[], open:false, undo:{}, chips:[], _uc:0, pending:null };

/* ================================================================== */
/*  1. LEITURA / INTERPRETAÇÃO DO TEXTO                                */
/* ================================================================== */
function _iaNorm(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
function _iaHoje(){ return new Date().toISOString().slice(0,10); }
function _iaHojeBR(){ const d=new Date(); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); }
function _iaParseNum(s){ if(s==null) return null; s=String(s).trim();
  if(/,/.test(s)){ s=s.replace(/\./g,'').replace(',','.'); } else { s=s.replace(/\./g,''); }
  const n=parseFloat(s.replace(/[^\d.]/g,'')); return isNaN(n)?null:n; }

/* --- veículo: aceita IRU-4G62, IRU4G62, "iru 4g62" ou só "IRU" se for único --- */
function _iaVeiculo(t){
  const U=String(t).toUpperCase();
  let m=U.match(/\b([A-Z]{3})[- ]?(\d[A-Z0-9]\d{2})\b/);
  if(m){ const v=veiculoByPlaca(m[1]+m[2]); if(v) return v; }
  const strip=U.replace(/[^A-Z0-9]/g,'');
  for(const v of DB.veiculos){ const p=v.placa.toUpperCase().replace(/[^A-Z0-9]/g,''); if(p && strip.indexOf(p)>=0) return v; }
  const toks=U.match(/\b[A-Z]{3}\b/g)||[]; const cand=[];
  toks.forEach(tk=>DB.veiculos.forEach(v=>{ if(v.placa.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)===tk && cand.indexOf(v)<0) cand.push(v); }));
  return cand.length===1? cand[0] : null;
}
function _iaPlacaTexto(t){ const v=_iaVeiculo(t); if(v) return v.placa;
  const m=String(t).toUpperCase().match(/\b([A-Z]{3})[- ]?(\d[A-Z0-9]\d{2})\b/); return m?(m[1]+'-'+m[2]):''; }
/* --- motorista por parte do nome (fuzzy) --- */
function _iaMotorista(t){ const n=_iaNorm(t);
  for(const m of DB.motoristas){ for(const p of _iaNorm(m.nome).split(/\s+/)){ if(p.length>=3 && n.indexOf(p)>=0) return m; } }
  return null;
}
function _iaData(t){ const m=String(t).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if(m){ let d=m[1],mo=m[2],y=m[3]; if(y.length===2)y='20'+y; return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  const n=_iaNorm(t);
  if(/\bhoje\b/.test(n)) return _iaHoje();
  if(/\bontem\b/.test(n)){ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
  if(/anteontem/.test(n)){ const d=new Date(); d.setDate(d.getDate()-2); return d.toISOString().slice(0,10); }
  return _iaHoje();
}
function _iaTemData(t){ return /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})|hoje|ontem|anteontem/i.test(String(t)); }
/* número "solto" (o maior, ignorando placa/data) — usado como KM/horas quando não há a palavra km */
function _iaNumeroSolto(t){
  let s=String(t).replace(/\b[A-Za-z]{3}[- ]?\d[A-Za-z0-9]\d{2}\b/g,' ').replace(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g,' ');
  const nums=(s.match(/\d[\d.]*\d|\d/g)||[]).map(_iaParseNum).filter(x=>x!=null && x>0);
  return nums.length? Math.max.apply(null,nums) : null;
}
function _iaKm(t){ let m=String(t).match(/([\d][\d.]*\d|\d)\s*(mil\s*)?(km|kms|quil)/i); if(m) return _iaParseNum(m[1]);
  m=String(t).match(/\bcom\s+([\d][\d.]*\d|\d)\b/i); if(m) return _iaParseNum(m[1]); return null; }
function _iaHoras(t){ let m=String(t).match(/([\d][\d.]*\d|\d)\s*(mil\s*)?(h\b|hr|hrs|hora)/i); if(m) return _iaParseNum(m[1]);
  m=String(t).match(/\bcom\s+([\d][\d.]*\d|\d)\b/i); if(m) return _iaParseNum(m[1]); return null; }
function _iaValor(t){ const m=String(t).match(/(?:r\$|valor|custou|paguei|pagou|pre[cç]o|por)\s*:?\s*([\d][\d.,]*)/i); return m?_iaParseNum(m[1]):null; }
function _iaQtd(t){ const m=String(t).match(/(\d+)\s*pneus?/i); return m?parseInt(m[1]):null; }
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
function _iaLocal(t, re){ let s=_iaDepois(t,re); if(/^[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}$/i.test(s.replace(/\s/g,''))) return ''; return s; }

/* ================================================================== */
/*  2. EXECUÇÃO COM "DESFAZER" e PERGUNTAS (follow-up)                 */
/* ================================================================== */
function _iaFalta(need, msg){ return {falta:true, need:need, msg:msg}; }
function _iaFazer(fn){
  const snap=JSON.stringify(DB);
  let r; try{ r=fn(); }catch(e){ return '⚠️ Tive um problema ao executar. Tente reescrever de forma mais simples.'; }
  if(!r || !r.ok) return (r&&r.msg)||'Não consegui concluir.';
  const id='u'+(IA._uc++); IA.undo[id]={snap};
  saveDB(); router();
  return `${r.msg}<div class="ia-actions"><button class="ia-undo" onclick="iaDesfazer('${id}')">${svg('trash')} Desfazer</button></div>`;
}
function iaDesfazer(id){ const u=IA.undo[id]; if(!u){ iaBot('Essa alteração já não pode mais ser desfeita por aqui.'); return; }
  DB=JSON.parse(u.snap); if(typeof ensureCollections==='function') ensureCollections(); saveDB(); delete IA.undo[id];
  router(); iaBot('Pronto — desfiz a última alteração. ✅'); }

function iaFinaliza(r, intent, raw){
  if(r && r.falta){ IA.pending={intent:intent, raw:raw, need:r.need}; return r.msg; }
  IA.pending=null; return r;
}
function iaExec(intent, raw){
  const n=_iaNorm(raw);
  switch(intent){
    case 'pneu': return iaCmdPneu(raw,n);
    case 'oleo': return iaCmdOleo(raw,n);
    case 'bateria': return iaCmdBateria(raw,n);
    case 'abastec': return iaCmdAbastec(raw,n);
    case 'descarga': return iaCmdDescarga(raw,n);
    case 'servico': return iaCmdServico(raw,n);
    case 'leitura': return iaCmdLeitura(raw,n);
    case 'consulta': return iaConsulta(raw,n);
    default: return 'Não entendi.';
  }
}

/* ================================================================== */
/*  3. INTERPRETADOR PRINCIPAL                                         */
/* ================================================================== */
function _iaEhPergunta(n){ return /\?|\b(quant|qual|quais|quando|onde|cade|me diga|me fala|me informa|mostr|list|resumo|status|situacao|vence|venc|validade|quanto tem|tem quantos)\b/.test(n); }
function _iaIntent(n){
  if(/pneu|\bpne\b/.test(n)) return 'pneu';
  if(/oleo|filtr|lubrific/.test(n)) return 'oleo';
  if(/bateri|\bbat\b/.test(n)) return 'bateria';
  if(/abastec|abastic|diesel|\blitro|\barla|combust/.test(n)) return 'abastec';
  if(/descarg|descar\b/.test(n)) return 'descarga';
  if(/repar|consert|servi[cç]|freio|eletric|borrach|solda|\blona|manuten|amortec|\bmola|suspens|escapa|lonas de freio/.test(n)) return 'servico';
  if(/\bkm\b|kilomet|quilomet|hodomet|odomet|rodage|\bhora|\bhr\b|hodo|odom/.test(n)) return 'leitura';
  return '';
}
function iaResponder(raw){
  const t=String(raw||'').trim(); if(!t) return 'Pode falar — o que você precisa? 🙂';
  const n=_iaNorm(t);

  /* Estou esperando uma resposta que faltava */
  if(IA.pending){
    if(/^(cancel|deixa|esquec|para\b|nada|nao\b|nenhum)/.test(n)){ IA.pending=null; return 'Beleza, cancelei. 👍 Pode mandar outro comando.'; }
    let ans=t; const need=IA.pending.need;
    if(need==='valor') ans='valor '+ans;
    else if(need==='km') ans=ans+' km';
    else if(need==='hora') ans=ans+' horas';
    else if(need==='litros') ans=ans+' litros';
    const raw2=IA.pending.raw+' '+ans; const intent=IA.pending.intent;
    IA.pending=null;
    return iaFinaliza(iaExec(intent, raw2), intent, raw2);
  }

  if(/^(ajuda|help|\?|menu|comandos|o que voce faz|o que vc faz|o que voce sabe)/.test(n)) return iaAjuda();
  if(/^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem|ei)\b/.test(n) && n.length<20) return iaSaudacao();
  if(_iaEhPergunta(n)) return iaFinaliza(iaConsulta(t,n), 'consulta', t);
  const intent=_iaIntent(n);
  if(!intent) return `Não entendi 100% 🤔. Quer <b>lançar</b> algo (pneu, KM, óleo, bateria, abastecimento, descarga, serviço) ou <b>consultar</b> um dado (ex.: "quantos pneus tem o IRU-4G62", "quando vence a CNH do Reinaldo")? Escreva <b>ajuda</b> para ver exemplos.`;
  return iaFinaliza(iaExec(intent, t), intent, t);
}

/* ================================================================== */
/*  4. COMANDOS QUE LANÇAM DADOS                                       */
/* ================================================================== */
function iaCmdPneu(t,n){
  const v=_iaVeiculo(t);
  if(!v) return _iaFalta('veiculo','Certo! Em qual veículo? Me diga a placa (ex.: IRU-4G62). 🚚');
  const qtd=_iaQtd(t)||1, pos=_iaPosicao(t), data=_iaData(t), km=_iaKm(t);
  const usado=/usad/.test(n), recap=/recap/.test(n), bor=_iaPct(t);
  return _iaFazer(()=>{
    const carreta=isReb(v);
    const p={id:uid('pn'),veiculoId:v.id,qtd:qtd,posicao:pos||'—',marca:_iaMarca(t),medida:'',dot:'',
      status:recap?'Recapado':(usado?'Usado':'Novo'), borracha:(usado||recap)?bor:null,
      dataInstalacao:data, kmInstalacao:(carreta?null:km), obs:'Lançado pela IA'};
    DB.pneus.push(p);
    let extra='';
    if(km!=null){ registrarLeitura(v,km,data); extra=` Também atualizei ${carreta?'as horas':'o KM'} do veículo para <b>${num(km)} ${carreta?'h':'km'}</b>.`; }
    return {ok:true, msg:`✅ Cadastrei <b>${qtd}× pneu(s)</b>${pos?' na posição <b>'+pos+'</b>':''} do <b>${esc(v.placa)}</b>, em ${fmtD(data)}${(usado||recap)&&bor!=null?' — '+bor+'% de borracha':''}.${extra} <span class="ia-dim">(agora o total de pneus já foi somado automaticamente)</span>`};
  });
}
function iaCmdLeitura(t,n){
  const v=_iaVeiculo(t);
  if(!v) return _iaFalta('veiculo','De qual veículo? Me diga a placa. 🚚');
  const carreta=isReb(v); const hora=/hora|\bhr/.test(n)||carreta;
  let valor= hora? _iaHoras(t): _iaKm(t);
  if(valor==null) valor=_iaNumeroSolto(t);
  if(valor==null) return _iaFalta(hora?'hora':'km', `Qual é ${hora?'a nova hora do Thermo King':'o novo KM'} do <b>${esc(v.placa)}</b>? (só o número)`);
  const data=_iaData(t);
  return _iaFazer(()=>{ registrarLeitura(v,valor,data);
    return {ok:true, msg:`✅ Atualizei ${hora?'as horas':'o KM'} do <b>${esc(v.placa)}</b> para <b>${num(valor)} ${hora?'h':'km'}</b> (registrado em ${fmtD(data)}).`};
  });
}
function iaCmdOleo(t,n){
  const v=_iaVeiculo(t);
  if(!v) return _iaFalta('veiculo','Troca de óleo de qual veículo? Me diga a placa. 🚚');
  const carreta=isReb(v); const data=_iaData(t);
  let leitura= carreta? _iaHoras(t): _iaKm(t); if(leitura==null) leitura=_iaNumeroSolto(t);
  return _iaFazer(()=>{
    let m=primaryItem(v);
    if(!m){ m={id:uid('o'),veiculoId:v.id,item:carreta?'Kit Filtro / Óleo':'Óleo / Filtros',intervalo:carreta?'1.000 h':'20.000 km'}; DB.manutencoes.push(m); }
    const base= leitura!=null? leitura : (carreta? v.horaAtual : v.kmAtual);
    const inter= carreta?1000:20000; m.data=data;
    if(carreta){ m.horasTroca=base; m.proxHoras=(base!=null?base+inter:null); }
    else { m.kmTroca=base; m.proxKm=(base!=null?base+inter:null); }
    let extra='';
    if(leitura!=null){ registrarLeitura(v,leitura,data); extra=` Atualizei ${carreta?'as horas':'o KM'} para <b>${num(leitura)} ${carreta?'h':'km'}</b>.`; }
    const prox=carreta?m.proxHoras:m.proxKm;
    return {ok:true, msg:`✅ Registrei a troca de <b>${esc(m.item)}</b> do <b>${esc(v.placa)}</b> em ${fmtD(data)}${base!=null?' com '+num(base)+(carreta?' h':' km'):''}.${prox!=null?' Calculei a próxima para <b>'+num(prox)+(carreta?' h':' km')+'</b>.':''}${extra}`};
  });
}
function iaCmdBateria(t,n){
  const v=_iaVeiculo(t); const data=_iaData(t); const valor=_iaValor(t); const fone=_iaFone(t);
  let marca=_iaMarca(t);
  if(!marca){ const m=String(t).match(/bateria\s+([A-Za-zÀ-ÿ]+(?:\s+\d+\s*ah)?)/i);
    if(m && !/^(no|na|em|do|da|de|para|pra|pro|marca)$/i.test(m[1].trim())) marca=m[1].trim(); }
  const local=_iaLocal(t,/\b(?:no|na|em)\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|hoje|ontem)\b|$)/i);
  const placa= v? v.placa : _iaPlacaTexto(t);
  if(!placa && !marca) return _iaFalta('veiculo','Bateria de qual veículo (placa) e qual a marca? Ex.: "bateria Moura 220AH no IRU-4G62".');
  return _iaFazer(()=>{
    const d=data.split('-'); const ga=new Date(+d[0]+1,+d[1]-1,+d[2]).toISOString().slice(0,10);
    DB.baterias.push({id:uid('b'),data:data,placa:placa||'—',marca:marca,local:local,valor:valor||0,garantiaMeses:12,garantiaAte:ga,telefone:fone});
    return {ok:true, msg:`✅ Cadastrei uma bateria${marca?' <b>'+esc(marca)+'</b>':''} para <b>${esc(placa||'—')}</b> em ${fmtD(data)}${valor?' — '+money(valor):''}. Garantia de 12 meses (até ${fmtD(ga)}).`};
  });
}
function iaCmdAbastec(t,n){
  const v=_iaVeiculo(t);
  if(!v) return _iaFalta('veiculo','Abastecimento de qual veículo? Me diga a placa. 🚚');
  const carreta=isReb(v); const data=_iaData(t); const valor=_iaValor(t);
  const litM=String(t).match(/([\d][\d.,]*\d|\d)\s*(litros?|lts?|l\b)/i); const lit=litM?_iaParseNum(litM[1]):null;
  if(lit==null) return _iaFalta('litros', `Quantos litros foram no <b>${esc(v.placa)}</b>? (só o número)`);
  let leitura= carreta? _iaHoras(t): _iaKm(t);
  return _iaFazer(()=>{
    DB.abastecimentos.push({id:uid('ab'),data:data,veiculoId:v.id,litros:lit,valor:valor||0,km:carreta?null:leitura,horas:carreta?leitura:null,posto:''});
    if(leitura!=null) registrarLeitura(v,leitura,data);
    return {ok:true, msg:`✅ Lancei <b>${num(lit)} L</b> no <b>${esc(v.placa)}</b> em ${fmtD(data)}${valor?' — '+money(valor):''}${leitura!=null?' ('+num(leitura)+(carreta?' h':' km')+')':''}.`};
  });
}
function iaCmdDescarga(t,n){
  const v=_iaVeiculo(t);
  const placa= v? v.placa : _iaPlacaTexto(t);
  if(!placa) return _iaFalta('veiculo','Descarga de qual veículo? Me diga a placa. 🚚');
  const data=_iaData(t); const valor=_iaValor(t);
  const local=_iaLocal(t,/\b(?:no|na|em)\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|hoje|ontem|senha)\b|$)/i);
  const senha=_iaDepois(t,/senha\s+([A-Z0-9]+)/i);
  const transp=_iaDepois(t,/(?:transporte|transp)\s*n?º?\s*(\d+)/i);
  return _iaFazer(()=>{
    DB.descargas.push({id:uid('dc'),data:data,placa:placa,transporte:transp,senha:senha,valor:valor||0,pago:'',local:local});
    return {ok:true, msg:`✅ Registrei uma descarga${local?' em <b>'+esc(local)+'</b>':''} (${esc(placa)}) em ${fmtD(data)}${valor?' — '+money(valor):''}.`};
  });
}
function iaCmdServico(t,n){
  const v=_iaVeiculo(t); const data=_iaData(t); const valor=_iaValor(t); const km=_iaKm(t);
  const ofi=_iaDepois(t,/oficina\s+([^,;]+?)(?:\s+(?:por|valor|r\$|dia|km|hoje|ontem)\b|$)/i);
  let desc=String(t).replace(/\b[A-Z]{3}[- ]?\d[A-Z0-9]\d{2}\b/ig,' ')
    .replace(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g,' ')
    .replace(/(?:r\$|valor|custou|paguei|pagou|pre[cç]o|por)\s*:?\s*[\d.,]+/ig,' ')
    .replace(/oficina\s+[^,;]+/ig,' ').replace(/\bcom\s+[\d.]+\s*(?:km|h)\b/ig,' ')
    .replace(/\b(dia|hoje|ontem|anteontem|no|na|em|do|da)\b/ig,' ').replace(/\s{2,}/g,' ').trim();
  if(desc.length<3) return _iaFalta('descricao','Qual foi o serviço/reparo? Ex.: "troca de lonas de freio".');
  return _iaFazer(()=>{
    DB.servicos.push({id:uid('sv'),data:data,veiculoId:v?v.id:'',descricao:desc,oficina:ofi,km:(km!=null?km:''),valor:valor||0,obs:''});
    return {ok:true, msg:`✅ Registrei o serviço "<b>${esc(desc)}</b>"${v?' no <b>'+esc(v.placa)+'</b>':''} em ${fmtD(data)}${valor?' — '+money(valor):''}${ofi?' (oficina '+esc(ofi)+')':''}.`};
  });
}

/* ================================================================== */
/*  5. CONSULTAS (integração com todos os dados)                      */
/* ================================================================== */
function _iaVencBadge(x){ const s=situacao(x.validade); return `<span class="st ${s.cls}" style="font-size:10px;padding:1px 7px">${s.label}</span>`; }
function iaConsulta(t,n){
  const v=_iaVeiculo(t); const mot=_iaMotorista(t);

  /* PNEUS */
  if(/pneu|\bpne\b/.test(n)){
    if(v){ const ps=DB.pneus.filter(p=>p.veiculoId===v.id); const tot=pneuTotal(ps);
      if(!tot) return `O <b>${esc(v.placa)}</b> ainda não tem pneus cadastrados.`;
      const linhas=ps.map(p=>`• <b>${pneuQtd(p)}×</b> ${esc(p.posicao||'—')} — ${esc(p.marca||'sem marca')} <span class="ia-dim">(${esc(p.status||'—')}${(/usad|recap/i.test(p.status||'')&&p.borracha!=null&&p.borracha!=='')?', '+p.borracha+'% borracha':''})</span>`).join('<br>');
      return `🛞 O <b>${esc(v.placa)}</b> tem <b>${tot} pneu(s)</b> (${ps.length} registro(s)):<br>${linhas}`;
    }
    const veics=[...new Set(DB.pneus.map(p=>p.veiculoId))].length;
    return `🛞 A frota tem <b>${pneuTotal()} pneus</b> no total (${DB.pneus.length} registros), distribuídos em ${veics} veículo(s).`;
  }

  /* VENCIMENTOS / DOCUMENTOS */
  if(/vence|venc|validade|cnh|tacograf|aso|toxicol|licenc|crlv|opentech|documento|exame|vigil|sanitar/.test(n)){
    const tipos=[['cnh','CNH'],['toxicol','Toxicológico'],['aso','ASO'],['tacograf','Tacógrafo'],['crlv','CRLV'],['opentech','Opentech'],['vigil','Vigilância'],['sanitar','Vigilância']];
    let filtroTipo=''; tipos.forEach(([k,val])=>{ if(new RegExp(k).test(n)) filtroTipo=val; });
    let lista;
    if(mot){ lista=DB.vencimentos.filter(x=>x.entidade==='motorista'&&x.refId===mot.id); }
    else if(v){ lista=DB.vencimentos.filter(x=>x.entidade==='veiculo'&&x.refId===v.id); }
    else { lista=DB.vencimentos.filter(x=>{ const d=diasAte(x.validade); return d!=null && d<=90; }); }
    if(filtroTipo) lista=lista.filter(x=>(x.tipo||'').indexOf(filtroTipo)>=0);
    lista=lista.slice().sort((a,b)=>(a.validade||'').localeCompare(b.validade||''));
    if(!lista.length) return mot||v? `Não achei ${filtroTipo||'documentos'} para <b>${esc((mot||v).nome||(v&&v.placa))}</b>.` : 'Nada vencendo nos próximos 90 dias. 👍';
    const alvo= mot? mot.nome : (v? v.placa : 'próximos 90 dias');
    const linhas=lista.slice(0,12).map(x=>{ const quem= mot||v? '' : ' <span class="ia-dim">('+esc(nomeEntidade(x))+')</span>'; return `• <b>${esc(x.tipo)}</b>${quem}: ${fmtD(x.validade)} ${_iaVencBadge(x)}`; }).join('<br>');
    return `📋 ${filtroTipo?esc(filtroTipo)+' — ':''}<b>${esc(alvo)}</b>:<br>${linhas}`;
  }

  /* KM / HORAS */
  if(/\bkm\b|kilomet|quilomet|hodomet|odomet|rodage|\bhora|\bhr\b/.test(n)){
    if(!v) return _iaFalta('veiculo','De qual veículo você quer saber o KM/horas? Me diga a placa. 🚚');
    const cav=!isReb(v); const atual=cav?v.kmAtual:v.horaAtual; const un=cav?'km':'h';
    let s=`📏 O <b>${esc(v.placa)}</b> está com <b>${atual!=null?num(atual)+' '+un:'sem registro'}</b>`;
    const dt=cav?v.kmData:v.horaData; if(dt) s+=` <span class="ia-dim">(atualizado em ${fmtD(dt)})</span>`;
    const p=primaryItem(v); if(p){ const mi=manutInfo(p,v); if(mi.ok){ s+= mi.restante<=0? `.<br>⚠️ A troca de <b>${esc(p.item)}</b> está <b>vencida há ${num(-mi.restante)} ${un}</b>.` : `.<br>🛢️ Faltam <b>${num(mi.restante)} ${un}</b> para a troca de ${esc(p.item)}.`; return s; } }
    return s+'.';
  }

  /* ÓLEO / PRÓXIMA TROCA */
  if(/oleo|filtr|troca/.test(n)){
    if(!v) return _iaFalta('veiculo','Troca de óleo de qual veículo? Me diga a placa. 🚚');
    const p=primaryItem(v); if(!p) return `Não há troca de óleo cadastrada para o <b>${esc(v.placa)}</b>.`;
    const mi=manutInfo(p,v); const un=isReb(v)?'h':'km';
    if(!mi.ok) return `A última troca de <b>${esc(p.item)}</b> do ${esc(v.placa)} foi em ${fmtD(p.data)}. Informe o KM/horas atual para eu calcular a próxima.`;
    return `🛢️ <b>${esc(v.placa)}</b> — ${esc(p.item)}: última em ${fmtD(p.data)}, próxima em <b>${num(isReb(v)?p.proxHoras:p.proxKm)} ${un}</b>. ${mi.restante<=0?'⚠️ <b>Vencida há '+num(-mi.restante)+' '+un+'</b>.':'Faltam <b>'+num(mi.restante)+' '+un+'</b>.'}`;
  }

  /* BATERIA */
  if(/bateri/.test(n)){
    if(!v) return _iaFalta('veiculo','Bateria de qual veículo? Me diga a placa. 🚚');
    const key=v.placa.replace(/\W/g,'').toUpperCase();
    const bs=DB.baterias.filter(b=>String(b.placa||'').replace(/\W/g,'').toUpperCase()===key).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    if(!bs.length) return `Nenhuma bateria cadastrada para o <b>${esc(v.placa)}</b>.`;
    const b=bs[0];
    return `🔋 Última bateria do <b>${esc(v.placa)}</b>: ${esc(b.marca||'—')}, de ${fmtD(b.data)}${b.valor?' ('+money(b.valor)+')':''}. Garantia até <b>${fmtD(b.garantiaAte)}</b> ${_iaVencBadge({validade:b.garantiaAte})}.`;
  }

  /* GASTOS / DESPESAS */
  if(/gast|despes|custo|quanto.*servi|servi.*total/.test(n)){
    const serv=DB.servicos.reduce((s,x)=>s+(+x.valor||0),0);
    const ab=DB.abastecimentos.reduce((s,x)=>s+(+x.valor||0),0);
    const bat=DB.baterias.reduce((s,x)=>s+(+x.valor||0),0);
    return `💰 Gastos registrados: serviços/reparos <b>${money(serv)}</b>, abastecimentos <b>${money(ab)}</b>, baterias <b>${money(bat)}</b>. Total <b>${money(serv+ab+bat)}</b>.`;
  }

  /* RESUMO / FICHA DO VEÍCULO */
  if(v && /resumo|status|situacao|ficha|tudo|geral/.test(n)){
    const cav=!isReb(v); const un=cav?'km':'h'; const atual=cav?v.kmAtual:v.horaAtual;
    const tot=pneuTotal(DB.pneus.filter(p=>p.veiculoId===v.id));
    const p=primaryItem(v); let ol='—'; if(p){ const mi=manutInfo(p,v); ol= mi.ok? (mi.restante<=0?'vencida há '+num(-mi.restante)+' '+un:'faltam '+num(mi.restante)+' '+un):'sem cálculo'; }
    const venc=DB.vencimentos.filter(x=>x.entidade==='veiculo'&&x.refId===v.id).map(x=>`${esc(x.tipo)} ${_iaVencBadge(x)}`).join(', ')||'—';
    return `🚚 <b>${esc(v.placa)}</b> — ${esc(v.marca)} ${esc(v.modelo)}<br>• ${cav?'KM':'Horas'}: <b>${atual!=null?num(atual)+' '+un:'—'}</b><br>• Óleo: ${ol}<br>• Pneus: <b>${tot}</b><br>• Documentos: ${venc}`;
  }

  /* LISTAS GERAIS */
  if(/veicul|frota|caminha|cavalo|carreta|quantos.*(veicul|carr|caminh)/.test(n)){
    const cav=DB.veiculos.filter(x=>x.tipo==='Cavalo'&&x.status!=='Arquivado');
    const reb=DB.veiculos.filter(x=>isReb(x)&&x.status!=='Arquivado');
    return `🚛 A frota tem <b>${cav.length} cavalo(s)</b> e <b>${reb.length} carreta(s)</b>.<br>Cavalos: ${cav.map(x=>esc(x.placa)).join(', ')}<br>Carretas: ${reb.map(x=>esc(x.placa)).join(', ')}`;
  }
  if(/motorist|condutor|funcionar|quantos.*(motor|condut)/.test(n)){
    if(mot){ return `👤 <b>${esc(mot.nome)}</b> — ${esc(mot.funcao||'Motorista')}. CPF ${esc(mot.cpf||'—')}, CNH cat. ${esc(mot.categoria||'—')} (val. ${fmtD(mot.cnhValidade)}). Celular ${esc(mot.celular||'—')}.`; }
    const at=DB.motoristas.filter(m=>m.status==='Ativo');
    return `👥 São <b>${at.length} motorista(s) ativo(s)</b>: ${at.map(m=>esc(m.nome.split(' ')[0])).join(', ')}.`;
  }

  return `Posso consultar: pneus, KM/horas, trocas de óleo, vencimentos (CNH, tacógrafo, ASO…), baterias, gastos, resumo de um veículo, e listas da frota/motoristas. Ex.: <i>"quantos pneus tem o IRU-4G62"</i>, <i>"quando vence a CNH do Reinaldo"</i>, <i>"resumo do BDP-1B55"</i>.`;
}

/* ================================================================== */
/*  6. AJUDA + SAUDAÇÃO                                                */
/* ================================================================== */
function iaAjuda(){
  return `Eu entendo português normal (mesmo escrito rápido) e faço duas coisas: <b>lançar</b> e <b>consultar</b>. Se faltar algum dado, eu pergunto. Exemplos:
  <ul class="ia-help">
    <li>🛞 <i>trocado 4 pneus tração IRU-4G62 dia ${_iaHojeBR()} com 1520000 km</i></li>
    <li>🛞 <i>2 pneus dianteira usados 70% no EJZ-4I65</i></li>
    <li>📏 <i>km do JSX-4D55 1110000</i> · <i>horas da carreta EOF-5A47 12500</i></li>
    <li>🛢️ <i>troca de óleo IRU-4G62 hoje com 1520000 km</i></li>
    <li>🔋 <i>bateria Moura 220AH no BDP-1B55 por R$ 950 hoje</i></li>
    <li>⛽ <i>abasteci 320 litros no QIO-9J07 por R$ 2100 com 673000 km</i></li>
    <li>📦 <i>descarga do IRU-4G62 no Muffato por R$ 800 hoje</i></li>
    <li>🔧 <i>troca de lonas de freio no EJZ-4I65 oficina Rede Única por R$ 1200</i></li>
    <li>❓ <i>quantos pneus tem o IRU-4G62</i> · <i>quando vence a CNH do Reinaldo</i> · <i>resumo do BDP-1B55</i></li>
  </ul>
  Depois de cada ação aparece o botão <b>Desfazer</b>.`;
}
function iaSaudacao(){
  const h=new Date().getHours(); const s=h<12?'Bom dia':(h<18?'Boa tarde':'Boa noite');
  return `${s}! ✨ Sou a <b>Inteligência Artificial da Planeta Express</b>. Me diga qual comando devo executar — posso <b>lançar</b> pneus, KM/horas, trocas de óleo, baterias, abastecimentos, descargas e serviços, e também <b>consultar</b> qualquer dado do sistema. Se faltar alguma informação, eu pergunto. 🙂`;
}

/* ================================================================== */
/*  7. INTERFACE (botão flutuante + painel)                            */
/* ================================================================== */
function iaMontarFab(){
  if(document.getElementById('iaFab')) return;
  const fab=document.createElement('button');
  fab.id='iaFab'; fab.className='ia-fab no-print'; fab.title='Inteligência Artificial da Planeta Express';
  fab.innerHTML=`${svg('spark')}<span>IA Planeta</span>`; fab.onclick=iaToggle;
  document.body.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='iaPanel'; panel.className='ia-panel no-print';
  panel.innerHTML=`
    <div class="ia-head">
      <div class="ia-head-t">${svg('spark')}<div class="ia-head-txt"><b>Inteligência Artificial</b><span>Planeta Express Transportes</span></div></div>
      <button class="ia-x" onclick="iaToggle()" title="Fechar">×</button>
    </div>
    <div class="ia-body" id="iaBody"></div>
    <div class="ia-quick" id="iaQuick"></div>
    <div class="ia-input">
      <input id="iaInput" placeholder="Digite um comando ou pergunta…" autocomplete="off" onkeydown="if(event.key==='Enter')iaEnviar()">
      <button class="ia-send" onclick="iaEnviar()" title="Enviar">${svg('send')}</button>
    </div>`;
  document.body.appendChild(panel);
  iaQuickChips();
}
function iaQuickChips(){ const q=document.getElementById('iaQuick'); if(!q) return;
  const cav=(DB.veiculos.find(v=>v.tipo==='Cavalo')||{}).placa||'IRU-4G62';
  IA.chips=[
    ['🛞 Trocar pneus', `trocado 4 pneus tração ${cav} dia ${_iaHojeBR()} com 1520000 km`],
    ['📏 Atualizar KM', `km do ${cav} 1520000`],
    ['🛢️ Troca de óleo', `troca de óleo ${cav} hoje com 1520000 km`],
    ['❓ Consultar', `resumo do ${cav}`],
    ['ℹ️ Ajuda', 'ajuda'],
  ];
  q.innerHTML=IA.chips.map((c,i)=>`<button class="ia-chip" onclick="iaChip(${i})">${c[0]}</button>`).join('');
}
function iaChip(i){ const c=IA.chips[i]; if(!c) return; const el=document.getElementById('iaInput'); if(el){ el.value=c[1]; iaEnviar(); } }
function iaToggle(){ const p=document.getElementById('iaPanel'), f=document.getElementById('iaFab'); if(!p) return;
  IA.open=!IA.open; p.classList.toggle('open',IA.open); if(f) f.classList.toggle('hide',IA.open);
  if(IA.open){ if(!IA.msgs.length) iaBot(iaSaudacao()); setTimeout(()=>{ const i=document.getElementById('iaInput'); if(i) i.focus(); },220); }
}
function iaEnviar(){ const el=document.getElementById('iaInput'); if(!el) return; const t=(el.value||'').trim(); if(!t) return;
  el.value=''; iaUser(t);
  IA.msgs.push({who:'bot',html:'<span class="ia-typing"><i></i><i></i><i></i></span>'}); iaRender();
  setTimeout(()=>{ IA.msgs.pop(); const r=iaResponder(t); iaBot(r); }, 320);
}
function iaBot(html){ IA.msgs.push({who:'bot',html:html}); iaRender(); }
function iaUser(txt){ IA.msgs.push({who:'user',html:esc(txt)}); iaRender(); }
function iaRender(){ const b=document.getElementById('iaBody'); if(!b) return;
  b.innerHTML=IA.msgs.map(m=>`<div class="ia-msg ${m.who}">${m.who==='bot'?`<span class="ia-av">${svg('spark')}</span>`:''}<div class="ia-bubble">${m.html}</div></div>`).join('');
  b.scrollTop=b.scrollHeight; }
