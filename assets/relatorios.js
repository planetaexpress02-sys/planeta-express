/* ==================================================================
   CENTRAL DE RELATÓRIOS — "PEXRel"  (v6.77)
   ------------------------------------------------------------------
   Motor ÚNICO de relatórios do sistema. Nenhum módulo monta a própria
   folha: cada um só descreve QUAIS dados quer (o catálogo em
   PEX_RELATORIOS) e a engine cuida do resto — cabeçalho da empresa,
   filtros aplicados, KPIs, tabela, gráfico, totais, paginação A4,
   rodapé com "Página X de Y", prévia, impressão/PDF, Excel e CSV.

   Melhorar o padrão aqui melhora TODOS os relatórios de uma vez.

   Fluxo:  dados do módulo → filtros → PEXRel → prévia → PDF/impressão

   O documento é BRANCO e sóbrio de propósito: ele sai da empresa e vai
   para cliente, contador, seguradora, banco ou auditoria. O visual
   cyber fica no sistema, não no papel.
   ================================================================== */

/* ---------- medidas da folha (96 dpi: 1mm = 3,7795px) ---------- */
const PEXREL_MM = 3.779528;
const PEXREL_PG = {
  retrato:  { larg:210, alt:297 },
  paisagem: { larg:297, alt:210 }
};
const PEXREL_MARGEM = { topo:12, base:12, lado:12 };   /* mm */

let PEXRel_estado = null;    /* { spec, paginas } do relatório gerado */

/* ================================================================== */
/*  1. HELPERS DE FORMATAÇÃO (padrão brasileiro, sem arredondar antes) */
/* ================================================================== */
function relMoney(v){
  const n = Number(v);
  if(v==null || v==='' || isNaN(n)) return '—';
  return 'R$ ' + n.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2});
}
function relNum(v, casas){
  const n = Number(v);
  if(v==null || v==='' || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:casas||0, maximumFractionDigits:casas==null?0:casas});
}
function relPct(v, casas){
  const n = Number(v);
  if(v==null || v==='' || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:casas==null?2:casas, maximumFractionDigits:casas==null?2:casas}) + '%';
}
function relData(iso){ return (typeof fmtD==='function') ? fmtD(iso) : (iso||'—'); }
function relEmpresa(){ return (typeof DB!=='undefined' && DB.empresa) ? DB.empresa : {nome:'Planeta Express Transportes'}; }
function relResponsavel(){
  try{ const n = (typeof nomeUsuario==='function') ? nomeUsuario() : ''; if(n) return n; }catch(e){}
  return '—';
}
/* Logo do cabeçalho. Não usa um caminho fixo: pega o src de uma imagem que
   a página já carregou. Assim funciona igual na pasta (assets/logo.png) e no
   arquivo único do celular, onde a logo vem embutida em base64. */
function relLogoSrc(){
  const img = document.querySelector('.logo-badge img, .sp-logo img, .tb-logo img');
  return (img && img.getAttribute('src')) || '';
}
function relAgora(){
  const d = new Date();
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
/* Nome de arquivo profissional: PlanetaExpress_Relatorio_Abastecimentos_08-2026 */
function relNomeArquivo(spec){
  const limpo = String(spec.titulo||'Relatorio')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');
  let per = '';
  if(spec.periodo && spec.periodo.ini){
    const d = String(spec.periodo.ini).split('-');
    if(d.length===3) per = '_' + d[1] + '-' + d[0];
  }
  if(!per){ const d=new Date(); per = '_' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear(); }
  return 'PlanetaExpress_Relatorio_' + limpo + per;
}

/* ================================================================== */
/*  2. GRÁFICOS PARA PAPEL — pequenos, sóbrios, sem efeito             */
/* ================================================================== */
function relGraficoBarras(g){
  const dados = (g.dados||[]).filter(function(d){ return d && d.valor!=null; });
  if(!dados.length) return '';
  const max = Math.max.apply(null, dados.map(function(d){ return Math.abs(Number(d.valor)||0); })) || 1;
  const largura = 100, alturaBarra = 15, gap = 6;
  const linhas = dados.map(function(d, i){
    const v = Number(d.valor)||0;
    const pct = Math.abs(v)/max*100;
    const y = i*(alturaBarra+gap);
    return '<div class="rel-gb-l">'
      + '<span class="rel-gb-rot">'+esc(String(d.rotulo||''))+'</span>'
      + '<span class="rel-gb-tr"><i style="width:'+pct.toFixed(1)+'%"></i></span>'
      + '<span class="rel-gb-val">'+esc(d.texto!=null? String(d.texto) : relNum(v))+'</span>'
      + '</div>';
  }).join('');
  return '<div class="rel-graf"><div class="rel-graf-t">'+esc(g.titulo||'')+'</div>'
       + '<div class="rel-gb">'+linhas+'</div></div>';
}

/* ================================================================== */
/*  3. BLOCOS DO DOCUMENTO                                             */
/* ================================================================== */
function relCabecalhoHTML(spec, pagina, total){
  const emp = relEmpresa();
  const linhaPeriodo = spec.periodo && (spec.periodo.ini || spec.periodo.fim)
    ? relData(spec.periodo.ini) + ' a ' + relData(spec.periodo.fim)
    : (spec.periodo && spec.periodo.rotulo) || 'Todo o período';
  return ''
  + '<header class="rel-hd">'
    + '<div class="rel-hd-marca">'
      + '<img class="rel-hd-logo" src="'+relLogoSrc()+'" alt="">'
      + '<div class="rel-hd-emp"><b>PLANETA EXPRESS</b><span>TRANSPORTES</span></div>'
    + '</div>'
    + '<div class="rel-hd-doc">'
      + '<div class="rel-hd-tit">'+esc(spec.titulo||'Relatório')+'</div>'
      + (spec.subtitulo? '<div class="rel-hd-sub">'+esc(spec.subtitulo)+'</div>' : '')
    + '</div>'
    + '<div class="rel-hd-meta">'
      + '<span><i>Período</i>'+esc(linhaPeriodo)+'</span>'
      + '<span><i>Emissão</i>'+esc(relAgora())+'</span>'
      + '<span><i>Responsável</i>'+esc(relResponsavel())+'</span>'
    + '</div>'
  + '</header>'
  + '<div class="rel-hd-linha"></div>';
}
function relRodapeHTML(spec, pagina, total){
  const emp = relEmpresa();
  return '<footer class="rel-ft">'
    + '<span class="rel-ft-e">'+esc((emp.razao||emp.nome||'Planeta Express Transportes'))
      + (emp.cnpj? ' · CNPJ '+esc(emp.cnpj) : '') + '</span>'
    + '<span class="rel-ft-c">Documento gerado pelo Sistema de Gestão Operacional</span>'
    + '<span class="rel-ft-p">Página '+pagina+' de '+total+'</span>'
  + '</footer>';
}
function relIdentificacaoHTML(spec){
  const itens = [];
  if(spec.filtros) Object.keys(spec.filtros).forEach(function(k){
    const v = spec.filtros[k];
    if(v!=null && v!=='') itens.push('<span><i>'+esc(k)+'</i>'+esc(String(v))+'</span>');
  });
  itens.push('<span><i>Registros encontrados</i>'+relNum((spec.linhas||[]).length)+'</span>');
  return '<section class="rel-ident"><div class="rel-ident-t">Filtros aplicados</div>'
       + '<div class="rel-ident-g">'+itens.join('')+'</div></section>';
}
function relKpisHTML(spec){
  const ks = spec.kpis||[];
  if(!ks.length) return '';
  return '<section class="rel-kpis">'
    + ks.map(function(k){
        return '<div class="rel-kpi"><span class="rel-kpi-l">'+esc(k.rotulo||'')+'</span>'
             + '<span class="rel-kpi-v">'+esc(String(k.valor==null?'—':k.valor))+'</span>'
             + (k.nota? '<span class="rel-kpi-n">'+esc(k.nota)+'</span>' : '') + '</div>';
      }).join('')
    + '</section>';
}
function relResumoHTML(spec){
  if(!spec.resumo || !spec.resumo.length) return '';
  return '<section class="rel-resumo"><div class="rel-sec-t">Resumo</div>'
    + '<div class="rel-resumo-g">'
    + spec.resumo.map(function(r){ return '<div class="rel-resumo-i"><i>'+esc(r.rotulo)+'</i><b>'+esc(String(r.valor))+'</b></div>'; }).join('')
    + '</div></section>';
}
function relAnaliseHTML(spec){
  if(!spec.analise || !spec.analise.length) return '';
  return '<section class="rel-analise"><div class="rel-sec-t">Análise</div><ul>'
    + spec.analise.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('')
    + '</ul></section>';
}
/* alinhamento por tipo de coluna: texto à esquerda, número/dinheiro à direita, data ao centro */
function relClasseCol(c){
  if(!c) return '';
  if(c.tipo==='moeda' || c.tipo==='numero') return 'rel-r';
  if(c.tipo==='data') return 'rel-c';
  return '';
}

/* ================================================================== */
/*  4. PAGINAÇÃO REAL — mede no DOM e distribui em folhas A4           */
/*     Nunca corta linha, nunca corta cabeçalho, repete o <thead>.     */
/* ================================================================== */
function relMontarPaginas(spec){
  const pg = PEXREL_PG[spec.orientacao==='paisagem'?'paisagem':'retrato'];
  const largPx = pg.larg*PEXREL_MM, altPx = pg.alt*PEXREL_MM;
  const utilLarg = largPx - (PEXREL_MARGEM.lado*2*PEXREL_MM);
  const utilAlt  = altPx  - ((PEXREL_MARGEM.topo+PEXREL_MARGEM.base)*PEXREL_MM);

  /* Régua invisível com a MESMA largura útil e a MESMA estrutura da folha.
     ⚠️ Medir cada bloco isolado e somar NÃO funciona: margens, bordas e
     colapso de margem fazem o conjunto ser maior que a soma das partes —
     na primeira versão 5 de 13 páginas estouravam a folha. Por isso aqui
     medimos sempre o ACUMULADO da página. */
  let regua = document.getElementById('pexRelRegua');
  if(!regua){ regua = document.createElement('div'); regua.id='pexRelRegua'; document.body.appendChild(regua); }
  regua.className = 'rel-doc rel-regua' + (spec.orientacao==='paisagem'?' rel-paisagem':'');
  regua.style.width = utilLarg+'px';
  const medir = function(html){ regua.innerHTML = '<div class="rel-corpo">'+html+'</div>'; return regua.scrollHeight; };

  const alturaCabecalho = medir(relCabecalhoHTML(spec,1,1));
  const alturaRodape    = medir(relRodapeHTML(spec,1,1));
  const disponivel      = utilAlt - alturaCabecalho - alturaRodape - 8;   /* 8px de folga */

  const paginas = [];
  let atual = '';
  const fechar = function(){ if(atual){ paginas.push(atual); atual=''; } };
  /* tenta acrescentar um bloco; se estourar a folha, abre página nova */
  const empilhar = function(html){
    if(!html) return;
    if(!atual){ atual = html; return; }
    if(medir(atual + html) > disponivel) fechar();
    atual += html;
  };

  empilhar(relIdentificacaoHTML(spec));
  empilhar(relKpisHTML(spec));
  empilhar(relResumoHTML(spec));
  (spec.graficos||[]).forEach(function(g){ empilhar(relGraficoBarras(g)); });

  /* ---- tabela: quebra por linha, repetindo o cabeçalho ---- */
  const cols = spec.colunas||[], linhas = spec.linhas||[];
  if(cols.length){
    const theadHTML = '<thead><tr>'
      + cols.map(function(c){ return '<th class="'+relClasseCol(c)+'"'+(c.larg?' style="width:'+c.larg+'"':'')+'>'+esc(c.rotulo||'')+'</th>'; }).join('')
      + '</tr></thead>';
    const tituloTab = spec.tituloTabela? '<div class="rel-sec-t">'+esc(spec.tituloTabela)+'</div>' : '';
    const trHTML = function(lin){
      return '<tr>' + cols.map(function(c, i){
        const v = Array.isArray(lin) ? lin[i] : lin[c.campo];
        return '<td class="'+relClasseCol(c)+'">'+esc(v==null||v===''?'—':String(v))+'</td>';
      }).join('') + '</tr>';
    };
    const tabela = function(cab, corpo){ return cab + '<table class="rel-tab">'+theadHTML+'<tbody>'+corpo+'</tbody></table>'; };

    if(!linhas.length){
      empilhar('<section class="rel-vazio">'+tituloTab
        + '<div class="rel-vazio-b">Nenhum registro encontrado para os filtros selecionados.</div></section>');
    } else {
      /* estimativa inicial só para dar o primeiro salto; a conferência é sempre real */
      const uma = medir(tabela(tituloTab, trHTML(linhas[0])));
      const vazia = medir(tabela(tituloTab, ''));
      const altLinha = Math.max(10, uma - vazia);

      let i = 0, primeira = true;
      while(i < linhas.length){
        const cab = primeira ? tituloTab
                             : '<div class="rel-cont">'+esc(spec.tituloTabela||'')+' (continuação)</div>';
        const base = atual ? atual : '';
        /* espaço que sobra nesta página para o corpo da tabela */
        const usado = base ? medir(base) : 0;
        const sobra = disponivel - usado - (medir(base + tabela(cab,'')) - (usado||0));
        let n = Math.max(1, Math.floor(sobra / altLinha));
        if(n > linhas.length - i) n = linhas.length - i;

        /* ajusta para BAIXO até caber de verdade */
        let corpo = linhas.slice(i, i+n).map(trHTML).join('');
        while(n > 1 && medir(base + tabela(cab, corpo)) > disponivel){
          n--; corpo = linhas.slice(i, i+n).map(trHTML).join('');
        }
        /* e para CIMA enquanto ainda couber (evita página quase vazia) */
        while(i+n < linhas.length){
          const tenta = linhas.slice(i, i+n+1).map(trHTML).join('');
          if(medir(base + tabela(cab, tenta)) > disponivel) break;
          n++; corpo = tenta;
        }
        /* uma linha sozinha que não cabe: começa numa folha limpa */
        if(!base && medir(tabela(cab, corpo)) > disponivel && n===1){ /* segue assim mesmo: linha isolada */ }
        else if(base && medir(base + tabela(cab, corpo)) > disponivel){ fechar(); continue; }

        atual = (atual||'') + tabela(cab, corpo);
        i += n; primeira = false;
        if(i < linhas.length) fechar();
      }
      if(spec.totais && spec.totais.length){
        empilhar('<table class="rel-tab rel-tot"><tbody>'
          + spec.totais.map(function(t){
              return '<tr><td class="rel-tot-l" colspan="'+Math.max(1,cols.length-1)+'">'+esc(t.rotulo)+'</td>'
                   + '<td class="rel-r">'+esc(String(t.valor))+'</td></tr>'; }).join('')
          + '</tbody></table>');
      }
    }
  }

  empilhar(relAnaliseHTML(spec));
  fechar();
  if(!paginas.length) paginas.push('');
  regua.innerHTML = '';
  return paginas;
}

/* Monta o HTML final já paginado */
function relDocumentoHTML(spec){
  const paginas = relMontarPaginas(spec);
  const orient = spec.orientacao==='paisagem' ? 'paisagem' : 'retrato';
  return '<div class="rel-doc rel-'+orient+'" id="pexRelDoc">'
    + paginas.map(function(conteudo, i){
        return '<section class="rel-pg">'
          + relCabecalhoHTML(spec, i+1, paginas.length)
          + '<div class="rel-corpo">'+conteudo+'</div>'
          + relRodapeHTML(spec, i+1, paginas.length)
        + '</section>';
      }).join('')
    + '</div>';
}

/* ================================================================== */
/*  5. PRÉVIA + EXPORTAÇÃO                                             */
/* ================================================================== */
function PEXRelGerar(spec){
  spec = spec || {};
  spec.orientacao = spec.orientacao || ((spec.colunas||[]).length > 7 ? 'paisagem' : 'retrato');
  PEXRel_estado = { spec: spec };

  let ov = document.getElementById('pexRelOv');
  if(!ov){ ov = document.createElement('div'); ov.id='pexRelOv'; ov.className='rel-ov'; document.body.appendChild(ov); }
  ov.innerHTML =
    '<div class="rel-ov-bar no-print">'
      + '<div class="rel-ov-t">'+svg('print')+'<b>'+esc(spec.titulo||'Relatório')+'</b>'
        + '<span id="relOvPg"></span></div>'
      + '<div class="rel-ov-acoes">'
        + '<button class="btn" onclick="PEXRelOrientar()" id="relBtnOri" title="Alternar retrato / paisagem">'+svg('doc')+' <span>'+(spec.orientacao==='paisagem'?'Paisagem':'Retrato')+'</span></button>'
        + '<button class="btn" onclick="PEXRelExportar(\'csv\')" title="Baixar em CSV">'+svg('download')+' CSV</button>'
        + '<button class="btn" onclick="PEXRelExportar(\'xls\')" title="Baixar para Excel">'+svg('download')+' Excel</button>'
        + '<button class="btn primary" onclick="PEXRelImprimir()">'+svg('print')+' Imprimir / Salvar PDF</button>'
        + '<button class="btn ghost" onclick="PEXRelFechar()">Fechar</button>'
      + '</div>'
    + '</div>'
    + '<div class="rel-ov-scroll" id="relOvScroll"></div>';
  document.body.classList.add('rel-aberto');
  PEXRelRedesenhar();
  ov.classList.add('show');
}
function PEXRelRedesenhar(){
  if(!PEXRel_estado) return;
  const box = document.getElementById('relOvScroll'); if(!box) return;
  box.innerHTML = relDocumentoHTML(PEXRel_estado.spec);
  const n = box.querySelectorAll('.rel-pg').length;
  const lb = document.getElementById('relOvPg');
  if(lb) lb.textContent = n + (n===1? ' página' : ' páginas') + ' · A4 ' + (PEXRel_estado.spec.orientacao==='paisagem'?'paisagem':'retrato');
  /* @page precisa saber a orientação ANTES de imprimir */
  let st = document.getElementById('pexRelPage');
  if(!st){ st = document.createElement('style'); st.id='pexRelPage'; document.head.appendChild(st); }
  st.textContent = '@page{ size:A4 '+(PEXRel_estado.spec.orientacao==='paisagem'?'landscape':'portrait')+'; margin:0 }';
}
function PEXRelOrientar(){
  if(!PEXRel_estado) return;
  PEXRel_estado.spec.orientacao = PEXRel_estado.spec.orientacao==='paisagem' ? 'retrato' : 'paisagem';
  const b = document.querySelector('#relBtnOri span');
  if(b) b.textContent = PEXRel_estado.spec.orientacao==='paisagem'?'Paisagem':'Retrato';
  PEXRelRedesenhar();
}
function PEXRelFechar(){
  const ov = document.getElementById('pexRelOv');
  if(ov){ ov.classList.remove('show'); ov.innerHTML=''; }
  document.body.classList.remove('rel-aberto');
  PEXRel_estado = null;
}
function PEXRelImprimir(){
  if(!PEXRel_estado) return;
  /* o navegador usa o <title> como nome sugerido do PDF */
  const antigo = document.title;
  document.title = relNomeArquivo(PEXRel_estado.spec);
  const voltar = function(){ document.title = antigo; window.removeEventListener('afterprint', voltar); };
  window.addEventListener('afterprint', voltar);
  setTimeout(function(){ window.print(); setTimeout(voltar, 2000); }, 80);
}
function PEXRelExportar(fmt){
  if(!PEXRel_estado) return;
  const spec = PEXRel_estado.spec;
  const cols = spec.colunas||[], linhas = spec.linhas||[];
  if(!linhas.length){ if(typeof toast==='function') toast('Não há registros para exportar.','err'); return; }
  const valor = function(lin, i, c){ const v = Array.isArray(lin)? lin[i] : lin[c.campo]; return v==null? '' : String(v); };
  const nome = relNomeArquivo(spec);
  if(fmt==='csv'){
    const sep=';';
    const txt = [cols.map(function(c){ return c.rotulo; }).join(sep)]
      .concat(linhas.map(function(l){ return cols.map(function(c,i){
        const s = valor(l,i,c); return /[";\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }).join(sep); }))
      .join('\r\n');
    relBaixar(nome+'.csv', '﻿'+txt, 'text/csv;charset=utf-8');
    return;
  }
  const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
    + '<table border="1"><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c.rotulo)+'</th>'; }).join('')+'</tr></thead><tbody>'
    + linhas.map(function(l){ return '<tr>'+cols.map(function(c,i){ return '<td>'+esc(valor(l,i,c))+'</td>'; }).join('')+'</tr>'; }).join('')
    + '</tbody></table></body></html>';
  relBaixar(nome+'.xls', html, 'application/vnd.ms-excel;charset=utf-8');
}
function relBaixar(nome, conteudo, mime){
  try{
    const blob = new Blob([conteudo], {type: mime||'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(a.href); }catch(e){} a.remove(); }, 800);
    if(typeof toast==='function') toast('Arquivo gerado: '+nome);
  }catch(e){ if(typeof toast==='function') toast('Não consegui gerar o arquivo.','err'); }
}

/* ==================================================================
   6. CATÁLOGO — cada módulo só descreve QUAIS dados quer.
      A engine acima cuida do papel. Para acrescentar um relatório
      novo basta uma entrada aqui: nada de folha própria por tela.
   ================================================================== */
function _relNoPeriodo(iso, f){
  if(!f || (!f.ini && !f.fim)) return true;
  if(!iso) return false;
  const d = String(iso).slice(0,10);
  if(f.ini && d < f.ini) return false;
  if(f.fim && d > f.fim) return false;
  return true;
}
function _relVeic(id){ return (typeof veiculo==='function') ? veiculo(id) : null; }
function _relPlaca(id){ const v=_relVeic(id); return v? v.placa : '—'; }
function _relSoma(arr, campo){ return arr.reduce(function(s,x){ return s + (Number(x[campo])||0); }, 0); }
function _relPorChave(arr, chave, valor){
  const m = {};
  arr.forEach(function(x){
    const k = (typeof chave==='function'? chave(x) : x[chave]) || '—';
    m[k] = (m[k]||0) + (valor? (Number(typeof valor==='function'? valor(x) : x[valor])||0) : 1);
  });
  return Object.keys(m).map(function(k){ return {rotulo:k, valor:m[k]}; }).sort(function(a,b){ return b.valor-a.valor; });
}
function _relDias(iso){ return (typeof diasAte==='function') ? diasAte(iso) : null; }
function _relMoneyBar(d){ return {rotulo:d.rotulo, valor:d.valor, texto:relMoney(d.valor)}; }

const PEX_RELATORIOS = [
  /* ------------------------------------------------------------ FROTA */
  { id:'frota-geral', modulo:'frota', nome:'Cadastro da frota',
    desc:'Todos os veículos com marca, modelo, ano, chassi, renavam e situação.',
    filtros:['tipoVeiculo','situacaoVeiculo'], orientacao:'paisagem',
    gerar:function(f){
      let vs = (DB.veiculos||[]).slice();
      if(f.tipoVeiculo==='cavalo') vs = vs.filter(function(v){ return v.tipo==='Cavalo'; });
      if(f.tipoVeiculo==='reboque') vs = vs.filter(function(v){ return typeof isReb==='function' && isReb(v); });
      if(f.situacaoVeiculo && f.situacaoVeiculo!=='todos') vs = vs.filter(function(v){ return (v.status||'Ativo')===f.situacaoVeiculo; });
      const cav = vs.filter(function(v){ return v.tipo==='Cavalo'; }).length;
      return {
        tituloTabela:'Veículos cadastrados',
        colunas:[{rotulo:'Placa'},{rotulo:'Tipo'},{rotulo:'Marca'},{rotulo:'Modelo'},{rotulo:'Ano',tipo:'data'},
                 {rotulo:'Chassi'},{rotulo:'Renavam'},{rotulo:'Cor'},{rotulo:'Situação'}],
        linhas: vs.map(function(v){ return [v.placa,v.tipo,v.marca,v.modelo,v.anoModelo,v.chassi,v.renavam,v.cor,v.status||'Ativo']; }),
        kpis:[{rotulo:'Veículos',valor:relNum(vs.length)},{rotulo:'Cavalos',valor:relNum(cav)},
              {rotulo:'Reboques',valor:relNum(vs.length-cav)}]
      };
    }},
  { id:'frota-km', modulo:'frota', nome:'Quilometragem e horas',
    desc:'Leitura atual de cada veículo e a data da última atualização.',
    filtros:['tipoVeiculo'],
    gerar:function(f){
      let vs = (DB.veiculos||[]).filter(function(v){ return v.status!=='Arquivado'; });
      if(f.tipoVeiculo==='cavalo') vs = vs.filter(function(v){ return v.tipo==='Cavalo'; });
      if(f.tipoVeiculo==='reboque') vs = vs.filter(function(v){ return typeof isReb==='function' && isReb(v); });
      return {
        tituloTabela:'Leituras da frota',
        colunas:[{rotulo:'Placa'},{rotulo:'Tipo'},{rotulo:'Marca / Modelo'},{rotulo:'KM atual',tipo:'numero'},
                 {rotulo:'Horas',tipo:'numero'},{rotulo:'Última leitura',tipo:'data'}],
        linhas: vs.map(function(v){
          const hk=(v.histKm||[]); const ult=hk.length? hk[hk.length-1] : null;
          return [v.placa, v.tipo, ((v.marca||'')+' '+(v.modelo||'')).trim(),
                  v.kmAtual!=null? relNum(v.kmAtual):'—', v.horaAtual!=null? relNum(v.horaAtual):'—',
                  ult && ult.data? relData(ult.data) : (v.kmData? relData(v.kmData) : '—')];
        })
      };
    }},

  /* ------------------------------------------------------- MOTORISTAS */
  { id:'mot-cadastro', modulo:'motoristas', nome:'Cadastro de motoristas',
    desc:'Dados pessoais, contato e situação de cada motorista.',
    filtros:['situacaoMotorista'], orientacao:'paisagem',
    gerar:function(f){
      let ms = (DB.motoristas||[]).slice();
      if(f.situacaoMotorista && f.situacaoMotorista!=='todos') ms = ms.filter(function(m){ return (m.status||'Ativo')===f.situacaoMotorista; });
      return {
        tituloTabela:'Motoristas',
        colunas:[{rotulo:'Matrícula'},{rotulo:'Nome',larg:'22%'},{rotulo:'CPF'},{rotulo:'Nascimento',tipo:'data'},
                 {rotulo:'Função'},{rotulo:'Celular'},{rotulo:'Admissão',tipo:'data'},{rotulo:'Situação'}],
        linhas: ms.map(function(m){ return [m.matricula, m.nome, m.cpf, relData(m.nascimento), m.funcao||m.cargo,
                                            m.celular||m.telefone, relData(m.admissao), m.status||'Ativo']; }),
        kpis:[{rotulo:'Motoristas',valor:relNum(ms.length)},
              {rotulo:'Ativos',valor:relNum(ms.filter(function(m){ return (m.status||'Ativo')==='Ativo'; }).length)}]
      };
    }},
  { id:'mot-cnh', modulo:'motoristas', nome:'CNH e habilitação',
    desc:'Número, categoria, validade e situação da habilitação.',
    filtros:[],
    gerar:function(){
      const ms = (DB.motoristas||[]).filter(function(m){ return (m.status||'Ativo')==='Ativo'; });
      return {
        tituloTabela:'Habilitação dos motoristas',
        colunas:[{rotulo:'Motorista',larg:'30%'},{rotulo:'Nº da CNH'},{rotulo:'Categoria'},
                 {rotulo:'Validade',tipo:'data'},{rotulo:'Situação'}],
        linhas: ms.map(function(m){ const d=_relDias(m.cnhValidade);
          return [m.nome, m.cnh, m.categoria, relData(m.cnhValidade),
                  d==null? '—' : (d<0? 'Vencida há '+Math.abs(d)+' dias' : 'Vence em '+d+' dias')]; }),
        kpis:[{rotulo:'Motoristas',valor:relNum(ms.length)},
              {rotulo:'CNH vencida',valor:relNum(ms.filter(function(m){ const d=_relDias(m.cnhValidade); return d!=null&&d<0; }).length)},
              {rotulo:'Vence em 90 dias',valor:relNum(ms.filter(function(m){ const d=_relDias(m.cnhValidade); return d!=null&&d>=0&&d<=90; }).length)}]
      };
    }},

  /* ------------------------------------------------------ VENCIMENTOS */
  { id:'venc-faixa', modulo:'vencimentos', nome:'Vencimentos e documentos',
    desc:'Documentos por situação: vencidos, na faixa de atenção ou em dia.',
    filtros:['faixaVenc','tipoVenc'], orientacao:'paisagem',
    gerar:function(f){
      let lista = (typeof todosVencimentos==='function'? todosVencimentos() : []).map(function(v){ return {v:v, d:_relDias(v.validade)}; });
      if(f.tipoVenc && f.tipoVenc!=='todos') lista = lista.filter(function(x){ return x.v.tipo===f.tipoVenc; });
      const fx = f.faixaVenc||'atencao';
      if(fx==='vencidos') lista = lista.filter(function(x){ return x.d!=null && x.d<0; });
      else if(fx==='atencao') lista = lista.filter(function(x){ return x.d!=null && x.d<=30; });
      else if(fx==='emdia') lista = lista.filter(function(x){ return x.d!=null && x.d>30; });
      lista.sort(function(a,b){ return (a.d==null?9e9:a.d)-(b.d==null?9e9:b.d); });
      const nome = function(x){ return typeof nomeEntidade==='function'? nomeEntidade(x.v) : (x.v.refId||'—'); };
      const ent = {veiculo:'Veículo', motorista:'Motorista', seguro:'Seguro', licenca:'Licença'};
      return {
        tituloTabela:'Documentos',
        colunas:[{rotulo:'Documento',larg:'18%'},{rotulo:'Vínculo',larg:'20%'},{rotulo:'Tipo'},{rotulo:'Nº'},
                 {rotulo:'Órgão'},{rotulo:'Validade',tipo:'data'},{rotulo:'Situação'}],
        linhas: lista.map(function(x){ return [x.v.tipo, nome(x), ent[x.v.entidade]||'Empresa', x.v.numero, x.v.orgao,
          relData(x.v.validade), x.d==null? 'sem data' : (x.d<0? 'Vencido há '+Math.abs(x.d)+' dias' : 'Vence em '+x.d+' dias')]; }),
        kpis:[{rotulo:'Registros',valor:relNum(lista.length)},
              {rotulo:'Vencidos',valor:relNum(lista.filter(function(x){ return x.d!=null&&x.d<0; }).length)},
              {rotulo:'Vencem em 30 dias',valor:relNum(lista.filter(function(x){ return x.d!=null&&x.d>=0&&x.d<=30; }).length)}],
        graficos:[{titulo:'Documentos por tipo', dados:_relPorChave(lista.map(function(x){ return x.v; }),'tipo').slice(0,10)}]
      };
    }},

  /* ------------------------------------------------------- MANUTENÇÃO */
  { id:'manut-servicos', modulo:'manutencao', nome:'Serviços e reparos',
    desc:'Todos os serviços do período, com oficina, tipo e valor.',
    filtros:['periodo','veiculo','tipoManut'], orientacao:'paisagem',
    gerar:function(f){
      let s = (DB.servicos||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.veiculo && f.veiculo!=='todos') s = s.filter(function(x){ return x.veiculoId===f.veiculo; });
      if(f.tipoManut && f.tipoManut!=='todos') s = s.filter(function(x){ return (x.tipo||'Corretiva')===f.tipoManut; });
      s.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const total = _relSoma(s,'valor');
      const corr = s.filter(function(x){ return (x.tipo||'Corretiva')==='Corretiva'; });
      const prev = s.filter(function(x){ return x.tipo==='Preventiva'; });
      return {
        tituloTabela:'Serviços executados',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Placa'},{rotulo:'Serviço',larg:'32%'},{rotulo:'Tipo'},
                 {rotulo:'Oficina',larg:'16%'},{rotulo:'KM/Horas',tipo:'numero'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: s.map(function(x){ return [relData(x.data), _relPlaca(x.veiculoId), x.descricao, x.tipo||'Corretiva',
                                           x.oficina, x.km!=null&&x.km!==''? relNum(x.km):'—', relMoney(x.valor)]; }),
        kpis:[{rotulo:'Serviços',valor:relNum(s.length)},{rotulo:'Custo total',valor:relMoney(total)},
              {rotulo:'Corretiva',valor:relMoney(_relSoma(corr,'valor')),nota:corr.length+' serviço(s)'},
              {rotulo:'Preventiva',valor:relMoney(_relSoma(prev,'valor')),nota:prev.length+' serviço(s)'}],
        totais:[{rotulo:'TOTAL DO PERÍODO', valor:relMoney(total)}],
        graficos:[{titulo:'Custo por veículo',
          dados:_relPorChave(s, function(x){ return _relPlaca(x.veiculoId); }, 'valor').slice(0,12).map(_relMoneyBar)}],
        analise: s.length? ['Custo médio por serviço: '+relMoney(total/s.length)+'.',
          'A manutenção preventiva representa '+relPct(total? _relSoma(prev,'valor')/total*100 : 0)+' do custo do período.'] : []
      };
    }},
  { id:'manut-proximas', modulo:'manutencao', nome:'Próximas trocas de óleo',
    desc:'Situação de cada veículo em relação à próxima troca programada.',
    filtros:[],
    gerar:function(){
      const linhas = [];
      (DB.veiculos||[]).filter(function(v){ return v.status!=='Arquivado'; }).forEach(function(v){
        (DB.manutencoes||[]).filter(function(m){ return m.veiculoId===v.id; }).forEach(function(m){
          const atual = (typeof isReb==='function' && isReb(v)) ? v.horaAtual : v.kmAtual;
          const falta = (m.proxKm!=null && atual!=null) ? (m.proxKm-atual) : null;
          linhas.push([v.placa, m.item, relData(m.data), m.kmTroca!=null? relNum(m.kmTroca):'—',
            m.proxKm!=null? relNum(m.proxKm):'—',
            falta==null? '—' : (falta<0? 'Vencida em '+relNum(Math.abs(falta)) : 'Faltam '+relNum(falta))]);
        });
      });
      return {
        tituloTabela:'Trocas programadas',
        colunas:[{rotulo:'Placa'},{rotulo:'Item',larg:'26%'},{rotulo:'Última troca',tipo:'data'},
                 {rotulo:'KM/H da troca',tipo:'numero'},{rotulo:'Próxima',tipo:'numero'},{rotulo:'Situação'}],
        linhas: linhas,
        kpis:[{rotulo:'Itens acompanhados',valor:relNum(linhas.length)}]
      };
    }},

  /* ------------------------------------------------------------ PNEUS */
  { id:'pneus-frota', modulo:'pneus', nome:'Pneus da frota',
    desc:'Pneus instalados por veículo, com posição, marca, medida, DOT e condição.',
    filtros:['veiculo'], orientacao:'paisagem',
    gerar:function(f){
      let p = (DB.pneus||[]).slice();
      if(f.veiculo && f.veiculo!=='todos') p = p.filter(function(x){ return x.veiculoId===f.veiculo; });
      const R = (typeof pneusResumo==='function') ? pneusResumo() : {total:p.length, estoque:0};
      return {
        tituloTabela:'Pneus instalados',
        colunas:[{rotulo:'Placa'},{rotulo:'Posição',larg:'18%'},{rotulo:'Qtd',tipo:'numero'},{rotulo:'Marca'},
                 {rotulo:'Medida'},{rotulo:'DOT'},{rotulo:'Sulco'},{rotulo:'Condição'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: p.map(function(x){ return [_relPlaca(x.veiculoId), x.posicao||x.slot, (typeof pneuQtd==='function'? pneuQtd(x):1),
          x.marca, x.medida, x.dot, x.sulco!=null&&x.sulco!==''? x.sulco+' mm':'—',
          x.status||'—', x.valor? relMoney(x.valor):'—']; }),
        kpis:[{rotulo:'Pneus no total',valor:relNum(R.total),nota:'instalados na frota'},
              {rotulo:'Registros',valor:relNum(p.length)},
              {rotulo:'Em estoque',valor:relNum(R.estoque)}]
      };
    }},

  /* --------------------------------------------------- ABASTECIMENTOS */
  { id:'abast-periodo', modulo:'abastecimento', nome:'Abastecimentos do período',
    desc:'Litros, valor, posto e preço por litro de cada abastecimento.',
    filtros:['periodo','veiculo'], orientacao:'paisagem',
    gerar:function(f){
      let a = (DB.abastecimentos||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.veiculo && f.veiculo!=='todos') a = a.filter(function(x){ return x.veiculoId===f.veiculo; });
      a.sort(function(x,y){ return String(x.data||'').localeCompare(String(y.data||'')); });
      const litros = _relSoma(a,'litros'), valor = _relSoma(a,'valor');
      return {
        tituloTabela:'Abastecimentos',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Placa'},{rotulo:'Posto',larg:'26%'},{rotulo:'KM/Horas',tipo:'numero'},
                 {rotulo:'Litros',tipo:'numero'},{rotulo:'Valor',tipo:'moeda'},{rotulo:'R$/L',tipo:'moeda'}],
        linhas: a.map(function(x){ const l=Number(x.litros)||0, v=Number(x.valor)||0;
          return [relData(x.data), _relPlaca(x.veiculoId), x.posto, x.km!=null?relNum(x.km):'—',
                  relNum(l,2), relMoney(v), l? relMoney(v/l):'—']; }),
        kpis:[{rotulo:'Abastecimentos',valor:relNum(a.length)},{rotulo:'Total abastecido',valor:relNum(litros,2)+' L'},
              {rotulo:'Total gasto',valor:relMoney(valor)},
              {rotulo:'Preço médio',valor: litros? relMoney(valor/litros)+'/L' : '—'}],
        totais: a.length? [{rotulo:'TOTAL DO PERÍODO', valor:relMoney(valor)}] : [],
        graficos: a.length? [{titulo:'Gasto por veículo',
          dados:_relPorChave(a, function(x){ return _relPlaca(x.veiculoId); }, 'valor').slice(0,12).map(_relMoneyBar)}] : []
      };
    }},

  /* --------------------------------------------------------- PEDÁGIOS */
  { id:'pedagio-periodo', modulo:'pedagios', nome:'Pedágios do período',
    desc:'Passagens com praça, concessionária, categoria e valor.',
    filtros:['periodo','veiculo'], orientacao:'paisagem',
    gerar:function(f){
      let p = (DB.pedagios||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.veiculo && f.veiculo!=='todos'){ const pl=_relPlaca(f.veiculo); p = p.filter(function(x){ return x.placa===pl; }); }
      p.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const total=_relSoma(p,'valor');
      const pago=p.filter(function(x){ return !/vale/i.test(x.tipo||''); });
      const vale=p.filter(function(x){ return /vale/i.test(x.tipo||''); });
      return {
        tituloTabela:'Passagens',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Hora',tipo:'data'},{rotulo:'Placa'},{rotulo:'Concessionária'},
                 {rotulo:'Praça',larg:'30%'},{rotulo:'Cat.',tipo:'numero'},{rotulo:'Tipo'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: p.map(function(x){ return [relData(x.data), x.hora, x.placa, x.conc, x.praca, x.cat, x.tipo, relMoney(x.valor)]; }),
        kpis:[{rotulo:'Passagens',valor:relNum(p.length)},{rotulo:'Total',valor:relMoney(total)},
              {rotulo:'Pago pela empresa',valor:relMoney(_relSoma(pago,'valor'))},
              {rotulo:'Vale-pedágio',valor:relMoney(_relSoma(vale,'valor')),nota:'reembolsado pelo embarcador'}],
        totais: p.length? [{rotulo:'TOTAL DO PERÍODO', valor:relMoney(total)}] : [],
        graficos: p.length? [{titulo:'Valor por praça', dados:_relPorChave(p,'praca','valor').slice(0,10).map(_relMoneyBar)}] : []
      };
    }},

  /* ---------------------------------------------------------- SEGUROS */
  { id:'seguros-apolices', modulo:'seguros', nome:'Apólices de seguro',
    desc:'Apólices vigentes com seguradora, objeto, vigência e prêmio.',
    filtros:[], orientacao:'paisagem',
    gerar:function(){
      const s = (DB.seguros||[]).filter(function(x){ return x && x.status!=='Cancelado'; });
      const total=_relSoma(s,'premio');
      return {
        tituloTabela:'Apólices',
        colunas:[{rotulo:'Seguradora'},{rotulo:'Ramo'},{rotulo:'Apólice'},{rotulo:'Objeto / Placa',larg:'22%'},
                 {rotulo:'Início',tipo:'data'},{rotulo:'Fim',tipo:'data'},{rotulo:'Prêmio',tipo:'moeda'},{rotulo:'Situação'}],
        linhas: s.map(function(x){ const d=_relDias(x.fim);
          return [x.seguradora, x.ramo||x.tipo, x.apolice, x.objeto||x.placa||'—', relData(x.inicio), relData(x.fim),
                  relMoney(x.premio), d==null?'—':(d<0?'Vencida':(d<=30?'Vence em '+d+' dias':'Vigente'))]; }),
        kpis:[{rotulo:'Apólices',valor:relNum(s.length)},{rotulo:'Prêmio total',valor:relMoney(total)},
              {rotulo:'A vencer em 90 dias',valor:relNum(s.filter(function(x){ const d=_relDias(x.fim); return d!=null&&d>=0&&d<=90; }).length)}],
        totais: s.length? [{rotulo:'PRÊMIO TOTAL', valor:relMoney(total)}] : []
      };
    }},

  /* ------------------------------------------------------------- CT-e */
  { id:'cte-emitidos', modulo:'ctes', nome:'CT-e emitidos',
    desc:'Conhecimentos de transporte com cliente, rota e valor.',
    filtros:['periodo','statusCte'], orientacao:'paisagem',
    gerar:function(f){
      let c = (DB.ctes||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.statusCte && f.statusCte!=='todos') c = c.filter(function(x){ return (x.status||'Emitido')===f.statusCte; });
      c.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const total=_relSoma(c,'valor');
      return {
        tituloTabela:'Conhecimentos de transporte',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Nº'},{rotulo:'Cliente',larg:'18%'},{rotulo:'Destinatário',larg:'16%'},
                 {rotulo:'Rota',larg:'20%'},{rotulo:'Placa'},{rotulo:'Valor',tipo:'moeda'},{rotulo:'Situação'}],
        linhas: c.map(function(x){ return [relData(x.data), x.numero, x.cliente, x.destinatario,
          ((x.origem||'—')+' → '+(x.destino||'—')), x.placa, relMoney(x.valor), x.status||'Emitido']; }),
        kpis:[{rotulo:'CT-e',valor:relNum(c.length)},{rotulo:'Faturamento',valor:relMoney(total)},
              {rotulo:'Ticket médio',valor: c.length? relMoney(total/c.length):'—'}],
        totais: c.length? [{rotulo:'FATURAMENTO DO PERÍODO', valor:relMoney(total)}] : [],
        graficos: c.length? [{titulo:'Faturamento por cliente', dados:_relPorChave(c,'cliente','valor').slice(0,10).map(_relMoneyBar)}] : []
      };
    }},

  /* ---------------------------------------------------------- VIAGENS */
  { id:'viagens-periodo', modulo:'viagens', nome:'Viagens do período',
    desc:'Viagens com placa, motorista, destino e situação da baixa.',
    filtros:['periodo','statusViagem'], orientacao:'paisagem',
    gerar:function(f){
      let v = (DB.viagens||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.statusViagem && f.statusViagem!=='todos') v = v.filter(function(x){ return (x.status||'')===f.statusViagem; });
      v.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      return {
        tituloTabela:'Viagens',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Placa'},{rotulo:'Motorista',larg:'18%'},{rotulo:'Transporte'},
                 {rotulo:'Destino',larg:'20%'},{rotulo:'Baixado'},{rotulo:'Termo pallet'},{rotulo:'Situação'}],
        linhas: v.map(function(x){ return [relData(x.data), x.placa, x.motorista, x.transporte, x.destino,
          x.baixado||'—', x.termoPallet||'—', x.status||'—']; }),
        kpis:[{rotulo:'Viagens',valor:relNum(v.length)},
              {rotulo:'Pendentes',valor:relNum(v.filter(function(x){ return x.status==='Pendente'; }).length)}],
        graficos: v.length? [{titulo:'Viagens por placa', dados:_relPorChave(v,'placa').slice(0,12)}] : []
      };
    }},

  /* -------------------------------------------------------- DESCARGAS */
  { id:'descargas-periodo', modulo:'descargas', nome:'Descargas do período',
    desc:'Senhas, locais e valores de descarga.',
    filtros:['periodo'],
    gerar:function(f){
      const d = (DB.descargas||[]).filter(function(x){ return _relNoPeriodo(x.data, f); })
        .sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const total=_relSoma(d,'valor');
      return {
        tituloTabela:'Descargas',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Placa'},{rotulo:'Transporte'},{rotulo:'Senha'},
                 {rotulo:'Local',larg:'28%'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: d.map(function(x){ return [relData(x.data), x.placa, x.transporte, x.senha, x.local, relMoney(x.valor)]; }),
        kpis:[{rotulo:'Descargas',valor:relNum(d.length)},{rotulo:'Total',valor:relMoney(total)}],
        totais: d.length? [{rotulo:'TOTAL DO PERÍODO', valor:relMoney(total)}] : []
      };
    }},

  /* --------------------------------------------------------- BATERIAS */
  { id:'baterias-frota', modulo:'baterias', nome:'Baterias da frota',
    desc:'Baterias por placa, com garantia e valor.',
    filtros:[],
    gerar:function(){
      const b = (DB.baterias||[]).slice().sort(function(a,c){ return String(a.placa||'').localeCompare(String(c.placa||'')); });
      return {
        tituloTabela:'Baterias',
        colunas:[{rotulo:'Placa'},{rotulo:'Data',tipo:'data'},{rotulo:'Marca'},{rotulo:'Local da compra',larg:'26%'},
                 {rotulo:'Garantia'},{rotulo:'Garantia até',tipo:'data'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: b.map(function(x){ return [x.placa, relData(x.data), x.marca, x.local,
          x.garantiaMeses? x.garantiaMeses+' meses':'—', relData(x.garantiaAte), relMoney(x.valor)]; }),
        kpis:[{rotulo:'Baterias',valor:relNum(b.length)},{rotulo:'Investimento',valor:relMoney(_relSoma(b,'valor'))}]
      };
    }},

  /* --------------------------------------------------------- LICENÇAS */
  { id:'licencas-geral', modulo:'licencas', nome:'Licenças e alvarás',
    desc:'Licenças com órgão, validade e situação.',
    filtros:[], orientacao:'paisagem',
    gerar:function(){
      const l = (DB.licencas||[]).filter(function(x){ return x && x.situacao!=='arquivada'; });
      return {
        tituloTabela:'Licenças',
        colunas:[{rotulo:'Licença',larg:'24%'},{rotulo:'Categoria'},{rotulo:'Nº'},{rotulo:'Órgão',larg:'18%'},
                 {rotulo:'Município'},{rotulo:'Emissão',tipo:'data'},{rotulo:'Validade',tipo:'data'},{rotulo:'Situação'}],
        linhas: l.map(function(x){ const d=_relDias(x.validade);
          return [x.nome, x.categoria, x.numero, x.orgao, x.municipio, relData(x.emissao), relData(x.validade),
                  d==null?'—':(d<0?'Vencida':(d<=60?'Vence em '+d+' dias':'Vigente'))]; }),
        kpis:[{rotulo:'Licenças',valor:relNum(l.length)},
              {rotulo:'Vencidas',valor:relNum(l.filter(function(x){ const d=_relDias(x.validade); return d!=null&&d<0; }).length)}]
      };
    }},

  /* ------------------------------------------------------- FINANCEIRO */
  { id:'fin-notas', modulo:'financeiro', nome:'Notas de despesa',
    desc:'Despesas somadas por período.',
    filtros:['periodo'],
    gerar:function(f){
      const n = (DB.notas||[]).filter(function(x){ return _relNoPeriodo(x.fim, f); })
        .sort(function(a,b){ return String(a.fim||'').localeCompare(String(b.fim||'')); });
      const tot = function(x){ return (Number(x.alexandria)||0)+(Number(x.notasGerais)||0)+(Number(x.combustivel)||0); };
      const total = n.reduce(function(s,x){ return s+tot(x); },0);
      return {
        tituloTabela:'Períodos lançados',
        colunas:[{rotulo:'Início',tipo:'data'},{rotulo:'Fim',tipo:'data'},{rotulo:'Alexandria',tipo:'moeda'},
                 {rotulo:'Notas gerais',tipo:'moeda'},{rotulo:'Combustível',tipo:'moeda'},{rotulo:'Total',tipo:'moeda'}],
        linhas: n.map(function(x){ return [relData(x.inicio), relData(x.fim), relMoney(x.alexandria),
          relMoney(x.notasGerais), relMoney(x.combustivel), relMoney(tot(x))]; }),
        kpis:[{rotulo:'Períodos',valor:relNum(n.length)},{rotulo:'Despesa total',valor:relMoney(total)}],
        totais: n.length? [{rotulo:'TOTAL', valor:relMoney(total)}] : []
      };
    }},

  { id:'fin-vales', modulo:'financeiro', nome:'Vales Motoristas',
    desc:'Vales e pagamentos por motorista, com o saldo de cada um.',
    filtros:['periodo','motorista'],
    gerar:function(f){
      let v = (DB.vales||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.motorista && f.motorista!=='todos') v = v.filter(function(x){ return x.motoristaId===f.motorista; });
      v.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const nome = function(id){ const m=(typeof motorista==='function')? motorista(id):null; return m? m.nome : '—'; };
      const vales = v.filter(function(x){ return x.tipo!=='Pagamento'; });
      const pagos = v.filter(function(x){ return x.tipo==='Pagamento'; });
      const sv=_relSoma(vales,'valor'), sp=_relSoma(pagos,'valor');
      /* saldo por motorista — mesma conta da tela (valeSaldo) */
      const saldos = (DB.motoristas||[]).map(function(m){
        return {rotulo:m.nome, valor:(typeof valeSaldo==='function')? valeSaldo(m.id) : 0};
      }).filter(function(s){ return s.valor!==0; }).sort(function(a,b){ return b.valor-a.valor; });
      return {
        tituloTabela:'Lançamentos',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Motorista',larg:'32%'},{rotulo:'Tipo'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: v.map(function(x){ return [relData(x.data), nome(x.motoristaId), x.tipo||'Vale', relMoney(x.valor)]; }),
        kpis:[{rotulo:'Lançamentos',valor:relNum(v.length)},
              {rotulo:'Vales adiantados',valor:relMoney(sv),nota:vales.length+' lançamento(s)'},
              {rotulo:'Pagamentos',valor:relMoney(sp),nota:pagos.length+' lançamento(s)'},
              {rotulo:'Saldo em aberto',valor:relMoney(saldos.reduce(function(s,x){ return s+Math.max(0,x.valor); },0)),
               nota:'devedor dos motoristas'}],
        totais: v.length? [{rotulo:'VALES', valor:relMoney(sv)},{rotulo:'PAGAMENTOS', valor:relMoney(sp)},
                           {rotulo:'DIFERENÇA', valor:relMoney(sv-sp)}] : [],
        graficos: saldos.length? [{titulo:'Saldo por motorista', dados:saldos.map(_relMoneyBar)}] : []
      };
    }},
  { id:'fin-gastos', modulo:'financeiro', nome:'Gastos',
    desc:'Gastos lançados por período, categoria e forma de pagamento.',
    filtros:['periodo','categoriaGasto'],
    gerar:function(f){
      let p = (DB.pagamentos||[]).filter(function(x){ return _relNoPeriodo(x.data, f); });
      if(f.categoriaGasto && f.categoriaGasto!=='todos') p = p.filter(function(x){ return (x.categoria||'')===f.categoriaGasto; });
      p.sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const total=_relSoma(p,'valor');
      return {
        tituloTabela:'Gastos',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Descrição',larg:'34%'},{rotulo:'Categoria'},
                 {rotulo:'Forma de pagamento'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: p.map(function(x){ return [relData(x.data), x.descricao, x.categoria, x.forma, relMoney(x.valor)]; }),
        kpis:[{rotulo:'Gastos',valor:relNum(p.length)},{rotulo:'Total',valor:relMoney(total)},
              {rotulo:'Gasto médio',valor: p.length? relMoney(total/p.length):'—'}],
        totais: p.length? [{rotulo:'TOTAL DO PERÍODO', valor:relMoney(total)}] : [],
        graficos: p.length? [{titulo:'Gasto por categoria', dados:_relPorChave(p,'categoria','valor').slice(0,10).map(_relMoneyBar)}] : [],
        analise: p.length? ['Maior categoria: '+(_relPorChave(p,'categoria','valor')[0]||{}).rotulo+'.'] : []
      };
    }},

  /* ---------------------------------------------------- CONTABILIDADE */
  { id:'contab-lanc', modulo:'contabilidade', nome:'Lançamentos contábeis',
    desc:'Lançamentos derivados dos módulos, com conta, centro de custo e origem.',
    filtros:['periodo'], orientacao:'paisagem',
    gerar:function(f){
      let l = (typeof contabLancamentos==='function')? contabLancamentos() : [];
      l = l.filter(function(x){ return _relNoPeriodo(x.data, f); })
           .sort(function(a,b){ return String(a.data||'').localeCompare(String(b.data||'')); });
      const rec = l.filter(function(x){ return x.grupo==='receita'; });
      const cus = l.filter(function(x){ return x.grupo!=='receita'; });
      const sr=_relSoma(rec,'valor'), sc=_relSoma(cus,'valor');
      const nomeConta = function(c){ return (typeof contabContaNome==='function')? contabContaNome(c) : c; };
      return {
        tituloTabela:'Lançamentos',
        colunas:[{rotulo:'Data',tipo:'data'},{rotulo:'Origem'},{rotulo:'Descrição',larg:'28%'},{rotulo:'Conta',larg:'16%'},
                 {rotulo:'Placa'},{rotulo:'Grupo'},{rotulo:'Valor',tipo:'moeda'}],
        linhas: l.map(function(x){ return [relData(x.data), x.origem, x.descricao, nomeConta(x.conta),
          x.placa||'—', x.grupo, relMoney(x.valor)]; }),
        kpis:[{rotulo:'Lançamentos',valor:relNum(l.length)},{rotulo:'Receitas',valor:relMoney(sr)},
              {rotulo:'Custos e despesas',valor:relMoney(sc)},
              {rotulo:'Resultado',valor:relMoney(sr-sc), nota: sr? 'margem '+relPct((sr-sc)/sr*100) : ''}],
        totais: l.length? [{rotulo:'RECEITAS', valor:relMoney(sr)},{rotulo:'CUSTOS E DESPESAS', valor:relMoney(sc)},
                           {rotulo:'RESULTADO', valor:relMoney(sr-sc)}] : [],
        graficos: l.length? [{titulo:'Custos por origem', dados:_relPorChave(cus,'origem','valor').slice(0,10).map(_relMoneyBar)}] : []
      };
    }},

  /* ----------------------------------------------------- ANIVERSÁRIOS */
  { id:'aniv-lista', modulo:'aniversarios', nome:'Aniversários do pessoal',
    desc:'Datas de aniversário, idade e proximidade.',
    filtros:[],
    gerar:function(){
      const l = (typeof anivLista==='function')? anivLista() : [];
      return {
        tituloTabela:'Aniversariantes',
        colunas:[{rotulo:'Pessoa',larg:'26%'},{rotulo:'Cadastro'},{rotulo:'Função'},{rotulo:'Nascimento',tipo:'data'},
                 {rotulo:'Faz',tipo:'numero'},{rotulo:'Próximo aniversário',tipo:'data'},{rotulo:'Faltam',tipo:'numero'}],
        linhas: l.map(function(x){ return [x.nome, x.origem==='motorista'?'Motorista':'Pessoa', x.papel,
          x.nascimento? relData(x.nascimento):'—', x.idade!=null? x.idade+' anos':'—',
          x.quando? relData(x.quando.toISOString().slice(0,10)):'—',
          x.dias==null?'—':(x.dias===0?'hoje':x.dias+' dias')]; }),
        kpis:[{rotulo:'Pessoas',valor:relNum(l.length)}]
      };
    }}
];

function relPorModulo(mod){ return PEX_RELATORIOS.filter(function(r){ return r.modulo===mod; }); }
function relPorId(id){ return PEX_RELATORIOS.find(function(r){ return r.id===id; }); }

/* ==================================================================
   7. CONFIGURADOR — o usuário escolhe ANTES de gerar
   ================================================================== */
let _relEscolhido = null;

/* Primeiro dia do mês corrente e hoje, em ISO — sugestão de período */
function _relPeriodoPadrao(){
  const d = new Date();
  return { ini: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01',
           fim: d.toISOString().slice(0,10) };
}
/* Abre o configurador. `mod` = módulo da tela atual; sem módulo, mostra tudo. */
function PEXRelAbrir(mod){
  const lista = mod ? relPorModulo(mod) : PEX_RELATORIOS;
  if(!lista.length){ PEXRelAbrirTodos(); return; }
  _relEscolhido = lista[0].id;
  _relRenderConfig(lista, mod);
}
function PEXRelAbrirTodos(){ _relEscolhido = PEX_RELATORIOS[0].id; _relRenderConfig(PEX_RELATORIOS, null); }
/* Abre o configurador já num relatório específico — usado pelos botões
   "Relatório" que ficam dentro de um card (ex.: Vales Motoristas, Gastos). */
function PEXRelAbrirId(id){
  const r = relPorId(id); if(!r) return;
  _relEscolhido = id;
  _relRenderConfig(relPorModulo(r.modulo), r.modulo);
}

function _relRenderConfig(lista, mod){
  const r = relPorId(_relEscolhido) || lista[0];
  const per = _relPeriodoPadrao();
  const opcoes = lista.map(function(x){
    return '<button class="rel-op'+(x.id===r.id?' on':'')+'" onclick="_relEscolher(\''+x.id+'\')">'
      + '<b>'+esc(x.nome)+'</b><span>'+esc(x.desc)+'</span></button>';
  }).join('');

  const campos = [];
  const fl = r.filtros||[];
  if(fl.indexOf('periodo')>=0){
    campos.push('<div class="field-row">'
      + fld('De','f_relIni', per.ini,'date') + fld('Até','f_relFim', per.fim,'date') + '</div>'
      + '<div class="rel-atalhos no-print">'
        + '<button class="btn ghost sm" onclick="_relPeriodo(\'mes\')">Este mês</button>'
        + '<button class="btn ghost sm" onclick="_relPeriodo(\'mesant\')">Mês passado</button>'
        + '<button class="btn ghost sm" onclick="_relPeriodo(\'ano\')">Este ano</button>'
        + '<button class="btn ghost sm" onclick="_relPeriodo(\'tudo\')">Todo o período</button></div>');
  }
  if(fl.indexOf('veiculo')>=0){
    const vs = (DB.veiculos||[]).filter(function(v){ return v.status!=='Arquivado'; });
    campos.push('<div class="field"><label>Veículo</label><select id="f_relVeic"><option value="todos">Todos os veículos</option>'
      + vs.map(function(v){ return '<option value="'+v.id+'">'+esc(v.placa)+' — '+esc(((v.marca||'')+' '+(v.modelo||'')).trim())+'</option>'; }).join('')
      + '</select></div>');
  }
  if(fl.indexOf('tipoVeiculo')>=0){
    campos.push('<div class="field"><label>Tipo</label><select id="f_relTipoV">'
      + '<option value="todos">Cavalos e reboques</option><option value="cavalo">Somente cavalos</option>'
      + '<option value="reboque">Somente reboques</option></select></div>');
  }
  if(fl.indexOf('situacaoVeiculo')>=0){
    campos.push('<div class="field"><label>Situação</label><select id="f_relSitV">'
      + '<option value="todos">Todas</option><option value="Ativo">Ativos</option><option value="Arquivado">Arquivados</option></select></div>');
  }
  if(fl.indexOf('situacaoMotorista')>=0){
    campos.push('<div class="field"><label>Situação</label><select id="f_relSitM">'
      + '<option value="todos">Todos</option><option value="Ativo">Somente ativos</option><option value="Inativo">Somente inativos</option></select></div>');
  }
  if(fl.indexOf('tipoManut')>=0){
    campos.push('<div class="field"><label>Tipo de manutenção</label><select id="f_relTipoM">'
      + '<option value="todos">Corretiva e preventiva</option><option value="Corretiva">Somente corretiva</option>'
      + '<option value="Preventiva">Somente preventiva</option></select></div>');
  }
  if(fl.indexOf('faixaVenc')>=0){
    campos.push('<div class="field"><label>O que mostrar</label><select id="f_relFaixa">'
      + '<option value="atencao">Vencidos e próximos 30 dias</option><option value="vencidos">Somente vencidos</option>'
      + '<option value="emdia">Somente em dia</option><option value="todos">Todos os documentos</option></select></div>');
  }
  if(fl.indexOf('tipoVenc')>=0){
    const tipos = [...new Set((typeof todosVencimentos==='function'? todosVencimentos():[]).map(function(v){ return v.tipo; }))].sort();
    campos.push('<div class="field"><label>Tipo de documento</label><select id="f_relTipoVenc"><option value="todos">Todos os tipos</option>'
      + tipos.map(function(t){ return '<option value="'+esc(t)+'">'+esc(t)+'</option>'; }).join('')+'</select></div>');
  }
  if(fl.indexOf('statusCte')>=0){
    campos.push('<div class="field"><label>Situação do CT-e</label><select id="f_relStCte">'
      + '<option value="todos">Todas</option><option value="Emitido">Emitidos</option><option value="Pago">Pagos</option>'
      + '<option value="Cancelado">Cancelados</option></select></div>');
  }
  if(fl.indexOf('statusViagem')>=0){
    campos.push('<div class="field"><label>Situação da viagem</label><select id="f_relStVg">'
      + '<option value="todos">Todas</option><option value="Pendente">Pendentes</option><option value="Concluída">Concluídas</option></select></div>');
  }
  if(fl.indexOf('motorista')>=0){
    const ms = (DB.motoristas||[]).filter(function(m){ return (m.status||'Ativo')==='Ativo'; });
    campos.push('<div class="field"><label>Motorista</label><select id="f_relMot"><option value="todos">Todos os motoristas</option>'
      + ms.map(function(m){ return '<option value="'+m.id+'">'+esc(m.nome)+'</option>'; }).join('')+'</select></div>');
  }
  if(fl.indexOf('categoriaGasto')>=0){
    const cats = [...new Set((DB.pagamentos||[]).map(function(p){ return p.categoria; }).filter(Boolean))].sort();
    campos.push('<div class="field"><label>Categoria</label><select id="f_relCat"><option value="todos">Todas as categorias</option>'
      + cats.map(function(c){ return '<option value="'+esc(c)+'">'+esc(c)+'</option>'; }).join('')+'</select></div>');
  }

  openModal('<div class="m-h">'+svg('print')+'<h3>Relatório'+(mod && ROTAS[mod]? ' — '+esc(ROTAS[mod].t) : '')+'</h3>'
      + '<button class="x" onclick="closeModal()">×</button></div>'
    + '<div class="m-b rel-cfg">'
      + '<div class="rel-cfg-t">Escolha o relatório</div>'
      + '<div class="rel-ops">'+opcoes+'</div>'
      + (campos.length? '<div class="rel-cfg-t" style="margin-top:16px">Filtros</div>'+campos.join('') : '')
      + '<div class="hint" style="margin-top:12px">O documento sai em A4, com o cabeçalho da empresa, os filtros usados e paginação. Você confere na tela antes de imprimir.</div>'
    + '</div>'
    + '<div class="m-f">'+ (mod? '<button class="btn" onclick="PEXRelAbrirTodos()">'+svg('list')+' Ver todos os relatórios</button>' : '')
      + '<div class="spacer"></div><button class="btn" onclick="closeModal()">Cancelar</button>'
      + '<button class="btn primary" onclick="PEXRelExecutar()">'+svg('print')+' Gerar relatório</button></div>', true);
}
function _relEscolher(id){
  _relEscolhido = id;
  const r = relPorId(id);
  const lista = r ? relPorModulo(r.modulo) : PEX_RELATORIOS;
  /* se o configurador foi aberto com "todos", mantém a lista completa */
  const modal = document.querySelector('#overlay .modal .m-h h3');
  const todos = modal && !/—/.test(modal.textContent||'');
  _relRenderConfig(todos ? PEX_RELATORIOS : lista, todos ? null : r.modulo);
}
function _relPeriodo(qual){
  const hj = new Date();
  let ini, fim = hj.toISOString().slice(0,10);
  if(qual==='mes'){ ini = hj.getFullYear()+'-'+String(hj.getMonth()+1).padStart(2,'0')+'-01'; }
  else if(qual==='mesant'){ const a=new Date(hj.getFullYear(), hj.getMonth()-1, 1);
    ini = a.getFullYear()+'-'+String(a.getMonth()+1).padStart(2,'0')+'-01';
    const u=new Date(hj.getFullYear(), hj.getMonth(), 0); fim = u.toISOString().slice(0,10); }
  else if(qual==='ano'){ ini = hj.getFullYear()+'-01-01'; }
  else { ini=''; fim=''; }
  const a=document.getElementById('f_relIni'), b=document.getElementById('f_relFim');
  if(a) a.value=ini; if(b) b.value=fim;
}
/* Lê os filtros da tela, chama o gerador do módulo e manda para a engine */
function PEXRelExecutar(){
  const r = relPorId(_relEscolhido);
  if(!r){ if(typeof toast==='function') toast('Escolha um relatório.'); return; }
  const f = {};
  const v = function(id){ const e=document.getElementById(id); return e? e.value : ''; };
  const rot = {};   /* filtros por extenso, para sair impresso no documento */

  if((r.filtros||[]).indexOf('periodo')>=0){
    f.ini = v('f_relIni'); f.fim = v('f_relFim');
  }
  if((r.filtros||[]).indexOf('veiculo')>=0){
    f.veiculo = v('f_relVeic') || 'todos';
    rot['Veículo'] = f.veiculo==='todos' ? 'Todos' : _relPlaca(f.veiculo);
  }
  if((r.filtros||[]).indexOf('tipoVeiculo')>=0){
    f.tipoVeiculo = v('f_relTipoV') || 'todos';
    rot['Tipo'] = {todos:'Cavalos e reboques', cavalo:'Somente cavalos', reboque:'Somente reboques'}[f.tipoVeiculo];
  }
  if((r.filtros||[]).indexOf('situacaoVeiculo')>=0){ f.situacaoVeiculo=v('f_relSitV')||'todos';
    rot['Situação'] = f.situacaoVeiculo==='todos'?'Todas':f.situacaoVeiculo; }
  if((r.filtros||[]).indexOf('situacaoMotorista')>=0){ f.situacaoMotorista=v('f_relSitM')||'todos';
    rot['Situação'] = f.situacaoMotorista==='todos'?'Todos':f.situacaoMotorista; }
  if((r.filtros||[]).indexOf('tipoManut')>=0){ f.tipoManut=v('f_relTipoM')||'todos';
    rot['Tipo de manutenção'] = f.tipoManut==='todos'?'Corretiva e preventiva':f.tipoManut; }
  if((r.filtros||[]).indexOf('faixaVenc')>=0){ f.faixaVenc=v('f_relFaixa')||'atencao';
    rot['Situação'] = {atencao:'Vencidos e próximos 30 dias', vencidos:'Somente vencidos',
                       emdia:'Somente em dia', todos:'Todos os documentos'}[f.faixaVenc]; }
  if((r.filtros||[]).indexOf('tipoVenc')>=0){ f.tipoVenc=v('f_relTipoVenc')||'todos';
    rot['Documento'] = f.tipoVenc==='todos'?'Todos os tipos':f.tipoVenc; }
  if((r.filtros||[]).indexOf('statusCte')>=0){ f.statusCte=v('f_relStCte')||'todos';
    rot['Situação'] = f.statusCte==='todos'?'Todas':f.statusCte; }
  if((r.filtros||[]).indexOf('statusViagem')>=0){ f.statusViagem=v('f_relStVg')||'todos';
    rot['Situação'] = f.statusViagem==='todos'?'Todas':f.statusViagem; }
  if((r.filtros||[]).indexOf('motorista')>=0){ f.motorista=v('f_relMot')||'todos';
    const m=(typeof motorista==='function' && f.motorista!=='todos')? motorista(f.motorista):null;
    rot['Motorista'] = m? m.nome : 'Todos'; }
  if((r.filtros||[]).indexOf('categoriaGasto')>=0){ f.categoriaGasto=v('f_relCat')||'todos';
    rot['Categoria'] = f.categoriaGasto==='todos'?'Todas':f.categoriaGasto; }

  let ds;
  try{ ds = r.gerar(f) || {}; }
  catch(e){ if(typeof toast==='function') toast('Não consegui montar esse relatório.','err'); return; }

  if(typeof closeModal==='function') closeModal();
  PEXRelGerar({
    titulo: r.nome,
    subtitulo: ds.subtitulo || r.desc,
    periodo: (f.ini||f.fim)? {ini:f.ini, fim:f.fim} : {rotulo:'Todo o período'},
    filtros: rot,
    kpis: ds.kpis, resumo: ds.resumo, graficos: ds.graficos,
    tituloTabela: ds.tituloTabela, colunas: ds.colunas, linhas: ds.linhas,
    totais: ds.totais, analise: ds.analise,
    orientacao: ds.orientacao || r.orientacao
  });
}
