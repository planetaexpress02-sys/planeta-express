/* ==========================================================================
   MODO ONLINE — Supabase (Planeta Express Transportes)
   Já configurado: o sistema conecta sozinho e abre na tela de login.
   (Você NÃO precisa editar este arquivo.)
   ========================================================================== */
(function(){
  var salvo = {};
  try { salvo = JSON.parse(localStorage.getItem('pex_online_cfg') || '{}'); } catch (e) {}
  window.PEX_CONFIG = {
    url: (salvo && salvo.url) || "https://kxwcwpxaovwgwviqhelh.supabase.co",
    key: (salvo && salvo.key) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4d2N3cHhhb3Z3Z3d2aXFoZWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MjY2MzUsImV4cCI6MjEwMDMwMjYzNX0.BIN3IlNqHZT9CMe8_oJcD-gbxMXISfcGvF-UCl2FMzM"
  };
})();
