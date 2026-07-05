# Figma로 디자인 요소 올리기

Figma는 외부 API로 디자인 노드를 써 넣는 것을 허용하지 않는다(REST는 읽기·코멘트 중심).
따라서 **플러그인 경유**가 유일한 경로 — 아래 두 단계면 전 요소가 편집 가능한 레이어로 들어간다.

## 1단계 — 화면·컴포넌트 캡처: html.to.design

1. Figma 데스크톱/웹에서 플러그인 **html.to.design** 설치 (divRIOTS 제작, 무료 티어로 충분).
2. 함께 제공되는 **크롬 확장**을 설치하면 localhost 페이지도 캡처 가능.
3. 로컬 서버가 떠 있는 상태(`http://localhost:8932`)에서 아래 5개를 순서대로 캡처:

| # | URL | 내용 |
|---|---|---|
| 1 | `http://localhost:8932/figma-export/component-sheet.html` | **컴포넌트 시트** — 색·타이포·버튼·배지·카드·테이블·상태바·노드·모달·아이콘 전부 (이것 하나로 라이브러리 구성 가능) |
| 2 | `http://localhost:8932/admin-pipeline.html#/dashboard` | 대시보드 |
| 3 | `http://localhost:8932/admin-pipeline.html#/services` | 서비스·대상 검색 (서비스 하나 클릭한 상태로) |
| 4 | `http://localhost:8932/admin-pipeline.html#/target/101` | Target 상세 |
| 5 | `http://localhost:8932/admin-pipeline.html#/pipeline/124` | 파이프라인 상세 (FAILED 케이스 — #129는 PENDING 케이스) |

캡처 결과는 Figma 프레임으로 들어오며 텍스트·오토레이아웃이 살아 있다.

## 2단계 — 토큰을 Figma Variables로: Tokens Studio

1. Figma 플러그인 **Tokens Studio for Figma** 설치.
2. 플러그인에서 `Import` → [design-tokens.json](design-tokens.json) 내용 붙여넣기.
3. `Export to Figma → Variables`로 색·간격·radius가 Figma Variables가 된다.
   (타이포 6롤은 Text Styles로 내보내기 선택)

토큰 값의 근거는 [admin-pipeline-style-guide.md](../admin-pipeline-style-guide.md)가 SSOT.

## 컴포넌트 시트 재생성

CSS가 바뀌면 시트를 다시 만든다 (원본 `<style>`·아이콘 sprite를 자동 추출):

```bash
cd design/pipeline/figma-export && python3 build-component-sheet.py
```

시트 본문(예시 마크업)은 `component-sheet-body.html` — 새 컴포넌트가 생기면 여기에 추가.

## 대안 (플러그인을 못 쓸 때)

- 각 페이지 스크린샷을 Figma에 이미지로 붙이고 위에서 트레이싱 — 편집성은 떨어짐.
- SVG 조각(아이콘 등)은 코드 복사 → Figma에 그대로 붙여넣기 하면 벡터 레이어가 된다
  (`admin-pipeline.html`의 `<symbol>` 블록을 `<svg viewBox="0 0 24 24">…</svg>`로 감싸서).
