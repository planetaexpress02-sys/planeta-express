#!/usr/bin/env bash
# ==========================================================================
# Planeta Express — gera "Planeta Express - CELULAR.html" (arquivo unico,
# 100% offline, tudo embutido em base64). Recriado na sessao v4.5.
# ==========================================================================
set -euo pipefail

SYS="/c/Users/uilia/OneDrive/Área de Trabalho/Planeta Express Transportes/Sistema Planeta Express"
COMP="/c/Users/uilia/OneDrive/Área de Trabalho/Planeta Express Transportes"
TMP="${T:-/c/Users/uilia/AppData/Local/Temp/claude/C--Users-uilia-OneDrive--rea-de-Trabalho-Planeta-Express-Transportes/74d73a5a-5931-4ff8-8e4e-98bbad3c3800/scratchpad}"
mkdir -p "$TMP"
cd "$SYS"

# Os passos de perl la embaixo leem os data URIs por $ENV{T} — NAO por $TMP.
# Sem `export T`, o perl morre no meio... depois do arquivo do celular ja ter
# sido truncado, e o cliente fica com um HTML de 0 byte. Aconteceu na v6.96.
# Entao: exigir T ANTES de escrever qualquer coisa.
export T="$TMP"
if [ ! -d "$T" ]; then echo "ERRO: pasta de trabalho nao existe: $T" >&2; exit 1; fi

# v11.1 — a versao sai do RODAPE do index.html (fonte unica) e e carimbada
# dentro do arquivo do celular. Se nao der para ler, o build para: um
# celular sem carimbo nunca descobre que envelheceu, que e justamente o
# defeito que estamos corrigindo.
VERSAO=$(grep -o '<b>v[0-9.]*</b>' index.html | head -1 | sed 's/<b>v//; s|</b>||')
if [ -z "$VERSAO" ]; then echo "ERRO: nao achei a versao no rodape do index.html" >&2; exit 1; fi
echo "versao deste build: v$VERSAO"

OUT_CEL="$COMP/Planeta Express - CELULAR.html"
ART="$TMP/planeta_artifact.html"      # corpo p/ publicar como Artifact (sem <head>/<body>)

# ---------- 1. data URIs das imagens ----------
duri(){ local mime="$2"; printf 'data:%s;base64,%s' "$mime" "$(base64 -w0 "$1")"; }
# v7.8: tres versoes da marca.
#  uri_logo      = logo-claro.png  -> a interface escura (arte branca, fundo transparente)
#  uri_logo_dark = logo-escuro.png -> o relatorio A4, que e papel BRANCO
#  uri_icon      = logo.png        -> icone do app (quadrado opaco fica melhor como icone)
printf '%s' "$(duri assets/logo-claro.png image/png)"  > "$TMP/uri_logo"
printf '%s' "$(duri assets/logo-escuro.png image/png)" > "$TMP/uri_logo_dark"
printf '%s' "$(duri assets/logo-sm.png image/png)"     > "$TMP/uri_icon"
#  uri_marca = logo-marca.png -> so o monograma "P", para os selos pequenos
#              (topbar 36px e Painel 44px), onde o texto ficaria ilegivel
printf '%s' "$(duri assets/logo-marca.png image/png)"  > "$TMP/uri_marca"
printf '%s' "$(duri assets/fotos/m1.png image/png)" > "$TMP/uri_m1"
printf '%s' "$(duri assets/fotos/m2.png image/png)" > "$TMP/uri_m2"
printf '%s' "$(duri assets/fotos/m3.png image/png)" > "$TMP/uri_m3"
printf '%s' "$(duri assets/fotos/m4.png image/png)" > "$TMP/uri_m4"
printf '%s' "$(duri assets/fotos/m5.jpg image/jpeg)"> "$TMP/uri_m5"

printf '%s' "$(duri assets/fotos/m7.png image/png)" > "$TMP/uri_m7"

# ---------- 2. corpo visivel (entre <body> e o bloco de scripts) ----------
awk '
  /<body>/ {inbody=1; next}
  /<!-- Biblioteca da nuvem/ {inbody=0}
  inbody {print}
' index.html > "$TMP/body.html"

# ---------- 3. CSS e JS concatenados ----------
cat assets/estilo.css assets/estilo2.css > "$TMP/all.css"
cat assets/viagens.js assets/dados.js assets/alarmes.js assets/arquivos.js assets/importar.js assets/app.js assets/central.js assets/contabilidade.js assets/aniversarios.js assets/relatorios.js > "$TMP/all.js"

# ---------- 4. monta o arquivo do CELULAR (com <head>/<body>) ----------
{
cat <<'HEAD'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Planeta Express — Sistema de Gestão</title>
<meta name="theme-color" content="#050609">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Planeta Express">
<link rel="icon" href="__LOGO__">
<link rel="apple-touch-icon" href="__LOGO__">
<style>
HEAD
cat "$TMP/all.css"
echo "</style></head><body>"
cat "$TMP/body.html"
# 🔴 v11.1 — A NUVEM FALTAVA AQUI, E O CELULAR NUNCA SINCRONIZOU.
#
# O arquivo do celular era montado só com os 10 .js de tela. `nuvem.js` e
# `config-online.js` NUNCA entraram, e o <script> do Supabase no CDN ficava
# de fora porque o awk corta o corpo exatamente na linha "Biblioteca da
# nuvem". Resultado: `window.supabase` e `window.PEX_CONFIG` não existiam,
# `nuvemAtiva()` devolvia false e o celular abria SEM login, 100% local.
# Tudo lançado nele ficava nele; nada do computador chegava lá. O cliente
# cobrou assim: "não está atualizando, nem no mobile nem em outros usuários".
#
# O CDN precisa de internet — e é isso mesmo: COM internet ele loga e
# sincroniza como o site; SEM internet o `nuvemAtiva()` volta a ser false e
# o sistema segue offline, como sempre funcionou. Não se perde nada.
echo '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>'
echo "<script>"
cat assets/config-online.js
cat assets/nuvem.js
echo "</script>"
echo "<script>"
cat "$TMP/all.js"
# v11.1 — carimba a versao DENTRO do arquivo. E com ela que o celular
# descobre que envelheceu: compara com o versao.json do site e oferece
# abrir a versao nova. Sai do rodape do index.html, entao nunca diverge.
echo ""
echo "/* carimbo do build: e por aqui que o arquivo do celular sabe a propria versao */"
echo "try{ PEX_VERSAO='$VERSAO'; }catch(e){}"
echo "</script></body></html>"
} > "$TMP/celular_raw.html"

# ---------- 5. substitui caminhos de imagem por data URIs (perl, seguro) ----------
perl -pe '
  BEGIN{
    sub rd { local $/; open(my $f,"<",$_[0]) or die $_[0]; my $s=<$f>; close $f; return $s; }
    $logo=rd($ENV{T}."/uri_logo"); $logod=rd($ENV{T}."/uri_logo_dark"); $icon=rd($ENV{T}."/uri_icon"); $marca=rd($ENV{T}."/uri_marca");
    $m1=rd($ENV{T}."/uri_m1"); $m2=rd($ENV{T}."/uri_m2"); $m3=rd($ENV{T}."/uri_m3");
    $m4=rd($ENV{T}."/uri_m4"); $m5=rd($ENV{T}."/uri_m5"); $m7=rd($ENV{T}."/uri_m7");
  }
  s{__LOGO__}{$icon}g;
  s{assets/logo-claro.png}{$logo}g;
  s{assets/logo-marca.png}{$marca}g;
  s{assets/logo-escuro.png}{$logod}g;
  s{assets/logo-sm.png}{$logo}g;
  s{assets/logo\.png}{$logo}g;
  s{assets/fotos/m1\.png}{$m1}g;
  s{assets/fotos/m2\.png}{$m2}g;
  s{assets/fotos/m3\.png}{$m3}g;
  s{assets/fotos/m4\.png}{$m4}g;
  s{assets/fotos/m5\.jpg}{$m5}g;
  s{assets/fotos/m7\.png}{$m7}g;
' "$TMP/celular_raw.html" > "$OUT_CEL"

# ---------- 6. monta o corpo do ARTIFACT (sem head/body; so logo embutida, fotos viram iniciais) ----------
{
echo "<style>"
cat "$TMP/all.css"
echo "</style>"
cat "$TMP/body.html"
echo "<script>"
cat "$TMP/all.js"
echo "</script>"
} > "$TMP/artifact_raw.html"

perl -pe '
  BEGIN{
    sub rd { local $/; open(my $f,"<",$_[0]) or die $_[0]; my $s=<$f>; close $f; return $s; }
    $logo=rd($ENV{T}."/uri_logo"); $logod=rd($ENV{T}."/uri_logo_dark"); $icon=rd($ENV{T}."/uri_icon"); $marca=rd($ENV{T}."/uri_marca");
  }
  s{assets/logo-claro.png}{$logo}g;
  s{assets/logo-marca.png}{$marca}g;
  s{assets/logo-escuro.png}{$logod}g;
  s{assets/logo-sm.png}{$logo}g;
  s{assets/logo\.png}{$logo}g;
  s{assets/fotos/m1\.png}{}g; s{assets/fotos/m2\.png}{}g; s{assets/fotos/m3\.png}{}g;
  s{assets/fotos/m4\.png}{}g; s{assets/fotos/m5\.jpg}{}g; s{assets/fotos/m7\.png}{}g;
' "$TMP/artifact_raw.html" > "$ART"

echo "=== GERADO ==="
ls -la "$OUT_CEL" | awk '{print $5, $NF}'
ls -la "$ART"     | awk '{print $5, $NF}'
echo "--- checagens celular ---"
echo -n "assets/ restantes (deve ser 0): "; grep -o "assets/" "$OUT_CEL" | wc -l
echo -n "data:image no celular (deve ser >6): "; grep -o "data:image" "$OUT_CEL" | wc -l
echo -n "chkResultadoBadge presente: "; grep -c "chkResultadoBadge" "$OUT_CEL"
# v11.1 — estas tres viraram OBRIGATORIAS. Antes a checagem exigia
# "supabase: 0", o que carimbava como correto justamente o defeito: um
# celular sem nuvem, que nunca sincronizava. Se qualquer uma destas vier 0,
# o arquivo do celular esta offline de novo e NAO pode ser entregue.
echo -n "createClient (nuvem; TEM de ser >0): "; grep -c "createClient" "$OUT_CEL" || true
echo -n "PEX_CONFIG url (TEM de ser >0): ";      grep -c "supabase.co" "$OUT_CEL" || true
echo -n "nuvemLogin (TEM de ser >0): ";          grep -c "function nuvemLogin" "$OUT_CEL" || true
