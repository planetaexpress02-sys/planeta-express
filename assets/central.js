/* ==================================================================
   CENTRAL DE PROCESSAMENTO INTELIGENTE DE DOCUMENTOS (CPID)
   ------------------------------------------------------------------
   UM único caminho para QUALQUER documento que entra no sistema.
   Não existe mais "um leitor por tela": todas as telas mandam o
   arquivo para cá e recebem de volta o resultado já interpretado.

   Pipeline (sempre o mesmo):
     Arquivo → Identificar formato → Ler conteúdo → Classificar
       → Extrair → Relacionar com o banco → Conferir
       → Atualizar módulos → Arquivar → Gerar log

   Regras de ouro:
   - XML NUNCA passa por OCR (já vem estruturado, é mais preciso).
   - PDF: primeiro o texto nativo (pdf.js); OCR só quando não há texto.
   - Excel: SheetJS quando disponível (lê até .xls antigo); senão o
     leitor próprio PEXImport (100% offline).
   - A leitura é SEMÂNTICA (por rótulo/significado), não por posição.
   - Cada documento conferido ensina o sistema (banco de modelos).
   ================================================================== */

/* ---------------- estado do módulo ---------------- */
let CPID_FILA = [];              // arquivos em processamento/conferência
let cpidAba = 'entrada';         // entrada | modelos | logs
let cpidBusca = '';

const CPID_ETAPAS = [
  {k:'formato',    n:'Identificando formato'},
  {k:'leitura',    n:'Lendo conteúdo'},
  {k:'classifica', n:'Classificando documento'},
  {k:'extrai',     n:'Extraindo informações'},
  {k:'relaciona',  n:'Relacionando com o banco'},
  {k:'confere',    n:'Conferindo'},
  {k:'pronto',     n:'Pronto para revisão'},
];

/* ---------------- utilidades ---------------- */
function _cpNorm(s){ return String(s==null?'':s).toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),''); }
function _cpNum(s){ if(s==null||s==='') return 0;
  if(typeof s==='number') return s;
  let x=String(s).replace(/[^\d,.\-]/g,'');
  if(/,\d{1,2}$/.test(x)) x=x.replace(/\./g,'').replace(',','.');   // padrão BR
  else x=x.replace(/,/g,'');
  return parseFloat(x)||0; }
function _cpISO(s){ return (typeof _impISO==='function')? _impISO(s) : ''; }
function _cpEsperar(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function _cpCNPJ(t){ const m=String(t||'').match(/\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2})\b/); return m? m[1].replace(/\D/g,'') : ''; }
function _cpFmtCNPJ(d){ d=String(d||'').replace(/\D/g,''); return d.length===14? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5') : d; }
function _cpPlaca(t){ const m=String(t||'').toUpperCase().match(/\b([A-Z]{3})[-\s]?(\d[A-Z0-9]\d{2})\b/); return m? m[1]+'-'+m[2] : ''; }

/* ==================================================================
   1) IDENTIFICAR FORMATO — por extensão E pela assinatura dos bytes
   ================================================================== */
async function cpidFormato(file){
  const nome = file.name||'';
  const ext  = (nome.match(/\.([a-z0-9]+)$/i)||[])[1]||'';
  const e    = ext.toLowerCase();
  let magic='';
  try{
    const buf = new Uint8Array(await file.slice(0,8).arrayBuffer());
    magic = Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(err){}
  const zip = /^504b0304/.test(magic);           // PK.. → xlsx, docx, zip
  const pdf = /^25504446/.test(magic);           // %PDF
  const jpg = /^ffd8ff/.test(magic);
  const png = /^89504e47/.test(magic);

  if(pdf || e==='pdf')                       return {k:'pdf',   n:'PDF',            ico:'doc'};
  if(jpg||png|| /^(jpe?g|png|webp|bmp|tiff?|gif)$/.test(e)) return {k:'imagem', n:'Imagem', ico:'eye'};
  if(e==='xml' || /^(3c3f786d6c|efbbbf3c)/.test(magic))    return {k:'xml',   n:'XML',   ico:'ctedoc'};
  if(e==='csv' || e==='txt')                 return {k:'csv',   n:'CSV/Texto',      ico:'doc'};
  if(e==='docx'|| (zip && e==='docx'))       return {k:'docx',  n:'Word (DOCX)',    ico:'doc'};
  if(e==='xlsx'|| e==='xlsm'|| e==='xls')    return {k:'excel', n:'Excel',          ico:'doc'};
  if(e==='eml' || e==='msg')                 return {k:'email', n:'E-mail',         ico:'send'};
  if(e==='zip' || zip)                       return {k:'zip',   n:'ZIP (vários)',   ico:'folder'};
  return {k:'desconhecido', n:ext? ext.toUpperCase() : 'Desconhecido', ico:'doc'};
}

/* ==================================================================
   2) LER CONTEÚDO — cada formato tem seu leitor; XML jamais vai a OCR
   Devolve {texto, grid, xmlDoc, filhos[]}  (filhos = ZIP/e-mail)
   ================================================================== */
async function cpidLer(file, fmt, onProgresso){
  const p = (m)=>{ if(onProgresso) onProgresso(m); };
  const out = {texto:'', grid:null, xmlDoc:null, filhos:[], ocr:false, linhas:null};

  if(fmt.k==='xml'){
    p('lendo XML estruturado');
    out.texto = await file.text();
    try{ out.xmlDoc = new DOMParser().parseFromString(out.texto,'application/xml'); }catch(e){}
    return out;                                     // sem OCR, sem pdf.js
  }

  if(fmt.k==='csv'){ p('lendo texto'); out.texto = await file.text();
    try{ if(typeof PEXImport!=='undefined'){ const r=await PEXImport.lerArquivo(file);
      out.grid = (r.sheets||[]).reduce(function(a,sh){ return a.concat(sh.grid||[]); },[]); } }catch(e){}
    return out; }

  if(fmt.k==='excel'){
    p('abrindo planilha');
    out.grid = await cpidLerPlanilha(file, p);
    out.texto = (out.grid||[]).map(function(r){ return (r||[]).join(' '); }).join('\n');
    return out;
  }

  if(fmt.k==='docx'){
    p('lendo documento do Word');
    out.texto = await cpidLerDocx(file);
    return out;
  }

  if(fmt.k==='email'){
    p('lendo e-mail');
    const r = await cpidLerEmail(file);
    out.texto = r.texto; out.filhos = r.anexos;
    return out;
  }

  if(fmt.k==='zip'){
    p('abrindo pacote');
    out.filhos = await cpidLerZip(file);
    out.texto = 'Pacote com '+out.filhos.length+' arquivo(s).';
    return out;
  }

  /* PDF: primeiro a leitura ESTRUTURADA (reconstrói as linhas da tabela
     pelas coordenadas) — é ela que faz relatórios e extratos funcionarem.
     Depois o texto corrido, e OCR só se não vier texto nenhum. */
  if(fmt.k==='pdf'){
    try{ const est=await cpidPdfLinhas(file, p);
      if(est && est.linhas.length){ out.linhas=est.linhas; out.texto=est.texto; } }catch(e){}
  }
  if(!out.texto && typeof pexLerApoliceTexto==='function'){
    out.texto = await pexLerApoliceTexto(file, function(m){ if(/ocr|imagem/i.test(String(m))) out.ocr=true; p(m); });
  } else if(fmt.k!=='pdf' && typeof pexLerApoliceTexto==='function'){
    out.texto = await pexLerApoliceTexto(file, function(m){ if(/ocr|imagem/i.test(String(m))) out.ocr=true; p(m); });
  }
  /* PDF digitalizado (sem texto): aí sim vale o OCR */
  if(fmt.k==='pdf' && (!out.texto || out.texto.replace(/\s/g,'').length<25) && typeof pexLerApoliceTexto==='function'){
    try{ out.texto = await pexLerApoliceTexto(file, function(m){ if(/ocr|imagem/i.test(String(m))) out.ocr=true; p(m); }); }catch(e){}
  }
  return out;
}

/* Excel: SheetJS (se carregado) lê inclusive .xls antigo; senão PEXImport */
async function cpidLerPlanilha(file, p){
  if(typeof XLSX!=='undefined' && XLSX.read){
    try{
      if(p) p('lendo com SheetJS');
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, {type:'array', cellDates:true});
      let grid=[];
      (wb.SheetNames||[]).forEach(function(nome){
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], {header:1, raw:false, defval:''});
        grid = grid.concat(linhas);
      });
      if(grid.length) return grid;
    }catch(e){}
  }
  try{
    if(p) p('lendo planilha (modo offline)');
    if(typeof PEXImport!=='undefined'){
      const r = await PEXImport.lerArquivo(file);
      return (r.sheets||[]).reduce(function(a,sh){ return a.concat(sh.grid||[]); },[]);
    }
  }catch(e){
    if(/\.xls$/i.test(file.name||'')) throw new Error('.xls antigo só abre com internet (SheetJS). Salve como .xlsx ou conecte-se.');
    throw e;
  }
  return null;
}

/* DOCX = ZIP com word/document.xml dentro */
async function cpidLerDocx(file){
  if(typeof PEXImport==='undefined' || !PEXImport.unzip) return '';
  const u8 = new Uint8Array(await file.arrayBuffer());
  const z  = await PEXImport.unzip(u8);
  const alvo = (z.nomes||[]).filter(function(n){ return /^word\/(document|header\d*|footer\d*)\.xml$/.test(n); });
  let txt='';
  for(const n of alvo){
    const b = await z.ler(n); if(!b) continue;
    const xml = new TextDecoder('utf-8').decode(b);
    txt += ' ' + xml.replace(/<w:p[ >]/g,'\n<w:p ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  }
  return txt.replace(/[ \t]+/g,' ').trim();
}

/* ZIP: devolve os arquivos de dentro como File, para reprocessar um a um */
async function cpidLerZip(file){
  if(typeof PEXImport==='undefined' || !PEXImport.unzip) return [];
  const u8 = new Uint8Array(await file.arrayBuffer());
  const z  = await PEXImport.unzip(u8);
  const filhos=[];
  for(const n of (z.nomes||[])){
    if(/\/$/.test(n)) continue;                                  // pasta
    if(/^__MACOSX|\/\._|^\./.test(n)) continue;                  // lixo de sistema
    if(!/\.(pdf|xml|xlsx|xlsm|xls|csv|jpe?g|png|webp|bmp|tiff?|docx|eml|txt)$/i.test(n)) continue;
    try{ const b = await z.ler(n); if(!b) continue;
      filhos.push(new File([b], n.split('/').pop(), {type:''}));
    }catch(e){}
  }
  return filhos;
}

/* E-mail .eml: corpo em texto + anexos base64 vira File */
async function cpidLerEmail(file){
  const raw = await file.text();
  const anexos=[];
  const bd = (raw.match(/boundary="?([^"\r\n;]+)"?/i)||[])[1];
  let texto = raw;
  if(bd){
    const partes = raw.split(new RegExp('--'+bd.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    texto='';
    partes.forEach(function(pt){
      const corte = pt.indexOf('\r\n\r\n')>=0? pt.indexOf('\r\n\r\n')+4 : pt.indexOf('\n\n')+2;
      if(corte<2) return;
      const cab = pt.slice(0,corte), corpo = pt.slice(corte);
      const nome = (cab.match(/filename="?([^"\r\n;]+)"?/i)||[])[1];
      const b64  = /base64/i.test(cab);
      if(nome && b64){
        try{ const bin=atob(corpo.replace(/\s+/g,'')); const u=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
          anexos.push(new File([u], nome, {type:''}));
        }catch(e){}
      } else if(/text\/plain/i.test(cab)){
        texto += ' ' + (b64? (function(){ try{ return atob(corpo.replace(/\s+/g,'')); }catch(e){ return corpo; } })() : corpo);
      }
    });
    if(!texto.trim()) texto = raw;
  }
  const assunto = (raw.match(/^Subject:\s*(.+)$/mi)||[])[1]||'';
  const de      = (raw.match(/^From:\s*(.+)$/mi)||[])[1]||'';
  return { texto:('Assunto: '+assunto+' De: '+de+' '+texto).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(), anexos:anexos };
}

/* ==================================================================
   3) CLASSIFICAR — banco de modelos primeiro (aprendizado), depois
   os padrões fiscais brasileiros. Sempre com % de confiança.
   ================================================================== */
const CPID_TIPOS = [
  {k:'cte_xml',    n:'CT-e (XML)',                ico:'ctedoc', destino:'CT-e'},
  {k:'nfe_xml',    n:'NF-e (XML)',                ico:'doc',    destino:'Faturamento / Abastecimento'},
  {k:'nfse_xml',   n:'NFS-e (XML)',               ico:'doc',    destino:'Faturamento'},
  {k:'abastec',    n:'Abastecimento (posto)',     ico:'fuel',   destino:'Abastecimentos'},
  {k:'pedagio',    n:'Extrato de pedágio',        ico:'toll',   destino:'Pedágios'},
  {k:'fatur_rel',  n:'Relatório de Faturamento',  ico:'money',  destino:'Financeiro'},
  {k:'cte',        n:'CT-e / DACTE',              ico:'ctedoc', destino:'CT-e'},
  {k:'nfse',       n:'NFS-e',                     ico:'doc',    destino:'Faturamento'},
  {k:'nfe',        n:'NF-e / DANFE',              ico:'doc',    destino:'Faturamento'},
  {k:'boleto',     n:'Boleto',                    ico:'wallet', destino:'Pagamentos'},
  {k:'fatura',     n:'Fatura / Duplicata',        ico:'money',  destino:'Pagamentos'},
  {k:'apolice',    n:'Apólice de seguro',         ico:'umbrella',destino:'Seguros'},
  {k:'licenca',    n:'Licença / Alvará',          ico:'stamp',  destino:'Licenças e Alvarás'},
  {k:'planilha',   n:'Planilha',                  ico:'doc',    destino:'conforme as colunas'},
  {k:'documento',  n:'Documento',                 ico:'doc',    destino:'Arquivo'},
];
function cpidTipoInfo(k){ return CPID_TIPOS.find(function(t){ return t.k===k; }) || CPID_TIPOS[CPID_TIPOS.length-1]; }

function cpidClassificar(ct, fmt, nome){
  const t = _cpNorm(ct.texto||''), n = _cpNorm(nome||'');
  const tem = function(re){ return re.test(t)||re.test(n); };
  const cnpj = _cpCNPJ(ct.texto);

  /* (a) o sistema já viu um documento deste emitente? então já sabe o tipo */
  const modelo = cpidModeloPor(cnpj, ct.texto);
  if(modelo && modelo.tipo){
    return {tipo:modelo.tipo, conf:Math.min(99, 90+Math.min(9,modelo.acertos||0)), cnpj:cnpj,
            porque:'modelo aprendido de '+(modelo.nome||'emitente conhecido'), modelo:modelo.id};
  }

  /* (b) XML: estruturado, dá para afirmar com segurança */
  if(fmt.k==='xml'){
    if(/inftecte|<cte|vtprest|conhecimento de transporte/.test(t)) return {tipo:'cte_xml', conf:99, cnpj:cnpj, porque:'tags de CT-e no XML'};
    if(/infnfe|<nfe|\bvnf\b|infprot/.test(t))                      return {tipo:'nfe_xml', conf:99, cnpj:cnpj, porque:'tags de NF-e no XML'};
    if(/nfse|rps|valorservicos/.test(t))                           return {tipo:'nfse_xml',conf:96, cnpj:cnpj, porque:'tags de NFS-e no XML'};
    return {tipo:'documento', conf:60, cnpj:cnpj, porque:'XML sem tags fiscais conhecidas'};
  }

  /* (c) planilha */
  if(fmt.k==='excel' || (fmt.k==='csv' && ct.grid)) return {tipo:'planilha', conf:88, cnpj:cnpj, porque:'planilha com cabeçalhos'};

  /* (d) padrões por significado (não por posição) */
  const regras=[
    ['pedagio',   96, /sem\s*parar|conectcar|veloe|vale.?ped[aá]gio|pra[cç]a de ped[aá]gio|concession[aá]ria/, 'menções a pedágio/praças'],
    ['fatur_rel', 97, /relatorio de faturamento|saidas r\$|servicos r\$|totais do periodo/, 'layout de relatório do contador'],
    ['abastec',   94, /diesel|arla|\bs-?10\b|gasolina|etanol|posto|combustivel|litros|abastecim/, 'produto de combustível'],
    ['apolice',   93, /ap[oó]lice|seguradora|premio|vigencia do seguro|ramo|endosso|importancia segurada/, 'termos de seguro'],
    ['licenca',   93, /alvara|licenca sanitaria|vigilancia sanitaria|inscricao municipal|avcb|corpo de bombeiros/, 'termos de licença/alvará'],
    ['cte',       92, /dacte|conhecimento de transporte|\bct-?e\b|rntrc|vtprest/, 'termos de CT-e'],
    ['nfse',      90, /nota fiscal de servic|\bnfs-?e\b|\biss\b|codigo do servico/, 'termos de NFS-e'],
    ['nfe',       90, /danfe|nota fiscal eletr|\bnf-?e\b|natureza da operacao|cfop/, 'termos de NF-e'],
    ['boleto',    88, /ficha de compensacao|linha digitavel|nosso numero|cedente|beneficiario|codigo de barras/, 'termos de boleto'],
    ['fatura',    70, /duplicata|\bfatura\b|vencimento/, 'termos de fatura'],
  ];
  for(const [k,conf,re,porque] of regras){ if(tem(re)) return {tipo:k, conf:conf, cnpj:cnpj, porque:porque}; }

  const vazio = !t || t.replace(/\s/g,'').length<25;
  return {tipo:'documento', conf: vazio?25:45, cnpj:cnpj,
          porque: vazio? 'não deu para ler texto (documento digitalizado sem OCR?)' : 'não bateu com nenhum padrão conhecido'};
}

/* ==================================================================
   BANCO DE MODELOS — cada documento conferido ensina o sistema
   ================================================================== */
function cpidModelos(){ if(!Array.isArray(DB.docModelos)) DB.docModelos=[]; return DB.docModelos; }
function cpidModeloPor(cnpj, texto){
  const ms = cpidModelos();
  if(cnpj){ const m = ms.find(function(x){ return x.cnpj===cnpj; }); if(m) return m; }
  const t=_cpNorm(texto||'');
  return ms.find(function(x){ return x.marcador && t.indexOf(_cpNorm(x.marcador))>=0; }) || null;
}
/* Chamado quando o usuário confirma (ou corrige) — é aqui que ele aprende */
function cpidAprender(item){
  if(!item || !item.tipo) return;
  const ms = cpidModelos();
  const cnpj = item.cls && item.cls.cnpj || '';
  const nome = item.emitente || '';
  if(!cnpj && !nome) return;
  let m = cnpj? ms.find(function(x){ return x.cnpj===cnpj; })
             : ms.find(function(x){ return _cpNorm(x.nome)===_cpNorm(nome); });
  if(m){
    m.acertos=(m.acertos||0)+1; m.ultimoUso=new Date().toISOString().slice(0,10);
    if(item.corrigido) m.tipo=item.tipo;                 // o usuário corrigiu → passa a valer
    if(nome && !m.nome) m.nome=nome;
    if(item.mapa) m.mapa=item.mapa;
  } else {
    ms.unshift({ id:uid('mod'), cnpj:cnpj, nome:nome||'(sem nome)', marcador:nome||'', tipo:item.tipo,
      mapa:item.mapa||null, acertos:1, criadoEm:new Date().toISOString().slice(0,10),
      ultimoUso:new Date().toISOString().slice(0,10) });
    if(ms.length>200) ms.length=200;
  }
}
function cpidEsquecerModelo(id){
  if(!confirm('Esquecer este modelo? O sistema volta a classificar esse emitente do zero.')) return;
  DB.docModelos = cpidModelos().filter(function(x){ return x.id!==id; });
  saveDB(); toast('Modelo removido.'); router();
}

/* ==================================================================
   4) EXTRAIR — por significado (rótulos), nunca por posição fixa.
   Cada tipo devolve {campos, registros, resumo, _alvo}
   ================================================================== */
async function cpidExtrair(tipo, ct, file, cls){
  const txt = ct.texto||'';
  switch(tipo){
    case 'cte_xml':  return cpidExtrCteXml(ct, file);
    case 'nfe_xml':
    case 'nfse_xml': return cpidExtrNfeXml(ct, file);
    case 'abastec':  return cpidExtrAbastecimento(txt, file);
    case 'pedagio':  return cpidExtrPedagio(txt);
    case 'fatur_rel':return cpidExtrFaturRelatorio(txt, ct);
    case 'apolice':  return cpidExtrApolice(txt, file);
    case 'licenca':  return cpidExtrLicenca(txt, file);
    case 'planilha': return cpidExtrPlanilha(ct.grid);
    case 'cte': case 'nfe': case 'nfse': case 'fatura': case 'boleto':
                     return cpidExtrNotaTexto(txt, tipo);
    default:         return {campos:{}, registros:[], resumo:'Documento sem dados estruturados — será apenas arquivado.'};
  }
}

/* ---- XML de CT-e: lê as tags (preciso, sem OCR) ---- */
function cpidExtrCteXml(ct, file){
  if(typeof parseCteXml==='function'){
    try{ const c=parseCteXml(ct.texto, file.name);
      if(c){ const campos={ numero:c.numero, chave:c.chave, data:c.data, cliente:c.cliente,
              destinatario:c.destinatario, origem:c.origem, destino:c.destino, valor:c.valor,
              produto:c.produto, cfop:c.cfop, placa:c.placa, emitente:c.cliente };
        return {campos:campos, registros:[c], _alvo:'ctes',
          resumo:'CT-e '+(c.numero||'')+' — '+(c.cliente||'')+' — '+money(c.valor||0)}; }
    }catch(e){}
  }
  /* o parser específico não casou (layout diferente) — lê as tags direto,
     que é sempre melhor do que descartar um XML estruturado */
  const d=ct.xmlDoc;
  const pega=function(tag){ if(!d) return ''; const el=d.getElementsByTagNameNS('*',tag)[0]; return el? (el.textContent||'').trim() : ''; };
  const campos={
    numero:  pega('nCT'),
    chave:   (ct.texto.match(/\b(\d{44})\b/)||[])[1]||pega('chCTe'),
    data:    (pega('dhEmi')||pega('dEmi')).slice(0,10),
    valor:   _cpNum(pega('vTPrest')||pega('vRec')),
    cliente: pega('xNome'),
    emitente:pega('xNome'),
    origem:  pega('xMunIni'), destino: pega('xMunFim'),
    cfop:    pega('CFOP'), placa: _cpPlaca(ct.texto)
  };
  if(d){ const nomes=d.getElementsByTagNameNS('*','xNome'); if(nomes.length>1) campos.destinatario=(nomes[1].textContent||'').trim(); }
  const temAlgo = campos.numero || campos.valor || campos.chave;
  return {campos:campos, registros: temAlgo?[campos]:[], _alvo: temAlgo?'ctes':'',
    resumo: temAlgo? ('CT-e '+(campos.numero||'')+(campos.cliente?' — '+campos.cliente:'')+(campos.valor?' — '+money(campos.valor):''))
                   : 'XML de CT-e sem os campos esperados.'};
}

/* ---- XML de NF-e / NFS-e: emitente, destinatário, totais, produtos ---- */
function cpidExtrNfeXml(ct, file){
  const d=ct.xmlDoc, campos={};
  const pega=function(tag){ if(!d) return ''; const el=d.getElementsByTagNameNS('*',tag)[0]; return el? (el.textContent||'').trim() : ''; };
  const emitNome=pega('xNome');
  campos.chave      = (ct.texto.match(/\b(\d{44})\b/)||[])[1]||pega('chNFe');
  campos.emitente   = emitNome;
  campos.cnpjEmit   = _cpFmtCNPJ(pega('CNPJ'));
  campos.numero     = pega('nNF')||pega('Numero');
  campos.data       = (pega('dhEmi')||pega('dEmi')||pega('DataEmissao')).slice(0,10);
  campos.valor      = _cpNum(pega('vNF')||pega('ValorServicos')||pega('vProd'));
  campos.icms       = _cpNum(pega('vICMS'));
  campos.peso       = _cpNum(pega('pesoL')||pega('pesoB'));
  campos.cidade     = pega('xMun');
  campos.uf         = pega('UF');
  campos.cfop       = pega('CFOP');
  if(d){ const nomes=d.getElementsByTagNameNS('*','xNome'); if(nomes.length>1) campos.destinatario=(nomes[1].textContent||'').trim(); }
  const prods=[];
  if(d){ const dets=d.getElementsByTagNameNS('*','det');
    for(let i=0;i<dets.length && i<50;i++){ const p=dets[i];
      const g=function(tag){ const el=p.getElementsByTagNameNS('*',tag)[0]; return el?(el.textContent||'').trim():''; };
      prods.push({ nome:g('xProd'), qtd:_cpNum(g('qCom')), un:g('uCom'), valor:_cpNum(g('vProd')) }); } }
  campos.produtos=prods;

  /* NF-e de posto = abastecimento, não faturamento */
  const comb = prods.find(function(p){ return /diesel|gasolina|etanol|s-?10|arla/i.test(p.nome||''); });
  if(comb){
    campos.produto=comb.nome; campos.litros=comb.qtd; campos.posto=emitNome; campos.placa=_cpPlaca(ct.texto);
    return {campos:campos, registros:[campos], _alvo:'abastecimentos', _tipoReal:'abastec',
      resumo:'Abastecimento — '+(campos.posto||'')+' — '+(campos.litros||0)+' L — '+money(campos.valor||0)};
  }
  return {campos:campos, registros:[campos], _alvo:'faturamento',
    resumo:'Nota '+(campos.numero||'')+' — '+(emitNome||'')+' — '+money(campos.valor||0)};
}

/* ---- Abastecimento em PDF/imagem (cupom, DANFE, NF) ---- */
function cpidExtrAbastecimento(txt, file){
  let base={};
  if(typeof extrairAbastecimento==='function'){ try{ base=extrairAbastecimento(txt, file.name)||{}; }catch(e){} }
  const m=function(re){ const x=txt.match(re); return x? String(x[1]).trim() : ''; };
  const campos={
    data:   base.data||_cpISO(m(/(\d{2}\/\d{2}\/\d{4})/)),
    litros: base.litros||0,
    valor:  base.valor||0,
    km:     base.km||'',
    placa:  base.placa||_cpPlaca(txt),
    posto:  base.posto||'',
    cnpj:   _cpFmtCNPJ(_cpCNPJ(txt)),
    produto:'', icms:0, hora:'', cidade:''
  };
  if(!campos.posto)  campos.posto  = m(/(?:posto|raz[aã]o social|emitente)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9&.\s]{4,45})/i);
  campos.produto = m(/\b(diesel\s*s-?10|diesel\s*s-?500|diesel|arla\s*32|arla|gasolina\s*\w*|etanol)\b/i) || 'Diesel';
  campos.icms    = _cpNum(m(/(?:valor\s*)?icms[^\d]{0,14}([\d.]+,\d{2})/i));
  campos.hora    = m(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
  campos.cidade  = m(/(?:munic[ií]pio|cidade)\s*[:\-]?\s*([A-Za-zÀ-ÿ\s]{3,30})/i);
  if(!campos.litros) campos.litros = _cpNum(m(/([\d.]+,\d{2,3})\s*(?:l\b|lt|litros)/i));
  if(!campos.valor)  campos.valor  = _cpNum(m(/(?:valor\s*(?:total|a\s*pagar)|total\s*r\$)[^\d]{0,14}([\d.]+,\d{2})/i));
  campos.emitente = campos.posto;
  return {campos:campos, registros:[campos], _alvo:'abastecimentos',
    resumo:'Abastecimento — '+(campos.posto||'posto')+' — '+(campos.litros||0)+' L — '+money(campos.valor||0)};
}

/* ---- Extrato de pedágio ---- */
function cpidExtrPedagio(txt){
  let regs=[];
  if(typeof _pedParseSemParar==='function'){ try{ regs=_pedParseSemParar(txt)||[]; }catch(e){} }
  const total=regs.reduce(function(s,p){ return s+(+p.valor||0); },0);
  return {campos:{passagens:regs.length, valor:total}, registros:regs, _alvo:'pedagios',
    resumo: regs.length? regs.length+' passagem(ns) — '+money(total) : 'Extrato lido, mas sem passagens reconhecidas.'};
}

/* ---- Relatório de faturamento do contador ---- */
function cpidExtrFaturRelatorio(txt, ct){
  let regs=[];
  /* 1º as LINHAS reconstruídas (tabela) — é o que funciona no PDF do contador */
  if(ct && ct.linhas && ct.linhas.length){
    try{ regs=_faturRelatorioDeLinhas(ct.linhas)||[]; }catch(e){}
  }
  /* 2º o parser antigo sobre o texto corrido */
  if(!regs.length && typeof _faturParseRelatorio==='function'){ try{ regs=_faturParseRelatorio(txt)||[]; }catch(e){} }
  /* 3º último recurso: qualquer "mês ... valor" no texto todo */
  if(!regs.length) regs=_faturRelatorioSolto(txt);
  const total=regs.reduce(function(s,r){ return s+(+r.valor||0); },0);
  return {campos:{meses:regs.length, valor:total}, registros:regs, _alvo:'faturamento',
    resumo: regs.length? regs.length+' mês(es) — '+money(total)
                       : 'Reconheci o relatório, mas não consegui separar os meses e valores. Confira a prévia abaixo.'};
}
/* Varredura solta: percorre o texto e casa mês+ano com o valor mais próximo */
function _faturRelatorioSolto(txt){
  const out=[];
  const MES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const t=String(txt||''); const n=_cpNorm(t);
  const re=/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/g;
  /* posições de TODOS os meses: o trecho de cada um termina onde o próximo começa,
     senão um mês acabaria pegando o valor do mês seguinte */
  const pos=[]; let mm2;
  const re2=/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/g;
  while((mm2=re2.exec(n))) pos.push(mm2.index);
  let m;
  while((m=re.exec(n))){
    const prox=pos.find(function(p){ return p>m.index; });
    const fim=Math.min(prox!=null? prox : t.length, m.index+220);
    const trecho=t.slice(m.index, fim);
    const ano=(trecho.match(/\b(20\d{2})\b/)||[])[1]; if(!ano) continue;
    const vals=(trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)||[]).map(function(s){ return parseFloat(s.replace(/\./g,'').replace(',','.'))||0; });
    if(!vals.length) continue;
    const comp=ano+'-'+String(MES[m[1]]).padStart(2,'0');
    if(out.some(function(o){ return o.competencia===comp; })) continue;
    out.push({ data:comp+'-01', cliente:'', valor:vals[vals.length-1],
      obs:'Faturamento '+_capitaliza(m[1])+'/'+ano+' (relatório do contador)',
      competencia:comp, saidas:vals[0]||0, servicos:0, outros:0, fonte:'contador', _tipo:'mensal' });
  }
  return out;
}

/* ---- Nota/fatura/boleto só em texto (fallback) ---- */
function cpidExtrNotaTexto(txt, tipo){
  let regs=[];
  if(typeof _faturParseNotaTexto==='function'){ try{ regs=_faturParseNotaTexto(txt, tipo)||[]; }catch(e){} }
  const r=regs[0]||{};
  const campos={ valor:r.valor||0, data:r.data||'', chave:r.chave||'',
    numero:(txt.match(/(?:n[ºo°.]|numero)\s*[:\-]?\s*(\d{3,9})/i)||[])[1]||'',
    cliente:(txt.match(/(?:cliente|tomador|sacado|raz[aã]o social)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9&.\s]{4,45})/i)||[])[1]||'',
    vencimento:_cpISO((txt.match(/vencimento[^\d]{0,14}(\d{2}\/\d{2}\/\d{4})/i)||[])[1]||''),
    cnpj:_cpFmtCNPJ(_cpCNPJ(txt)) };
  campos.emitente=campos.cliente;
  const alvo=(tipo==='boleto'||tipo==='fatura')? 'pagamentos' : 'faturamento';
  return {campos:campos, registros:regs, _alvo:alvo,
    resumo:(cpidTipoInfo(tipo).n)+(campos.numero?' nº '+campos.numero:'')+(campos.valor?' — '+money(campos.valor):'')};
}

/* ---- Apólice de seguro ---- */
function cpidExtrApolice(txt, file){
  let melhor=null;
  if(typeof _apoliceMatch==='function'){ try{ melhor=_apoliceMatch(file.name, txt); }catch(e){} }
  const campos={ apolice:(txt.match(/ap[oó]lice[^\d]{0,12}(\d[\d.\-\/]{4,})/i)||[])[1]||'',
    seguradora:(txt.match(/(allianz|tokio\s*marine|porto\s*seguro|hdi|mitsui|icatu|bradesco|sulamerica|mapfre)/i)||[])[1]||'' };
  campos.emitente=campos.seguradora;
  return {campos:campos, registros:[], _alvo:'seguros', _match:melhor,
    resumo: (melhor&&melhor.seguro)? 'Apólice de '+(melhor.seguro.seguradora||'')+' — será anexada'
                                   : 'Apólice'+(campos.apolice?' nº '+campos.apolice:'')+' — escolha a qual pertence'};
}

/* ---- Licença / alvará ---- */
function cpidExtrLicenca(txt, file){
  let d={};
  if(typeof _licExtrair==='function'){ try{ d=_licExtrair(txt, file.name)||{}; }catch(e){} }
  d.emitente=d.orgao||'';
  return {campos:d, registros:[d], _alvo:'licencas',
    resumo:(d.categoria&&typeof licCatInfo==='function'? licCatInfo(d.categoria).n : 'Licença')
      +(d.numero?' nº '+d.numero:'')+(d.validade?' — vence '+fmtD(d.validade):'')};
}

/* ---- Planilha: descobre sozinho o que é, pelos cabeçalhos ---- */
function cpidExtrPlanilha(grid){
  if(!grid || !grid.length) return {campos:{}, registros:[], resumo:'Planilha vazia.'};
  const sheets=[{name:'planilha', grid:grid}];
  const tentativas=[
    {alvo:'descargas',   rot:'Descargas',   fn:(typeof _descDetectar==='function')? function(){ return _descDetectar(sheets); } : null},
    {alvo:'viagens',     rot:'Viagens',     fn:(typeof _viagemDetectar==='function')? function(){ return _viagemDetectar(sheets); } : null},
    {alvo:'faturamento', rot:'Faturamento', fn:(typeof _faturDetectExcel==='function')? function(){ return _faturDetectExcel(grid); } : null},
  ];
  for(const t of tentativas){
    if(!t.fn) continue;
    try{ const r=t.fn(); if(r && r.length) return {campos:{linhas:r.length}, registros:r, _alvo:t.alvo,
      resumo:r.length+' linha(s) reconhecida(s) para '+t.rot, mapa:{alvo:t.alvo}}; }catch(e){}
  }
  if(typeof PEXImport!=='undefined' && PEXImport.detectarVencimentos){
    try{ const v=PEXImport.detectarVencimentos(grid);
      if(v && v.length) return {campos:{linhas:v.length}, registros:v, _alvo:'vencimentos',
        resumo:v.length+' validade(s) encontrada(s)', mapa:{alvo:'vencimentos'}}; }catch(e){}
  }
  const mapa=cpidMapearColunas(grid);
  if(mapa.achou.length>=2){
    const regs=cpidLinhasPorMapa(grid, mapa);
    return {campos:{linhas:regs.length}, registros:regs, _alvo:mapa.alvo, mapa:mapa,
      resumo:regs.length+' linha(s) — colunas reconhecidas: '+mapa.achou.join(', ')};
  }
  return {campos:{linhas:grid.length}, registros:[],
    resumo:'Planilha lida, mas não reconheci as colunas. Confira o cabeçalho.'};
}

/* Sinônimos de cabeçalho: PLACA=VEÍCULO=CARRO, VALOR=R$=TOTAL, LITROS=QTDE... */
const CPID_SINONIMOS={
  placa:    /^(placa|ve[ií]culo|veiculo|carro|caminh[aã]o|frota|cavalo|prefixo)$/,
  data:     /^(data|dia|dt|emissao|data emissao|data abast|abast|competencia|periodo)$/,
  valor:    /^(valor|r\$|total|vl|vlr|preco|custo|valor total|montante|valor r\$)$/,
  litros:   /^(litros|lt|l|qtde|qtd|quantidade|volume|qtd litros|litragem)$/,
  km:       /^(km|hodometro|odometro|quilometragem|kms|horas|horimetro)$/,
  motorista:/^(motorista|condutor|colaborador|funcionario|nome)$/,
  posto:    /^(posto|fornecedor|estabelecimento|emitente|local|oficina)$/,
  cliente:  /^(cliente|tomador|destinatario|empresa)$/,
  destino:  /^(destino|cidade|municipio|entrega|rota)$/,
  obs:      /^(obs|observacao|descricao|historico|comentario)$/,
};
function cpidMapearColunas(grid){
  const res={cols:{}, achou:[], linhaCab:-1, alvo:''};
  const lim=Math.min(grid.length, 15);
  for(let r=0;r<lim;r++){
    const row=grid[r]||[], cols={}, achou=[];
    row.forEach(function(cel, i){
      const c=_cpNorm(cel).replace(/[().:]/g,'').replace(/\s+/g,' ').trim();
      if(!c) return;
      for(const campo in CPID_SINONIMOS){
        if(cols[campo]!=null) continue;
        if(CPID_SINONIMOS[campo].test(c)){ cols[campo]=i; achou.push(campo); break; }
      }
    });
    if(achou.length>=2 && achou.length>res.achou.length){ res.cols=cols; res.achou=achou; res.linhaCab=r; }
  }
  const a=res.achou;
  if(a.indexOf('litros')>=0) res.alvo='abastecimentos';
  else if(a.indexOf('motorista')>=0 && a.indexOf('destino')>=0) res.alvo='viagens';
  else if(a.indexOf('cliente')>=0 && a.indexOf('valor')>=0) res.alvo='faturamento';
  else if(a.indexOf('valor')>=0) res.alvo='pagamentos';
  return res;
}
function cpidLinhasPorMapa(grid, mapa){
  const out=[], c=mapa.cols;
  for(let r=mapa.linhaCab+1; r<grid.length; r++){
    const row=grid[r]||[], o={};
    if(c.placa!=null)     o.placa=String(row[c.placa]||'').toUpperCase().trim();
    if(c.data!=null)      o.data=_cpISO(row[c.data])||'';
    if(c.valor!=null)     o.valor=_cpNum(row[c.valor]);
    if(c.litros!=null)    o.litros=_cpNum(row[c.litros]);
    if(c.km!=null)        o.km=_cpNum(row[c.km]);
    if(c.motorista!=null) o.motorista=String(row[c.motorista]||'').trim();
    if(c.posto!=null)     o.posto=String(row[c.posto]||'').trim();
    if(c.cliente!=null)   o.cliente=String(row[c.cliente]||'').trim();
    if(c.destino!=null)   o.destino=String(row[c.destino]||'').trim();
    if(c.obs!=null)       o.obs=String(row[c.obs]||'').trim();
    if(o.valor||o.litros||o.data||o.placa) out.push(o);
  }
  return out;
}

/* ==================================================================
   5) RELACIONAR — liga o extraído ao banco (frota, motoristas)
   ================================================================== */
function cpidRelacionar(ex, ct){
  const liga={veiculo:null, motorista:null, avisos:[]};
  const txt=ct.texto||'';
  const placa=(ex.campos&&ex.campos.placa)||_cpPlaca(txt);
  if(placa && typeof veiculoByPlaca==='function'){
    const v=veiculoByPlaca(placa);
    if(v){ liga.veiculo=v; if(ex.campos) ex.campos.placa=v.placa;
      (ex.registros||[]).forEach(function(r){ if(r&&typeof r==='object'){ if(!r.placa) r.placa=v.placa; if(!r.veiculoId) r.veiculoId=v.id; } }); }
    else { liga.avisos.push('Placa '+placa+' não está na frota'); if(ex.campos) ex.campos.placa=placa; }
  }
  const nomeMot=(ex.campos&&ex.campos.motorista)||'';
  if(nomeMot && typeof _iaMotorista==='function'){ try{ const m=_iaMotorista(nomeMot); if(m) liga.motorista=m; }catch(e){} }
  return liga;
}

/* ==================================================================
   6) CONFERIR — pendências e duplicados (nada entra sem passar aqui)
   ================================================================== */
function cpidConferir(item){
  const pend=[], ex=item.ex||{}, c=ex.campos||{}, alvo=item.alvo;
  if(alvo==='abastecimentos'){
    if(!c.litros) pend.push('litros');
    if(!c.valor)  pend.push('valor');
    if(!c.data)   pend.push('data');
    if(!c.placa)  pend.push('placa');
    if((DB.abastecimentos||[]).some(function(a){ return a.data===c.data && Math.abs((+a.valor||0)-(+c.valor||0))<0.01 && a.placa===c.placa; })) pend.push('já lançado');
  } else if(alvo==='ctes'){
    if(c.chave && (DB.ctes||[]).some(function(x){ return x.chave===c.chave; })) pend.push('já lançado');
    if(!c.valor) pend.push('valor');
  } else if(alvo==='faturamento' || alvo==='pagamentos'){
    if(!c.valor && !(ex.registros||[]).length) pend.push('valor');
  } else if(alvo==='licencas'){
    if(!c.validade) pend.push('validade');
    if(!c.numero)   pend.push('número');
  } else if(alvo==='pedagios'){
    if(!(ex.registros||[]).length) pend.push('nenhuma passagem');
  }
  item.pend=[...new Set(pend)];
  return item.pend;
}

/* ==================================================================
   PIPELINE — este é o ÚNICO caminho de entrada de documento no sistema
   ================================================================== */
async function cpidProcessar(item, onEtapa){
  const t0=(window.performance&&performance.now)? performance.now() : Date.now();
  const f=item.file;
  const et=function(i,msg){ item.etapa=i; item.etapaMsg=msg||''; if(onEtapa) onEtapa(i,msg); };
  try{
    et(0,''); await _cpEsperar(50);
    const fmt=await cpidFormato(f); item.fmt=fmt;

    et(1,'');
    const ct=await cpidLer(f, fmt, function(m){ et(1,m); });
    item.ocr=!!ct.ocr; item.temTexto=!!(ct.texto && ct.texto.replace(/\s/g,'').length>20);

    /* ZIP / e-mail: cada arquivo de dentro volta para o começo do pipeline */
    if(ct.filhos && ct.filhos.length){
      item.status='pacote'; item.tipo='documento';
      item.resumo=ct.filhos.length+' arquivo(s) dentro — cada um entra no pipeline';
      item.tempo=((window.performance&&performance.now?performance.now():Date.now())-t0)/1000;
      return {filhos:ct.filhos};
    }

    et(2,''); await _cpEsperar(50);
    const cls=cpidClassificar(ct, fmt, f.name);
    item.cls=cls; item.tipo=cls.tipo; item.conf=cls.conf;

    et(3,'');
    const ex=await cpidExtrair(cls.tipo, ct, f, cls);
    if(ex._tipoReal){ item.tipo=ex._tipoReal; item.cls.porque+=' · conteúdo é de '+cpidTipoInfo(ex._tipoReal).n; }
    item.ex=ex; item.alvo=ex._alvo||''; item.resumo=ex.resumo||'';
    /* guarda uma prévia do que foi lido: se a extração falhar, o usuário VÊ o motivo */
    item.previa=(ct.linhas&&ct.linhas.length)
      ? ct.linhas.slice(0,12).map(function(l){ return l.txt; }).join('\n')
      : String(ct.texto||'').replace(/\s+/g,' ').slice(0,600);
    item.nLinhas=(ct.linhas||[]).length;
    item.emitente=(ex.campos&&(ex.campos.emitente||ex.campos.posto||ex.campos.seguradora||ex.campos.orgao))||'';

    et(4,'');
    item.liga=cpidRelacionar(ex, ct);

    et(5,''); await _cpEsperar(50);
    cpidConferir(item);

    et(6,'');
    item.status = item.alvo? 'revisar' : (item.temTexto? 'arquivar' : 'ilegivel');
    item.tempo=((window.performance&&performance.now?performance.now():Date.now())-t0)/1000;
    return {};
  }catch(e){
    item.status='erro'; item.erro=e.message||String(e);
    item.tempo=((window.performance&&performance.now?performance.now():Date.now())-t0)/1000;
    return {};
  }
}

/* ==================================================================
   7/8/9) ATUALIZAR MÓDULOS → ARQUIVAR → LOG
   ================================================================== */
async function cpidAplicar(item){
  const ex=item.ex||{}, c=ex.campos||{}, regs=ex.registros||[];
  let salvos=0; const onde=[];
  const temVeic=item.liga&&item.liga.veiculo;

  if(item.alvo==='abastecimentos'){
    if(!Array.isArray(DB.abastecimentos)) DB.abastecimentos=[];
    DB.abastecimentos.push({ id:uid('ab'), data:c.data||'', placa:c.placa||'', litros:+c.litros||0,
      valor:+c.valor||0, km:+c.km||null, posto:c.posto||'',
      obs:[c.produto,c.cidade,c.hora].filter(Boolean).join(' · ') });
    salvos=1; onde.push('Abastecimentos','Financeiro','Médias/Custo por km','Painel');
  }
  else if(item.alvo==='ctes'){
    if(!Array.isArray(DB.ctes)) DB.ctes=[];
    regs.forEach(function(r){ const id='cte_'+(r.chave||uid(''));
      if(!DB.ctes.some(function(x){ return x.id===id; })){ DB.ctes.push(Object.assign({}, r, {id:id})); salvos++; } });
    onde.push('CT-e','Clientes','Faturamento');
  }
  else if(item.alvo==='faturamento'){
    if(!Array.isArray(DB.faturamento)) DB.faturamento=[];
    /* não duplica: se a competência (mês) já existe, atualiza em vez de somar de novo */
    if(regs.length){ regs.forEach(function(r){ const lim={};
        Object.keys(r).forEach(function(k){ if(k.charAt(0)!=='_') lim[k]=r[k]; });
        const jaTem = lim.competencia && DB.faturamento.find(function(x){ return x.competencia===lim.competencia; });
        if(jaTem){ Object.assign(jaTem, lim); salvos++; }
        else { lim.id=uid('ft'); DB.faturamento.push(lim); salvos++; } }); }
    else if(c.valor){ DB.faturamento.push({ id:uid('ft'), data:c.data||'', cliente:c.emitente||c.cliente||'',
        valor:+c.valor||0, chave:c.chave||'', obs:'Documento nº '+(c.numero||'') }); salvos=1; }
    if(salvos) onde.push('Financeiro','Painel');
  }
  else if(item.alvo==='pagamentos'){
    if(!Array.isArray(DB.pagamentos)) DB.pagamentos=[];
    DB.pagamentos.push({ id:uid('pg'), data:c.vencimento||c.data||'', descricao:(c.cliente||item.nome),
      categoria:'Fornecedor', forma:'', valor:+c.valor||0 });
    salvos=1; onde.push('Financeiro (Pagamentos)');
  }
  else if(item.alvo==='pedagios'){
    if(!Array.isArray(DB.pedagios)) DB.pedagios=[];
    regs.forEach(function(p){
      const dup=DB.pedagios.some(function(x){ return x.data===p.data && x.hora===p.hora && x.placa===p.placa && Math.abs((+x.valor||0)-(+p.valor||0))<0.01; });
      if(!dup){ DB.pedagios.push(Object.assign({id:uid('pd')}, p)); salvos++; } });
    onde.push('Pedágios','Financeiro');
  }
  else if(item.alvo==='licencas'){
    if(!Array.isArray(DB.licencas)) DB.licencas=[];
    const ci=(typeof licCatInfo==='function')? licCatInfo(c.categoria||'alvara') : {n:'Licença'};
    const l={ id:uid('lic'), nome:ci.n+(c.municipio?' — '+c.municipio:''), categoria:c.categoria||'alvara',
      numero:c.numero||'', orgao:c.orgao||'', municipio:c.municipio||'', estado:c.estado||'',
      emissao:c.emissao||'', validade:c.validade||'', responsavel:c.responsavel||'Uilian',
      situacao:'auto', obs:'Cadastrada pela Central de Documentos ('+item.nome+')', protocolo:'', hash:'',
      escopo: temVeic?'veiculo':'empresa', refId: temVeic? item.liga.veiculo.id : '',
      titular:'', historico:[], versoes:[], renov:{aberta:false} };
    if(typeof licLog==='function') licLog(l,'Criada pela Central de Documentos', item.nome);
    DB.licencas.push(l); salvos=1; item._refLic=l.id;
    onde.push('Licenças e Alvarás','Vencimentos','Painel','Notificações');
  }
  else if(item.alvo==='descargas'){
    if(!Array.isArray(DB.descargas)) DB.descargas=[];
    regs.forEach(function(r){ const lim={}; Object.keys(r).forEach(function(k){ if(k.charAt(0)!=='_') lim[k]=r[k]; });
      lim.id=uid('ds'); DB.descargas.push(lim); salvos++; });
    onde.push('Descargas','Financeiro');
  }
  else if(item.alvo==='viagens'){
    if(!Array.isArray(DB.viagens)) DB.viagens=[];
    regs.forEach(function(r){ const lim={}; Object.keys(r).forEach(function(k){ if(k.charAt(0)!=='_') lim[k]=r[k]; });
      lim.id=uid('vg'); DB.viagens.push(lim); salvos++; });
    onde.push('Viagens','Painel');
  }
  else if(item.alvo==='seguros' && ex._match && ex._match.seguro){
    item._refSeg=ex._match.seguro.id; onde.push('Seguros');
  }

  /* ARQUIVAR — todo documento fica guardado (backup + histórico) */
  try{
    if(typeof subirUm==='function'){
      const cat=cpidTipoInfo(item.tipo).n;
      let ent='empresa', ref='empresa';
      if(item._refLic){ ent='licenca'; ref=item._refLic; }
      else if(item._refSeg){ ent='seguro'; ref=item._refSeg; }
      else if(temVeic){ ent='veiculo'; ref=item.liga.veiculo.id; }
      await subirUm(item.file, ent, ref, cat);
      item.arquivado=true; onde.push('Documentos (arquivo guardado)');
    }
  }catch(e){ item.arquivoErro=e.message||''; }

  cpidAprender(item);                       /* aprende com este documento */
  cpidLog(item, salvos, onde);              /* log auditável */
  /* honestidade: se não gravou nada, NÃO diz que atualizou o módulo */
  item.status = salvos? 'aplicado' : 'semdados';
  item.salvos=salvos; item.onde=onde;
  return {salvos:salvos, onde:onde};
}

function cpidLogs(){ if(!Array.isArray(DB.docLogs)) DB.docLogs=[]; return DB.docLogs; }
function cpidLog(item, salvos, onde){
  const l=cpidLogs();
  l.unshift({ id:uid('dl'), quando:new Date().toISOString(),
    usuario:(typeof nomeUsuario==='function'? nomeUsuario():'')||'local',
    arquivo:item.nome, formato:(item.fmt&&item.fmt.n)||'', tipo:cpidTipoInfo(item.tipo).n,
    conf:item.conf||0, ocr:!!item.ocr, salvos:salvos||0, onde:(onde||[]).join(', '),
    pend:(item.pend||[]).join(', '), tempo:Math.round((item.tempo||0)*100)/100, arquivado:!!item.arquivado });
  if(l.length>400) l.length=400;
}

/* ==================================================================
   TELA — Central de Processamento Inteligente de Documentos
   ================================================================== */
function viewCentral(){
  const logs=cpidLogs(), modelos=cpidModelos();
  const hoje=new Date().toISOString().slice(0,10);
  const kHoje=logs.filter(function(l){ return (l.quando||'').slice(0,10)===hoje; }).length;
  const kSalvos=logs.reduce(function(s,l){ return s+(+l.salvos||0); },0);
  const kOcr=logs.filter(function(l){ return l.ocr; }).length;

  const kp=function(ico,cor,val,label,sub){
    return '<a class="kpi"><div class="k-top"><div class="k-ico" style="color:'+cor+';background:'+cor+'1f">'+svg(ico)+'</div></div>'+
      '<div class="k-val" data-count="'+val+'" style="'+(val?'color:'+cor:'')+'">0</div>'+
      '<div class="k-label">'+label+'</div>'+(sub?'<div class="k-sub">'+sub+'</div>':'')+'</a>'; };

  const aba=function(k,rot,n){ return '<button class="cp-aba'+(cpidAba===k?' on':'')+'" onclick="cpidSetAba(\''+k+'\')">'+rot+(n!=null?' <b>'+n+'</b>':'')+'</button>'; };

  let corpo='';
  if(cpidAba==='entrada'){
    corpo=
      '<div class="cp-drop" id="cpDrop"'+
      ' ondragover="event.preventDefault();this.classList.add(\'over\')"'+
      ' ondragleave="this.classList.remove(\'over\')"'+
      ' ondrop="event.preventDefault();this.classList.remove(\'over\');cpidReceber(event.dataTransfer.files)"'+
      ' onclick="document.getElementById(\'cpFile\').click()">'+
        svg('upload')+'<b>Solte aqui qualquer documento</b>'+
        '<span>PDF · XML · Excel · CSV · JPG · PNG · DOCX · E-mail · ZIP — o sistema identifica sozinho o que é e para onde vai</span>'+
      '</div>'+
      '<input type="file" id="cpFile" multiple style="display:none" onchange="cpidReceber(this.files);this.value=\'\'">'+
      cpidFluxoHTML()+
      '<div id="cpFila">'+cpidFilaHTML()+'</div>';
  } else if(cpidAba==='modelos'){
    corpo=
      '<div class="card"><div class="card-h">'+svg('spark')+'<h3>Modelos aprendidos</h3>'+
        '<div class="r"><span class="muted" style="font-size:11.5px">cada documento conferido ensina o sistema</span></div></div>'+
      (modelos.length?
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Emitente</th><th>CNPJ</th><th>Reconhece como</th><th>Acertos</th><th>Último uso</th><th class="no-print"></th></tr></thead><tbody>'+
      modelos.map(function(m){ return '<tr><td><b>'+esc(m.nome||'—')+'</b></td><td class="mono">'+esc(_cpFmtCNPJ(m.cnpj)||'—')+'</td>'+
        '<td>'+esc(cpidTipoInfo(m.tipo).n)+'</td><td class="mono">'+(m.acertos||0)+'</td><td class="mono">'+fmtD(m.ultimoUso)+'</td>'+
        '<td class="no-print ta-r"><button class="btn ghost sm" onclick="cpidEsquecerModelo(\''+m.id+'\')">'+svg('trash')+'</button></td></tr>'; }).join('')+
      '</tbody></table></div>'
      : '<div class="card-b">'+emptyState('Ainda não aprendi nenhum emitente. Processe um documento e confirme — na próxima vez eu já reconheço sozinho.')+'</div>')+
      '</div>';
  } else {
    corpo=
      '<div class="card"><div class="card-h">'+svg('doc')+'<h3>Histórico de processamento</h3>'+
        '<div class="r"><span class="muted" style="font-size:11.5px">'+logs.length+' registro(s)</span>'+
        (logs.length?'<button class="btn ghost sm no-print" onclick="cpidLimparLogs()">'+svg('trash')+' Limpar</button>':'')+'</div></div>'+
      (logs.length?
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Arquivo</th><th>Formato</th><th>Tipo</th><th>Confiança</th><th>Salvos</th><th>Atualizou</th><th>Tempo</th></tr></thead><tbody>'+
      logs.slice(0,200).map(function(l){
        const d=new Date(l.quando);
        return '<tr><td class="mono" style="white-space:nowrap">'+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+'</td>'+
          '<td>'+esc(l.arquivo||'')+(l.ocr?' <span class="cp-ocr">OCR</span>':'')+'</td>'+
          '<td>'+esc(l.formato||'')+'</td><td>'+esc(l.tipo||'')+'</td>'+
          '<td><span class="cp-conf" style="--p:'+(l.conf||0)+'">'+(l.conf||0)+'%</span></td>'+
          '<td class="mono">'+(l.salvos||0)+'</td><td class="muted" style="font-size:11.5px">'+esc(l.onde||'—')+'</td>'+
          '<td class="mono">'+(l.tempo||0)+'s</td></tr>'; }).join('')+
      '</tbody></table></div>'
      : '<div class="card-b">'+emptyState('Nenhum documento processado ainda.')+'</div>')+
      '</div>';
  }

  return ''+
  '<div class="banner">'+svg('spark')+'<div><b>Central de Processamento Inteligente de Documentos</b>'+
    '<span>Todo documento entra por aqui e segue sempre o mesmo caminho: identifica o formato, lê, classifica, extrai, relaciona com o banco, atualiza os módulos, arquiva e registra o log.</span></div></div>'+

  '<div class="grid kpis cp-kpis" style="margin-bottom:16px">'+
    kp('doc','#4c8dff', logs.length, 'Documentos processados','desde o início')+
    kp('cal','#37e3d0', kHoje, 'Processados hoje','')+
    kp('check','#16c98d', kSalvos, 'Lançamentos gerados','gravados nos módulos')+
    kp('spark','#b98cff', modelos.length, 'Modelos aprendidos','emitentes reconhecidos')+
    kp('eye','#f2a44e', kOcr, 'Lidos por OCR','documentos digitalizados')+
  '</div>'+

  '<div class="cp-abas no-print">'+aba('entrada','Entrada')+aba('modelos','Modelos',modelos.length)+aba('logs','Logs',logs.length)+'</div>'+
  corpo;
}
function cpidSetAba(k){ cpidAba=k; router(); }
function cpidLimparLogs(){ if(!confirm('Apagar o histórico de processamento? Os documentos e lançamentos continuam.')) return;
  DB.docLogs=[]; saveDB(); toast('Histórico limpo.'); router(); }

/* Desenho do fluxo (mostra que o caminho é sempre o mesmo) */
function cpidFluxoHTML(){
  return '<div class="cp-fluxo no-print">'+CPID_ETAPAS.map(function(e,i){
    return '<span class="cp-fl"><i>'+(i+1)+'</i>'+esc(e.n)+'</span>'; }).join('<b class="cp-seta">→</b>')+'</div>';
}

/* ==================================================================
   FILA — recebe, processa (inclusive o que vem dentro de ZIP/e-mail)
   ================================================================== */
async function cpidReceber(files){
  if(!files||!files.length) return;
  const novos=[];
  for(const f of files){
    const it={ id:uid('cp'), file:f, nome:f.name||'documento', status:'lendo', etapa:0, etapaMsg:'', pend:[], aplicar:true };
    CPID_FILA.push(it); novos.push(it);
  }
  cpidRender();
  for(const it of novos){ await cpidRodar(it); }
}
async function cpidRodar(it){
  const r=await cpidProcessar(it, function(){ cpidRender(); });
  cpidRender();
  /* ZIP / e-mail: os arquivos de dentro entram no MESMO pipeline */
  if(r && r.filhos && r.filhos.length){
    for(const f of r.filhos){
      const filho={ id:uid('cp'), file:f, nome:f.name, status:'lendo', etapa:0, etapaMsg:'', pend:[], aplicar:true, de:it.nome };
      CPID_FILA.push(filho); cpidRender();
      await cpidProcessar(filho, function(){ cpidRender(); });
      cpidRender();
    }
  }
}
function cpidRender(){
  const box=document.getElementById('cpFila'); if(!box) return;
  box.innerHTML=cpidFilaHTML();
}
function cpidFilaHTML(){
  if(!CPID_FILA.length) return '';
  const prontos=CPID_FILA.filter(function(i){ return i.status==='revisar'||i.status==='arquivar'; }).length;
  return '<div class="cp-fila">'+CPID_FILA.map(cpidItemHTML).join('')+'</div>'+
    (prontos? '<div class="cp-acoes no-print">'+
      '<button class="btn primary" onclick="cpidAplicarTodos()">'+svg('check')+' Confirmar e atualizar o sistema ('+prontos+')</button>'+
      '<button class="btn" onclick="cpidLimparFila()">Limpar lista</button></div>' : '');
}
function cpidItemHTML(it){
  const ti=cpidTipoInfo(it.tipo||'documento');
  const selo={ lendo:['#8ea3bf','Processando'], revisar:['#16c98d','Reconhecido'], arquivar:['#f2a44e','Só arquivar'],
    ilegivel:['#f2686b','Não deu para ler'], erro:['#f2686b','Erro'], pacote:['#b98cff','Pacote'],
    aplicado:['#16c98d','Aplicado'], semdados:['#f2a44e','Arquivado, sem lançamento'] }[it.status]||['#8ea3bf',it.status];
  const et=CPID_ETAPAS[it.etapa||0];

  let miolo='';
  if(it.status==='lendo'){
    miolo='<div class="cp-etapas">'+CPID_ETAPAS.map(function(e,i){
        return '<span class="cp-et'+(i<it.etapa?' done':'')+(i===it.etapa?' now':'')+'"><i></i>'+esc(e.n)+'</span>'; }).join('')+'</div>'+
      '<div class="muted" style="font-size:11.5px">'+esc((et?et.n:'')+(it.etapaMsg?' — '+it.etapaMsg:''))+'</div>';
  } else if(it.status==='erro'){
    miolo='<div class="cp-erro">'+esc(it.erro||'Falhou')+'</div>';
  } else if(it.status==='pacote'){
    miolo='<div class="muted" style="font-size:12px">'+esc(it.resumo||'')+'</div>';
  } else {
    const c=(it.ex&&it.ex.campos)||{};
    const campos=cpidCamposVisiveis(it, c);
    miolo=
      '<div class="cp-linha"><span class="cp-tag" style="--c:#4c8dff">'+svg(ti.ico)+' '+esc(ti.n)+'</span>'+
        '<span class="cp-conf" style="--p:'+(it.conf||0)+'">'+(it.conf||0)+'% de confiança</span>'+
        (it.ocr?'<span class="cp-ocr">lido por OCR</span>':'')+
        (it.fmt?'<span class="muted" style="font-size:11px">'+esc(it.fmt.n)+'</span>':'')+'</div>'+
      (it.cls&&it.cls.porque? '<div class="cp-porque">'+svg('spark')+' '+esc(it.cls.porque)+'</div>':'')+
      '<div class="cp-resumo">'+esc(it.resumo||'')+'</div>'+
      (campos? '<div class="cp-campos">'+campos+'</div>':'')+
      (it.liga&&it.liga.veiculo? '<div class="cp-rel">'+svg('truck')+' Relacionado ao veículo <b>'+esc(it.liga.veiculo.placa)+'</b></div>':'')+
      ((it.liga&&it.liga.avisos&&it.liga.avisos.length)? '<div class="cp-aviso">'+esc(it.liga.avisos.join(' · '))+'</div>':'')+
      (it.pend&&it.pend.length? '<div class="cp-aviso">Conferir: <b>'+esc(it.pend.join(', '))+'</b></div>':'')+
      /* quando não saiu nenhum lançamento, mostra o que foi lido do documento */
      ((it.alvo && !(it.ex&&it.ex.registros&&it.ex.registros.length) && it.previa)?
        '<details class="cp-previa"><summary>'+svg('eye')+' Não consegui separar os dados — ver o que li do documento'+
        (it.nLinhas?' ('+it.nLinhas+' linhas)':'')+'</summary><pre>'+esc(it.previa)+'</pre></details>':'')+
      (it.alvo? '<div class="cp-destino">'+svg('send')+' Vai atualizar: <b>'+esc(cpidNomeAlvo(it.alvo))+'</b></div>'
              : '<div class="cp-destino">'+svg('folder')+' Será apenas <b>arquivado</b> nos Documentos</div>')+
      (it.status==='aplicado'? '<div class="cp-ok">'+svg('check')+' Aplicado — '+(it.salvos||0)+' lançamento(s) · atualizou: '+esc((it.onde||[]).join(', '))+'</div>'
        : it.status==='semdados'? '<div class="cp-aviso">Arquivo guardado, mas <b>nenhum lançamento foi gerado</b> — os dados não puderam ser separados. Veja a prévia acima ou lance manualmente.</div>'
        : '<div class="cp-item-acts no-print">'+
            '<label class="cp-chk"><input type="checkbox" '+(it.aplicar!==false?'checked':'')+' onchange="cpidMarcar(\''+it.id+'\',this.checked)"> lançar no sistema</label>'+
            '<select class="cp-sel" onchange="cpidCorrigirTipo(\''+it.id+'\',this.value)">'+
              CPID_TIPOS.map(function(t){ return '<option value="'+t.k+'"'+(it.tipo===t.k?' selected':'')+'>'+esc(t.n)+'</option>'; }).join('')+
            '</select>'+
            '<button class="btn ghost sm" onclick="cpidRemover(\''+it.id+'\')">'+svg('trash')+'</button>'+
          '</div>');
  }

  return '<div class="cp-item '+(it.status||'')+'">'+
    '<div class="cp-item-h">'+(it.status==='lendo'?'<span class="apo-spin"></span>':svg(ti.ico))+
      '<b>'+esc(it.nome)+'</b>'+(it.de?'<span class="muted" style="font-size:11px">de '+esc(it.de)+'</span>':'')+
      '<span class="cp-selo" style="--c:'+selo[0]+'">'+selo[1]+'</span></div>'+
    miolo+'</div>';
}
function cpidNomeAlvo(a){ return {abastecimentos:'Abastecimentos', ctes:'CT-e', faturamento:'Financeiro (Faturamento)',
  pagamentos:'Financeiro (Pagamentos)', pedagios:'Pedágios', licencas:'Licenças e Alvarás', descargas:'Descargas',
  viagens:'Viagens', seguros:'Seguros', vencimentos:'Vencimentos'}[a]||a; }
function cpidCamposVisiveis(it, c){
  const rot={ data:'Data', valor:'Valor', litros:'Litros', placa:'Placa', posto:'Posto', emitente:'Emitente',
    cnpj:'CNPJ', cnpjEmit:'CNPJ', numero:'Número', chave:'Chave', cliente:'Cliente', destinatario:'Destinatário',
    cidade:'Cidade', uf:'UF', icms:'ICMS', peso:'Peso', produto:'Produto', cfop:'CFOP', km:'KM',
    validade:'Validade', emissao:'Emissão', orgao:'Órgão', municipio:'Município', vencimento:'Vencimento',
    apolice:'Apólice', seguradora:'Seguradora', passagens:'Passagens', meses:'Meses', linhas:'Linhas', hora:'Hora' };
  const ordem=['numero','chave','emitente','cnpjEmit','cnpj','cliente','destinatario','data','emissao','validade','vencimento',
    'produto','litros','km','valor','icms','peso','placa','posto','cidade','municipio','uf','cfop','hora','apolice','seguradora','passagens','meses','linhas'];
  const out=[];
  ordem.forEach(function(k){
    if(c[k]==null||c[k]===''||c[k]===0) return;
    let v=c[k];
    if(k==='valor'||k==='icms') v=money(v);
    else if(k==='data'||k==='emissao'||k==='validade'||k==='vencimento') v=fmtD(v);
    else if(k==='litros') v=Number(v).toLocaleString('pt-BR')+' L';
    out.push('<span><small>'+(rot[k]||k)+'</small><b>'+esc(String(v))+'</b></span>');
  });
  const prods=(c.produtos||[]).slice(0,3);
  if(prods.length) out.push('<span><small>Produtos</small><b>'+esc(prods.map(function(p){ return p.nome; }).join(' · ').slice(0,60))+'</b></span>');
  return out.length? out.join('') : '';
}
function cpidMarcar(id,v){ const it=CPID_FILA.find(function(x){ return x.id===id; }); if(it) it.aplicar=!!v; }
function cpidRemover(id){ CPID_FILA=CPID_FILA.filter(function(x){ return x.id!==id; }); cpidRender(); }
function cpidLimparFila(){ CPID_FILA=[]; cpidRender(); }
/* O usuário corrigiu o tipo → reprocessa a extração E o sistema aprende */
async function cpidCorrigirTipo(id, tipo){
  const it=CPID_FILA.find(function(x){ return x.id===id; }); if(!it) return;
  it.tipo=tipo; it.corrigido=true;
  try{
    const fmt=it.fmt||await cpidFormato(it.file);
    const ct=await cpidLer(it.file, fmt);
    const ex=await cpidExtrair(tipo, ct, it.file, it.cls);
    it.ex=ex; it.alvo=ex._alvo||''; it.resumo=ex.resumo||'';
    it.liga=cpidRelacionar(ex, ct);
    cpidConferir(it);
    it.status=it.alvo?'revisar':'arquivar';
  }catch(e){ it.status='erro'; it.erro=e.message||''; }
  cpidRender();
}
async function cpidAplicarTodos(){
  const alvos=CPID_FILA.filter(function(i){ return (i.status==='revisar'||i.status==='arquivar') && i.aplicar!==false; });
  if(!alvos.length){ toast('Nada marcado para lançar.','err'); return; }
  if(typeof pexBar==='function') pexBar(true);
  let total=0;
  try{
    for(const it of alvos){ const r=await cpidAplicar(it); total+=r.salvos||0; cpidRender(); }
    if(typeof reloadFiles==='function') await reloadFiles();
    saveDB();
    toast(total+' lançamento(s) gravado(s) e '+alvos.length+' documento(s) arquivado(s).');
  } finally { if(typeof pexBar==='function') pexBar(false); }
  cpidRender();
}
/* Contagem para o selo do menu */
function cpidPendentes(){ return CPID_FILA.filter(function(i){ return i.status==='revisar'; }).length; }

/* contagem animada dos KPIs da Central */
function cpidCountUp(){
  document.querySelectorAll('#view[data-route="central"] .k-val[data-count]').forEach(function(el){
    if(typeof _pexSemAnimacao==='function' && _pexSemAnimacao()){ _pexEscreverContador(el); return; }
    var alvo=parseFloat(el.getAttribute('data-count'))||0, t0=null, dur=850;
    function step(ts){ if(!t0)t0=ts; var k=Math.min(1,(ts-t0)/dur); var e=1-Math.pow(1-k,3);
      el.textContent=Math.round(alvo*e).toLocaleString('pt-BR'); if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
}

/* ==================================================================
   PONTE — as telas antigas passam a usar ESTE pipeline.
   Qualquer módulo que precise "receber documento" chama cpidEnviar():
   abre a Central já com os arquivos processando. Assim não existe
   mais um leitor por tela — existe um só, aqui.
   ================================================================== */
function cpidEnviar(files, origem){
  location.hash='#central';
  cpidAba='entrada';
  if(typeof router==='function') router();
  setTimeout(function(){ cpidReceber(files); }, 60);
  if(origem && typeof toast==='function') toast('Documento enviado para a Central ('+origem+').');
}
/* Abre o seletor de arquivos e manda tudo para a Central */
function cpidEscolher(origem){
  const inp=document.createElement('input'); inp.type='file'; inp.multiple=true;
  inp.onchange=function(e){ cpidEnviar(e.target.files, origem); };
  inp.click();
}

/* ==================================================================
   LEITURA ESTRUTURADA DE PDF (tabelas)
   ------------------------------------------------------------------
   O pdf.js entrega pedaços soltos de texto, cada um com a sua posição
   na página. Concatenar tudo numa string embaralha as tabelas (o
   relatório do contador vira "janeiro fevereiro ... 1.234,56 ...").
   Aqui reconstruímos as LINHAS pela coordenada Y e as COLUNAS pela X,
   que é o que permite ler qualquer relatório em tabela.
   ================================================================== */
async function cpidPdfLinhas(file, onProgresso){
  const out={linhas:[], texto:''};
  if(typeof _pdfjs!=='function' || !_pdfjs()) return out;
  let doc=null;
  try{ doc=await _pdfDoc(file); }catch(e){ return out; }
  if(!doc) return out;
  const np=Math.min(doc.numPages, 20);
  for(let p=1;p<=np;p++){
    if(onProgresso) onProgresso('lendo página '+p+'/'+np);
    let tc=null;
    try{ const page=await doc.getPage(p); tc=await page.getTextContent(); }catch(e){ continue; }
    const itens=(tc.items||[]).map(function(it){
      const tr=it.transform||[1,0,0,1,0,0];
      return { x:Math.round(tr[4]), y:Math.round(tr[5]), t:String(it.str||'') };
    }).filter(function(i){ return i.t.trim()!==''; });
    if(!itens.length) continue;
    /* agrupa por Y (tolerância de 3pt: a mesma linha nem sempre tem Y idêntico) */
    const mapa={};
    itens.forEach(function(i){
      let chave=null;
      for(const k in mapa){ if(Math.abs(Number(k)-i.y)<=3){ chave=k; break; } }
      if(chave===null){ chave=String(i.y); mapa[chave]=[]; }
      mapa[chave].push(i);
    });
    Object.keys(mapa).sort(function(a,b){ return Number(b)-Number(a); })   // topo → base
      .forEach(function(k){
        const cels=mapa[k].sort(function(a,b){ return a.x-b.x; });
        const cols=cels.map(function(c){ return c.t.trim(); }).filter(Boolean);
        const txt=cols.join(' ').replace(/\s+/g,' ').trim();
        if(txt) out.linhas.push({pagina:p, y:Number(k), cols:cols, txt:txt});
      });
  }
  out.texto=out.linhas.map(function(l){ return l.txt; }).join('\n');
  return out;
}

/* Relatório de faturamento a partir das LINHAS reconstruídas.
   Aceita a linha inteira ("Janeiro 2026 1.000,00 ... 5.000,00") e
   também o caso em que mês e ano estão em células separadas. */
function _faturRelatorioDeLinhas(linhas){
  const out=[];
  const MES={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const num=function(s){ return parseFloat(String(s).replace(/\./g,'').replace(',','.'))||0; };
  (linhas||[]).forEach(function(l){
    const txt=l.txt||'';
    const mm=_cpNorm(txt).match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
    if(!mm) return;
    const mes=MES[mm[1]]; if(!mes) return;
    const ano=(txt.match(/\b(20\d{2})\b/)||[])[1];
    if(!ano) return;
    /* todos os valores monetários da linha; o ÚLTIMO é o Total */
    const vals=(txt.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g)||[]).map(num);
    if(!vals.length) return;
    const comp=ano+'-'+String(mes).padStart(2,'0');
    if(out.some(function(o){ return o.competencia===comp; })) return;
    const total=vals[vals.length-1];
    out.push({ data:comp+'-01', cliente:'', valor:total,
      obs:'Faturamento '+_capitaliza(mm[1])+'/'+ano+(vals.length>1? ' — '+vals.slice(0,-1).map(money).join(' · ') : '')+' (relatório do contador)',
      competencia:comp, saidas:vals[0]||0, servicos:vals.length>=3?vals[1]:0, outros:0,
      fonte:'contador', _tipo:'mensal' });
  });
  return out;
}
