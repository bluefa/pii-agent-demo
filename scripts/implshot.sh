#!/bin/bash
# Screenshot the running impl (localhost:3000) for a given targetSourceId.
# usage: implshot.sh <targetSourceId> <out.png>
set -euo pipefail
id="$1"; out="$2"
url="http://localhost:3000/integration/target-sources/$id"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=1440,3200 \
  --virtual-time-budget=12000 --screenshot="$out" "$url" 2>/dev/null
echo "wrote $out"
