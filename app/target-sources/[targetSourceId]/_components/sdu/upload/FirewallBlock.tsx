'use client';

import { useState } from 'react';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { YesNoAck } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/YesNoAck';
import { answerOf, regionLabels } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import {
  SDU_REGION_LABEL,
  type SduFirewall,
  type SduRegion,
  type SduTarget,
} from '@/lib/types/sdu';
import { cn, idcStyles, stackGap, textColors, textStyles } from '@/lib/theme';

export interface FirewallBlockProps {
  /** Regions of the CURRENT definition — the answer is asked about these, not about the rows. */
  regions: readonly SduRegion[];
  firewall: SduFirewall;
  /** 1단계's targets, for the 대상 count per region. */
  targets: readonly SduTarget[];
  onAnswer: (confirmed: boolean) => Promise<void>;
}

/**
 * 열 폭. 엔드포인트와 목적지 IP 는 값의 길이가 Region 마다 다르고 자리를 실제로 쓰는 두 열이라
 * 둘 다 `flex` — 셸의 문서가 권하는 짝(하나를 끌면 싱크가 다른 쪽으로 넘어간다)이다.
 * 나머지 둘의 바닥은 자기 머리글이 잘리지 않는 폭이다.
 */
const COLUMNS: ConsoleTableColumn[] = [
  { key: 'region', label: 'Region', width: 108 },
  { key: 'endpoint', label: '엔드포인트', width: 320, flex: true },
  { key: 'ips', label: '목적지 IP', width: 240, flex: true },
  { key: 'targets', label: '대상', width: 88 },
];

const CELL = cn(idcStyles.table.approvalCell, 'align-top');

/**
 * 4-1 방화벽 결재 확인.
 *
 * The table carries what goes onto a firewall request form and nothing else — endpoint, port,
 * destination IPs. The bucket name is deliberately absent: it is not what gets written on the
 * form, and 4-3's `ls` command already says it. Destination IPs stack one per line because one
 * form line is one CIDR; comma-joined, one gets dropped in transcription.
 */
export const FirewallBlock = ({ regions, firewall, targets, onAnswer }: FirewallBlockProps) => {
  const [answering, setAnswering] = useState(false);

  const answer = async (confirmed: boolean) => {
    setAnswering(true);
    try {
      await onAnswer(confirmed);
    } catch {
      // The card above says the write failed. The answer is NOT recorded here — a 아니오 note
      // under a request that never landed would be the screen agreeing with itself.
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className={cn('flex flex-col', stackGap.group)}>
      <p className={cn(textStyles.body, textColors.secondary)}>
        1단계에서 정의하신 Region은 {regionLabels(regions)} {regions.length}곳입니다. 사내 방화벽에서
        아래 엔드포인트와 목적지 IP로의 아웃바운드가 허용되어 있어야 해요.
      </p>

      <div className={idcStyles.table.frame}>
        <ConsoleTable columns={COLUMNS}>
          <tbody>
            {firewall.rows.map((row) => (
              <tr key={row.region}>
                <td className={CELL}>
                  <span className={cn(textStyles.bodyStrong, textColors.primary)}>
                    {SDU_REGION_LABEL[row.region]}
                  </span>
                </td>
                <td className={CELL}>
                  <span className={cn('font-mono text-[14px]', textColors.secondary)}>
                    {row.s3Endpoint} : {row.port}
                  </span>
                </td>
                <td className={CELL}>
                  <span className="flex flex-col gap-1">
                    {row.destinationIps.map((ip) => (
                      <span key={ip} className={cn('font-mono text-[14px]', textColors.secondary)}>
                        {ip}
                      </span>
                    ))}
                  </span>
                </td>
                <td className={CELL}>
                  <span className={cn(textStyles.body, textColors.secondary)}>
                    {targets.filter((target) => target.region === row.region).length}건
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </ConsoleTable>
      </div>

      <YesNoAck
        question="모든 Region의 방화벽 결재 내역을 확인하셨습니까?"
        value={answerOf(firewall)}
        onAnswer={answer}
        busy={answering}
      />
    </div>
  );
};
