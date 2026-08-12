'use client';

/**
 * 관리자 권한 (/admin/pipelines/access/admins).
 *
 * 표 하나짜리 화면이다 — 관리자는 서비스처럼 축이 여럿인 대상이 아니라 명단 하나라서,
 * 레일도 탭도 없이 목록·추가·회수만 있으면 된다.
 *
 * 자기 자신은 회수할 수 없다(서버도 400 으로 막는다). 마지막 관리자가 스스로를 지우면
 * 되돌릴 화면이 남지 않는다.
 */
import { useState, type ReactElement } from 'react';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getCurrentUser } from '@/app/lib/api';

import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  PagedCard,
  ROWS_PER_PAGE,
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
  getAccessAdmins,
  grantAdmins,
  revokeAdmin,
  type AccessPage,
  type AccessUser,
} from '@/app/lib/api/access';

const fetchAdmins = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<AccessUser>> => getAccessAdmins(page, { ...opts, size: ROWS_PER_PAGE });

/** 담당자 표와 같은 이유로 두 열뿐이다 — 계약에 부여 일시·부여자가 없다. */
const ADMIN_COLUMNS: readonly Column[] = [
  { label: 'Knox ID', className: a.knox },
  { label: '이메일', className: a.email },
  { className: a.tail },
];

export default function AccessAdminsPage(): ReactElement {
  const admins = usePagedSection(fetchAdmins);
  const toast = usePlToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revoking, setRevoking] = useState<AccessUser | null>(null);
  const [myEmail, setMyEmail] = useState<string | null>(null);

  // 본인 행의 회수 버튼을 잠그기 위한 식별자 — 계약의 키가 email 이라 email 로 맞춘다.
  // 실패해도 화면은 그대로: 서버가 같은 규칙으로 막는다.
  useAbortableEffect((signal) => {
    return getCurrentUser()
      .then((user) => {
        if (signal.aborted) return;
        setMyEmail(user.email?.toLowerCase() ?? null);
      })
      .catch(() => undefined);
  }, []);

  const grant = async (emails: string[]): Promise<void> => {
    try {
      const result = await grantAdmins(emails);
      setPickerOpen(false);
      toast.show(`${result.granted_count}명에게 관리자 권한을 부여했어요`);
      admins.reload();
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  const revoke = async (): Promise<void> => {
    if (!revoking) return;
    try {
      await revokeAdmin(revoking.email);
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
            const isMe = myEmail != null && row.email.toLowerCase() === myEmail;
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
                    disabled={isMe}
                    title={isMe ? '자신의 관리자 권한은 회수할 수 없어요' : undefined}
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
        excludeRole="ADMIN"
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
