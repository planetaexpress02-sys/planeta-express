/* ==================================================================
   ANIVERSÁRIOS — versão enxuta (v6.81)
   ------------------------------------------------------------------
   A aba própria foi REMOVIDA a pedido do cliente ("o sistema está
   ficando muito complexo"). Sobrou só o que ele quer de fato:

   · a data de nascimento fica no CADASTRO DO MOTORISTA (é lá que ela
     já era digitada — nada foi duplicado e nada se perdeu);
   · o sistema avisa quando o aniversário está chegando, com
     20 e 10 dias de antecedência, no sino de notificações.

   Não há tela, não há coleção nova, não há configuração. Se um dia
   precisar de mais, a conta está aqui e é só reusar.
   ================================================================== */

/* Prazos de aviso — fixos, como o cliente pediu */
const ANIV_AVISOS = [20, 10];

/* Quantos dias faltam para o próximo aniversário (0 = é hoje) */
function anivDiasAte(nascimento){
  const d = parseD(nascimento); if(!d) return null;
  const h = hoje();
  let alvo = new Date(h.getFullYear(), d.getMonth(), d.getDate());
  /* 29/02 em ano comum: o JS empurraria para 01/03 — comemoramos em 28/02 */
  if(alvo.getMonth() !== d.getMonth()) alvo = new Date(h.getFullYear(), d.getMonth()+1, 0);
  if(alvo < h){
    alvo = new Date(h.getFullYear()+1, d.getMonth(), d.getDate());
    if(alvo.getMonth() !== d.getMonth()) alvo = new Date(h.getFullYear()+1, d.getMonth()+1, 0);
  }
  return Math.round((alvo - h) / 86400000);
}
/* Idade que a pessoa COMPLETA no próximo aniversário */
function anivIdadeQueFaz(nascimento){
  const d = parseD(nascimento); if(!d) return null;
  const h = hoje();
  let ano = h.getFullYear();
  if(new Date(ano, d.getMonth(), d.getDate()) < h) ano++;
  const idade = ano - d.getFullYear();
  return (idade > 0 && idade < 130) ? idade : null;
}
/* Data do próximo aniversário, em ISO */
function anivProximo(nascimento){
  const dias = anivDiasAte(nascimento); if(dias == null) return '';
  const d = hoje(); d.setDate(d.getDate() + dias);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* Selo para a ficha do motorista */
function anivSelo(nascimento){
  const dias = anivDiasAte(nascimento);
  if(dias == null) return '';
  const idade = anivIdadeQueFaz(nascimento);
  if(dias === 0) return '<span class="st aprov">🎉 É hoje'+(idade?' — '+idade+' anos':'')+'</span>';
  const cls = dias <= ANIV_AVISOS[1] ? 'crit' : (dias <= ANIV_AVISOS[0] ? 'warn' : 'neutro');
  return '<span class="st '+cls+'">faltam '+dias+' dia'+(dias===1?'':'s')+(idade?' · faz '+idade:'')+'</span>';
}

/* ------------------------------------------------------------------
   Avisos no sino (chamado por pexNotifData). Só motoristas ativos —
   a data vem do cadastro deles, fonte única.
   ------------------------------------------------------------------ */
function anivNotificacoes(){
  const limite = Math.max.apply(null, ANIV_AVISOS);
  const out = [];
  (DB.motoristas||[]).forEach(function(m){
    if(m.status && m.status !== 'Ativo') return;
    const dias = anivDiasAte(m.nascimento);
    if(dias == null || dias > limite) return;
    const idade = anivIdadeQueFaz(m.nascimento);
    out.push({
      t: '🎂 ' + (m.nome||'Motorista'),
      s: dias === 0 ? ('Faz aniversário HOJE' + (idade? ' — '+idade+' anos' : ''))
                    : ('Aniversário em ' + dias + ' dia(s)' + (idade? ' — faz '+idade+' anos' : '')),
      when: fmtD(anivProximo(m.nascimento)),
      hash: '#motoristas/' + m.id,
      hoje: dias === 0,
      dias: dias
    });
  });
  /* ordena pelo que falta — ordenar por `when` daria errado, porque ali a
     data é texto dd/mm/aaaa e "02/09" viria antes de "13/08" */
  return out.sort(function(a,b){ return a.dias - b.dias; });
}
