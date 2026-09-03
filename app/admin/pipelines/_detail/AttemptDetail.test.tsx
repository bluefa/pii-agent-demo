import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttemptDetail } from '@/app/admin/pipelines/_detail/AttemptDetail';
import { attemptWindow, j, RunWindow } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { failHead } from '@/app/admin/pipelines/_detail/JobStatus';
import type { ReactNode } from 'react';
import type { TaskAttemptView, TerraformJobStateSummary } from '@/lib/pipeline/types';

const noop = vi.fn();

const attempt = (over: Partial<TaskAttemptView> = {}): TaskAttemptView => ({
  attempt_number: 1,
  status: 'FAILED',
  error_code: 'CHECK_ERROR',
  response: null,
  failure_detail: null,
  started_at: '2026-07-13T00:00:00Z',
  finished_at: '2026-07-13T00:00:05Z',
  check: null,
  terraform_results: [],
  job_states: [],
  ...over,
});

const jobState = (over: Partial<TerraformJobStateSummary> = {}): TerraformJobStateSummary => ({
  job_id: 'job-1',
  last_state: 'RUNNING',
  last_fail_reason: null,
  last_error: null,
  poll_count: 1,
  last_polled_at: null,
  ...over,
});

const html = (a: TaskAttemptView, runWindow: ReactNode = null): string =>
  renderToStaticMarkup(
    <AttemptDetail
      attempt={a}
      operation={null}
      runWindow={runWindow}
      onOpenViewer={noop}
      onOpenFailure={noop}
    />,
  );

// A terraform dispatch-call failure yields a FAILED attempt with zero job rows: there is no
// job row, so no per-job log viewer to reach. The attempt must then surface `failure_detail`.
describe('AttemptDetail — failure cause when there are no job rows', () => {
  it('surfaces failure_detail for a FAILED attempt with no jobs', () => {
    const out = html(attempt({ failure_detail: 'infra-manager call failed: 503 Service Unavailable' }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('infra-manager call failed: 503 Service Unavailable');
  });

  it('falls back to error_code when failure_detail is absent', () => {
    const out = html(attempt({ failure_detail: null, error_code: 'CALL_TIMEOUT' }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('CALL_TIMEOUT');
  });

  it('keeps the compact behavior (no cause block) when the attempt has job rows', () => {
    const out = html(attempt({ failure_detail: 'should stay hidden', job_states: [jobState()] }));
    expect(out).toContain('Job 현황');
    expect(out).not.toContain('실패 원인');
    expect(out).not.toContain('should stay hidden');
  });

  it('shows no cause block for a non-failed attempt with no jobs', () => {
    const out = html(attempt({ status: 'IN_PROGRESS', error_code: null }));
    expect(out).not.toContain('실패 원인');
  });

  it('offers a 자세히 button when the cause is long (opens the modal)', () => {
    const long = 'infra-manager call failed: ' + 'x'.repeat(200);
    const out = html(attempt({ failure_detail: long }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('자세히');
  });

  it('shows no 자세히 button for a short cause', () => {
    const out = html(attempt({ failure_detail: 'infra-manager call failed: 503' }));
    expect(out).toContain('실패 원인');
    expect(out).not.toContain('자세히');
  });
});

// 시안 C — one run line in the card's duration grammar, not a second one ("5m 0s").
// The line moved to the verdict hero (owner 2026-08-16), where every value now
// carries the card's own label instead of an arrow ("시작/완료/소요를 명확하게").
describe('attemptWindow — run window', () => {
  it('names each value and writes the duration like the card does', () => {
    // 5s apart — fmtElapsedMs says "5초" where spanLabel used to say "5s".
    expect(attemptWindow(attempt())).toEqual([
      { k: '시작', v: '2026-07-13 09:00' },
      { k: '완료', v: '09:00' },
      { k: '소요', v: '5초' },
    ]);
  });

  it('keeps the date on 완료 when the attempt crosses midnight', () => {
    const a = attempt({ started_at: '2026-07-13T14:50:00Z', finished_at: '2026-07-13T15:10:00Z' });
    expect(attemptWindow(a)).toEqual([
      { k: '시작', v: '2026-07-13 23:50' },
      { k: '완료', v: '2026-07-14 00:10' },
      { k: '소요', v: '20분' },
    ]);
  });

  // A dangling "완료 -" reads as a value; the label goes with the missing value.
  it('says only 시작 while the attempt is still running', () => {
    const a = attempt({ status: 'IN_PROGRESS', error_code: null, finished_at: null });
    expect(attemptWindow(a)).toEqual([{ k: '시작', v: '2026-07-13 09:00' }]);
  });

  // The attempt body is always open now, so a single-attempt task would print the
  // flow card's own timestamps a second time if this block rendered there. The
  // caller decides (TerraformExec passes null below the second attempt).
  it('is not built by the attempt body itself', () => {
    expect(html(attempt())).not.toContain('2026-07-13 09:00');
  });

  // 시안 C — the window captions the Job list it belongs to, not the hero, and
  // owner 2026-08-17: one labelled row per value, not one joined line.
  it('captions Job 현황 with one row per value', () => {
    const out = html(attempt({ job_states: [jobState()] }), <RunWindow attempt={attempt()} />);
    expect(out.indexOf('Job 현황')).toBeLessThan(out.indexOf('시작'));
    expect(out.indexOf('시작')).toBeLessThan(out.indexOf('총 1건'));
    // Each label sits in its own row with its own value — no ' · ' joiner.
    expect(out).toContain('>시작</span><span class="text-[var(--pl-text-medium)]">2026-07-13 09:00<');
    expect(out).toContain('>완료</span><span class="text-[var(--pl-text-medium)]">09:00<');
    expect(out).toContain('>소요</span><span class="text-[var(--pl-text-medium)]">5초<');
  });
});

// 시안 B — the raw dispatch body is the JSON the job rows are derived from, so it
// only earns its fold when there are no rows to derive.
describe('AttemptDetail — Response 원문', () => {
  it('is hidden while the attempt has job rows', () => {
    const out = html(attempt({ response: '{"job_id":"tf-1"}', job_states: [jobState()] }));
    expect(out).not.toContain('Response 원문');
  });

  it('is kept when there are no job rows to derive it from', () => {
    const out = html(attempt({ response: '{"job_id":"tf-1"}' }));
    expect(out).toContain('Response 원문');
    expect(out).toContain('tf-1'); // the body itself, HTML-escaped by the renderer
  });
});

// 시안 A·B — the counts ARE the filter (they used to be a caption that could only
// be read), the list opens on the failures, and every row says what its job last
// did and opens the log end to end. Owner 2026-08-17: the filter is a dropdown in
// the list's own header card, because four buckets of segments wrapped.
describe('AttemptDetail — Job 현황', () => {
  const ok = (n: number): TerraformJobStateSummary[] =>
    Array.from({ length: n }, (_, i) => jobState({ job_id: `ok-${i + 1}`, last_state: 'COMPLETED' }));
  const bad = jobState({
    job_id: 'bad-1',
    last_state: 'FAILED',
    last_fail_reason: 'Error acquiring the state lock: ConditionalCheckFailedException: The conditional request failed',
  });

  it('states the total, opens on the failures, and keeps the count on the trigger', () => {
    const out = html(attempt({ job_states: [...ok(20), bad] }));
    expect(out).toContain('aria-label="Job 상태 필터: ');
    // The header states the scale; the closed trigger states the active bucket.
    expect(out).toContain('총 21건');
    expect(out).toContain('실패 1');
    // The other buckets are in the list the trigger opens, not in the markup.
    expect(out).not.toContain('성공 20');
    // The failure and the KIND of failure are on screen without opening anything —
    // 콜론 뒤 상세는 접힌 채로 대기한다.
    expect(out).toContain('>bad-1<');
    expect(out).toContain('>Error acquiring the state lock</span>');
    // 전문은 폴드 안에 마크업으로 들어 있다 — 펴면 읽히고, 접힌 동안은 안 보인다.
    expect(out).toContain('>Error acquiring the state lock: ConditionalCheckFailedException');
    // …and the 20 settled successes are not in the way.
    expect(out).not.toContain('>ok-1<');
  });

  it('sorts what is still moving above what has settled', () => {
    // No failure → the filter opens on 전체, so the ordering is observable.
    const out = html(attempt({ job_states: [...ok(3), jobState({ job_id: 'run-1' })] }));
    expect(out.indexOf('>run-1<')).toBeLessThan(out.indexOf('>ok-1<'));
  });

  // One bucket is nothing to pick between — the filter is then its own label, and
  // 전체 next to it would say the same number twice.
  it('drops the control entirely when a single verdict covers every job', () => {
    const out = html(attempt({ job_states: ok(5) }));
    expect(out).toContain('>ok-5<');
    expect(out).toContain('총 5건');
    // The word alone — the header's 총 5건 is already the count, and printing it
    // twice on one line ("총 5건  성공 5") was the segmented layout's habit.
    expect(out).toContain('>성공</span>');
    expect(out).not.toContain('성공 5');
    expect(out).not.toContain('aria-label="Job 상태 필터: ');
    expect(out).not.toContain('전체');
  });

  it('says what each job last did — state, polls, clock', () => {
    const out = html(
      attempt({
        job_states: [jobState({ job_id: 'run-1', poll_count: 6, last_polled_at: '2026-07-13T00:00:00Z' })],
      }),
    );
    expect(out).toContain('RUNNING · 6회 폴링 · 09:00');
  });

  // 접힌 줄은 한 줄이다. 클리핑 상자는 잘려 나간 나머지를 자기 padding 상자에
  // 그리므로 아래 여백은 margin 이어야 한다 — `pb-3` 일 때 실제 세 줄짜리 terraform
  // 오류가 두 줄 clamp 밑으로 잘린 세 번째 줄을 흘렸다.
  it('keeps the collapsed reason to one line, with no bottom padding', () => {
    expect(j.errHead).toContain('truncate');
    expect(j.errHead).not.toContain('line-clamp');
    // 여백은 클리핑 상자(errHead)가 아니라 폴드의 margin 이 맡아야 한다 — 잘려 나간
    // 나머지를 자기 padding 상자에 그리는 쪽은 errHead 다.
    expect(j.errHead).not.toMatch(/\bp[by]?-/);
    expect(j.errFold).toContain('mb-3');
  });

  // A terraform error names its class first and details itself after the colon.
  it('takes the head clause, and drops a leading Error: prefix', () => {
    expect(failHead('Error acquiring the state lock: ConditionalCheckFailedException: x')).toBe(
      'Error acquiring the state lock',
    );
    expect(failHead('Error: creating EC2 Instance: InvalidSubnetID.NotFound')).toBe('creating EC2 Instance');
    // No colon — nothing to cut, and `truncate` is the only bound left.
    expect(failHead('infra-manager call failed')).toBe('infra-manager call failed');
    // A parenthetical's colon is not the separator: cutting there left "(last state".
    expect(failHead("timeout while waiting for state to become 'available' (last state: 'creating', timeout: 20m0s)")).toBe(
      "timeout while waiting for state to become 'available' (last state: 'creating', timeout: 20m0s)",
    );
    expect(failHead('creating Subnet (subnet-a: primary): AccessDenied')).toBe('creating Subnet (subnet-a: primary)');
  });

  it('makes the whole row the log entry point', () => {
    const out = html(attempt({ job_states: ok(1) }));
    expect(out).toContain('aria-label="TerraformJob ok-1 · 성공 · 로그 열기"');
    expect(out).not.toContain('로그 보기');
  });

  /**
   * 폴 호출 실패는 job 의 실패 사유와 다른 값이다. terraform 사유는 앞 절이 실패의
   * 종류를 말해 주지만 `last_error` 는 앞 절이 늘 "infra-manager call failed" 라,
   * 여기에 failHead 를 걸면 상태 코드도 URL 도 화면에서 사라진다.
   */
  it('폴 호출 실패는 자르지 않고 통째로 싣는다', () => {
    const message = 'infra-manager call failed: [500] during [GET] to [http://infra-manager/jobs/j-1]';
    const out = html(
      attempt({
        job_states: [jobState({ job_id: 'call-1', last_state: 'FAILED', last_error: message })],
      }),
    );

    // 전문이 마크업 안에 있고(펴면 읽힌다), 앞 절만 남기고 버리지 않는다 —
    // 이 단언이 이 테스트의 존재 이유다.
    expect(out).toContain(message);
    expect(out).not.toContain('>infra-manager call failed</span>');
  });

  /**
   * 폴이 닿지 못한 job 은 상태를 못 읽어 판정이 실패로 서지 않는다(none/running).
   * 실패 판정에 걸어 두면 정작 호출이 실패한 그 job 에서만 오류가 안 보인다 —
   * 사용자가 실제로 부딪힌 모양이다.
   */
  it('상태를 못 읽어 판정이 서지 않은 job 도 호출 오류는 보여준다', () => {
    const message = 'infra-manager call failed: [500] during [GET] to [http://infra-manager/jobs/j-9]';
    const out = html(
      attempt({
        job_states: [jobState({ job_id: 'unknown-1', last_state: null, last_error: message })],
      }),
    );

    expect(out).toContain(message);
  });

  /**
   * 렌더 게이트를 푸는 것만으로는 부족하다 — 목록의 기본 필터가 실패 버킷이라,
   * 실패한 job 이 하나라도 있으면 판정이 서지 않은 행(= 호출 오류를 든 그 행)이
   * 필터 뒤로 걸러진다. 실제 사고가 정확히 이 모양이었다(실패 2건 + 폴 유실 1건).
   */
  it('호출 오류를 든 행이 실패 버킷에 없으면 전체로 열어 준다', () => {
    const message = 'infra-manager call failed: [500] during [GET] to [http://infra-manager/jobs/j-9]';
    const out = html(
      attempt({
        job_states: [
          jobState({ job_id: 'bad-9', last_state: 'FAILED', last_fail_reason: 'Error: boom' }),
          jobState({ job_id: 'lost-9', last_state: null, last_error: message }),
        ],
      }),
    );

    // 기본이 실패 버킷이면 lost-9 은 목록에 아예 없다.
    expect(out).toContain('>lost-9<');
    expect(out).toContain(message);
  });

  it('판정이 서지 않은 행이 없으면 기존대로 실패 버킷으로 연다', () => {
    const out = html(attempt({ job_states: [...ok(3), bad] }));

    expect(out).toContain('>bad-1<');
    expect(out).not.toContain('>ok-1<');
  });

  it('job 자신의 실패 사유가 있으면 그 쪽만 싣는다 — 호출 오류 줄은 만들지 않는다', () => {
    const out = html(
      attempt({
        job_states: [
          jobState({
            job_id: 'both-1',
            last_state: 'FAILED',
            last_fail_reason: 'Error acquiring the state lock: ConditionalCheckFailedException',
            last_error: 'infra-manager call failed: [500] during [GET] to [http://infra-manager]',
          }),
        ],
      }),
    );

    expect(out).toContain('>Error acquiring the state lock</span>');
    expect(out).not.toContain('infra-manager call failed');
  });
});
