/* ==========================================================================
   PLANETA EXPRESS — Camada de nuvem (Supabase)
   Ativa quando assets/config-online.js tiver url + key preenchidos.
   Se estiver vazio, o sistema funciona offline normalmente.
   ========================================================================== */
let _sb=null, _sbUser=null, _sbChan=null;

function nuvemConfigurada(){ return !!(window.PEX_CONFIG && window.PEX_CONFIG.url && window.PEX_CONFIG.key); }
function nuvemAtiva(){ return nuvemConfigurada() && !!(window.supabase && window.supabase.createClient); }
function nuvemInit(){
  if(!nuvemAtiva()) return null;
  if(!_sb) _sb = window.supabase.createClient(window.PEX_CONFIG.url, window.PEX_CONFIG.key);
  return _sb;
}
function nuvemUser(){ return _sbUser; }

async function nuvemSessao(){
  if(!nuvemInit()) return null;
  try{ const {data}=await _sb.auth.getSession(); _sbUser = data && data.session ? data.session.user : null; }
  catch(e){ _sbUser=null; }
  return _sbUser;
}
async function nuvemLogin(email, senha){
  if(!nuvemInit()) throw new Error('Nuvem não configurada.');
  const {data,error}=await _sb.auth.signInWithPassword({ email:email, password:senha });
  if(error) throw error;
  _sbUser = data.user; return _sbUser;
}
async function nuvemLogout(){ if(_sb){ try{ await _sb.auth.signOut(); }catch(e){} } _sbUser=null; }
async function nuvemAlterarSenha(nova){
  if(!nuvemInit()) throw new Error('Nuvem não configurada.');
  const {error}=await _sb.auth.updateUser({ password:nova });
  if(error) throw error;
}

/* ⚠️ v11.0 — O CARREGAMENTO NÃO PODE DESISTIR NA PRIMEIRA TENTATIVA.

   O cliente fotografou *"não consegui baixar os dados da nuvem agora"* e
   disse: **"nunca deve haver erro"**. Conferido na hora: o servidor da
   nuvem estava no ar e respondendo em 0,7 s. Ou seja, não era a nuvem
   caída — era uma falha passageira (um pedido que não voltou, ou o token
   da sessão vencido) e o código desistia na primeira negativa.

   Agora ele insiste: 4 tentativas com espera crescente e, se o erro
   cheirar a sessão vencida (JWT/401), RENOVA a sessão e tenta de novo.
   Só depois disso é que se pode dizer que não deu.

   ⚠️ E o erro continua sendo LANÇADO quando tudo falha — de propósito.
   Quem chama precisa saber que não recebeu nada, senão o sistema acha
   que a nuvem está vazia e manda a cópia local por cima do trabalho dos
   outros aparelhos. Foi esse o acidente da v10.4. */
function _nuvemEhSessao(e){
  const t=((e&&(e.message||e.error_description||''))+' '+((e&&e.status)||'')).toLowerCase();
  return /jwt|token|401|expired|unauthor|refresh/.test(t);
}
function _nuvemEspera(ms){ return new Promise(function(ok){ setTimeout(ok, ms); }); }
async function nuvemCarregar(tentativas){
  if(!nuvemInit()) return null;
  const max = tentativas||4;
  let ultimo=null;
  for(let i=0;i<max;i++){
    try{
      const {data,error}=await _sb.from('dados').select('conteudo').eq('id','empresa').maybeSingle();
      if(error) throw error;
      return data ? data.conteudo : null;
    }catch(e){
      ultimo=e;
      try{ console.warn('[nuvem] tentativa '+(i+1)+'/'+max+' falhou:', (e&&e.message)||e); }catch(_){}
      if(i===max-1) break;
      /* sessão vencida: renova antes de insistir, senão as 4 tentativas
         falham pelo mesmo motivo e a espera não serve para nada */
      if(_nuvemEhSessao(e)){
        try{ await _sb.auth.refreshSession(); }catch(_){}
      }
      await _nuvemEspera(400*Math.pow(2,i));      /* 0,4s · 0,8s · 1,6s */
    }
  }
  throw ultimo || new Error('Não consegui ler os dados da nuvem.');
}
/* Só a marca de tempo — para saber se alguém salvou depois de nós sem
   baixar a base inteira. É o que sustenta o plano B do tempo real. */
async function nuvemCarimbo(){
  if(!nuvemInit()) return null;
  const {data,error}=await _sb.from('dados').select('atualizado_em').eq('id','empresa').maybeSingle();
  if(error) throw error;
  return data ? data.atualizado_em : null;
}
async function nuvemSalvar(obj){
  if(!nuvemInit() || !_sbUser) return;
  const {error}=await _sb.from('dados').upsert({ id:'empresa', conteudo:obj, atualizado_em:new Date().toISOString() });
  if(error) console.warn('Falha ao salvar na nuvem:', error.message);
}
/* -------- Arquivos na nuvem (Supabase Storage, bucket 'arquivos') -------- */
async function nuvemUpload(path, file){
  if(!nuvemInit() || !_sbUser) throw new Error('Sem conexão para enviar arquivo.');
  const {error}=await _sb.storage.from('arquivos').upload(path, file, { upsert:true, contentType:(file&&file.type)||undefined });
  if(error) throw error;
  return path;
}
async function nuvemUrlArquivo(path){
  if(!nuvemInit()) return null;
  const {data,error}=await _sb.storage.from('arquivos').createSignedUrl(path, 3600);
  if(error) throw error;
  return data ? data.signedUrl : null;
}
async function nuvemRemoverArquivo(path){
  if(!nuvemInit() || !path) return;
  try{ await _sb.storage.from('arquivos').remove([path]); }catch(e){}
}

/* O tempo real avisa quando OUTRO aparelho salvou. Mas ele depende de
   WebSocket e de a tabela estar publicada no Postgres — e quando não sobe,
   ninguém fica sabendo: o cliente simplesmente deixa de ver o que os
   outros lançaram, calado. Por isso agora guardamos o STATUS: é ele que
   diz ao app se precisa ligar o plano B (conferir de tempos em tempos).
   Pedido do dono: *"todos os usuários devem ver as atualizações sempre"*. */
let _sbRtOk=false;
function nuvemRealtimeOk(){ return _sbRtOk; }
function nuvemRealtime(callback){
  if(!nuvemInit() || _sbChan) return;
  _sbChan = _sb.channel('dados-empresa')
    .on('postgres_changes', { event:'*', schema:'public', table:'dados', filter:'id=eq.empresa' },
        payload => { callback(payload && payload.new ? payload.new.conteudo : null); })
    .subscribe(function(status){
      _sbRtOk = (status==='SUBSCRIBED');
      try{ console.info('[nuvem] tempo real:', status); }catch(_){}
      /* CLOSED/CHANNEL_ERROR/TIMED_OUT: o canal morreu. Solta a referência
         para que uma próxima chamada possa criar outro — sem isto o
         `if(_sbChan) return` lá em cima trancava a reconexão para sempre. */
      if(status==='CLOSED' || status==='CHANNEL_ERROR' || status==='TIMED_OUT'){
        try{ _sb.removeChannel(_sbChan); }catch(_){}
        _sbChan=null;
      }
    });
}
