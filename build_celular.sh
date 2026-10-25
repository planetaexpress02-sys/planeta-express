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

printf '%s' "$(duri assets/fotos/m8.png image/png)" > "$TMP/uri_m8"

# ---------- 2. corpo visivel (entre <body> e o bloco de scripts) ----------
awk '
  /<body>/ {inbody=1; next}
  /<!-- Biblioteca da nuvem/ {inbody=0}
  inbody {print}
' index.html > "$TMP/body.html"

# ---------- 3. CSS e JS concatenados ----------
# v13.5 — o estilo-claro.css entra DEPOIS do escuro, mesma ordem do site.
# Fora daqui, o celular ficaria escuro e o computador claro.
cat assets/estilo.css assets/estilo2.css assets/estilo-claro.css > "$TMP/all.css"
# v13.0 — a lista abaixo era repetida A MAO e divergiu do index.html assim que
# a Contabilidade saiu: o `cat` apontava para um arquivo que nao existe mais.
# Com `set -euo pipefail` isso derruba o build, o que ja e melhor que passar
# calado -- mas o risco real e o inverso: entrar um arquivo NOVO no index.html
# e nao entrar aqui, e o celular rodar um sistema diferente do site, sem aviso
# (regra do dono: toda atualizacao vale em TODOS os locais).
# Por isso agora existe a conferencia logo abaixo.
cat assets/viagens.js assets/dados.js assets/alarmes.js assets/arquivos.js assets/importar.js assets/app.js assets/central.js assets/aniversarios.js assets/relatorios.js > "$TMP/all.js"

# Confere: todo assets/*.js que o index.html carrega tem de estar no `cat` de
# cima. (config-online.js e nuvem.js entram separados mais abaixo.)
FALTOU=""
for J in $(grep -oE 'assets/[a-z0-9_-]+\.js' index.html | sort -u); do
  case "$J" in assets/config-online.js|assets/nuvem.js) continue;; esac
  grep -q "$J" <<< "$(sed -n '/^cat assets\/viagens\.js/p' build_celular.sh)" || FALTOU="$FALTOU $J"
done
if [ -n "$FALTOU" ]; then
  echo "ERRO: o index.html carrega$FALTOU, mas o arquivo do celular nao." >&2
  echo "      Acrescente no 'cat' acima, senao o celular roda um sistema" >&2
  echo "      diferente do site -- e sem nenhum aviso." >&2
  exit 1
fi
echo "   site e celular carregam os mesmos arquivos"

# ---------- 4. monta o arquivo do CELULAR (com <head>/<body>) ----------
{
cat <<'HEAD'
<!DOCTYPE html>
<html lang="pt-BR" data-theme="claro">
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
    $m4=rd($ENV{T}."/uri_m4"); $m5=rd($ENV{T}."/uri_m5"); $m8=rd($ENV{T}."/uri_m8");
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
  s{assets/fotos/m8.png}{$m8}g;
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
  s{assets/fotos/m4\.png}{}g; s{assets/fotos/m5\.jpg}{}g; s{assets/fotos/m8.png}{}g;
' "$TMP/artifact_raw.html" > "$ART"

# ==========================================================================
# v12.7 — UM ARQUIVO DO CELULAR. UM SO. SEMPRE.
#
# Pedido do dono, com todas as letras: "nao quero copia velha, quero todo o
# sistema interligado sempre".
#
# O que acontecia: o build grava na PASTA DA EMPRESA (um nivel acima), mas
# sobrava um "Planeta Express - CELULAR.html" dentro da pasta do sistema,
# de 21/09, na v12.5 — nove versoes atras. O .gitignore impede que ele va
# para o site, mas nao impede o cliente de abrir o arquivo errado. Duas
# copias com o mesmo nome e uma delas velha e armadilha, nao redundancia.
#
# Agora o build varre e remove qualquer copia extra, e so termina quando
# existe EXATAMENTE UMA. Copia dentro de pasta de backup nao conta: backup
# e para ser antigo mesmo.
# ==========================================================================
echo "--- um arquivo do celular, um so ---"
EXTRAS=0
while IFS= read -r -d '' velho; do
  [ "$velho" = "$OUT_CEL" ] && continue
  case "$velho" in *"/Backup Planeta Express"*|*"/.claude/"*) continue;; esac
  echo "   removendo copia velha: $velho"
  rm -f "$velho"; EXTRAS=$((EXTRAS+1))
done < <(find "$COMP" -maxdepth 3 -name "Planeta Express - CELULAR.html" -print0 2>/dev/null)
[ "$EXTRAS" -eq 0 ] && echo "   nenhuma copia extra (certo)"

RESTANTES=$(find "$COMP" -maxdepth 3 -name "Planeta Express - CELULAR.html" \
  -not -path "*/Backup Planeta Express*" -not -path "*/.claude/*" 2>/dev/null | wc -l)
if [ "$RESTANTES" -ne 1 ]; then
  echo "ERRO: deveria existir 1 arquivo do celular e existem $RESTANTES." >&2; exit 1
fi

# E a versao gravada no arquivo TEM de bater com a do versao.json que vai
# para o site. Se divergirem, o celular nunca descobre que envelheceu --
# que e exatamente o defeito que o aviso de versao existe para evitar.
VJ=$(grep -o '"versao": *"[0-9.]*"' versao.json | head -1 | sed 's/.*"\([0-9.]*\)"$/\1/')
if [ "$VJ" != "$VERSAO" ]; then
  echo "ERRO: versao.json diz v$VJ e este build e v$VERSAO. Acerte o versao.json" >&2
  echo "      antes de publicar, senao o celular nao descobre que envelheceu." >&2
  exit 1
fi
echo "   versao do arquivo e do versao.json batem: v$VERSAO"

echo "=== GERADO ==="
ls -la "$OUT_CEL" | awk '{print $5, $NF}'
ls -la "$ART"     | awk '{print $5, $NF}'
echo "--- checagens celular ---"
# v12.7 — a checagem contava QUALQUER "assets/", inclusive dentro de
# comentario. Tres comentarios explicativos a faziam acusar 3 sobras que nao
# existiam, e uma checagem que acusa errado deixa de ser lida. Agora so conta
# referencia de verdade: src=, href= ou url() apontando para assets/.
#
# ⚠️ E o `|| true` NAO e enfeite. O script roda com `set -euo pipefail`:
# `grep` sem nenhuma ocorrencia sai com codigo 1 e DERRUBA o build. Quer
# dizer que esta checagem so sobrevivia enquanto estivesse ERRADA (os 3
# comentarios); assim que passou a contar 0 — o resultado certo — o build
# morreu exatamente ali, e as tres checagens obrigatorias de baixo, que ja
# pegaram um celular sem nuvem, nem chegavam a rodar.
echo -n "assets/ de verdade (src/href/url — deve ser 0): "
{ grep -o -E "(src|href)=[\"']assets/|url\([\"']?assets/" "$OUT_CEL" || true; } | wc -l
echo -n "data:image no celular (deve ser >6): "; { grep -o "data:image" "$OUT_CEL" || true; } | wc -l
echo -n "chkResultadoBadge presente: "; grep -c "chkResultadoBadge" "$OUT_CEL" || true
# v11.1 — estas tres viraram OBRIGATORIAS. Antes a checagem exigia
# "supabase: 0", o que carimbava como correto justamente o defeito: um
# celular sem nuvem, que nunca sincronizava. Se qualquer uma destas vier 0,
# o arquivo do celular esta offline de novo e NAO pode ser entregue.
echo -n "createClient (nuvem; TEM de ser >0): "; grep -c "createClient" "$OUT_CEL" || true
echo -n "PEX_CONFIG url (TEM de ser >0): ";      grep -c "supabase.co" "$OUT_CEL" || true
echo -n "nuvemLogin (TEM de ser >0): ";          grep -c "function nuvemLogin" "$OUT_CEL" || true
