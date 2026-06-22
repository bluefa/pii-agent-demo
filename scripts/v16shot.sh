#!/bin/bash
# Render the v16 HTML prototype at a given provider+step and screenshot it.
# usage: v16shot.sh <azure|gcp|aws|idc> <step 1-7> <out.png>
set -euo pipefail
prov="$1"; step="$2"; out="$3"
src="/Users/study/pii-agent-demo-target-source-v15/design/SIT Prototype Athena v16.html"
tmp="/tmp/v16_${prov}_${step}.html"
cp "$src" "$tmp"
cat >> "$tmp" <<EOF
<script>
  function __v16nav(){
    try{ showScreen('screen-4'); }catch(e){}
    try{ setProvider('$prov'); }catch(e){}
    try{ setStep($step); }catch(e){}
  }
  if (document.readyState === 'complete') { setTimeout(__v16nav, 30); }
  else { window.addEventListener('load', function(){ setTimeout(__v16nav, 30); }); }
</script>
EOF
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=1440,3200 \
  --virtual-time-budget=9000 --screenshot="$out" "file://$tmp" 2>/dev/null
echo "wrote $out"
