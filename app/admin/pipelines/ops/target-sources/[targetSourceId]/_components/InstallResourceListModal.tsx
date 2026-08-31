'use client';

/**
 * 설치가 걸린 리소스 목록 — 경고 상자의 링크가 여는 표. 두 경고가 같은 표를 쓴다.
 *
 *   인프라 작업 탭   `ServiceWorkNotice` → 서비스 측 한 단계가 안 끝난 리소스
 *   연결 테스트 탭   `InstallPendingNotice` → 설치가 통째로 안 끝난 리소스(단계 열이 선다)
 *
 * 경고는 낱말 하나와 건수 하나로 서고(그 자리는 동작 바로 위라 그 이상 자랄 수 없다),
 * **어느 리소스인가**는 여기서 답한다. 운영자가 서비스에 연락할 때 그대로 옮겨 적는 값이
 * 행이 되므로 표는 이 콘솔의 리소스 표 그대로다 — `ConsoleTable` 셸을 `ConfirmedInfoCard`
 * 와 같은 방식으로 쓴다(덮어 자르는 셀, 싱크 열, 머리 레일).
 *
 * 행은 **아직 정착하지 않은 것만**이고, 거르는 일은 부르는 쪽이 한다 — 이 모달은 받은 것을
 * 그린다. 끝난 리소스까지 실으면 이 모달이 답하는 질문이 「이 단계는 어떻게 됐나」로 바뀌는데,
 * 그건 서비스 화면 Step 4 의 질문이고 그 화면이 이미 전부를 그린다. 여기서 묻는 것은
 * 「무엇이 걸려 있는가」다.
 *
 * ⛔ 계약에는 재점검을 **시키는** 오퍼레이션이 없다(install-v1.yaml 은 GET 하나뿐이다). 그래서
 * 이 모달은 다시 읽는 단추를 두지 않는다 — 같은 GET 을 다시 부르는 단추는 새 점검을 돌린다고
 * 읽히지만 실은 같은 답을 다시 받아 올 뿐이다. 대신 그 답이 **언제** 읽힌 것인지를 머리에 적는다.
 *
 * 열 드래그는 있고, 저장은 없다 — `useColumnResize` 의 주석이 못 박은 그대로다(「모달 표의
 * 폭은 모달과 함께 죽어도 되니 storageKey 를 생략하라」). 정체 두 열(name·id)이 `flex` 쌍이라
 * 한쪽을 끌면 다른 쪽이 싱크를 넘겨받아 분할 창처럼 움직인다.
 */
import { useState, type ReactElement } from 'react';
import { cn, idcStyles, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { Pagination } from '@/app/components/ui/Pagination';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import { fmtDateTimeShort } from '@/lib/pipeline/format';
import type { InstallLastCheck, InstallStepValue } from '@/app/components/features/process-status/install-status-detail/model';

const TITLE_ID = 'pl-install-resource-list-title';
/** 한 장에 싣는 수의 첫 값 — 이 콘솔의 리소스 목록이 쓰는 10(`RESOURCE_PAGE_SIZE`).
 *  바의 `표시 N 건씩` 이 이 값을 바꾼다. */
const PAGE_SIZE = 10;

/**
 * 상태 → 낱말과 그 색. 알약도 글리프도 없다(오너 2026-08-31): 한 열에 같은 모양의 배지가
 * 세로로 쌓이면 열 전체가 한 덩어리로 보여 **어느 행이 다른가**가 오히려 안 읽힌다. 색만
 * 진 낱말은 제 글자 폭만 차지하고, 다른 세 열과 같은 활자로 앉는다.
 *
 * 낱말도 이 콘솔의 것이다(오너 2026-08-31) — 운영자가 읽는 것은 단계의 진행이 아니라
 * **제가 할 일**이라, 서비스 화면 Step 4 의 「진행중」은 여기서 「작업필요」이고 「실패」는
 * 「조회실패」다. 계약은 FAIL 이 무엇의 실패인지 말하지 않으므로(enum 에 설명이 없다) 이
 * 낱말도 그 이상을 주장하지 않는다.
 *
 * 여기 없는 값(BDC 설치 대기·확인 중·해당 없음)은 `ko.stepValue` 의 낱말을 조용한 계열로
 * 그대로 쓴다 — 운영자를 부르는 상태가 아니므로 색을 얻지 않는다.
 */
const STATUS_LABEL: Partial<Record<InstallStepValue, { text: string; className: string }>> = {
  IN_PROGRESS: { text: '작업필요', className: 'text-[var(--pl-warn-text)]' },
  FAIL: { text: '조회실패', className: 'text-[var(--pl-err-text)]' },
  COMPLETED: { text: '완료', className: 'text-[var(--pl-ok-text)]' },
};

/** 셸이 머리를 그리므로 남는 것은 본문 칸뿐 — 치수는 확정 정보 표의 것과 같다. */
const CELL = cn(
  idcStyles.table.approvalCell,
  'align-middle text-[14px] text-[var(--pl-text-strong)]',
);
/** 값을 덮어 자르는 칸(시안 F) — 넘치는 값이 말줄임 대신 다음 열 밑으로 이어진다. */
const CLIP_CELL = cn(CELL, idcStyles.table.consoleCell);

/**
 * 합(1050)이 모달 안폭(1100 − 좌우 24 = 1052)에서 프레임 테두리 1px 씩을 뺀 폭이다 — 이 표는 가로로 스크롤하지 않는다(실측: 1052 는 1px 넘쳐 스크롤바가 섰다).
 *
 * 정체 두 열이 `flex` 쌍이다(셸이 문서로 권하는 짝): 길어지는 값은 이름과 ARN 이고, 한쪽을
 * 끌면 싱크가 다른 쪽으로 넘어가 둘이 분할 창처럼 움직인다. 340 은 바닥일 뿐 — 남는 폭은
 * 둘이 나눠 갖는다.
 *
 * 안내는 **마지막이고, 접힌다**. 운영자가 이 모달을 여는 이유가 그 문장이라 잘라 낼 수 없고,
 * 마지막 열이라 아래로 자라도 다음 열을 밀지 않는다. 나머지 셋은 덮어 자르는 칸 그대로다.
 *
 * 머리글 14px 은 셸의 기본 12px 을 덮는다 — 확정 정보 표와 같은 규칙(표 안은 전부 14px).
 */
const columnsFor = (stepColumn: boolean): readonly ConsoleTableColumn[] => {
  // 단계 열이 서면 그 160 은 정체성 두 열에서 나온다 — 합은 1050 그대로다. 프레임이
  // overflow-hidden 이라 넘기면 마지막 열이 잘리지 지면이 넓어지지 않는다.
  const identity = stepColumn ? 260 : 340;
  return [
    { key: 'name', label: 'Resource Name', width: identity, flex: true, headClassName: 'text-[14px]' },
    { key: 'id', label: 'Resource ID', width: identity, flex: true, headClassName: 'text-[14px]' },
    ...(stepColumn
      ? [{ key: 'step', label: '설치 단계', width: 160, headClassName: 'text-[14px]' } as const]
      : []),
    { key: 'status', label: '상태', width: 110, headClassName: 'text-[14px]' },
    { key: 'guide', label: '안내', width: 260, headClassName: 'text-[14px]' },
  ];
};

/** 접히는 칸 — `consoleCell` 의 nowrap 을 쓰지 않는다. 값이 길면 아래로 자란다. */
const WRAP_CELL = cn(CELL, 'whitespace-normal break-keep');

/** 한 행 — 리소스 하나의 한 단계. 같은 리소스가 두 단계에서 걸려 있으면 행도 둘이다. */
export interface InstallResourceListRow {
  resourceId: string;
  resourceName: string | null;
  /** `설치 단계` 열의 값 — 단계 열을 세우는 부르는 쪽만 채운다. */
  stepTitle?: string;
  status: InstallStepValue;
  guide: string | null;
}

export interface InstallResourceListModalProps {
  /** 목록의 정체 — 이 표가 무엇을 답하는지는 제목이 진다. */
  title: string;
  rows: readonly InstallResourceListRow[];
  /** `설치 단계` 열을 세운다. 값이 아니라 부르는 쪽의 결정이다 — 빈 목록에서도 표 모양이 같다. */
  stepColumn?: boolean;
  lastCheck: InstallLastCheck | null;
  onClose: () => void;
}

export function InstallResourceListModal({
  title,
  rows,
  stepColumn = false,
  lastCheck,
  onClose,
}: InstallResourceListModalProps): ReactElement {
  // 저장 키 없음 — 이 표의 폭은 모달과 함께 죽는다(`useColumnResize` 의 지시). 그래서
  // `ephemeralKeys` 도 필요 없다: 애초에 되살아날 폭이 없다.
  const resize = useColumnResize({ clampToContent: true });
  const columns = columnsFor(stepColumn);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // 렌더는 clamp 로 안전하지만 `page` 자체도 되돌린다 — 목록이 줄었다 늘 때 누른 적 없는
  // 자리로 돌아가지 않도록(`AgentDagTable` 과 같은 규칙).
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  if (page !== safePage) setPage(safePage);
  const pageRows = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <ModalShell
      open
      onClose={onClose}
      variant="table"
      labelledBy={TITLE_ID}
      // `text-left` 는 상속을 끊는 것이다: 이 모달은 빈 카드 안(`text-center` 인 본문)에서
      // 열리고, `position: fixed` 는 정렬 상속을 끊지 않는다. 제목과 안내줄만 세우면 표의
      // 칸(`approvalCell` 은 정렬을 선언하지 않는다)이 가운데로 남으므로 모달 전체에 건다.
      className="text-left"
    >
      <h3 id={TITLE_ID} className={pipelineStyles.modal.titleLg}>
        {title}
      </h3>
      {/* 이 답이 **언제** 읽힌 것인지 한 줄. 단계 이름은 여기 없다 — 그 문장은 이 모달을 연
          경고 상자가 이미 말했고, 제목이 목록의 정체를 이미 진다. 시각이 없으면 줄도 없다:
          계약이 checked_at 을 안 줄 수 있고, 없는 시각을 「방금」으로 읽히게 둘 수 없다. */}
      {lastCheck?.checkedAt && (
        <p className="mb-3.5 inline-flex items-center gap-1 text-[12px] text-[var(--pl-text-weak)]">
          <Icon name="clock" size="sm" />
          마지막 확인시간 {fmtDateTimeShort(lastCheck.checkedAt)}
        </p>
      )}

      <div className={cn(pipelineStyles.modal.body, 'flex-1')}>
        {/* 표는 맨몸이고 윤곽은 프레임과 페이저 바가 나눠 진다 — 프레임이 상단 라운드와
            옆선을, 바가 하단 라운드를 그린다(`framePaged` 의 계약). `frame` 은 제 12px
            라운드와 그림자로 아래를 닫아, 바가 이어진 게 아니라 끝난 카드 밑에 매달린
            것처럼 보인다. */}
        <div className={idcStyles.table.framePaged}>
          <ConsoleTable columns={columns} resize={resize}>
            <tbody className={idcStyles.table.body}>
              {pageRows.map((row) => {
                const label = STATUS_LABEL[row.status];
                return (
                  // 한 리소스가 두 단계에서 걸리면 행이 둘이라, 키도 그 둘을 갈라야 한다.
                  <tr key={`${row.resourceId}:${row.stepTitle ?? ''}`} className={idcStyles.table.row}>
                    <td className={CLIP_CELL}>{row.resourceName ?? row.resourceId}</td>
                    <td className={CLIP_CELL}>
                      <ResourceIdCell
                        value={row.resourceId}
                        label="Resource ID"
                        maxWidthClass="max-w-full"
                        sizeClass="text-[14px]"
                        hardClip
                      />
                    </td>
                    {stepColumn && <td className={CLIP_CELL}>{row.stepTitle}</td>}
                    <td className={CELL}>
                      <span className={label?.className ?? 'text-[var(--pl-text-weak)]'}>
                        {label?.text ?? INSTALL_COPY.ko.stepValue[row.status]}
                      </span>
                    </td>
                    {/* 안내가 없으면 빈 칸이다 — `—` 는 「없음」이라는 사실을 주장하는데,
                        여기서 없는 것은 계약이 이 리소스에 붙여 준 문장뿐이다. */}
                    <td className={WRAP_CELL}>{row.guide}</td>
                  </tr>
                );
              })}
            </tbody>
          </ConsoleTable>
        </div>
        {/* Step 1~7 이 쓰는 그 푸터다 — 표시 건수·범위·페이저가 한 바에 들고, 바가 표를
            아래에서 닫는다. 스크롤하는 본문 안에 두는 것은 바가 표의 아랫변이기 때문이다:
            바깥에 두면 표가 스크롤될 때 그 한 상자가 둘로 갈린다. 콘솔 표의 문자 크기는
            14px 고정(`size="md"` — `Pagination.mounts.test.ts` 가 강제한다).
            페이지가 하나여도 선다: 나타났다 사라지는 바는 없는 바로 읽힌다. */}
        <Pagination
          size="md"
          page={safePage}
          pageSize={pageSize}
          totalCount={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            // 페이지 크기가 커지면 지금 페이지 번호가 끝을 넘길 수 있다 — 첫 장으로.
            setPage(0);
          }}
        />
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
