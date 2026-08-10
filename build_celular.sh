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

OUT_CEL="$COMP/Planeta Express - CELULAR.html"
ART="$TMP/planeta_artifact.html"      # corpo p/ publicar como Artifact (sem <head>/<body>)

# ---------- 1. data URIs das imagens ----------
duri(){ local mime="$2"; printf 'data:%s;base64,%s' "$mime" "$(base64 -w0 "$1")"; }
printf '%s' "$(duri assets/logo-sm.png image/png)"  > "$TMP/uri_logo"
printf '%s' "$(duri assets/fotos/m1.png image/png)" > "$TMP/uri_m1"
printf '%s' "$(duri assets/fotos/m2.png image/png)" > "$TMP/uri_m2"
printf '%s' "$(duri assets/fotos/m3.png image/png)" > "$TMP/uri_m3"
printf '%s' "$(duri assets/fotos/m4.png image/png)" > "$TMP/uri_m4"
printf '%s' "$(duri assets/fotos/m5.jpg image/jpeg)"> "$TMP/uri_m5"
printf '%s' "$(duri assets/fotos/m6.png image/png)" > "$TMP/uri_m6"

# ---------- 2. corpo visivel (entre <body> e o bloco de scripts) ----------
awk '
  /<body>/ {inbody=1; next}
  /<!-- Biblioteca da nuvem/ {inbody=0}
  inbody {print}
' index.html > "$TMP/body.html"

# ---------- 3. CSS e JS concatenados ----------
cat assets/estilo.css assets/estilo2.css > "$TMP/all.css"
cat assets/viagens.js assets/dados.js assets/alarmes.js assets/arquivos.js assets/importar.js assets/app.js assets/central.js assets/monitoramento.js assets/assistente.js > "$TMP/all.js"

# ---------- 4. monta o arquivo do CELULAR (com <head>/<body>) ----------
{
cat <<'HEAD'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Planeta Express — Sistema de Gestão</title>
<meta name="theme-color" content="#0b1424">
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
    $logo=rd($ENV{T}."/uri_logo");
    $m1=rd($ENV{T}."/uri_m1"); $m2=rd($ENV{T}."/uri_m2"); $m3=rd($ENV{T}."/uri_m3");
    $m4=rd($ENV{T}."/uri_m4"); $m5=rd($ENV{T}."/uri_m5"); $m6=rd($ENV{T}."/uri_m6");
  }
  s{__LOGO__}{$logo}g;
  s{assets/logo-sm\.png}{$logo}g;
  s{assets/logo\.png}{$logo}g;
  s{assets/fotos/m1\.png}{$m1}g;
  s{assets/fotos/m2\.png}{$m2}g;
  s{assets/fotos/m3\.png}{$m3}g;
  s{assets/fotos/m4\.png}{$m4}g;
  s{assets/fotos/m5\.jpg}{$m5}g;
  s{assets/fotos/m6\.png}{$m6}g;
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
    $logo=rd($ENV{T}."/uri_logo");
  }
  s{assets/logo-sm\.png}{$logo}g;
  s{assets/logo\.png}{$logo}g;
  s{assets/fotos/m1\.png}{}g; s{assets/fotos/m2\.png}{}g; s{assets/fotos/m3\.png}{}g;
  s{assets/fotos/m4\.png}{}g; s{assets/fotos/m5\.jpg}{}g; s{assets/fotos/m6\.png}{}g;
' "$TMP/artifact_raw.html" > "$ART"

echo "=== GERADO ==="
ls -la "$OUT_CEL" | awk '{print $5, $NF}'
ls -la "$ART"     | awk '{print $5, $NF}'
echo "--- checagens celular ---"
echo -n "assets/ restantes (deve ser 0): "; grep -o "assets/" "$OUT_CEL" | wc -l
echo -n "data:image no celular (deve ser >6): "; grep -o "data:image" "$OUT_CEL" | wc -l
echo -n "iaMontarFab presente: "; grep -c "iaMontarFab" "$OUT_CEL"
echo -n "chkResultadoBadge presente: "; grep -c "chkResultadoBadge" "$OUT_CEL"
echo -n "supabase (deve ser 0): "; grep -c "supabase" "$OUT_CEL" || true
