/* ==========================================================================
   MODO ONLINE — Supabase (Planeta Express Transportes)
   Já configurado: o sistema conecta sozinho e abre na tela de login.
   (Você NÃO precisa editar este arquivo.)

   Sobre a chave aqui embaixo: é a chave PÚBLICA (papel `anon`). Ela é
   feita para ficar no navegador — é o que todo site com Supabase faz. Ela
   não dá acesso a nada por si só: quem libera a leitura e a gravação é a
   regra no banco, que exige usuário logado. A chave de administrador
   (`service_role`) NUNCA entra em arquivo do site; ela fica só no painel
   do Supabase. Ver SECURITY_REPORT.md.

   🔒 v12.7 — A CONFIGURAÇÃO SALVA NO APARELHO AGORA É CONFERIDA.

   Este arquivo aceitava `pex_online_cfg` do armazenamento local sem olhar
   o conteúdo. Era um desvio aberto: bastaria algo gravar ali outro
   endereço para o sistema passar a mandar TODOS os dados da empresa para
   um banco estranho — login, viagens, documentos — e a tela continuaria
   normal, porque o sistema não sabe distinguir um Supabase do outro.

   Agora o endereço salvo só vale se for `https://...supabase.co` e a
   chave só vale se tiver a cara de uma chave Supabase. Qualquer coisa
   fora disso é ignorada, o sistema volta para a configuração de fábrica e
   deixa o aviso registrado em `window.PEX_CFG_AVISO`.
   ========================================================================== */
(function(){
  var PADRAO = {
    url: "https://kxwcwpxaovwgwviqhelh.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4d2N3cHhhb3Z3Z3d2aXFoZWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjY2MzUsImV4cCI6MjEwMDMwMjYzNX0.BIN3IlNqHZT9CMe8_oJcD-gbxMXISfcGvF-UCl2FMzM"
  };

  /* endereço aceitável: https, host terminando em .supabase.co, sem caminho */
  function urlOk(u){
    if(typeof u!=='string' || u.length>200) return false;
    return /^https:\/\/[a-z0-9-]{1,60}\.supabase\.co\/?$/i.test(u.trim());
  }
  /* chave aceitável: três partes separadas por ponto (JWT) ou chave nova
     `sb_publishable_…`. Não checo a assinatura — não é segredo meu —, checo
     que é uma chave de cliente e não um texto qualquer colado ali. */
  function keyOk(k){
    if(typeof k!=='string' || k.length<30 || k.length>800) return false;
    k=k.trim();
    if(/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(k)) return true;
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k);
  }

  var salvo = {}, aviso = '';
  try { salvo = JSON.parse(localStorage.getItem('pex_online_cfg') || '{}') || {}; } catch (e) { salvo = {}; }

  var url = PADRAO.url, key = PADRAO.key;
  if (salvo.url || salvo.key) {
    if (urlOk(salvo.url) && keyOk(salvo.key)) {
      url = String(salvo.url).trim().replace(/\/$/, '');
      key = String(salvo.key).trim();
    } else {
      aviso = 'Configuração online salva neste aparelho foi recusada por não ter o formato esperado. '
            + 'O sistema está usando a configuração de fábrica.';
      try { console.warn('[config] ' + aviso); } catch (e) {}
    }
  }

  window.PEX_CONFIG = { url: url, key: key };
  window.PEX_CFG_AVISO = aviso;
})();
