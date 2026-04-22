'use client';

import { ReactNode } from 'react';

export interface CardProps {
  /** 카드 제목 (선택) */
  title?: string;
  /** 헤더 우측 액션 영역 (선택) */
  headerAction?: ReactNode;
  /** 카드 내용 */
  children: ReactNode;
  /** 패딩 설정 */
  padding?: 'none' | 'sm' | 'default' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
  /** 테두리 없는 플랫 스타일 */
  flat?: boolean;
}

const PADDING_CLASSES: Record<string, string> = {
  none: '',
  sm: 'p-4',
  default: 'p-6',
  lg: 'p-8',
};

/**
 * 카드 컴포넌트
 *
 * @example
 * // 기본 사용
 * <Card>
 *   <p>카드 내용</p>
 * </Card>
 *
 * // 제목과 헤더 액션
 * <Card
 *   title="프로젝트 목록"
 *   headerAction={<Button>새 프로젝트</Button>}
 * >
 *   <ProjectList />
 * </Card>
 *
 * // 패딩 없음 (테이블 등)
 * <Card title="리소스" padding="none">
 *   <table>...</table>
 * </Card>
 */
export const Card = ({
  title,
  headerAction,
  children,
  padding = 'default',
  className = '',
  flat = false,
}: CardProps) => {
  const baseClasses = flat
    ? 'bg-white rounded-xl'
    : 'bg-white rounded-xl shadow-sm';

  return (
    <div className={`${baseClasses} ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </h3>
          {headerAction}
        </div>
      )}
      <div className={PADDING_CLASSES[padding]}>{children}</div>
    </div>
  );
};

export default Card;
