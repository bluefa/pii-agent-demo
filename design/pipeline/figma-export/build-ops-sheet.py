#!/usr/bin/env python3
"""admin-ops.html의 <style>·아이콘 path map을 추출해 운영 콘솔 컴포넌트 시트를 생성.

build-component-sheet.py(admin-pipeline용)와 같은 원칙: 시트는 원본 CSS를 그대로
가져다 쓴다 — 손으로 베끼지 않으므로 원본과 어긋날 수 없다. admin-ops.html은
sprite 대신 JS `icon()` 안의 path map을 쓰므로 그 맵을 파싱해 아이콘 스트립을 만든다.

사용: python3 build-ops-sheet.py  (design/pipeline/figma-export/ 에서)
"""
import io, re, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE.parent / 'admin-ops.html'

src = io.open(SRC, encoding='utf8').read()

style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)

# icon() 안의 paths 객체에서 name -> svg inner 를 추출
paths_block = re.search(r'const paths = \{(.*?)\n  \};', src, re.S).group(1)
# 한 항목 = 한 줄. 마지막 항목은 뒤에 개행이 없으므로 줄 앵커로 잡는다.
icons = re.findall(r"^\s*(\w+):'(.*?)',\s*$", paths_block, re.M)
assert icons, 'icon path map 파싱 실패 — admin-ops.html의 icon() 구조가 바뀌었는지 확인'

icon_strip = '\n'.join(
    f'<span><svg class="ic" viewBox="0 0 16 16">{inner}</svg>{name}</span>'
    for name, inner in icons)

BODY = io.open(HERE / 'ops-sheet-body.html', encoding='utf8').read()
BODY = BODY.replace('<!--ICON_STRIP-->', icon_strip)

# 본문의 <!--IC:name--> / <!--IC:name.sm--> 를 원본 path map으로 치환.
# 시트가 아이콘 path를 자기 복사본으로 들고 있으면 원본과 어긋나므로 항상 여기서 주입한다.
IMAP = dict(icons)
def sub_icon(m):
    name, cls = m.group(1), (m.group(2) or '')
    assert name in IMAP, f'없는 아이콘: {name}'
    return f'<svg class="ic {cls}" viewBox="0 0 16 16">{IMAP[name]}</svg>'
BODY, n = re.subn(r'<!--IC:(\w+)(?:\.(\w+))?-->', sub_icon, BODY)

SHEET_CSS = """
/* ── sheet 전용 오버라이드: 고정 배치 요소를 문서 흐름으로 ── */
.toast{position:static;transform:none;display:inline-flex;left:auto;bottom:auto}
.topnav{position:static}
.overlay{position:static;inset:auto;background:none;display:block;padding:0}
.ts-mast{margin:0;border-radius:10px;border:1px solid var(--border)}
.tabbar{margin:0 0 24px}
.sheet{max-width:1080px;margin:0 auto;padding:40px 32px 80px}
.sheet-h{font-size:24px;font-weight:700;margin:64px 0 12px;line-height:1.2}
.sheet-h:first-child{margin-top:0}
.sheet-cap{font-size:12px;color:var(--text-weak);margin:-8px 0 16px;line-height:1.4}
.sheet-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.swatch-row{display:flex;flex-wrap:wrap;gap:12px}
.swatch{width:120px}
.swatch .chip{height:48px;border-radius:8px;border:1px solid var(--border)}
.swatch .nm{font-size:12px;color:var(--text-weak);margin-top:4px;font-family:var(--font-mono)}
.icon-strip{display:flex;gap:16px;flex-wrap:wrap;color:var(--text-medium)}
.icon-strip span{display:inline-flex;flex-direction:column;align-items:center;gap:4px;
  font-size:12px;color:var(--text-weak)}
/* 대비 감사 표 — 값의 근거를 시트 안에 남긴다 */
.a11y{width:100%;border-collapse:collapse;font-size:12px}
.a11y th{text-align:left;font-weight:600;color:var(--text-weak);height:34px;padding:0 12px;
  border-bottom:1px solid var(--border)}
.a11y td{height:34px;padding:0 12px;border-bottom:1px solid var(--gray-100);
  color:var(--text-medium);font-variant-numeric:tabular-nums}
.a11y td.pass{color:var(--ok-text);font-weight:600}
.a11y td.no{color:var(--err-text);font-weight:600}
"""

OUT = ('<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8" />\n'
       '<title>Admin 운영 콘솔 — Component Sheet (Figma capture용)</title>\n'
       '<style>' + style + SHEET_CSS + '</style>\n</head>\n<body>\n'
       '<div class="sheet">\n' + BODY + '\n</div>\n</body>\n</html>\n')

io.open(HERE / 'ops-sheet.html', 'w', encoding='utf8').write(OUT)
print(f'ops-sheet.html generated: {len(OUT)} bytes · {len(icons)} icons · {n} inline icons injected')
