(function () {
  var out = [], parou = false, falhas = 0;
  function diz(t) { out.push(t); }
  function ok(n, c, d) { if (!c) falhas++; diz((c ? 'OK    ' : 'FALHA ') + '| ' + n + (d ? ' | ' + d : '')); }
  function mostrar() {
    var pre = document.createElement('pre'); pre.id = 'RESULTADO';
    pre.textContent = '\n=== PELOS CLIQUES ===\n' + out.join('\n') + '\nFALHAS: ' + falhas + '\n=== FIM ===\n';
    document.body.appendChild(pre); parou = true;
  }
  function erroGlobal(e) { diz('ERRO DE JAVASCRIPT: ' + (e.message || e)); falhas++; }
  window.addEventListener('error', erroGlobal);

  function baixar(url) {
    return new Promise(function (r, e) {
      var x = new XMLHttpRequest(); x.open('GET', url, true); x.responseType = 'arraybuffer';
      x.onload = function () { r(x.response); }; x.onerror = function () { e(new Error('nao abriu')); }; x.send();
    });
  }
  function esperarAte(cond, ms, oque) {
    return new Promise(function (r, e) {
      var t = 0;
      (function ver() {
        var v = false; try { v = cond(); } catch (x) { v = false; }
        if (v) return r();
        if (++t * 40 > ms) return e(new Error('esperei demais por: ' + oque));
        setTimeout(ver, 40);
      })();
    });
  }
  function agosto() {
    return DB.viagens.filter(function (v) { return (v.data || '').slice(0, 7) === '2026-08'; });
  }
  function conta() {
    var a = agosto();
    return { total: a.length, bx: a.filter(function (v) { return v.baixado === 'SIM'; }).length,
             tm: a.filter(function (v) { return v.termoBaixado === 'SIM'; }).length };
  }

  var t = 0, base = null;
  (function esperar() {
    var pronto = false;
    try { pronto = (typeof DB !== 'undefined') && DB && !!DB.viagens; } catch (e) { pronto = false; }
    if (!pronto) { if (++t > 400) { diz('DB nao carregou'); return mostrar(); } return setTimeout(esperar, 25); }
    if (base === null) base = DB.viagens.length;
    if (DB.viagens.length === base && ++t < 500) return setTimeout(esperar, 40);
    rodar();
  })();

  function rodar() {
    window.nuvemAtiva = function () { return false; };     /* trava: nada vai para a nuvem */
    window.nuvemSalvar = function () { return Promise.resolve(); };
    var antes = conta();
    diz('base da nuvem: ' + DB.viagens.length + ' viagens | agosto: ' + antes.total +
      ' (transporte baixado ' + antes.bx + ', termo ' + antes.tm + ')');

    /* 1) abrir a tela de viagens, como ele faz */
    location.hash = 'viagens';
    try { router(); } catch (e) { erroGlobal(e); }
    var htmlTela = (document.getElementById('view') || {}).innerHTML || '';
    ok('a tela de viagens abre', htmlTela.length > 500, htmlTela.length + ' chars');
    ok('o botao "Importar Planilha Excel" esta na tela', /Importar Planilha Excel/.test(htmlTela));

    /* 2) clicar em Importar Planilha Excel */
    try { modalImportarViagem(); } catch (e) { erroGlobal(e); }
    var inp = document.querySelector('#ovl input[type=file], .modal input[type=file], input[type=file]');
    ok('a janela de importar abriu com o campo de arquivo', !!inp);
    if (!inp) return mostrar();

    /* 3) escolher a planilha — mesmo caminho do seletor de arquivos */
    baixar(window.__PLANILHA__).then(function (buf) {
      var f = new File([buf], 'Viagens BRF Agosto 2026.xlsx',
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var dt = new DataTransfer(); dt.items.add(f);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return esperarAte(function () {
        var p = document.getElementById('vgImpPreview');
        return p && !/Lendo a planilha/.test(p.innerHTML) && p.innerHTML.length > 200;
      }, 20000, 'a previa da importacao');
    }).then(function () {
      var prev = document.getElementById('vgImpPreview');
      var txt = prev.textContent.replace(/\s+/g, ' ').trim();
      diz('');
      diz('--- o que a previa mostra ---');
      diz(txt.slice(0, 700));
      ok('a previa nao deu erro de leitura', !/Nao consegui ler|Não consegui ler/.test(txt));
      ok('a previa lista viagens', /viagem\(ns\)/.test(txt), '');
      ok('a previa tem a coluna Termo', /Termo/.test(prev.querySelector('thead') ? prev.querySelector('thead').textContent : ''));
      var marcadas = prev.querySelectorAll('tbody input[type=checkbox]:checked').length;
      var linhas = prev.querySelectorAll('tbody tr').length;
      ok('vem linha marcada para atualizar', marcadas > 0, marcadas + ' marcadas de ' + linhas + ' linhas');
      var btn = document.getElementById('vgImpBtn');
      ok('o botao de importar aparece', !!btn && btn.style.display !== 'none', btn ? ('texto: "' + btn.textContent + '" desabilitado=' + btn.disabled) : 'sem botao');
      diz('');
      /* 4) clicar em "Importar selecionadas" */
      if (btn && !btn.disabled) btn.click(); else { ok('podia clicar no botao', false, 'botao ausente ou desabilitado'); }
      return esperarAte(function () { return !document.getElementById('ovl').classList.contains('on'); }, 8000, 'a janela fechar')
        .catch(function () { });
    }).then(function () {
      var dep = conta();
      diz('--- depois de clicar ---');
      diz('agosto: ' + dep.total + ' viagens | transporte baixado ' + antes.bx + ' -> ' + dep.bx +
        ' | termo baixado ' + antes.tm + ' -> ' + dep.tm);
      ok('o termo baixado subiu', dep.tm > antes.tm, antes.tm + ' -> ' + dep.tm);
      ok('nao duplicou', dep.total === antes.total, antes.total + ' -> ' + dep.total);

      /* 5) a tela mostra "Baixado" no termo? */
      location.hash = 'viagens';
      try { router(); } catch (e) { erroGlobal(e); }
      var html = document.getElementById('view').innerHTML;
      var linhasBaixado = (html.match(/>Baixado</g) || []).length;
      var linhasPendente = (html.match(/>Pendente</g) || []).length;
      ok('a coluna Termo passa a mostrar "Baixado"', linhasBaixado > 0, linhasBaixado + ' "Baixado" e ' + linhasPendente + ' "Pendente" na tela toda');
      mostrar();
    }).catch(function (e) {
      diz('ERRO NO CAMINHO: ' + ((e && e.message) || e));
      diz(((e && e.stack) || '').split('\n').slice(0, 4).join(' | '));
      falhas++; mostrar();
    });
  }

  var n = 0;
  (function manter() { if (parou || n > 5000) return; n++; setTimeout(manter, 20); })();
})();
