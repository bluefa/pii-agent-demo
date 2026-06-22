#!/bin/bash
# Dump the COMPUTED geometry (font-size/weight/line-height/letter-spacing/margin/gap/padding)
# of every element matching a selector — so v16's real cascade (incl. `!important` beating inline
# styles) is read exactly, not eyeballed. See html-analysis skill L10/L11.
#
# usage:
#   v16 mockup at a provider/step:  measure.sh v16 <azure|gcp|aws|idc> <step 1-7> "<css-selector>"
#   any file/url:                   measure.sh url "<file://… or http://…>" "<css-selector>"
set -euo pipefail
mode="$1"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ "$mode" = "v16" ]; then
  prov="$2"; step="$3"; sel="$4"
  src="/Users/study/pii-agent-demo-target-source-v15/design/SIT Prototype Athena v16.html"
  tmp="/tmp/measure_${prov}_${step}.html"
  cp "$src" "$tmp"
  nav="try{showScreen('screen-4')}catch(e){} try{setProvider('$prov')}catch(e){} try{setStep($step)}catch(e){}"
else
  url="$2"; sel="$3"; tmp=""
  nav=""
fi

# The probe: after nav + a tick, compute styles for each match and write a JSON block into the DOM.
read -r -d '' PROBE <<EOF || true
<script>
window.addEventListener('load', function(){
  $nav
  setTimeout(function(){
    var props=['fontSize','fontWeight','lineHeight','letterSpacing','color','marginTop','marginBottom','marginLeft','marginRight','gap','rowGap','columnGap','paddingTop','paddingBottom','paddingLeft','paddingRight','borderRadius','boxShadow'];
    var out=[].slice.call(document.querySelectorAll("$sel")).map(function(el,i){
      var cs=getComputedStyle(el); var r=el.getBoundingClientRect();
      var o={i:i,tag:el.tagName.toLowerCase(),text:(el.textContent||'').trim().slice(0,28)};
      o.top=Math.round(r.top); o.bottom=Math.round(r.bottom); o.left=Math.round(r.left); o.vis=(r.width>0&&r.height>0);
      props.forEach(function(p){o[p]=cs[p];}); return o;
    });
    var pre=document.createElement('pre'); pre.setAttribute('data-measure','1');
    pre.textContent=JSON.stringify(out); document.body.appendChild(pre);
  }, 120);
});
</script>
EOF

if [ "$mode" = "v16" ]; then
  printf '%s\n' "$PROBE" >> "$tmp"
  target="file://$tmp"
else
  # For arbitrary url we cannot inject; only file targets support the probe. http impl pages
  # are better measured against their token values. Fall back to dump-dom for file urls.
  if [[ "$url" == file://* ]]; then
    f="${url#file://}"; tmp="/tmp/measure_url.html"; cp "$f" "$tmp"; printf '%s\n' "$PROBE" >> "$tmp"; target="file://$tmp"
  else
    echo "measure.sh: http/https targets need CDP injection (not supported here); measure the file mockup, compare impl via its theme tokens." >&2
    target="$url"
  fi
fi

"$chrome" --headless --disable-gpu --virtual-time-budget=6000 --dump-dom "$target" 2>/dev/null \
  | python3 -c 'import sys,re,html,json
m=re.search(r"<pre data-measure=\"1\">(.*?)</pre>", sys.stdin.read(), re.S)
if not m: print("(no match — selector matched nothing or probe did not run)"); sys.exit(0)
raw=html.unescape(m.group(1))
try:
    for o in json.loads(raw): print(json.dumps(o, ensure_ascii=False))
except Exception:
    print(raw)'
