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

async function nuvemCarregar(){
  if(!nuvemInit()) return null;
  const {data,error}=await _sb.from('dados').select('conteudo').eq('id','empresa').maybeSingle();
  if(error) throw error;
  return data ? data.conteudo : null;
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

function nuvemRealtime(callback){
  if(!nuvemInit() || _sbChan) return;
  _sbChan = _sb.channel('dados-empresa')
    .on('postgres_changes', { event:'*', schema:'public', table:'dados', filter:'id=eq.empresa' },
        payload => { callback(payload && payload.new ? payload.new.conteudo : null); })
    .subscribe();
}
