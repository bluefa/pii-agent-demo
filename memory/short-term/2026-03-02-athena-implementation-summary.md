# Short-Term Memory

- Date: 2026-03-02
- Type: short-term
- Topic: Athena 관련 기능 구현 준비

## Summary

- Athena 추천/선택 단위를 Table 기준 `resource_id`로 변경한다.
- Athena Table 선택은 Region별로 가능해야 하며, 조회/선택 흐름은 `Region -> Database -> Table` 계층으로 제공한다.
- 연동 승인정보/연동 확정정보에는 설치된 리소스만 노출한다.
- 연동 확정정보 조회 시 Region별 Database 목록과 Table 목록을 각각 조회/표시할 수 있어야 한다.
- Region/Database 클릭 시 서버 페이징과 Spinner를 필수 적용한다.
- 확정 이후 Athena 리소스 관리 레벨은 Region 중심으로 본다.
  - `athena:{aws_account_id}/region`
  - `athena:{aws_account_id}/region/database`
  - `athena:{aws_account_id}/region/database/table`

## Change Scope

- Mock 데이터의 Athena `resource_id`를 위 계층 포맷으로 변경
- Athena 연동 확정 정보 조회: Level별 Pagination 지원
- Athena 승인 정보 조회: Level별 Pagination 지원
- Athena 승인 완료 정보 조회: Level별 Pagination 지원

## Required Order

1. Swagger 정의
2. 사용자 시나리오 업데이트 (`docs/user-stories-and-flows.md`)
3. 시나리오 기반 UX 도식 공유 후 개발 시작
