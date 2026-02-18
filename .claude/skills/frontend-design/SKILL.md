---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## ⛔ Design System Constraints (필수)

이 프로젝트는 `lib/theme.ts`에 정의된 디자인 토큰만 사용합니다. Raw Tailwind 색상 클래스 직접 사용은 금지입니다.

### 색상 토큰

| 용도 | 토큰 | 예시 |
|------|------|------|
| Primary 액션/버튼 | `getButtonClass('primary')` | CTA, 주요 버튼 |
| Secondary 액션 | `getButtonClass('secondary')` | 취소, 보조 버튼 |
| 상태 표시 | `statusColors.{success\|error\|warning\|pending\|info}` | 뱃지, 상태 텍스트 |
| 텍스트 | `textColors.{primary\|secondary\|tertiary}` | 본문, 보조 텍스트 |
| 입력 필드 | `getInputClass()` | input, textarea |
| 카드/모달 | `cardStyles`, `modalStyles` | 패널, 대화상자 |

### 허용/금지

```tsx
// ❌ 금지 — raw 색상 클래스
<button className="bg-blue-600 text-white hover:bg-blue-700">

// ✅ 허용 — theme 토큰
<button className={getButtonClass('primary')}>

// ✅ 허용 — 레이아웃 클래스 (색상 아님)
<div className="flex gap-4 p-6 rounded-xl">
```

### 기존 UI 컴포넌트 재사용

`Button`, `Badge`, `Modal`, `Card`, `Table`, `LoadingSpinner` 등 `app/components/ui/`의 컴포넌트를 우선 사용합니다.

---

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Use `lib/theme.ts` tokens for all colors. Layout and spacing classes (`flex`, `gap-*`, `p-*`, `rounded-*`) are freely usable.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
