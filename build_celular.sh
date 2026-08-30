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
echo "<script>"
cat "$TMP/all.js"
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
echo -n "supabase (deve ser 0): "; grep -c "supabase" "$OUT_CEL" || true
