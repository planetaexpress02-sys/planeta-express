/* ==================================================================
   PEXImport — Leitor de planilhas (.xlsx e .csv) 100% no navegador.
   Sem bibliotecas externas. Usa DecompressionStream (Chrome/Edge) para
   descompactar o .xlsx (que é um arquivo ZIP) e DOMParser para o XML.
   Converte datas do Excel (número de série) em datas ISO (AAAA-MM-DD).
   Expõe: window.PEXImport.lerArquivo(File) -> Promise<{sheets:[{name,grid}]}>
   Cada grid é uma matriz de linhas; cada célula é string (datas já ISO).
   ================================================================== */
window.PEXImport = (function(){

  /* ---------- utilidades de bytes ---------- */
  function u16(a,o){ return a[o] | (a[o+1]<<8); }
  function u32(a,o){ return (a[o] | (a[o+1]<<8) | (a[o+2]<<16) | (a[o+3]<<24)) >>> 0; }

  function suportaXLSX(){ return (typeof DecompressionStream!=='undefined'); }

  async function inflateRaw(bytes){
    // DEFLATE cru -> bytes originais, usando a API nativa do navegador.
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function decode(bytes){ return new TextDecoder('utf-8').decode(bytes); }

  /* ---------- ZIP: lê o diretório central e extrai as entradas ---------- */
  async function unzip(u8){
    // Localiza o End Of Central Directory (assinatura 0x06054b50), do fim p/ o começo.
    let eocd = -1;
    for(let i=u8.length-22; i>=0 && i>u8.length-22-65536; i--){
      if(u8[i]===0x50 && u8[i+1]===0x4b && u8[i+2]===0x05 && u8[i+3]===0x06){ eocd=i; break; }
    }
    if(eocd<0) throw new Error('Arquivo .xlsx inválido (ZIP sem diretório).');
    const total = u16(u8, eocd+10);
    let off = u32(u8, eocd+16);           // início do diretório central
    const files = {};
    for(let n=0; n<total; n++){
      if(u32(u8,off)!==0x02014b50) break; // assinatura de registro do diretório central
      const method   = u16(u8, off+10);
      const compSize = u32(u8, off+20);
      const nameLen  = u16(u8, off+28);
      const extraLen = u16(u8, off+30);
      const commLen  = u16(u8, off+32);
      const localOff = u32(u8, off+42);
      const name = decode(u8.subarray(off+46, off+46+nameLen));
      // Cabeçalho local: descobre onde começam os dados (tamanhos de nome/extra podem diferir).
      const lNameLen  = u16(u8, localOff+26);
      const lExtraLen = u16(u8, localOff+28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = u8.subarray(dataStart, dataStart+compSize);
      files[name] = { method, raw };
      off += 46 + nameLen + extraLen + commLen;
    }
    // Extrai só o que precisamos, sob demanda.
    async function ler(name){
      const f = files[name]; if(!f) return null;
      if(f.method===0) return f.raw;               // armazenado (sem compressão)
      if(f.method===8) return await inflateRaw(f.raw); // deflate
      throw new Error('Compressão não suportada no .xlsx (método '+f.method+').');
    }
    return { nomes:Object.keys(files), ler };
  }

  /* ---------- XML helpers ---------- */
  function parseXML(txt){ return new DOMParser().parseFromString(txt, 'application/xml'); }
  function tags(node, name){ return node.getElementsByTagNameNS('*', name); }

  /* ---------- referência de célula "C6" -> {col:2, row:5} (0-based) ---------- */
  function refToRC(ref){
    let c=0, i=0;
    for(; i<ref.length; i++){ const ch=ref.charCodeAt(i); if(ch<65||ch>90) break; c = c*26 + (ch-64); }
    const row = parseInt(ref.slice(i),10) || 0;
    return { col:c-1, row:row-1 };
  }

  /* ---------- data serial do Excel -> ISO ---------- */
  function serialToISO(n){
    n = Number(n); if(!isFinite(n)) return '';
    // 25569 = dias entre 1900 (época do Excel, já com o bug do ano 1900) e 1970-01-01.
    const ms = Math.round((n - 25569) * 86400000);
    const d = new Date(ms);
    if(isNaN(d)) return '';
    const y=d.getUTCFullYear(); if(y<1900||y>2100) return '';
    return y+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
  }

  /* ---------- shared strings ---------- */
  function parseShared(txt){
    if(!txt) return [];
    const doc = parseXML(txt), sis = tags(doc,'si'), out=[];
    for(let i=0;i<sis.length;i++){
      // Um <si> pode ter vários <t> (texto com formatação); concatena todos.
      const ts = tags(sis[i],'t'); let s='';
      for(let j=0;j<ts.length;j++) s += ts[j].textContent;
      out.push(s);
    }
    return out;
  }

  /* ---------- estilos: descobre quais índices de estilo são DATA ---------- */
  function parseEstilosData(txt){
    const set = new Set();
    if(!txt) return set;
    const doc = parseXML(txt);
    // formatos embutidos de data/hora do Excel
    const dataEmbutido = new Set([14,15,16,17,22,27,30,36,45,46,47,50,57]);
    // formatos personalizados (id>=164): é data se o código tiver d/m/y/a fora de aspas
    const custom = {};
    const nfs = tags(doc,'numFmt');
    for(let i=0;i<nfs.length;i++){
      const id = parseInt(nfs[i].getAttribute('numFmtId'),10);
      const code = (nfs[i].getAttribute('formatCode')||'').replace(/"[^"]*"/g,'').replace(/\[[^\]]*\]/g,'');
      if(/[dmyhsDMYHS]/.test(code) && /[dmyaDMYA]/.test(code)) custom[id]=true;
    }
    const xfsWrap = doc.getElementsByTagNameNS('*','cellXfs')[0];
    if(!xfsWrap) return set;
    const xfs = tags(xfsWrap,'xf');
    for(let i=0;i<xfs.length;i++){
      const nf = parseInt(xfs[i].getAttribute('numFmtId'),10);
      if(dataEmbutido.has(nf) || custom[nf]) set.add(i);
    }
    return set;
  }

  /* ---------- lê uma planilha (sheet) para matriz ---------- */
  function parseSheet(txt, shared, dataXf){
    const doc = parseXML(txt), rows = tags(doc,'row'), grid=[];
    let maxCol = 0;
    const linhas = [];
    for(let i=0;i<rows.length;i++){
      const rEl = rows[i];
      const rIdx = (parseInt(rEl.getAttribute('r'),10)||(i+1)) - 1;
      const cells = tags(rEl,'c'), linha={};
      for(let j=0;j<cells.length;j++){
        const c = cells[j];
        const ref = c.getAttribute('r');
        const col = ref ? refToRC(ref).col : j;
        if(col>maxCol) maxCol=col;
        const t = c.getAttribute('t');           // tipo
        const s = c.getAttribute('s');           // índice de estilo
        let valor='';
        if(t==='inlineStr'){
          const tt=tags(c,'t'); let s2=''; for(let k=0;k<tt.length;k++) s2+=tt[k].textContent; valor=s2;
        } else {
          const vEl = tags(c,'v')[0]; const raw = vEl?vEl.textContent:'';
          if(raw==='' || raw==null){ valor=''; }
          else if(t==='s'){ valor = shared[parseInt(raw,10)] ?? ''; }
          else if(t==='str' || t==='b'){ valor = raw; }
          else { // número: pode ser data (pelo estilo)
            if(s!=null && dataXf.has(parseInt(s,10))){ valor = serialToISO(raw) || raw; }
            else valor = raw;
          }
        }
        linha[col] = String(valor).trim();
      }
      linhas.push({rIdx, linha});
    }
    // monta matriz densa preservando posições de linha/coluna
    const maxRow = linhas.reduce((m,l)=>Math.max(m,l.rIdx),-1);
    for(let r=0;r<=maxRow;r++) grid.push(new Array(maxCol+1).fill(''));
    linhas.forEach(l=>{ for(const col in l.linha) grid[l.rIdx][col]=l.linha[col]; });
    return grid;
  }

  /* ---------- lê o .xlsx inteiro ---------- */
  async function lerXLSX(arrayBuffer){
    if(!suportaXLSX()) throw new Error('Seu navegador não abre .xlsx diretamente. Use o Chrome ou o Edge, ou salve a planilha como CSV.');
    const u8 = new Uint8Array(arrayBuffer);
    const zip = await unzip(u8);
    const shared = parseShared(zip.nomes.includes('xl/sharedStrings.xml') ? decode(await zip.ler('xl/sharedStrings.xml')) : '');
    const dataXf = parseEstilosData(zip.nomes.includes('xl/styles.xml') ? decode(await zip.ler('xl/styles.xml')) : '');

    // ordem e nomes das abas via workbook + rels
    let ordem = [];
    try{
      const wb = parseXML(decode(await zip.ler('xl/workbook.xml')));
      const rels = zip.nomes.includes('xl/_rels/workbook.xml.rels') ? parseXML(decode(await zip.ler('xl/_rels/workbook.xml.rels'))) : null;
      const relMap = {};
      if(rels){ const rs=tags(rels,'Relationship'); for(let i=0;i<rs.length;i++) relMap[rs[i].getAttribute('Id')] = rs[i].getAttribute('Target'); }
      const shs = tags(wb,'sheet');
      for(let i=0;i<shs.length;i++){
        const nome = shs[i].getAttribute('name') || ('Planilha '+(i+1));
        const rid = shs[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || shs[i].getAttribute('r:id');
        let alvo = relMap[rid] || ('worksheets/sheet'+(i+1)+'.xml');
        alvo = alvo.replace(/^\/?xl\//,'').replace(/^\//,'');
        ordem.push({ nome, path:'xl/'+alvo });
      }
    }catch(e){ ordem = []; }
    if(!ordem.length){
      // fallback: qualquer worksheet encontrada
      zip.nomes.filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n))
        .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
        .forEach((p,i)=>ordem.push({nome:'Planilha '+(i+1), path:p}));
    }
    const sheets=[];
    for(const o of ordem){
      if(!zip.nomes.includes(o.path)) continue;
      const grid = parseSheet(decode(await zip.ler(o.path)), shared, dataXf);
      sheets.push({ name:o.nome, grid });
    }
    return { sheets };
  }

  /* ---------- CSV ---------- */
  function detectarSep(txt){
    const linha = txt.split(/\r?\n/)[0]||'';
    const pv=(linha.match(/;/g)||[]).length, v=(linha.match(/,/g)||[]).length, tab=(linha.match(/\t/g)||[]).length;
    if(tab>=pv && tab>=v) return '\t';
    return pv>=v ? ';' : ',';
  }
  function lerCSV(txt){
    if(txt.charCodeAt(0)===0xFEFF) txt=txt.slice(1); // remove BOM
    const sep = detectarSep(txt);
    const grid=[]; let linha=[], campo='', dentro=false;
    for(let i=0;i<txt.length;i++){
      const ch=txt[i];
      if(dentro){
        if(ch==='"'){ if(txt[i+1]==='"'){ campo+='"'; i++; } else dentro=false; }
        else campo+=ch;
      } else {
        if(ch==='"') dentro=true;
        else if(ch===sep){ linha.push(campo.trim()); campo=''; }
        else if(ch==='\n'){ linha.push(campo.trim()); grid.push(linha); linha=[]; campo=''; }
        else if(ch==='\r'){ /* ignora */ }
        else campo+=ch;
      }
    }
    if(campo!=='' || linha.length){ linha.push(campo.trim()); grid.push(linha); }
    return { sheets:[{ name:'CSV', grid }] };
  }

  /* ---------- ponto de entrada ---------- */
  function lerArquivo(file){
    const nome=(file.name||'').toLowerCase();
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onerror=()=>reject(new Error('Não consegui ler o arquivo.'));
      if(nome.endsWith('.csv') || nome.endsWith('.txt')){
        r.onload=()=>{ try{ resolve(lerCSV(r.result)); }catch(e){ reject(e); } };
        r.readAsText(file,'utf-8');
      } else {
        r.onload=()=>{ lerXLSX(r.result).then(resolve).catch(reject); };
        r.readAsArrayBuffer(file);
      }
    });
  }

  /* ==================================================================
     DETECÇÃO DE VENCIMENTOS — entende planilhas em blocos (Data /
     Colaborador|Placa|Programa / Validade), lado a lado, com um título
     de tipo acima de cada bloco. Também funciona com tabela simples.
     Função PURA: não mexe no banco; só interpreta a matriz.
     Retorna itens {titulo, tipo, vinculo, chave, emissao, validade}.
     ================================================================== */
  function _norm(s){ return (s==null?'':String(s)).trim(); }
  function _low(s){ return _norm(s).toLowerCase(); }
  function _semData(s){ const l=_low(s); return l==='' || l==='-' || l==='—' || l==='0'; }

  function _ehValidade(s){ const l=_low(s); return l==='validade' || /vencimento|vence/.test(l); }
  function _ehData(s){ const l=_low(s); return l==='data' || /^emiss/.test(l) || l==='início' || l==='inicio'; }
  function _labelVinc(s){ const l=_low(s);
    if(/colaborador|motorista|nome|funcion|condutor/.test(l)) return 'motorista';
    if(/placa|ve[ií]culo|reboque|cavalo|carreta/.test(l)) return 'veiculo';
    if(/programa|documento|^tipo$|certificad/.test(l)) return 'empresa';
    return null; }

  // título do bloco -> tipo canônico do sistema
  function canonTipo(t){ const l=_low(t);
    if(/toxic/.test(l)) return 'Toxicológico';
    if(/tac[oó]grafo/.test(l)) return 'Tacógrafo';
    if(/opentech/.test(l) && /func/.test(l)) return 'Opentech Funcionário';
    if(/opentech/.test(l) && /ve[ií]c/.test(l)) return 'Opentech Veículo';
    if(/vigil/.test(l)) return 'Vigilância Sanitária';
    if(/\baso\b|atestado/.test(l)) return 'ASO';
    if(/pcmso/.test(l)) return 'PCMSO';
    if(/\bpgr\b/.test(l)) return 'PGR';
    if(/certificado digital/.test(l)) return 'Certificado Digital';
    if(/\bcnh\b|habilita/.test(l)) return 'CNH';
    if(/crlv|licenciamento/.test(l)) return 'CRLV';
    if(/defensiva|dire[çc][aã]o/.test(l)) return 'Direção Defensiva';
    if(/seguro/.test(l)) return 'Seguro';
    if(/rastreador/.test(l)) return 'Rastreador';
    if(/fuma[çc]a/.test(l)) return 'Teste de Fumaça';
    return _norm(t) || 'Outro';
  }

  function detectarVencimentos(grid){
    const out=[]; if(!grid||!grid.length) return out;
    const nrows=grid.length;
    const cell=(r,c)=>{ const row=grid[r]; return row&&row[c]!=null?_norm(row[c]):''; };
    for(let r=0;r<nrows;r++){
      const row=grid[r]||[];
      for(let c=0;c<row.length;c++){
        if(!_ehValidade(row[c])) continue;
        // coluna Data à esquerda (até 4 células)
        let dataCol=-1; for(let k=c-1;k>=0 && k>=c-4;k--){ if(_ehData(row[k])){ dataCol=k; break; } }
        if(dataCol<0) continue;
        // coluna do rótulo (Colaborador/Placa/Programa) entre Data e Validade
        let labelCol=-1, vinc=null;
        for(let k=dataCol+1;k<c;k++){ const t=_labelVinc(row[k]); if(t){ labelCol=k; vinc=t; break; } }
        if(labelCol<0){ labelCol=dataCol+1; vinc='empresa'; }
        const labelHdr=_low(row[labelCol]);
        const tipoNaColuna=/programa|documento|^tipo$/.test(labelHdr); // o tipo vem por linha
        // título do bloco (procura acima, nas colunas do bloco)
        let titulo='';
        for(let up=r-1; up>=Math.max(0,r-5) && !titulo; up--){
          for(let cc=dataCol; cc<=c; cc++){ const v=cell(up,cc);
            if(v && !_ehData(v) && !_ehValidade(v) && !_labelVinc(v)){ titulo=v; break; } }
        }
        // linhas de dados abaixo do cabeçalho
        for(let rr=r+1; rr<nrows; rr++){
          const emisR=cell(rr,dataCol), chaveR=cell(rr,labelCol), validR=cell(rr,c);
          if(_ehValidade(validR) || _labelVinc(chaveR)) break;         // começou outro bloco
          if(_semData(emisR) && _norm(chaveR)==='' && _semData(validR)) break; // linha vazia = fim
          const validade=_semData(validR)?'':validR;
          const emissao=_semData(emisR)?'':emisR;
          const chave=_norm(chaveR)==='-'?'':_norm(chaveR);
          if(!chave && !validade && !tipoNaColuna) continue;
          if(tipoNaColuna){
            if(!chave) continue;                       // sem o nome do programa não há tipo
            out.push({ titulo, tipo:canonTipo(chave), vinculo:'empresa', chave:'', emissao, validade, origem:'planilha' });
          } else {
            if(!chave) continue;                        // precisa do nome/placa
            out.push({ titulo, tipo:canonTipo(titulo), vinculo:vinc, chave, emissao, validade, origem:'planilha' });
          }
        }
      }
    }
    return out;
  }

  return { lerArquivo, serialToISO, suportaXLSX, detectarVencimentos, canonTipo, _lerXLSX:lerXLSX, _lerCSV:lerCSV };
})();
