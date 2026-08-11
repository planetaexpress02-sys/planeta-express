/* ==================================================================
   ANIVERSÁRIOS DO PESSOAL  (v6.75)
   ------------------------------------------------------------------
   Avisa com antecedência quem faz aniversário. Os prazos de aviso são
   editáveis (vêm 30 e 10 dias, mas o usuário muda como quiser).

   REGRA SEGUIDA (a mesma da Contabilidade): a informação é cadastrada
   UMA VEZ. Quem já é motorista/sócio NÃO é recadastrado aqui — a data
   de nascimento é lida do cadastro dele, e se for editada nesta tela,
   é o cadastro DELE que muda. A coleção própria (`DB.aniversarios`)
   guarda só quem não existe em nenhum outro módulo (escritório,
   familiares, parceiros).
   ================================================================== */

const ANIV_AVISOS_PADRAO = [30, 10];

/* Prazos de aviso configurados (sempre em ordem decrescente, sem repetir) */
function anivAvisos(){
  const c = (DB.config && DB.config.anivAvisos);
  const arr = (Array.isArray(c) && c.length ? c : ANIV_AVISOS_PADRAO)
    .map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 365);
  return [...new Set(arr)].sort((a, b) => b - a);
}
function anivSalvarAvisos(lista){
  const arr = (lista || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n >= 0 && n <= 365);
  DB.config.anivAvisos = [...new Set(arr)].sort((a, b) => b - a);
  if (!DB.config.anivAvisos.length) DB.config.anivAvisos = ANIV_AVISOS_PADRAO.slice();
  saveDB();
}

/* Quantos dias faltam para o PRÓXIMO aniversário (0 = é hoje) */
function anivDiasAte(nascimento){
  const d = parseD(nascimento); if (!d) return null;
  const h = hoje();
  let alvo = new Date(h.getFullYear(), d.getMonth(), d.getDate());
  /* 29/02 em ano comum: o JS empurraria para 01/03 — comemoramos em 28/02 */
  if (alvo.getMonth() !== d.getMonth()) alvo = new Date(h.getFullYear(), d.getMonth() + 1, 0);
  if (alvo < h) {
    alvo = new Date(h.getFullYear() + 1, d.getMonth(), d.getDate());
    if (alvo.getMonth() !== d.getMonth()) alvo = new Date(h.getFullYear() + 1, d.getMonth() + 1, 0);
  }
  return Math.round((alvo - h) / 86400000);
}
/* Idade que a pessoa COMPLETA no próximo aniversário */
function anivIdadeQueFaz(nascimento){
  const d = parseD(nascimento); if (!d) return null;
  const h = hoje();
  let ano = h.getFullYear();
  const jaPassou = new Date(ano, d.getMonth(), d.getDate()) < h;
  if (jaPassou) ano++;
  const idade = ano - d.getFullYear();
  return idade > 0 && idade < 130 ? idade : null;
}
const ANIV_SEMANA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
function anivDataDoDia(nascimento){
  const dias = anivDiasAte(nascimento); if (dias == null) return null;
  const d = hoje(); d.setDate(d.getDate() + dias); return d;
}

/* ------------------------------------------------------------------
   FONTE ÚNICA da lista de aniversariantes. Toda tela/KPI/notificação
   que fale de aniversário tem que ler daqui — nunca montar a própria
   lista, senão um lugar mostra um número e o outro mostra outro.
   ------------------------------------------------------------------ */
function anivLista(){
  const out = [];
  /* 1) quem já está cadastrado como motorista/sócio — derivado, não copiado */
  (DB.motoristas || []).forEach(function(m){
    out.push({
      id: 'm:' + m.id, ref: m.id, origem: 'motorista',
      nome: m.nome || '—',
      papel: m.funcao || (m.socio ? 'Sócio' : 'Motorista'),
      setor: m.socio ? 'Sociedade' : 'Operação',
      telefone: m.celular || m.telefone || '',
      nascimento: m.nascimento || '',
      inativo: m.status && m.status !== 'Ativo',
      obs: ''
    });
  });
  /* 2) pessoas que não existem em nenhum outro módulo */
  (DB.aniversarios || []).forEach(function(p){
    out.push({
      id: 'a:' + p.id, ref: p.id, origem: 'pessoa',
      nome: p.nome || '—', papel: p.papel || '', setor: p.setor || '',
      telefone: p.telefone || '', nascimento: p.nascimento || '',
      inativo: false, obs: p.obs || ''
    });
  });
  /* enriquece e ordena pelo aniversário mais próximo (sem data vai para o fim) */
  out.forEach(function(x){
    x.dias = anivDiasAte(x.nascimento);
    x.idade = anivIdadeQueFaz(x.nascimento);
    const dt = anivDataDoDia(x.nascimento);
    x.quando = dt;
    x.semana = dt ? ANIV_SEMANA[dt.getDay()] : '';
    x.faixa = anivFaixa(x.dias);
  });
  out.sort(function(a, b){
    if (a.dias == null && b.dias == null) return (a.nome || '').localeCompare(b.nome || '');
    if (a.dias == null) return 1;
    if (b.dias == null) return -1;
    return a.dias - b.dias;
  });
  return out;
}
/* Em que aviso a pessoa se encaixa: 'hoje' | o prazo configurado | '' */
function anivFaixa(dias){
  if (dias == null) return '';
  if (dias === 0) return 'hoje';
  const av = anivAvisos();
  for (let i = av.length - 1; i >= 0; i--) if (dias <= av[i]) return String(av[i]);
  return '';
}
function anivBadge(x){
  if (x.dias == null) return '<span class="st neutro">sem data</span>';
  if (x.dias === 0) return '<span class="st aprov">🎉 É hoje!</span>';
  const av = anivAvisos(), menor = av[av.length - 1], maior = av[0];
  const txt = 'faltam ' + x.dias + ' dia' + (x.dias === 1 ? '' : 's');
  if (x.dias <= menor) return '<span class="st crit">' + txt + '</span>';
  if (x.dias <= maior) return '<span class="st warn">' + txt + '</span>';
  return '<span class="st neutro">' + txt + '</span>';
}

/* Resumo para KPIs — mesma fonte da tabela, para os números baterem */
function anivResumo(){
  const l = anivLista().filter(x => x.dias != null);
  const av = anivAvisos(), maior = av[0], menor = av[av.length - 1];
  const h = hoje();
  return {
    total: anivLista().length,
    comData: l.length,
    semData: anivLista().length - l.length,
    hoje: l.filter(x => x.dias === 0).length,
    proximosMenor: l.filter(x => x.dias > 0 && x.dias <= menor).length,
    proximosMaior: l.filter(x => x.dias > 0 && x.dias <= maior).length,
    noMes: l.filter(x => x.quando && x.quando.getMonth() === h.getMonth() && x.quando.getFullYear() === h.getFullYear()).length,
    maior: maior, menor: menor
  };
}

/* ------------------------------------------------------------------ */
/*  TELA                                                               */
/* ------------------------------------------------------------------ */
let anivFiltro = 'todos';   // todos | hoje | avisando | mes | semdata

function viewAniversarios(){
  const R = anivResumo(), av = anivAvisos();
  let lista = anivLista();
  const h = hoje();
  if (anivFiltro === 'hoje')      lista = lista.filter(x => x.dias === 0);
  else if (anivFiltro === 'avisando') lista = lista.filter(x => x.dias != null && x.dias > 0 && x.dias <= R.maior);
  else if (anivFiltro === 'mes')  lista = lista.filter(x => x.quando && x.quando.getMonth() === h.getMonth() && x.quando.getFullYear() === h.getFullYear());
  else if (anivFiltro === 'semdata') lista = lista.filter(x => x.dias == null);

  const chip = (k, rot, n) => `<button class="${anivFiltro === k ? 'active' : ''}" onclick="anivSetFiltro('${k}')">${rot}${n != null ? ' <b>' + n + '</b>' : ''}</button>`;

  const linha = (x) => {
    const dt = parseD(x.nascimento);
    const dataAniv = dt ? String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') : '—';
    const origem = x.origem === 'motorista'
      ? `<span class="aniv-orig mot" onclick="event.stopPropagation();location.hash='motoristas/${x.ref}'" title="Cadastrado em Motoristas — clique para abrir">${svg('user')} Motorista</span>`
      : `<span class="aniv-orig pes" title="Cadastrado aqui">${svg('users')} Pessoa</span>`;
    return `<tr class="${x.dias === 0 ? 'aniv-hoje' : ''}${x.inativo ? ' aniv-inativo' : ''}">
      <td><b>${esc(x.nome)}</b>${x.inativo ? ' <span class="st neutro" style="font-size:10px">inativo</span>' : ''}
        ${x.papel ? `<span class="aniv-sub">${esc(x.papel)}</span>` : ''}</td>
      <td>${origem}</td>
      <td class="mono">${dataAniv}</td>
      <td class="mono">${x.nascimento ? fmtD(x.nascimento) : '—'}</td>
      <td class="mono">${x.idade != null ? x.idade + ' anos' : '—'}</td>
      <td>${x.quando ? fmtD(x.quando.toISOString().slice(0, 10)) + `<span class="aniv-sub">${esc(x.semana)}</span>` : '—'}</td>
      <td>${anivBadge(x)}</td>
      <td>${esc(x.telefone || '—')}</td>
      <td class="no-print ta-r">
        <button class="btn ghost sm" title="Editar" onclick="modalAniversario('${x.id}')">${svg('edit')}</button>
        ${x.origem === 'pessoa' ? `<button class="btn ghost sm" title="Excluir" onclick="excluirAniversario('${x.ref}')">${svg('trash')}</button>` : ''}
      </td></tr>`;
  };

  const avisoTxt = av.map(d => d + ' dias').join(' e ');

  return `
  <div class="banner">${svg('cake')}<div><b>Aniversários do pessoal</b>
    <span>Quem é motorista ou sócio entra sozinho, pela data de nascimento do cadastro — aqui você só completa o que faltar. Pessoas de fora da frota (escritório, parceiros, família) você cadastra nesta tela. Avisos hoje: <b>${esc(avisoTxt)}</b> antes.</span></div>
    <div class="no-print" style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" onclick="modalAnivAvisos()" title="Mudar de quantos dias antes o sistema avisa">${svg('bell')} Prazos de aviso</button>
      <button class="btn primary" onclick="modalAniversario()">${svg('plus')} Nova pessoa</button></div></div>

  <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    ${kpi('cake', R.hoje ? 'i-green' : 'i-blue', R.hoje, 'Aniversariantes hoje', R.hoje ? 'parabenize!' : 'nenhum hoje')}
    ${kpi('bell', R.proximosMenor ? 'i-orange' : 'i-blue', R.proximosMenor, 'Faltam ≤ ' + R.menor + ' dias', 'aviso mais próximo')}
    ${kpi('cal', R.proximosMaior ? 'i-amber' : 'i-blue', R.proximosMaior, 'Faltam ≤ ' + R.maior + ' dias', 'primeiro aviso')}
    ${kpi('users', 'i-blue', R.noMes, 'Aniversários no mês', MESES_L[h.getMonth()])}
  </div>

  <div class="toolbar">
    <div class="seg">
      ${chip('todos', 'Todos', R.total)}
      ${chip('hoje', 'Hoje', R.hoje)}
      ${chip('avisando', 'Avisando', R.proximosMaior)}
      ${chip('mes', 'Este mês', R.noMes)}
      ${R.semData ? chip('semdata', 'Sem data', R.semData) : ''}
    </div>
    <div class="spacer"></div>
    <div class="muted no-print" style="font-size:12.5px">${lista.length} pessoa(s)</div>
    <button class="btn no-print" onclick="imprimirRelatorio()">${svg('print')} Relatório</button>
  </div>

  <div class="card"><div class="card-b p0"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Pessoa</th><th>Cadastro</th><th>Dia</th><th>Nascimento</th><th>Faz</th><th>Próximo aniversário</th><th>Situação</th><th>Contato</th><th class="no-print"></th></tr></thead>
    <tbody>${lista.length ? lista.map(linha).join('') : `<tr><td colspan="9">${emptyState(anivFiltro === 'todos' ? 'Nenhuma pessoa ainda. Cadastre a data de nascimento nos motoristas ou adicione alguém de fora da frota.' : 'Ninguém neste filtro.')}</td></tr>`}</tbody>
  </table></div></div></div>

  ${R.semData ? `<div class="muted no-print" style="font-size:12.5px;margin-top:14px">${svg('bell')} ${R.semData} pessoa(s) sem data de nascimento — sem a data o sistema não tem como avisar.</div>` : ''}`;
}
function anivSetFiltro(f){ anivFiltro = (anivFiltro === f ? 'todos' : f); router(); }

/* ------------------------------------------------------------------ */
/*  CADASTRO / EDIÇÃO                                                  */
/* ------------------------------------------------------------------ */
function modalAniversario(id){
  /* id = 'm:<motoristaId>' (edita o cadastro do motorista) | 'a:<id>' | vazio (nova pessoa) */
  const ehMotorista = id && id.slice(0, 2) === 'm:';
  if (ehMotorista) {
    const m = (DB.motoristas || []).find(x => x.id === id.slice(2));
    if (!m) return;
    openModal(`<div class="m-h">${svg('cake')}<h3>${esc(m.nome)}</h3><button class="x" onclick="closeModal()">×</button></div>
      <div class="m-b">
        <div class="hint" style="margin-bottom:12px">Esta pessoa está cadastrada em <b>Motoristas</b>. Para não haver dado repetido, a data abaixo é a mesma da ficha dela — o que você mudar aqui muda lá também.</div>
        ${fld('Data de nascimento', 'f_anasc', m.nascimento || '', 'date')}
      </div>
      <div class="m-f">
        <button class="btn" onclick="location.hash='motoristas/${m.id}';closeModal()">${svg('user')} Abrir ficha completa</button>
        <div class="spacer"></div>
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="salvarAnivMotorista('${m.id}')">Salvar</button>
      </div>`);
    return;
  }
  const p = id ? (DB.aniversarios || []).find(x => x.id === id.slice(2)) : { nome: '', nascimento: '', papel: '', setor: '', telefone: '', obs: '' };
  if (!p) return;
  openModal(`<div class="m-h">${svg('cake')}<h3>${id ? 'Editar pessoa' : 'Nova pessoa'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="hint" style="margin-bottom:12px">Use esta tela para quem <b>não</b> está no cadastro de Motoristas — escritório, parceiros, família. Motorista ou sócio já aparece sozinho na lista.</div>
      ${fld('Nome', 'f_anome', p.nome)}
      <div class="field-row">${fld('Data de nascimento', 'f_anasc', p.nascimento, 'date')}${fld('Função / papel', 'f_apapel', p.papel, 'text', 'ex.: Escritório, Contador, Esposa')}</div>
      <div class="field-row">${fld('Setor / grupo', 'f_asetor', p.setor, 'text', 'ex.: Administrativo')}${fldMask('Telefone', 'f_afone', p.telefone, 'fone')}</div>
      ${fld('Observação', 'f_aobs', p.obs)}
    </div>
    <div class="m-f"><button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="salvarAniversario('${id ? p.id : ''}')">Salvar</button></div>`);
}
function salvarAnivMotorista(mid){
  const m = (DB.motoristas || []).find(x => x.id === mid); if (!m) return;
  m.nascimento = val('f_anasc');
  saveDB(); closeModal(); toast('Data de nascimento atualizada na ficha do motorista.'); router();
}
function salvarAniversario(id){
  const nome = val('f_anome');
  if (!nome) { toast('Informe o nome.'); return; }
  const d = { nome: nome, nascimento: val('f_anasc'), papel: val('f_apapel'), setor: val('f_asetor'),
              telefone: maskFone(val('f_afone')), obs: val('f_aobs') };
  DB.aniversarios = DB.aniversarios || [];
  if (id) Object.assign(DB.aniversarios.find(x => x.id === id), d);
  else { d.id = uid('an'); DB.aniversarios.push(d); }
  saveDB(); closeModal(); toast('Pessoa salva.'); router();
}
function excluirAniversario(id){
  const p = (DB.aniversarios || []).find(x => x.id === id); if (!p) return;
  if (!confirm('Excluir ' + (p.nome || 'esta pessoa') + ' da lista de aniversários?')) return;
  DB.aniversarios = DB.aniversarios.filter(x => x.id !== id);
  saveDB(); toast('Excluída.'); router();
}

/* ------------------------------------------------------------------ */
/*  PRAZOS DE AVISO (editáveis)                                        */
/* ------------------------------------------------------------------ */
function modalAnivAvisos(){
  const av = anivAvisos();
  const linhas = av.map((d, i) => `<div class="aniv-prazo" id="prz_${i}">
      <input type="number" min="0" max="365" value="${d}" id="f_prz_${i}" onchange="anivPrazoPreview()"> <span>dias antes</span>
      <button class="btn ghost sm" title="Remover" onclick="anivPrazoRemover(${i})">${svg('trash')}</button></div>`).join('');
  openModal(`<div class="m-h">${svg('bell')}<h3>Prazos de aviso</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="m-b">
      <div class="hint" style="margin-bottom:12px">De quantos dias antes o sistema deve avisar. Vêm <b>30</b> e <b>10</b> dias, mas você pode mudar, apagar ou acrescentar quantos quiser. O aviso aparece nesta tela, no sino de notificações e no menu.</div>
      <div id="anivPrazos">${linhas}</div>
      <button class="btn sm" style="margin-top:10px" onclick="anivPrazoAdicionar()">${svg('plus')} Acrescentar prazo</button>
      <div class="hint" id="anivPrazoPrev" style="margin-top:14px"></div>
    </div>
    <div class="m-f"><button class="btn" onclick="anivPrazoRestaurar()">Voltar ao padrão (30 e 10)</button>
      <div class="spacer"></div>
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="anivPrazoSalvar()">Salvar</button></div>`);
  anivPrazoPreview();
}
function _anivPrazosNaTela(){
  return [].slice.call(document.querySelectorAll('#anivPrazos input')).map(i => parseInt(i.value, 10)).filter(n => !isNaN(n));
}
function anivPrazoPreview(){
  const el = document.getElementById('anivPrazoPrev'); if (!el) return;
  const arr = [...new Set(_anivPrazosNaTela())].sort((a, b) => b - a);
  el.innerHTML = arr.length
    ? 'O sistema vai avisar <b>' + arr.map(d => d === 0 ? 'no dia' : d + ' dias antes').join('</b>, <b>') + '</b>.'
    : 'Sem nenhum prazo o sistema não avisa — deixe pelo menos um.';
}
function anivPrazoAdicionar(){
  const box = document.getElementById('anivPrazos'); if (!box) return;
  const i = 'n' + Date.now();
  const d = document.createElement('div'); d.className = 'aniv-prazo'; d.id = 'prz_' + i;
  d.innerHTML = `<input type="number" min="0" max="365" value="7" onchange="anivPrazoPreview()"> <span>dias antes</span>
    <button class="btn ghost sm" title="Remover" onclick="this.parentNode.remove();anivPrazoPreview()">${svg('trash')}</button>`;
  box.appendChild(d); anivPrazoPreview();
}
function anivPrazoRemover(i){ const el = document.getElementById('prz_' + i); if (el) el.remove(); anivPrazoPreview(); }
function anivPrazoRestaurar(){ anivSalvarAvisos(ANIV_AVISOS_PADRAO.slice()); closeModal(); toast('Prazos de volta ao padrão: 30 e 10 dias.'); router(); }
function anivPrazoSalvar(){
  const arr = _anivPrazosNaTela();
  if (!arr.length) { toast('Deixe pelo menos um prazo de aviso.'); return; }
  anivSalvarAvisos(arr); closeModal(); toast('Prazos de aviso salvos.'); router();
}

/* ------------------------------------------------------------------ */
/*  AVISOS: sino de notificações e contador do menu                    */
/* ------------------------------------------------------------------ */
/* Quantos estão dentro de algum prazo de aviso (inclusive hoje) */
function anivPendentes(){
  const R = anivResumo(); return R.hoje + R.proximosMaior;
}
/* Linhas para a Central de notificações (chamada em pexNotifData) */
function anivNotificacoes(){
  const av = anivAvisos(), maior = av[0], out = [];
  anivLista().forEach(function(x){
    if (x.dias == null || x.dias > maior) return;
    out.push({
      t: '🎂 ' + x.nome,
      s: x.dias === 0 ? 'Faz aniversário HOJE' + (x.idade ? ' — ' + x.idade + ' anos' : '')
                      : 'Aniversário em ' + x.dias + ' dia(s)' + (x.idade ? ' — faz ' + x.idade + ' anos' : ''),
      when: x.quando ? String(x.quando.getDate()).padStart(2, '0') + '/' + String(x.quando.getMonth() + 1).padStart(2, '0') : '',
      hash: '#aniversarios',
      hoje: x.dias === 0
    });
  });
  return out;
}
