/* ==================================================================
   MONITORAMENTO OPERACIONAL — Planeta Express
   ------------------------------------------------------------------
   Componente do card "Monitoramento" da tela Início.
   Mesmo tamanho e mesma posição de sempre: só o miolo mudou.

   Camadas separadas de propósito, para trocar a simulação por GPS
   real mexendo em UM objeto só:

     MON_LOCAIS   -> cidades com lat/lon reais
     MON_VIAS     -> malha viária (rodovia = sequência de cidades)
     MON_ROTAS    -> rotas operacionais (seguem a malha)
     monProjetar  -> lat/lon -> x,y   (o mapa real mexe só aqui)
     MonProvider  -> de onde vêm os veículos (hoje simulação local)
     MonSim       -> simula (não desenha)
     monRender    -> desenha (não simula)

   100% offline: SVG + CSS + JavaScript, sem biblioteca e sem rede.

   ⚠️ IMPORTANTE: o sistema NÃO sabe qual motorista está em qual
   veículo (isso exigiria apontamento de viagem ou rastreador). Por
   isso o mapa mostra SOMENTE A PLACA do cavalo — nunca um nome
   associado por adivinhação.
   ================================================================== */

/* ==================================================================
   1) LOCAIS — coordenadas do centro urbano de cada município (WGS84).
   `base`      = origem da operação
   `destino`   = destino operacional (tem rota e veículos)
   `referencia`= só contexto no mapa (não é destino)
   Para promover uma cidade a destino: troque `referencia` por
   `destino` e acrescente a rota em MON_ROTAS.
   ================================================================== */
const MON_LOCAIS = [
  { id:'londrina',  nome:'Londrina',   tipo:'base',       uf:'PR', lat:-23.3103, lon:-51.1628, status:'online' },
  { id:'cambe',     nome:'Cambé',      tipo:'destino',    uf:'PR', lat:-23.2758, lon:-51.2783, status:'online' },
  { id:'maringa',   nome:'Maringá',    tipo:'destino',    uf:'PR', lat:-23.4253, lon:-51.9386, status:'online' },
  { id:'paicandu',  nome:'Paiçandu',   tipo:'destino',    uf:'PR', lat:-23.4553, lon:-52.0475, status:'online' },
  /* contexto geográfico — cidades do corredor da BR-369 e arredores */
  { id:'rolandia',  nome:'Rolândia',   tipo:'referencia', uf:'PR', lat:-23.3103, lon:-51.3689 },
  { id:'arapongas', nome:'Arapongas',  tipo:'referencia', uf:'PR', lat:-23.4194, lon:-51.4244 },
  { id:'apucarana', nome:'Apucarana',  tipo:'referencia', uf:'PR', lat:-23.5510, lon:-51.4610 },
  { id:'jandaia',   nome:'Jandaia do Sul', tipo:'referencia', uf:'PR', lat:-23.6017, lon:-51.6428 },
  { id:'mandaguari',nome:'Mandaguari', tipo:'referencia', uf:'PR', lat:-23.5461, lon:-51.6708 },
  { id:'marialva',  nome:'Marialva',   tipo:'referencia', uf:'PR', lat:-23.4847, lon:-51.7919 },
  { id:'sarandi',   nome:'Sarandi',    tipo:'referencia', uf:'PR', lat:-23.4441, lon:-51.8761 },
  { id:'ibipora',   nome:'Ibiporã',    tipo:'referencia', uf:'PR', lat:-23.2694, lon:-51.0480 },
  { id:'jataizinho',nome:'Jataizinho', tipo:'referencia', uf:'PR', lat:-23.2553, lon:-50.9750 },
  { id:'sertanopolis',nome:'Sertanópolis', tipo:'referencia', uf:'PR', lat:-23.0578, lon:-51.0378 },
  { id:'belavista', nome:'Bela Vista do Paraíso', tipo:'referencia', uf:'PR', lat:-22.9944, lon:-51.1936 },
];
function monBase(){ return MON_LOCAIS.find(function(l){ return l.tipo==='base'; }) || MON_LOCAIS[0]; }
function monDestinos(){ return MON_LOCAIS.filter(function(l){ return l.tipo==='destino'; }); }
function monReferencias(){ return MON_LOCAIS.filter(function(l){ return l.tipo==='referencia'; }); }
function monLocal(id){ return MON_LOCAIS.find(function(l){ return l.id===id; }); }

/* Distância real entre dois pontos (Haversine, em km) — usada nas
   rotas, nos tooltips e no cálculo de previsão de chegada. */
function monDistKm(a, b){
  const R=6371, r=Math.PI/180;
  const dLat=(b.lat-a.lat)*r, dLon=(b.lon-a.lon)*r;
  const s=Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}

/* ==================================================================
   2) MALHA VIÁRIA — cada rodovia é a sequência real de cidades por
   onde ela passa. Assim a linha do mapa segue o traçado verdadeiro
   (e não uma curva inventada).
   ================================================================== */
const MON_VIAS = [
  { id:'br369-o', nome:'BR-369', cidades:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa'] },
  { id:'pr323',   nome:'PR-323', cidades:['maringa','paicandu'] },
  { id:'br369-l', nome:'BR-369', cidades:['londrina','ibipora','jataizinho'] },
  { id:'pr170',   nome:'PR-170', cidades:['londrina','belavista'] },
  { id:'pr218',   nome:'PR-218', cidades:['ibipora','sertanopolis'] },
];

/* ==================================================================
   3) ROTAS OPERACIONAIS — seguem a malha viária.
   `via` lista os trechos percorridos; a geometria sai daí.
   Quando entrar o rastreador, troca-se por polyline real do GPS.
   ================================================================== */
const MON_ROTAS = [
  { id:'r-cambe',    de:'londrina', para:'cambe',
    caminho:['londrina','cambe'], rodovia:'BR-369', status:'online' },
  { id:'r-maringa',  de:'londrina', para:'maringa',
    caminho:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa'],
    rodovia:'BR-369', status:'online' },
  { id:'r-paicandu', de:'londrina', para:'paicandu',
    caminho:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa','paicandu'],
    rodovia:'BR-369 / PR-323', status:'atencao' },
];
/* Distância real da rota, somando trecho a trecho */
function monRotaKm(rota){
  let km=0;
  for(let i=0;i<rota.caminho.length-1;i++) km+=monDistKm(monLocal(rota.caminho[i]), monLocal(rota.caminho[i+1]));
  return km;
}

/* ==================================================================
   4) PROJEÇÃO — lat/lon para o desenho, com ESCALA UNIFORME.
   A longitude é corrigida pelo cosseno da latitude, então as
   distâncias e direções ficam proporcionais às reais: o mapa é
   geograficamente fiel (não é um esquema esticado).
   Quando entrar o mapa real, só esta função muda.
   ================================================================== */
const MON_VB = { w:640, h:520 };
let _monProj=null;
function monCalcProjecao(){
  const lats=MON_LOCAIS.map(function(l){ return l.lat; });
  const lons=MON_LOCAIS.map(function(l){ return l.lon; });
  const laMin=Math.min.apply(null,lats), laMax=Math.max.apply(null,lats);
  const loMin=Math.min.apply(null,lons), loMax=Math.max.apply(null,lons);
  const latMed=(laMin+laMax)/2, k=Math.cos(latMed*Math.PI/180);   /* achatamento real da longitude */
  const larg=(loMax-loMin)*k, alt=(laMax-laMin);
  const pad=64;
  const esc=Math.min((MON_VB.w-pad*2)/(larg||1), (MON_VB.h-pad*2-40)/(alt||1));   /* MESMA escala nos 2 eixos */
  const cx=MON_VB.w/2, cy=MON_VB.h/2;
  _monProj={ loMin:loMin, loMax:loMax, laMin:laMin, laMax:laMax, k:k, esc:esc, cx:cx, cy:cy,
             loMed:(loMin+loMax)/2, laMed:latMed };
  return _monProj;
}
function monProjetar(loc){
  const p=_monProj||monCalcProjecao();
  return { x: p.cx + (loc.lon-p.loMed)*p.k*p.esc,
           y: p.cy - (loc.lat-p.laMed)*p.esc };      /* y do SVG cresce para baixo */
}
/* Quantos pixels vale 1 km (para a barra de escala e os anéis de raio) */
function monPxPorKm(){
  const p=_monProj||monCalcProjecao();
  return p.esc/111.32;                                /* 1 grau de latitude ~ 111,32 km */
}
/* Caminho suavizado passando pelas cidades da rota (curva de Catmull-Rom) */
function monCaminhoDe(ids){
  const pts=ids.map(function(id){ return monProjetar(monLocal(id)); });
  if(pts.length<2) return '';
  if(pts.length===2) return 'M'+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1)+' L'+pts[1].x.toFixed(1)+' '+pts[1].y.toFixed(1);
  let d='M'+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||pts[i+1];
    const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
    d+=' C'+c1x.toFixed(1)+' '+c1y.toFixed(1)+' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+' '+p2.x.toFixed(1)+' '+p2.y.toFixed(1);
  }
  return d;
}
function monCaminho(rota){ return monCaminhoDe(rota.caminho); }

/* ==================================================================
   5) PROVIDER — de onde vêm os veículos.
   Hoje: OfflineSimulationProvider (local, sem rede).
   Amanhã: um GPSProvider com a mesma interface entra no lugar.
   ================================================================== */
const OfflineSimulationProvider = {
  id:'offline-sim',
  rotulo:'Simulação local',
  tempoReal:false,
  iniciar: function(){ MonSim.montar(); },
  listar:  function(){ return MonSim.veiculos; },
  atualizar: function(dt){ MonSim.passo(dt); }
};
let MonProvider = OfflineSimulationProvider;

/* ==================================================================
   6) SIMULAÇÃO — só calcula. Não toca no DOM.
   Usa as PLACAS reais dos cavalos. Não inventa motorista: o sistema
   não tem como saber quem está dirigindo o quê.
   ================================================================== */
const MonSim = {
  veiculos: [],
  montar: function(){
    const cavalos=(typeof iniCavalos==='function')? iniCavalos() : [];
    if(!MON_ROTAS.length){ this.veiculos=[]; return; }
    this.veiculos = cavalos.map(function(v, i){
      const rota=MON_ROTAS[i % MON_ROTAS.length];
      return {
        id:'mv'+i,
        placa:v.placa,
        modelo:((v.marca||'')+' '+(v.modelo||'')).trim() || 'Cavalo',
        veiculoId:v.id,
        rotaId:rota.id,
        destino:rota.para,
        km:monRotaKm(rota),
        progresso:(i*0.23+0.12)%0.9,
        sentido:(i%3===0)? -1 : 1,
        velocidade:62+(i*7)%26,
        parado:0, ang:null,
        status:(i%3===0)? 'retornando' : 'transito'
      };
    });
  },
  /* dt em segundos. Ao chegar, para no pátio e só então inverte. */
  passo: function(dt){
    const escala=0.0009;
    this.veiculos.forEach(function(m){
      if(m.parado>0){
        m.parado-=dt;
        if(m.parado<=0){ m.parado=0; m.sentido=-m.sentido;
          m.status = m.sentido>0? 'transito' : 'retornando'; }
        return;
      }
      m.progresso += m.sentido*m.velocidade*escala*dt;
      if(m.progresso>=1){ m.progresso=1; m.parado=4+Math.random()*3; m.status='parado'; }
      else if(m.progresso<=0){ m.progresso=0; m.parado=4+Math.random()*3; m.status='parado'; }
      m.velocidade += Math.sin((Date.now()/9000)+m.progresso*6)*0.06;
      m.velocidade = Math.max(48, Math.min(92, m.velocidade));
    });
  },
  porDestino: function(id){ return this.veiculos.filter(function(m){ return m.destino===id; }).length; },
  /* Quilômetros que faltam, pela distância REAL da rota */
  restanteKm: function(m){
    const f=(m.sentido>0? (1-m.progresso) : m.progresso);
    return (m.km||0)*f;
  },
  /* Previsão de chegada com o relógio REAL do sistema */
  eta: function(m){
    if(m.status==='parado') return '—';
    const minutos=Math.max(1, Math.round(this.restanteKm(m)/Math.max(30,m.velocidade)*60));
    const d=new Date(Date.now()+minutos*60000);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
};

/* ==================================================================
   7) DESENHO — camadas, do fundo para a frente.
   1 fundo  2 grid de coordenadas  3 textura  4 anéis de raio
   5 malha viária  6 rotas  7 cidades de referência  8 destinos
   9 base  10 veículos  11 escala/bússola
   ================================================================== */
function monMapaHTML(){
  monCalcProjecao();
  const base=monBase(), bp=monProjetar(base), ppk=monPxPorKm();

  /* ---- 4: anéis de distância a partir da base (50 e 100 km reais) ---- */
  const aneis=[50,100].map(function(km){
    const r=km*ppk;
    return '<g class="mon-anel"><circle cx="'+bp.x.toFixed(1)+'" cy="'+bp.y.toFixed(1)+'" r="'+r.toFixed(1)+'"/>'
      +'<text x="'+bp.x.toFixed(1)+'" y="'+(bp.y-r+13).toFixed(1)+'" text-anchor="middle">'+km+' km</text></g>';
  }).join('');

  /* ---- 5: malha viária (fundo, discreta) ---- */
  const viasSVG=MON_VIAS.map(function(v){
    return '<path class="mon-malha" d="'+monCaminhoDe(v.cidades)+'"/>';
  }).join('');

  /* ---- 6: rotas operacionais ---- */
  const rotasSVG=MON_ROTAS.map(function(r){
    const d=monCaminho(r);
    return '<g class="mon-rota mon-st-'+r.status+'" data-rota="'+r.id+'">'
      +'<path class="mon-via-base" d="'+d+'"/>'
      +'<path class="mon-via" id="'+r.id+'" d="'+d+'"/>'
      +'<path class="mon-via-fluxo" d="'+d+'"/>'
      +'</g>';
  }).join('');

  /* rótulo da rodovia + distância REAL, no meio da rota mais longa de cada via */
  const rodSVG=MON_ROTAS.map(function(r){
    if(r.id==='r-paicandu') return '';                 /* evita rótulo repetido em cima do de Maringá */
    /* no MEIO da linha (entre os dois pontos centrais), nunca sobre uma cidade */
    const ids=r.caminho, i2=Math.max(1,Math.floor(ids.length/2));
    const a=monProjetar(monLocal(ids[i2-1])), b=monProjetar(monLocal(ids[i2]));
    const p={ x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
    const km=Math.round(monRotaKm(r));
    return '<g class="mon-rod" transform="translate('+(p.x).toFixed(1)+','+(p.y-21).toFixed(1)+')">'
      +'<rect x="-37" y="-9" width="74" height="18" rx="5"/>'
      +'<text y="4" text-anchor="middle">'+esc(r.rodovia)+' · '+km+' km</text></g>';
  }).join('');

  /* ---- 7: cidades de referência (pequenas, sem interação) ---- */
  const refSVG=monReferencias().map(function(c){
    const p=monProjetar(c);
    return '<g class="mon-ref" transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')">'
      +'<circle class="mon-r-dot" r="2.1"/>'
      +'<text class="mon-r-nome" x="0" y="-7" text-anchor="middle">'+esc(c.nome)+'</text></g>';
  }).join('');

  /* ---- 8: destinos operacionais ---- */
  const cidadesSVG=monDestinos().map(function(c,i){
    const p=monProjetar(c);
    let vx=p.x-bp.x, vy=p.y-bp.y; const d=Math.hypot(vx,vy)||1; vx/=d; vy/=d;
    let lx=Math.round(vx*16), ly=Math.round(vy*16)+(vy<0? -9 : 15);
    if(p.y+ly<24) ly=24-p.y; if(p.y+ly>MON_VB.h-12) ly=MON_VB.h-12-p.y;
    const anc = lx<-5? 'end' : (lx>5? 'start' : 'middle');
    const km=Math.round(monDistKm(base,c));
    return '<g class="mon-cidade" data-local="'+c.id+'" transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')" tabindex="0" style="--i:'+i+'">'
      +'<circle class="mon-c-hit" r="24"/>'
      +'<circle class="mon-c-pulso" r="10"/>'
      +'<circle class="mon-c-halo" r="7"/>'
      +'<circle class="mon-c-dot" r="3.4"/>'
      +'<text class="mon-c-nome" x="'+lx+'" y="'+ly+'" text-anchor="'+anc+'">'+esc(c.nome.toUpperCase())+'</text>'
      +'<text class="mon-c-km" x="'+lx+'" y="'+(ly+11)+'" text-anchor="'+anc+'">'+km+' km</text>'
      +'</g>';
  }).join('');

  /* ---- 9: base ---- */
  const baseSVG=
    '<g class="mon-base" data-local="'+base.id+'" transform="translate('+bp.x.toFixed(1)+','+bp.y.toFixed(1)+')" tabindex="0">'
    +'<circle class="mon-b-hit" r="32"/>'
    +'<circle class="mon-b-aura" r="24"/>'
    +'<circle class="mon-b-anel" r="14"/>'
    +'<path class="mon-b-marca" d="M0 -9 L7.8 -4.5 L7.8 4.5 L0 9 L-7.8 4.5 L-7.8 -4.5 Z"/>'
    +'<circle class="mon-b-nucleo" r="3.2"/>'
    +'<text class="mon-b-nome" y="32" text-anchor="middle">'+esc(base.nome.toUpperCase())+'</text>'
    +'<text class="mon-b-sub"  y="45" text-anchor="middle">BASE OPERACIONAL</text>'
    +'</g>';

  /* ---- 10: veículos (só a PLACA; nunca um motorista adivinhado) ---- */
  const veicSVG=MonProvider.listar().map(function(m){
    return '<g class="mon-veic" id="mv-'+m.id+'" data-veic="'+m.id+'" tabindex="0">'
      +'<circle class="mon-v-halo" r="10"/>'
      +'<g class="mon-v-ico">'
        +'<rect class="mon-v-body" x="-7.2" y="-3.7" width="10.6" height="7.4" rx="2"/>'
        +'<rect class="mon-v-cab" x="3.3" y="-3.1" width="5.2" height="6.2" rx="1.5"/>'
        +'<rect class="mon-v-far" x="8.2" y="-1.8" width="1.5" height="3.6" rx=".7"/>'
      +'</g>'
      +'<text class="mon-v-placa" y="-13" text-anchor="middle">'+esc(m.placa)+'</text>'
      +'</g>';
  }).join('');

  /* ---- 11: barra de escala real + bússola ---- */
  const esc50=(50*ppk);
  const escala='<g class="mon-escala" transform="translate(30,'+(MON_VB.h-30)+')">'
    +'<line x1="0" y1="0" x2="'+esc50.toFixed(1)+'" y2="0"/>'
    +'<line x1="0" y1="-4" x2="0" y2="4"/><line x1="'+esc50.toFixed(1)+'" y1="-4" x2="'+esc50.toFixed(1)+'" y2="4"/>'
    +'<text x="'+(esc50/2).toFixed(1)+'" y="-8" text-anchor="middle">50 km</text></g>';
  const bussola='<g class="mon-bussola" transform="translate('+(MON_VB.w-38)+',44)">'
    +'<circle r="15"/><path d="M0 -10 L4 3 L0 0 L-4 3 Z"/><text y="-17" text-anchor="middle">N</text></g>';

  /* grid de coordenadas (linhas de lat/lon inteiras da região) */
  const p=_monProj; let gridL='';
  for(let lo=Math.ceil(p.loMin*2)/2; lo<=p.loMax; lo+=0.5){
    const x=monProjetar({lat:p.laMed, lon:lo}).x;
    gridL+='<line x1="'+x.toFixed(1)+'" y1="0" x2="'+x.toFixed(1)+'" y2="'+MON_VB.h+'"/>';
  }
  for(let la=Math.ceil(p.laMin*4)/4; la<=p.laMax; la+=0.25){
    const y=monProjetar({lat:la, lon:p.loMed}).y;
    gridL+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+MON_VB.w+'" y2="'+y.toFixed(1)+'"/>';
  }

  return ''
  +'<svg viewBox="0 0 '+MON_VB.w+' '+MON_VB.h+'" preserveAspectRatio="xMidYMid meet" class="mon-svg" id="monSvg">'
  +'<defs>'
    +'<pattern id="monHex" width="36" height="31" patternUnits="userSpaceOnUse">'
      +'<path d="M18 0 L36 9 L36 22 L18 31 L0 22 L0 9 Z" fill="none" stroke="rgba(120,190,235,.045)" stroke-width="1"/></pattern>'
    +'<linearGradient id="monVia" x1="0" y1="0" x2="1" y2="0">'
      +'<stop offset="0" stop-color="#2fd8d0"/><stop offset="1" stop-color="#2f7fd8"/></linearGradient>'
    +'<radialGradient id="monBaseAura" cx="50%" cy="50%" r="50%">'
      +'<stop offset="0" stop-color="rgba(60,200,220,.20)"/><stop offset="1" stop-color="rgba(60,200,220,0)"/></radialGradient>'
    +'<linearGradient id="monVarre" x1="0" y1="0" x2="1" y2="0">'
      +'<stop offset="0" stop-color="rgba(90,220,235,0)"/><stop offset=".5" stop-color="rgba(90,220,235,.10)"/>'
      +'<stop offset="1" stop-color="rgba(90,220,235,0)"/></linearGradient>'
    +'<filter id="monSoft" x="-40%" y="-40%" width="180%" height="180%">'
      +'<feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
  +'</defs>'
  +'<rect class="mon-fundo" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'"/>'
  +'<g class="mon-grid">'+gridL+'</g>'
  +'<rect class="mon-hex" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'" fill="url(#monHex)"/>'
  +'<rect class="mon-varre" x="-260" y="0" width="260" height="'+MON_VB.h+'" fill="url(#monVarre)"/>'
  +'<g id="monZoom" class="mon-zoom">'
    + aneis + viasSVG + rotasSVG + rodSVG + refSVG + cidadesSVG + baseSVG + veicSVG
  +'</g>'
  + escala + bussola
  +'</svg>';
}

/* ==================================================================
   8) LOOP — simulação e desenho num único requestAnimationFrame.
   Pausa quando a aba está oculta ou quando o usuário sai da Início.
   ================================================================== */
let _monRAF=null, _monT0=0, _monAcc=0, _monPaths={}, _monLens={};
function monIniciar(){
  monParar();
  if(!document.getElementById('monSvg')) return;
  MonProvider.iniciar();
  _monPaths={}; _monLens={};
  MON_ROTAS.forEach(function(r){
    const el=document.getElementById(r.id);
    if(el){ _monPaths[r.id]=el; try{ _monLens[r.id]=el.getTotalLength(); }catch(e){ _monLens[r.id]=0; } }
  });
  monPintarInfo();
  _monT0=0; _monAcc=0;
  const reduz=window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function quadro(ts){
    if(!document.getElementById('monSvg')){ monParar(); return; }
    if(!_monT0) _monT0=ts;
    let dt=(ts-_monT0)/1000; _monT0=ts;
    if(dt>0.5) dt=0.5;
    if(!document.hidden && !reduz){
      MonProvider.atualizar(dt);
      monRender();
      _monAcc+=dt; if(_monAcc>=5){ _monAcc=0; monPintarInfo(); }
    }
    _monRAF=requestAnimationFrame(quadro);
  }
  monRender();
  _monRAF=requestAnimationFrame(quadro);
}
function monParar(){ if(_monRAF){ cancelAnimationFrame(_monRAF); _monRAF=null; } }

/* Só transform por quadro: barato e acelerado por GPU */
function monRender(){
  MonProvider.listar().forEach(function(m){
    const g=document.getElementById('mv-'+m.id); if(!g) return;
    const path=_monPaths[m.rotaId], len=_monLens[m.rotaId];
    if(!path||!len) return;
    let pt, alvo=0;
    try{
      const f=Math.max(0,Math.min(1,m.progresso));
      pt=path.getPointAtLength(len*f);
      const p2=path.getPointAtLength(len*Math.max(0,Math.min(1,f+0.008*m.sentido)));
      alvo=Math.atan2(p2.y-pt.y,p2.x-pt.x)*180/Math.PI;
    }catch(e){ return; }
    if(m.ang==null) m.ang=alvo;
    else { let dif=((alvo-m.ang+540)%360)-180; m.ang+=dif*0.12;
      if(m.ang>180) m.ang-=360; else if(m.ang<-180) m.ang+=360; }
    g.setAttribute('transform','translate('+pt.x.toFixed(2)+','+pt.y.toFixed(2)+')');
    const ico=g.querySelector('.mon-v-ico');
    if(ico) ico.setAttribute('transform','rotate('+m.ang.toFixed(1)+')');   /* só o ícone gira: a placa fica legível */
    if(m.status==='parado') g.classList.add('parado'); else g.classList.remove('parado');
  });
}

/* ==================================================================
   9) INFORMAÇÕES — números da operação + relógio real do sistema
   ================================================================== */
function monPintarInfo(){
  const vs=MonProvider.listar();
  const andando=vs.filter(function(m){ return m.status!=='parado'; }).length;
  const parados=vs.filter(function(m){ return m.status==='parado'; }).length;
  const kmTotal=Math.round(vs.reduce(function(s,m){ return s+MonSim.restanteKm(m); },0));
  const set=function(id,txt){ const e=document.getElementById(id); if(e) e.textContent=txt; };
  set('monKvA', vs.length);
  set('monKvB', andando);
  set('monKvC', parados);
  set('monKvD', monDestinos().length);
  set('monKvE', kmTotal+' km');
  const d=new Date();
  set('monSync', String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'));
}

/* ==================================================================
   10) TOOLTIPS — painel flutuante (veículo e cidade).
   No veículo NÃO aparece motorista: o sistema não sabe quem dirige.
   ================================================================== */
function monTipHTML(){ return '<div class="mon-tip" id="monTip" aria-hidden="true"></div>'; }
function _monTipMostrar(html, alvo){
  const tip=document.getElementById('monTip'), wrap=document.getElementById('monMapa');
  if(!tip||!wrap||!alvo) return;
  tip.innerHTML=html; tip.classList.add('show');
  const rw=wrap.getBoundingClientRect(), ra=alvo.getBoundingClientRect();
  let x=ra.left-rw.left+ra.width/2-tip.offsetWidth/2;
  let y=ra.top-rw.top-tip.offsetHeight-12;
  if(y<6) y=ra.top-rw.top+ra.height+12;
  x=Math.max(8, Math.min(rw.width-tip.offsetWidth-8, x));
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function monTipEsconder(){ const t=document.getElementById('monTip'); if(t) t.classList.remove('show'); }

function monTipVeiculo(id, alvo){
  const m=MonProvider.listar().find(function(v){ return v.id===id; }); if(!m) return;
  const rota=MON_ROTAS.find(function(r){ return r.id===m.rotaId; });
  const destino=m.sentido>0? monLocal(m.destino) : monBase();
  const rot={transito:'EM VIAGEM', retornando:'RETORNANDO À BASE', parado:'PARADO'}[m.status]||'EM VIAGEM';
  const cls={transito:'go', retornando:'go', parado:'wa'}[m.status]||'go';
  const pct=Math.round((m.sentido>0? m.progresso : 1-m.progresso)*100);
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(m.placa)+'</b><span class="mon-tip-plate">CAVALO</span></div>'
   +'<div class="mon-tip-sub">'+esc(m.modelo)+'</div>'
   +'<div class="mon-tip-g">'
     +'<span><small>Sentido</small><b>'+esc(destino? destino.nome : '—')+'</b></span>'
     +'<span><small>Velocidade</small><b>'+Math.round(m.velocidade)+' km/h</b></span>'
     +'<span><small>Faltam</small><b>'+Math.round(MonSim.restanteKm(m))+' km</b></span>'
     +'<span><small>Previsão</small><b>'+MonSim.eta(m)+'</b></span>'
   +'</div>'
   +'<div class="mon-tip-bar"><i style="width:'+pct+'%"></i></div>'
   +'<div class="mon-tip-rota">'+esc(rota? rota.rodovia : '')+' · '+Math.round(m.km)+' km no total</div>'
   +'<div class="mon-tip-f"><i class="mon-dot '+cls+'"></i>'+rot+'<span class="mon-tip-sim">posição simulada</span></div>', alvo);
}
function monTipCidade(id, alvo){
  const c=monLocal(id); if(!c) return;
  const base=monBase(), ehBase=c.tipo==='base';
  const n=MonSim.porDestino(id);
  const d=new Date();
  const hora=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  const km=ehBase? 0 : Math.round(monDistKm(base,c));
  const coord=Math.abs(c.lat).toFixed(4)+'° S · '+Math.abs(c.lon).toFixed(4)+'° O';
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(c.nome.toUpperCase())+'</b><span class="mon-tip-plate">'+esc(c.uf||'')+'</span></div>'
   +'<div class="mon-tip-sub">'+(ehBase?'Base operacional':'Destino operacional')+'</div>'
   +'<div class="mon-tip-g">'
     +'<span><small>'+(ehBase?'Frota':'Em trânsito')+'</small><b>'+(ehBase? MonProvider.listar().length : n)+' veículo(s)</b></span>'
     +'<span><small>'+(ehBase?'Rotas':'Distância')+'</small><b>'+(ehBase? MON_ROTAS.length : km+' km')+'</b></span>'
   +'</div>'
   +'<div class="mon-tip-rota">'+coord+'</div>'
   +'<div class="mon-tip-f"><i class="mon-dot ok"></i>ONLINE<span class="mon-tip-sim">'+hora+'</span></div>', alvo);
}

function monLigarEventos(){
  const mapa=document.getElementById('monSvg'); if(!mapa) return;
  mapa.querySelectorAll('.mon-veic').forEach(function(g){
    const id=g.getAttribute('data-veic');
    const abrir=function(){ monTipVeiculo(id,g); };
    g.addEventListener('mouseenter',abrir); g.addEventListener('focus',abrir);
    g.addEventListener('mouseleave',monTipEsconder); g.addEventListener('blur',monTipEsconder);
    g.addEventListener('click',function(e){ e.stopPropagation(); abrir();
      const m=MonProvider.listar().find(function(v){ return v.id===id; });
      if(m && typeof iniAbrirVeic==='function') iniAbrirVeic(m.placa);
    });
  });
  mapa.querySelectorAll('.mon-cidade, .mon-base').forEach(function(g){
    const id=g.getAttribute('data-local');
    const abrir=function(){ monTipCidade(id,g); };
    g.addEventListener('mouseenter',abrir); g.addEventListener('focus',abrir);
    g.addEventListener('mouseleave',monTipEsconder); g.addEventListener('blur',monTipEsconder);
    g.addEventListener('click',function(e){ e.stopPropagation(); abrir(); });
  });
  mapa.addEventListener('click',function(e){ if(e.target===mapa) monTipEsconder(); });
}

/* ==================================================================
   11) CONTROLES
   ================================================================== */
let _monZoom=1;
function monZoom(d, reset){ _monZoom=reset?1:Math.max(1,Math.min(2.8,_monZoom+d)); monCentralizar(); }
function monCentralizar(alvo){
  const g=document.getElementById('monZoom'); if(!g) return;
  let p=monProjetar(monBase());
  if(alvo && alvo.tipo==='veiculo'){
    const m=MonProvider.listar().find(function(v){ return v.id===alvo.id; });
    const path=m&&_monPaths[m.rotaId];
    if(path){ try{ const q=path.getPointAtLength(_monLens[m.rotaId]*m.progresso); p={x:q.x,y:q.y}; }catch(e){} }
  } else if(alvo && alvo.tipo==='local'){ const l=monLocal(alvo.id); if(l) p=monProjetar(l); }
  g.style.transformOrigin=p.x+'px '+p.y+'px';
  g.style.transform='scale('+_monZoom+')';
  monTipEsconder();
}
let _monCamada=0;   /* 0 = tudo · 1 = sem textura · 2 = mapa limpo */
function monCamadas(){
  _monCamada=(_monCamada+1)%3;
  const s=document.getElementById('monSvg'); if(!s) return;
  s.classList.toggle('sem-textura', _monCamada>=1);
  s.classList.toggle('sem-ref', _monCamada===2);
  if(typeof toast==='function') toast(['Todas as camadas','Sem textura de fundo','Somente rotas e destinos'][_monCamada]);
}

/* ==================================================================
   12) BLOCO COMPLETO — inserido no card da tela Início
   ================================================================== */
function monComponenteHTML(){
  return ''
  +'<div class="pex-map mon-wrap" id="monMapa">'
    + monMapaHTML()
    +'<div class="mon-stats">'
      +'<span><b id="monKvA">0</b>cavalos</span>'
      +'<span><b id="monKvB">0</b>em movimento</span>'
      +'<span><b id="monKvC">0</b>em pátio</span>'
      +'<span><b id="monKvD">0</b>destinos</span>'
      +'<span class="mon-stats-km"><b id="monKvE">0 km</b>a percorrer</span>'
    +'</div>'
    +'<div class="mon-legenda">'
      +'<span><i class="mon-dot ok"></i>Base</span>'
      +'<span><i class="mon-dot go"></i>Em trânsito</span>'
      +'<span><i class="mon-dot wa"></i>Atenção</span>'
    +'</div>'
    +'<div class="mon-sync"><i></i>SINCRONIZADO <b id="monSync">--:--:--</b>'
      +'<span class="mon-fonte" title="Sem rastreador conectado: a posição dos veículos é simulada neste aparelho">'+esc(MonProvider.rotulo)+'</span></div>'
    +'<div class="mon-ctrls no-print">'
      +'<button class="mon-ctl" onclick="monZoom(.35)" title="Aproximar" aria-label="Aproximar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(-.35)" title="Afastar" aria-label="Afastar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(0,true)" title="Centralizar na base" aria-label="Centralizar na base"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>'
      +'<button class="mon-ctl" onclick="monCamadas()" title="Camadas" aria-label="Camadas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/></svg></button>'
    +'</div>'
    + monTipHTML()
    +'<aside class="ini-vpanel" id="iniVeicPanel"></aside>'
  +'</div>';
}
function monMontar(){
  if(!document.getElementById('monSvg')) return;
  _monZoom=1;
  monIniciar();
  monLigarEventos();
}
