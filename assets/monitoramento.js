/* ==================================================================
   MONITORAMENTO OPERACIONAL — Planeta Express
   ------------------------------------------------------------------
   Componente do card "Monitoramento" da tela Início.
   Mesmo tamanho e mesma posição de sempre: só o miolo mudou.

     MON_LOCAIS   -> cidades com lat/lon reais
     MON_VIAS     -> malha viária (rodovia = sequência de cidades)
     MON_ROTAS    -> rotas operacionais (seguem a malha)
     monProjetar  -> lat/lon -> x,y   (o mapa real mexe só aqui)
     MonProvider  -> de onde vêm os veículos (hoje simulação local)
     MonSim       -> simula (não desenha)
     monRender    -> desenha (não simula)

   Funciona offline: SVG + CSS + JavaScript, sem biblioteca.
   O único extra que usa internet é a TEMPERATURA das cidades
   (Open-Meteo, mesma fonte do cockpit). Sem internet, o mapa
   funciona igual e a temperatura simplesmente não aparece.

   ⚠️ O sistema NÃO sabe qual motorista está em qual veículo. O mapa
   mostra SOMENTE A PLACA do cavalo — nunca um nome adivinhado.
   ================================================================== */

/* ==================================================================
   1) LOCAIS — coordenadas do centro urbano (WGS84)
   ================================================================== */
const MON_LOCAIS = [
  { id:'londrina',  nome:'Londrina',   tipo:'base',       uf:'PR', lat:-23.3103, lon:-51.1628, status:'online' },
  { id:'cambe',     nome:'Cambé',      tipo:'destino',    uf:'PR', lat:-23.2758, lon:-51.2783, status:'online' },
  { id:'maringa',   nome:'Maringá',    tipo:'destino',    uf:'PR', lat:-23.4253, lon:-51.9386, status:'online' },
  { id:'paicandu',  nome:'Paiçandu',   tipo:'destino',    uf:'PR', lat:-23.4553, lon:-52.0475, status:'online' },
  /* contexto geográfico — corredor da BR-369 e arredores */
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

function monDistKm(a, b){
  const R=6371, r=Math.PI/180;
  const dLat=(b.lat-a.lat)*r, dLon=(b.lon-a.lon)*r;
  const s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}

/* ==================================================================
   2) MALHA VIÁRIA e 3) ROTAS
   ================================================================== */
const MON_VIAS = [
  { id:'br369-o', nome:'BR-369', cidades:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa'] },
  { id:'pr323',   nome:'PR-323', cidades:['maringa','paicandu'] },
  { id:'br369-l', nome:'BR-369', cidades:['londrina','ibipora','jataizinho'] },
  { id:'pr170',   nome:'PR-170', cidades:['londrina','belavista'] },
  { id:'pr218',   nome:'PR-218', cidades:['ibipora','sertanopolis'] },
];
const MON_ROTAS = [
  { id:'r-cambe',    de:'londrina', para:'cambe', caminho:['londrina','cambe'], rodovia:'BR-369', status:'online' },
  { id:'r-maringa',  de:'londrina', para:'maringa',
    caminho:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa'],
    rodovia:'BR-369', status:'online' },
  { id:'r-paicandu', de:'londrina', para:'paicandu',
    caminho:['londrina','cambe','rolandia','arapongas','apucarana','jandaia','mandaguari','marialva','sarandi','maringa','paicandu'],
    rodovia:'BR-369 / PR-323', status:'atencao' },
];
function monRotaKm(rota){
  let km=0;
  for(let i=0;i<rota.caminho.length-1;i++) km+=monDistKm(monLocal(rota.caminho[i]), monLocal(rota.caminho[i+1]));
  return km;
}

/* ==================================================================
   4) PROJEÇÃO — escala uniforme (longitude corrigida por cos(lat)).
   O mapa PREENCHE a janela: o viewBox é largo e o fundo cobre tudo;
   as cidades ficam numa área central segura, então mesmo que as
   bordas sejam cortadas em telas estreitas nada some.
   ================================================================== */
/* O viewBox acompanha o FORMATO REAL do card: assim o mapa preenche a
   janela inteira sem cortar nada (nada de faixas vazias nem de cidade
   fora da área). monMedir() é chamado antes de desenhar. */
const MON_VB = { w:1000, h:580 };
const MON_AREA = { x0:220, x1:780, y0:150, y1:430 };
function monMedir(){
  const el=document.getElementById('monMapa');
  const r=el? el.getBoundingClientRect() : null;
  const razao=(r && r.width>40 && r.height>40)? (r.width/r.height) : 1.35;
  MON_VB.h=580;
  MON_VB.w=Math.round(580*Math.max(0.85, Math.min(2.6, razao)));
  /* área das cidades: 58% central da largura, deixando margem p/ os rótulos */
  MON_AREA.x0=Math.round(MON_VB.w*0.21);
  MON_AREA.x1=Math.round(MON_VB.w*0.79);
  _monProj=null;
}
let _monProj=null;
function monCalcProjecao(){
  const lats=MON_LOCAIS.map(function(l){ return l.lat; });
  const lons=MON_LOCAIS.map(function(l){ return l.lon; });
  const laMin=Math.min.apply(null,lats), laMax=Math.max.apply(null,lats);
  const loMin=Math.min.apply(null,lons), loMax=Math.max.apply(null,lons);
  const latMed=(laMin+laMax)/2, k=Math.cos(latMed*Math.PI/180);
  const larg=(loMax-loMin)*k, alt=(laMax-laMin);
  const esc=Math.min((MON_AREA.x1-MON_AREA.x0)/(larg||1), (MON_AREA.y1-MON_AREA.y0)/(alt||1));
  _monProj={ loMin, loMax, laMin, laMax, k, esc,
             cx:(MON_AREA.x0+MON_AREA.x1)/2, cy:(MON_AREA.y0+MON_AREA.y1)/2,
             loMed:(loMin+loMax)/2, laMed:latMed };
  return _monProj;
}
function monProjetar(loc){
  const p=_monProj||monCalcProjecao();
  return { x: p.cx + (loc.lon-p.loMed)*p.k*p.esc, y: p.cy - (loc.lat-p.laMed)*p.esc };
}
function monPxPorKm(){ return (_monProj||monCalcProjecao()).esc/111.32; }
function monCaminhoDe(ids){
  const pts=ids.map(function(id){ return monProjetar(monLocal(id)); });
  if(pts.length<2) return '';
  if(pts.length===2) return 'M'+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1)+' L'+pts[1].x.toFixed(1)+' '+pts[1].y.toFixed(1);
  let d='M'+pts[0].x.toFixed(1)+' '+pts[0].y.toFixed(1);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||pts[i+1];
    d+=' C'+(p1.x+(p2.x-p0.x)/6).toFixed(1)+' '+(p1.y+(p2.y-p0.y)/6).toFixed(1)
      +' '+(p2.x-(p3.x-p1.x)/6).toFixed(1)+' '+(p2.y-(p3.y-p1.y)/6).toFixed(1)
      +' '+p2.x.toFixed(1)+' '+p2.y.toFixed(1);
  }
  return d;
}
function monCaminho(rota){ return monCaminhoDe(rota.caminho); }

/* ==================================================================
   5) PROVIDER + 6) SIMULAÇÃO
   ================================================================== */
const OfflineSimulationProvider = {
  id:'offline-sim', rotulo:'Simulação local', tempoReal:false,
  iniciar: function(){ MonSim.montar(); },
  listar:  function(){ return MonSim.veiculos; },
  atualizar: function(dt){ MonSim.passo(dt); }
};
let MonProvider = OfflineSimulationProvider;

const MonSim = {
  veiculos: [],
  montar: function(){
    const cavalos=(typeof iniCavalos==='function')? iniCavalos() : [];
    if(!MON_ROTAS.length){ this.veiculos=[]; return; }
    this.veiculos = cavalos.map(function(v, i){
      const rota=MON_ROTAS[i % MON_ROTAS.length];
      return { id:'mv'+i, placa:v.placa, modelo:((v.marca||'')+' '+(v.modelo||'')).trim()||'Cavalo',
        veiculoId:v.id, rotaId:rota.id, destino:rota.para, km:monRotaKm(rota),
        progresso:(i*0.23+0.12)%0.9, sentido:(i%3===0)? -1 : 1,
        velocidade:62+(i*7)%26, parado:0, ang:null,
        status:(i%3===0)? 'retornando' : 'transito' };
    });
  },
  passo: function(dt){
    const escala=0.0009;
    this.veiculos.forEach(function(m){
      if(m.parado>0){ m.parado-=dt;
        if(m.parado<=0){ m.parado=0; m.sentido=-m.sentido; m.status=m.sentido>0?'transito':'retornando'; }
        return; }
      m.progresso += m.sentido*m.velocidade*escala*dt;
      if(m.progresso>=1){ m.progresso=1; m.parado=4+Math.random()*3; m.status='parado'; }
      else if(m.progresso<=0){ m.progresso=0; m.parado=4+Math.random()*3; m.status='parado'; }
      m.velocidade += Math.sin((Date.now()/9000)+m.progresso*6)*0.06;
      m.velocidade = Math.max(48, Math.min(92, m.velocidade));
    });
  },
  porDestino: function(id){ return this.veiculos.filter(function(m){ return m.destino===id; }).length; },
  restanteKm: function(m){ return (m.km||0)*(m.sentido>0? (1-m.progresso) : m.progresso); },
  eta: function(m){
    if(m.status==='parado') return '—';
    const min=Math.max(1, Math.round(this.restanteKm(m)/Math.max(30,m.velocidade)*60));
    const d=new Date(Date.now()+min*60000);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
};

/* ==================================================================
   7) CLIMA REAL por cidade (Open-Meteo, sem chave, uma só chamada).
   Cache de 30 min. Sem internet, some — nada é inventado.
   ================================================================== */
const MON_WX_KEY='pex_mon_wx';
let MON_WX={};
function monClimaCache(){
  try{ const c=JSON.parse(localStorage.getItem(MON_WX_KEY)||'null');
    if(c && c.quando && (Date.now()-c.quando)<30*60000) return c.dados||{};
  }catch(e){}
  return null;
}
function monClimaCarregar(){
  const cache=monClimaCache();
  if(cache){ MON_WX=cache; monPintarClima(); return; }
  if(!navigator.onLine) return;
  const alvos=MON_LOCAIS.filter(function(l){ return l.tipo!=='referencia'; });
  const lat=alvos.map(function(l){ return l.lat.toFixed(4); }).join(',');
  const lon=alvos.map(function(l){ return l.lon.toFixed(4); }).join(',');
  const url='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo';
  fetch(url).then(function(r){ return r.json(); }).then(function(j){
    const arr=Array.isArray(j)? j : [j];
    const dados={};
    arr.forEach(function(item, i){
      const l=alvos[i]; if(!l||!item||!item.current) return;
      dados[l.id]={ t:Math.round(item.current.temperature_2m), c:item.current.weather_code };
    });
    MON_WX=dados;
    try{ localStorage.setItem(MON_WX_KEY, JSON.stringify({quando:Date.now(), dados:dados})); }catch(e){}
    monPintarClima();
  }).catch(function(){ /* offline ou bloqueado: segue sem temperatura */ });
}
/* ícone conforme o código do tempo (0 limpo, 1-3 nuvens, 45+ chuva) */
function monIconeTempo(c){
  if(c==null) return '';
  if(c===0||c===1) return '<circle cx="0" cy="0" r="4.6" class="wx-sol"/>';
  if(c>=51) return '<path class="wx-nuv" d="M-7 2 a4.4 4.4 0 0 1 1.2-8.2 a5.6 5.6 0 0 1 10.6 1 a3.7 3.7 0 0 1-.6 7.2 Z"/><path class="wx-chuva" d="M-3 4 l-1.4 3.4M1 4 l-1.4 3.4M5 4 l-1.4 3.4"/>';
  return '<path class="wx-nuv" d="M-7 2 a4.4 4.4 0 0 1 1.2-8.2 a5.6 5.6 0 0 1 10.6 1 a3.7 3.7 0 0 1-.6 7.2 Z"/>';
}
function monPintarClima(){
  MON_LOCAIS.forEach(function(l){
    const g=document.getElementById('wx-'+l.id); if(!g) return;
    const w=MON_WX[l.id];
    if(!w){ g.innerHTML=''; return; }
    g.innerHTML='<text class="mon-wx-t" x="0" y="0">'+w.t+'°</text>'
      +'<g class="mon-wx-i" transform="translate('+(String(w.t).length>2?34:27)+',-5)">'+monIconeTempo(w.c)+'</g>';
  });
}

/* ==================================================================
   8) FUNDO DO MAPA — gerado por código, sempre igual (semente fixa),
   sem imagem e sem internet. Dá o aspecto de carta escura: relevo,
   malha de vias secundárias e manchas urbanas junto das cidades.
   ================================================================== */
function _monRnd(s){ let x=s>>>0; return function(){ x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }

/* vias secundárias: linhas finas irregulares por todo o mapa */
function monFundoVias(){
  const r=_monRnd(20260807), W=MON_VB.w, H=MON_VB.h, out=[];
  for(let i=0;i<86;i++){
    let x=r()*W, y=r()*H;
    let ang=r()*Math.PI*2;
    let d='M'+x.toFixed(0)+' '+y.toFixed(0);
    const segs=3+Math.floor(r()*5);
    for(let s=0;s<segs;s++){
      ang += (r()-0.5)*0.9;
      const len=26+r()*72;
      x+=Math.cos(ang)*len; y+=Math.sin(ang)*len;
      d+=' L'+x.toFixed(0)+' '+y.toFixed(0);
      if(x<-40||x>W+40||y<-40||y>H+40) break;
    }
    out.push('<path d="'+d+'"/>');
  }
  return out.join('');
}
/* manchas urbanas: pequenas grades inclinadas junto de cada cidade */
function monFundoUrbano(){
  const out=[];
  MON_LOCAIS.forEach(function(l, idx){
    const p=monProjetar(l);
    const r=_monRnd(1000+idx*77);
    const base=l.tipo==='base'? 30 : (l.tipo==='destino'? 20 : 13);
    const rot=(r()*60-30).toFixed(1);
    let g='<g transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+') rotate('+rot+')">';
    const n=l.tipo==='referencia'? 4 : 7;
    for(let i=0;i<n;i++){
      const off=(i-n/2)*(base/n*1.7);
      g+='<line x1="'+(-base).toFixed(0)+'" y1="'+off.toFixed(1)+'" x2="'+base.toFixed(0)+'" y2="'+off.toFixed(1)+'"/>';
      g+='<line x1="'+off.toFixed(1)+'" y1="'+(-base).toFixed(0)+'" x2="'+off.toFixed(1)+'" y2="'+base.toFixed(0)+'"/>';
    }
    out.push(g+'</g>');
  });
  return out.join('');
}
/* relevo: manchas suaves e desfocadas, para o fundo não ficar chapado */
function monFundoRelevo(){
  const r=_monRnd(778899), out=[];
  for(let i=0;i<16;i++){
    const cx=r()*MON_VB.w, cy=r()*MON_VB.h, rx=70+r()*190, ry=50+r()*120;
    out.push('<ellipse cx="'+cx.toFixed(0)+'" cy="'+cy.toFixed(0)+'" rx="'+rx.toFixed(0)+'" ry="'+ry.toFixed(0)+'" transform="rotate('+(r()*180).toFixed(0)+' '+cx.toFixed(0)+' '+cy.toFixed(0)+')"/>');
  }
  return out.join('');
}
/* rótulos de rodovia espalhados ao longo das vias, como no mapa real */
function monRodoviaPills(){
  const out=[]; const r=_monRnd(4242);
  MON_VIAS.forEach(function(v){
    const pts=v.cidades.map(function(id){ return monProjetar(monLocal(id)); });
    for(let i=0;i<pts.length-1;i+=2){
      const a=pts[i], b=pts[i+1]||pts[i];
      const t=0.35+r()*0.3;
      const x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t-16;
      out.push('<g class="mon-rod" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')">'
        +'<rect x="-25" y="-8" width="50" height="16" rx="4"/>'
        +'<text y="3.7" text-anchor="middle">'+esc(v.nome)+'</text></g>');
    }
  });
  return out.join('');
}

/* ==================================================================
   9) DESENHO
   ================================================================== */
function monMapaHTML(){
  monCalcProjecao();
  const base=monBase(), bp=monProjetar(base), ppk=monPxPorKm();

  /* rotas: base larga + linha pontilhada brilhante (como na referência) */
  const rotasSVG=MON_ROTAS.map(function(r){
    const d=monCaminho(r);
    return '<g class="mon-rota mon-st-'+r.status+'" data-rota="'+r.id+'">'
      +'<path class="mon-via-glow" d="'+d+'"/>'
      +'<path class="mon-via" id="'+r.id+'" d="'+d+'"/>'
      +'<path class="mon-via-fluxo" d="'+d+'"/>'
      +'</g>';
  }).join('');

  /* destinos: anéis concêntricos + nome + temperatura + nº de veículos */
  /* cidades vizinhas (Maringá e Paiçandu ficam a 12 km) teriam os rótulos
     um sobre o outro — a de baixo desce um pouco para não colidir */
  const _jaPostos=[];
  const cidadesSVG=monDestinos().map(function(c,i){
    const p=monProjetar(c);
    const n=MonSim.porDestino(c.id);
    let dy=0;
    _jaPostos.forEach(function(q){
      if(Math.hypot(p.x-q.x, p.y-q.y) < 90) dy = (p.y>=q.y? 70 : -70);   /* altura do bloco nome+temp+selo */
    });
    _jaPostos.push({x:p.x, y:p.y});
    const txtBadge=n+(n===1?' VEÍCULO':' VEÍCULOS');
    const wBadge=Math.round(txtBadge.length*6.4+22);
    const wNome=Math.round(c.nome.length*10);
    const larg=Math.max(wBadge, wNome);
    /* escolhe o lado que REALMENTE cabe (não basta ser o lado de fora:
       no celular o card é estreito e o rótulo escapava da área) */
    const cabeDir = p.x+26+larg <= MON_VB.w-8;
    const cabeEsq = p.x-26-larg >= 8;
    let esquerda;                                     /* true = rótulo à direita do ponto */
    if(cabeDir && cabeEsq) esquerda = p.x > bp.x;     /* havendo espaço nos dois, vai p/ fora */
    else esquerda = cabeDir;
    const lx = esquerda? 26 : -26, anc = esquerda? 'start' : 'end';
    return '<g class="mon-cidade" data-local="'+c.id+'" transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')" tabindex="0" style="--i:'+i+'">'
      +'<circle class="mon-c-hit" r="30"/>'
      +'<circle class="mon-c-r3" r="21"/><circle class="mon-c-r2" r="15"/><circle class="mon-c-r1" r="9.5"/>'
      +'<circle class="mon-c-glow" r="7"/><circle class="mon-c-dot" r="3.2"/>'
      +'<g class="mon-c-lbl" transform="translate('+lx+','+dy+')" text-anchor="'+anc+'">'
        +'<text class="mon-c-nome" y="-12">'+esc(c.nome.toUpperCase())+'</text>'
        +'<g class="mon-wx" id="wx-'+c.id+'" transform="translate('+(esquerda?0:-46)+',10)"></g>'
        +'<g class="mon-c-badge" transform="translate('+(esquerda?0:-wBadge)+',22)">'
          +'<rect x="0" y="0" width="'+wBadge+'" height="19" rx="9.5"/>'
          +'<text x="'+(wBadge/2)+'" y="13" text-anchor="middle">'+txtBadge+'</text></g>'
      +'</g></g>';
  }).join('');

  /* base: anéis grandes concêntricos, núcleo forte e rótulo ao lado */
  const baseSVG=
    '<g class="mon-base" data-local="'+base.id+'" transform="translate('+bp.x.toFixed(1)+','+bp.y.toFixed(1)+')" tabindex="0">'
    +'<circle class="mon-b-hit" r="44"/>'
    +'<circle class="mon-b-r5" r="42"/><circle class="mon-b-r4" r="34"/>'
    +'<circle class="mon-b-r3" r="26"/><circle class="mon-b-r2" r="18"/>'
    +'<circle class="mon-b-halo" r="13"/><circle class="mon-b-nucleo" r="5.6"/>'
    +'<g class="mon-b-lbl" transform="translate(0,-58)">'
      +'<text class="mon-b-nome" text-anchor="middle">'+esc(base.nome.toUpperCase())+'</text>'
      +'<text class="mon-b-sub" y="14" text-anchor="middle">BASE OPERACIONAL</text>'
      +'<g class="mon-wx" id="wx-'+base.id+'" transform="translate(-16,32)"></g>'
    +'</g></g>';

  /* cidades de referência */
  const refSVG=monReferencias().map(function(c){
    const p=monProjetar(c);
    return '<g class="mon-ref" transform="translate('+p.x.toFixed(1)+','+p.y.toFixed(1)+')">'
      +'<circle class="mon-r-dot" r="1.9"/>'
      +'<text class="mon-r-nome" y="-6" text-anchor="middle">'+esc(c.nome)+'</text></g>';
  }).join('');

  /* veículos */
  const veicSVG=MonProvider.listar().map(function(m){
    return '<g class="mon-veic" id="mv-'+m.id+'" data-veic="'+m.id+'" tabindex="0">'
      +'<circle class="mon-v-halo" r="13"/>'
      +'<g class="mon-v-ico">'
        +'<rect class="mon-v-body" x="-8" y="-4.2" width="11.6" height="8.4" rx="2.2"/>'
        +'<rect class="mon-v-cab" x="3.5" y="-3.5" width="5.6" height="7" rx="1.6"/>'
        +'<rect class="mon-v-far" x="8.9" y="-2" width="1.6" height="4" rx=".8"/>'
      +'</g>'
      +'<text class="mon-v-placa" y="-17" text-anchor="middle">'+esc(m.placa)+'</text>'
      +'</g>';
  }).join('');

  const aneis=[50,100].map(function(km){
    return '<circle class="mon-anel" cx="'+bp.x.toFixed(1)+'" cy="'+bp.y.toFixed(1)+'" r="'+(km*ppk).toFixed(1)+'"/>';
  }).join('');
  const esc50=50*ppk;

  return ''
  +'<svg viewBox="0 0 '+MON_VB.w+' '+MON_VB.h+'" preserveAspectRatio="xMidYMid meet" class="mon-svg" id="monSvg">'
  +'<defs>'
    +'<radialGradient id="monCentro" cx="'+(bp.x/MON_VB.w*100).toFixed(1)+'%" cy="'+(bp.y/MON_VB.h*100).toFixed(1)+'%" r="62%">'
      +'<stop offset="0" stop-color="#123655"/><stop offset=".45" stop-color="#0b2138"/><stop offset="1" stop-color="#050d17"/></radialGradient>'
    +'<pattern id="monHex" width="34" height="30" patternUnits="userSpaceOnUse">'
      +'<path d="M17 0 L34 8.6 L34 21.4 L17 30 L0 21.4 L0 8.6 Z" fill="none" stroke="rgba(120,190,235,.05)" stroke-width="1"/></pattern>'
    +'<filter id="monBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>'
    +'<filter id="monSoft" x="-60%" y="-60%" width="220%" height="220%">'
      +'<feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    +'<radialGradient id="monVinh" cx="50%" cy="50%" r="72%">'
      +'<stop offset=".55" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.62)"/></radialGradient>'
  +'</defs>'
  /* fundo */
  +'<rect class="mon-fundo" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'" fill="url(#monCentro)"/>'
  +'<g class="mon-relevo" filter="url(#monBlur)">'+monFundoRelevo()+'</g>'
  +'<g class="mon-bg-vias">'+monFundoVias()+'</g>'
  +'<g class="mon-bg-urb">'+monFundoUrbano()+'</g>'
  +'<rect class="mon-hex" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'" fill="url(#monHex)"/>'
  /* conteúdo */
  +'<g id="monZoom" class="mon-zoom">'
    +'<g class="mon-aneis">'+aneis+'</g>'
    +'<g class="mon-malha">'+MON_VIAS.map(function(v){ return '<path d="'+monCaminhoDe(v.cidades)+'"/>'; }).join('')+'</g>'
    + monRodoviaPills() + rotasSVG + refSVG + cidadesSVG + baseSVG + veicSVG
  +'</g>'
  +'<rect class="mon-vinheta" x="0" y="0" width="'+MON_VB.w+'" height="'+MON_VB.h+'" fill="url(#monVinh)"/>'
  /* escala */
  +'<g class="mon-escala" transform="translate(38,'+(MON_VB.h-26)+')">'
    +'<line x1="0" y1="0" x2="'+esc50.toFixed(1)+'" y2="0"/>'
    +'<line x1="0" y1="-4" x2="0" y2="4"/><line x1="'+esc50.toFixed(1)+'" y1="-4" x2="'+esc50.toFixed(1)+'" y2="4"/>'
    +'<text x="'+(esc50/2).toFixed(1)+'" y="-8" text-anchor="middle">50 km</text></g>'
  +'</svg>';
}

/* ==================================================================
   10) LOOP — simulação e desenho separados, num só rAF
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
      MonProvider.atualizar(dt); monRender();
      _monAcc+=dt; if(_monAcc>=5){ _monAcc=0; monPintarInfo(); monPintarBadges(); }
    }
    _monRAF=requestAnimationFrame(quadro);
  }
  monRender();
  _monRAF=requestAnimationFrame(quadro);
}
function monParar(){ if(_monRAF){ cancelAnimationFrame(_monRAF); _monRAF=null; } }

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
    if(ico) ico.setAttribute('transform','rotate('+m.ang.toFixed(1)+')');
    if(m.status==='parado') g.classList.add('parado'); else g.classList.remove('parado');
  });
}
/* mantém o "N VEÍCULOS" de cada destino em dia */
function monPintarBadges(){
  monDestinos().forEach(function(c){
    const g=document.querySelector('.mon-cidade[data-local="'+c.id+'"] .mon-c-badge text');
    if(g){ const n=MonSim.porDestino(c.id); g.textContent=n+(n===1?' VEÍCULO':' VEÍCULOS'); }
  });
}

/* ==================================================================
   11) INFORMAÇÕES + TOOLTIPS
   ================================================================== */
function monPintarInfo(){
  const vs=MonProvider.listar();
  const set=function(id,txt){ const e=document.getElementById(id); if(e) e.textContent=txt; };
  set('monKvA', vs.length);
  set('monKvB', vs.filter(function(m){ return m.status!=='parado'; }).length);
  set('monKvC', vs.filter(function(m){ return m.status==='parado'; }).length);
  set('monKvD', monDestinos().length);
  set('monKvE', Math.round(vs.reduce(function(s,m){ return s+MonSim.restanteKm(m); },0))+' km');
  const d=new Date();
  set('monSync', String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'));
}
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
  const cls=m.status==='parado'? 'wa' : 'go';
  const pct=Math.round((m.sentido>0? m.progresso : 1-m.progresso)*100);
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(m.placa)+'</b><span class="mon-tip-plate">CAVALO</span></div>'
   +'<div class="mon-tip-sub">'+esc(m.modelo)+'</div>'
   +'<div class="mon-tip-g">'
     +'<span><small>Sentido</small><b>'+esc(destino?destino.nome:'—')+'</b></span>'
     +'<span><small>Velocidade</small><b>'+Math.round(m.velocidade)+' km/h</b></span>'
     +'<span><small>Faltam</small><b>'+Math.round(MonSim.restanteKm(m))+' km</b></span>'
     +'<span><small>Previsão</small><b>'+MonSim.eta(m)+'</b></span></div>'
   +'<div class="mon-tip-bar"><i style="width:'+pct+'%"></i></div>'
   +'<div class="mon-tip-rota">'+esc(rota?rota.rodovia:'')+' · '+Math.round(m.km)+' km no total</div>'
   +'<div class="mon-tip-f"><i class="mon-dot '+cls+'"></i>'+rot+'<span class="mon-tip-sim">posição simulada</span></div>', alvo);
}
function monTipCidade(id, alvo){
  const c=monLocal(id); if(!c) return;
  const base=monBase(), ehBase=c.tipo==='base';
  const w=MON_WX[c.id];
  const d=new Date();
  const hora=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  _monTipMostrar(
    '<div class="mon-tip-h"><b>'+esc(c.nome.toUpperCase())+'</b><span class="mon-tip-plate">'+esc(c.uf||'')+'</span></div>'
   +'<div class="mon-tip-sub">'+(ehBase?'Base operacional':'Destino operacional')+'</div>'
   +'<div class="mon-tip-g">'
     +'<span><small>'+(ehBase?'Frota':'Em trânsito')+'</small><b>'+(ehBase? MonProvider.listar().length : MonSim.porDestino(id))+' veículo(s)</b></span>'
     +'<span><small>'+(ehBase?'Rotas':'Distância')+'</small><b>'+(ehBase? MON_ROTAS.length : Math.round(monDistKm(base,c))+' km')+'</b></span>'
     +(w? '<span><small>Temperatura</small><b>'+w.t+'°C</b></span>' : '')
   +'</div>'
   +'<div class="mon-tip-rota">'+Math.abs(c.lat).toFixed(4)+'° S · '+Math.abs(c.lon).toFixed(4)+'° O</div>'
   +'<div class="mon-tip-f"><i class="mon-dot ok"></i>ONLINE<span class="mon-tip-sim">'+hora+'</span></div>', alvo);
}
function monLigarEventos(){
  const mapa=document.getElementById('monSvg'); if(!mapa) return;
  mapa.querySelectorAll('.mon-veic').forEach(function(g){
    const id=g.getAttribute('data-veic'); const abrir=function(){ monTipVeiculo(id,g); };
    g.addEventListener('mouseenter',abrir); g.addEventListener('focus',abrir);
    g.addEventListener('mouseleave',monTipEsconder); g.addEventListener('blur',monTipEsconder);
    g.addEventListener('click',function(e){ e.stopPropagation(); abrir();
      const m=MonProvider.listar().find(function(v){ return v.id===id; });
      if(m && typeof iniAbrirVeic==='function') iniAbrirVeic(m.placa); });
  });
  mapa.querySelectorAll('.mon-cidade, .mon-base').forEach(function(g){
    const id=g.getAttribute('data-local'); const abrir=function(){ monTipCidade(id,g); };
    g.addEventListener('mouseenter',abrir); g.addEventListener('focus',abrir);
    g.addEventListener('mouseleave',monTipEsconder); g.addEventListener('blur',monTipEsconder);
    g.addEventListener('click',function(e){ e.stopPropagation(); abrir(); });
  });
  mapa.addEventListener('click',function(e){ if(e.target===mapa) monTipEsconder(); });
}

/* ==================================================================
   12) CONTROLES
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
let _monCamada=0;
function monCamadas(){
  _monCamada=(_monCamada+1)%3;
  const s=document.getElementById('monSvg'); if(!s) return;
  s.classList.toggle('sem-textura', _monCamada>=1);
  s.classList.toggle('sem-ref', _monCamada===2);
  if(typeof toast==='function') toast(['Mapa completo','Sem textura de fundo','Somente rotas e destinos'][_monCamada]);
}

/* ==================================================================
   13) BLOCO COMPLETO
   ================================================================== */
function monComponenteHTML(){
  return ''
  +'<div class="pex-map mon-wrap" id="monMapa">'
    +'<div id="monSvgBox"></div>'          /* o SVG entra aqui depois de medir o card */
    +'<div class="mon-ctrls no-print">'
      +'<button class="mon-ctl" onclick="monZoom(.35)" title="Aproximar" aria-label="Aproximar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(-.35)" title="Afastar" aria-label="Afastar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg></button>'
      +'<button class="mon-ctl" onclick="monZoom(0,true)" title="Centralizar na base" aria-label="Centralizar na base"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="8.4"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg></button>'
      +'<button class="mon-ctl" onclick="monCamadas()" title="Camadas" aria-label="Camadas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/></svg></button>'
    +'</div>'
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
    + monTipHTML()
    +'<aside class="ini-vpanel" id="iniVeicPanel"></aside>'
  +'</div>';
}
/* Desenha (ou redesenha) o mapa já ajustado ao tamanho real do card */
function monDesenhar(){
  const box=document.getElementById('monSvgBox'); if(!box) return;
  monMedir();
  MonProvider.iniciar();
  box.innerHTML=monMapaHTML();
  _monZoom=1;
  monIniciar();
  monLigarEventos();
  monPintarBadges();
  monPintarClima();
}
let _monResizeT=null;
function monMontar(){
  if(!document.getElementById('monSvgBox')) return;
  monDesenhar();
  monClimaCarregar();     /* temperatura real; sem internet, não aparece */
  if(!window._monResizeOn){
    window._monResizeOn=true;
    window.addEventListener('resize', function(){
      clearTimeout(_monResizeT);
      _monResizeT=setTimeout(function(){ if(document.getElementById('monSvgBox')) monDesenhar(); }, 250);
    });
  }
}
