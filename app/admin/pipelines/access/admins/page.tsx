'use client';

/**
 * 관리자 권한 (/admin/pipelines/access/admins).
 *
 * 표 하나짜리 화면이다 — 관리자는 서비스처럼 축이 여럿인 대상이 아니라 명단 하나라서,
 * 레일도 탭도 없이 목록·추가·회수만 있으면 된다.
 *
 * 마지막 한 명은 회수할 수 없다(서버도 400 으로 막는다) — 관리자가 0 명이 되면 되돌릴
 * 화면이 남지 않는다. 막는 축은 "몇 명 남느냐"이지 "자기 자신이냐"가 아니라서, 둘 이상
 * 남아 있으면 스스로를 지울 수도 있다.
 */
import { useCallback, useState, type ReactElement } from 'react';

import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  PagedCard,
  errorMessage,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import {
  ConfirmDangerModal,
  UserPickerModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  addAdmin,
  getAdmins,
  removeAdmin,
  sliceToPage,
  type AccessPage,
  type AccessUser,
} from '@/app/lib/api/access';

/** 담당자 표와 같은 이유로 두 열뿐이다 — 계약에 부여 일시·부여자가 없다. */
const ADMIN_COLUMNS: readonly Column[] = [
  { label: 'Knox ID', className: a.knox },
  { label: '이메일', className: a.email },
  { className: a.tail },
];

export default function AccessAdminsPage(): ReactElement {
  // 계약이 관리자 전체를 한 번에 준다(페이지 아님) — 나누는 일은 화면 몫이다.
  // 전체 목록은 따로 붙잡아 둔다: 피커의 제외 목록은 **모든** 관리자여야 하고,
  // 현재 페이지만 넘기면 2페이지의 관리자가 후보로 다시 나온다.
  const [allAdmins, setAllAdmins] = useState<AccessUser[]>([]);
  const fetchAdmins = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<AccessUser>> => {
      const all = await getAdmins(opts);
      if (!opts.signal.aborted) setAllAdmins(all);
      return sliceToPage(all, page, ACCESS_PAGE_SIZE);
    },
    [],
  );
  const admins = usePagedSection(fetchAdmins);
  const toast = usePlToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revoking, setRevoking] = useState<AccessUser | null>(null);

  // 계약의 부여는 단수(`POST /admins` body { email })라 고른 만큼 순차로 부른다.
  // 하나가 실패하면 거기서 멈추고 그때까지 부여된 것은 남는다 — 목록을 다시 읽어
  // 실제로 무엇이 반영됐는지 화면이 사실대로 말하게 한다.
  const grant = async (emails: string[]): Promise<void> => {
    let added = 0;
    try {
      for (const email of emails) {
        await addAdmin(email);
        added += 1;
      }
      setPickerOpen(false);
      toast.show(`${added}명에게 관리자 권한을 부여했어요`);
    } catch (err) {
      toast.show(errorMessage(err));
    } finally {
      admins.reload();
    }
  };

  const revoke = async (): Promise<void> => {
    if (!revoking) return;
    try {
      await removeAdmin(revoking.email);
      toast.show(`${revoking.knoxId}의 관리자 권한을 회수했어요`);
      setRevoking(null);
      admins.reload();
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  return (
    <div>
      <h1 className={a.pageTitle}>관리자 권한</h1>
      <p className={a.pageDesc}>
        접근 권한 부여·승인과 운영 콘솔을 쓸 수 있는 관리자를 관리해요
      </p>

      <PagedCard
        className="mt-6"
        title="관리자"
        desc="관리자는 모든 서비스의 권한을 조회하고 부여·해제할 수 있어요"
        icon="shield"
        tone="primary"
        state={admins}
        columns={ADMIN_COLUMNS}
        empty={{ title: '관리자가 없어요', caption: '관리자 추가로 사용자에게 권한을 주세요' }}
        action={
          <PlButton variant="primary" size="sm" onClick={() => setPickerOpen(true)}>
            관리자 추가
          </PlButton>
        }
      >
        {(rows) =>
          rows.map((row) => {
            // 계약의 규칙은 "마지막 관리자면 400" — 자기 자신이냐가 아니라 몇 명 남느냐다.
            const isLastAdmin = allAdmins.length <= 1;
            return (
              <div key={row.email} role="row" className={a.row}>
                <span role="cell" className={a.knox}>
                  {row.knoxId}
                </span>
                <span role="cell" className={a.email}>
                  {row.email}
                </span>
                <span role="cell" className={a.tail}>
                  <PlButton
                    variant="ghost"
                    size="sm"
                    disabled={isLastAdmin}
                    title={isLastAdmin ? '마지막 관리자는 회수할 수 없어요' : undefined}
                    onClick={() => setRevoking(row)}
                  >
                    회수
                  </PlButton>
                </span>
              </div>
            );
          })
        }
      </PagedCard>

      <UserPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="관리자 권한 부여"
        sub="관리자는 모든 서비스의 권한을 조회하고 부여·해제할 수 있어요."
        excludeEmails={allAdmins.map((row) => row.email)}
        submitLabel="부여"
        onSubmit={grant}
      />

      <ConfirmDangerModal
        open={revoking != null}
        onClose={() => setRevoking(null)}
        title="관리자 권한 회수"
        sub={`${revoking?.knoxId ?? ''}의 관리자 권한을 회수해요.`}
        confirmLabel="회수"
        onConfirm={revoke}
      >
        <p className={a.quote}>
          회수해도 이 사용자가 가진 서비스별 접근 권한은 그대로 남아요. 관리자 화면에만 들어올 수
          없게 돼요.
        </p>
      </ConfirmDangerModal>
    </div>
  );
}
