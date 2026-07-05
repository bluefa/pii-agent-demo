#!/usr/bin/env python3
"""admin-pipeline.html의 <style>·아이콘 sprite를 추출해 컴포넌트 시트를 생성.
CSS가 바뀌면 이 스크립트를 다시 실행 — 시트가 원본과 어긋나지 않게 하는 단일 경로.
사용: python3 build-component-sheet.py  (design/pipeline/figma-export/ 에서)
"""
import io, re, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE.parent / 'admin-pipeline.html'

s = io.open(SRC, encoding='utf8').read()
style = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
sprite = re.search(r'(<svg width="0".*?</svg>)', s, re.S).group(1)

BODY = io.open(HERE / 'component-sheet-body.html', encoding='utf8').read()

OUT = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>Admin Pipeline — Component Sheet (Figma capture용)</title>
<style>{style}
/* ── sheet 전용 오버라이드: 고정 배치 요소를 문서 흐름으로 ── */
.toast{{position:static;transform:none;display:inline-flex}}
.topnav{{position:static}}
.sheet{{max-width:1080px;margin:0 auto;padding:40px 32px 80px}}
.sheet-h{{font-size:24px;font-weight:700;margin:64px 0 12px;line-height:1.2}}
.sheet-h:first-child{{margin-top:0}}
.sheet-cap{{font-size:12px;color:var(--text-weak);margin:-8px 0 16px}}
.swatch-row{{display:flex;flex-wrap:wrap;gap:12px}}
.swatch{{width:120px}}
.swatch .chip{{height:48px;border-radius:8px;border:1px solid var(--border)}}
.swatch .nm{{font-size:12px;color:var(--text-weak);margin-top:4px;font-family:var(--font-mono)}}
.icon-strip{{display:flex;gap:16px;flex-wrap:wrap;color:var(--text-medium)}}
.icon-strip span{{display:inline-flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--text-weak)}}
</style>
</head>
<body>
{sprite}
<div class="sheet">
{BODY}
</div>
</body>
</html>
"""
io.open(HERE / 'component-sheet.html', 'w', encoding='utf8').write(OUT)
print('component-sheet.html generated:', len(OUT), 'bytes')
