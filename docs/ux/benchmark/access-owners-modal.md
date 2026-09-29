# 담당자 확인 모달 — 권한 요청 footer (D안)

- 날짜: 2026-09-29
- 대상: `/pass/access-requests` 「담당자 확인」 모달 (`OwnersModal`, `app/admin/pipelines/access/_components/AccessModals.tsx`)
- 아티팩트: https://claude.ai/artifact/TFTUhEv8mQex2jtHr9W4Gm
- 구현 PR: `feat/owned-tab-owners` (접근 가능 탭 담당자 보기와 같은 PR)

## 문제 (근거 등급)

- P1 안내 문장이 열린 탭과 맞지 않음 — UX 원칙. **오너 정정(09-29): 담당자는 검토자가 아니다. 검토는 관리자가 한다. 담당자는 그 서비스에 권한이 있는 사람들이다.** 그래서 옛 문장 「이 서비스의 접근 권한 요청을 검토하는 사람들이에요」는 두 탭 모두에서 틀린 사실이었다.
- P2 인원수(12px)가 안내 문장(16px)·칩(14px)보다 약함 — UX 원칙. 이번에 다루지 않음.
- P3 머리 92px 대 본문 29px — 제안. 이번에 다루지 않음.
- P4 이름을 본 뒤 다음 동작이 없음 — 제안. 요청 탭은 D안으로 해결, 접근 가능 탭(복사)은 미착수.

## 쓴 레퍼런스

| 레퍼런스 | URL | 빌린 요소 |
|---|---|---|
| Google Docs "You need access" | https://support.google.com/docs/answer/16722399 | 명단 옆에 바로 「액세스 요청」 |
| Figma Request access | https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions | 요청자에게는 요청 버튼을 같은 카드 안에 |
| Microsoft Entra My Access | https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-request-access | 요청 흐름 안에서 사람 명단 확인 |

## 채택안과 이유

**D안** — 요청할 수 있는 서비스 탭에서 연 모달에만 footer [닫기][권한 요청]. 권한 요청을 누르면 이 모달을 닫고 `RequestAccessModal` 을 연다. 접근 가능 탭에서 연 모달은 footer 없이 머리 X (08-21 결정 그대로).

- 비교표에서 D 는 P1 일부·P4 일부를 푼다. 추천은 B+C 였으나 오너가 D 를 골랐다.
- 08-21 「읽기만 하는 모달이라 footer 없음」은 요청 탭에서 동작이 생기므로 전제가 바뀌어 만료. 접근 가능 탭에는 그대로 유효.
- 안내 문장은 두 탭 공통 「이 서비스에 권한이 있는 사람들이에요.」 — 오너 정정에서 온 사실 한 줄. 아티팩트의 D안 목업 문구(「이 담당자들이 검토해요」)는 틀린 사실이라 폐기.
