# projectId ↔ targetSourceId 매핑 (main@`ffb1547` 기준 snapshot)

Wave 2 mock store pivot 시 fixture 변환용 정답지. 이 표에 맞춰야 W0 lock-in 테스트가 같은 project 객체를 검증한다.

| # | Provider | projectId (legacy string) | targetSourceId (number) |
|---|----------|---------------------------|-------------------------|
| 1 | SDU      | `proj-sdu-001`            | 1001                    |
| 2 | GCP      | `gcp-proj-1`              | 1002                    |
| 3 | Azure    | `azure-proj-1`            | 1003                    |
| 4 | Azure    | `azure-proj-2`            | 1004                    |
| 5 | Azure    | `azure-proj-3`            | 1005                    |
| 6 | AWS      | `proj-1`                  | 1006                    |
| 7 | AWS      | `proj-2`                  | 1007                    |
| 8 | AWS      | `proj-3`                  | 1008                    |
| 9 | IDC      | `proj-4`                  | 1009                    |
| 10| AWS      | `proj-5`                  | 1010                    |
| 11| SDU      | `sdu-proj-1`              | 1011                    |

## 핵심 파생값 (behavior preservation 증명용)

Wave 0 lock-in 에 걸려 있는 값들. Wave 2 이후에도 **동일** 해야 통과.

| 파생 식별자 | 원본 projectId | 결과 | 주의 |
|-------------|----------------|------|------|
| `sdu-user-${projectId.slice(-8)}` | `proj-sdu-001` | `sdu-user--sdu-001` | double-hyphen 유지 (W0 §sdu.test.ts:27 코멘트) |
| `sdu-user-${projectId.slice(-8)}` | `sdu-proj-1`   | `sdu-user-u-proj-1` | W0 §sdu.test.ts:456 |
| `sdu_db_${projectId.slice(-8)}`   | `proj-sdu-001` | `sdu_db_-sdu-001`   | W0 §sdu.test.ts (seed data) |

## Preservation 원칙

- Mock 내부에서 `projectId.slice(-8)` / `.split('').reduce(...)` 쓰던 곳은 `getProjectByTargetSourceId(targetSourceId).id.slice(-8)` 로 변환 — 결과 문자열 동일.
- `String(targetSourceId).slice(-8)` 은 **금지** — bucket/hash 결과 달라짐 (behavior drift).
