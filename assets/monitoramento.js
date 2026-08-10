/* ==================================================================
   MONITORAMENTO OPERACIONAL — Planeta Express
   ------------------------------------------------------------------
   Componente do card "Monitoramento" da tela Início.
   Mesmo tamanho e mesma posição de sempre: só o miolo mudou.

   A separação abaixo é proposital, para que trocar a simulação por
   GPS real seja questão de trocar UM objeto:

     MON_LOCAIS   -> dados de localização (lat/lon reais)
     MON_ROTAS    -> geometria das rotas (hoje desenhada, amanhã polyline real)
     monProjetar  -> lat/lon  ->  x,y da tela (trocável por projeção de mapa real)
     MonProvider  -> de onde vêm os veículos (hoje simulação local)
     MonSim       -> motor de simulação offline (não desenha nada)
     monRender    -> desenho (não simula nada)

   Tudo funciona 100% offline: SVG + CSS + JavaScript, sem biblioteca
   externa e sem chamada de rede.
   ================================================================== */

/* ==================================================================
   1) LOCAIS — coordenadas geográficas reais (centro dos municípios).
   Fonte: coordenadas oficiais dos municípios do IBGE, arredondadas.
   São aproximadas ao CENTRO da cidade — servem para posicionamento
   e ficam prontas para o mapa real. Para acrescentar uma cidade,
   basta uma linha aqui: o mapa, as rotas e o painel se ajustam.
   ================================================================== */
const MON_LOCAIS = [
  { id:'londrina', nome:'Londrina',  tipo:'base',    uf:'PR', lat:-23.3103, lon:-51.1628, status:'online' },
  { id:'cambe',    nome:'Cambé',     tipo:'destino', uf:'PR', lat:-23.2758, lon:-51.2783, status:'online' },
  { id:'maringa',  nome:'Maringá',   tipo:'destino', uf:'PR', lat:-23.4253, lon:-51.9386, status:'online' },
  { id:'paicandu', nome:'Paiçandu',  tipo:'destino', uf:'PR', lat:-23.4553, lon:-52.0475, status:'online' },
  /* Para o futuro, é só descomentar / acrescentar:
  { id:'ibipora',   nome:'Ibiporã',   tipo:'destino', uf:'PR', lat:-23.2694, lon:-51.0480, status:'online' },
  { id:'rolandia',  nome:'Rolândia',  tipo:'destino', uf:'PR', lat:-23.3103, lon:-51.3689, status:'online' },
  { id:'arapongas', nome:'Arapongas', tipo:'destino', uf:'PR', lat:-23.4194, lon:-51.4244, status:'online' },
  { id:'apucarana', nome:'Apucarana', tipo:'destino', uf:'PR', lat:-23.5510, lon:-51.4610, status:'online' },
  */
];
function monBase(){ return MON_LOCAIS.find(function(l){ return l.tipo==='base'; }) || MON_LOCAIS[0]; }
function monDestinos(){ return MON_LOCAIS.filter(function(l){ return l.tipo==='destino'; }); }
function monLocal(id){ return MON_LOCAIS.find(function(l){ return l.id===id; }); }

/* ==================================================================
   2) ROTAS — ligam a base aos destinos.
   `curva` é a folga lateral que faz a linha parecer uma via, e não um
   traço reto. Quando entrar a rota real, troca-se por `polyline`
   (lista de lat/lon) sem mexer no resto do componente.
   ================================================================== */
const MON_ROTAS = [
  { id:'r-cambe',    de:'londrina', para:'cambe',    curva:-18, status:'online',  rodovia:'PR-445' },
  { id:'r-maringa',  de:'londrina', para:'maringa',  curva: 18, status:'online',  rodovia:'BR-376' },
  { id:'r-paicandu', de:'londrina', para:'paicandu', curva: 76, status:'atencao', rodovia:'PR-323' },
  /* futuro: { id:'...', de:'londrina', para:'ibipora', polyline:[[lat,lon],[lat,lon],...] } */
];

/* ==================================================================
   3) PROJEÇÃO — lat/lon para o sistema de coordenadas do desenho.
   Hoje: projeção equiretangular normalizada à área das cidades.
   Preserva as relações geográficas (quem está a norte/sul/leste/oeste).
   ⚠️ Não é escala cartográfica: os eixos são normalizados separadamente
   para a região caber legível no espaço do card. Quando entrar o mapa
   real, só esta função muda.
   ================================================================== */
const MON_VB = { w:640, h:520, x0:92, x1:486, y0:146, y1:398 };
function monProjetar(loc){
  const lons=MON_LOCAIS.map(function(l){ return l.lon; }), lats=MON_LOCAIS.map(function(l){ return l.lat; });
  const loMin=Math.min.apply(null,lons), loMax=Math.max.apply(null,lons);
  const laMin=Math.min.apply(null,lats), laMax=Math.max.apply(null,lats);
  const dx=(loMax-loMin)||1, dy=(laMax-laMin)||1;
  const nx=(loc.lon-loMin)/dx;              // 0 = oeste, 1 = leste
  const ny=(loc.lat-laMin)/dy;              // 0 = sul,   1 = norte
  return { x: MON_VB.x0 + nx*(MON_VB.x1-MON_VB.x0),
           y: MON_VB.y1 - ny*(MON_VB.y1-MON_VB.y0) };   // y do SVG cresce para baixo
}
/* Caminho da rota: curva suave entre base e destino (ou polyline real, quando houver) */
function monCaminho(rota){
  const a=monProjetar(monLocal(rota.de)), b=monProjetar(monLocal(rota.para));
  if(rota.polyline && rota.polyline.length>1){
    const pts=rota.polyline.map(function(p){ const q=monProjetar({lat:p[0],lon:p[1]}); return q.x+' '+q.y; });
    return 'M'+pts.join(' L');
  }
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const vx=b.x-a.x, vy=b.y-a.y, len=Math.hypot(vx,vy)||1;
  const nx=-vy/len, ny=vx/len;                       // normal à reta
  const c=rota.curva||0;
  return 'M'+a.x+' '+a.y+' Q'+(mx+nx*c)+' '+(my+ny*c)+' '+b.x+' '+b.y;
}

/* ==================================================================
   4) PROVIDER — de onde vêm os veículos.
   Hoje: OfflineSimulationProvider (dados locais, sem rede).
   Amanhã: basta criar um GPSProvider com o mesmo formato de saída
   (listar() devolvendo os veículos com progresso 0..1) e apontar
   MonProvider para ele. A interface não muda.
   ================================================================== */
const OfflineSimulationProvider = {
  id:'offline-sim',
  rotulo:'Simulação local',
  tempoReal:false,                                  /* deixa claro que NÃO é GPS */
  iniciar: function(){ MonSim.montar(); },
  listar:  function(){ return MonSim.veiculos; },
  atualizar: function(dt){ MonSim.passo(dt); }
};
let MonProvider = OfflineSimulationProvider;

/* ==================================================================
   5) SIMULAÇÃO — só calcula. Não toca no DOM.
   Os veículos são os cavalos REAIS da frota e os motoristas REAIS do
   cadastro; o que é simulado é o deslocamento (posição/velocidade).
   ================================================================== */
const MonSim = {
  veiculos: [],
  montar: function(){
    const cavalos = (typeof iniCavalos==='function')? iniCavalos() : [];
    const motoristas = (DB.motoristas||[]).filter(function(m){ return m.status==='Ativo'; });
    const dest = monDestinos();
    if(!dest.length){ this.veiculos=[]; return; }
    /* distribui os veículos entre as rotas, começando em pontos diferentes */
    this.veiculos = cavalos.map(function(v, i){
      const rota = MON_ROTAS[i % MON_ROTAS.length];
      const mot  = motoristas[i % (motoristas.length||1)];
      return {
        id: 'mv'+i,
        placa: v.placa,
        modelo: ((v.marca||'')+' '+(v.modelo||'')).trim() || 'Cavalo',
        veiculoId: v.id,
        motorista: mot? mot.nome : '—',
        rotaId: rota.id,
        destino: rota.para,
        progresso: (i*0.23 + 0.12) % 0.9,             /* 0..1 ao longo da rota */
        sentido: (i % 3 === 0) ? -1 : 1,              /* alguns voltando para a base */
        velocidade: 62 + (i*7) % 26,                  /* km/h */
        parado: 0,                                     /* segundos restantes em pátio */
        ang: null,                                     /* ângulo suavizado (render) */
        status: (i % 3 === 0) ? 'retornando' : 'transito'
      };
    });
  },
  /* dt em segundos. Avança o progresso conforme a velocidade.
     Ao chegar na ponta o veículo PARA alguns segundos (carga/descarga) e só
     então inverte o sentido — evita o giro brusco de 180° em movimento. */
  passo: function(dt){
    const escala = 0.0009;                            /* ritmo agradável no card */
    this.veiculos.forEach(function(m){
      if(m.parado>0){                                  /* em pátio: conta o tempo e sai */
        m.parado-=dt;
        if(m.parado<=0){ m.parado=0; m.sentido=-m.sentido;
          m.status = m.sentido>0? 'transito' : 'retornando'; }
        return;
      }
      m.progresso += m.sentido * m.velocidade * escala * dt;
      if(m.progresso>=1){ m.progresso=1; m.parado=4+Math.random()*3; m.status='parado'; }
      else if(m.progresso<=0){ m.progresso=0; m.parado=4+Math.random()*3; m.status='parado'; }
      /* variação leve e contínua de velocidade (sem saltos) */
      m.velocidade += Math.sin((Date.now()/9000)+m.progresso*6)*0.06;
      m.velocidade = Math.max(48, Math.min(92, m.velocidade));
    });
  },
  /* Quantos veículos estão indo para cada destino (usado nos tooltips) */
  porDestino: function(id){ return this.veiculos.filter(function(m){ return m.destino===id; }).length; },
  /* ETA usando o relógio REAL do sistema */
  eta: function(m){
    const restante = (m.sentido>0? (1-m.progresso) : m.progresso);
    const minutos = Math.max(1, Math.round(restante * 95));   /* trecho ~95 min cheio */
    const d = new Date(Date.now() + minutos*60000);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
};

/* ==================================================================
   6) DESENHO — monta o SVG em camadas. Só desenha; não simula.
   Camadas: fundo → grid → textura → rotas → cidades → veículos
            → status → informações
   ================================================================== */
function monMapaHTML(){
  const base=monBase(), bp=monProjetar(base);

  /* ---- camada 4: rotas ---- */
  const rotasSVG = MON_ROTAS.map(function(r){
    const d=monCaminho(r);
    return '<g class="mon-rota mon-st-'+r.status+'" data-rota="'+r.id+'">'
      +'<path class="mon-via-base" d="'+d+'"/>'
      +'<path class="mon-via" id="'+r.id+'" d="'+d+'"/>'
      +'<path class="mon-via-fluxo" d="'+d+'"/>'
      +'</g>';
  }).join('');

  /* rótulo discreto da rodovia, no meio de cada rota */
  const rodoviasSVG = MON_ROTAS.map(function(r){
    if(!r.rodovia) return '';
    const a=monProjetar(monLocal(r.de)), b=monProjetar(monLocal(r.para));
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const vx=b.x-a.x, vy=b.y-a.y, len=Math.hypot(vx,vy)||1;
    const x=mx+(-vy/len)*((r.curva||0)*0.5), y=my+(vx/len)*((r.curva||0)*0.5);
    return '<g class="mon-rod" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')">'
      +'<rect x="-24" y="-8" width="48" height="16" rx="5"/><text y="3.6" text-anchor="middle">'+esc(r.rodovia)+'</text></g>';
  }).join('');

  /* ---- camada 5: cidades (destinos) ---- */
  /* O rótulo é colocado do lado OPOSTO à base: assim cidades vizinhas
     (Cambé fica a 13 km de Londrina) nunca sobrepõem o nome da base. */
  const cidadesSVG = monDestinos().map(function(c){
    const p=monProjetar(c);
    let vx=p.x-bp.x, vy=p.y-bp.y; const d=Math.hypot(vx,vy)||1;
    vx/=d; vy/=d;
    let lx=Math.round(vx*17), ly=Math.round(vy*17)+(vy<0? -8 : 14);
    /* não deixa o texto escapar da área visível */
    if(p.y+ly<26) ly=26-p.y; if(p.y+ly>MON_VB.h-14) ly=MON_VB.h-14-p.y;
    const anc = lx<-6? 'end' : (lx>6? 'start' : 'middle');
    return '<g class="mon-cidade" data-local="'+c.id+'" transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')" tabindex="0">'
      +'<circle class="mon-c-hit" r="26"/>'
      +'<circle class="mon-c-pulso" r="11"/>'
      +'<circle class="mon-c-halo" r="8"/>'
      +'<circle class="mon-c-dot" r="3.6"/>'
      +'<text class="mon-c-nome" x="'+lx+'" y="'+ly+'" text-anchor="'+anc+'">'+esc(c.nome.toUpperCase())+'</text>'
      +'</g>';
  }).join('');

  /* ---- camada 5b: BASE (Londrina) — presença, sem radar exagerado ---- */
  const baseSVG =
    '<g class="mon-base" data-local="'+base.id+'" transform="translate('+bp.x.toFixed(1)+','+bp.y.toFixed(1)+')" tabindex="0">'
    +'<circle class="mon-b-hit" r="34"/>'
    +'<circle class="mon-b-aura" r="26"/>'
    +'<circle class="mon-b-anel" r="15"/>'
    +'<path class="mon-b-marca" d="M0 -9.5 L8.2 -4.8 L8.2 4.8 L0 9.5 L-8.2 4.8 L-8.2 -4.8 Z"/>'
    +'<circle class="mon-b-nucleo" r="3.4"/>'
    +'<text class="mon-b-nome" y="34" text-anchor="middle">'+esc(base.nome.toUpperCase())+'</text>'
    +'<text class="mon-b-sub"  y="48" text-anchor="middle">BASE OPERACIONAL</text>'
    +'</g>';

  /* ---- camada 6: veículos (posicionados pelo motor, via transform) ---- */
  const veics = MonProvider.listar();
  const veicSVG = veics.map(function(m){
    return '<g class="mon-veic" id="mv-'+m.id+'" data-veic="'+m.id+'" tabindex="0">'
      +'<circle class="mon-v-halo" r="11"/>'
      +'<g class="mon-v-ico"><rect class="mon-v-body" x="-7.5" y="-3.9" width="11" height="7.8" rx="2.1"/>'
      +'<rect class="mon-v-cab" x="3.4" y="-3.2" width="5.4" height="6.4" rx="1.5"/>'
      +'<rect class="mon-v-far" x="8.4" y="-1.9" width="1.6" height="3.8" rx=".8"/></g>'
      +'</g>';
  }).join('');

  return ''
  +'<svg viewBox="0 0 '+MON_VB.w+' '+MON_VB.h+'" preserveAspectRatio="xMidYMid meet" class="mon-svg" id="monSvg">'
  +'<defs>'
    +'<pattern id="monHex" width="36" height="31" patternUnits="userSpaceOnUse">'
      +'<path d="M18 0 L36 9 L36 22 L18 31 L0 22 L0 9 Z" fill="none" stroke="rgba(120,190,235,.05)" stroke-width="1"/></pattern>'
    +'<linearGradient id="monVia" x1="0" y1="0" x2="1" y2="0">'
      +'<stop offset="0" stop-color="#2fd8d0"/><stop offset="1" stop-color="#2f7fd8"/></linearGradient>'
    +'<radialGradient id="monBaseAura" cx="50%" cy="50%" r="50%">'
      +'<stop offset="0" stop-color="rgba(60,200,220,.20)"/><stop offset="1" stop-color="rgba(60,200,220,0)"/></radialGradient>'
    +'<filter id="monSoft" x="-40%" y="-40%" width="180%" height="180%">'
      +'<feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
  +'</defs>'
  /* camada 1+2+3: fundo, grid geográfico e textura */
  +'<rect class="mon-fundo" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'"/>'
  +'<g class="mon-grid">'
    + [130,215,300,385,470].map(function(y){ return '<line x1="0" y1="'+y+'" x2="'+MON_VB.w+'" y2="'+y+'"/>'; }).join('')
    + [110,215,320,425,530].map(function(x){ return '<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+MON_VB.h+'"/>'; }).join('')
  +'</g>'
  +'<rect class="mon-hex" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'" fill="url(#monHex)"/>'
  /* grupo que recebe zoom/centralização */
  +'<g id="monZoom" class="mon-zoom">'
    + rotasSVG + rodoviasSVG + baseSVG + cidadesSVG + veicSVG
  +'</g>'
  +'</svg>';
}

/* ==================================================================
   7) LOOP — simulação e desenho, separados, num único rAF.
   Pausa sozinho quando a aba/tela não está visível (performance).
   ================================================================== */
let _monRAF=null, _monT0=0, _monAcc=0, _monPaths={}, _monLens={};
function monIniciar(){
  monParar();
  const svg=document.getElementById('monSvg'); if(!svg) return;
  MonProvider.iniciar();
  /* cache dos caminhos (evita recalcular a cada quadro) */
  _monPaths={}; _monLens={};
  MON_ROTAS.forEach(function(r){
    const p=document.getElementById(r.id);
    if(p){ _monPaths[r.id]=p; try{ _monLens[r.id]=p.getTotalLength(); }catch(e){ _monLens[r.id]=0; } }
  });
  monPintarInfo();
  _monT0=0; _monAcc=0;
  const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function quadro(ts){
    if(!document.getElementById('monSvg')){ monParar(); return; }
    if(!_monT0) _monT0=ts;
    let dt=(ts-_monT0)/1000; _monT0=ts;
    if(dt>0.5) dt=0.5;                                  /* aba voltou do segundo plano */
    if(!document.hidden && !reduz){
      MonProvider.atualizar(dt);                        /* simula */
      monRender();                                      /* desenha */
      _monAcc+=dt; if(_monAcc>=5){ _monAcc=0; monPintarInfo(); }   /* status a cada 5s */
    }
    _monRAF=requestAnimationFrame(quadro);
  }
  monRender();
  _monRAF=requestAnimationFrame(quadro);
}
function monParar(){ if(_monRAF){ cancelAnimationFrame(_monRAF); _monRAF=null; } }

/* Desenho por quadro: só transform (barato e acelerado por GPU) */
function monRender(){
  MonProvider.listar().forEach(function(m){
    const g=document.getElementById('mv-'+m.id); if(!g) return;
    const path=_monPaths[m.rotaId], len=_monLens[m.rotaId];
    if(!path || !len) return;
    let pt, alvo=0;
    try{
      pt=path.getPointAtLength(len*Math.max(0,Math.min(1,m.progresso)));
      const p2=path.getPointAtLength(len*Math.max(0,Math.min(1,m.progresso+0.012*m.sentido)));
      alvo=Math.atan2(p2.y-pt.y, p2.x-pt.x)*180/Math.PI;
    }catch(e){ return; }
    /* gira suave até o ângulo novo, pelo caminho mais curto (nada de saltos) */
    if(m.ang==null){ m.ang=alvo; }
    else {
      let dif=((alvo-m.ang+540)%360)-180;
      m.ang += dif*0.12;
      if(m.ang>180) m.ang-=360; else if(m.ang<-180) m.ang+=360;
    }
    g.setAttribute('transform','translate('+pt.x.toFixed(2)+','+pt.y.toFixed(2)+') rotate('+m.ang.toFixed(1)+')');
    if(m.status==='parado') g.classList.add('parado'); else g.classList.remove('parado');
  });
}

/* ==================================================================
   8) INFORMAÇÕES DE STATUS — números reais da operação simulada,
   com a hora do relógio REAL do sistema.
   ================================================================== */
function monPintarInfo(){
  const vs=MonProvider.listar();
  const emTransito=vs.filter(function(m){ return m.status==='transito'||m.status==='retornando'; }).length;
  const rotasAtivas=MON_ROTAS.filter(function(r){ return vs.some(function(m){ return m.rotaId===r.id; }); }).length;
  const set=function(id,txt){ const e=document.getElementById(id); if(e) e.textContent=txt; };
  set('monKvA', vs.length);
  set('monKvB', emTransito);
  set('monKvC', monDestinos().length);
  set('monKvD', rotasAtivas);
  const d=new Date();
  set('monSync', String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'));
}

/* ==================================================================
   9) TOOLTIPS — painel flutuante pequeno (veículo e cidade).
   Desktop: mouse. Mobile: toque.
   ================================================================== */
function monTipHTML(){
  return '<div class="mon-tip" id="monTip" aria-hidden="true"></div>';
}
function _monTipMostrar(html, alvo){
  const tip=document.getElementById('monTip'), wrap=document.getElementById('monMapa');
  if(!tip||!wrap||!alvo) return;
  tip.innerHTML=html; tip.classList.add('show');
  const rw=wrap.getBoundingClientRect(), ra=alvo.getBoundingClientRect();
  let x=ra.left-rw.left+ra.width/2-tip.offsetWidth/2;
  let y=ra.top-rw.top-tip.offsetHeight-12;
  if(y<6){ y=ra.top-rw.top+ra.height+12; }                     /* não sai por cima */
  x=Math.max(8, Math.min(rw.width-tip.offsetWidth-8, x));
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function monTipEsconder(){ const t=document.getElementById('monTip'); if(t) t.classList.remove('show'); }

function monTipVeiculo(id, alvo){
  const m=MonProvider.listar().find(function(v){ return v.id===id; }); if(!m) return;
  const dest=monLocal(m.destino);
  const rot={transito:'EM VIAGEM', retornando:'RETORNANDO À BASE', parado:'PARADO'}[m.status]||'EM VIAGEM';
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(m.modelo)+'</b><span class="mon-tip-plate">'+esc(m.placa)+'</span></div>'
   +'<div class="mon-tip-g">'
     +'<span><small>Motorista</small><b>'+esc(m.motorista)+'</b></span>'
     +'<span><small>Destino</small><b>'+esc(m.sentido>0? (dest?dest.nome:'—') : monBase().nome)+'</b></span>'
     +'<span><small>Velocidade</small><b>'+Math.round(m.velocidade)+' km/h</b></span>'
     +'<span><small>Previsão</small><b>'+MonSim.eta(m)+'</b></span>'
   +'</div>'
   +'<div class="mon-tip-f"><i class="mon-dot ok"></i>'+rot+'<span class="mon-tip-sim">dados simulados</span></div>', alvo);
}
function monTipCidade(id, alvo){
  const c=monLocal(id); if(!c) return;
  const n=MonSim.porDestino(id);
  const d=new Date();
  const hora=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  const ehBase=c.tipo==='base';
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(c.nome.toUpperCase())+'</b><span class="mon-tip-plate">'+esc(c.uf||'')+'</span></div>'
   +'<div class="mon-tip-sub">'+(ehBase?'Base operacional':'Destino operacional')+'</div>'
   +'<div class="mon-tip-g">'
     +'<span><small>'+(ehBase?'Frota monitorada':'Em trânsito')+'</small><b>'+(ehBase? MonProvider.listar().length : n)+' veículo(s)</b></span>'
     +'<span><small>Atualização</small><b>'+hora+'</b></span>'
   +'</div>'
   +'<div class="mon-tip-f"><i class="mon-dot ok"></i>'+String(c.status||'online').toUpperCase()+'</div>', alvo);
}

/* Liga os eventos (mouse no desktop, toque no celular) */
function monLigarEventos(){
  const svg=document.getElementById('monSvg'); if(!svg) return;
  svg.querySelectorAll('.mon-veic').forEach(function(g){
    const id=g.getAttribute('data-veic');
    const abrir=function(){ monTipVeiculo(id, g); };
    g.addEventListener('mouseenter', abrir);
    g.addEventListener('focus', abrir);
    g.addEventListener('mouseleave', monTipEsconder);
    g.addEventListener('blur', monTipEsconder);
    g.addEventListener('click', function(e){ e.stopPropagation(); abrir();
      const m=MonProvider.listar().find(function(v){ return v.id===id; });
      if(m && typeof iniAbrirVeic==='function') iniAbrirVeic(m.placa);       /* mantém o painel lateral de antes */
    });
  });
  svg.querySelectorAll('.mon-cidade, .mon-base').forEach(function(g){
    const id=g.getAttribute('data-local');
    const abrir=function(){ monTipCidade(id, g); };
    g.addEventListener('mouseenter', abrir);
    g.addEventListener('focus', abrir);
    g.addEventListener('mouseleave', monTipEsconder);
    g.addEventListener('blur', monTipEsconder);
    g.addEventListener('click', function(e){ e.stopPropagation(); abrir(); });
  });
  svg.addEventListener('click', function(e){ if(e.target===svg) monTipEsconder(); });
}

/* ==================================================================
   10) CONTROLES — zoom e centralização na base
   ================================================================== */
let _monZoom=1;
function monZoom(d, reset){
  _monZoom = reset? 1 : Math.max(1, Math.min(2.6, _monZoom + d));
  monCentralizar();
}
/* Centraliza na base (amanhã: centralizar em veículo ou em rota) */
function monCentralizar(alvo){
  const g=document.getElementById('monZoom'); if(!g) return;
  let p=monProjetar(monBase());
  if(alvo && alvo.tipo==='veiculo'){
    const m=MonProvider.listar().find(function(v){ return v.id===alvo.id; });
    const path=m&&_monPaths[m.rotaId];
    if(path){ try{ const q=path.getPointAtLength(_monLens[m.rotaId]*m.progresso); p={x:q.x,y:q.y}; }catch(e){} }
  } else if(alvo && alvo.tipo==='local'){
    const l=monLocal(alvo.id); if(l) p=monProjetar(l);
  }
  g.style.transformOrigin=p.x+'px '+p.y+'px';
  g.style.transform='scale('+_monZoom+')';
  monTipEsconder();
}
/* Alterna a camada de textura/grid (botão "camadas") */
let _monCamadas=true;
function monCamadas(){
  _monCamadas=!_monCamadas;
  const svg=document.getElementById('monSvg'); if(svg) svg.classList.toggle('sem-textura', !_monCamadas);
}

/* ==================================================================
   11) BLOCO COMPLETO — é o que a tela Início insere no card
   ================================================================== */
function monComponenteHTML(){
  const nDest=monDestinos().length;
  return ''
  +'<div class="pex-map mon-wrap" id="monMapa">'
    + monMapaHTML()
    /* informações contextuais, discretas */
    +'<div class="mon-stats">'
      +'<span><b id="monKvA">0</b>veículos ativos</span>'
      +'<span><b id="monKvB">0</b>em trânsito</span>'
      +'<span><b id="monKvC">'+nDest+'</b>destinos</span>'
      +'<span><b id="monKvD">0</b>rotas ativas</span>'
    +'</div>'
    /* legenda */
    +'<div class="mon-legenda">'
      +'<span><i class="mon-dot ok"></i>Online</span>'
      +'<span><i class="mon-dot go"></i>Em trânsito</span>'
      +'<span><i class="mon-dot wa"></i>Atenção</span>'
    +'</div>'
    /* sensor de atividade + aviso honesto de que é simulação */
    +'<div class="mon-sync"><i></i>SINCRONIZADO <b id="monSync">--:--:--</b>'
      +'<span class="mon-fonte" title="Sem rastreador conectado: o deslocamento é simulado no próprio aparelho">'+esc(MonProvider.rotulo)+'</span></div>'
    /* controles */
    +'<div class="mon-ctrls no-print">'
      +'<button class="mon-ctl" onclick="monZoom(.3)" title="Aproximar" aria-label="Aproximar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(-.3)" title="Afastar" aria-label="Afastar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(0,true)" title="Centralizar na base" aria-label="Centralizar na base"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>'
      +'<button class="mon-ctl" onclick="monCamadas()" title="Camadas" aria-label="Camadas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/></svg></button>'
    +'</div>'
    + monTipHTML()
    +'<aside class="ini-vpanel" id="iniVeicPanel"></aside>'
  +'</div>';
}
/* Chamado depois que a Início é desenhada */
function monMontar(){
  if(!document.getElementById('monSvg')) return;
  _monZoom=1;
  monIniciar();
  monLigarEventos();
}
