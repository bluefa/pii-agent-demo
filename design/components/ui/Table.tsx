'use client';

import { ReactNode } from 'react';

export interface TableColumn<T> {
  /** 컬럼 키 (고유 식별자) */
  key: string;
  /** 헤더 텍스트 또는 노드 */
  header: ReactNode;
  /** 셀 렌더링 함수 */
  render: (item: T, index: number) => ReactNode;
  /** 컬럼 CSS 클래스 */
  className?: string;
  /** 헤더 CSS 클래스 */
  headerClassName?: string;
}

export interface TableProps<T> {
  /** 테이블 데이터 */
  data: T[];
  /** 컬럼 정의 */
  columns: TableColumn<T>[];
  /** 각 행의 고유 키를 추출하는 함수 */
  keyExtractor: (item: T, index: number) => string;
  /** 행 클릭 핸들러 (선택) */
  onRowClick?: (item: T, index: number) => void;
  /** 데이터가 없을 때 표시할 메시지 */
  emptyMessage?: string;
  /** 데이터가 없을 때 표시할 아이콘 (선택) */
  emptyIcon?: ReactNode;
  /** 행에 적용할 CSS 클래스 함수 (선택) */
  rowClassName?: (item: T, index: number) => string;
  /** 호버 효과 활성화 */
  hoverable?: boolean;
  /** 테이블 컨테이너 CSS 클래스 */
  className?: string;
}

/**
 * 재사용 가능한 테이블 컴포넌트
 *
 * @example
 * const columns: TableColumn<User>[] = [
 *   {
 *     key: 'name',
 *     header: '이름',
 *     render: (user) => user.name,
 *   },
 *   {
 *     key: 'email',
 *     header: '이메일',
 *     render: (user) => user.email,
 *   },
 *   {
 *     key: 'actions',
 *     header: '액션',
 *     render: (user) => <Button onClick={() => edit(user)}>수정</Button>,
 *   },
 * ];
 *
 * <Table
 *   data={users}
 *   columns={columns}
 *   keyExtractor={(user) => user.id}
 *   onRowClick={(user) => selectUser(user)}
 *   emptyMessage="등록된 사용자가 없습니다."
 * />
 */
export const Table = <T,>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = '데이터가 없습니다.',
  emptyIcon,
  rowClassName,
  hoverable = true,
  className = '',
}: TableProps<T>) => {
  // 빈 상태 렌더링
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        {emptyIcon || (
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
        )}
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item, index) => (
            <tr
              key={keyExtractor(item, index)}
              onClick={onRowClick ? () => onRowClick(item, index) : undefined}
              className={`
                ${hoverable ? 'hover:bg-gray-50' : ''}
                ${onRowClick ? 'cursor-pointer' : ''}
                transition-colors
                ${rowClassName?.(item, index) || ''}
              `}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-6 py-4 ${col.className || ''}`}
                >
                  {col.render(item, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
