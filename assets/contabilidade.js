/* ==================================================================
   CONTABILIDADE — Planeta Express
   ------------------------------------------------------------------
   PRINCÍPIO: a informação é cadastrada UMA VEZ, no módulo dela, e a
   Contabilidade LÊ. Nada é copiado.

   Os lançamentos contábeis são DERIVADOS das coleções que já existem
   (ctes, faturamento, abastecimentos, pedagios, servicos, manutencoes,
   pneus, baterias, seguros, descargas, notas, pagamentos, vales).
   Cada lançamento derivado carrega a ORIGEM (módulo + id do registro),
   então dá para voltar ao dado cru e ao documento anexado.

   A Contabilidade só ARMAZENA o que não existe em nenhum módulo:
     DB.contabPlano    -> plano de contas
     DB.contabCentros  -> centros de custo
     DB.contabManuais  -> lançamentos digitados aqui
     DB.contabAtivos   -> ativo imobilizado
     DB.contabFinanc   -> financiamentos
     DB.contabTributos -> impostos
     DB.contabFech     -> fechamento por competência
     DB.contabAudit    -> auditoria
     DB.contabClass    -> reclassificação de lançamento derivado
                          (só o override, sem duplicar o registro)
   ================================================================== */

/* ==================================================================
   1) PLANO DE CONTAS — editável pelo usuário
   ================================================================== */
const CONTAB_PLANO_PADRAO = [
  /* RECEITAS */
  {id:'r.frete',     grupo:'receita', nome:'Fretes',            ordem:10},
  {id:'r.transporte',grupo:'receita', nome:'Transporte',        ordem:11},
  {id:'r.servicos',  grupo:'receita', nome:'Serviços',          ordem:12},
  {id:'r.outros',    grupo:'receita', nome:'Outras receitas',   ordem:19},
  /* DEDUÇÕES DA RECEITA */
  {id:'d.impostos',  grupo:'deducao', nome:'Impostos sobre a receita', ordem:20},
  {id:'d.devolucao', grupo:'deducao', nome:'Devoluções e abatimentos', ordem:21},
  /* CUSTOS OPERACIONAIS */
  {id:'c.diesel',    grupo:'custo',   nome:'Diesel',            ordem:30},
  {id:'c.arla',      grupo:'custo',   nome:'Arla / aditivos',   ordem:31},
  {id:'c.pedagio',   grupo:'custo',   nome:'Pedágios',          ordem:32},
  {id:'c.pneus',     grupo:'custo',   nome:'Pneus',             ordem:33},
  {id:'c.manutencao',grupo:'custo',   nome:'Manutenção',        ordem:34},
  {id:'c.pecas',     grupo:'custo',   nome:'Peças',             ordem:35},
  {id:'c.lubrific',  grupo:'custo',   nome:'Lubrificantes',     ordem:36},
  {id:'c.motorista', grupo:'custo',   nome:'Motoristas',        ordem:37},
  {id:'c.seguros',   grupo:'custo',   nome:'Seguros',           ordem:38},
  {id:'c.rastreio',  grupo:'custo',   nome:'Rastreamento',      ordem:39},
  {id:'c.terceiros', grupo:'custo',   nome:'Terceiros',         ordem:40},
  {id:'c.licencia',  grupo:'custo',   nome:'Licenciamento',     ordem:41},
  {id:'c.descarga',  grupo:'custo',   nome:'Descargas',         ordem:42},
  {id:'c.deprec',    grupo:'custo',   nome:'Depreciação',       ordem:43},
  {id:'c.outros',    grupo:'custo',   nome:'Outros custos',     ordem:49},
  /* DESPESAS ADMINISTRATIVAS */
  {id:'a.admin',     grupo:'despesa', nome:'Administrativo',    ordem:50},
  {id:'a.comercial', grupo:'despesa', nome:'Comercial',         ordem:51},
  {id:'a.juridico',  grupo:'despesa', nome:'Jurídico',          ordem:52},
  {id:'a.contab',    grupo:'despesa', nome:'Contabilidade',     ordem:53},
  {id:'a.ti',        grupo:'despesa', nome:'Tecnologia',        ordem:54},
  {id:'a.telefonia', grupo:'despesa', nome:'Telefonia',         ordem:55},
  {id:'a.aluguel',   grupo:'despesa', nome:'Aluguel',           ordem:56},
  {id:'a.energia',   grupo:'despesa', nome:'Energia',           ordem:57},
  {id:'a.marketing', grupo:'despesa', nome:'Marketing',         ordem:58},
  {id:'a.outros',    grupo:'despesa', nome:'Outras despesas',   ordem:59},
  /* FINANCEIRAS */
  {id:'f.juros',     grupo:'financeira', nome:'Juros',              ordem:60},
  {id:'f.tarifas',   grupo:'financeira', nome:'Tarifas bancárias',  ordem:61},
  {id:'f.emprestimo',grupo:'financeira', nome:'Empréstimos',        ordem:62},
  {id:'f.financiam', grupo:'financeira', nome:'Financiamentos',     ordem:63},
  {id:'f.iof',       grupo:'financeira', nome:'IOF',                ordem:64},
  {id:'f.outros',    grupo:'financeira', nome:'Outras financeiras', ordem:69},
  /* IMPOSTOS */
  {id:'i.icms',      grupo:'imposto', nome:'ICMS',   ordem:70},
  {id:'i.pis',       grupo:'imposto', nome:'PIS',    ordem:71},
  {id:'i.cofins',    grupo:'imposto', nome:'COFINS', ordem:72},
  {id:'i.iss',       grupo:'imposto', nome:'ISS',    ordem:73},
  {id:'i.irpj',      grupo:'imposto', nome:'IRPJ',   ordem:74},
  {id:'i.csll',      grupo:'imposto', nome:'CSLL',   ordem:75},
  {id:'i.outros',    grupo:'imposto', nome:'Outros tributos', ordem:79},
];
const CONTAB_GRUPOS = {
  receita:   {nome:'Receitas',                 sinal:+1, cor:'#4bd6a0'},
  deducao:   {nome:'Deduções da receita',      sinal:-1, cor:'#e0a642'},
  custo:     {nome:'Custos operacionais',      sinal:-1, cor:'#f2686b'},
  despesa:   {nome:'Despesas administrativas', sinal:-1, cor:'#f2a44e'},
  financeira:{nome:'Despesas financeiras',     sinal:-1, cor:'#b98cff'},
  imposto:   {nome:'Impostos',                 sinal:-1, cor:'#8ea3bf'},
};
function contabPlano(){
  if(!Array.isArray(DB.contabPlano) || !DB.contabPlano.length) DB.contabPlano=clone(CONTAB_PLANO_PADRAO);
  return DB.contabPlano.filter(function(c){ return !c.inativa; });
}
function contabPlanoTodo(){ contabPlano(); return DB.contabPlano; }
function contabConta(id){ return contabPlanoTodo().find(function(c){ return c.id===id; }); }
function contabContaNome(id){ const c=contabConta(id); return c? c.nome : (id||'—'); }
function contabGrupoDe(id){ const c=contabConta(id); return c? c.grupo : 'custo'; }

/* ==================================================================
   2) CENTROS DE CUSTO — a frota entra automaticamente
   ================================================================== */
function contabCentros(){
  if(!Array.isArray(DB.contabCentros)) DB.contabCentros=[];
  const fixos=[
    {id:'cc.admin',   nome:'Administrativo', tipo:'area'},
    {id:'cc.oper',    nome:'Operacional',    tipo:'area'},
    {id:'cc.comerc',  nome:'Comercial',      tipo:'area'},
    {id:'cc.financ',  nome:'Financeiro',     tipo:'area'},
    {id:'cc.diretor', nome:'Diretoria',      tipo:'area'},
  ];
  fixos.forEach(function(f){ if(!DB.contabCentros.some(function(c){ return c.id===f.id; })) DB.contabCentros.push(f); });
  /* cada veículo é um centro de custo (não duplica: referencia o id da frota) */
  const lista=DB.contabCentros.slice();
  (DB.veiculos||[]).forEach(function(v){
    if(v.status==='Arquivado') return;
    lista.push({ id:'cc.v.'+v.id, nome:v.placa, tipo:'veiculo', veiculoId:v.id, auto:true });
  });
  return lista;
}
function contabCentroNome(id){
  if(!id) return '—';
  const c=contabCentros().find(function(x){ return x.id===id; });
  return c? c.nome : id;
}

/* ==================================================================
   3) FONTES — cada módulo vira lançamento. NADA é copiado: isto roda
   na hora da consulta, lendo as coleções originais.
   Cada fonte declara como transformar seus registros.
   ================================================================== */
const CONTAB_FONTES = [
  { id:'cte', modulo:'CT-e', rota:'ctes', colecao:'ctes', tipo:'receita',
    mapear:function(c){
      const v=_contabNum(c.valor!=null&&c.valor!==''? c.valor : c.vTPrest);
      if(!v) return null;
      return { data:c.data, valor:v, conta:'r.frete', descricao:'CT-e '+(c.numero||'')+(c.cliente?' — '+c.cliente:''),
        cliente:c.cliente||'', placa:c.placa||'', documento:c.numero||'', chave:c.chave||'' };
    }},
  { id:'fatur', modulo:'Faturamento', rota:'financeiro', colecao:'faturamento', tipo:'receita',
    mapear:function(f){
      const v=_contabNum(f.valor); if(!v) return null;
      return { data:f.data, valor:v, conta:'r.frete', descricao:f.obs||('Faturamento '+(f.cliente||'')),
        cliente:f.cliente||'', documento:f.chave||'', competencia:f.competencia||'' };
    }},
  { id:'abastec', modulo:'Abastecimentos', rota:'abastecimento', colecao:'abastecimentos', tipo:'custo',
    mapear:function(a){
      const v=_contabNum(a.valor); if(!v) return null;
      const arla=/arla/i.test(a.obs||'');
      return { data:a.data, valor:v, conta:arla?'c.arla':'c.diesel',
        descricao:(arla?'Arla':'Diesel')+(a.posto?' — '+a.posto:'')+(a.litros?' · '+a.litros+' L':''),
        placa:a.placa||'', fornecedor:a.posto||'', litros:_contabNum(a.litros) };
    }},
  { id:'pedagio', modulo:'Pedágios', rota:'pedagios', colecao:'pedagios', tipo:'custo',
    mapear:function(p){
      const v=_contabNum(p.valor); if(!v) return null;
      /* vale-pedágio é reembolsado pelo embarcador: não é custo da empresa */
      if(/vale/i.test(p.tipo||'')) return null;
      return { data:p.data, valor:v, conta:'c.pedagio',
        descricao:'Pedágio'+(p.conc?' — '+p.conc:'')+(p.praca?' · '+p.praca:''),
        placa:p.placa||'', fornecedor:p.conc||'' };
    }},
  { id:'servico', modulo:'Manutenção', rota:'manutencao', colecao:'servicos', tipo:'custo',
    mapear:function(s){
      const v=_contabNum(s.valor); if(!v) return null;
      const veic=(DB.veiculos||[]).find(function(x){ return x.id===s.veiculoId; });
      return { data:s.data, valor:v, conta:'c.manutencao',
        descricao:(s.descricao||'Serviço')+(s.oficina?' — '+s.oficina:''),
        placa:veic?veic.placa:'', fornecedor:s.oficina||'' };
    }},
  { id:'oleo', modulo:'Trocas de Óleo', rota:'oleo', colecao:'manutencoes', tipo:'custo',
    mapear:function(m){
      const v=_contabNum(m.valor); if(!v) return null;
      const veic=(DB.veiculos||[]).find(function(x){ return x.id===m.veiculoId; });
      return { data:m.data, valor:v, conta:'c.lubrific', descricao:(m.item||'Troca de óleo')+(m.oficina?' — '+m.oficina:''),
        placa:veic?veic.placa:'', fornecedor:m.oficina||'' };
    }},
  { id:'pneu', modulo:'Pneus', rota:'pneus', colecao:'pneus', tipo:'custo',
    mapear:function(p){
      const v=_contabNum(p.valor); if(!v) return null;
      const veic=(DB.veiculos||[]).find(function(x){ return x.id===p.veiculoId; });
      return { data:p.dataCompra||p.data, valor:v, conta:'c.pneus',
        descricao:'Pneu '+(p.marca||'')+(p.medida?' '+p.medida:''), placa:veic?veic.placa:(p.placa||''),
        fornecedor:p.fornecedor||'' };
    }},
  { id:'bateria', modulo:'Baterias', rota:'baterias', colecao:'baterias', tipo:'custo',
    mapear:function(b){
      const v=_contabNum(b.valor); if(!v) return null;
      return { data:b.data, valor:v, conta:'c.pecas', descricao:'Bateria '+(b.marca||''),
        placa:b.placa||'', fornecedor:b.local||'' };
    }},
  { id:'descarga', modulo:'Descargas', rota:'descargas', colecao:'descargas', tipo:'custo',
    mapear:function(d){
      const v=_contabNum(d.valor); if(!v) return null;
      return { data:d.data, valor:v, conta:'c.descarga', descricao:'Descarga'+(d.local?' — '+d.local:''),
        placa:d.placa||'', documento:d.transporte||'' };
    }},
  { id:'pagamento', modulo:'Pagamentos', rota:'financeiro', colecao:'pagamentos', tipo:'despesa',
    mapear:function(p){
      const v=_contabNum(p.valor); if(!v) return null;
      return { data:p.data, valor:v, conta:_contabContaPorCategoria(p.categoria),
        descricao:p.descricao||'Pagamento', fornecedor:p.categoria||'' };
    }},
  { id:'vale', modulo:'Vales', rota:'financeiro', colecao:'vales', tipo:'custo',
    mapear:function(x){
      const v=_contabNum(x.valor); if(!v) return null;
      const m=(DB.motoristas||[]).find(function(y){ return y.id===x.motoristaId; });
      return { data:x.data, valor:v, conta:'c.motorista', descricao:'Vale — '+(m?m.nome:''),
        motorista:m?m.nome:'' };
    }},
];
/* Seguros e notas de despesa têm formato próprio — tratados à parte */

function _contabNum(v){
  if(v==null||v==='') return 0;
  if(typeof v==='number') return v;
  const s=String(v).replace(/[^\d,.\-]/g,'');
  return parseFloat(/,\d{1,2}$/.test(s)? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,''))||0;
}
function _contabContaPorCategoria(cat){
  const c=_contabNorm(cat||'');
  if(/combust|diesel/.test(c)) return 'c.diesel';
  if(/manuten|oficina|pe[çc]a/.test(c)) return 'c.manutencao';
  if(/pedagio|pedágio/.test(c)) return 'c.pedagio';
  if(/pneu/.test(c)) return 'c.pneus';
  if(/seguro/.test(c)) return 'c.seguros';
  if(/salario|motorista|folha/.test(c)) return 'c.motorista';
  if(/imposto|tribut|icms|pis|cofins/.test(c)) return 'i.outros';
  if(/banc|tarifa|juros/.test(c)) return 'f.tarifas';
  if(/aluguel/.test(c)) return 'a.aluguel';
  if(/energia|luz/.test(c)) return 'a.energia';
  if(/telefon|internet/.test(c)) return 'a.telefonia';
  if(/contab/.test(c)) return 'a.contab';
  return 'a.outros';
}
function _contabNorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),''); }

/* ==================================================================
   4) MOTOR — monta os lançamentos lendo os módulos.
   Cada lançamento tem id estável (fonte:idDoRegistro), então uma
   reclassificação feita pelo usuário gruda no lançamento certo e
   sobrevive a recarregar o sistema — sem copiar o registro original.
   ================================================================== */
function contabClass(){ if(!DB.contabClass||typeof DB.contabClass!=='object') DB.contabClass={}; return DB.contabClass; }
function contabManuais(){ if(!Array.isArray(DB.contabManuais)) DB.contabManuais=[]; return DB.contabManuais; }

function contabLancamentos(){
  const out=[];
  const over=contabClass();

  CONTAB_FONTES.forEach(function(f){
    const col=DB[f.colecao];
    if(!Array.isArray(col)) return;
    col.forEach(function(reg){
      let m=null;
      try{ m=f.mapear(reg); }catch(e){ m=null; }
      if(!m || !m.valor) return;
      const id=f.id+':'+(reg.id||'');
      const l={
        id:id, origem:f.modulo, origemId:f.id, rota:f.rota, refId:reg.id,
        data:m.data||'', competencia:(m.competencia||String(m.data||'').slice(0,7)),
        descricao:m.descricao||'', valor:Math.abs(m.valor),
        conta:m.conta, grupo:contabGrupoDe(m.conta),
        placa:m.placa||'', cliente:m.cliente||'', fornecedor:m.fornecedor||'',
        motorista:m.motorista||'', documento:m.documento||'', chave:m.chave||'',
        litros:m.litros||0, derivado:true
      };
      /* centro de custo: veículo quando houver */
      if(l.placa){ const v=(typeof veiculoByPlaca==='function')? veiculoByPlaca(l.placa) : null;
        if(v){ l.centro='cc.v.'+v.id; l.veiculoId=v.id; } }
      if(!l.centro) l.centro = (l.grupo==='receita'? 'cc.oper' : (l.grupo==='despesa'? 'cc.admin' : 'cc.oper'));
      /* reclassificação do usuário (só o que ele mudou) */
      const o=over[id];
      if(o){ if(o.conta){ l.conta=o.conta; l.grupo=contabGrupoDe(o.conta); }
             if(o.centro) l.centro=o.centro;
             if(o.obs!=null) l.obs=o.obs;
             l.reclassificado=true; }
      out.push(l);
    });
  });

  /* SEGUROS — o prêmio anual é rateado por competência (12 meses) */
  (DB.seguros||[]).forEach(function(s){
    const premio=_contabNum(s.premio);
    if(!premio || s.status==='Cancelado' || !s.inicio) return;
    const ini=parseD(s.inicio); if(!ini) return;
    const mensal=premio/12;
    for(let i=0;i<12;i++){
      const d=new Date(ini.getFullYear(), ini.getMonth()+i, 1);
      const comp=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const id='seguro:'+s.id+':'+comp;
      const l={ id:id, origem:'Seguros', origemId:'seguro', rota:'seguros', refId:s.id,
        data:comp+'-01', competencia:comp, valor:mensal, conta:'c.seguros', grupo:'custo',
        descricao:'Seguro '+(s.seguradora||'')+(s.apolice?' — apólice '+s.apolice:'')+' (1/12)',
        placa:s.placa||'', fornecedor:s.seguradora||'', derivado:true, rateado:true };
      if(l.placa){ const v=(typeof veiculoByPlaca==='function')? veiculoByPlaca(l.placa):null;
        if(v){ l.centro='cc.v.'+v.id; l.veiculoId=v.id; } }
      if(!l.centro) l.centro='cc.oper';
      const o=over[id]; if(o){ if(o.conta){ l.conta=o.conta; l.grupo=contabGrupoDe(o.conta); } if(o.centro) l.centro=o.centro; l.reclassificado=true; }
      out.push(l);
    }
  });

  /* NOTAS DE DESPESA — cada período tem 3 valores somados */
  (DB.notas||[]).forEach(function(n){
    [['alexandria','Notas Alexandria','a.outros'],
     ['notasGerais','Notas gerais','a.outros'],
     ['combustivel','Combustível (notas)','c.diesel']].forEach(function(par){
      const v=_contabNum(n[par[0]]); if(!v) return;
      const id='nota:'+n.id+':'+par[0];
      const l={ id:id, origem:'Notas de Despesa', origemId:'nota', rota:'notas', refId:n.id,
        data:n.fim||n.inicio||'', competencia:String(n.fim||n.inicio||'').slice(0,7),
        valor:v, conta:par[2], grupo:contabGrupoDe(par[2]), descricao:par[1],
        centro:'cc.admin', derivado:true };
      const o=over[id]; if(o){ if(o.conta){ l.conta=o.conta; l.grupo=contabGrupoDe(o.conta); } if(o.centro) l.centro=o.centro; l.reclassificado=true; }
      out.push(l);
    });
  });

  /* TRIBUTOS lançados na aba de impostos */
  (DB.contabTributos||[]).forEach(function(t){
    const v=_contabNum(t.valor); if(!v) return;
    out.push({ id:'tributo:'+t.id, origem:'Tributos', origemId:'tributo', rota:'contabilidade', refId:t.id,
      data:t.competencia? t.competencia+'-01' : t.vencimento, competencia:t.competencia||String(t.vencimento||'').slice(0,7),
      valor:v, conta:t.conta||'i.outros', grupo:'imposto', descricao:(contabContaNome(t.conta)||'Tributo')+(t.obs?' — '+t.obs:''),
      centro:'cc.financ', derivado:true, pago:t.pago });
  });

  /* DEPRECIAÇÃO do ativo imobilizado (linear, mensal) */
  (DB.contabAtivos||[]).forEach(function(a){
    const vl=_contabNum(a.valor), vida=parseInt(a.vidaUtil)||0;
    if(!vl || !vida || !a.aquisicao) return;
    const mensal=vl/(vida*12);
    const ini=parseD(a.aquisicao); if(!ini) return;
    const hoje=new Date(); let i=0;
    while(i<vida*12){
      const d=new Date(ini.getFullYear(), ini.getMonth()+i, 1);
      if(d>hoje) break;
      const comp=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      out.push({ id:'deprec:'+a.id+':'+comp, origem:'Ativo Imobilizado', origemId:'deprec', rota:'contabilidade',
        refId:a.id, data:comp+'-01', competencia:comp, valor:mensal, conta:'c.deprec', grupo:'custo',
        descricao:'Depreciação — '+(a.descricao||''), placa:a.placa||'',
        centro:a.veiculoId? 'cc.v.'+a.veiculoId : 'cc.admin', veiculoId:a.veiculoId||'',
        derivado:true, rateado:true });
      i++;
    }
  });

  /* PARCELAS de financiamento (juros viram despesa financeira) */
  (DB.contabFinanc||[]).forEach(function(f){
    (f.parcelas||[]).forEach(function(p){
      const j=_contabNum(p.juros); if(!j) return;
      out.push({ id:'financ:'+f.id+':'+p.n, origem:'Financiamentos', origemId:'financ', rota:'contabilidade',
        refId:f.id, data:p.vencimento, competencia:String(p.vencimento||'').slice(0,7), valor:j,
        conta:'f.financiam', grupo:'financeira', descricao:'Juros — '+(f.banco||'')+' parcela '+p.n+'/'+(f.parcelas.length),
        placa:f.placa||'', centro:f.veiculoId? 'cc.v.'+f.veiculoId : 'cc.financ', veiculoId:f.veiculoId||'',
        derivado:true });
    });
  });

  /* LANÇAMENTOS MANUAIS — digitados na própria Contabilidade */
  contabManuais().forEach(function(m){
    out.push(Object.assign({}, m, { origem:'Manual', origemId:'manual', rota:'contabilidade',
      grupo:contabGrupoDe(m.conta), derivado:false,
      competencia:m.competencia||String(m.data||'').slice(0,7) }));
  });

  return out.sort(function(a,b){ return String(b.data||'').localeCompare(String(a.data||'')); });
}

/* ---- filtro por período ---- */
function contabPeriodo(lanc, ini, fim){
  return lanc.filter(function(l){
    const d=l.data||''; if(!d) return false;
    return (!ini || d>=ini) && (!fim || d<=fim);
  });
}
function contabIntervalo(chave, ref){
  const h=ref? parseD(ref) : hoje();
  const y=h.getFullYear(), m=h.getMonth();
  const iso=function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  switch(chave){
    case 'hoje':      return {ini:iso(h), fim:iso(h), rot:'Hoje'};
    case 'semana':    { const s=new Date(y,m,h.getDate()-h.getDay()); const e=new Date(y,m,h.getDate()-h.getDay()+6);
                        return {ini:iso(s), fim:iso(e), rot:'Semana'}; }
    case 'mes':       return {ini:iso(new Date(y,m,1)), fim:iso(new Date(y,m+1,0)), rot:'Mês'};
    case 'trimestre': { const q=Math.floor(m/3)*3; return {ini:iso(new Date(y,q,1)), fim:iso(new Date(y,q+3,0)), rot:'Trimestre'}; }
    case 'ano':       return {ini:y+'-01-01', fim:y+'-12-31', rot:'Ano'};
    case 'tudo':      return {ini:'', fim:'', rot:'Tudo'};
    default:          return {ini:iso(new Date(y,m,1)), fim:iso(new Date(y,m+1,0)), rot:'Mês'};
  }
}
/* período anterior de mesmo tamanho, para comparação */
function contabAnterior(iv){
  if(!iv.ini||!iv.fim) return {ini:'',fim:''};
  const a=parseD(iv.ini), b=parseD(iv.fim);
  const dias=Math.round((b-a)/86400000)+1;
  const fim=new Date(a.getTime()-86400000), ini=new Date(fim.getTime()-(dias-1)*86400000);
  const iso=function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  return {ini:iso(ini), fim:iso(fim)};
}

/* ==================================================================
   5) DRE — soma por grupo
   ================================================================== */
function contabDRE(lanc){
  const soma=function(g){ return lanc.filter(function(l){ return l.grupo===g; }).reduce(function(s,l){ return s+l.valor; },0); };
  const receita=soma('receita'), deducao=soma('deducao'), custo=soma('custo');
  const despesa=soma('despesa'), financeira=soma('financeira'), imposto=soma('imposto');
  const liquida=receita-deducao;
  const bruto=liquida-custo;
  const operacional=bruto-despesa;
  const resultado=operacional-financeira-imposto;
  const deprec=lanc.filter(function(l){ return l.conta==='c.deprec'; }).reduce(function(s,l){ return s+l.valor; },0);
  return { receita, deducao, liquida, custo, bruto, despesa, operacional,
    financeira, imposto, resultado, deprec,
    ebitda: operacional + deprec,
    margem: liquida? (resultado/liquida*100) : 0 };
}

/* ==================================================================
   6) POR VEÍCULO — receita, custo, resultado, custo/km
   ================================================================== */
function contabPorVeiculo(lanc){
  const mapa={};
  (DB.veiculos||[]).forEach(function(v){
    if(v.status==='Arquivado') return;
    mapa[v.id]={ veiculo:v, receita:0, custo:0, contas:{}, km:_contabNum(v.kmAtual) };
  });
  lanc.forEach(function(l){
    if(!l.veiculoId || !mapa[l.veiculoId]) return;
    const m=mapa[l.veiculoId];
    if(l.grupo==='receita') m.receita+=l.valor;
    else { m.custo+=l.valor; m.contas[l.conta]=(m.contas[l.conta]||0)+l.valor; }
  });
  return Object.values(mapa).map(function(m){
    m.resultado=m.receita-m.custo;
    m.margem=m.receita? (m.resultado/m.receita*100) : 0;
    /* km rodados no período não existem no sistema; usamos o odômetro atual
       só como referência e deixamos claro na tela */
    m.custoKm=m.km? m.custo/m.km : 0;
    m.receitaKm=m.km? m.receita/m.km : 0;
    m.lucroKm=m.km? m.resultado/m.km : 0;
    return m;
  }).sort(function(a,b){ return b.custo-a.custo; });
}
function contabPorConta(lanc){
  const mapa={};
  lanc.forEach(function(l){ if(!mapa[l.conta]) mapa[l.conta]={conta:l.conta, grupo:l.grupo, valor:0, n:0};
    mapa[l.conta].valor+=l.valor; mapa[l.conta].n++; });
  return Object.values(mapa).sort(function(a,b){ return b.valor-a.valor; });
}
function contabPorCentro(lanc){
  const mapa={};
  lanc.forEach(function(l){ const c=l.centro||'—';
    if(!mapa[c]) mapa[c]={centro:c, receita:0, custo:0, n:0};
    if(l.grupo==='receita') mapa[c].receita+=l.valor; else mapa[c].custo+=l.valor;
    mapa[c].n++; });
  return Object.values(mapa).sort(function(a,b){ return b.custo-a.custo; });
}
/* evolução mês a mês (para o gráfico) */
function contabPorMes(lanc, meses){
  const mapa={};
  lanc.forEach(function(l){ const c=l.competencia; if(!c) return;
    if(!mapa[c]) mapa[c]={comp:c, receita:0, custo:0};
    if(l.grupo==='receita') mapa[c].receita+=l.valor; else mapa[c].custo+=l.valor; });
  const arr=Object.values(mapa).sort(function(a,b){ return a.comp.localeCompare(b.comp); });
  arr.forEach(function(m){ m.resultado=m.receita-m.custo; });
  return meses? arr.slice(-meses) : arr;
}

/* ==================================================================
   7) AUDITORIA
   ================================================================== */
function contabAudit(){ if(!Array.isArray(DB.contabAudit)) DB.contabAudit=[]; return DB.contabAudit; }
function contabLog(acao, registro, antes, depois, obs){
  const l=contabAudit();
  l.unshift({ id:uid('au'), quando:new Date().toISOString(),
    usuario:(typeof nomeUsuario==='function'? nomeUsuario():'')||'local',
    acao:acao, registro:registro||'', antes:antes==null?'':String(antes), depois:depois==null?'':String(depois),
    obs:obs||'' });
  if(l.length>500) l.length=500;
}

/* ==================================================================
   8) FECHAMENTO POR COMPETÊNCIA
   ================================================================== */
function contabFech(){ if(!Array.isArray(DB.contabFech)) DB.contabFech=[]; return DB.contabFech; }
function contabFechada(comp){ return contabFech().some(function(f){ return f.competencia===comp && f.fechada; }); }
function contabPendencias(comp){
  const pend=[];
  const lanc=contabLancamentos().filter(function(l){ return l.competencia===comp; });
  if(!lanc.length) pend.push({t:'Sem lançamentos nesta competência', n:0});
  const semData=lanc.filter(function(l){ return !l.data; });
  if(semData.length) pend.push({t:'Lançamentos sem data', n:semData.length});
  const semCentro=lanc.filter(function(l){ return !l.centro; });
  if(semCentro.length) pend.push({t:'Lançamentos sem centro de custo', n:semCentro.length});
  const trib=(DB.contabTributos||[]).filter(function(t){ return t.competencia===comp && !t.pago; });
  if(trib.length) pend.push({t:'Tributos em aberto', n:trib.length});
  const rec=lanc.filter(function(l){ return l.grupo==='receita'; });
  if(!rec.length) pend.push({t:'Nenhuma receita lançada', n:0});
  return pend;
}

/* ==================================================================
   9) TELA — abas: Painel · DRE · Veículos · Lançamentos · Ativos ·
      Financiamentos · Tributos · Fechamento · Auditoria · Relatórios
   ================================================================== */
let contabAba='painel', contabPer='mes', contabIni='', contabFim='', contabBusca='', contabFiltroGrupo='todos';

function contabIV(){
  if(contabPer==='custom' && (contabIni||contabFim)) return {ini:contabIni, fim:contabFim, rot:'Período'};
  return contabIntervalo(contabPer);
}
function viewContabilidade(){
  const iv=contabIV();
  const todos=contabLancamentos();
  const lanc=contabPeriodo(todos, iv.ini, iv.fim);
  const dre=contabDRE(lanc);
  const ant=contabAnterior(iv);
  const dreAnt=contabDRE(contabPeriodo(todos, ant.ini, ant.fim));

  const abas=[['painel','Painel'],['dre','DRE'],['veiculos','Por veículo'],['lanc','Lançamentos'],
    ['ativos','Ativos'],['financ','Financiamentos'],['tributos','Tributos'],
    ['fech','Fechamento'],['audit','Auditoria'],['rel','Relatórios'],['plano','Plano de contas']];
  /* Aba desconhecida (endereço antigo, link salvo, erro de digitação) cairia
     em nenhum dos ifs abaixo e a tela abriria vazia — volta para o Painel. */
  if(!abas.some(function(a){ return a[0]===contabAba; })) contabAba='painel';
  const abaHTML='<div class="cb-abas no-print">'+abas.map(function(a){
    return '<button class="cb-aba'+(contabAba===a[0]?' on':'')+'" onclick="contabSetAba(\''+a[0]+'\')">'+a[1]+'</button>'; }).join('')+'</div>';

  const pers=[['hoje','Hoje'],['semana','Semana'],['mes','Mês'],['trimestre','Trimestre'],['ano','Ano'],['tudo','Tudo']];
  const perHTML='<div class="cb-per no-print">'+pers.map(function(p){
    return '<button class="cb-p'+(contabPer===p[0]?' on':'')+'" onclick="contabSetPer(\''+p[0]+'\')">'+p[1]+'</button>'; }).join('')
    +'<span class="cb-perlbl">'+(iv.ini? fmtD(iv.ini)+' a '+fmtD(iv.fim) : 'todo o período')+'</span>'
    +'<button class="cb-p" onclick="contabPeriodoCustom()">'+svg('cal')+' Personalizado</button></div>';

  let corpo='';
  if(contabAba==='painel')        corpo=contabPainel(lanc, dre, dreAnt, todos);
  else if(contabAba==='dre')      corpo=contabViewDRE(dre, dreAnt, todos, iv);
  else if(contabAba==='veiculos') corpo=contabViewVeiculos(lanc);
  else if(contabAba==='lanc')     corpo=contabViewLanc(lanc);
  else if(contabAba==='ativos')   corpo=contabViewAtivos();
  else if(contabAba==='financ')   corpo=contabViewFinanc();
  else if(contabAba==='tributos') corpo=contabViewTributos();
  else if(contabAba==='fech')     corpo=contabViewFech();
  else if(contabAba==='audit')    corpo=contabViewAudit();
  else if(contabAba==='rel')      corpo=contabViewRel();
  else if(contabAba==='plano')    corpo=contabViewPlano();

  const semDado = !todos.length;
  return ''
  +'<div class="banner">'+svg('coins')+'<div><b>Contabilidade</b>'
    +'<span>Núcleo contábil da operação. Os lançamentos são lidos dos módulos que você já usa — CT-e, abastecimentos, pedágios, manutenção, seguros, descargas e financeiro — sem cadastrar nada duas vezes.</span></div>'
    +'<div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">'
      +'<button class="btn" onclick="cpidEscolher(\'Contabilidade\')" title="Manda o documento para a Central, que lê e lança">'+svg('upload')+' Importar documento</button>'
      +'<button class="btn primary" onclick="contabModalLanc()">'+svg('plus')+' Lançamento</button></div></div>'
  + perHTML + abaHTML
  + (semDado? '<div class="card"><div class="card-b">'+emptyState('Ainda não há valores nos módulos. Lance um abastecimento, um CT-e ou importe o relatório do contador — a Contabilidade preenche sozinha.')+'</div></div>' : corpo);
}
function contabSetAba(a){ contabAba=a; router(); }
function contabSetPer(p){ contabPer=p; contabIni=''; contabFim=''; router(); }
function contabPeriodoCustom(){
  openModal('<div class="m-h">'+svg('cal')+'<h3>Período personalizado</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b"><div class="field-row">'+fld('De','f_ci',contabIni||'','date')+fld('Até','f_cf',contabFim||'','date')+'</div></div>'
   +'<div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button>'
   +'<button class="btn primary" onclick="contabIni=val(\'f_ci\');contabFim=val(\'f_cf\');contabPer=\'custom\';closeModal();router()">Aplicar</button></div>');
}

/* ---- variação percentual entre períodos ---- */
function _cbVar(a,b){ if(!b) return null; return ((a-b)/Math.abs(b))*100; }
function _cbVarHTML(a,b,inverso){
  const v=_cbVar(a,b); if(v==null||!isFinite(v)) return '';
  const bom = inverso? v<0 : v>0;
  return '<span class="cb-var '+(bom?'up':'down')+'">'+(v>=0?'▲':'▼')+' '+Math.abs(v).toFixed(1)+'%</span>';
}

/* ---- PAINEL ---- */
function contabPainel(lanc, dre, dreAnt, todos){
  const kpi=function(rot,val,cor,sub,extra){
    return '<div class="cb-kpi"><span class="cb-k-rot">'+rot+'</span>'
      +'<span class="cb-k-val" style="color:'+cor+'">'+val+'</span>'
      +'<span class="cb-k-sub">'+(sub||'')+(extra||'')+'</span></div>'; };
  const rec=(DB.ctes||[]).filter(function(c){ return c.pago!=='Sim'; }).reduce(function(s,c){ return s+_contabNum(c.valor); },0);
  const pag=(DB.contabTributos||[]).filter(function(t){ return !t.pago; }).reduce(function(s,t){ return s+_contabNum(t.valor); },0)
    + (DB.contabFinanc||[]).reduce(function(s,f){ return s+_contabNum(f.saldo); },0);
  const evol=contabPorMes(todos, 12);
  const contas=contabPorConta(lanc).filter(function(c){ return c.grupo!=='receita'; }).slice(0,8);
  const maxC=Math.max.apply(null,[1].concat(contas.map(function(c){ return c.valor; })));

  return ''
  +'<div class="cb-kpis">'
    + kpi('Receita bruta', money(dre.receita), '#4bd6a0','', _cbVarHTML(dre.receita,dreAnt.receita))
    + kpi('Receita líquida', money(dre.liquida), '#4bd6a0','')
    + kpi('Custos operacionais', money(dre.custo), '#f2686b','', _cbVarHTML(dre.custo,dreAnt.custo,true))
    + kpi('Despesas', money(dre.despesa), '#f2a44e','')
    + kpi('Resultado operacional', money(dre.operacional), dre.operacional>=0?'#4bd6a0':'#f2686b','', _cbVarHTML(dre.operacional,dreAnt.operacional))
    + kpi(dre.resultado>=0?'Lucro do período':'Prejuízo do período', money(dre.resultado), dre.resultado>=0?'#4bd6a0':'#f2686b', 'margem '+dre.margem.toFixed(1)+'%')
    + kpi('EBITDA', money(dre.ebitda), '#5cc8ff','antes de depreciação')
    + kpi('Impostos', money(dre.imposto), '#8ea3bf','')
    + kpi('Contas a receber', money(rec), '#5cc8ff','CT-e em aberto')
    + kpi('Contas a pagar', money(pag), '#f2a44e','tributos + financiamentos')
  +'</div>'
  +'<div class="grid two-col" style="margin-bottom:16px">'
    +'<div class="card"><div class="card-h">'+svg('trend')+'<h3>Evolução — receita × custo</h3></div>'
      +'<div class="card-b">'+(evol.length? contabGrafico(evol) : emptyState('Sem histórico ainda.'))+'</div></div>'
    +'<div class="card"><div class="card-h">'+svg('coins')+'<h3>Para onde foi o dinheiro</h3></div>'
      +'<div class="card-b">'+(contas.length? '<div class="cb-barras">'+contas.map(function(c){
          return '<div class="cb-barra"><span class="cb-b-rot">'+esc(contabContaNome(c.conta))+'</span>'
            +'<span class="cb-b-tr"><i style="width:'+(c.valor/maxC*100).toFixed(1)+'%;background:'+(CONTAB_GRUPOS[c.grupo]||{}).cor+'"></i></span>'
            +'<span class="cb-b-val">'+money(c.valor)+'</span></div>'; }).join('')+'</div>'
        : emptyState('Sem custos no período.'))+'</div></div>'
  +'</div>';
}
/* gráfico de barras receita x custo por mês (SVG simples) */
function contabGrafico(evol){
  const W=560, H=190, pad=26;
  const max=Math.max.apply(null,[1].concat(evol.map(function(m){ return Math.max(m.receita,m.custo); })));
  const bw=(W-pad*2)/evol.length;
  let g='';
  evol.forEach(function(m,i){
    const x=pad+i*bw, hr=(m.receita/max)*(H-pad*2), hc=(m.custo/max)*(H-pad*2);
    g+='<rect class="cb-g-r" x="'+(x+bw*0.16).toFixed(1)+'" y="'+(H-pad-hr).toFixed(1)+'" width="'+(bw*0.3).toFixed(1)+'" height="'+hr.toFixed(1)+'" rx="2"/>';
    g+='<rect class="cb-g-c" x="'+(x+bw*0.52).toFixed(1)+'" y="'+(H-pad-hc).toFixed(1)+'" width="'+(bw*0.3).toFixed(1)+'" height="'+hc.toFixed(1)+'" rx="2"/>';
    g+='<text class="cb-g-x" x="'+(x+bw/2).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(m.comp.slice(5)+'/'+m.comp.slice(2,4))+'</text>';
  });
  return '<svg class="cb-graf" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
    +'<line class="cb-g-eixo" x1="'+pad+'" y1="'+(H-pad)+'" x2="'+(W-pad)+'" y2="'+(H-pad)+'"/>'+g+'</svg>'
    +'<div class="cb-leg"><span><i style="background:#4bd6a0"></i>Receita</span><span><i style="background:#f2686b"></i>Custo</span></div>';
}

/* ---- DRE ---- */
function contabViewDRE(dre, ant, todos, iv){
  const linha=function(rot,val,ante,cls,inv){
    const pct=dre.liquida? (val/dre.liquida*100) : 0;
    return '<tr class="'+(cls||'')+'"><td>'+rot+'</td>'
      +'<td class="ta-r mono">'+money(val)+'</td>'
      +'<td class="ta-r mono">'+pct.toFixed(1)+'%</td>'
      +'<td class="ta-r mono cb-ant">'+money(ante)+'</td>'
      +'<td class="ta-r">'+_cbVarHTML(val,ante,inv)+'</td></tr>'; };
  const evol=contabPorMes(todos, 12);
  return ''
  +'<div class="card" style="margin-bottom:16px"><div class="card-h">'+svg('doc')+'<h3>Demonstrativo de Resultado</h3>'
    +'<div class="r"><span class="muted" style="font-size:11.5px">'+(iv.ini? fmtD(iv.ini)+' a '+fmtD(iv.fim):'todo o período')+' · comparado ao período anterior</span></div></div>'
  +'<div class="tbl-wrap"><table class="tbl pex-noenh cb-dre">'
    +'<thead><tr><th>Conta</th><th class="ta-r">Valor</th><th class="ta-r">% receita</th><th class="ta-r">Anterior</th><th class="ta-r">Variação</th></tr></thead><tbody>'
    + linha('RECEITA BRUTA', dre.receita, ant.receita, 'cb-forte')
    + linha('(−) Deduções', dre.deducao, ant.deducao, '', true)
    + linha('= RECEITA LÍQUIDA', dre.liquida, ant.liquida, 'cb-sub')
    + linha('(−) Custos operacionais', dre.custo, ant.custo, '', true)
    + linha('= LUCRO BRUTO', dre.bruto, ant.bruto, 'cb-sub')
    + linha('(−) Despesas administrativas', dre.despesa, ant.despesa, '', true)
    + linha('= RESULTADO OPERACIONAL', dre.operacional, ant.operacional, 'cb-sub')
    + linha('(−) Despesas financeiras', dre.financeira, ant.financeira, '', true)
    + linha('(−) Impostos', dre.imposto, ant.imposto, '', true)
    + linha(dre.resultado>=0?'= LUCRO LÍQUIDO':'= PREJUÍZO', dre.resultado, ant.resultado, 'cb-total')
    +'</tbody></table></div></div>'
  +'<div class="card"><div class="card-h">'+svg('trend')+'<h3>Evolução mensal</h3></div>'
    +'<div class="card-b">'+(evol.length? contabGrafico(evol) : emptyState('Sem histórico.'))+'</div></div>';
}

/* ---- POR VEÍCULO ---- */
function contabViewVeiculos(lanc){
  const arr=contabPorVeiculo(lanc).filter(function(m){ return m.receita||m.custo; });
  if(!arr.length) return '<div class="card"><div class="card-b">'+emptyState('Nenhum custo ou receita ligado a veículo neste período.')+'</div></div>';
  return '<div class="cb-veics">'+arr.map(function(m){
    const v=m.veiculo;
    const contas=Object.keys(m.contas).sort(function(a,b){ return m.contas[b]-m.contas[a]; }).slice(0,6);
    return '<div class="card cb-veic"><div class="card-h">'+svg('truck')+'<h3>'+esc(v.placa)+'</h3>'
      +'<div class="r"><span class="muted" style="font-size:11.5px">'+esc((v.marca||'')+' '+(v.modelo||''))+'</span></div></div>'
      +'<div class="card-b">'
        +'<div class="cb-vgrid">'
          +'<div><small>Receita</small><b style="color:#4bd6a0">'+money(m.receita)+'</b></div>'
          +'<div><small>Custos</small><b style="color:#f2686b">'+money(m.custo)+'</b></div>'
          +'<div><small>Resultado</small><b style="color:'+(m.resultado>=0?'#4bd6a0':'#f2686b')+'">'+money(m.resultado)+'</b></div>'
          +'<div><small>Margem</small><b>'+(m.receita? m.margem.toFixed(1)+'%' : '—')+'</b></div>'
        +'</div>'
        +(m.km? '<div class="cb-vkm"><span>Custo/km <b>'+money(m.custoKm)+'</b></span>'
            +'<span>Receita/km <b>'+money(m.receitaKm)+'</b></span>'
            +'<span>Lucro/km <b>'+money(m.lucroKm)+'</b></span>'
            +'<i class="cb-vnota">sobre o odômetro atual ('+num(m.km)+' km) — o sistema ainda não guarda km rodado por período</i></div>' : '')
        +(contas.length? '<div class="cb-vcontas">'+contas.map(function(c){
            return '<span><small>'+esc(contabContaNome(c))+'</small><b>'+money(m.contas[c])+'</b></span>'; }).join('')+'</div>':'')
      +'</div></div>';
  }).join('')+'</div>';
}

/* ---- LANÇAMENTOS (lista + reclassificação) ---- */
function contabViewLanc(lanc){
  let lista=lanc.slice();
  if(contabFiltroGrupo!=='todos') lista=lista.filter(function(l){ return l.grupo===contabFiltroGrupo; });
  if(contabBusca){ const q=_contabNorm(contabBusca);
    lista=lista.filter(function(l){ return _contabNorm([l.descricao,l.placa,l.cliente,l.fornecedor,l.origem,contabContaNome(l.conta)].join(' ')).indexOf(q)>=0; }); }
  const chips='<div class="cb-chips no-print">'
    +['todos','receita','custo','despesa','financeira','imposto','deducao'].map(function(g){
      const n=g==='todos'? lanc.length : lanc.filter(function(l){ return l.grupo===g; }).length;
      if(!n && g!=='todos') return '';
      const rot=g==='todos'?'Todos':(CONTAB_GRUPOS[g]||{}).nome;
      return '<button class="cb-chip'+(contabFiltroGrupo===g?' on':'')+'" onclick="contabFiltroGrupo=\''+g+'\';router()">'+rot+' <b>'+n+'</b></button>';
    }).join('')+'</div>';
  const rows=lista.slice(0,400).map(function(l){
    const g=CONTAB_GRUPOS[l.grupo]||{};
    return '<tr class="clickable" onclick="contabAbrirLanc(\''+esc(l.id)+'\')">'
      +'<td class="mono" style="white-space:nowrap">'+fmtD(l.data)+'</td>'
      +'<td><b>'+esc(l.descricao||'—')+'</b>'+(l.placa?'<div class="muted" style="font-size:11px">'+esc(l.placa)+'</div>':'')+'</td>'
      +'<td><span class="cb-tag" style="--c:'+(g.cor||'#8ea3bf')+'">'+esc(contabContaNome(l.conta))+'</span>'
        +(l.reclassificado?'<span class="cb-recl" title="Reclassificado manualmente">•</span>':'')+'</td>'
      +'<td class="muted" style="font-size:11.5px">'+esc(contabCentroNome(l.centro))+'</td>'
      +'<td><span class="cb-origem">'+esc(l.origem)+'</span></td>'
      +'<td class="ta-r mono" style="color:'+(l.grupo==='receita'?'#4bd6a0':'#f2686b')+'">'
        +(l.grupo==='receita'?'+':'−')+' '+money(l.valor)+'</td></tr>';
  }).join('');
  return chips
   +'<div class="pex-tbar cb-bar no-print"><div class="lic-search">'+svg('search')
     +'<input id="cbBusca" type="search" placeholder="Buscar descrição, placa, cliente, fornecedor…" value="'+esc(contabBusca)+'" oninput="contabSetBusca(this.value)"></div>'
     +'<span class="muted" style="font-size:11.5px">'+lista.length+' lançamento(s)</span></div>'
   +'<div class="card"><div class="tbl-wrap"><table class="tbl pex-noenh">'
   +'<thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Centro de custo</th><th>Origem</th><th class="ta-r">Valor</th></tr></thead>'
   +'<tbody>'+(rows||'<tr><td colspan="6">'+emptyState('Nada neste filtro.')+'</td></tr>')+'</tbody></table></div>'
   +(lista.length>400?'<div class="card-b muted" style="font-size:11.5px">Mostrando os 400 mais recentes.</div>':'')+'</div>';
}
function contabSetBusca(v){ contabBusca=v;
  const el=document.getElementById('view'); if(!el) return;
  const foco=document.activeElement && document.activeElement.id==='cbBusca';
  const pos=foco? document.activeElement.selectionStart : null;
  el.innerHTML=viewContabilidade(); if(typeof pexAfterRender==='function') pexAfterRender('contabilidade');
  if(foco){ const n=document.getElementById('cbBusca'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} } }
}
/* abre o lançamento: mostra a origem e deixa reclassificar (sem duplicar) */
function contabAbrirLanc(id){
  const l=contabLancamentos().find(function(x){ return x.id===id; });
  if(!l){ toast('Lançamento não encontrado.','err'); return; }
  const contas=contabPlano().slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
  const centros=contabCentros();
  const anexo=(typeof anexoTipo==='function' && l.refId)? anexoTipo(l.origemId==='cte'?'empresa':'empresa', l.refId, /./) : null;
  openModal('<div class="m-h">'+svg('coins')+'<h3>Lançamento</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'
     +'<div class="cb-det"><span><small>Data</small><b>'+fmtD(l.data)+'</b></span>'
       +'<span><small>Competência</small><b>'+esc(l.competencia||'—')+'</b></span>'
       +'<span><small>Valor</small><b>'+money(l.valor)+'</b></span>'
       +'<span><small>Origem</small><b>'+esc(l.origem)+'</b></span></div>'
     +'<div class="cb-desc">'+esc(l.descricao||'')+'</div>'
     +(l.placa?'<div class="cb-det2">Veículo <b>'+esc(l.placa)+'</b></div>':'')
     +(l.cliente?'<div class="cb-det2">Cliente <b>'+esc(l.cliente)+'</b></div>':'')
     +(l.fornecedor?'<div class="cb-det2">Fornecedor <b>'+esc(l.fornecedor)+'</b></div>':'')
     +(l.documento?'<div class="cb-det2">Documento <b>'+esc(l.documento)+'</b></div>':'')
     +(l.chave?'<div class="cb-det2 mono" style="font-size:10.5px">Chave '+esc(l.chave)+'</div>':'')
     + msec('Classificação')
     +'<div class="field-row">'
       +'<div class="field"><label>Conta</label><select id="f_cbconta">'
         + contas.map(function(c){ return '<option value="'+c.id+'"'+(l.conta===c.id?' selected':'')+'>'+esc((CONTAB_GRUPOS[c.grupo]||{}).nome+' · '+c.nome)+'</option>'; }).join('')
       +'</select></div>'
       +'<div class="field"><label>Centro de custo</label><select id="f_cbcentro">'
         + centros.map(function(c){ return '<option value="'+c.id+'"'+(l.centro===c.id?' selected':'')+'>'+esc(c.nome)+'</option>'; }).join('')
       +'</select></div></div>'
     +'<div class="field"><label>Observação</label><input id="f_cbobs" value="'+esc(l.obs||'')+'"></div>'
     +(l.derivado? '<div class="hint">'+svg('spark')+' Este lançamento vem de <b>'+esc(l.origem)+'</b>. Mudar a conta aqui não altera o registro original — só a classificação contábil.</div>'
                 : '<div class="hint">Lançamento manual, criado na Contabilidade.</div>')
   +'</div>'
   +'<div class="m-f">'
     +(l.derivado? '<button class="btn" style="margin-right:auto" onclick="closeModal();location.hash=\'#'+esc(l.rota)+'\'">'+svg('eye')+' Ver na origem</button>'
                 : '<button class="btn danger" style="margin-right:auto" onclick="contabExcluirManual(\''+esc(l.id)+'\')">'+svg('trash')+' Excluir</button>')
     +'<button class="btn" onclick="closeModal()">Fechar</button>'
     +'<button class="btn primary" onclick="contabSalvarClass(\''+esc(l.id)+'\')">Salvar classificação</button></div>', true);
}
function contabSalvarClass(id){
  const l=contabLancamentos().find(function(x){ return x.id===id; }); if(!l) return;
  const conta=val('f_cbconta'), centro=val('f_cbcentro'), obs=val('f_cbobs');
  if(l.derivado){
    const o=contabClass(); const antes=o[id]||{};
    o[id]={conta:conta, centro:centro, obs:obs};
    if(antes.conta!==conta) contabLog('Reclassificação', l.descricao, contabContaNome(antes.conta||l.conta), contabContaNome(conta), 'origem '+l.origem);
  } else {
    const m=contabManuais().find(function(x){ return x.id===id; });
    if(m){ const antes=m.conta; m.conta=conta; m.centro=centro; m.obs=obs;
      if(antes!==conta) contabLog('Reclassificação', m.descricao, contabContaNome(antes), contabContaNome(conta), 'manual'); }
  }
  saveDB(); closeModal(); toast('Classificação salva.'); router();
}
/* ---- lançamento manual ---- */
function contabModalLanc(id){
  const m=id? contabManuais().find(function(x){ return x.id===id; }) : {data:new Date().toISOString().slice(0,10), conta:'a.outros', centro:'cc.admin'};
  const contas=contabPlano().slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
  openModal('<div class="m-h">'+svg('plus')+'<h3>'+(id?'Editar':'Novo')+' lançamento</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'
     +'<div class="field-row">'+fld('Data','f_ldata',m.data,'date')+fldR$('Valor (R$)','f_lvalor',m.valor)+'</div>'
     + fld('Descrição','f_ldesc',m.descricao)
     +'<div class="field-row">'
       +'<div class="field"><label>Conta</label><select id="f_lconta">'
         + contas.map(function(c){ return '<option value="'+c.id+'"'+(m.conta===c.id?' selected':'')+'>'+esc((CONTAB_GRUPOS[c.grupo]||{}).nome+' · '+c.nome)+'</option>'; }).join('')
       +'</select></div>'
       +'<div class="field"><label>Centro de custo</label><select id="f_lcentro">'
         + contabCentros().map(function(c){ return '<option value="'+c.id+'"'+(m.centro===c.id?' selected':'')+'>'+esc(c.nome)+'</option>'; }).join('')
       +'</select></div></div>'
     +'<div class="field-row">'+fld('Cliente / fornecedor','f_lparte',m.cliente||m.fornecedor)+fld('Documento','f_ldoc',m.documento)+'</div>'
     +'<div class="field"><label>Observação</label><input id="f_lobs" value="'+esc(m.obs||'')+'"></div>'
   +'</div>'
   +'<div class="m-f">'+(id?'<button class="btn danger" style="margin-right:auto" onclick="contabExcluirManual(\''+id+'\')">'+svg('trash')+' Excluir</button>':'')
     +'<button class="btn" onclick="closeModal()">Cancelar</button>'
     +'<button class="btn primary" onclick="contabSalvarLanc(\''+(id||'')+'\')">Salvar</button></div>', true);
}
function contabSalvarLanc(id){
  const valor=parseBRL(val('f_lvalor'));
  if(!valor){ toast('Informe o valor.','err'); return; }
  const conta=val('f_lconta');
  const d={ data:val('f_ldata'), valor:valor, descricao:val('f_ldesc')||contabContaNome(conta),
    conta:conta, centro:val('f_lcentro'), documento:val('f_ldoc'), obs:val('f_lobs'),
    competencia:String(val('f_ldata')||'').slice(0,7) };
  const parte=val('f_lparte');
  if(contabGrupoDe(conta)==='receita') d.cliente=parte; else d.fornecedor=parte;
  const lista=contabManuais();
  if(id){ const m=lista.find(function(x){ return x.id===id; });
    if(m){ const antes=m.valor; Object.assign(m,d);
      contabLog('Edição de lançamento', d.descricao, money(antes), money(valor)); } }
  else { d.id='manual:'+uid('mn'); lista.push(d);
    contabLog('Lançamento criado', d.descricao, '', money(valor)); }
  saveDB(); closeModal(); toast('Lançamento salvo.'); router();
}
function contabExcluirManual(id){
  if(!confirm('Excluir este lançamento?')) return;
  const m=contabManuais().find(function(x){ return x.id===id; });
  DB.contabManuais=contabManuais().filter(function(x){ return x.id!==id; });
  if(m) contabLog('Lançamento excluído', m.descricao, money(m.valor), '');
  saveDB(); closeModal(); toast('Excluído.'); router();
}

/* ---- ATIVO IMOBILIZADO ---- */
function contabViewAtivos(){
  if(!Array.isArray(DB.contabAtivos)) DB.contabAtivos=[];
  const arr=DB.contabAtivos;
  const hojeD=hoje();
  const calc=function(a){
    const vl=_contabNum(a.valor), vida=parseInt(a.vidaUtil)||0;
    const ini=parseD(a.aquisicao);
    let meses=0;
    if(ini) meses=Math.max(0,(hojeD.getFullYear()-ini.getFullYear())*12+(hojeD.getMonth()-ini.getMonth()));
    if(vida) meses=Math.min(meses, vida*12);
    const dep=vida? (vl/(vida*12))*meses : 0;
    return {dep:dep, contabil:vl-dep, meses:meses};
  };
  const tot=arr.reduce(function(s,a){ const c=calc(a); return {v:s.v+_contabNum(a.valor), d:s.d+c.dep, c:s.c+c.contabil}; },{v:0,d:0,c:0});
  const rows=arr.map(function(a){ const c=calc(a);
    return '<tr class="clickable" onclick="contabModalAtivo(\''+a.id+'\')">'
      +'<td><b>'+esc(a.descricao||'')+'</b>'+(a.placa?'<div class="muted" style="font-size:11px">'+esc(a.placa)+'</div>':'')+'</td>'
      +'<td>'+esc(a.categoria||'—')+'</td><td class="mono">'+fmtD(a.aquisicao)+'</td>'
      +'<td class="ta-r mono">'+money(_contabNum(a.valor))+'</td>'
      +'<td class="ta-r mono">'+(a.vidaUtil?a.vidaUtil+' anos':'—')+'</td>'
      +'<td class="ta-r mono">'+money(c.dep)+'</td>'
      +'<td class="ta-r mono"><b>'+money(c.contabil)+'</b></td></tr>'; }).join('');
  return '<div class="card"><div class="card-h">'+svg('truck')+'<h3>Ativo imobilizado</h3>'
    +'<div class="r no-print"><button class="btn sm primary" onclick="contabModalAtivo()">'+svg('plus')+' Ativo</button></div></div>'
    +(arr.length? '<div class="tbl-wrap"><table class="tbl pex-noenh"><thead><tr><th>Descrição</th><th>Categoria</th><th>Aquisição</th>'
      +'<th class="ta-r">Valor</th><th class="ta-r">Vida útil</th><th class="ta-r">Depreciação</th><th class="ta-r">Valor contábil</th></tr></thead>'
      +'<tbody>'+rows+'</tbody><tfoot><tr class="cb-total"><td colspan="3">TOTAL</td>'
      +'<td class="ta-r mono">'+money(tot.v)+'</td><td></td><td class="ta-r mono">'+money(tot.d)+'</td>'
      +'<td class="ta-r mono">'+money(tot.c)+'</td></tr></tfoot></table></div>'
      : '<div class="card-b">'+emptyState('Nenhum ativo cadastrado. Inclua os cavalos, carretas e equipamentos para o sistema calcular a depreciação.')+'</div>')
    +'</div>';
}
function contabModalAtivo(id){
  if(!Array.isArray(DB.contabAtivos)) DB.contabAtivos=[];
  const a=id? DB.contabAtivos.find(function(x){ return x.id===id; }) : {categoria:'Veículo', vidaUtil:5};
  const veics=(DB.veiculos||[]).filter(function(v){ return v.status!=='Arquivado'; });
  openModal('<div class="m-h">'+svg('truck')+'<h3>'+(id?'Editar':'Novo')+' ativo</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'
     + fld('Descrição','f_ades',a.descricao)
     +'<div class="field-row">'
       +'<div class="field"><label>Categoria</label><select id="f_acat">'
         +['Veículo','Cavalo mecânico','Carreta','Implemento','Equipamento','Computador','Móveis','Outro']
           .map(function(o){ return '<option'+(a.categoria===o?' selected':'')+'>'+o+'</option>'; }).join('')+'</select></div>'
       +'<div class="field"><label>Vínculo com a frota</label><select id="f_aveic"><option value="">— nenhum —</option>'
         + veics.map(function(v){ return '<option value="'+v.id+'"'+(a.veiculoId===v.id?' selected':'')+'>'+esc(v.placa)+'</option>'; }).join('')+'</select></div></div>'
     +'<div class="field-row">'+fld('Data de aquisição','f_adata',a.aquisicao,'date')+fldR$('Valor de aquisição (R$)','f_aval',a.valor)+'</div>'
     +'<div class="field-row">'+fld('Vida útil (anos)','f_avida',a.vidaUtil,'number')+fld('Fornecedor','f_aforn',a.fornecedor)+'</div>'
     +'<div class="field-row">'+fld('Nota fiscal','f_anf',a.nf)+fld('Localização','f_aloc',a.local)+'</div>'
     +'<div class="hint">A depreciação é linear e entra sozinha no DRE e no custo do veículo.</div>'
   +'</div>'
   +'<div class="m-f">'+(id?'<button class="btn danger" style="margin-right:auto" onclick="contabExcluirAtivo(\''+id+'\')">'+svg('trash')+' Excluir</button>':'')
     +'<button class="btn" onclick="closeModal()">Cancelar</button>'
     +'<button class="btn primary" onclick="contabSalvarAtivo(\''+(id||'')+'\')">Salvar</button></div>', true);
}
function contabSalvarAtivo(id){
  const veicId=val('f_aveic');
  const v=(DB.veiculos||[]).find(function(x){ return x.id===veicId; });
  const d={ descricao:val('f_ades'), categoria:val('f_acat'), veiculoId:veicId, placa:v?v.placa:'',
    aquisicao:val('f_adata'), valor:parseBRL(val('f_aval')), vidaUtil:parseInt(val('f_avida'))||0,
    fornecedor:val('f_aforn'), nf:val('f_anf'), local:val('f_aloc') };
  if(!d.descricao){ toast('Informe a descrição.','err'); return; }
  if(id){ const a=DB.contabAtivos.find(function(x){ return x.id===id; }); if(a){ Object.assign(a,d); contabLog('Ativo editado', d.descricao); } }
  else { d.id=uid('at'); DB.contabAtivos.push(d); contabLog('Ativo cadastrado', d.descricao, '', money(d.valor)); }
  saveDB(); closeModal(); toast('Ativo salvo.'); router();
}
function contabExcluirAtivo(id){
  if(!confirm('Excluir este ativo? A depreciação dele sai do DRE.')) return;
  const a=DB.contabAtivos.find(function(x){ return x.id===id; });
  DB.contabAtivos=DB.contabAtivos.filter(function(x){ return x.id!==id; });
  if(a) contabLog('Ativo excluído', a.descricao);
  saveDB(); closeModal(); toast('Excluído.'); router();
}

/* ---- FINANCIAMENTOS ---- */
function contabViewFinanc(){
  if(!Array.isArray(DB.contabFinanc)) DB.contabFinanc=[];
  const arr=DB.contabFinanc;
  const tot=arr.reduce(function(s,f){ return {o:s.o+_contabNum(f.valor), sd:s.sd+_contabNum(f.saldo)}; },{o:0,sd:0});
  const rows=arr.map(function(f){
    const pagas=(f.parcelas||[]).filter(function(p){ return p.pago; }).length;
    const n=(f.parcelas||[]).length;
    return '<tr class="clickable" onclick="contabModalFinanc(\''+f.id+'\')">'
      +'<td><b>'+esc(f.banco||'—')+'</b><div class="muted" style="font-size:11px">'+esc(f.contrato||'')+'</div></td>'
      +'<td>'+esc(f.placa||'—')+'</td>'
      +'<td class="ta-r mono">'+money(_contabNum(f.valor))+'</td>'
      +'<td class="ta-r mono">'+pagas+'/'+n+'</td>'
      +'<td class="ta-r mono">'+(f.taxa?f.taxa+'% a.m.':'—')+'</td>'
      +'<td class="ta-r mono"><b>'+money(_contabNum(f.saldo))+'</b></td></tr>'; }).join('');
  return '<div class="card"><div class="card-h">'+svg('wallet')+'<h3>Financiamentos</h3>'
    +'<div class="r no-print"><button class="btn sm primary" onclick="contabModalFinanc()">'+svg('plus')+' Financiamento</button></div></div>'
    +(arr.length? '<div class="tbl-wrap"><table class="tbl pex-noenh"><thead><tr><th>Banco / contrato</th><th>Veículo</th>'
      +'<th class="ta-r">Valor original</th><th class="ta-r">Parcelas</th><th class="ta-r">Taxa</th><th class="ta-r">Saldo devedor</th></tr></thead>'
      +'<tbody>'+rows+'</tbody><tfoot><tr class="cb-total"><td colspan="2">TOTAL</td>'
      +'<td class="ta-r mono">'+money(tot.o)+'</td><td></td><td></td><td class="ta-r mono">'+money(tot.sd)+'</td></tr></tfoot></table></div>'
      : '<div class="card-b">'+emptyState('Nenhum financiamento cadastrado.')+'</div>')+'</div>';
}
function contabModalFinanc(id){
  if(!Array.isArray(DB.contabFinanc)) DB.contabFinanc=[];
  const f=id? DB.contabFinanc.find(function(x){ return x.id===id; }) : {parcelas:[]};
  const veics=(DB.veiculos||[]).filter(function(v){ return v.status!=='Arquivado'; });
  openModal('<div class="m-h">'+svg('wallet')+'<h3>'+(id?'Editar':'Novo')+' financiamento</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'
     +'<div class="field-row">'+fld('Banco','f_fbanco',f.banco)+fld('Contrato','f_fcontrato',f.contrato)+'</div>'
     +'<div class="field-row">'
       +'<div class="field"><label>Veículo</label><select id="f_fveic"><option value="">— nenhum —</option>'
         + veics.map(function(v){ return '<option value="'+v.id+'"'+(f.veiculoId===v.id?' selected':'')+'>'+esc(v.placa)+'</option>'; }).join('')+'</select></div>'
       + fld('Data do contrato','f_fdata',f.data,'date')+'</div>'
     +'<div class="field-row">'+fldR$('Valor financiado (R$)','f_fvalor',f.valor)+fldR$('Entrada (R$)','f_fentrada',f.entrada)+'</div>'
     +'<div class="field-row">'+fld('Nº de parcelas','f_fnp',f.np,'number')+fld('Taxa (% ao mês)','f_ftaxa',f.taxa)+'</div>'
     +'<div class="field-row">'+fldR$('Valor da parcela (R$)','f_fparc',f.parcela)+fld('1º vencimento','f_fvenc',f.venc1,'date')+'</div>'
     +'<div class="field-row">'+fldR$('Saldo devedor (R$)','f_fsaldo',f.saldo)+fld('Parcela atual','f_fatual',f.atual,'number')+'</div>'
     +'<div class="hint">Ao salvar, o sistema gera a tabela de parcelas e lança os juros como despesa financeira no DRE.</div>'
   +'</div>'
   +'<div class="m-f">'+(id?'<button class="btn danger" style="margin-right:auto" onclick="contabExcluirFinanc(\''+id+'\')">'+svg('trash')+' Excluir</button>':'')
     +'<button class="btn" onclick="closeModal()">Cancelar</button>'
     +'<button class="btn primary" onclick="contabSalvarFinanc(\''+(id||'')+'\')">Salvar</button></div>', true);
}
function contabSalvarFinanc(id){
  const veicId=val('f_fveic'); const v=(DB.veiculos||[]).find(function(x){ return x.id===veicId; });
  const np=parseInt(val('f_fnp'))||0, parcela=parseBRL(val('f_fparc')), valor=parseBRL(val('f_fvalor'));
  const d={ banco:val('f_fbanco'), contrato:val('f_fcontrato'), veiculoId:veicId, placa:v?v.placa:'',
    data:val('f_fdata'), valor:valor, entrada:parseBRL(val('f_fentrada')), np:np,
    taxa:val('f_ftaxa'), parcela:parcela, venc1:val('f_fvenc'),
    saldo:parseBRL(val('f_fsaldo')), atual:parseInt(val('f_fatual'))||0 };
  /* tabela de parcelas: juros = (total das parcelas − financiado) rateado */
  d.parcelas=[];
  if(np && parcela && d.venc1){
    const jurosTotal=Math.max(0, parcela*np - valor);
    const jm=jurosTotal/np;
    const ini=parseD(d.venc1);
    for(let i=0;i<np;i++){
      const dt=new Date(ini.getFullYear(), ini.getMonth()+i, ini.getDate());
      d.parcelas.push({ n:i+1, vencimento:dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'),
        valor:parcela, juros:jm, pago:(i+1)<=d.atual });
    }
  }
  if(!d.banco){ toast('Informe o banco.','err'); return; }
  if(id){ const f=DB.contabFinanc.find(function(x){ return x.id===id; }); if(f){ Object.assign(f,d); contabLog('Financiamento editado', d.banco); } }
  else { d.id=uid('fi'); DB.contabFinanc.push(d); contabLog('Financiamento cadastrado', d.banco+' '+d.contrato, '', money(valor)); }
  saveDB(); closeModal(); toast('Financiamento salvo.'); router();
}
function contabExcluirFinanc(id){
  if(!confirm('Excluir este financiamento?')) return;
  const f=DB.contabFinanc.find(function(x){ return x.id===id; });
  DB.contabFinanc=DB.contabFinanc.filter(function(x){ return x.id!==id; });
  if(f) contabLog('Financiamento excluído', f.banco);
  saveDB(); closeModal(); toast('Excluído.'); router();
}

/* ---- TRIBUTOS ---- */
function contabViewTributos(){
  if(!Array.isArray(DB.contabTributos)) DB.contabTributos=[];
  const arr=DB.contabTributos.slice().sort(function(a,b){ return String(b.competencia||'').localeCompare(String(a.competencia||'')); });
  const aberto=arr.filter(function(t){ return !t.pago; }).reduce(function(s,t){ return s+_contabNum(t.valor); },0);
  const pago=arr.filter(function(t){ return t.pago; }).reduce(function(s,t){ return s+_contabNum(t.valor); },0);
  const rows=arr.map(function(t){
    const venc=diasAte(t.vencimento);
    const st=t.pago? '<span class="st ok">Pago</span>'
      : (venc!=null&&venc<0? '<span class="st vencido">Vencido</span>' : '<span class="st warn">Em aberto</span>');
    return '<tr class="clickable" onclick="contabModalTributo(\''+t.id+'\')">'
      +'<td><b>'+esc(contabContaNome(t.conta))+'</b></td>'
      +'<td class="mono">'+esc(t.competencia||'—')+'</td>'
      +'<td class="mono">'+fmtD(t.vencimento)+'</td>'
      +'<td class="ta-r mono">'+money(_contabNum(t.valor))+'</td>'
      +'<td>'+st+'</td></tr>'; }).join('');
  return '<div class="card"><div class="card-h">'+svg('shield')+'<h3>Tributos</h3>'
    +'<div class="r"><span class="muted" style="font-size:11.5px">em aberto '+money(aberto)+' · pago '+money(pago)+'</span>'
    +'<button class="btn sm primary no-print" onclick="contabModalTributo()">'+svg('plus')+' Tributo</button></div></div>'
    +'<div class="card-b" style="padding-bottom:0"><div class="hint">'+svg('shield')
      +' O sistema não calcula imposto sozinho — a apuração é do seu contador. Aqui você registra o que foi apurado, e os valores entram no DRE e no fechamento.</div></div>'
    +(arr.length? '<div class="tbl-wrap"><table class="tbl pex-noenh"><thead><tr><th>Tributo</th><th>Competência</th>'
      +'<th>Vencimento</th><th class="ta-r">Valor</th><th>Situação</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      : '<div class="card-b">'+emptyState('Nenhum tributo lançado.')+'</div>')+'</div>';
}
function contabModalTributo(id){
  if(!Array.isArray(DB.contabTributos)) DB.contabTributos=[];
  const t=id? DB.contabTributos.find(function(x){ return x.id===id; }) : {conta:'i.icms', competencia:new Date().toISOString().slice(0,7)};
  const imp=contabPlano().filter(function(c){ return c.grupo==='imposto'; });
  openModal('<div class="m-h">'+svg('shield')+'<h3>'+(id?'Editar':'Novo')+' tributo</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'
     +'<div class="field-row">'
       +'<div class="field"><label>Tributo</label><select id="f_tconta">'
         + imp.map(function(c){ return '<option value="'+c.id+'"'+(t.conta===c.id?' selected':'')+'>'+esc(c.nome)+'</option>'; }).join('')+'</select></div>'
       + fld('Competência (AAAA-MM)','f_tcomp',t.competencia,'text','Ex.: 2026-08')+'</div>'
     +'<div class="field-row">'+fldR$('Valor (R$)','f_tvalor',t.valor)+fld('Vencimento','f_tvenc',t.vencimento,'date')+'</div>'
     +'<div class="field-row"><div class="field"><label>Situação</label><select id="f_tpago">'
       +'<option value="">Em aberto</option><option value="1"'+(t.pago?' selected':'')+'>Pago</option></select></div>'
       + fld('Documento / guia','f_tdoc',t.doc)+'</div>'
     +'<div class="field"><label>Observação</label><input id="f_tobs" value="'+esc(t.obs||'')+'"></div>'
   +'</div>'
   +'<div class="m-f">'+(id?'<button class="btn danger" style="margin-right:auto" onclick="contabExcluirTributo(\''+id+'\')">'+svg('trash')+' Excluir</button>':'')
     +'<button class="btn" onclick="closeModal()">Cancelar</button>'
     +'<button class="btn primary" onclick="contabSalvarTributo(\''+(id||'')+'\')">Salvar</button></div>', true);
}
function contabSalvarTributo(id){
  const d={ conta:val('f_tconta'), competencia:val('f_tcomp'), valor:parseBRL(val('f_tvalor')),
    vencimento:val('f_tvenc'), pago:!!val('f_tpago'), doc:val('f_tdoc'), obs:val('f_tobs') };
  if(!d.valor){ toast('Informe o valor.','err'); return; }
  if(id){ const t=DB.contabTributos.find(function(x){ return x.id===id; });
    if(t){ const antes=t.valor; Object.assign(t,d); contabLog('Tributo editado', contabContaNome(d.conta)+' '+d.competencia, money(antes), money(d.valor)); } }
  else { d.id=uid('tr'); DB.contabTributos.push(d); contabLog('Tributo lançado', contabContaNome(d.conta)+' '+d.competencia, '', money(d.valor)); }
  saveDB(); closeModal(); toast('Tributo salvo.'); router();
}
function contabExcluirTributo(id){
  if(!confirm('Excluir este tributo?')) return;
  const t=DB.contabTributos.find(function(x){ return x.id===id; });
  DB.contabTributos=DB.contabTributos.filter(function(x){ return x.id!==id; });
  if(t) contabLog('Tributo excluído', contabContaNome(t.conta));
  saveDB(); closeModal(); toast('Excluído.'); router();
}

/* ---- FECHAMENTO ---- */
function contabViewFech(){
  const comps={};
  contabLancamentos().forEach(function(l){ if(l.competencia) comps[l.competencia]=1; });
  const lista=Object.keys(comps).sort().reverse().slice(0,18);
  if(!lista.length) return '<div class="card"><div class="card-b">'+emptyState('Sem competências ainda.')+'</div></div>';
  return '<div class="cb-fechs">'+lista.map(function(c){
    const fechada=contabFechada(c);
    const pend=fechada? [] : contabPendencias(c);
    const lanc=contabPeriodo(contabLancamentos(), c+'-01', c+'-31');
    const dre=contabDRE(lanc);
    const f=contabFech().find(function(x){ return x.competencia===c; });
    return '<div class="card cb-fech'+(fechada?' ok':'')+'"><div class="card-h">'+svg('cal')
      +'<h3>'+esc(_cbMesNome(c))+'</h3><div class="r">'
      +(fechada? '<span class="st ok">'+svg('lock')+' Encerrada</span>' : (pend.length? '<span class="st warn">'+pend.length+' pendência(s)</span>' : '<span class="st ok">Pronta</span>'))
      +'</div></div><div class="card-b">'
      +'<div class="cb-fgrid"><span><small>Receita</small><b style="color:#4bd6a0">'+money(dre.receita)+'</b></span>'
        +'<span><small>Custos</small><b style="color:#f2686b">'+money(dre.custo)+'</b></span>'
        +'<span><small>Resultado</small><b style="color:'+(dre.resultado>=0?'#4bd6a0':'#f2686b')+'">'+money(dre.resultado)+'</b></span>'
        +'<span><small>Lançamentos</small><b>'+lanc.length+'</b></span></div>'
      +(pend.length? '<ul class="cb-pend">'+pend.map(function(p){ return '<li>'+esc(p.t)+(p.n?' <b>('+p.n+')</b>':'')+'</li>'; }).join('')+'</ul>':'')
      +(fechada? '<div class="cb-fnota">'+svg('lock')+' Fechada em '+fmtD((f&&f.quando||'').slice(0,10))+' por '+esc(f&&f.usuario||'')
          +'<button class="btn ghost sm no-print" onclick="contabReabrir(\''+c+'\')">Reabrir</button></div>'
        : '<div class="no-print" style="margin-top:10px"><button class="btn primary sm" onclick="contabFechar(\''+c+'\')">'+svg('check')+' Fechar competência</button></div>')
      +'</div></div>'; }).join('')+'</div>';
}
function _cbMesNome(c){
  const p=String(c||'').split('-'); if(p.length<2) return c;
  return (MESES_L[parseInt(p[1])-1]||'')+'/'+p[0];
}
function contabFechar(comp){
  const pend=contabPendencias(comp);
  if(pend.length && !confirm('Esta competência tem '+pend.length+' pendência(s).\n\n'+pend.map(function(p){ return '• '+p.t; }).join('\n')+'\n\nFechar mesmo assim?')) return;
  const l=contabFech();
  const j=l.find(function(x){ return x.competencia===comp; });
  const reg={ competencia:comp, fechada:true, quando:new Date().toISOString(),
    usuario:(typeof nomeUsuario==='function'? nomeUsuario():'')||'local', pendencias:pend.length };
  if(j) Object.assign(j,reg); else l.push(reg);
  contabLog('Competência fechada', _cbMesNome(comp), '', 'encerrada', pend.length? pend.length+' pendência(s) no fechamento':'');
  saveDB(); toast('Competência '+_cbMesNome(comp)+' encerrada.'); router();
}
function contabReabrir(comp){
  if(!confirm('Reabrir '+_cbMesNome(comp)+'?\n\nA reabertura fica registrada na auditoria.')) return;
  const f=contabFech().find(function(x){ return x.competencia===comp; });
  if(f){ f.fechada=false; f.reabertoEm=new Date().toISOString(); }
  contabLog('Competência reaberta', _cbMesNome(comp), 'encerrada', 'aberta');
  saveDB(); toast('Competência reaberta.'); router();
}

/* ---- AUDITORIA ---- */
function contabViewAudit(){
  const l=contabAudit();
  if(!l.length) return '<div class="card"><div class="card-b">'+emptyState('Nenhuma alteração registrada ainda.')+'</div></div>';
  return '<div class="card"><div class="card-h">'+svg('doc')+'<h3>Auditoria</h3>'
    +'<div class="r"><span class="muted" style="font-size:11.5px">'+l.length+' registro(s)</span></div></div>'
    +'<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Registro</th><th>Antes</th><th>Depois</th></tr></thead><tbody>'
    + l.slice(0,300).map(function(a){ const d=new Date(a.quando);
      return '<tr><td class="mono" style="white-space:nowrap">'+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '
        +String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</td>'
        +'<td>'+esc(a.usuario)+'</td><td><b>'+esc(a.acao)+'</b>'+(a.obs?'<div class="muted" style="font-size:11px">'+esc(a.obs)+'</div>':'')+'</td>'
        +'<td>'+esc(a.registro)+'</td><td class="muted">'+esc(a.antes||'—')+'</td><td>'+esc(a.depois||'—')+'</td></tr>'; }).join('')
    +'</tbody></table></div></div>';
}

/* ---- PLANO DE CONTAS ---- */
function contabViewPlano(){
  const plano=contabPlanoTodo().slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
  const grupos={};
  plano.forEach(function(c){ (grupos[c.grupo]=grupos[c.grupo]||[]).push(c); });
  return '<div class="card"><div class="card-h">'+svg('doc')+'<h3>Plano de contas</h3>'
    +'<div class="r no-print"><button class="btn sm primary" onclick="contabModalConta()">'+svg('plus')+' Conta</button></div></div>'
    +'<div class="card-b">'+Object.keys(CONTAB_GRUPOS).filter(function(g){ return grupos[g]; }).map(function(g){
      return '<div class="cb-pgrupo"><b style="color:'+CONTAB_GRUPOS[g].cor+'">'+CONTAB_GRUPOS[g].nome+'</b>'
        +'<div class="cb-pcontas">'+grupos[g].map(function(c){
          return '<span class="cb-pconta'+(c.inativa?' off':'')+'" onclick="contabModalConta(\''+c.id+'\')">'+esc(c.nome)+'</span>'; }).join('')+'</div></div>';
    }).join('')+'</div></div>';
}
function contabModalConta(id){
  const c=id? contabConta(id) : {grupo:'custo'};
  openModal('<div class="m-h">'+svg('doc')+'<h3>'+(id?'Editar':'Nova')+' conta</h3><button class="x" onclick="closeModal()">×</button></div>'
   +'<div class="m-b">'+fld('Nome da conta','f_cnome',c.nome)
     +'<div class="field"><label>Grupo</label><select id="f_cgrupo">'
       + Object.keys(CONTAB_GRUPOS).map(function(g){ return '<option value="'+g+'"'+(c.grupo===g?' selected':'')+'>'+CONTAB_GRUPOS[g].nome+'</option>'; }).join('')+'</select></div>'
     +(id? '<div class="field"><label>Situação</label><select id="f_cativa"><option value="1">Ativa</option><option value=""'+(c.inativa?' selected':'')+'>Desativada</option></select></div>':'')
   +'</div>'
   +'<div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button>'
     +'<button class="btn primary" onclick="contabSalvarConta(\''+(id||'')+'\')">Salvar</button></div>');
}
function contabSalvarConta(id){
  const nome=val('f_cnome'); if(!nome){ toast('Informe o nome.','err'); return; }
  const plano=contabPlanoTodo();
  if(id){ const c=contabConta(id); if(c){ const antes=c.nome; c.nome=nome; c.grupo=val('f_cgrupo');
      c.inativa=!val('f_cativa'); contabLog('Conta editada', nome, antes, nome); } }
  else { plano.push({ id:'x.'+uid(''), nome:nome, grupo:val('f_cgrupo'), ordem:99 });
    contabLog('Conta criada', nome); }
  saveDB(); closeModal(); toast('Conta salva.'); router();
}

/* ---- RELATÓRIOS ---- */
const CONTAB_RELS=[
  {k:'dre',      n:'DRE do período'},
  {k:'lanc',     n:'Lançamentos'},
  {k:'conta',    n:'Resultado por conta'},
  {k:'centro',   n:'Resultado por centro de custo'},
  {k:'veiculo',  n:'Resultado por veículo'},
  {k:'cliente',  n:'Receita por cliente'},
  {k:'mensal',   n:'Comparativo mensal'},
  {k:'ativos',   n:'Ativo imobilizado'},
  {k:'financ',   n:'Financiamentos'},
  {k:'tributos', n:'Tributos'},
];
function contabViewRel(){
  return '<div class="card"><div class="card-h">'+svg('print')+'<h3>Relatórios</h3>'
    +'<div class="r"><span class="muted" style="font-size:11.5px">usam o período selecionado acima</span></div></div>'
    +'<div class="card-b"><div class="lic-rels">'+CONTAB_RELS.map(function(r){
      const ds=contabDataset(r.k);
      return '<div class="lic-rel"><div><b>'+esc(r.n)+'</b><span class="muted">'+ds.linhas.length+' linha(s)</span></div>'
        +'<div class="lic-rel-b">'
        +'<button class="btn ghost sm" onclick="contabExportar(\''+r.k+'\',\'pdf\')">'+svg('print')+' PDF</button>'
        +'<button class="btn ghost sm" onclick="contabExportar(\''+r.k+'\',\'xls\')">'+svg('export')+' Excel</button>'
        +'<button class="btn ghost sm" onclick="contabExportar(\''+r.k+'\',\'csv\')">'+svg('doc')+' CSV</button></div></div>';
    }).join('')+'</div></div></div>';
}
function contabDataset(tipo){
  const iv=contabIV();
  const todos=contabLancamentos();
  const lanc=contabPeriodo(todos, iv.ini, iv.fim);
  const rot=(CONTAB_RELS.find(function(r){ return r.k===tipo; })||{}).n||'Relatório';
  const titulo=rot+(iv.ini? ' — '+fmtD(iv.ini)+' a '+fmtD(iv.fim) : '');
  if(tipo==='dre'){ const d=contabDRE(lanc);
    return {titulo, colunas:['Conta','Valor'], linhas:[
      ['RECEITA BRUTA',money(d.receita)],['(−) Deduções',money(d.deducao)],['= RECEITA LÍQUIDA',money(d.liquida)],
      ['(−) Custos operacionais',money(d.custo)],['= LUCRO BRUTO',money(d.bruto)],
      ['(−) Despesas',money(d.despesa)],['= RESULTADO OPERACIONAL',money(d.operacional)],
      ['(−) Despesas financeiras',money(d.financeira)],['(−) Impostos',money(d.imposto)],
      [d.resultado>=0?'= LUCRO LÍQUIDO':'= PREJUÍZO',money(d.resultado)],['EBITDA',money(d.ebitda)]]};
  }
  if(tipo==='lanc') return {titulo, colunas:['Data','Descrição','Conta','Centro','Origem','Veículo','Valor'],
    linhas:lanc.map(function(l){ return [fmtD(l.data),l.descricao,contabContaNome(l.conta),contabCentroNome(l.centro),l.origem,l.placa||'',money(l.valor)]; })};
  if(tipo==='conta') return {titulo, colunas:['Grupo','Conta','Lançamentos','Valor'],
    linhas:contabPorConta(lanc).map(function(c){ return [(CONTAB_GRUPOS[c.grupo]||{}).nome||'',contabContaNome(c.conta),c.n,money(c.valor)]; })};
  if(tipo==='centro') return {titulo, colunas:['Centro de custo','Receita','Custo','Resultado'],
    linhas:contabPorCentro(lanc).map(function(c){ return [contabCentroNome(c.centro),money(c.receita),money(c.custo),money(c.receita-c.custo)]; })};
  if(tipo==='veiculo') return {titulo, colunas:['Veículo','Receita','Custo','Resultado','Margem','Custo/km'],
    linhas:contabPorVeiculo(lanc).filter(function(m){ return m.receita||m.custo; }).map(function(m){
      return [m.veiculo.placa,money(m.receita),money(m.custo),money(m.resultado),m.margem.toFixed(1)+'%',m.km?money(m.custoKm):'—']; })};
  if(tipo==='cliente'){ const mapa={};
    lanc.filter(function(l){ return l.grupo==='receita'; }).forEach(function(l){ const c=l.cliente||'(sem cliente)';
      mapa[c]=(mapa[c]||0)+l.valor; });
    return {titulo, colunas:['Cliente','Receita'], linhas:Object.keys(mapa).sort(function(a,b){ return mapa[b]-mapa[a]; })
      .map(function(c){ return [c,money(mapa[c])]; })};
  }
  if(tipo==='mensal') return {titulo:rot, colunas:['Competência','Receita','Custo','Resultado'],
    linhas:contabPorMes(todos).map(function(m){ return [_cbMesNome(m.comp),money(m.receita),money(m.custo),money(m.resultado)]; })};
  if(tipo==='ativos') return {titulo:rot, colunas:['Descrição','Categoria','Aquisição','Valor','Vida útil'],
    linhas:(DB.contabAtivos||[]).map(function(a){ return [a.descricao,a.categoria,fmtD(a.aquisicao),money(_contabNum(a.valor)),(a.vidaUtil||'')+' anos']; })};
  if(tipo==='financ') return {titulo:rot, colunas:['Banco','Contrato','Veículo','Valor','Saldo devedor'],
    linhas:(DB.contabFinanc||[]).map(function(f){ return [f.banco,f.contrato,f.placa||'',money(_contabNum(f.valor)),money(_contabNum(f.saldo))]; })};
  if(tipo==='tributos') return {titulo:rot, colunas:['Tributo','Competência','Vencimento','Valor','Situação'],
    linhas:(DB.contabTributos||[]).map(function(t){ return [contabContaNome(t.conta),t.competencia,fmtD(t.vencimento),money(_contabNum(t.valor)),t.pago?'Pago':'Em aberto']; })};
  return {titulo, colunas:[], linhas:[]};
}
function contabExportar(tipo, fmt){
  const ds=contabDataset(tipo);
  if(!ds.linhas.length){ toast('Esse relatório não tem dados no período.','err'); return; }
  if(typeof licExportar==='function' && typeof _licBaixar==='function'){
    const nome='Contabilidade - '+ds.titulo.replace(/[^\w\s-]/g,'').slice(0,60);
    if(fmt==='csv'){
      const linhas=[ds.colunas.join(';')].concat(ds.linhas.map(function(r){ return r.map(function(c){
        const s=String(c==null?'':c); return /[";\n]/.test(s)? '"'+s.replace(/"/g,'""')+'"' : s; }).join(';'); }));
      _licBaixar(nome+'.csv','﻿'+linhas.join('\r\n'),'text/csv;charset=utf-8'); return;
    }
    if(fmt==='xls'){
      const html='<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>'
        +ds.colunas.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('')+'</tr></thead><tbody>'
        +ds.linhas.map(function(r){ return '<tr>'+r.map(function(c){ return '<td>'+esc(c)+'</td>'; }).join('')+'</tr>'; }).join('')
        +'</tbody></table></body></html>';
      _licBaixar(nome+'.xls',html,'application/vnd.ms-excel;charset=utf-8'); return;
    }
    /* PDF: reusa a folha de impressão das Licenças */
    let area=document.getElementById('licPrintArea');
    if(!area){ area=document.createElement('div'); area.id='licPrintArea'; document.body.appendChild(area); }
    area.innerHTML='<div class="lic-print-h"><h1>'+esc((DB.empresa&&DB.empresa.nome)||'Planeta Express')+'</h1>'
      +'<div>'+esc(ds.titulo)+' — '+ds.linhas.length+' linha(s)</div></div>'
      +'<table><thead><tr>'+ds.colunas.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('')+'</tr></thead><tbody>'
      + ds.linhas.map(function(r){ return '<tr>'+r.map(function(c){ return '<td>'+esc(c)+'</td>'; }).join('')+'</tr>'; }).join('')
      +'</tbody></table><div class="lic-print-f">Planeta Express — Contabilidade</div>';
    document.body.classList.add('lic-printing');
    const limpar=function(){ document.body.classList.remove('lic-printing'); window.removeEventListener('afterprint',limpar); };
    window.addEventListener('afterprint',limpar);
    setTimeout(function(){ window.print(); setTimeout(limpar,1500); },60);
  }
}
