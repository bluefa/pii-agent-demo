# 작업 유형 글리프 — INSTALL · DELETE · CUSTOM

- **날짜** 2026-08-14
- **대상** `PipelineTypeTag`(목록 작업 유형 열) · `TypeTile`(상세 실행 카드·이력 행·모달 눈썹)
- **아티팩트** https://claude.ai/code/artifact/cdbcb330-7f3f-4635-9e30-a4de0f70521e
- **PR** #710

## 문제

오너 관찰: "작업 유형 아이콘이 조금 이상하다."

| # | 진단 | 근거 등급 |
|---|------|-----------|
| ① | `install`(받침대로 내려오는 화살표)은 **내려받기** 관용구다. Lucide가 `download`에 붙인 태그가 `import · export · save`. 이 동작은 아무것도 내려받지 않고 고객 클라우드 **쪽으로** 인프라를 세운다 — 화살표 방향이 반대다. | UX 원칙 |
| ② | `trash`(휴지통)는 **되돌릴 수 있는** 삭제의 그림이다. 여기 DELETE는 `terraform destroy`라 되돌리기가 없다. 이 열의 빨강은 이미 뺐으므로(실패 빨강 충돌) 모양이 유일한 채널이고, 그만큼 정확해야 한다. | UX 원칙 |
| ③ | `sliders`가 **이 목록 자신의 필터 트리거와 쌍둥이**다. 둘 다 길이가 줄어드는 가로 막대 더미이고(`FilterIcon` = `M2 3.5h10M4 7h6M5.5 10.5h3`), Lucide는 `sliders-horizontal`에 `filters`를 직접 달아 놓았다. 한 화면에서 두 뜻이 한 모양을 쓴다. | 같은 화면 충돌 |
| ④ | 셋이 서로 다른 은유 족에서 왔다 — `install`=동작, `trash`=사물, `sliders`=조작부. 한 열에 쌓이는 형제는 한 족에서 나와야 그 열이 하나의 축으로 읽힌다. | UX 원칙 |

①②③보다 ④가 "이상하다"의 정체에 가깝다. 글리프 하나하나가 아니라 셋의 관계 문제였다.

## 조사

후보 32종을 Lucide 1.31.0 원본에서 받아 **실제 렌더**로 비교했다(40px 검수용 + 표에서 실제로 쓰이는 14px).
판정 근거는 라이브러리가 스스로 붙인 의미 태그(`tags.json`)와 획 개수다 — 내 해석이 아니다.

- Lucide 1.31.0 아이콘 SVG · `tags.json` — 확인함
- GitHub Primer Octicons 19.15.1 `data.json` — 확인함(배포 어휘 교차 확인: `rocket → launch·ship`)
- Cloudscape Iconography — JS 렌더라 목록 추출 실패. **판단 근거로 쓰지 않았다.**

시안 넷 중 A(꾸러미 대칭)와 C(연산자 최소)만 네 진단을 모두 지웠다. 둘의 차이는 구체성 ↔ 14px 내구성 하나.

## 결정 (오너)

**시안 A의 INSTALL·CUSTOM만 채택.** DELETE는 `trash` 유지.

| 유형 | 이전 | 이후 |
|------|------|------|
| INSTALL | `install` | `package-plus` |
| DELETE | `trash` | `trash` (유지) |
| CUSTOM | `sliders` | `blocks` |

DELETE를 두었으므로 시안 A가 내세웠던 **plus/minus 대칭은 성립하지 않는다.** 대신 얻은 것은
`package-plus`와 `blocks`가 공유하는 **상자 어휘**다 — 셋 중 둘이 한 족이 되어 ④가 부분 해소된다.
①③은 완전 해소, ②는 잔존(오너 판단).

## 실측

14px 내구성이 시안 A의 유일한 위험이었다(`package-plus`는 획 6개). 실제 화면에서 확인:
세 글리프 모두 12px 라벨 옆 14px에서 형태가 살아 있다. 상자의 면 분할과 `+`가 구별되고,
`blocks`의 노치와 떨어진 사각형도 뭉치지 않는다. 시안 C로 내려갈 이유가 없었다.

## 적용 범위

파이프라인 **유형**을 말하는 두 곳만 바꿨다 — `PipelineTypeTag`(목록), `r24Task.TYPE_TONE`(상세 TypeTile).

`install` 글리프는 세트에 남는다. 유형이 아닌 다른 뜻으로 쓰는 소비자가 셋 있다
(`ConfirmedInfoCard` 제목·빈 상태, `RequestTab` 빈 상태 — 전부 "확정 정보"이지 INSTALL이 아니다).
`sliders`는 소비자가 이 둘뿐이었으므로 세트에서 **삭제**했다.
