'use client';

import { useState } from 'react';
import { Resource } from '@/lib/types';
import { TIMINGS } from '@/lib/constants/timings';
import { BDC_SERVER_IP, FirewallRule } from './constants';

const extractFirewallRules = (resources: Resource[]): FirewallRule[] => {
  const rules: FirewallRule[] = [];

  resources.forEach((r) => {
    // resourceId 포맷: "DB명 (192.168.1.100:3306)" — 괄호 안의 host:port 만 추출.
    const match = r.resourceId.match(/\(([^)]+):(\d+)\)/);
    if (match) {
      const destinations = match[1].split(', ');
      const port = parseInt(match[2], 10);
      destinations.forEach((dest) => {
        rules.push({
          sourceIp: BDC_SERVER_IP,
          destinationIp: dest.trim(),
          port,
        });
      });
    }
  });

  const uniqueRules = rules.filter((rule, index, self) =>
    index === self.findIndex((r) =>
      r.sourceIp === rule.sourceIp && r.destinationIp === rule.destinationIp && r.port === rule.port
    )
  );

  return uniqueRules;
};

export const FirewallGuide = ({ resources }: { resources: Resource[] }) => {
  const [copied, setCopied] = useState(false);
  const rules = extractFirewallRules(resources);

  if (rules.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">
          등록된 리소스가 없습니다. 리소스를 추가하면 방화벽 결재 정보가 표시됩니다.
        </p>
      </div>
    );
  }

  const generateCsv = (): string => {
    const header = 'Source IP,Destination IP,Port';
    const rows = rules.map((r) => `${r.sourceIp},${r.destinationIp},${r.port}`);
    return [header, ...rows].join('\n');
  };

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(generateCsv());
      setCopied(true);
      setTimeout(() => setCopied(false), TIMINGS.TOAST_HIDE_MS);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-yellow-800">방화벽 결재 필요</span>
        </div>
        <button
          onClick={handleCopyCsv}
          className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              복사됨
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              CSV 복사
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-yellow-700 mb-2">
        아래 정보로 방화벽 결재를 진행하세요.
      </p>
      <div className="overflow-hidden rounded border border-yellow-200">
        <table className="w-full text-xs">
          <thead className="bg-yellow-100">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Source IP</th>
              <th className="px-2 py-1.5 text-center font-medium text-yellow-800"></th>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Destination IP (등록된 DB)</th>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Port</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-yellow-100">
            {rules.map((rule) => (
              <tr key={`${rule.sourceIp}-${rule.destinationIp}-${rule.port}`}>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.sourceIp}</td>
                <td className="px-1 py-1.5 text-center text-gray-400">→</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.destinationIp}</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.port}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
