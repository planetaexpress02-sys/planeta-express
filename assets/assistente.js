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
function _iaEhPergunta(n){ return /\?|\b(quant|qual|quais|quando|onde|cade|me diga|me fala|me informa|me mostr|mostr|list|resumo|status|situacao|vence|venc|validade|quanto tem|tem quantos|dado|dados|informac|ficha|sobre|detalhe|consulta|buscar|procur|pesquis|encontr|alarme|quem|gast|despes|custo|corretiv|preventiv)\b/.test(n); }
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
  if(/^(oi+|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem|ei)\b/.test(n) && n.length<20) return iaSaudacao();

  /* Licenças e alvarás são só consulta pelo chat (não há comando de lançamento
     com essas palavras), então não dependem do detector de pergunta. */
  if(/alvar|licenc|vigilanc|sanitar|certid|avcb|bombeiro|conformidade/.test(n)) return iaFinaliza(iaConsulta(t,n), 'consulta', t);
  /* Contabilidade também é só consulta (não há comando de lançamento por voz) */
  if(/faturamos|lucro|preju[ií]zo|resultado d|dre\b|margem|ebitda|contabil|tribut/.test(n)) return iaFinaliza(iaConsulta(t,n), 'consulta', t);

  /* Perguntas explícitas → consulta */
  if(_iaEhPergunta(n)) return iaFinaliza(iaConsulta(t,n), 'consulta', t);

  /* Comandos de lançamento (têm intenção clara) */
  const intent=_iaIntent(n);
  if(intent && intent!=='leitura') return iaFinaliza(iaExec(intent, t), intent, t);
  if(intent==='leitura'){
    /* "km IRU 1520000" = atualizar; "km IRU" (sem número) = consultar */
    if(_iaNumeroSolto(t)!=null) return iaFinaliza(iaExec('leitura', t), 'leitura', t);
    return iaFinaliza(iaConsulta(t,n), 'consulta', t);
  }

  /* Frase curta pedindo um dado (ex.: "cpf uilian", "chassi IRU", "telefone odecio") */
  if(_iaConsultaCurta(n) || _iaVeiculo(t) || _iaMotoristas(t).length) return iaFinaliza(iaConsulta(t,n), 'consulta', t);

  return `Não entendi 🤔. Pode pedir um dado (ex.: <i>cpf uilian</i>, <i>chassi IRU-4G62</i>, <i>quando vence a CNH do Reinaldo</i>) ou lançar algo (ex.: <i>troca de óleo IRU hoje 1520000 km</i>). Escreva <b>ajuda</b> para exemplos.`;
}
/* Campos consultáveis mesmo sem palavra de pergunta */
function _iaConsultaCurta(n){ return /\bcpf\b|\brg\b|telefone|celular|contato|\bfone\b|email|e-mail|chassi|renavam|\bcnh\b|habilita|carteira|endereco|\bmora\b|idade|nasciment|aniversar|\bano\b|\bcor\b|categoria|\bficha\b|\bdados?\b|\bquem\b|documento|venciment|\bvence|validade|alarme|media|consumo|\bkm\b|\bhora|ped[aá]gios?|praça|praca|concession|sem\s*parar|vale.?ped|\bbr\s*-?\s*\d{3}\b|\bpr\s*-?\s*\d{3}\b/.test(n); }

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
function _iaMotoristas(t){ const n=_iaNorm(t); const out=[];
  DB.motoristas.forEach(m=>{ const parts=_iaNorm(m.nome).split(/\s+/); if(parts.some(p=>p.length>=3 && n.indexOf(p)>=0)) out.push(m); });
  return out; }
function _iaPrimeiroNome(m){ return (m&&m.nome||'').split(' ')[0]; }
function _iaIdade(nasc){ const d=parseD(nasc); if(!d) return null; const h=new Date(); let a=h.getFullYear()-d.getFullYear();
  const mm=h.getMonth()-d.getMonth(); if(mm<0||(mm===0&&h.getDate()<d.getDate())) a--; return a; }
function _iaFichaVeiculo(v){
  const cav=!isReb(v); const un=cav?'km':'h'; const atual=cav?v.kmAtual:v.horaAtual; const dt=cav?v.kmData:v.horaData;
  const tot=pneuTotal(DB.pneus.filter(p=>p.veiculoId===v.id));
  const p=primaryItem(v); let ol='—'; if(p){ const mi=manutInfo(p,v); ol= mi.ok?(mi.restante<=0?'⚠️ vencida há '+num(-mi.restante)+' '+un:'faltam '+num(mi.restante)+' '+un):'sem cálculo'; }
  const vencs=DB.vencimentos.filter(x=>x.entidade==='veiculo'&&x.refId===v.id).sort((a,b)=>(a.validade||'').localeCompare(b.validade||''));
  const vtxt=vencs.length?vencs.map(x=>`${esc(x.tipo)} ${fmtD(x.validade)} ${_iaVencBadge(x)}`).join('<br>&nbsp;&nbsp;&nbsp;'):'—';
  const bat=DB.baterias.filter(b=>String(b.placa||'').replace(/\W/g,'').toUpperCase()===v.placa.replace(/\W/g,'').toUpperCase()).sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0];
  return `🚚 <b>${esc(v.placa)}</b> — ${esc(v.tipo)}`+
    `<br>• Marca/modelo: <b>${esc(v.marca||'—')} ${esc(v.modelo||'')}</b> (${esc(v.anoModelo||'—')})`+
    `<br>• Chassi: ${esc(v.chassi||'—')}`+
    `<br>• Renavam: ${esc(v.renavam||'—')} · Cor: ${esc(v.cor||'—')}`+
    `<br>• ${cav?'KM':'Horas'}: <b>${atual!=null?num(atual)+' '+un:'—'}</b>${dt?' <span class="ia-dim">('+fmtD(dt)+')</span>':''}`+
    `<br>• Óleo: ${ol} · Pneus: <b>${tot}</b>`+
    (bat?`<br>• Bateria: ${esc(bat.marca||'—')} (garantia até ${fmtD(bat.garantiaAte)})`:'')+
    `<br>• Documentos:<br>&nbsp;&nbsp;&nbsp;${vtxt}`;
}
function _iaFichaMotorista(m){
  const id=_iaIdade(m.nascimento);
  const vencs=DB.vencimentos.filter(x=>x.entidade==='motorista'&&x.refId===m.id).sort((a,b)=>(a.validade||'').localeCompare(b.validade||''));
  const vtxt=vencs.length?vencs.map(x=>`${esc(x.tipo)} ${fmtD(x.validade)} ${_iaVencBadge(x)}`).join('<br>&nbsp;&nbsp;&nbsp;'):'—';
  return `👤 <b>${esc(m.nome)}</b> — ${esc(m.funcao||'Motorista')}`+
    `<br>• CPF: <b>${esc(m.cpf||'—')}</b> · RG: ${esc(m.rg||'—')}${m.emissorRg?' ('+esc(m.emissorRg)+')':''}`+
    `<br>• Nascimento: ${fmtD(m.nascimento)}${id?' — <b>'+id+' anos</b>':''}`+
    `<br>• Celular: <b>${esc(m.celular||m.telefone||'—')}</b>${m.email?' · '+esc(m.email):''}`+
    `<br>• CNH: nº ${esc(m.cnh||'—')}, cat. <b>${esc(m.categoria||'—')}</b>, val. ${fmtD(m.cnhValidade)} ${_iaVencBadge({validade:m.cnhValidade})}`+
    (m.endereco?`<br>• Endereço: ${esc(m.endereco)}`:'')+
    `<br>• Documentos:<br>&nbsp;&nbsp;&nbsp;${vtxt}`;
}
function iaConsulta(t,n){
  const v=_iaVeiculo(t); const mots=_iaMotoristas(t); const mot=mots[0]||null;

  /* ALARME THERMO KING */
  if(/alarme|thermo|termo\s*king|codigo de erro|erro\s*\d/.test(n)){
    const arr=(typeof ALARMES_TK!=='undefined'?ALARMES_TK:[]);
    const cod=(String(t).match(/\d{1,4}/)||[])[0];
    if(cod){ const a=arr.find(x=>String(x.c)===String(cod)||String(x.c)===String(parseInt(cod,10)));
      if(a) return `🔔 <b>Alarme ${esc(a.c)}</b> — ${esc(a.d)}<br>• <b>Significa:</b> ${esc(a.ex||'—')}<br>• <b>O que fazer:</b> ${esc(a.so||'—')}`;
      return `Não encontrei o alarme ${esc(cod)} na lista Thermo King (${arr.length} códigos cadastrados).`; }
    return `Me diga o número do alarme. Ex.: <i>"alarme 128"</i>.`;
  }

  /* PEDÁGIOS */
  if(/pedagio|pedágio|pedagios|praça|praca|concession|sem\s*parar|vale.?ped|ped[aá]gios?|\bbr\s*-?\s*\d{3}\b|\bpr\s*-?\s*\d{3}\b/.test(n)){
    const ped=(DB.pedagios||[]); if(!ped.length) return `Ainda não há pedágios cadastrados.`;
    const soma=arr=>arr.reduce((s,p)=>s+(+p.valor||0),0);
    const inf=(typeof _pedInfo==='function')?_pedInfo:(x=>({rodovia:'',cidade:''}));
    /* placa (frota ou qualquer placa do extrato) */
    let placaF = v? v.placa : '';
    if(!placaF){ const pm=String(t).toUpperCase().replace(/[^A-Z0-9]/g,'').match(/[A-Z]{3}\d[A-Z0-9]\d{2}/); if(pm){ const h=ped.find(p=>String(p.placa).replace(/[^A-Z0-9]/gi,'')===pm[0]); if(h) placaF=h.placa; } }
    let lista=placaF? ped.filter(p=>p.placa===placaF):ped;
    /* "qual veículo/motorista gastou mais" */
    if(/(qual|quem).*(mais|maior)/.test(n) && /veic|ve[ií]culo|carro|caminh|placa/.test(n)){
      const by={}; ped.forEach(p=>by[p.placa]=(by[p.placa]||0)+(+p.valor||0));
      const top=Object.keys(by).sort((a,b)=>by[b]-by[a]).slice(0,3);
      return `🚚 Veículos que mais gastaram em pedágios:<br>`+top.map((pl,i)=>`${i+1}. <b>${esc(pl)}</b> — ${money(by[pl])}`).join('<br>');
    }
    /* por rodovia (BR-376, PR-445...) */
    const rm=n.match(/\b(br|pr)\s*-?\s*(\d{3})\b/);
    if(rm){ const rod=rm[1].toUpperCase()+'-'+rm[2]; const arr=lista.filter(p=>inf(p.praca).rodovia===rod);
      return arr.length? `🛣️ Na <b>${rod}</b>${placaF?' ('+esc(placaF)+')':''}: ${arr.length} passagem(ns) — <b>${money(soma(arr))}</b>.` : `Não achei passagens na ${rod}${placaF?' para '+esc(placaF):''}.`; }
    /* por concessionária */
    const cq=(n.match(/prvias|epr|araucar|ccr/)||[])[0];
    if(cq){ const arr=lista.filter(p=>_pedNorm(p.conc).indexOf(cq)>=0);
      return arr.length? `🏢 <b>${esc(arr[0].conc)}</b>${placaF?' ('+esc(placaF)+')':''}: ${arr.length} passagem(ns) — <b>${money(soma(arr))}</b>.` : `Não achei passagens da concessionária "${esc(cq)}".`; }
    /* viagem específica */
    const vm=n.match(/viagem\s*(\d{4,})/); if(vm){ const arr=ped.filter(p=>String(p.viagem).indexOf(vm[1])>=0);
      return arr.length? `🧭 Viagem <b>${esc(vm[1])}</b>: ${arr.length} pedágio(s) — <b>${money(soma(arr))}</b>.<br>`+arr.slice(0,8).map(p=>`• ${fmtD(p.data)} ${esc(inf(p.praca).cidade)} — ${money(p.valor)}`).join('<br>') : `Não achei pedágios da viagem ${esc(vm[1])}.`; }
    /* total geral ou por veículo */
    const pago=lista.filter(p=>p.tipo==='Pedágio'), vale=lista.filter(p=>p.tipo==='Vale-pedágio');
    return `🛣️ ${placaF?'<b>'+esc(placaF)+'</b> — ':''}pedágios: <b>${money(soma(lista))}</b> em ${lista.length} passagem(ns).<br>• Pago pela empresa: <b>${money(soma(pago))}</b><br>• Vale-pedágio (reembolsado pelo embarcador): <b>${money(soma(vale))}</b>`;
  }

  /* LICENÇAS E ALVARÁS (conformidade) */
  if(/alvar[aá]|licen[cç]a|licen[cç]as|vigil[aâ]ncia|sanitar|certid[aã]o|certidoes|certid[oõ]es|inscri[cç][aã]o (estadual|municipal)|ambienta|bombeiro|avcb|conformidade/.test(n)){
    const lic=(DB.licencas||[]); if(!lic.length) return `Ainda não há licenças cadastradas. Abra a aba <b>Licenças e Alvarás</b> e use "Enviar documento" — eu leio o PDF e preencho sozinho.`;
    const vivas=lic.filter(l=>l.situacao!=='arquivada');
    const sit=(typeof licSit==='function')?licSit:(()=>({k:'',n:''}));
    const cat=(typeof licCatInfo==='function')?licCatInfo:(k=>({n:k||'Licença'}));
    const tit=(typeof licTitular==='function')?licTitular:(l=>l.titular||'Empresa');
    const linha=l=>`• <b>${esc(l.nome||cat(l.categoria).n)}</b>${l.numero?' (nº '+esc(l.numero)+')':''} — ${esc(tit(l))}${l.municipio?' · '+esc(l.municipio):''}${l.estado?'/'+esc(l.estado):''} — vence <b>${fmtD(l.validade)}</b> ${_iaVencBadge({validade:l.validade})}`;

    /* sem arquivo anexado */
    if(/n[aã]o (possuem|tem|t[eê]m|ha|h[aá])|sem (arquivo|anexo|documento)|falta.*(anexo|arquivo)|anexad/.test(n) && /anex|arquiv/.test(n)){
      const sem=vivas.filter(l=>!(typeof anexoTipo==='function' && anexoTipo('licenca',l.id,/./)));
      return sem.length? `📎 <b>${sem.length}</b> licença(s) ainda <b>sem arquivo anexado</b>:<br>`+sem.map(linha).join('<br>')
                       : `✅ Todas as ${vivas.length} licenças já têm o documento anexado.`;
    }
    /* filtro por categoria citada */
    let alvo=vivas, rotulo='licenças';
    if(/vigil[aâ]ncia|sanitar/.test(n)){ alvo=vivas.filter(l=>l.categoria==='sanitaria'); rotulo='vigilâncias sanitárias'; }
    else if(/ambienta/.test(n)){ alvo=vivas.filter(l=>l.categoria==='ambiental'); rotulo='licenças ambientais'; }
    else if(/bombeiro|avcb/.test(n)){ alvo=vivas.filter(l=>l.categoria==='bombeiros'); rotulo='licenças do corpo de bombeiros'; }
    else if(/certid/.test(n)){ alvo=vivas.filter(l=>l.categoria==='certidao'); rotulo='certidões'; }
    else if(/inscri[cç][aã]o estadual/.test(n)){ alvo=vivas.filter(l=>l.categoria==='estadual'); rotulo='inscrições estaduais'; }
    else if(/inscri[cç][aã]o municipal/.test(n)){ alvo=vivas.filter(l=>l.categoria==='municipal'); rotulo='inscrições municipais'; }
    else if(/alvar/.test(n)){ alvo=vivas.filter(l=>l.categoria==='alvara'); rotulo='alvarás'; }

    /* vencidas */
    if(/vencid|venceu|atrasad|irregular/.test(n)){
      const vd=alvo.filter(l=>sit(l).k==='vencida');
      return vd.length? `🔴 <b>${vd.length}</b> ${rotulo} <b>vencida(s)</b>:<br>`+vd.map(linha).join('<br>')
                      : `✅ Não há ${rotulo} vencidas. Está tudo regular.`;
    }
    /* vencem este mês */
    if(/est[ée] m[eê]s|neste m[eê]s|do m[eê]s|nesse m[eê]s/.test(n)){
      const h=new Date(), ym=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0');
      const mes=alvo.filter(l=>String(l.validade||'').slice(0,7)===ym).sort((a,b)=>String(a.validade).localeCompare(String(b.validade)));
      return mes.length? `📅 <b>${mes.length}</b> ${rotulo} vencem <b>este mês</b>:<br>`+mes.map(linha).join('<br>')
                       : `✅ Não há ${rotulo} vencendo este mês.`;
    }
    /* vencendo / a vencer */
    if(/vencendo|a vencer|pr[oó]xim|renova/.test(n)){
      const av=alvo.filter(l=>{ const d=diasAte(l.validade); return d!=null && d>=0 && d<=90; }).sort((a,b)=>diasAte(a.validade)-diasAte(b.validade));
      return av.length? `🟡 <b>${av.length}</b> ${rotulo} vencem nos próximos 90 dias:<br>`+av.map(linha).join('<br>')
                      : `✅ Não há ${rotulo} vencendo nos próximos 90 dias.`;
    }
    /* "quando vence o alvará da matriz/de Londrina..." */
    if(/quando vence|vencimento d|validade d|at[ée] quando/.test(n)){
      let esp=alvo.slice();
      const mm=String(t).match(/(?:da|de|do|em)\s+([A-Za-zÀ-ÿ]{3,})/i);
      if(mm && !/matriz|empresa/i.test(mm[1])){ const k=mm[1].toLowerCase();
        const f=esp.filter(l=>((l.municipio||'')+' '+(l.nome||'')+' '+tit(l)).toLowerCase().indexOf(k)>=0); if(f.length) esp=f; }
      esp=esp.filter(l=>l.validade).sort((a,b)=>String(a.validade).localeCompare(String(b.validade)));
      if(!esp.length) return `Não achei ${rotulo} com data de validade cadastrada.`;
      if(esp.length===1){ const l=esp[0];
        return `📄 <b>${esc(l.nome||cat(l.categoria).n)}</b>${l.numero?' (nº '+esc(l.numero)+')':''}<br>• Órgão: ${esc(l.orgao||'—')}<br>• Local: ${esc(l.municipio||'—')}${l.estado?'/'+esc(l.estado):''}<br>• Emissão: ${fmtD(l.emissao)}<br>• <b>Vence em ${fmtD(l.validade)}</b> ${_iaVencBadge({validade:l.validade})}<br>• Responsável: ${esc(l.responsavel||'—')}`; }
      return `📄 ${esc(String(rotulo).charAt(0).toUpperCase()+String(rotulo).slice(1))} cadastradas:<br>`+esp.map(linha).join('<br>');
    }
    /* protocolos / renovações em andamento */
    if(/protocolo|andamento|em an[aá]lise|tramit/.test(n)){
      const r=vivas.filter(l=>l.renov&&l.renov.aberta);
      const et=(typeof LIC_ETAPAS!=='undefined')?LIC_ETAPAS:[];
      return r.length? `🔵 <b>${r.length}</b> renovação(ões) em andamento:<br>`+r.map(l=>`• <b>${esc(l.nome||cat(l.categoria).n)}</b> — etapa <b>${esc((et.find(e=>e.k===(l.renov.etapa||''))||{}).n||'Em preparação')}</b>${l.renov.protocolo?' · protocolo '+esc(l.renov.protocolo):''}`).join('<br>')
                     : `Não há renovações em andamento no momento.`;
    }
    /* listagem geral da categoria pedida */
    if(!alvo.length) return `Não achei ${rotulo} cadastradas.`;
    const ord=alvo.slice().sort((a,b)=>(diasAte(a.validade)??9e9)-(diasAte(b.validade)??9e9));
    return `📋 <b>${ord.length}</b> ${rotulo} cadastradas:<br>`+ord.slice(0,15).map(linha).join('<br>')+(ord.length>15?`<br><i>…e mais ${ord.length-15}.</i>`:'');
  }

  /* CONTABILIDADE — responde com os números reais dos módulos */
  if(typeof contabLancamentos==='function' &&
     /faturamos|faturamento|lucro|prejuizo|preju[ií]zo|resultado|dre|margem|ebitda|contabil|custo total|quanto gastamos|maior custo|imposto|tributo|receita/.test(n)){
    const todos=contabLancamentos();
    if(!todos.length) return `Ainda não há valores lançados nos módulos. Assim que entrar um CT-e, um abastecimento ou o relatório do contador, eu já calculo.`;
    /* período pedido */
    const h=new Date(); let iv, rot;
    const MES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
    const mm=n.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
    if(mm){ const ano=(t.match(/\b(20\d{2})\b/)||[])[1]||h.getFullYear();
      const m2=String(MES[mm[1]]).padStart(2,'0');
      iv={ini:ano+'-'+m2+'-01', fim:ano+'-'+m2+'-31'}; rot=_capitaliza(mm[1])+'/'+ano; }
    else if(/este ano|no ano|do ano/.test(n)){ iv=contabIntervalo('ano'); rot='este ano'; }
    else if(/tudo|total|geral|hist[oó]rico/.test(n)){ iv={ini:'',fim:''}; rot='todo o período'; }
    else { iv=contabIntervalo('mes'); rot='este mês'; }
    const lanc=contabPeriodo(todos, iv.ini, iv.fim);
    const d=contabDRE(lanc);

    /* quanto gastamos com X */
    const alvo=[['diesel',/diesel|combust/],['pedagio',/pedagio|pedágio/],['pneus',/pneu/],
      ['manutencao',/manuten|oficina/],['seguros',/seguro/],['motorista',/motorista|salario/]];
    for(const [k,re] of alvo){
      if(re.test(n) && /quanto|gast|custo|total/.test(n)){
        const cs=contabPorConta(lanc).filter(function(c){ return _iaNorm(contabContaNome(c.conta)).indexOf(k.slice(0,6))>=0
          || (k==='manutencao'&&c.conta==='c.manutencao') || (k==='diesel'&&c.conta==='c.diesel')
          || (k==='pedagio'&&c.conta==='c.pedagio') || (k==='pneus'&&c.conta==='c.pneus')
          || (k==='seguros'&&c.conta==='c.seguros') || (k==='motorista'&&c.conta==='c.motorista'); });
        const tot=cs.reduce(function(s,c){ return s+c.valor; },0);
        if(!tot) return `Não há gasto com ${k} lançado em ${rot}.`;
        return `💰 Gasto com <b>${esc(cs[0]?contabContaNome(cs[0].conta):k)}</b> em ${rot}: <b>${money(tot)}</b> (${cs.reduce(function(s,c){ return s+c.n; },0)} lançamento(s)).`;
      }
    }
    /* qual veículo teve maior custo */
    if(/(qual|quem).*(maior|mais).*(custo|gast)|veiculo que mais/.test(n)){
      const arr=contabPorVeiculo(lanc).filter(function(m){ return m.custo; }).slice(0,3);
      if(!arr.length) return `Não há custos ligados a veículo em ${rot}.`;
      return `🚚 Veículos com maior custo em ${rot}:<br>`+arr.map(function(m,i){
        return `${i+1}. <b>${esc(m.veiculo.placa)}</b> — ${money(m.custo)}`+(m.receita?` (receita ${money(m.receita)}, resultado ${money(m.resultado)})`:''); }).join('<br>');
    }
    /* impostos pendentes */
    if(/imposto|tribut/.test(n)){
      const ab=(DB.contabTributos||[]).filter(function(x){ return !x.pago; });
      const tot=ab.reduce(function(s,x){ return s+(+x.valor||0); },0);
      if(!ab.length) return `Não há tributos em aberto cadastrados. (Os valores são lançados por você/pelo contador na aba Contabilidade → Tributos.)`;
      return `🧾 <b>${ab.length}</b> tributo(s) em aberto — total <b>${money(tot)}</b>:<br>`+ab.slice(0,8).map(function(x){
        return `• ${esc(contabContaNome(x.conta))} ${esc(x.competencia||'')} — ${money(x.valor)}`+(x.vencimento?` (vence ${fmtD(x.vencimento)})`:''); }).join('<br>');
    }
    /* faturamento / receita */
    if(/faturamos|faturamento|receita/.test(n) && !/lucro|resultado|margem/.test(n)){
      if(!d.receita) return `Não há receita lançada em ${rot}. As receitas vêm dos CT-e e do faturamento do contador.`;
      return `📈 Receita de ${rot}: <b>${money(d.receita)}</b>.`+(d.liquida!==d.receita?`<br>Receita líquida: <b>${money(d.liquida)}</b>.`:'');
    }
    /* resultado / lucro — com aviso honesto quando falta receita */
    const falta=[];
    if(!d.receita) falta.push('nenhuma receita lançada');
    const semCentro=lanc.filter(function(l){ return !l.centro; }).length;
    if(semCentro) falta.push(semCentro+' lançamento(s) sem centro de custo');
    let txt=`📊 <b>${esc(String(rot).charAt(0).toUpperCase()+String(rot).slice(1))}</b><br>`
      +`• Receita: <b>${money(d.receita)}</b><br>`
      +`• Custos operacionais: <b>${money(d.custo)}</b><br>`
      +`• Despesas: <b>${money(d.despesa)}</b><br>`
      +`• Resultado: <b style="color:${d.resultado>=0?'#4bd6a0':'#f2686b'}">${money(d.resultado)}</b>`
      +(d.liquida? ` (margem ${d.margem.toFixed(1)}%)`:'')
      +`<br>• EBITDA: <b>${money(d.ebitda)}</b>`;
    if(falta.length) txt+=`<br><br>⚠️ Consigo calcular, mas <b>${falta.join(' e ')}</b> — o número pode não refletir a realidade. Quer que eu liste?`;
    return txt;
  }

  /* FINANCEIRO é protegido por senha — não exponho pelo chat */
  if(/faturament|\bfatura\b|receita|\bvale\b|\bvales\b|pagamento|financeir|lucro|sal[aá]rio|acerto/.test(n)){
    return `🔒 O <b>Financeiro</b> (faturamento, vales e pagamentos) é protegido por senha. Abra a aba <b>Financeiro</b> e informe o PIN para ver esses valores.`;
  }

  /* Ambiguidade de nome (ex.: mais de um Marcelo) */
  if(mots.length>1 && !v && /motorist|condutor|cpf|\brg\b|cnh|telefone|celular|email|endereco|nasc|idade|habilita|carteira|exame|aso|tox|opentech|direcao|\bdado|ficha|sobre|documento|quem/.test(n)){
    return `Temos mais de um com esse nome: ${mots.map(m=>'<b>'+esc(m.nome)+'</b>').join(' · ')}. De qual você quer saber?`;
  }

  /* CAMPO ESPECÍFICO — MOTORISTA */
  if(mot){
    if(/\bcpf\b/.test(n)) return `🪪 CPF de <b>${esc(_iaPrimeiroNome(mot))}</b>: <b>${esc(mot.cpf||'—')}</b>.`;
    if(/\brg\b|identidade/.test(n)) return `🪪 RG de <b>${esc(_iaPrimeiroNome(mot))}</b>: <b>${esc(mot.rg||'—')}</b>${mot.emissorRg?' ('+esc(mot.emissorRg)+')':''}.`;
    if(/telefone|celular|contato|whats|\bnumero\b|fone/.test(n)) return `📞 ${esc(_iaPrimeiroNome(mot))}: <b>${esc(mot.celular||mot.telefone||'—')}</b>.`;
    if(/email|e-mail/.test(n)) return `✉️ ${esc(_iaPrimeiroNome(mot))}: <b>${esc(mot.email||'—')}</b>.`;
    if(/endereco|mora|reside|onde vive/.test(n)) return `🏠 ${esc(_iaPrimeiroNome(mot))}: ${esc(mot.endereco||mot.municipioEnd||'—')}.`;
    if(/idade|nasc|aniversar/.test(n)){ const id=_iaIdade(mot.nascimento); return `🎂 ${esc(_iaPrimeiroNome(mot))} nasceu em ${fmtD(mot.nascimento)}${id?' — <b>'+id+' anos</b>':''}.`; }
    if(/cnh|habilita|carteira/.test(n)) return `🪪 CNH de <b>${esc(_iaPrimeiroNome(mot))}</b>: nº ${esc(mot.cnh||'—')}, categoria <b>${esc(mot.categoria||'—')}</b>, validade ${fmtD(mot.cnhValidade)} ${_iaVencBadge({validade:mot.cnhValidade})}. 1ª habilitação em ${fmtD(mot.primeiraHab)}.`;
    if(/exame|\baso\b|tox|opentech|saude/.test(n)){ const ex=DB.vencimentos.filter(x=>x.entidade==='motorista'&&x.refId===mot.id&&/ASO|Toxicol|Opentech/i.test(x.tipo)); if(ex.length) return `🧪 Exames de <b>${esc(_iaPrimeiroNome(mot))}</b>:<br>`+ex.map(x=>`• ${esc(x.tipo)}: ${fmtD(x.validade)} ${_iaVencBadge(x)}`).join('<br>'); }
    if(/dado|ficha|sobre|informac|detalhe|tudo|quem e|quem é/.test(n)) return _iaFichaMotorista(mot);
  }

  /* CAMPO ESPECÍFICO — VEÍCULO */
  if(v){
    if(/chassi/.test(n)) return `🚚 Chassi do <b>${esc(v.placa)}</b>: <b>${esc(v.chassi||'—')}</b>.`;
    if(/renavam/.test(n)) return `🚚 Renavam do <b>${esc(v.placa)}</b>: <b>${esc(v.renavam||'—')}</b>.`;
    if(/\bano\b|ano modelo|anomodelo/.test(n)) return `🚚 <b>${esc(v.placa)}</b>: ano ${esc(v.anoModelo||'—')}.`;
    if(/\bcor\b/.test(n)) return `🚚 <b>${esc(v.placa)}</b>: cor ${esc(v.cor||'—')}.`;
    if(/crlv|licenciament/.test(n)){ const c=DB.vencimentos.find(x=>x.entidade==='veiculo'&&x.refId===v.id&&/CRLV/i.test(x.tipo)); return c?`📄 CRLV do <b>${esc(v.placa)}</b>: validade ${fmtD(c.validade)} ${_iaVencBadge(c)}.`:`Não achei CRLV cadastrado para o ${esc(v.placa)}.`; }
    if(/marca|modelo/.test(n) && !/pneu/.test(n)) return `🚚 <b>${esc(v.placa)}</b>: ${esc(v.marca||'—')} ${esc(v.modelo||'')} (${esc(v.anoModelo||'—')}).`;
    if(/dado|ficha|sobre|informac|detalhe|tudo/.test(n)) return _iaFichaVeiculo(v);
  }

  /* MÉDIA DE CONSUMO */
  if(/media|consumo|km\/l|km por litro|rendiment/.test(n) && v){
    if(typeof mediaVeiculo==='function'){ const md=mediaVeiculo(v); if(md) return `⛽ Média do <b>${esc(v.placa)}</b>: <b>${md.valor.toFixed(2)}</b> ${esc(md.tipo)}.`; }
    return `Ainda não tenho abastecimentos suficientes do ${esc(v.placa)} para calcular a média (preciso de ao menos 2).`;
  }

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
  if(/vence|venc|validade|cnh|tacograf|aso|toxicol|licenc|crlv|opentech|documento|exame|vigil|sanitar|vencid|em dia/.test(n)){
    const tipos=[['cnh','CNH'],['toxicol','Toxicológico'],['aso','ASO'],['tacograf','Tacógrafo'],['crlv','CRLV'],['opentech','Opentech'],['vigil','Vigilância'],['sanitar','Vigilância'],['pgr','PGR'],['pcmso','PCMSO']];
    let filtroTipo=''; tipos.forEach(([k,val])=>{ if(new RegExp(k).test(n)) filtroTipo=val; });
    const soVencidos=/vencid/.test(n);
    const soMes=/(este|esse|deste|neste|do)\s*mes|mes atual|mes que vem|proximo mes/.test(n);
    let lista;
    if(mot){ lista=DB.vencimentos.filter(x=>x.entidade==='motorista'&&x.refId===mot.id); }
    else if(v){ lista=DB.vencimentos.filter(x=>x.entidade==='veiculo'&&x.refId===v.id); }
    else { lista=DB.vencimentos.filter(x=>{ const d=diasAte(x.validade); if(d==null) return false; if(soVencidos) return d<0; if(soMes){ const dt=parseD(x.validade); const h=hoje(); return dt&&dt.getMonth()===h.getMonth()&&dt.getFullYear()===h.getFullYear(); } return d<=90; }); }
    if(filtroTipo) lista=lista.filter(x=>(x.tipo||'').indexOf(filtroTipo)>=0);
    if((mot||v)&&soVencidos) lista=lista.filter(x=>{ const d=diasAte(x.validade); return d!=null&&d<0; });
    lista=lista.slice().sort((a,b)=>(a.validade||'').localeCompare(b.validade||''));
    if(!lista.length) return mot||v? `Não achei ${filtroTipo||'documentos'}${soVencidos?' vencidos':''} para <b>${esc((mot||v).nome||(v&&v.placa))}</b>. 👍` : (soVencidos?'Nada vencido. 👍':'Nada vencendo nesse período. 👍');
    const alvo= mot? mot.nome : (v? v.placa : (soVencidos?'documentos vencidos':(soMes?'vencendo este mês':'próximos 90 dias')));
    const linhas=lista.slice(0,15).map(x=>{ const quem= mot||v? '' : ' <span class="ia-dim">('+esc(nomeEntidade(x))+')</span>'; return `• <b>${esc(x.tipo)}</b>${quem}: ${fmtD(x.validade)} ${_iaVencBadge(x)}`; }).join('<br>');
    return `📋 ${filtroTipo?esc(filtroTipo)+' — ':''}<b>${esc(alvo)}</b>:<br>${linhas}`;
  }

  /* VIAGENS */
  if(/viage|viagens/.test(n)){
    let lista=DB.viagens.slice();
    if(v){ const key=v.placa.replace(/\W/g,'').toUpperCase(); lista=lista.filter(x=>String(x.placa||'').replace(/\W/g,'').toUpperCase()===key); }
    const meses=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const mi=meses.findIndex(mn=>n.indexOf(mn)>=0);
    if(mi>=0) lista=lista.filter(x=>{ const d=parseD(x.data); return d&&d.getMonth()===mi; });
    return `🛣️ ${lista.length} viagem(ns)${v?' do <b>'+esc(v.placa)+'</b>':''}${mi>=0?' em '+meses[mi]:''} registrada(s).`;
  }

  /* DESCARGAS */
  if(/descarg/.test(n)){
    let lista=DB.descargas.slice();
    if(v){ const key=v.placa.replace(/\W/g,'').toUpperCase(); lista=lista.filter(x=>String(x.placa||'').replace(/\W/g,'').toUpperCase()===key); }
    const total=lista.reduce((s,x)=>s+(+x.valor||0),0);
    if(!lista.length) return `Nenhuma descarga${v?' do '+esc(v.placa):''} registrada.`;
    return `📦 ${lista.length} descarga(s)${v?' do <b>'+esc(v.placa)+'</b>':''}, somando <b>${money(total)}</b>.`;
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

  /* GASTOS / DESPESAS / MANUTENÇÃO */
  if(/gast|despes|custo|manuten|repar|servi|corretiv|preventiv/.test(n)){
    const sv=DB.servicos.filter(x=>v? x.veiculoId===v.id : true);
    const somaS=a=>a.reduce((s,x)=>s+(+x.valor||0),0);
    const corr=somaS(sv.filter(x=>(x.tipo||'Corretiva')==='Corretiva'));
    const prev=somaS(sv.filter(x=>x.tipo==='Preventiva'));
    if(v){ return `💰 Manutenção do <b>${esc(v.placa)}</b>: ${sv.length} serviço(s), total <b>${money(corr+prev)}</b> — corretiva ${money(corr)}, preventiva ${money(prev)}.`; }
    const ab=somaS(DB.abastecimentos), bat=somaS(DB.baterias);
    return `💰 Gastos registrados:<br>• Manutenção: <b>${money(corr+prev)}</b> (corretiva ${money(corr)} · preventiva ${money(prev)})<br>• Abastecimentos: <b>${money(ab)}</b><br>• Baterias: <b>${money(bat)}</b><br>• <b>Total geral: ${money(corr+prev+ab+bat)}</b>`;
  }

  /* RESUMO / FICHA DO VEÍCULO */
  if(v && /resumo|status|situacao|ficha|tudo|geral/.test(n)) return _iaFichaVeiculo(v);

  /* LISTAS GERAIS / CONTAGENS */
  if(/veicul|frota|caminha|cavalo|carreta/.test(n)){
    const cav=DB.veiculos.filter(x=>x.tipo==='Cavalo'&&x.status!=='Arquivado');
    const reb=DB.veiculos.filter(x=>isReb(x)&&x.status!=='Arquivado');
    return `🚛 A frota tem <b>${cav.length} cavalo(s)</b> e <b>${reb.length} carreta(s)</b>.<br>Cavalos: ${cav.map(x=>esc(x.placa)).join(', ')}<br>Carretas: ${reb.map(x=>esc(x.placa)).join(', ')}`;
  }
  if(/motorist|condutor|funcionar|colaborador/.test(n)){
    const at=DB.motoristas.filter(m=>m.status==='Ativo');
    return `👥 São <b>${at.length} motorista(s) ativo(s)</b>: ${at.map(m=>esc(_iaPrimeiroNome(m))).join(', ')}. Peça "dados do <nome>" para ver a ficha completa.`;
  }

  /* BUSCA GENÉRICA (placa, nome, CPF, local…) */
  if(/buscar|procur|pesquis|encontr|localiz|onde (esta|fica)/.test(n)){
    let termo=String(t).replace(/.*\b(buscar|procur[ae]?|pesquis[ae]?|encontr[ae]?|localiz[ae]?|onde esta|onde fica)\b/i,'').trim();
    if(v) return _iaFichaVeiculo(v);
    if(mot) return _iaFichaMotorista(mot);
    if(termo.length>=2){ const tn=_iaNorm(termo);
      const vv=DB.veiculos.filter(x=>_iaNorm(x.placa+' '+x.marca+' '+x.modelo).indexOf(tn)>=0);
      const mm=DB.motoristas.filter(x=>_iaNorm(x.nome+' '+(x.cpf||'')).indexOf(tn)>=0);
      const out=[]; if(vv.length) out.push('🚚 '+vv.map(x=>esc(x.placa)).join(', ')); if(mm.length) out.push('👤 '+mm.map(x=>esc(x.nome)).join(', '));
      return out.length? `Encontrei:<br>${out.join('<br>')}` : `Não encontrei nada para "<b>${esc(termo)}</b>".`;
    }
  }

  /* Se identifiquei um veículo/motorista mas nenhum tópico específico, mostro a ficha */
  if(v) return _iaFichaVeiculo(v);
  if(mot) return _iaFichaMotorista(mot);

  return `Posso informar qualquer dado do sistema. Exemplos:<br>• <i>dados do IRU-4G62</i> · <i>chassi do JSX-4D55</i> · <i>quantos pneus tem o BDP-1B55</i><br>• <i>CPF do Reinaldo</i> · <i>telefone do Odecio</i> · <i>quando vence a CNH do Marcelo</i><br>• <i>o que vence este mês</i> · <i>documentos vencidos</i> · <i>alarme 128</i><br>• <i>média do QIO-9J07</i> · <i>quantas viagens em junho</i> · <i>gastos</i>`;
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
  </ul>
  <b>Consultar</b> — posso informar <b>qualquer dado</b> do sistema:
  <ul class="ia-help">
    <li>🚚 <i>dados do IRU-4G62</i> · <i>chassi do JSX-4D55</i> · <i>renavam do BDP</i> · <i>média do QIO-9J07</i></li>
    <li>👤 <i>dados do Reinaldo</i> · <i>CPF do Odecio</i> · <i>telefone do Renato</i> · <i>idade do Marcelo</i></li>
    <li>📋 <i>quando vence a CNH do Reinaldo</i> · <i>o que vence este mês</i> · <i>documentos vencidos</i></li>
    <li>🛞 <i>quantos pneus tem o IRU-4G62</i> · 🔔 <i>alarme 128</i> · 💰 <i>gastos</i> · 🛣️ <i>quantas viagens em junho</i></li>
  </ul>
  Depois de cada lançamento aparece o botão <b>Desfazer</b>. Se faltar um dado, eu pergunto. 🙂`;
}
function iaSaudacao(){
  const h=new Date().getHours(); const s=h<12?'Bom dia':(h<18?'Boa tarde':'Boa noite');
  return `${s} ✨ Sou a <b>IA da Planeta Express</b>. Como posso ajudar?`;
}

/* ================================================================== */
/*  7. INTERFACE (botão flutuante + painel)                            */
/* ================================================================== */
/* A IA aparece SEMPRE no modo offline; no modo online, só depois do login. */
function iaPodeUsar(){
  if(typeof nuvemAtiva!=='function' || !nuvemAtiva()) return true;   // offline
  return !!(typeof nuvemUser==='function' && nuvemUser());           // online: precisa estar logado
}
function iaRemoverFab(){ ['iaFab','iaPanel'].forEach(id=>{ const e=document.getElementById(id); if(e) e.remove(); }); IA.open=false; }
function iaAtualizarAcesso(){ if(iaPodeUsar()) iaMontarFab(); else iaRemoverFab(); }
function iaMontarFab(){
  if(!iaPodeUsar()) return;
  if(document.getElementById('iaFab')) return;
  const fab=document.createElement('button');
  fab.id='iaFab'; fab.className='ia-fab no-print'; fab.setAttribute('aria-label','IA Planeta — Assistente Operacional');
  fab.innerHTML=`<span class="ia-orb"></span><span class="ia-tip"><i class="ia-tipdot"></i>Sistema operacional online</span>`;
  fab.onclick=iaToggle;
  document.body.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='iaPanel'; panel.className='ia-panel no-print';
  panel.innerHTML=`
    <div class="ia-head">
      <div class="ia-head-t"><span class="ia-headorb">${svg('spark')}</span>
        <div class="ia-head-txt"><b>IA PLANETA</b><span>Assistente Operacional Inteligente</span></div></div>
      <button class="ia-x" onclick="iaToggle()" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="ia-status"><span class="ia-live"><i></i>Online</span><span class="ia-sync">Sistema sincronizado</span></div>
    <div class="ia-body" id="iaBody"></div>
    <div class="ia-input">
      <input id="iaInput" placeholder="O que deseja fazer?" autocomplete="off" onkeydown="if(event.key==='Enter')iaEnviar()">
      <button class="ia-send" onclick="iaEnviar()" aria-label="Enviar">${svg('send')}</button>
    </div>`;
  document.body.appendChild(panel);
}
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
